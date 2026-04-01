import threading

_thread_local = threading.local()


def get_current_user():
    request = getattr(_thread_local, 'request', None)
    if request is None:
        return None
    return getattr(request, 'user', None)


class CurrentUserMiddleware:
    """Stores the authenticated request user in thread-local storage
    so that Django signals can access it without needing the request object."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_local.request = request
        try:
            return self.get_response(request)
        finally:
            _thread_local.request = None
