from __future__ import annotations

import argparse
import sys
import threading
import time
from pathlib import Path
from typing import Any, Optional, Union

import cv2
import numpy as np
from PIL import Image, ImageTk, ImageOps
import tkinter as tk

try:
    from libcamera import controls  # type: ignore
except Exception:
    controls = None

try:
    from ultralytics import YOLO
except Exception:  # pragma: no cover - allow GUI to show fallback message
    YOLO = None

try:
    from picamera2 import Picamera2
except Exception:  # Pi-only optional dependency
    Picamera2 = None  # type: ignore

try:  # Support execution as module or script
    from ..qrgen.biometrics import BiometricScanner, BiometricReading
except (ImportError, ValueError):  # running as a script
    sys.path.append(str(Path(__file__).resolve().parents[1] / "qrgen"))
    from biometrics import BiometricScanner, BiometricReading  # type: ignore


class InferenceWorker:
    def __init__(
        self,
        model_path: Union[str, Path],
        source: Union[int, str] = 0,
        resolution: tuple[int, int] = (640, 480),
        target_fps: float = 14.0,
        infer_fps: float = 1.0,
        debug: bool = False,
    ) -> None:
        if YOLO is None:
            raise RuntimeError("Ultralytics YOLO is not installed. Run 'pip install ultralytics'.")
        self.debug = debug
        self.model = None
        model_str = str(model_path)
        try:
            self.model = YOLO(model_str)
            print(f"[Inference] YOLO model loaded: {model_str}")
        except Exception as exc:
            raise RuntimeError(f"Failed to load YOLO model '{model_str}': {exc}") from exc
        self.labels = self.model.names if self.model else {}
        self.class_colors = self._build_color_map()
        self.source = source
        self.resolution = resolution
        self.target_fps = target_fps
        self.infer_interval = 1.0 / max(0.1, infer_fps)
        self._last_infer = 0.0
        self._latest_detections: list[dict[str, Any]] = []

        self.cap = None
        self.picam: Optional[Any] = None
        self.use_picam = False
        self._init_camera()

        self.frame_lock = threading.Lock()
        self.latest_frame: Optional[np.ndarray] = None
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def _build_color_map(self):
        palette = [
            (0, 0, 255),
            (0, 255, 0),
            (255, 0, 0),
            (0, 255, 255),
            (255, 0, 255),
            (255, 255, 0),
        ]
        mapping = {}
        for idx, name in getattr(self, "labels", {}).items():
            mapping[name] = palette[idx % len(palette)]
        return mapping

    def _init_camera(self):
        if isinstance(self.source, str) and self.source.startswith("picamera"):
            if Picamera2 is None:
                raise RuntimeError("Picamera2 is not installed but picamera source was requested")
            self.use_picam = True
            self.picam = Picamera2()
            self.picam.configure(
                self.picam.create_video_configuration(
                    main={"format": "XRGB8888", "size": self.resolution}
                )
            )
            self.picam.start()
            self._enable_autofocus()
        else:
            src = self.source
            if isinstance(src, str) and src.isdigit():
                src = int(src)
            self.cap = cv2.VideoCapture(src)
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resolution[0])
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resolution[1])

    def _enable_autofocus(self):
        if not self.use_picam or not self.picam or controls is None:
            return
        try:
            self.picam.set_controls({"AfMode": controls.AfModeEnum.Continuous})
            self.picam.set_controls({"AfTrigger": controls.AfTriggerEnum.Start})
        except Exception as exc:
            print(f"Warning: unable to enable autofocus ({exc})")

    def _read_frame(self) -> Optional[np.ndarray]:
        if self.use_picam and self.picam:
            frame_bgra = self.picam.capture_array()
            return cv2.cvtColor(frame_bgra, cv2.COLOR_BGRA2BGR)
        if self.cap:
            ret, frame = self.cap.read()
            return frame if ret else None
        return None

    def _detect(self, frame: np.ndarray) -> list[dict[str, Any]]:
        if not self.model:
            return []
        results = self.model(frame, verbose=False)
        detections: list[dict[str, Any]] = []
        if results:
            first = results[0]
            boxes = getattr(first, "boxes", None)
            if boxes is None:
                if self.debug:
                    print("[Inference] No boxes in result")
                return []
            for i in range(len(boxes)):
                xyxy = boxes[i].xyxy.cpu().numpy().squeeze().astype(int)
                xmin, ymin, xmax, ymax = map(int, xyxy[:4])
                classidx = int(boxes[i].cls.item())
                classname = self.labels.get(classidx, str(classidx))
                conf = float(boxes[i].conf.item())
                detections.append(
                    {
                        "bbox": (xmin, ymin, xmax, ymax),
                        "class": classname,
                        "conf": conf,
                    }
                )
        if self.debug:
            print(f"[Inference] Frame processed, detections={len(detections)}")
        return detections

    def _draw_detections(self, frame: np.ndarray) -> np.ndarray:
        for det in self._latest_detections:
            xmin, ymin, xmax, ymax = det["bbox"]
            classname = det["class"]
            color = self.class_colors.get(classname, (0, 255, 0))
            cv2.rectangle(frame, (xmin, ymin), (xmax, ymax), color, 2)
            label = f"{classname}"
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 0.8
            thickness = 2
            (label_w, label_h), baseline = cv2.getTextSize(label, font, font_scale, thickness)
            label_y = max(ymin, label_h + 10)
            cv2.rectangle(
                frame,
                (xmin, label_y - label_h - 10),
                (xmin + label_w, label_y + baseline - 10),
                color,
                cv2.FILLED,
            )
            cv2.putText(
                frame,
                label,
                (xmin, label_y - 7),
                font,
                font_scale,
                (0, 0, 0),
                thickness,
            )
        return frame

    def _loop(self):
        sleep_target = 1.0 / max(0.1, self.target_fps)
        while not self.stop_event.is_set():
            start = time.perf_counter()
            frame = self._read_frame()
            if frame is None:
                time.sleep(0.05)
                continue
            now = time.perf_counter()
            if (now - self._last_infer) >= self.infer_interval:
                self._latest_detections = self._detect(frame)
                self._last_infer = now
            annotated = self._draw_detections(frame.copy())
            rgb = cv2.cvtColor(annotated, cv2.COLOR_BGR2RGB)
            with self.frame_lock:
                self.latest_frame = rgb
            elapsed = time.perf_counter() - start
            remaining = sleep_target - elapsed
            if remaining > 0:
                time.sleep(remaining)

    def get_frame(self) -> Optional[np.ndarray]:
        with self.frame_lock:
            if self.latest_frame is None:
                return None
            return self.latest_frame.copy()

    def stop(self):
        self.stop_event.set()
        if self.thread.is_alive():
            self.thread.join(timeout=1.0)
        if self.cap:
            self.cap.release()
        if self.use_picam and self.picam:
            self.picam.stop()


