from django.conf import settings
from django.core.checks import Error, register
from api.auth_config import validate_backend_config

@register()
def production_auth_config(app_configs, **kwargs):
    if settings.ENVIRONMENT != 'production':
        return []
    return [Error(message, id='catana.E001') for message in validate_backend_config(settings)]
