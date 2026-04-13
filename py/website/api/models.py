from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()


class Device(models.Model):
    """
    Inventory of physical ESP32 devices. Admin creates an entry when a device is
    built. Status flips to 'registered' when a user claims it by registering a Hive.
    """
    STATUS_CREATED = 'created'
    STATUS_REGISTERED = 'registered'
    STATUS_CHOICES = [
        (STATUS_CREATED, 'Created'),
        (STATUS_REGISTERED, 'Registered'),
    ]

    macaddress = models.CharField(max_length=17, unique=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_CREATED)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.macaddress = self.macaddress.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.macaddress} ({self.status})"


class Hive(models.Model):
    """
    A user's beehive. Each hive is owned by one user and linked to one physical
    device (ESP32) via its MAC address. The device sends measurements to this hive.
    """
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hives')
    macaddress = models.CharField(max_length=17, unique=True)
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)  # user-given nickname
    address = models.CharField(max_length=300, blank=True, default='')  # geocoded address
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    exists_since = models.DateField(auto_now_add=True, auto_now=False)

    def save(self, *args, **kwargs):
        if self.macaddress:
            self.macaddress = self.macaddress.lower()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class HiveMeasurement(models.Model):
    hive = models.ForeignKey(Hive, on_delete=models.CASCADE, related_name="measurements")
    battery_level = models.FloatField(help_text="Battery level in percentage", default=0)
    timestamp = models.DateTimeField(default=timezone.now)
    temperature = models.FloatField(help_text="Temperature in Celsius")
    humidity = models.FloatField(help_text="Humidity percentage")
    co2_level = models.FloatField(help_text="CO2 levels in ppm")

    STATE_CHOICES = [
        ('QNP', 'QUEEN NOT PRESENT'),
        ('QPNA', 'QUEEN PRESENT NEWLY ACCEPTED'),
        ('QPR', 'QUEEN PRESENT AND REJECTED'),
        ('QPO', 'QUEEEN PRESENT(ORIGINAL)'),
        ('SNE', 'script not executed'),
    ]

    state = models.CharField(max_length=4, choices=STATE_CHOICES)
    audio = models.FileField(upload_to='audio/', null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['hive', 'timestamp'], name='hm_hive_ts_idx'),
        ]

    def __str__(self):
        return f"{self.hive.name} - {self.timestamp}"