class ClinicKioskApp:
    def __init__(self, args: argparse.Namespace) -> None:
        self.args = args
        self.root = tk.Tk()
        self.root.title("Clinic Intake Kiosk")
        self.fullscreen = True
        self.root.attributes("-fullscreen", True)
        self.root.bind("<Escape>", lambda _event: self._toggle_fullscreen(False))
        self.root.bind("<F11>", lambda _event: self._toggle_fullscreen(not self.fullscreen))
        self.root.update_idletasks()
        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        self.compact_mode = screen_w <= 1280 or screen_h <= 720
        self.colors = {
            "bg": "#050816",
            "panel": "#0f172a",
            "card": "#1e293b",
            "accent": "#38bdf8",
            "accent_dark": "#0ea5e9",
            "text": "#e2e8f0",
            "muted": "#94a3b8",
        }
        self.root.configure(bg=self.colors["bg"])

        self.fonts = self._build_fonts()

        self.video_side = self._compute_video_side(args.video_size, screen_w, screen_h)
        self.video_width = self.video_side
        self.video_height = self.video_side

        self.qr_size = 210 if self.compact_mode else 260
        self.display_interval_ms = int(1000 / max(1, args.video_fps))

        self.root.columnconfigure(0, weight=1)
        self.root.columnconfigure(1, weight=1)
        self.root.rowconfigure(0, weight=1)


        self.inference = None
        self.inference_error: Optional[str] = None
        try:
            model_path = self._resolve_model_path(args.model)
            self.inference = InferenceWorker(
                model_path=model_path,
                source=args.camera,
                resolution=(self.video_width, self.video_height),
                target_fps=args.video_fps,
                infer_fps=args.infer_fps,
                debug=args.debug_inference,
            )
        except Exception as exc:
            print(f"Warning: inference display disabled ({exc})")
            self.inference_error = str(exc)
            self.inference = None

        video_container = tk.Frame(self.root, bg=self.colors["bg"])
        video_padx = (12, 12) if self.compact_mode else (28, 18)
        video_pady = (8, 6) if self.compact_mode else (28, 18)
        video_container.grid(row=0, column=0, sticky="nsew", padx=video_padx, pady=video_pady)
        video_container.columnconfigure(0, weight=1)
        video_container.rowconfigure(0, weight=1)

        self.video_frame = tk.Frame(
            video_container,
            bg=self.colors["panel"],
            highlightthickness=1,
            highlightbackground="#1d2b4c",
            width=self.video_side + 24,
            height=self.video_side + 24,
            bd=0,
            padx=12,
            pady=12,
        )
        self.video_frame.grid(row=0, column=0, sticky="n")
        self.video_frame.grid_propagate(False)

        self.video_canvas = tk.Canvas(
            self.video_frame,
            width=self.video_side,
            height=self.video_side,
            bg="#020617",
            highlightthickness=0,
        )
        self.video_canvas.pack()
        self.video_canvas_image: Optional[int] = None
        self.video_canvas_text: Optional[int] = None
        self.video_state = "live"
        self._set_video_message("Initializing camera feed…")

        control_frame = tk.Frame(self.root, bg=self.colors["bg"])
        control_frame.grid(row=0, column=1, sticky="nsew", padx=(10, 20), pady=20)
        control_frame.columnconfigure(0, weight=1)
        control_frame.bind("<Configure>", self._on_control_resize)

        header = tk.Frame(control_frame, bg=self.colors["bg"])
        header.grid(row=0, column=0, sticky="ew")
        tk.Label(
            header,
            text="Patient Intake",
            font=self.fonts["title"],
            fg=self.colors["text"],
            bg=self.colors["bg"],
        ).pack(anchor="w")
        tk.Label(
            header,
            text="Live biometrics with instant QR issuance",
            font=self.fonts["muted"],
            fg=self.colors["muted"],
            bg=self.colors["bg"],
        ).pack(anchor="w", pady=(4, 12))

        self.status_var = tk.StringVar(value="Press Start to capture biometrics")
        self.result_var = tk.StringVar(value="")

        status_card = tk.Frame(
            control_frame,
            bg=self.colors["card"],
            highlightbackground="#263a57",
            highlightthickness=1,
            bd=0,
            padx=16,
            pady=16,
        )
        status_card.grid(row=1, column=0, sticky="ew")
        self.status_label = tk.Label(
            status_card,
            textvariable=self.status_var,
            font=self.fonts["body_bold"],
            fg=self.colors["text"],
            bg=self.colors["card"],
            wraplength=320,
            justify="left",
        )
        self.status_label.pack(anchor="w")
        self.result_label = tk.Label(
            status_card,
            textvariable=self.result_var,
            font=self.fonts["body"],
            fg=self.colors["muted"],
            bg=self.colors["card"],
            wraplength=320,
            justify="left",
        )
        self.result_label.pack(anchor="w", pady=(12, 0))

        self.start_button = tk.Button(
            control_frame,
            text="Start Capture",
            command=self.start_capture,
            font=self.fonts["button"],
            bg=self.colors["accent"],
            activebackground=self.colors["accent_dark"],
            activeforeground="#ffffff",
            fg="#ffffff",
            padx=24,
            pady=12,
            relief="flat",
            cursor="hand2",
        )
        self.start_button.grid(row=2, column=0, sticky="ew", pady=(16, 0))

        tips_card = tk.Frame(
            control_frame,
            bg=self.colors["card"],
            highlightbackground="#263a57",
            highlightthickness=1,
            bd=0,
            padx=16,
            pady=16,
        )
        tips_card.grid(row=3, column=0, sticky="nsew", pady=(16, 0))
        control_frame.rowconfigure(3, weight=1)

        tk.Label(
            tips_card,
            text="Guidance",
            font=self.fonts["body_bold"],
            fg=self.colors["text"],
            bg=self.colors["card"],
        ).pack(anchor="w")
        self.tip_label = tk.Label(
            tips_card,
            text="Welcome to the clinic! When you're ready, press Start to begin capturing your biometrics.",
            font=self.fonts["muted"],
            fg=self.colors["muted"],
            bg=self.colors["card"],
            justify="left",
            wraplength=360,
        )
        self.tip_label.pack(anchor="w", pady=(10, 0))

        self.scanner: Optional[BiometricScanner] = None
        self.capture_thread: Optional[threading.Thread] = None

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)
        self.root.after(self.display_interval_ms, self._refresh_video)

    # --- GUI helpers --------------------------------------------------
    def _resolve_model_path(self, hint: Union[str, Path]) -> Path:
        hint_path = Path(hint).expanduser()
        if hint_path.exists():
            return hint_path

        script_dir = Path(__file__).resolve().parent
        fallbacks = [
            script_dir / Path(hint).name,
            script_dir / "best_ncnn_model",
            script_dir.parent / "yolo" / "best_ncnn_model",
        ]
        for candidate in fallbacks:
            if candidate.exists():
                return candidate
        raise FileNotFoundError(
            "Unable to locate YOLO model. Pass --model with the full path or place "
            "a 'best_ncnn_model' folder next to kiosk_gui.py."
        )

    def _compute_video_side(self, desired: int, screen_w: int, screen_h: int) -> int:
        if desired <= 0:
            desired = 640
        margin_w = 40
        margin_h = 80
        usable_w = max(320, screen_w - margin_w)
        usable_h = max(320, screen_h - margin_h)
        side = min(desired, usable_w, usable_h)
        return max(320, side)

    def _build_fonts(self) -> dict[str, tuple[str, int, str | None]]:
        if self.compact_mode:
            return {
                "title": ("Inter", 18, "bold"),
                "body": ("Inter", 11, "normal"),
                "body_bold": ("Inter", 12, "bold"),
                "button": ("Inter", 13, "bold"),
                "muted": ("Inter", 11, "normal"),
            }
        return {
            "title": ("Inter", 24, "bold"),
            "body": ("Inter", 12, "normal"),
            "body_bold": ("Inter", 14, "bold"),
            "button": ("Inter", 16, "bold"),
            "muted": ("Inter", 12, "normal"),
        }

    def _on_control_resize(self, event: tk.Event):
        wrap = max(200, event.width - 48)
        self.status_label.configure(wraplength=wrap)
        self.result_label.configure(wraplength=wrap)
        self.tip_label.configure(wraplength=wrap)

    def _refresh_video(self):
        if self.inference:
            frame = self.inference.get_frame()
            if frame is not None and self.video_state == "live":
                display_img = self._frame_to_display_image(frame)
                self._render_on_canvas(display_img)
        elif self.inference_error and self.video_state == "live":
            install_hint = (
                "Camera feed unavailable. Install Picamera2 with:\n"
                "sudo apt update && sudo apt install -y python3-picamera2"
            )
            self._set_video_message(install_hint)
        self.root.after(self.display_interval_ms, self._refresh_video)

    def start_capture(self):
        if self.capture_thread and self.capture_thread.is_alive():
            return
        self.status_var.set("Place your finger on the sensor and remain still…")
        self.result_var.set("")
        self.tip_label.configure(text="Reading biometrics…")
        self.start_button.config(state="disabled")
        self.video_state = "live"
        self._set_video_message("Starting camera…")
        self.capture_thread = threading.Thread(target=self._capture_worker, daemon=True)
        self.capture_thread.start()

    def _ensure_scanner(self) -> BiometricScanner:
        if self.scanner is None:
            self.scanner = BiometricScanner(qr_output=self.args.qr_path)
        return self.scanner

    def _capture_worker(self):
        try:
            scanner = self._ensure_scanner()
            reading = scanner.capture_once(timeout=self.args.capture_timeout)
        except TimeoutError:
            self._set_error("Timed out waiting for stable biometric data")
            return
        except Exception as exc:
            self._set_error(f"Capture failed: {exc}")
            return
        self.root.after(0, lambda: self._display_reading(reading))

    def _display_reading(self, reading: BiometricReading):
        self.status_var.set("QR ready – please scan to check in")
        self.result_var.set(
            f"Temp: {reading.temperature_c:.1f}°C\n"
            f"Heart Rate: {reading.heart_rate:.0f} BPM\n"
            f"SpO₂: {reading.spo2:.0f}%"
        )
        self.tip_label.configure(text="Show the on-screen QR to the patient for check-in.")
        self._display_qr_in_video(reading.qr_path)
        self.start_button.config(state="normal", text="Capture Next Patient")

    def _set_error(self, message: str):
        self.status_var.set(message)
        self.start_button.config(state="normal", text="Retry Capture")

    def on_close(self):
        if self.inference:
            self.inference.stop()
        if self.scanner:
            self.scanner.shutdown()
        self.root.destroy()

    def run(self):
        self.root.mainloop()

    def _display_qr_in_video(self, qr_path: Union[str, Path]):
        try:
            img = Image.open(qr_path)
        except Exception as exc:
            self.status_var.set(f"QR display failed: {exc}")
            return
        fitted = ImageOps.fit(img, (self.video_side, self.video_side), Image.Resampling.LANCZOS)
        self._render_on_canvas(fitted)
        self.video_state = "qr"

    def _frame_to_display_image(self, frame: np.ndarray) -> Image.Image:
        h, w = frame.shape[:2]
        side = min(h, w)
        y0 = max(0, (h - side) // 2)
        x0 = max(0, (w - side) // 2)
        cropped = frame[y0 : y0 + side, x0 : x0 + side]
        rgb = Image.fromarray(cropped)
        return rgb.resize((self.video_side, self.video_side), Image.Resampling.BILINEAR)

    def _render_on_canvas(self, pil_image: Image.Image):
        tk_img = ImageTk.PhotoImage(pil_image)
        cx = self.video_side // 2
        cy = self.video_side // 2
        if self.video_canvas_image is None:
            self.video_canvas_image = self.video_canvas.create_image(cx, cy, image=tk_img, state="normal")
        else:
            self.video_canvas.itemconfigure(self.video_canvas_image, image=tk_img, state="normal")
        self.video_canvas.image = tk_img
        if self.video_canvas_text is not None:
            self.video_canvas.itemconfigure(self.video_canvas_text, state="hidden")

    def _set_video_message(self, message: str):
        if self.video_canvas_text is None:
            self.video_canvas_text = self.video_canvas.create_text(
                self.video_side // 2,
                self.video_side // 2,
                text=message,
                fill="#cbd5f5",
                font=self.fonts["body_bold"],
                width=self.video_side - 40,
                justify="center",
            )
        else:
            self.video_canvas.itemconfigure(self.video_canvas_text, text=message, state="normal")
        if self.video_canvas_image is not None:
            self.video_canvas.itemconfigure(self.video_canvas_image, state="hidden")

    def _toggle_fullscreen(self, enable: Optional[bool] = None):
        if enable is None:
            enable = not self.fullscreen
        self.fullscreen = bool(enable)
        self.root.attributes("-fullscreen", self.fullscreen)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clinic intake GUI for Raspberry Pi")
    default_model = Path(__file__).resolve().parents[1] / "yolo" / "best_ncnn_model"
    parser.add_argument("--model", default=str(default_model), help="YOLO model path or name")
    parser.add_argument("--camera", default="picamera0", help="Camera source index/URL (default picamera0)")
    parser.add_argument("--video-width", type=int, default=640)
    parser.add_argument("--video-height", type=int, default=480)
    parser.add_argument("--video-size", type=int, default=640, help="Square dimension for preview/inference")
    parser.add_argument("--video-fps", type=float, default=14.0, help="Live feed target FPS")
    parser.add_argument("--infer-fps", type=float, default=1.0, help="YOLO inference FPS")
    parser.add_argument("--debug-inference", action="store_true", help="Print inference diagnostics")
    parser.add_argument("--capture-timeout", type=float, default=45.0)
    parser.add_argument("--qr-path", default=str(Path(__file__).resolve().parents[1] / "qrgen" / "health_qr.png"))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    app = ClinicKioskApp(args)
    app.run()


if __name__ == "__main__":
    main()
