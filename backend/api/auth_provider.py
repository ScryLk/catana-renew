"""Provider boundaries for endpoints that create or mutate authentication state."""
from functools import wraps

from django.conf import settings
from rest_framework.exceptions import PermissionDenied
from rest_framework.views import APIView


def require_auth_provider(provider):
    mode = getattr(settings, 'AUTH_PROVIDER', '')
    if mode == provider:
        return
    # Retain the existing local/test compatibility mode, never production mixing.
    if mode == 'mixed' and getattr(settings, 'ENVIRONMENT', 'production') in ('development', 'test'):
        return
    raise PermissionDenied({
        'code': f'{provider}_auth_disabled',
        'error': 'Este metodo de autenticacao nao esta disponivel neste ambiente.',
    })


class LegacyAuthAPIView(APIView):
    def initial(self, request, *args, **kwargs):
        # Run before authenticators: even a Clerk bearer must not provision a user
        # while calling a disabled legacy endpoint.
        require_auth_provider('legacy')
        super().initial(request, *args, **kwargs)


class ClerkAuthAPIView(APIView):
    def initial(self, request, *args, **kwargs):
        require_auth_provider('clerk')
        super().initial(request, *args, **kwargs)


def legacy_auth_only(view):
    """Apply the same pre-authentication boundary to a DRF function view."""
    original_initial = view.cls.initial

    @wraps(original_initial)
    def initial(self, request, *args, **kwargs):
        require_auth_provider('legacy')
        original_initial(self, request, *args, **kwargs)

    view.cls.initial = initial
    return view
