class RealIPMiddleware:
    """
    Promote the real client IP into REMOTE_ADDR so that allauth (and anything
    else that reads request.META['REMOTE_ADDR']) sees the browser's IP rather
    than the local proxy address.

    Nginx is trusted to set X-Real-IP to $remote_addr (the address of the
    direct client, i.e. the browser, since Nginx is the outermost proxy).
    If X-Real-IP is not present, fall back to the leftmost address in
    X-Forwarded-For.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        real_ip = (
            request.META.get('HTTP_X_REAL_IP')
            or request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
        )
        if real_ip:
            request.META['REMOTE_ADDR'] = real_ip
        return self.get_response(request)
