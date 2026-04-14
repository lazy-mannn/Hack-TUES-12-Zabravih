"""
Seed 6 registered devices assigned to user 'ilia' with realistic beehive
measurements for the last 2 weeks (30-minute intervals).

Usage:
    python manage.py seed_fake_data
    python manage.py seed_fake_data --replace   # wipe ilia's hive measurements first
    python manage.py seed_fake_data --days 7
"""

import math
import random
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import Device, Hive, HiveMeasurement

User = get_user_model()

# ---------------------------------------------------------------------------
# Hive definitions – each entry becomes one Device + one Hive for 'ilia'
# ---------------------------------------------------------------------------
HIVE_CONFIGS = [
    {
        "mac": "aa:bb:cc:dd:ee:01",
        "name": "Ilia's Hive – Alpha",
        "location": "Back garden, north corner",
        # Slightly warmer hive (strong colony)
        "base_temp": 35.2,
        "base_humidity": 58.0,
        "base_co2": 900.0,
        "base_battery": 92.0,
    },
    {
        "mac": "aa:bb:cc:dd:ee:02",
        "name": "Ilia's Hive – Beta",
        "location": "Orchard row A",
        "base_temp": 34.5,
        "base_humidity": 62.0,
        "base_co2": 850.0,
        "base_battery": 85.0,
    },
    {
        "mac": "aa:bb:cc:dd:ee:03",
        "name": "Ilia's Hive – Gamma",
        "location": "Orchard row B",
        "base_temp": 34.8,
        "base_humidity": 60.0,
        "base_co2": 800.0,
        "base_battery": 78.0,
    },
    {
        "mac": "aa:bb:cc:dd:ee:04",
        "name": "Ilia's Hive – Delta",
        "location": "Field edge, west",
        # Cooler hive (less populous)
        "base_temp": 33.9,
        "base_humidity": 65.0,
        "base_co2": 950.0,
        "base_battery": 95.0,
    },
    {
        "mac": "aa:bb:cc:dd:ee:05",
        "name": "Ilia's Hive – Epsilon",
        "location": "Meadow apiary",
        "base_temp": 35.0,
        "base_humidity": 57.0,
        "base_co2": 820.0,
        "base_battery": 88.0,
    },
    {
        "mac": "aa:bb:cc:dd:ee:06",
        "name": "Ilia's Hive – Zeta",
        "location": "Rooftop hive",
        # Rooftop – more temperature variation
        "base_temp": 34.6,
        "base_humidity": 55.0,
        "base_co2": 870.0,
        "base_battery": 81.0,
    },
]

# Healthy hive: queen almost always present (original), very rare anomalies
HEALTHY_STATE_POOL = ["QPO"] * 14 + ["QPNA"] * 2 + ["QPR"] * 1 + ["QNP"] * 1 + ["SNE"] * 2


def _clamp(value, lo, hi):
    return max(lo, min(value, hi))


def _bee_temp(hour: float, base: float, *, amp: float = 1.4) -> float:
    """
    Beehive temperature follows a gentle cosine day-cycle.
    - Minimum ~03:00 (bees clustered, less fanning needed)
    - Maximum ~15:00 (peak forager activity / ambient heat)
    Amplitude is kept small because bees thermoregulate tightly.
    """
    # Shift so minimum is at 03:00, maximum at 15:00
    phase = 2 * math.pi * (hour - 3) / 24
    return base + amp * math.sin(phase)


def _bee_humidity(hour: float, base: float, *, amp: float = 8.0) -> float:
    """
    Humidity peaks at night/early morning (reduced ventilation) and
    dips in the afternoon when foragers fan vigorously.
    Opposite phase to temperature.
    """
    phase = 2 * math.pi * (hour - 3) / 24
    return base - amp * math.sin(phase)   # inverse of temp curve


def _bee_co2(hour: float, base: float, *, amp: float = 350.0) -> float:
    """
    CO2 peaks in early morning (max cluster density, minimal ventilation)
    and drops mid-afternoon when foragers ventilate the hive.
    """
    phase = 2 * math.pi * (hour - 3) / 24
    return base - amp * math.sin(phase)   # same inverse pattern as humidity


