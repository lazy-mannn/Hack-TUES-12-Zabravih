from .serializers import *
from .authentication import require_api_key

from django.http import HttpResponse
from django.db.models import Q
from django.utils import timezone
from django.shortcuts import get_object_or_404

from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser

from datetime import timedelta

@require_api_key
@api_view(['GET'])
def hive_list(request):
    hives = Hive.objects.exclude(name='server')
    serializer = HiveListSerializer(hives, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@require_api_key
@api_view(['GET'])
def hive_detail(request, pk):
    try:
        hive = Hive.objects.get(pk=pk)
    except Hive.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    query = request.query_params
    displayed_time_period_length = query.get('displayed_time')

    if displayed_time_period_length in ('24h', '7d', '14d'):

        now = timezone.now()
        if displayed_time_period_length == '24h':
            window = timedelta(hours=24)
            interval = timedelta(minutes=30)
        elif displayed_time_period_length == '7d':
            window = timedelta(days=7)
            interval = timedelta(hours=3)
        elif displayed_time_period_length == '14d':
            window = timedelta(days=14)
            interval = timedelta(hours=6)

        start_time = now - window

        measurements_qs = HiveMeasurement.objects.filter(
            hive=hive,
            timestamp__gte=start_time,
            timestamp__lte=now,
        ).order_by('timestamp')

        buckets = {}

        for m in measurements_qs:
            ts = m.timestamp if m.timestamp.tzinfo else timezone.make_aware(m.timestamp)
            # bucket index from start_time
            elapsed = ts - start_time
            bucket_index = int(elapsed.total_seconds() // interval.total_seconds())
            bucket_start = start_time + bucket_index * interval
            key = bucket_start.isoformat()

            if key not in buckets:
                buckets[key] = {
                    'start': bucket_start,
                    'count': 0,
                    'sum_temperature': 0.0,
                    'sum_humidity': 0.0,
                    'sum_co2_level': 0.0,
                    'state_counts': {},
                }

            b = buckets[key]
            b['count'] += 1
            b['sum_temperature'] += m.temperature
            b['sum_humidity'] += m.humidity
            b['sum_co2_level'] += m.co2_level
            if m.state not in b['state_counts']:
                b['state_counts'][m.state] = 0
            b['state_counts'][m.state] += 1

        aggregated = []
        for key in sorted(buckets.keys()):
            b = buckets[key]
            if b['count'] == 0:
                continue
            bucket_start = b['start']
            bucket_end = bucket_start + interval
            aggregated.append({
                'bucket_start': bucket_start.isoformat(),
                'bucket_end': bucket_end.isoformat(),
                'avg_temperature': b['sum_temperature'] / b['count'],
                'avg_humidity': b['sum_humidity'] / b['count'],
                'avg_co2_level': b['sum_co2_level'] / b['count'],
                'sample_count': b['count'],
            })

        return Response({
            'hive_id': hive.id,
            'displayed_time': displayed_time_period_length,
            'interval_minutes': int(interval.total_seconds() // 60),
            'aggregated_measurements': aggregated,
        }, status=status.HTTP_200_OK)

    serializer = HiveDetailSerializer(hive)
    return Response(serializer.data, status=status.HTTP_200_OK)

@require_api_key
@api_view(['POST'])
def register_hive(request):
    serializer = HiveRegisterSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@parser_classes([MultiPartParser])
def get_measurement(request):
    mac = request.headers.get('Mac-Address')
    data = request.data
    file = request.FILES.get('file')
    if not mac or not data or not file:
        return Response({'error': 'No file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
    
    if file.size > 5 * 1024 * 1024:
        return Response({'error': 'File too large'}, status=status.HTTP_400_BAD_REQUEST)    
    
    if file.content_type not in ['audio/wav', 'audio/mpeg', 'audio/x-wav']:
        return Response({'error': 'Invalid file type'}, status=status.HTTP_400_BAD_REQUEST)
    
    hive = get_object_or_404(Hive, macaddress=mac)
    
    data = data.copy()
    data['hive'] = hive.id
    data['audio'] = file

    serializer = HiveMeasurementSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)