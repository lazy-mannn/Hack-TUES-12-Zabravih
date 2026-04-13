import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0006_device_hive_owner'),
    ]

    operations = [
        # Change timestamp from auto_now_add (not editable) to a plain default
        # so compact_measurements can create rows with arbitrary past timestamps.
        migrations.AlterField(
            model_name='hivemeasurement',
            name='timestamp',
            field=models.DateTimeField(default=django.utils.timezone.now),
        ),
        # Composite index for the time-range queries in hive_detail
        migrations.AddIndex(
            model_name='hivemeasurement',
            index=models.Index(
                fields=['hive', 'timestamp'],
                name='hm_hive_ts_idx',
            ),
        ),
    ]
