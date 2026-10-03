from rest_framework.throttling import SimpleRateThrottle
from django.conf import settings


class LoginRateThrottle(SimpleRateThrottle):
    """
    Limita tentativas de login por IP contra ataques de forca bruta / credential stuffing.
    Opera dinamicamente sob as configuracoes de REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'].
    """
    scope = 'auth_login'

    def get_rate(self):
        rates = getattr(settings, 'REST_FRAMEWORK', {}).get('DEFAULT_THROTTLE_RATES', {})
        return rates.get(self.scope) or '10/min'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class RegisterRateThrottle(SimpleRateThrottle):
    """
    Limita criacao de novas contas por IP contra abuso automatizado e DoS.
    """
    scope = 'auth_register'

    def get_rate(self):
        rates = getattr(settings, 'REST_FRAMEWORK', {}).get('DEFAULT_THROTTLE_RATES', {})
        return rates.get(self.scope) or '10/min'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }


class PasswordResetRateThrottle(SimpleRateThrottle):
    """
    Limita solicitacoes e confirmacoes de recuperacao de senha por IP contra enumeracao e spam.
    """
    scope = 'auth_password_reset'

    def get_rate(self):
        rates = getattr(settings, 'REST_FRAMEWORK', {}).get('DEFAULT_THROTTLE_RATES', {})
        return rates.get(self.scope) or '5/min'

    def get_cache_key(self, request, view):
        ident = self.get_ident(request)
        return self.cache_format % {
            'scope': self.scope,
            'ident': ident
        }
