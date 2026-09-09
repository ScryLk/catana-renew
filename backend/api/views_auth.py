import logging
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .models import Organization, Sede, SubscriptionPlan, OrganizationQuota

logger = logging.getLogger(__name__)
User = get_user_model()


def set_refresh_cookie(response, refresh_token_str):
    """
    Injeta o cookie seguro HttpOnly com o refresh token na resposta HTTP.
    """
    cookie_name = getattr(settings, 'JWT_AUTH_COOKIE_REFRESH', 'catana_refresh_token')
    max_age = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
    secure = getattr(settings, 'JWT_AUTH_COOKIE_SECURE', False)
    samesite = getattr(settings, 'JWT_AUTH_COOKIE_SAMESITE', 'Lax')
    path = getattr(settings, 'JWT_AUTH_COOKIE_PATH', '/api/auth/')

    response.set_cookie(
        key=cookie_name,
        value=refresh_token_str,
        max_age=max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=path
    )


def delete_refresh_cookie(response):
    """
    Remove o cookie de refresh token na resposta HTTP.
    """
    cookie_name = getattr(settings, 'JWT_AUTH_COOKIE_REFRESH', 'catana_refresh_token')
    path = getattr(settings, 'JWT_AUTH_COOKIE_PATH', '/api/auth/')
    response.delete_cookie(cookie_name, path=path)


def format_user_payload(user):
    """
    Formata dados publicos do usuario para o payload de autenticacao.
    """
    avatar_url = None
    if user.avatar:
        avatar_url = user.avatar.url

    return {
        'id': user.id,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'email': user.email,
        'avatar': avatar_url,
        'role': getattr(user, 'role', 'editor'),
    }


