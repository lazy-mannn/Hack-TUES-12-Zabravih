from functools import wraps
from django.http import JsonResponse
from .models import Hive


def require_api_key(view_func):
    """
    Validates the X-Api-Key header against registered Hive MAC addresses.
    The Next.js server must have its own MAC address pre-registered as a Hive.
    """
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        mac = request.headers.get('X-Api-Key', '')
        if not mac or not Hive.objects.filter(macaddress=mac).exists():
            return JsonResponse({'detail': 'Forbidden'}, status=403)
        return view_func(request, *args, **kwargs)
    return wrapper
