from django.db import models

class Hive(models.Model):
    macaddress = models.CharField(max_length=17, unique=True, default='')
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200)
    exists_since = models.DateField(auto_now_add=True, auto_now=False)

    def __str__(self):
        return self.name

class HiveMeasurement(models.Model):
    hive = models.ForeignKey(Hive, on_delete=models.CASCADE, related_name="measurements")
    battery_level = models.FloatField(help_text="Battery level in percentage", default=0)
    timestamp = models.DateTimeField(auto_now_add=True)
    temperature = models.FloatField(help_text="Temperature in Celsius")
    humidity = models.FloatField(help_text="Humidity percentage")
    co2_level = models.FloatField(help_text="CO2 levels in ppm")
    
    STATE_CHOICES = [
        ('QNP', 'QUEEN NOT PRESENT'),
        ('QPNA', 'QUEEN PRESENT NEWLY ACCEPTED'),
        ('QPR', 'QUEEN PRESENT AND REJECTED'),
        ('QPO', 'QUEEEN PRESENT(ORIGINAL)')
        ]
    
    state = models.CharField(max_length=4, choices=STATE_CHOICES)
    audio = models.FileField(upload_to='audio/', null=True, blank=True)

    def __str__(self):
        return f"{self.hive.name} - {self.timestamp}"