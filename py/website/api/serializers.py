from rest_framework import serializers
from .models import Hive, HiveMeasurement

class HiveListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hive
        fields = [
            'id',
            'name', 
            'location'
        ]
    
class HiveDetailSerializer(serializers.ModelSerializer):
    measurements = serializers.StringRelatedField(many=True)

    class Meta:
        model = Hive
        fields = [
            'id', 
            'name', 
            'location', 
            'exists_since', 
            'measurements'
        ]


class HiveMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = HiveMeasurement
        fields = [
            'id',
            'hive',
            'timestamp',
            'temperature',
            'humidity',
            'co2_level',
            'state',
        ]