from decimal import Decimal
import time
from collections import defaultdict
from typing import Optional, Tuple
from django.utils import timezone
from django.db.models import F, Q
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

    def __init__(self, detail=None, code=None, tokens_used=0, token_quota=100000):
        if detail is None:
            detail = {
                "code": "quota_exceeded",
                "error": "Limite mensal de tokens atingido. Faca upgrade para continuar utilizando os agentes de IA.",
                "tokens_used": tokens_used,
                "token_quota": token_quota,
            }
        super().__init__(detail=detail, code=code or "quota_exceeded")


class RateLimitExceededException(APIException):
    status_code = status.HTTP_429_TOO_MANY_REQUESTS
    default_detail = "Limite de requisicoes por minuto atingido. Aguarde alguns instantes antes de tentar novamente."
    default_code = "rate_limit_exceeded"


class CatalogLimitExceededException(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = {
        "code": "catalog_limit_exceeded",
        "error": "Voce atingiu o limite de catalogos ativos do seu plano. Arquive um catalogo existente ou faca upgrade.",
    }
    default_code = "catalog_limit_exceeded"

    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)
        if isinstance(detail, dict):
            # DRF coerces exception leaves to strings; retain quota counters as numbers.
            self.detail.update({key: value for key, value in detail.items() if type(value) in (int, float) or value is None})


