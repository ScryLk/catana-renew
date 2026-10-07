import time
import logging
import requests
import jwt
from jwt.algorithms import RSAAlgorithm
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)
User = get_user_model()

# Cache global em memoria para as chaves publicas JWKS do Clerk
_JWKS_CACHE = {
    'keys': {},
    'last_fetched': 0,
}
_JWKS_TTL_SECONDS = 3600  # 1 hora


def get_clerk_jwks(jwks_url: str) -> dict:
    """
    Obtem o conjunto de chaves publicas (JWKS) do Clerk com cache em memoria.
    """
    now = time.time()
    if _JWKS_CACHE['keys'] and (now - _JWKS_CACHE['last_fetched'] < _JWKS_TTL_SECONDS):
        return _JWKS_CACHE['keys']

    try:
        headers = {}
        secret_key = getattr(settings, 'CLERK_SECRET_KEY', '')
        if secret_key:
            headers['Authorization'] = f'Bearer {secret_key}'
        resp = requests.get(jwks_url, headers=headers, timeout=10)
        resp.raise_for_status()
        jwks = resp.json()
        keys_by_kid = {k['kid']: k for k in jwks.get('keys', []) if 'kid' in k}
        _JWKS_CACHE['keys'] = keys_by_kid
        _JWKS_CACHE['last_fetched'] = now
        return keys_by_kid
    except Exception as e:
        logger.error("Falha ao obter JWKS do Clerk em %s: %s", jwks_url, e)
        if _JWKS_CACHE['keys']:
            return _JWKS_CACHE['keys']
        return {}


def _create_local_user_from_clerk(clerk_id: str, email: str = '', first_name: str = '', last_name: str = ''):
    """
    Provisiona um usuario local com Organizacao e Sede padrao a partir de dados do Clerk.
    """
    from api.models import Organization, Sede, SubscriptionPlan, OrganizationQuota

    base_username = (email.split('@')[0] if email else clerk_id).lower()
    clean_username = ''.join(c for c in base_username if c.isalnum() or c in ['_', '-']) or 'usuario'
    username = clean_username
    suffix = 1
    while User.objects.filter(username=username).exists():
        username = f"{clean_username}_{suffix}"
        suffix += 1

    user = User.objects.create(
        username=username,
        email=email or f"{clerk_id}@clerk.user",
        clerk_user_id=clerk_id,
        first_name=first_name,
        last_name=last_name,
        role='editor',
    )

    org_name = f"{first_name or username} Org"
    org = Organization.objects.create(name=org_name, owner=user)
    sede = Sede.objects.create(
        name="Sede Principal",
        organization=org,
        responsible_user=user,
    )
    org.default_sede = sede
    org.save(update_fields=['default_sede'])
    user.organizations.add(org)
    user.sedes.add(sede)

    from api.guards.quota_guard import get_or_create_default_plan
    plan = get_or_create_default_plan('free')

    OrganizationQuota.objects.get_or_create(
        organization=org,
        defaults={'plan': plan, 'tokens_used_this_month': 0},
    )

    return user


def provision_local_user_from_clerk(clerk_id: str, email: str = '', first_name: str = '', last_name: str = ''):
    # Unique clerk_user_id selects one winner. Its entire workspace commits atomically.
    for attempt in range(3):
        try:
            with transaction.atomic():
                existing = User.objects.filter(clerk_user_id=clerk_id).first()
                if existing:
                    return existing
                return _create_local_user_from_clerk(clerk_id, email, first_name, last_name)
        except IntegrityError:
            existing = User.objects.filter(clerk_user_id=clerk_id).first()
            if existing:
                return existing
            if attempt == 2:
                raise


class ClerkJWTAuthentication(BaseAuthentication):
    """
    Autenticador do Django REST Framework para validar tokens JWT do Clerk.
    Valida a assinatura criptografica com chaves publicas RS256 via JWKS
    e localiza/cria o usuario correspondente no banco de dados local.
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header:
            return None

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != 'bearer':
            return None

        raw_token = parts[1].strip()
        if not raw_token:
            return None

        # Suporte a mock estritamente restrito a dev/testes com flag explicita
        allow_mock = (
            getattr(settings, 'DEBUG', False) is True
            and getattr(settings, 'ENVIRONMENT', 'development') != 'production'
            and getattr(settings, 'ALLOW_MOCK_OAUTH', False) is True
        )
        if allow_mock and (raw_token.startswith('mock-clerk-') or raw_token == 'test-mock-token'):
            mock_id = request.headers.get('X-Mock-Clerk-User', 'mock_clerk_user_1')
            user = User.objects.filter(clerk_user_id=mock_id).first()
            if not user:
                user = provision_local_user_from_clerk(mock_id, email='demo@catana.dev')
            return (user, {'sub': mock_id, 'mock': True})

        # Decodifica o header do JWT sem validar para extrair o kid
        try:
            unverified_header = jwt.get_unverified_header(raw_token)
        except Exception as e:
            # Se nao for JWT compativel com Clerk, permite que outro backend tente
            logger.debug("Token nao compativel com JWT: %s", e)
            return None

        kid = unverified_header.get('kid')
        alg = unverified_header.get('alg', 'RS256')

        if alg != 'RS256':
            return None

        jwks_url = getattr(settings, 'CLERK_JWKS_URL', 'https://api.clerk.com/v1/jwks')
        keys = get_clerk_jwks(jwks_url)

        jwk_data = keys.get(kid) if kid else None
        if not jwk_data and keys:
            # Tenta forcar refresh do cache caso nova chave tenha sido rotacionada
            _JWKS_CACHE['last_fetched'] = 0
            keys = get_clerk_jwks(jwks_url)
            jwk_data = keys.get(kid) if kid else None

        if not jwk_data:
            logger.warning("Chave publica (kid: %s) nao encontrada no JWKS do Clerk", kid)
            raise AuthenticationFailed("Chave de assinatura do token invalida ou nao reconhecida.")

        try:
            public_key = RSAAlgorithm.from_jwk(jwk_data)
            payload = jwt.decode(
                raw_token,
                key=public_key,
                algorithms=['RS256'],
                options={"verify_exp": True},
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Sessao expirada. Por favor, faca login novamente.")
        except jwt.InvalidTokenError as err:
            logger.warning("Token do Clerk invalido: %s", err)
            raise AuthenticationFailed("Token de autenticacao invalido.")

        clerk_id = payload.get('sub')
        if not clerk_id:
            raise AuthenticationFailed("Identificador do usuario ausente no token do Clerk.")

        # Reconcilia usuario local
        user = User.objects.filter(clerk_user_id=clerk_id).first()

        # Se nao achou por clerk_user_id, tenta por email nas claims
        email = payload.get('email') or payload.get('primary_email_address') or ''
        if not user and email:
            user = User.objects.filter(email__iexact=email, clerk_user_id__isnull=True).first()
            if user:
                with transaction.atomic():
                    linked = User.objects.filter(pk=user.pk, clerk_user_id__isnull=True).update(clerk_user_id=clerk_id)
                if not linked:
                    user = User.objects.filter(clerk_user_id=clerk_id).first()

        # Se ainda nao existir, provisiona localmente com seguranca
        if not user:
            first_name = payload.get('first_name', '')
            last_name = payload.get('last_name', '')
            user = provision_local_user_from_clerk(
                clerk_id=clerk_id,
                email=email,
                first_name=first_name,
                last_name=last_name,
            )

        if not user.is_active:
            raise AuthenticationFailed("Conta desativada.")

        return (user, payload)

    def authenticate_header(self, request):
        return 'Bearer realm="Clerk"'