class Command(BaseCommand):
    help = (
        "Seed 6 devices registered to user 'ilia' with realistic beehive "
        "measurements for the last N days (default 14)."
    )

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=14)
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing measurements for ilia's seeded hives before re-seeding.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        days = options["days"]
        replace = options["replace"]

        # ------------------------------------------------------------------ #
        # 1. Resolve user 'ilia'
        # ------------------------------------------------------------------ #
        try:
            ilia = User.objects.get(username="ilia")
            self.stdout.write(f"Found user: {ilia.username} (id={ilia.pk})")
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                "User 'ilia' not found. Create the account first:\n"
                "  python manage.py createsuperuser --username ilia"
            ))
            return

        # ------------------------------------------------------------------ #
        # 2. Create/update devices and hives
        # ------------------------------------------------------------------ #
        hives = []
        for cfg in HIVE_CONFIGS:
            mac = cfg["mac"]

            # Ensure Device exists and is marked registered
            device, dev_created = Device.objects.get_or_create(macaddress=mac)
            if device.status != Device.STATUS_REGISTERED:
                device.status = Device.STATUS_REGISTERED
                device.save()
            self.stdout.write(
                f"  {'Created' if dev_created else 'Found'} device {mac}"
            )

            # Ensure Hive exists and belongs to ilia
            hive, hive_created = Hive.objects.get_or_create(
                macaddress=mac,
                defaults={
                    "owner": ilia,
                    "name": cfg["name"],
                    "location": cfg["location"],
                },
            )
            if not hive_created and hive.owner != ilia:
                hive.owner = ilia
                hive.save()
            self.stdout.write(
                f"  {'Created' if hive_created else 'Found'} hive '{hive.name}' (id={hive.pk})"
            )
            hives.append((hive, cfg))

        # ------------------------------------------------------------------ #
        # 3. Optionally wipe existing measurements
        # ------------------------------------------------------------------ #
        if replace:
            hive_objs = [h for h, _ in hives]
            deleted, _ = HiveMeasurement.objects.filter(hive__in=hive_objs).delete()
            self.stdout.write(self.style.WARNING(
                f"Deleted {deleted} existing measurements for ilia's hives."
            ))

        # ------------------------------------------------------------------ #
        # 4. Generate historical measurements
        # ------------------------------------------------------------------ #
        interval = timedelta(minutes=30)
        now = timezone.now().replace(second=0, microsecond=0)
        # Align to nearest 30-min boundary
        now = now.replace(minute=(now.minute // 30) * 30)
        start = now - timedelta(days=days)

        total_created = 0

        for hive, cfg in hives:
            self.stdout.write(f"Seeding '{hive.name}' …")

            base_temp     = cfg["base_temp"]
            base_humidity = cfg["base_humidity"]
            base_co2      = cfg["base_co2"]
            battery       = cfg["base_battery"]   # walks down over time

            # Pre-compute how many steps so we can drain battery correctly
            total_steps = int((now - start) / interval) + 1
            battery_drain_per_step = random.uniform(0.05, 0.12)

            measurements = []
            current = start
            step = 0

            while current <= now:
                hour = current.hour + current.minute / 60.0

                temp = (
                    _bee_temp(hour, base_temp)
                    + random.gauss(0, 0.25)   # sensor noise
                )
                hum = (
                    _bee_humidity(hour, base_humidity)
                    + random.gauss(0, 1.5)
                )
                co2 = (
                    _bee_co2(hour, base_co2)
                    + random.gauss(0, 60)
                )

                # Battery drains monotonically with small jitter
                battery = _clamp(
                    battery - battery_drain_per_step + random.gauss(0, 0.05),
                    5.0, 100.0,
                )

                m = HiveMeasurement(
                    hive=hive,
                    temperature=round(_clamp(temp, 30.0, 40.0), 2),
                    humidity=round(_clamp(hum, 35.0, 92.0), 2),
                    co2_level=round(_clamp(co2, 300.0, 3000.0), 2),
                    battery_level=round(battery, 2),
                    state=random.choice(HEALTHY_STATE_POOL),
                    timestamp=current,
                )
                measurements.append(m)
                current += interval
                step += 1

            HiveMeasurement.objects.bulk_create(measurements)
            total_created += len(measurements)
            self.stdout.write(f"  → {len(measurements)} measurements written")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. {len(hives)} hives, {total_created} total measurements "
            f"at 30-min intervals over {days} days."
        ))
