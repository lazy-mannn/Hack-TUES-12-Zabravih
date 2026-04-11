import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_alter_hivemeasurement_state'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add Device inventory table
        migrations.CreateModel(
            name='Device',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('macaddress', models.CharField(max_length=17, unique=True)),
                ('status', models.CharField(
                    choices=[('created', 'Created'), ('registered', 'Registered')],
                    default='created',
                    max_length=12,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        # Add owner FK to Hive — table is empty so default=1 is safe and only
        # used for the migration SQL; no rows will actually receive it.
        migrations.AddField(
            model_name='hive',
            name='owner',
            field=models.ForeignKey(
                default=1,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='hives',
                to=settings.AUTH_USER_MODEL,
            ),
            preserve_default=False,
        ),
    ]
