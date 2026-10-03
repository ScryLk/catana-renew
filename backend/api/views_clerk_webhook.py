import json
import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from svix.webhooks import Webhook, WebhookVerificationError
from api.clerk_auth import provision_local_user_from_clerk

logger = logging.getLogger(__name__)
User = get_user_model()


class ClerkWebhookView(APIView):
    """
    Endpoint para recepcao de Webhooks do Clerk assinados via Svix.
    Processa sincronizacao de usuarios: user.created, user.updated, user.deleted.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        webhook_secret = getattr(settings, 'CLERK_WEBHOOK_SECRET', '')
        headers = request.headers
        svix_id = headers.get('svix-id')
        svix_timestamp = headers.get('svix-timestamp')
        svix_signature = headers.get('svix-signature')

        payload_bytes = request.body

        # Valida assinatura Svix quando configurada
        if webhook_secret:
            if not svix_id or not svix_timestamp or not svix_signature:
                return Response(
                    {'error': 'Cabecalhos Svix ausentes.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                wh = Webhook(webhook_secret)
                wh.verify(payload_bytes, {
                    'svix-id': svix_id,
                    'svix-timestamp': svix_timestamp,
                    'svix-signature': svix_signature,
                })
            except (WebhookVerificationError, Exception) as err:
                logger.error("Falha na verificacao do webhook do Clerk: %s", err)
                return Response(
                    {'error': 'Assinatura do webhook invalida.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            if not getattr(settings, 'DEBUG', False):
                logger.error("CLERK_WEBHOOK_SECRET nao configurado em producao.")
                return Response(
                    {'error': 'Webhook secret nao configurado.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        try:
            event = json.loads(payload_bytes.decode('utf-8'))
        except Exception as err:
            logger.error("Payload JSON invalido no webhook do Clerk: %s", err)
            return Response(
                {'error': 'Payload JSON invalido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        event_type = event.get('type')
        data = event.get('data', {})
        clerk_id = data.get('id')

        logger.info("Webhook Clerk recebido: tipo=%s, clerk_id=%s", event_type, clerk_id)

        if not clerk_id:
            return Response({'status': 'ignored', 'reason': 'sem id'}, status=status.HTTP_200_OK)

        # 1. Evento: Criacao de Usuario
        if event_type == 'user.created':
            emails = data.get('email_addresses', [])
            primary_email_id = data.get('primary_email_address_id')
            primary_email = ''
            for em in emails:
                if em.get('id') == primary_email_id or not primary_email:
                    primary_email = em.get('email_address', '')

            first_name = data.get('first_name') or ''
            last_name = data.get('last_name') or ''

            user = User.objects.filter(clerk_user_id=clerk_id).first()
            if not user and primary_email:
                user = User.objects.filter(email__iexact=primary_email).first()
                if user:
                    user.clerk_user_id = clerk_id
                    user.save(update_fields=['clerk_user_id'])

            if not user:
                provision_local_user_from_clerk(
                    clerk_id=clerk_id,
                    email=primary_email,
                    first_name=first_name,
                    last_name=last_name,
                )
                logger.info("Novo usuario provisionado via Webhook Clerk: %s (%s)", clerk_id, primary_email)

        # 2. Evento: Atualizacao de Usuario
        elif event_type == 'user.updated':
            user = User.objects.filter(clerk_user_id=clerk_id).first()
            if user:
                first_name = data.get('first_name')
                last_name = data.get('last_name')
                if first_name is not None:
                    user.first_name = first_name
                if last_name is not None:
                    user.last_name = last_name

                emails = data.get('email_addresses', [])
                primary_email_id = data.get('primary_email_address_id')
                for em in emails:
                    if em.get('id') == primary_email_id:
                        user.email = em.get('email_address', user.email)
                        break

                user.save(update_fields=['first_name', 'last_name', 'email'])
                logger.info("Usuario atualizado via Webhook Clerk: %s", clerk_id)

        # 3. Evento: Remocao de Usuario
        elif event_type == 'user.deleted':
            user = User.objects.filter(clerk_user_id=clerk_id).first()
            if user:
                user.is_active = False
                user.save(update_fields=['is_active'])
                logger.info("Usuario desativado via Webhook Clerk: %s", clerk_id)

        return Response({'status': 'success', 'event': event_type}, status=status.HTTP_200_OK)
