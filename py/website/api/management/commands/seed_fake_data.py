import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import Hive, HiveMeasurement


class Command(BaseCommand):
    help = "Seed database with fake hives and hourly measurements for the last 2 weeks."

    def add_arguments(self, parser):
        parser.add_argument("--hives", type=int, default=3, help="Number of hives to create")
        parser.add_argument("--days", type=int, default=14, help="How many days back to generate")
        parser.add_argument("--interval-hours", type=int, default=1, help="Measurement interval in hours")
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing hives/measurements before seeding",
        )

    def _random_mac(self):
        return ":".join(f"{random.randint(0, 255):02X}" for _ in range(6))

    def _clamp(self, value, min_v, max_v):
        return max(min_v, min(value, max_v))

    @transaction.atomic
    def handle(self, *args, **options):
        hive_count = options["hives"]
        days = options["days"]
        interval_hours = options["interval_hours"]
        replace = options["replace"]

        if replace:
            HiveMeasurement.objects.all().delete()
            Hive.objects.all().delete()
            self.stdout.write(self.style.WARNING("Deleted existing HiveMeasurement and Hive rows."))

        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        start = now - timedelta(days=days)
        step = timedelta(hours=interval_hours)
        total_points = int((now - start) / step) + 1

        states = [choice[0] for choice in HiveMeasurement.STATE_CHOICES]
        hive_names = ["Alpha Hive", "Bravo Hive", "Charlie Hive"]
        locations = ["North Apiary", "South Apiary", "Hill Apiary"]

        hives = []
        for i in range(hive_count):
            # Ensure unique MAC address
            mac = self._random_mac()
            while Hive.objects.filter(macaddress=mac).exists():
                mac = self._random_mac()

            hive = Hive.objects.create(
                macaddress=mac,
                name=hive_names[i] if i < len(hive_names) else f"Hive {i + 1}",
                location=locations[i] if i < len(locations) else f"Location {i + 1}",
            )
            hives.append(hive)

        created_measurements = 0

        for hive_idx, hive in enumerate(hives):
            base_temp = random.uniform(30.0, 35.0)
            base_humidity = random.uniform(50.0, 70.0)
            base_co2 = random.uniform(500.0, 900.0)

            current = start
            while current <= now:
                hour_angle = (2 * math.pi * current.hour) / 24.0
                day_angle = (2 * math.pi * current.timetuple().tm_yday) / 365.0

                temp = base_temp + 1.8 * math.sin(hour_angle) + 0.8 * math.sin(day_angle) + random.uniform(-0.7, 0.7)
                humidity = base_humidity + 5.0 * math.cos(hour_angle) + random.uniform(-3.0, 3.0)
                co2 = base_co2 + 120.0 * math.sin(hour_angle + hive_idx) + random.uniform(-90.0, 90.0)

                measurement = HiveMeasurement.objects.create(
                    hive=hive,
                    temperature=round(self._clamp(temp, 20.0, 45.0), 2),
                    humidity=round(self._clamp(humidity, 20.0, 95.0), 2),
                    co2_level=round(self._clamp(co2, 350.0, 2500.0), 2),
                    state=random.choice(states),
                )

                # Override auto_now_add timestamp with historical point
                measurement.timestamp = current
                measurement.save(update_fields=["timestamp"])

                created_measurements += 1
                current += step

        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {len(hives)} hives, {created_measurements} measurements "
                f"({total_points} points per hive, {interval_hours}h interval, {days} days)."
            )
        )