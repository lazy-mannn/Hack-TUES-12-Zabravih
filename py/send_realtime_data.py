#!/usr/bin/env python3
"""
Real-time beehive data sender.

Simulates 6 ESP32 devices continuously posting measurements to
https://smeehive.zabravih.org/api/measurements/ (or a custom URL).

Each POST includes:
  - X-Mac-Address header   → identifies the hive
  - multipart field 'data' → JSON with temperature / humidity / co2_level / battery_level
  - multipart file  'file' → minimal valid WAV (silence) so server-side inference runs

Usage:
    python send_realtime_data.py
    python send_realtime_data.py --url https://smeehive.zabravih.org --interval 30
    python send_realtime_data.py --url http://127.0.0.1:8000 --interval 10
    python send_realtime_data.py --hives aa:bb:cc:dd:ee:01 aa:bb:cc:dd:ee:02
"""

import argparse
import io
import json
import math
import random
import struct
import time
import wave
from datetime import datetime, timezone

try:
    import requests
except ImportError:
    raise SystemExit("Install requests first:  pip install requests")


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DEFAULT_URL      = "https://smeehive.zabravih.org"
DEFAULT_INTERVAL = 30   # seconds between each posting round

# Must match hives already in the database (seeded by seed_fake_data command)
ALL_MACS = [
    "aa:bb:cc:dd:ee:01",
    "aa:bb:cc:dd:ee:02",
    "aa:bb:cc:dd:ee:03",
    "aa:bb:cc:dd:ee:04",
    "aa:bb:cc:dd:ee:05",
    "aa:bb:cc:dd:ee:06",
]

# Per-device baseline sensor values (mirrors seed_fake_data.py)
DEVICE_BASES = {
    "aa:bb:cc:dd:ee:01": {"temp": 35.2, "humidity": 58.0, "co2": 900.0,  "battery": 92.0},
    "aa:bb:cc:dd:ee:02": {"temp": 34.5, "humidity": 62.0, "co2": 850.0,  "battery": 85.0},
    "aa:bb:cc:dd:ee:03": {"temp": 34.8, "humidity": 60.0, "co2": 800.0,  "battery": 78.0},
    "aa:bb:cc:dd:ee:04": {"temp": 33.9, "humidity": 65.0, "co2": 950.0,  "battery": 95.0},
    "aa:bb:cc:dd:ee:05": {"temp": 35.0, "humidity": 57.0, "co2": 820.0,  "battery": 88.0},
    "aa:bb:cc:dd:ee:06": {"temp": 34.6, "humidity": 55.0, "co2": 870.0,  "battery": 81.0},
}


# ---------------------------------------------------------------------------
# Realistic beehive sensor curves (same math as seed script)
# ---------------------------------------------------------------------------

def _clamp(v, lo, hi):
    return max(lo, min(v, hi))


def _bee_temp(hour: float, base: float) -> float:
    """Min ~03:00, max ~15:00, amplitude ±1.4°C."""
    return base + 1.4 * math.sin(2 * math.pi * (hour - 3) / 24)


def _bee_humidity(hour: float, base: float) -> float:
    """Inverse of temperature: dips mid-afternoon, peaks early morning."""
    return base - 8.0 * math.sin(2 * math.pi * (hour - 3) / 24)


def _bee_co2(hour: float, base: float) -> float:
    """CO2 peaks pre-dawn (cluster at rest), drops mid-afternoon (fanning)."""
    return base - 350.0 * math.sin(2 * math.pi * (hour - 3) / 24)


# ---------------------------------------------------------------------------
# Minimal valid WAV file (silence) – created once, reused every POST
# ---------------------------------------------------------------------------

def _make_silent_wav(duration_s: float = 0.5, sample_rate: int = 16000) -> bytes:
    n = int(sample_rate * duration_s)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(struct.pack(f"<{n}h", *([0] * n)))
    return buf.getvalue()


_SILENT_WAV = _make_silent_wav()


# ---------------------------------------------------------------------------
# Per-device state
# ---------------------------------------------------------------------------

class DeviceState:
    def __init__(self, mac: str):
        self.mac = mac
        base = DEVICE_BASES.get(mac, {"temp": 34.5, "humidity": 60.0, "co2": 850.0, "battery": 85.0})
        self.battery        = base["battery"]
        self._base_temp     = base["temp"]
        self._base_humidity = base["humidity"]
        self._base_co2      = base["co2"]

    def reading(self) -> dict:
        now  = datetime.now(timezone.utc)
        hour = now.hour + now.minute / 60.0

        temp = _bee_temp(hour, self._base_temp)     + random.gauss(0, 0.25)
        hum  = _bee_humidity(hour, self._base_humidity) + random.gauss(0, 1.5)
        co2  = _bee_co2(hour, self._base_co2)       + random.gauss(0, 60)

        # Battery drains slowly with tiny jitter
        self.battery = _clamp(
            self.battery - random.uniform(0.05, 0.15) + random.gauss(0, 0.03),
            5.0, 100.0,
        )

        return {
            "temperature":   round(_clamp(temp, 30.0, 40.0), 2),
            "humidity":      round(_clamp(hum,  35.0, 92.0), 2),
            "co2_level":     round(_clamp(co2,  300.0, 3000.0), 2),
            "battery_level": round(self.battery, 2),
        }


# ---------------------------------------------------------------------------
# HTTP sender
# ---------------------------------------------------------------------------

def send_measurement(base_url: str, device: DeviceState) -> None:
    endpoint = base_url.rstrip("/") + "/api/measurements/"
    sensor_data = device.reading()

    files = {
        "file": ("hive_audio.wav", io.BytesIO(_SILENT_WAV), "audio/wav"),
        "data": (None, json.dumps(sensor_data)),
    }
    headers = {"X-Mac-Address": device.mac}

    ts = datetime.now().strftime("%H:%M:%S")
    try:
        resp = requests.post(endpoint, files=files, headers=headers, timeout=20)
        if resp.status_code == 201:
            print(
                f"[{ts}] OK  {device.mac}  "
                f"T={sensor_data['temperature']:.1f}C  "
                f"H={sensor_data['humidity']:.1f}%  "
                f"CO2={sensor_data['co2_level']:.0f}ppm  "
                f"bat={sensor_data['battery_level']:.1f}%"
            )
        else:
            print(f"[{ts}] ERR {device.mac}  HTTP {resp.status_code}: {resp.text[:200]}")
    except requests.RequestException as exc:
        print(f"[{ts}] ERR {device.mac}  {exc}")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Send real-time beehive data to the API.")
    parser.add_argument(
        "--url", default=DEFAULT_URL,
        help=f"Base URL of the server (default: {DEFAULT_URL})",
    )
    parser.add_argument(
        "--interval", type=float, default=DEFAULT_INTERVAL,
        help=f"Seconds between posting rounds (default: {DEFAULT_INTERVAL})",
    )
    parser.add_argument(
        "--hives", nargs="+", default=ALL_MACS, metavar="MAC",
        help="MAC addresses to simulate (default: all 6)",
    )
    args = parser.parse_args()

    devices  = [DeviceState(mac) for mac in args.hives]
    endpoint = args.url.rstrip("/") + "/api/measurements/"

    print(f"Posting to: {endpoint}")
    print(f"Devices:    {len(devices)}")
    print(f"Interval:   {args.interval}s per round")
    print("-" * 70)

    while True:
        for device in devices:
            send_measurement(args.url, device)
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
