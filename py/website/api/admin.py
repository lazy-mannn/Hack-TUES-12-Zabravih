from django.contrib import admin

from .models import Hive, HiveMeasurement


@admin.register(Hive)
class HiveAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "macaddress", "location", "exists_since", "measurement_count")
    search_fields = ("name", "macaddress", "location")
    list_filter = ("exists_since",)
    ordering = ("id",)
    readonly_fields = ("exists_since",)

    def measurement_count(self, obj):
        return obj.measurements.count()

    measurement_count.short_description = "Measurements"


@admin.register(HiveMeasurement)
class HiveMeasurementAdmin(admin.ModelAdmin):
    list_display = ("id", "hive", "timestamp", "temperature", "humidity", "co2_level", "state")
    search_fields = ("hive__name", "hive__macaddress", "state")
    list_filter = ("state", "timestamp", "hive")
    ordering = ("-timestamp",)
    date_hierarchy = "timestamp"
    autocomplete_fields = ("hive",)