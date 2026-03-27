import math
import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import Hive, HiveMeasurement


class Command(BaseCommand):
    help = "Seed database with fake hive measurements every 30 minutes for the last 2 weeks."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=14, help="How many days back to generate")
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Delete existing measurements before seeding",
        )

    def _clamp(self, value, min_v, max_v):
        return max(min_v, min(value, max_v))

    @transaction.atomic
    def handle(self, *args, **options):
        days = options["days"]
        replace = options["replace"]

        # Get all hives except those with ALPHA, BRAVO, CHARLIE, REAL in name
        skip_keywords = ["ALPHA", "BRAVO", "CHARLIE", "REAL"]
        all_hives = Hive.objects.all()
        hives = [h for h in all_hives if not any(keyword in h.name.upper() for keyword in skip_keywords)]

        if not hives:
            self.stdout.write(self.style.WARNING("No hives found to seed"))
            return

        if replace:
            # Delete measurements for the selected hives only
            HiveMeasurement.objects.filter(hive__in=hives).delete()
            self.stdout.write(self.style.WARNING(f"Deleted existing measurements for {len(hives)} hives."))

        now = timezone.now().replace(minute=0, second=0, microsecond=0)
        start = now - timedelta(days=days)
        interval = timedelta(minutes=30)  # 30-minute intervals
        
        states = [choice[0] for choice in HiveMeasurement.STATE_CHOICES]
        
        created_measurements = 0

        for hive in hives:
            self.stdout.write(f"Seeding {hive.name}...")
            
            base_temp = random.uniform(30.0, 35.0)
            base_humidity = random.uniform(50.0, 70.0)
            base_co2 = random.uniform(500.0, 900.0)
            base_battery = random.uniform(70.0, 100.0)

            current = start
            while current <= now:
                hour_angle = (2 * math.pi * current.hour) / 24.0
                day_angle = (2 * math.pi * current.timetuple().tm_yday) / 365.0

                temp = base_temp + 1.8 * math.sin(hour_angle) + 0.8 * math.sin(day_angle) + random.uniform(-0.5, 0.5)
                humidity = base_humidity + 5.0 * math.cos(hour_angle) + random.uniform(-2.0, 2.0)
                co2 = base_co2 + 120.0 * math.sin(hour_angle) + random.uniform(-80.0, 80.0)
                battery = self._clamp(base_battery - (days - (now - current).days) * 0.2 + random.uniform(-1.0, 1.0), 5.0, 100.0)

                measurement = HiveMeasurement.objects.create(
                    hive=hive,
                    temperature=round(self._clamp(temp, 20.0, 45.0), 2),
                    humidity=round(self._clamp(humidity, 20.0, 95.0), 2),
                    co2_level=round(self._clamp(co2, 350.0, 2500.0), 2),
                    battery_level=round(battery, 2),
                    state=random.choice(states),
                )

                # Override timestamp with historical point
                measurement.timestamp = current
                measurement.save(update_fields=["timestamp"])

                created_measurements += 1
                current += interval

        total_expected = len(hives) * (int((now - start) / interval) + 1)
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {len(hives)} hives, {created_measurements} measurements "
                f"(30-minute intervals, {days} days)"
            )
        )