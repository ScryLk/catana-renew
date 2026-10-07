"""Non-sensitive production authentication configuration validation."""
from urllib.parse import urlparse

def validate_backend_config(settings):
    errors = []
    mode = settings.AUTH_PROVIDER
    if mode not in ('clerk', 'legacy'):
        errors.append('AUTH_PROVIDER must be explicitly clerk or legacy')
    if settings.DEBUG or settings.ENVIRONMENT != 'production':
        errors.append('production ENVIRONMENT and DEBUG=False required')
    if len(settings.SECRET_KEY) < 50:
        errors.append('strong SECRET_KEY required')
    if not settings.ALLOWED_HOSTS or '*' in settings.ALLOWED_HOSTS:
        errors.append('explicit ALLOWED_HOSTS required')
    if mode == 'clerk':
        parsed = urlparse(settings.CLERK_JWKS_URL)
        if parsed.scheme != 'https' or not parsed.hostname:
            errors.append('HTTPS CLERK_JWKS_URL required')
        if parsed.hostname == 'api.clerk.com' and not settings.CLERK_SECRET_KEY:
            errors.append('CLERK_SECRET_KEY required for Clerk API JWKS endpoint')
    return errors

