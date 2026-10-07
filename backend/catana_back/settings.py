# TODO(humano): SEG-01 - rotacionar SECRET_KEY e a senha do banco e expurgar o
# .env do historico git (BFG/git filter-repo). O .env foi removido do tracking,
# mas os segredos antigos ja vazaram no historico e precisam ser invalidados.
import environ
from datetime import timedelta
from pathlib import Path

env = environ.Env(
    # set casting, default value
    DEBUG=(bool, False)
)

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Take environment variables from .env file
environ.Env.read_env(BASE_DIR / '.env')

# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = env('SECRET_KEY')

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = env('DEBUG')

# SEC-ENV: Ambiente operacional e trava de segurança de mocks
ENVIRONMENT = env('ENVIRONMENT', default=('development' if DEBUG else 'production'))
AUTH_PROVIDER = env('AUTH_PROVIDER', default='mixed')
ALLOW_MOCK_OAUTH = env.bool('ALLOW_MOCK_OAUTH', default=False)
if not DEBUG or ENVIRONMENT == 'production':
    ALLOW_MOCK_OAUTH = False

# SEG-04: hosts e origens lidos de env, com default restrito quando DEBUG=False.
# Em dev (DEBUG=True) caímos para o comportamento aberto de sempre.
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=(['*'] if DEBUG else []))

# CORS Settings
# Em dev libera tudo; em prod usa a allowlist de CORS_ALLOWED_ORIGINS do env.
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[
    'https://usecatana.com.br',
    'http://usecatana.com.br',
    'https://www.usecatana.com.br',
    'http://www.usecatana.com.br',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
])
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Set-Cookie']

# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'api',
    'drf_spectacular',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'catana_back.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'catana_back.wsgi.application'


# Database
# https://docs.djangoproject.com/en/5.2/ref/settings/#databases

DATABASES = {
    'default': env.db('DATABASE_URL', default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
}


# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# SEC-PWD: Criptografia moderna de senhas em repouso com Argon2id adaptativo
# Mantem PBKDF2 e BCrypt na lista para migracao transparente e retrocompatibilidade
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]


# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
DOCUMENT_IMPORT_PRIVATE_ROOT = env('DOCUMENT_IMPORT_PRIVATE_ROOT', default=str(BASE_DIR / 'private_document_imports'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'api.clerk_auth.ClerkJWTAuthentication',
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # SEG-02: por padrao exige autenticacao. Endpoints publicos declaram
    # AllowAny explicitamente (ver allowlist no topo de api/views.py).
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # INC-07: aponta o schema do drf-spectacular como gerador padrao.
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # COR-03: paginacao global padrao (24/pagina, 4x6 no front).
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 24,
    # SEC-09: Throttling / Rate Limiting defensivo contra abuso e brute force
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': env('THROTTLE_ANON_RATE', default='300/min'),
        'user': env('THROTTLE_USER_RATE', default='1200/min'),
        'auth_login': env('THROTTLE_AUTH_LOGIN_RATE', default='10/min'),
        'auth_register': env('THROTTLE_AUTH_REGISTER_RATE', default='10/min'),
        'auth_password_reset': env('THROTTLE_PASSWORD_RESET_RATE', default='5/min'),
    },
}

AUTH_USER_MODEL = 'api.User'

# SEG-05: hardening de producao. So vale quando DEBUG=False; em dev nada muda.
if not DEBUG:
    SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)
    SECURE_HSTS_SECONDS = env.int('SECURE_HSTS_SECONDS', default=31536000)
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SESSION_COOKIE_SECURE = env.bool('SESSION_COOKIE_SECURE', default=True)
    CSRF_COOKIE_SECURE = env.bool('CSRF_COOKIE_SECURE', default=True)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SAMESITE = 'Lax'
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_BROWSER_XSS_FILTER = True
    X_FRAME_OPTIONS = 'DENY'
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SECURE_CROSS_ORIGIN_OPENER_POLICY = env('SECURE_CROSS_ORIGIN_OPENER_POLICY', default='same-origin-allow-popups')
    if not SECURE_SSL_REDIRECT:
        SILENCED_SYSTEM_CHECKS = ['security.W008']

CSRF_TRUSTED_ORIGINS = env.list('CSRF_TRUSTED_ORIGINS', default=[
    'https://usecatana.com.br',
    'http://usecatana.com.br',
    'https://www.usecatana.com.br',
    'http://www.usecatana.com.br',
    'http://179.236.238.62',
    'http://srv2029979.hstgr.cloud',
    'http://localhost',
    'http://127.0.0.1',
])

# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Google Gemini AI configuration
GEMINI_API_KEY = env('GEMINI_API_KEY', default='')
AI_DEFAULT_MODEL = env('AI_DEFAULT_MODEL', default='gemini-flash-latest')

# ==============================================================================
# CATANA 2.0 - AUTENTICACAO AVANCADA, SIMPLE_JWT & GOOGLE OAUTH 2.0
# ==============================================================================

AUTHENTICATION_BACKENDS = [
    'api.auth_backends.EmailOrUsernameModelBackend',
    'django.contrib.auth.backends.ModelBackend',
]

SIMPLE_JWT = {
    # SEC-02: TTL de token de acesso restrito a 30 minutos em alinhamento com OWASP ASVS
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=90),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
SESSION_COOKIE_AGE = 60 * 60 * 24 * 90  # 90 dias de sessao persistente estilo OpenAI/Gemini

# Parametros para Cookie HttpOnly de Refresh Token (Opcao A)
JWT_AUTH_COOKIE_REFRESH = 'catana_refresh_token'
JWT_AUTH_COOKIE_PATH = '/api/auth/'
JWT_AUTH_COOKIE_SAMESITE = 'Lax'
JWT_AUTH_COOKIE_SECURE = not DEBUG

# Google OAuth 2.0
GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET', default='')

# Password Reset & Email Configuration
FRONTEND_URL = env('FRONTEND_URL', default=('http://localhost:5173' if DEBUG else 'https://usecatana.com.br'))
EMAIL_BACKEND = env('EMAIL_BACKEND', default='django.core.mail.backends.console.EmailBackend')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='Catana <noreply@catana.dev>')

# Clerk Auth-as-a-Service Configuration
CLERK_PUBLISHABLE_KEY = env('CLERK_PUBLISHABLE_KEY', default='')
CLERK_SECRET_KEY = env('CLERK_SECRET_KEY', default='')
CLERK_JWKS_URL = env('CLERK_JWKS_URL', default='https://api.clerk.com/v1/jwks')
CLERK_WEBHOOK_SECRET = env('CLERK_WEBHOOK_SECRET', default='')

# AbacatePay Gateway Configuration
ABACATEPAY_API_KEY = env('ABACATEPAY_API_KEY', default='')
ABACATEPAY_WEBHOOK_SECRET = env('ABACATEPAY_WEBHOOK_SECRET', default='')
KATANA_FRONTEND_URL = env('KATANA_FRONTEND_URL', default=FRONTEND_URL)

# SEC-08: Logging centralizado e estruturado para auditoria e observabilidade
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'standard': {
            'format': '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'standard',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}

# Explicit production mode prevents Clerk/legacy credentials competing.
if AUTH_PROVIDER == 'clerk':
    REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = ('api.clerk_auth.ClerkJWTAuthentication',)
elif AUTH_PROVIDER == 'legacy':
    REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = ('rest_framework_simplejwt.authentication.JWTAuthentication',)
