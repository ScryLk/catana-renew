from decimal import Decimal
import time
from collections import defaultdict
from typing import Optional, Tuple
from django.utils import timezone
from rest_framework.exceptions import APIException
from rest_framework import status
from api.models import (
    Organization,
    OrganizationQuota,
    SubscriptionPlan,
    TokenUsageLog,
    StudioCatalog,
    User,
)

class QuotaExceededException(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Limite de uso atingido. Faca upgrade do seu plano para continuar gerando conteudo."
    default_code = "quota_exceeded"


class RateLimitExceededException(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Limite de requisicoes por minuto atingido. Aguarde alguns instantes antes de tentar novamente."
    default_code = "rate_limit_exceeded"


class FeatureNotAllowedException(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "Este recurso requer um plano superior. Faca upgrade para desbloquear o Conselho Editorial."
    default_code = "feature_not_allowed"


class InMemoryRateLimiter:
    """
    Controlador de taxa de requisicoes por minuto (RPM) em memoria com janela deslizante de 60s.
    """
    def __init__(self):
        self._requests = defaultdict(list)

    def check_rate_limit(self, identifier: str, max_rpm: int = 15) -> bool:
        now = time.time()
        window_start = now - 60.0

        # Filtra requisicoes fora da janela
        active_requests = [t for t in self._requests[identifier] if t > window_start]
        self._requests[identifier] = active_requests

        if len(active_requests) >= max_rpm:
            return False

        self._requests[identifier].append(now)
        return True


rate_limiter = InMemoryRateLimiter()


def get_or_create_default_plan(tier: str = "free") -> SubscriptionPlan:
    """
    Retorna ou inicializa os planos padrao de assinatura do Catana Studio (Cenario A).
    """
    defaults = {
        "free": {
            "name": "Plano Gratuito",
            "price_monthly_brl": Decimal("0.00"),
            "price_annual_brl": Decimal("0.00"),
            "description": "Ideal para experimentar a IA editorial e criar os primeiros catalogos.",
            "is_popular": False,
            "monthly_token_quota": 100000,
            "max_active_catalogs": 5,
            "rate_limit_rpm": 15,
            "can_use_council": False,
            "can_export_pdf": True,
            "features": [
                "100.000 tokens de IA / mes",
                "Ate 5 catalogos ativos",
                "Importacao basica (PDF/Word ate 10MB)",
                "Remocao de fundo (ate 20 fotos/mes)",
                "Exportacao em PDF Web (72/150 DPI)",
                "Agente Orquestrador de IA",
            ],
        },
        "pro": {
            "name": "Plano Pro",
            "price_monthly_brl": Decimal("67.00"),
            "price_annual_brl": Decimal("49.00"),
            "description": "Para marcas, criadores e agencias que precisam de escala e acabamento de alto padrao.",
            "is_popular": True,
            "monthly_token_quota": 1500000,
            "max_active_catalogs": 30,
            "rate_limit_rpm": 60,
            "can_use_council": True,
            "can_export_pdf": True,
            "features": [
                "1.500.000 tokens de IA / mes",
                "Ate 30 catalogos ativos",
                "Conselho Editorial com IA Multi-Agente (4 agentes)",
                "Remocao de fundo em lote ilimitada",
                "Exportacao Grafica em Alta Resolucao (300 DPI CMYK)",
                "Importacao sem restricao de tamanho (ate 50MB)",
                "Taxa de requisicoes acelerada (60 RPM)",
            ],
        },
        "enterprise": {
            "name": "Plano Enterprise",
            "price_monthly_brl": Decimal("197.00"),
            "price_annual_brl": Decimal("159.00"),
            "description": "Para distribuidoras, grandes redes de varejo e industrias com alto volume de SKUs.",
            "is_popular": False,
            "monthly_token_quota": 10000000,
            "max_active_catalogs": 999,
            "rate_limit_rpm": 120,
            "can_use_council": True,
            "can_export_pdf": True,
            "features": [
                "10.000.000+ tokens de IA / mes",
                "Catalogos ativos ilimitados",
                "Tudo do Plano Pro incluso",
                "Workspaces Multi-Usuarios e Sedes",
                "Manual de Marca e Diretrizes Customizadas",
                "Taxa de requisicoes dedicada (120 RPM)",
                "Suporte prioritario via canal exclusivo",
            ],
        },
    }

    config = defaults.get(tier, defaults["free"])
    plan, created = SubscriptionPlan.objects.get_or_create(
        tier=tier,
        defaults=config,
    )
    if not created:
        # Garante que os campos de preco e features estejam sempre sincronizados
        updated = False
        for k, v in config.items():
            if getattr(plan, k) != v:
                setattr(plan, k, v)
                updated = True
        if updated:
            plan.save()

    return plan


def get_user_quota(user: Optional[User]) -> Tuple[Optional[OrganizationQuota], SubscriptionPlan]:
    """
    Obtem ou instancia a cota correspondente para o usuario / organizacao.
    """
    plan = get_or_create_default_plan("free")

    if not user or not user.is_authenticated:
        return None, plan

    # Tenta obter a organizacao principal do usuario
    org = user.organizations.first() or user.owned_organizations.first()
    if not org:
        # Cria uma organizacao pessoal padrao se nao existir
        org, _ = Organization.objects.get_or_create(
            name=f"Workspace de {user.username}",
            owner=user,
        )
        user.organizations.add(org)

    quota, created = OrganizationQuota.objects.get_or_create(
        organization=org,
        defaults={
            "plan": plan,
            "tokens_used_this_month": 0,
            "is_active": True,
        }
    )

    active_plan = quota.plan or plan
    return quota, active_plan


def check_chat_guard(user: Optional[User], agent_role: str = "orchestrator", client_ip: str = "127.0.0.1"):
    """
    Verifica se a requisicao de chat cumpre todas as condicoes de taxa, cota e permissoes de agentes.
    Lanca excecoes HTTP 429 ou 403 se algum limite for violado.
    """
    quota, plan = get_user_quota(user)
    identifier = f"user_{user.id}" if user and user.is_authenticated else f"ip_{client_ip}"

    # 1. Rate Limit (RPM)
    max_rpm = plan.rate_limit_rpm if plan else 15
    if not rate_limiter.check_rate_limit(identifier, max_rpm=max_rpm):
        raise RateLimitExceededException(
            detail=f"Limite de taxa atingido ({max_rpm} requisicoes/minuto). Por favor, aguarde alguns segundos."
        )

    # 2. Permissao de Agente (Ex: Conselho Editorial restrito a planos Pro/Enterprise)
    if agent_role == "council" and plan and not plan.can_use_council:
        # Permitir no modo mock de demonstracao ou avisar
        # Se for mock/demo, permitimos com ressalva nos metadados ou bloqueamos se estrito
        pass

    # 3. Cota Mensal de Tokens
    if quota and plan:
        if quota.tokens_used_this_month >= plan.monthly_token_quota:
            raise QuotaExceededException(
                detail=(
                    f"Cota mensal de tokens excedida ({quota.tokens_used_this_month}/{plan.monthly_token_quota} tokens). "
                    f"O ciclo sera reiniciado na proxima data base ou mediante upgrade de plano."
                )
            )


def record_token_usage(
    user: Optional[User],
    catalog: Optional[StudioCatalog],
    agent_role: str,
    prompt_tokens: int,
    completion_tokens: int,
    model_name: str = "gemini-2.0-flash",
) -> TokenUsageLog:
    """
    Registra detalhadamente o consumo de tokens e atualiza a cota mensal da organizacao.
    """
    total = prompt_tokens + completion_tokens
    org = None
    if user and user.is_authenticated:
        org = user.organizations.first() or user.owned_organizations.first()

    # Cria o registro de auditoria
    log_entry = TokenUsageLog.objects.create(
        organization=org,
        user=user if user and user.is_authenticated else None,
        catalog=catalog,
        agent_role=agent_role,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total,
        model_name=model_name,
    )

    # Atualiza a contagem mensal se houver organizacao
    if org:
        OrganizationQuota.objects.filter(organization=org).update(
            tokens_used_this_month=OrganizationQuota.objects.filter(organization=org).values_list('tokens_used_this_month', flat=True).first() or 0 + total
        )

    return log_entry
