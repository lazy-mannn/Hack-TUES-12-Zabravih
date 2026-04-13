"""
compact_measurements — replace raw HiveMeasurement rows older than a
configurable age with a single averaged row per 30-minute bucket.

Usage:
    python manage.py compact_measurements
    python manage.py compact_measurements --older-than 4   # hours (default 2)
    python manage.py compact_measurements --bucket 15      # bucket size in minutes (default 30)
    python manage.py compact_measurements --dry-run        # print summary, no writes

How it works:
  1. Fetch raw rows older than --older-than hours, grouped by hive.
  2. For each 30-min (or --bucket) time window, compute averaged values and the
     mode of non-SNE states.
  3. In a single transaction per hive: delete the raw rows, insert one
     compacted row per non-empty bucket.

The compacted row uses the bucket *start* as its timestamp and has
audio=NULL (raw audio files have been discarded by the upload handler anyway).
"""

import math
from collections import defaultdict
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from api.models import Hive, HiveMeasurement


class Command(BaseCommand):
    help = "Compact raw measurements older than N hours into 30-min averaged rows."

    def add_arguments(self, parser):
        parser.add_argument(
            '--older-than', type=float, default=2.0, metavar='HOURS',
            help='Compact rows older than this many hours (default: 2).',
        )
        parser.add_argument(
            '--bucket', type=int, default=30, metavar='MINUTES',
            help='Bucket size in minutes (default: 30).',
        )
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Print what would happen without writing anything.',
        )

    def handle(self, *args, **options):
        older_than_hours = options['older_than']
        bucket_minutes = options['bucket']
        dry_run = options['dry_run']

        cutoff = timezone.now() - timedelta(hours=older_than_hours)
        bucket_seconds = bucket_minutes * 60

        self.stdout.write(
            f"Compacting measurements older than {older_than_hours}h "
            f"into {bucket_minutes}-min buckets"
            + (" [DRY RUN]" if dry_run else "")
        )

        hives = Hive.objects.all()
        total_deleted = 0
        total_inserted = 0

        for hive in hives:
            raw_qs = HiveMeasurement.objects.filter(
                hive=hive,
                timestamp__lt=cutoff,
            ).order_by('timestamp')

            rows = list(raw_qs.values(
                'id', 'timestamp', 'temperature', 'humidity',
                'co2_level', 'battery_level', 'state',
            ))

            if not rows:
                continue

            # Group into buckets keyed by integer bucket index
            buckets: dict[int, dict] = defaultdict(lambda: {
                'temps': [], 'humids': [], 'co2s': [], 'batts': [], 'states': [], 'ids': [],
            })
            epoch_origin = rows[0]['timestamp'].replace(
                hour=0, minute=0, second=0, microsecond=0,
            )
            for row in rows:
                ts = row['timestamp']
                elapsed = (ts - epoch_origin).total_seconds()
                idx = math.floor(elapsed / bucket_seconds)
                b = buckets[idx]
                b['temps'].append(row['temperature'])
                b['humids'].append(row['humidity'])
                b['co2s'].append(row['co2_level'])
                b['batts'].append(row['battery_level'])
                if row['state'] != 'SNE':
                    b['states'].append(row['state'])
                b['ids'].append(row['id'])

            new_rows = []
            ids_to_delete = []

            for idx, b in sorted(buckets.items()):
                n = len(b['temps'])
                bucket_start = epoch_origin + timedelta(seconds=idx * bucket_seconds)

                # dominant state: most frequent non-SNE state, else 'SNE'
                if b['states']:
                    dominant = max(set(b['states']), key=b['states'].count)
                else:
                    dominant = 'SNE'

                new_rows.append(HiveMeasurement(
                    hive=hive,
                    timestamp=bucket_start,
                    temperature=sum(b['temps']) / n,
                    humidity=sum(b['humids']) / n,
                    co2_level=sum(b['co2s']) / n,
                    battery_level=sum(b['batts']) / n,
                    state=dominant,
                    audio=None,
                ))
                ids_to_delete.extend(b['ids'])

            self.stdout.write(
                f"  Hive {hive.id} ({hive.name}): "
                f"{len(ids_to_delete)} rows → {len(new_rows)} compacted"
            )

            if not dry_run:
                with transaction.atomic():
                    HiveMeasurement.objects.filter(id__in=ids_to_delete).delete()
                    HiveMeasurement.objects.bulk_create(new_rows)

            total_deleted += len(ids_to_delete)
            total_inserted += len(new_rows)

        action = "Would compact" if dry_run else "Compacted"
        self.stdout.write(
            self.style.SUCCESS(
                f"{action} {total_deleted} rows into {total_inserted} rows across all hives."
            )
        )
