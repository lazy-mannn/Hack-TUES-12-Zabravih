from .serializers import *
from .models import Device

from django.db import connection
from django.db.models import Q
from django.utils import timezone

from rest_framework.response import Response
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hive_list(request):
    hives = Hive.objects.filter(owner=request.user)
    serializer = HiveListSerializer(hives, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def hive_detail(request, pk):
    try:
        hive = Hive.objects.get(pk=pk, owner=request.user)
    except Hive.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

    query = request.query_params
    displayed_time_period_length = query.get('displayed_time')

    if displayed_time_period_length in ('24h', '7d', '14d'):

        now = timezone.now()
        if displayed_time_period_length == '24h':
            window = timedelta(hours=24)
            interval_seconds = 1800   # 30 min
        elif displayed_time_period_length == '7d':
            window = timedelta(days=7)
            interval_seconds = 10800  # 3 h
        else:
            window = timedelta(days=14)
            interval_seconds = 21600  # 6 h

        start_time = now - window

        # Single SQL round-trip: floor epoch to bucket boundary, then GROUP BY.
        # mode() picks the most frequent non-SNE state per bucket.
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    to_timestamp(
                        floor(extract(epoch from timestamp) / %(iv)s) * %(iv)s
                    ) AT TIME ZONE 'UTC'                        AS bucket_start,
                    AVG(temperature)                            AS avg_temperature,
                    AVG(humidity)                               AS avg_humidity,
                    AVG(co2_level)                              AS avg_co2_level,
                    AVG(battery_level)                          AS avg_battery_level,
                    COUNT(*)                                    AS sample_count,
                    mode() WITHIN GROUP (ORDER BY state)
                        FILTER (WHERE state <> 'SNE')           AS dominant_state
                FROM api_hivemeasurement
                WHERE hive_id = %(hive)s
                  AND timestamp >= %(start)s
                  AND timestamp <= %(now)s
                GROUP BY bucket_start
                ORDER BY bucket_start
                """,
                {'iv': interval_seconds, 'hive': hive.id, 'start': start_time, 'now': now},
            )
            rows = cursor.fetchall()

        aggregated = [
            {
                'bucket_start': row[0].isoformat(),
                'bucket_end': (row[0] + timedelta(seconds=interval_seconds)).isoformat(),
                'avg_temperature': row[1],
                'avg_humidity': row[2],
                'avg_co2_level': row[3],
                'avg_battery_level': row[4],
                'sample_count': row[5],
                'dominant_state': row[6],
            }
            for row in rows
        ]

        return Response({
            'hive_id': hive.id,
            'displayed_time': displayed_time_period_length,
            'interval_minutes': interval_seconds // 60,
            'aggregated_measurements': aggregated,
        }, status=status.HTTP_200_OK)

    serializer = HiveDetailSerializer(hive)
    return Response(serializer.data, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def register_hive(request):
    mac = request.data.get('macaddress', '').lower()

    device = Device.objects.filter(macaddress=mac, status=Device.STATUS_CREATED).first()
    if not device:
        return Response(
            {'macaddress': ['This device is not recognised or has already been registered.']},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = HiveRegisterSerializer(data=request.data, context={'request': request})
    if serializer.is_valid():
        hive = serializer.save(owner=request.user)
        device.status = Device.STATUS_REGISTERED
        device.save()
        return Response(HiveRegisterSerializer(hive).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


@api_view(['POST'])
@parser_classes([MultiPartParser])
@permission_classes([AllowAny])
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