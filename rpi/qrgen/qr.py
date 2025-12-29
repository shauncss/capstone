"""Biometric sensor CLI wrapper (refactored for GUI integration)."""

from __future__ import annotations

import argparse
import json
import sys
import time

try:  # Support running as module or script
    from .biometrics import (
        DEFAULT_QR_PATH,
        SERVER_HOSTNAME,
        SERVER_PORT,
        BiometricScanner,
    )
except ImportError:
    from biometrics import (  # type: ignore
        DEFAULT_QR_PATH,
        SERVER_HOSTNAME,
        SERVER_PORT,
        BiometricScanner,
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate QR codes from biometric readings")
    parser.add_argument("--single", action="store_true", help="Capture a single reading then exit")
    parser.add_argument("--timeout", type=float, default=45.0, help="Seconds to wait for a stable reading")
    parser.add_argument(
        "--repeat-delay", type=float, default=10.0, help="Delay between readings in continuous mode"
    )
    parser.add_argument("--qr-path", default=DEFAULT_QR_PATH, help="Where to write the QR PNG")
    parser.add_argument("--hostname", default=SERVER_HOSTNAME, help="Web app hostname to encode")
    parser.add_argument("--port", type=int, default=SERVER_PORT, help="Web app port to encode")
    parser.add_argument("--json", action="store_true", help="Emit the reading as JSON on success")
    return parser.parse_args()


def emit_reading(reading, emit_json: bool = False) -> None:
    payload = (
        reading.to_json()
        if emit_json
        else (
            f"Temperature: {reading.temperature_c:.1f}C | "
            f"Heart Rate: {reading.heart_rate:.0f} BPM | SpO2: {reading.spo2:.0f}%\n"
            f"QR saved to {reading.qr_path}"
        )
    )
    print(payload)


def run_single(scanner: BiometricScanner, args: argparse.Namespace) -> None:
    reading = scanner.capture_once(timeout=args.timeout)
    emit_reading(reading, emit_json=args.json)


def run_continuous(scanner: BiometricScanner, args: argparse.Namespace) -> None:
    print("Starting monitoring loop...")
    print("Place your finger steadily on the sensor.")
    while True:
        reading = scanner.capture_once(timeout=args.timeout)
        emit_reading(reading, emit_json=args.json)
        time.sleep(max(0.0, args.repeat_delay))


def main() -> int:
    args = parse_args()
    scanner = BiometricScanner(hostname=args.hostname, port=args.port, qr_output=args.qr_path)
    try:
        if args.single:
            run_single(scanner, args)
        else:
            run_continuous(scanner, args)
        return 0
    except TimeoutError as exc:
        print(f"ERROR: {exc}")
        return 2
    except KeyboardInterrupt:
        print("Shutting down monitor...")
        return 0
    finally:
        scanner.shutdown()


if __name__ == "__main__":
    sys.exit(main())
