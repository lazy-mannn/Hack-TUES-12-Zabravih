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

from datetime import timedelta, datetime
import subprocess
import json
import os
import logging

logger = logging.getLogger('api.measurements')

from django.conf import settings

YAMNET_PYTHON = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '/home/main/Hack-TUES-12-Zabravih/beemodel/queendetection/yamnet-env/bin/python')
)
INFERENCE_SCRIPT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '/home/main/Hack-TUES-12-Zabravih/beemodel/queendetection/inference.py')
)
INFERENCE_CWD = os.path.abspath(
    os.path.join(os.path.dirname(__file__), '/home/main/Hack-TUES-12-Zabravih/beemodel/queendetection')
)
AUDIO_UPLOAD_DIR = os.path.join(settings.MEDIA_ROOT, 'audio')

LABEL_TO_STATE = {
    'queen not present': 'QNP',
    'queen present and newly accepted': 'QPNA',
    'queen present and rejected': 'QPR',
    'queen present or original queen': 'QPO',
    'script not executed' : 'SNE',
}


def run_inference(hive_id: int) -> str:
    """Run inference on the latest audio file for the given hive ID and return the state code.

    Files are expected to be named {hive_id}_{YYYYMMDD_HHMMSS}.{ext}.
    The one with the latest timestamp in its name is chosen.
    """
    prefix = f"{hive_id}_"
    candidates = []
    for filename in os.listdir(AUDIO_UPLOAD_DIR):
        if not filename.startswith(prefix):
            continue
        path = os.path.join(AUDIO_UPLOAD_DIR, filename)
        if not os.path.isfile(path):
            continue
        # Parse timestamp from filename: {hive_id}_{YYYYMMDD_HHMMSS}.{ext}
        stem = filename[len(prefix):].rsplit('.', 1)[0]  # e.g. "20260327_143012"
        try:
            ts = datetime.strptime(stem, '%Y%m%d_%H%M%S')
        except ValueError:
            continue
        candidates.append((ts, path))

    if not candidates:
        return 'SNE'

    _, latest_path = max(candidates, key=lambda x: x[0])

    try:
        result = subprocess.run(
            [YAMNET_PYTHON, INFERENCE_SCRIPT, latest_path],
            capture_output=True,
            text=True,
            cwd=INFERENCE_CWD,
            timeout=60,
        )
        if result.returncode != 0:
            logger.error('Inference failed (rc=%s): %s', result.returncode, result.stderr.strip())
            return 'SNE'
        label = result.stdout.strip().lower()
        logger.info('Inference raw label: %r', label)
        return LABEL_TO_STATE.get(label, 'SNE')
    except subprocess.TimeoutExpired:
        logger.error('Inference timed out after 60s')
        return 'SNE'
    except Exception as e:
        logger.error('Inference exception: %s', e)
        return 'SNE'


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
                    'sum_battery_level': 0.0,
                    'state_counts': {},
                }

            b = buckets[key]
            b['count'] += 1
            b['sum_temperature'] += m.temperature
            b['sum_humidity'] += m.humidity
            b['sum_co2_level'] += m.co2_level
            b['sum_battery_level'] += m.battery_level
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
                'avg_battery_level': b['sum_battery_level'] / b['count'],
                'sample_count': b['count'],
                'dominant_state': max(
                    (s for s in b['state_counts'] if s != 'SNE'),
                    key=b['state_counts'].get,
                    default=None,
                ),
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


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@api_view(['POST'])
@parser_classes([MultiPartParser])
def get_measurement(request):
    logger.info('--- incoming measurement request ---')
    logger.info('Headers: %s', dict(request.headers))
    logger.info('FILES keys: %s', list(request.FILES.keys()))
    logger.info('DATA (non-file): %s', {k: v for k, v in request.data.items() if k != 'file'})

    mac = (request.headers.get('X-Mac-Address') or request.headers.get('Mac-Address') or '').lower()
    logger.info('Resolved MAC: %r', mac)
    if not mac:
        logger.warning('Rejected: missing MAC header')
        return Response({'error': 'Missing X-Mac-Address header'}, status=status.HTTP_403_FORBIDDEN)

    hive = Hive.objects.filter(macaddress=mac).first()
    if not hive:
        logger.warning('Rejected: unknown MAC %r', mac)
        return Response({'error': 'Unknown device 2'}, status=status.HTTP_403_FORBIDDEN)
    logger.info('Hive matched: id=%s name=%r', hive.id, hive.name)

    file = request.FILES.get('file')
    if not file:
        logger.warning('Rejected: no audio file in request')
        return Response({'error': 'No audio file uploaded'}, status=status.HTTP_400_BAD_REQUEST)
    logger.info('File: name=%r size=%s content_type=%r', file.name, file.size, file.content_type)

    if file.size > 100 * 1024 * 1024:
        logger.warning('Rejected: file too large (%s bytes)', file.size)
        return Response({'error': 'File too large'}, status=status.HTTP_400_BAD_REQUEST)

    ALLOWED_CONTENT_TYPES = {'audio/wav', 'audio/mpeg', 'audio/x-wav', 'application/octet-stream'}
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        logger.warning('Rejected: invalid content_type %r', file.content_type)
        return Response({'error': 'Invalid file type'}, status=status.HTTP_400_BAD_REQUEST)

    raw_data = request.data.get('data', '{}')
    logger.info('Raw sensor data field: %r', raw_data)
    try:
        sensor_data = json.loads(raw_data)
    except (ValueError, TypeError):
        sensor_data = {}
    logger.info('Parsed sensor data: %s', sensor_data)

    # Save file temporarily for inference
    os.makedirs(AUDIO_UPLOAD_DIR, exist_ok=True)
    ext = file.name.rsplit('.', 1)[-1] if '.' in file.name else 'wav'
    ts_str = timezone.now().strftime('%Y%m%d_%H%M%S')
    tmp_filename = f"{hive.id}_{ts_str}.{ext}"
    tmp_path = os.path.join(AUDIO_UPLOAD_DIR, tmp_filename)
    with open(tmp_path, 'wb') as f:
        for chunk in file.chunks():
            f.write(chunk)

    try:
        state = run_inference(hive.id)
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
    logger.info('Inference state: %r', state)

    file.seek(0)

    # ESP sends sensor values as direct multipart fields; fall back to those
    # if the nested JSON 'data' field is missing or empty.
    def _get(key, *aliases, default=0):
        for k in (key, *aliases):
            if k in sensor_data:
                return sensor_data[k]
            if k in request.data:
                return request.data[k]
        return default

    temperature   = _to_float(_get('temperature'))
    humidity      = _to_float(_get('humidity'))
    co2_level     = _to_float(_get('co2_level', default=0))
    battery_level = _to_float(_get('battery_level', 'battery', default=0))

    payload = {
        'hive': hive.id,
        'audio': file,
        'state': state,
        'temperature': temperature,
        'humidity': humidity,
        'co2_level': co2_level,
        'battery_level': battery_level,
    }
    logger.info('Payload (pre-serializer): %s', {k: v for k, v in payload.items() if k != 'audio'})

    serializer = HiveMeasurementSerializer(data=payload)
    if serializer.is_valid():
        serializer.save()
        logger.info('Measurement saved successfully')
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    logger.error('Serializer errors: %s', serializer.errors)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)