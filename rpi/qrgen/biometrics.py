"""Reusable helpers for reading biometric sensors and producing QR codes."""
from __future__ import annotations

import json
import socket
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Dict, Optional, Tuple

import qrcode

try:  # Hardware libs only exist on the Pi
    import board  # type: ignore
    import busio  # type: ignore
    import adafruit_mlx90614  # type: ignore
except Exception:  # pragma: no cover - Windows dev box fallback
    board = None  # type: ignore
    busio = None  # type: ignore
    adafruit_mlx90614 = None  # type: ignore

try:
    from .heartrate_monitor import HeartRateMonitor
except ImportError:  # pragma: no cover - fallback when executed directly
    from heartrate_monitor import HeartRateMonitor


SERVER_HOSTNAME = "LAPTOP-OCP2J7E0.local"
SERVER_PORT = 5173
DEFAULT_QR_PATH = "health_qr.png"

VALID_TEMP_THRESHOLD = 24.0
VALID_HR_THRESHOLD = 25.0
VALID_SPO2_THRESHOLD = 70.0
MIN_VALID_SIGNALS = 2


def resolve_base_url(hostname: str = SERVER_HOSTNAME, port: int = SERVER_PORT) -> Tuple[str, str]:
    """Resolve the hostname once so URLs point to the current laptop IP."""
    try:
        ip_addr = socket.gethostbyname(hostname)
        base_url = f"http://{ip_addr}:{port}/?"
    except socket.gaierror:
        ip_addr = hostname
        base_url = f"http://{hostname}:{port}/?"
    return base_url, ip_addr


def build_qr_url(base_url: str, temp: float, spo2: float, hr: float) -> str:
    return f"{base_url}temp={temp:.1f}&spo2={spo2:.0f}&hr={hr:.0f}"


def generate_qr_code(url: str, output_path: Path) -> Path:
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save(output_path)
    return output_path


@dataclass
class BiometricReading:
    temperature_c: float
    spo2: float
    heart_rate: float
    qr_path: Path
    url: str

    def as_dict(self) -> Dict[str, str]:
        return {
            "temperature_c": f"{self.temperature_c:.1f}",
            "spo2": f"{self.spo2:.0f}",
            "heart_rate": f"{self.heart_rate:.0f}",
            "qr_path": str(self.qr_path),
            "url": self.url,
        }

    def to_json(self) -> str:
        return json.dumps(self.as_dict())


class BiometricScanner:
    """Wrapper around MLX90614 + MAX30105 sensors that blocks until readings are stable."""

    def __init__(
        self,
        hostname: str = SERVER_HOSTNAME,
        port: int = SERVER_PORT,
        qr_output: Path | str = DEFAULT_QR_PATH,
        logger: Callable[[str], None] = print,
    ) -> None:
        self.logger = logger
        self.base_url, self.server_ip = resolve_base_url(hostname, port)
        self.qr_output = Path(qr_output)

        self.logger(f"Resolved check-in base URL: {self.base_url}")

        if not busio or not board:
            raise RuntimeError("busio/board libraries are unavailable on this platform")

        self.i2c = busio.I2C(board.SCL, board.SDA)
        self.mlx = self._init_mlx()
        self.hrm = self._init_hrm()
        if self.hrm:
            time.sleep(2)  # give MAX30105 thread time to warm up

    def _init_mlx(self):
        if not adafruit_mlx90614:
            return None
        try:
            sensor = adafruit_mlx90614.MLX90614(self.i2c)
            self.logger("MLX90614 ready")
            return sensor
        except ValueError:
            self.logger("MLX90614 (0x5A) not found; temperature readings will be zero")
            return None

    def _init_hrm(self):
        try:
            hrm = HeartRateMonitor(print_result=False)
            hrm.start_sensor()
            self.logger("MAX30105 heart monitor started")
            return hrm
        except Exception as exc:  # pragma: no cover - hardware specific
            self.logger(f"MAX30105 failed to start: {exc}")
            return None

    def shutdown(self) -> None:
        if self.hrm:
            try:
                self.hrm.stop_sensor()
            except Exception:
                pass
            self.hrm = None

    def __del__(self) -> None:  # pragma: no cover - rely on GC only as fallback
        self.shutdown()

    # --- Reading helpers -------------------------------------------------
    def read_temp(self) -> float:
        if not self.mlx:
            return 0.0
        try:
            return float(self.mlx.object_temperature)
        except Exception:
            return 0.0

    def read_spo2_hr(self) -> Tuple[float, float]:
        if not self.hrm:
            return 0.0, 0.0
        return float(self.hrm.spo2), float(self.hrm.bpm)

    def _is_valid(self, temp: float, spo2: float, hr: float) -> bool:
        checks = [
            temp > VALID_TEMP_THRESHOLD,
            hr > VALID_HR_THRESHOLD,
            spo2 > VALID_SPO2_THRESHOLD,
        ]
        strong_pulse = hr > VALID_HR_THRESHOLD and spo2 > VALID_SPO2_THRESHOLD
        return (sum(checks) >= MIN_VALID_SIGNALS and strong_pulse) or strong_pulse

    # --- Public API ------------------------------------------------------
    def capture_once(
        self,
        timeout: float = 45.0,
        poll_interval: float = 0.5,
    ) -> BiometricReading:
        start = time.time()
        while time.time() - start <= timeout:
            temp_c = self.read_temp()
            spo2, hr = self.read_spo2_hr()
            self.logger(
                f"Waiting for stable data... (T:{temp_c:.1f}, HR:{hr:.0f}, SpO2:{spo2:.0f})"
            )
            if self._is_valid(temp_c, spo2, hr):
                url = build_qr_url(self.base_url, temp_c, spo2, hr)
                qr_path = generate_qr_code(url, self.qr_output)
                self.logger(
                    f"Valid reading captured -> Temp:{temp_c:.1f}C HR:{hr:.0f} SpO2:{spo2:.0f}%"
                )
                return BiometricReading(
                    temperature_c=temp_c,
                    spo2=spo2,
                    heart_rate=hr,
                    qr_path=qr_path,
                    url=url,
                )
            time.sleep(poll_interval)
        raise TimeoutError("Timed out waiting for a stable biometric reading")


__all__ = ["BiometricScanner", "BiometricReading", "generate_qr_code", "build_qr_url"]
