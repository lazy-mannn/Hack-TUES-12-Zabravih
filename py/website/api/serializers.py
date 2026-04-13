from rest_framework import serializers
from .models import Hive, HiveMeasurement

class HiveRegisterSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hive
        fields = ['id', 'macaddress', 'name', 'location', 'address', 'latitude', 'longitude']
        # owner is injected by the view via save(owner=request.user)

class HiveListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hive
        fields = ['id', 'name', 'location', 'address', 'latitude', 'longitude']

class HiveDetailSerializer(serializers.ModelSerializer):
    measurements = serializers.StringRelatedField(many=True)

    class Meta:
        model = Hive
        fields = ['id', 'name', 'location', 'address', 'latitude', 'longitude', 'exists_since', 'measurements']


class HiveEditSerializer(serializers.ModelSerializer):
    class Meta:
        model = Hive
        fields = ['id', 'name', 'location', 'address', 'latitude', 'longitude']

class HiveMeasurementSerializer(serializers.ModelSerializer):
    class Meta:
        model = HiveMeasurement
        fields = '__all__'
    
    def create(self, validated_data):
        audio_file = validated_data.get('audio')
        
        instance = HiveMeasurement.objects.create(**validated_data)
        
        if audio_file:
            timestamp = instance.timestamp.strftime('%Y%m%d_%H%M%S')
            original_name = audio_file.name
            file_ext = original_name.split('.')[-1] if '.' in original_name else 'wav'
            new_filename = f"{instance.id}_{timestamp}.{file_ext}"
            
            instance.audio.save(f"audio/{new_filename}", audio_file, save=False)
            instance.save()
        
        return instance