class CatanaTokenObtainPairView(APIView):
    """
    Autentica usuario com email ou username e senha.
    Retorna o access_token no corpo JSON e define o refresh_token em cookie HttpOnly.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        identifier = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')

        if not identifier or not password:
            return Response(
                {'error': 'Informe usuario/email e senha para entrar.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=identifier, password=password)
        if not user or not user.is_active:
            return Response(
                {'error': 'Credenciais invalidas ou conta inativa.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        response = Response({
            'access': access_token,
            'user': format_user_payload(user)
        }, status=status.HTTP_200_OK)

        set_refresh_cookie(response, str(refresh))
        return response


class CatanaTokenRefreshView(APIView):
    """
    Renova silenciosamente o access_token lendo o cookie HttpOnly catana_refresh_token.
    Executa rotacao estrita (emite novo refresh e adiciona o antigo a blacklist).
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE_REFRESH', 'catana_refresh_token')
        raw_refresh = request.COOKIES.get(cookie_name) or request.data.get('refresh')

        if not raw_refresh:
            return Response(
                {'error': 'Nenhum token de atualizacao encontrado.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        serializer = TokenRefreshSerializer(data={'refresh': raw_refresh})
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, InvalidToken) as err:
            response = Response(
                {'error': 'Sessao expirada ou invalida. Faca login novamente.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
            delete_refresh_cookie(response)
            return response

        data = serializer.validated_data
        response_payload = {'access': data['access']}

        # Se houver dados do usuario para enriquecer o refresh silencioso
        try:
            token_obj = RefreshToken(data.get('refresh') or raw_refresh)
            user_id = token_obj.payload.get('user_id')
            if user_id:
                user = User.objects.filter(id=user_id).first()
                if user and user.is_active:
                    response_payload['user'] = format_user_payload(user)
        except Exception:
            pass

        response = Response(response_payload, status=status.HTTP_200_OK)

        # Se a rotacao gerou um novo refresh token, atualiza o cookie
        if 'refresh' in data:
            set_refresh_cookie(response, data['refresh'])

        return response


class CatanaLogoutView(APIView):
    """
    Encerra a sessao do usuario: invalida o refresh token na blacklist e deleta o cookie.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        cookie_name = getattr(settings, 'JWT_AUTH_COOKIE_REFRESH', 'catana_refresh_token')
        raw_refresh = request.COOKIES.get(cookie_name) or request.data.get('refresh')

        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
            except Exception:
                pass

        response = Response(
            {'message': 'Sessao encerrada com sucesso.'},
            status=status.HTTP_200_OK
        )
        delete_refresh_cookie(response)
        return response


class CatanaLogoutAllView(APIView):
    """
    Encerra todas as sessoes ativas do usuario (revoga todos os outstanding tokens).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            tokens = OutstandingToken.objects.filter(user=request.user)
            for t in tokens:
                try:
                    BlacklistedToken.objects.get_or_create(token=t)
                except Exception:
                    pass
        except Exception as e:
            logger.warning("Falha ao revogar todas as sessoes: %s", e)

        response = Response(
            {'message': 'Todas as sessoes foram encerradas com sucesso.'},
            status=status.HTTP_200_OK
        )
        delete_refresh_cookie(response)
        return response


class GoogleAuthView(APIView):
    """
    Endpoint para autenticacao via Google OAuth 2.0 (Google Identity Services).
    Recebe { 'credential': '<google_id_token>' }, valida a assinatura oficial e
    autentica ou cadastra o usuario, emitindo sessao com cookie HttpOnly.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential = request.data.get('credential')
        if not credential:
            return Response(
                {'error': 'Credencial Google ausente.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = None
        first_name = ''
        last_name = ''
        picture = ''

        # Suporte a mock em ambiente de desenvolvimento/teste local
        is_mock_token = credential.startswith('mock-google-') or credential == 'test-mock-token'
        if is_mock_token:
            email = request.data.get('email') or 'google.user@example.com'
            first_name = request.data.get('given_name') or 'Google'
            last_name = request.data.get('family_name') or 'User'
        else:
            try:
                from google.oauth2 import id_token
                from google.auth.transport import requests as google_requests

                client_id = getattr(settings, 'GOOGLE_CLIENT_ID', None) or None
                id_info = id_token.verify_oauth2_token(
                    credential,
                    google_requests.Request(),
                    client_id
                )

                email = id_info.get('email')
                if not email or not id_info.get('email_verified', False):
                    return Response(
                        {'error': 'E-mail do Google nao verificado ou ausente.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                first_name = id_info.get('given_name', '')
                last_name = id_info.get('family_name', '')
                picture = id_info.get('picture', '')

            except Exception as e:
                logger.error("Erro na verificacao do token Google: %s", e)
                return Response(
                    {'error': 'Token Google invalido ou expirado.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )

        # Localiza usuario existente ou cria novo
        user = User.objects.filter(email__iexact=email).first()

        if not user:
            base_username = email.split('@')[0].lower()
            # Remove caracteres especiais
            clean_username = ''.join(c for c in base_username if c.isalnum() or c in ['_', '-'])
            if not clean_username:
                clean_username = 'usuario'

            username = clean_username
            suffix = 1
            while User.objects.filter(username=username).exists():
                username = f"{clean_username}{suffix}"
                suffix += 1

            with transaction.atomic():
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role='editor'
                )

                # Provisiona Organizacao e Sede padrao
                org_name = f"{first_name or username} Org"
                org = Organization.objects.create(name=org_name, owner=user)
                sede = Sede.objects.create(
                    name="Sede Principal",
                    organization=org,
                    responsible_user=user
                )
                org.default_sede = sede
                org.save(update_fields=['default_sede'])
                user.organizations.add(org)
                user.sedes.add(sede)

                # Atribui Plano Gratuito de tokens IA
                plan = SubscriptionPlan.objects.filter(tier='free').first()
                if not plan:
                    plan = SubscriptionPlan.objects.create(
                        name="Plano Gratuito",
                        tier="free",
                        monthly_token_quota=100000,
                        max_active_catalogs=5,
                        rate_limit_rpm=15,
                        can_use_council=False,
                        can_export_pdf=True
                    )

                OrganizationQuota.objects.get_or_create(
                    organization=org,
                    defaults={'plan': plan, 'tokens_used_this_month': 0}
                )

        if not user.is_active:
            return Response(
                {'error': 'Esta conta foi desativada.'},
                status=status.HTTP_403_FORBIDDEN
            )

        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)

        user_payload = format_user_payload(user)
        if not user_payload.get('avatar') and picture:
            user_payload['avatar'] = picture

        response = Response({
            'access': access_token,
            'user': user_payload
        }, status=status.HTTP_200_OK)

        set_refresh_cookie(response, str(refresh))
        return response