class CouncilFeatureLockedException(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = {
        "code": "feature_locked_pro",
        "error": "O Conselho Editorial Multi-Agente e exclusivo para assinantes dos planos Pro e Enterprise.",
    }
    default_code = "feature_locked_pro"


class ExportDpiRestrictedException(APIException):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = {
        "code": "export_dpi_restricted",
        "error": "A exportacao grafica em alta resolucao (300 DPI CMYK) requer o Plano Pro ou Enterprise.",
    }
    default_code = "export_dpi_restricted"


class InMemoryRateLimiter:
    """
    Controlador de taxa de requisicoes por minuto (RPM) em memoria com janela deslizante de 60s.
    """
    def __init__(self):
        self._requests = defaultdict(list)

    def check_rate_limit(self, identifier: str, max_rpm: int = 15) -> bool:
        now = time.time()
        window_start = now - 60.0

        active_requests = [t for t in self._requests[identifier] if t > window_start]
        self._requests[identifier] = active_requests

        if len(active_requests) >= max_rpm:
            return False

        self._requests[identifier].append(now)
        return True


rate_limiter = InMemoryRateLimiter()


def get_or_create_default_plan(tier: str = "free") -> SubscriptionPlan:
    """
    Retorna ou inicializa os planos padrao de assinatura do Catana Studio.
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
        updated = False
        for k, v in config.items():
            if getattr(plan, k) != v:
                setattr(plan, k, v)
                updated = True
        if updated:
            plan.save()

    return plan


def get_user_quota(user: Optional[User], organization=None) -> Tuple[Optional[OrganizationQuota], SubscriptionPlan]:
    """
    Obtem ou instancia a cota correspondente para o usuario / organizacao.
    """
    plan = get_or_create_default_plan("free")

    if not user or not user.is_authenticated:
        return None, plan

    org = organization or user.organizations.first() or user.owned_organizations.first()
    if organization is not None:
        from api.services.brand_intelligence import assert_organization_access
        assert_organization_access(user, organization)
    if not org:
        org, _ = Organization.objects.get_or_create(
            name=f"Workspace de {user.username}",
            owner=user,
        )
        user.organizations.add(org)

    quota, _ = OrganizationQuota.objects.get_or_create(
        organization=org,
        defaults={
            "plan": plan,
            "tokens_used_this_month": 0,
            "is_active": True,
        }
    )

    # Se a assinatura possuia cancelamento agendado e o periodo terminou, rebaixa cota para o plano gratuito
    sub = getattr(org, 'subscription', None)
    if (
        sub
        and sub.cancel_at_period_end
        and sub.current_period_end
        and sub.current_period_end <= timezone.now()
    ):
        sub.plan = plan
        sub.status = "canceled"
        sub.cancel_at_period_end = False
        sub.save()
        quota.plan = plan
        quota.save()

    active_plan = quota.plan or plan
    return quota, active_plan


def check_chat_guard(user: Optional[User], agent_role: str = "orchestrator", client_ip: str = "127.0.0.1"):
    """
    Verifica se a requisicao de chat cumpre taxa (RPM), cota de tokens e permissoes de agentes.
    """
    quota, plan = get_user_quota(user)
    identifier = f"user_{user.id}" if user and user.is_authenticated else f"ip_{client_ip}"

    # 1. Rate Limit (RPM)
    max_rpm = plan.rate_limit_rpm if plan else 15
    if not rate_limiter.check_rate_limit(identifier, max_rpm=max_rpm):
        raise RateLimitExceededException(
            detail=f"Limite de taxa atingido ({max_rpm} requisicoes/minuto). Aguarde alguns segundos."
        )

    # 2. Permissao de Agente (Conselho Editorial restrito a Pro / Enterprise)
    if agent_role == "council":
        check_council_guard(user)

    # 3. Cota Mensal de Tokens
    if quota and plan:
        if quota.tokens_used_this_month >= plan.monthly_token_quota:
            raise QuotaExceededException(
                tokens_used=quota.tokens_used_this_month,
                token_quota=plan.monthly_token_quota,
            )


def catalog_slot_status(user, organization=None):
    """Organization catalogs and legacy personal catalogs have separate scopes."""
    quota, plan = get_user_quota(user, organization)
    if organization is not None:
        catalogs = StudioCatalog.objects.filter(organization=organization, status='active')
    else:
        catalogs = StudioCatalog.objects.filter(organization__isnull=True, created_by=user, status='active')
    count = catalogs.count() if user and user.is_authenticated else 0
    return {'organization': organization.pk if organization else None,
            'active_catalogs': count, 'max_active_catalogs': plan.max_active_catalogs,
            'remaining_catalog_slots': max(0, plan.max_active_catalogs - count),
            'remaining': max(0, plan.max_active_catalogs - count),
            'plan_tier': plan.tier, 'plan_name': plan.name}


def check_catalog_creation_guard(user: Optional[User], organization=None):
    """Call inside the transaction that creates/restores a catalog.

    A stable owner row serializes slot consumption even when no quota row
    exists yet. PostgreSQL READ COMMITTED sees the previous creator's commit
    after acquiring this lock. Legacy personal catalogs lock their owner user.
    """
    if not user or not user.is_authenticated:
        return
    from django.db import connection
    if not connection.in_atomic_block:
        raise RuntimeError('Catalog slot consumption requires transaction.atomic')
    if organization is not None:
        from api.services.brand_intelligence import assert_organization_access
        assert_organization_access(user, organization, write=True)
        Organization.objects.select_for_update().get(pk=organization.pk)
    else:
        User.objects.select_for_update().get(pk=user.pk)
    data = catalog_slot_status(user, organization)
    if data['remaining_catalog_slots'] == 0:
        raise CatalogLimitExceededException(detail={**data, 'code': 'catalog_limit_exceeded',
            'error': f"Você está usando {data['active_catalogs']} de {data['max_active_catalogs']} catálogos ativos. Arquive um catálogo ou altere seu plano para criar outro."})


def check_council_guard(user: Optional[User]):
    """
    Verifica se o usuario possui permissao para utilizar o Conselho Editorial (Pro ou Enterprise).
    """
    if not user or not user.is_authenticated:
        raise CouncilFeatureLockedException()

    _, plan = get_user_quota(user)
    if not plan or not plan.can_use_council:
        raise CouncilFeatureLockedException()


def check_export_guard(user: Optional[User], dpi: int = 72):
    """
    Verifica se a resolucao solicitada (ex: 300 DPI CMYK) esta liberada para o plano do usuario.
    """
    if dpi > 150:
        if not user or not user.is_authenticated:
            raise ExportDpiRestrictedException()

        _, plan = get_user_quota(user)
        if not plan or plan.tier == "free":
            raise ExportDpiRestrictedException()


def record_token_usage(
    user: Optional[User],
    catalog: Optional[StudioCatalog],
    agent_role: str,
    prompt_tokens: int,
    completion_tokens: int,
    model_name: str = "gemini-2.0-flash",
) -> TokenUsageLog:
    """
    Registra detalhadamente o consumo de tokens e atualiza atomicamente a cota mensal.
    """
    total = prompt_tokens + completion_tokens
    org = None
    if user and user.is_authenticated:
        org = user.organizations.first() or user.owned_organizations.first()

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

    if org:
        OrganizationQuota.objects.filter(organization=org).update(
            tokens_used_this_month=F('tokens_used_this_month') + total
        )

    return log_entry
