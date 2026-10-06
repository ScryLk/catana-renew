import os
import io
import csv
import json
import logging
import re
import time
import base64
import copy
import socket
import ipaddress
import urllib.parse
import urllib.request
from decimal import Decimal
from typing import Generator, Optional, Dict, Any, List
from django.conf import settings
from api.services.image_validator import validate_image_file, validate_image_bytes
from django.http import StreamingHttpResponse, JsonResponse, FileResponse
from django.db.models import Q
from django.db import transaction, OperationalError
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError, NotAuthenticated
from drf_spectacular.utils import extend_schema

from api.models import (
    StudioCatalog,
    DocumentImport, DocumentImportAsset,
    CatalogSpread,
    ChatThread,
    ChatMessage,
    SubscriptionPlan,
    OrganizationQuota,
    CatalogTemplate,
    Product,
    Organization,
)
from api.ai.agents.registry import get_agent, list_agents
from api.guards.quota_guard import (
    check_chat_guard,
    check_catalog_creation_guard,
    check_council_guard,
    check_export_guard,
    record_token_usage,
    get_user_quota,
    QuotaExceededException,
    RateLimitExceededException,
    CatalogLimitExceededException,
    CouncilFeatureLockedException,
    ExportDpiRestrictedException,
)
from api.services.file_processor import FileAttachmentProcessor
from api.services.template_rag import TemplateRAGService, generate_embedding
from api.services.background_removal import BackgroundRemovalService
from api.services.document_reconstructor import DocumentReconstructorService

logger = logging.getLogger(__name__)


def _studio_catalogs_for(user):
    """Keep legacy personal drafts while requiring current tenant access for Brand data."""
    from api.services.brand_intelligence import visible_organizations
    organizations = visible_organizations(user)
    return StudioCatalog.objects.filter(
        Q(brand__isnull=True, import_metadata={}) & (Q(created_by=user) | Q(organization__in=organizations))
        | Q(brand__isnull=True, organization__in=organizations) & ~Q(import_metadata={})
        | Q(brand__isnull=False, organization__in=organizations,
            brand__organization__in=organizations)
    )


def _brand_catalog_metadata(catalog):
    # Only private Studio responses use this helper. Public readers keep an allowlist.
    return {
        'organization': catalog.organization_id,
        'brand': str(catalog.brand_id) if catalog.brand_id else None,
        'brand_version': catalog.brand_version,
        'brand_snapshot': catalog.brand_snapshot,
        'brand_snapshot_hash': catalog.brand_snapshot_hash,
        'qualityGate': (catalog.generation_metadata or {}).get('qualityGate'),
        'import_metadata': catalog.import_metadata,
    }


def _assert_brand_catalog_write(user, catalog):
    if catalog.brand_id or catalog.import_metadata:
        from api.services.brand_intelligence import assert_organization_access
        assert_organization_access(user, catalog.organization, write=True)


def _invalidate_generation_approval(catalog, reason):
    """An approval certifies generated content, not later customer edits."""
    if catalog.import_metadata:
        previous_import = catalog.import_metadata.get('quality') or {}
        catalog.import_metadata = {
            **catalog.import_metadata, 'share_enabled': False,
            'quality': {**previous_import, 'passed': False, 'status': 'needs_review',
                        'errors': list(dict.fromkeys([*previous_import.get('errors', []), reason]))},
        }
    if not catalog.generation_metadata:
        return
    previous = catalog.generation_metadata.get('qualityGate') or {}
    catalog.generation_metadata = {
        **catalog.generation_metadata,
        'generationStatus': 'needs_review',
        'qualityGate': {
            **previous, 'status': 'needs_review', 'passed': False, 'publishable': False,
            'errors': list(dict.fromkeys([*previous.get('errors', []), reason])),
        },
    }


def _studio_threads_for(user):
    return ChatThread.objects.filter(
        Q(catalog__in=_studio_catalogs_for(user)) | Q(catalog__isnull=True, user=user)
    ).distinct()


def _requested_brand(user, data):
    from api.services.brand_intelligence import get_brand_for_user, assert_organization_access
    brand_id = data.get('brand_id', data.get('brand'))
    if not brand_id:
        return None
    brand = get_brand_for_user(user, brand_id, organization_id=data.get('organization'))
    assert_organization_access(user, brand.organization, write=True)
    return brand


def _requested_organization(user, data, brand=None, write=True):
    from api.services.brand_intelligence import visible_organizations, assert_organization_access
    organization_id = data.get('organization')
    if brand is not None:
        return brand.organization
    if organization_id is not None:
        try:
            organization = visible_organizations(user).filter(pk=organization_id).first()
        except (TypeError, ValueError):
            organization = None
        if organization is None:
            raise NotFound('Organização não encontrada.')
        assert_organization_access(user, organization, write=write)
        return organization
    organization = user.organizations.first() or user.owned_organizations.first()
    if organization:
        assert_organization_access(user, organization, write=write)
    return organization

class StudioAgentsListView(APIView):
    """
    Lista todos os agentes de IA disponiveis no Catana Studio.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        agents = list_agents()
        return Response({"agents": agents})


class StudioQuotaStatusView(APIView):
    """
    Consulta o plano atual, consumo de tokens e limites de taxa.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user = request.user if request.user and request.user.is_authenticated else None
        organization = _requested_organization(user, request.query_params, write=False) if user else None
        quota, plan = get_user_quota(user, organization) if user else (None, None)
        from api.guards.quota_guard import catalog_slot_status
        slots = catalog_slot_status(user, organization) if user else {}
        if not plan:
            from api.guards.quota_guard import get_or_create_default_plan
            plan = get_or_create_default_plan("free")

        tokens_used = quota.tokens_used_this_month if quota else 0
        monthly_quota = plan.monthly_token_quota if plan else 100000

        return Response({
            **slots,
            "tier": plan.tier if plan else "free",
            "plan_name": plan.name if plan else "Plano Gratuito",
            "tokens_used_this_month": tokens_used,
            "monthly_token_quota": monthly_quota,
            "tokens_remaining": max(0, monthly_quota - tokens_used),
            "percentage_used": round((tokens_used / max(1, monthly_quota)) * 100, 2),
            "max_active_catalogs": plan.max_active_catalogs if plan else 5,
            "rate_limit_rpm": plan.rate_limit_rpm if plan else 15,
            "can_use_council": plan.can_use_council if plan else False,
            "can_export_pdf": plan.can_export_pdf if plan else True,
        })


class StudioCatalogListView(APIView):
    """
    Lista e cria novos catalogos do Studio isolados por usuario e organizacao.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        catalogs = _studio_catalogs_for(user).order_by("-updated_at")
        organization_id = request.query_params.get('organization')
        if organization_id is not None:
            try:
                catalogs = catalogs.filter(organization_id=int(organization_id))
            except (ValueError, TypeError):
                raise ValidationError({'organization': 'Organização inválida.'})
        lifecycle = request.query_params.get('status', 'active')
        if lifecycle not in ('active', 'archived', 'all'):
            raise ValidationError({'status': 'Escolha active, archived ou all.'})
        if lifecycle != 'all':
            catalogs = catalogs.filter(status=lifecycle)
        results = []
        for cat in catalogs:
            spread_count = cat.spreads.count()
            results.append({
                **_brand_catalog_metadata(cat),
                "id": cat.id,
                "title": cat.title,
                "description": cat.description or "",
                "brand_name": cat.brand_name or "",
                "style_preset": cat.style_preset,
                "primary_color": cat.primary_color,
                "secondary_color": cat.secondary_color,
                "accent_color": cat.accent_color,
                "font_family": cat.font_family,
                "total_pages": cat.total_pages,
                "brand_lock": cat.brand_lock,
                "palette_data": cat.palette_data,
                "spread_count": spread_count,
                "status": cat.status,
                "created_at": cat.created_at.isoformat(),
                "updated_at": cat.updated_at.isoformat(),
            })
        return Response(results)

    @transaction.atomic
    def post(self, request):
        user = request.user
        data = request.data
        brand = _requested_brand(user, data)
        org = _requested_organization(user, data, brand)
        check_catalog_creation_guard(user, org)
        title = data.get("title", "Novo Catalogo Studio")
        brand_name = data.get("brand_name", "")
        style_preset = data.get("style_preset", "editorial_clean")
        primary_color = data.get("primary_color", "#111827")
        secondary_color = data.get("secondary_color", "#6366f1")
        accent_color = data.get("accent_color", "#f59e0b")
        font_family = data.get("font_family", "Inter")
        try:
            total_pages = int(data.get("total_pages", 6))
            if total_pages <= 0:
                total_pages = 6
        except (ValueError, TypeError):
            total_pages = 6
        brand_lock = bool(data.get("brand_lock", False))
        palette_data = data.get("palette_data", {})
        unassigned_products = data.get("unassigned_products", [])

        catalog = StudioCatalog.objects.create(
            title=title,
            brand_name=brand.name if brand else brand_name,
            style_preset=style_preset,
            primary_color=primary_color,
            secondary_color=secondary_color,
            accent_color=accent_color,
            font_family=font_family,
            total_pages=total_pages,
            brand_lock=brand_lock,
            palette_data=palette_data,
            unassigned_products=unassigned_products,
            organization=org,
            created_by=user,
        )
        if brand is not None:
            from api.services.brand_intelligence import bind_catalog_brand
            bind_catalog_brand(catalog, brand, user)
            catalog.save(update_fields=['brand', 'brand_version', 'brand_snapshot', 'brand_snapshot_hash'])

        # Cria automaticamente o primeiro spread A4 vazio
        CatalogSpread.objects.create(
            catalog=catalog,
            spread_index=0,
            title="Capa e Apresentacao",
            left_page_elements=[],
            right_page_elements=[],
        )

        # Cria thread de chat inicial
        thread = ChatThread.objects.create(
            catalog=catalog,
            user=user,
            title=f"Chat: {title}",
            active_agent="orchestrator",
        )

        return Response({
            **_brand_catalog_metadata(catalog),
            "id": catalog.id,
            "title": catalog.title,
            "brand_name": catalog.brand_name,
            "style_preset": catalog.style_preset,
            "total_pages": catalog.total_pages,
            "brand_lock": catalog.brand_lock,
            "palette_data": catalog.palette_data,
            "unassigned_products": catalog.unassigned_products,
            "thread_id": thread.id,
            "spread_count": 1,
            "created_at": catalog.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)


class StudioCatalogDetailView(APIView):
    """
    Recupera, atualiza ou exclui um catalogo do Studio com seus spreads.
    """
    permission_classes = [IsAuthenticated]

    def get_catalog(self, user, pk):
        return _studio_catalogs_for(user).filter(pk=pk).first()

    def get(self, request, pk):
        catalog = self.get_catalog(request.user, pk)
        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)

        spreads = []
        for s in catalog.spreads.all().order_by("spread_index"):
            left = s.left_page_elements[0] if (isinstance(s.left_page_elements, list) and len(s.left_page_elements) > 0) else (s.left_page_elements or {})
            right = s.right_page_elements[0] if (isinstance(s.right_page_elements, list) and len(s.right_page_elements) > 0) else (s.right_page_elements or {})
            spreads.append({
                "id": s.id,
                "spread_index": s.spread_index,
                "title": s.title or f"Pagina Dupla {s.spread_index + 1}",
                "left_page": left,
                "right_page": right,
                "left_page_elements": s.left_page_elements,
                "right_page_elements": s.right_page_elements,
            })

        latest_thread = catalog.threads.first()
        thread_id = latest_thread.id if latest_thread else None

        threads_data = []
        for t in catalog.threads.all().order_by("-updated_at")[:10]:
            msg_list = []
            for m in t.messages.all().order_by("created_at"):
                msg_list.append({
                    "id": f"msg-{m.id}",
                    "role": "user" if m.sender_type == "user" else "assistant",
                    "content": m.content,
                    "agentRole": m.agent_role,
                    "timestamp": m.created_at.strftime("%H:%M"),
                    "metadata": m.metadata,
                })
            threads_data.append({
                "id": f"thread-{t.id}",
                "title": t.title,
                "mode": t.active_agent,
                "roleId": t.active_agent,
                "createdAt": t.created_at.isoformat(),
                "messages": msg_list,
            })

        return Response({
            **_brand_catalog_metadata(catalog),
            "id": catalog.id,
            "title": catalog.title,
            "description": catalog.description or "",
            "brand_name": catalog.brand_name or "",
            "style_preset": catalog.style_preset,
            "primary_color": catalog.primary_color,
            "secondary_color": catalog.secondary_color,
            "accent_color": catalog.accent_color,
            "font_family": catalog.font_family,
            "status": catalog.status,
            "page_width": catalog.page_width,
            "page_height": catalog.page_height,
            "total_pages": catalog.total_pages,
            "brand_lock": catalog.brand_lock,
            "palette_data": catalog.palette_data,
            "unassigned_products": catalog.unassigned_products or [],
            "thread_id": thread_id,
            "threads": threads_data,
            "spreads": spreads,
            "created_at": catalog.created_at.isoformat(),
            "updated_at": catalog.updated_at.isoformat(),
        })

    @transaction.atomic
    def put(self, request, pk):
        catalog = _studio_catalogs_for(request.user).select_for_update(of=('self',)).filter(pk=pk).first()
        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)
        _assert_brand_catalog_write(request.user, catalog)

        data = request.data
        if 'status' in data:
            lifecycle = data['status']
            if lifecycle not in ('active', 'archived'):
                raise ValidationError({'status': 'Escolha active ou archived.'})
            if catalog.organization_id:
                from api.services.brand_intelligence import assert_organization_access
                assert_organization_access(request.user, catalog.organization, write=True)
            if lifecycle != catalog.status:
                if lifecycle == 'active':
                    check_catalog_creation_guard(request.user, catalog.organization)
                catalog.status = lifecycle
                catalog.archived_at = timezone.now() if lifecycle == 'archived' else None
        if 'import_metadata' in data:
            raise ValidationError({'import_metadata': 'O histórico da importação é controlado pelo servidor.'})
        if 'share_import' in data:
            if not catalog.import_metadata or type(data['share_import']) is not bool:
                raise ValidationError({'share_import': 'Informe uma decisão explícita para um catálogo importado.'})
            if data['share_import']:
                from api.services.document_reconstructor import import_quality_passed
                if not import_quality_passed(catalog.import_metadata):
                    raise ValidationError({'share_import': 'A importação precisa passar pela revisão de qualidade.'})
                DocumentReconstructorService.validate_catalog_source(catalog)
            catalog.import_metadata = {**catalog.import_metadata, 'share_enabled': data['share_import']}
        presentation_fields = ('title', 'description', 'style_preset', 'primary_color',
                               'secondary_color', 'accent_color', 'font_family',
                               'total_pages', 'palette_data')
        previous_presentation = {field: copy.deepcopy(getattr(catalog, field)) for field in presentation_fields}
        if any(field in data for field in ('brand_version', 'brand_snapshot', 'brand_snapshot_hash',
                                          'generation_metadata', 'qualityGate', 'generationStatus')):
            raise ValidationError({'brand_snapshot': 'A identidade histórica é controlada pelo servidor.'})
        if 'brand' in data or 'brand_id' in data:
            requested_id = data.get('brand_id', data.get('brand'))
            current_id = str(catalog.brand_id) if catalog.brand_id else None
            if (str(requested_id) if requested_id else None) != current_id or data.get('update_brand_identity') is True:
                if data.get('update_brand_identity') is not True:
                    raise ValidationError({'brand': 'Confirme explicitamente a atualização da identidade do catálogo.'})
                brand = _requested_brand(request.user, data)
                if brand is not None:
                    from api.services.brand_intelligence import bind_catalog_brand
                    bind_catalog_brand(catalog, brand, request.user, refresh_snapshot=True)
                    catalog.brand_name = brand.name
                else:
                    catalog.brand = None
                    catalog.brand_version = None
                    catalog.brand_snapshot = {}
                    catalog.brand_snapshot_hash = ''
                _invalidate_generation_approval(catalog, 'BRAND_IDENTITY_UPDATED')
        if "title" in data:
            catalog.title = data["title"]
        if "description" in data:
            catalog.description = data["description"]
        if "brand_name" in data and not catalog.brand_id:
            catalog.brand_name = data["brand_name"]
        if "style_preset" in data:
            catalog.style_preset = data["style_preset"]
        if "primary_color" in data:
            catalog.primary_color = data["primary_color"]
        if "secondary_color" in data:
            catalog.secondary_color = data["secondary_color"]
        if "accent_color" in data:
            catalog.accent_color = data["accent_color"]
        if "font_family" in data:
            catalog.font_family = data["font_family"]
        if "total_pages" in data:
            catalog.total_pages = int(data["total_pages"])
            if catalog.import_metadata and catalog.total_pages < len(catalog.source_import.previews):
                raise ValidationError({'total_pages': 'Todas as páginas originais devem ser preservadas.'})
        if "brand_lock" in data:
            catalog.brand_lock = bool(data["brand_lock"])
        if "palette_data" in data:
            catalog.palette_data = data["palette_data"]
        if "unassigned_products" in data:
            catalog.unassigned_products = data["unassigned_products"]
        if any(previous_presentation[field] != getattr(catalog, field) for field in presentation_fields):
            _invalidate_generation_approval(catalog, 'GENERATED_CONTENT_UPDATED')
        catalog.save()

        return Response({
            **_brand_catalog_metadata(catalog),
            "status": "updated",
            "catalog_status": catalog.status,
            "id": catalog.id,
            "title": catalog.title,
            "brand_lock": catalog.brand_lock,
            "palette_data": catalog.palette_data,
            "total_pages": catalog.total_pages,
            "unassigned_products": catalog.unassigned_products,
        })

    def delete(self, request, pk):
        catalog = self.get_catalog(request.user, pk)
        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)
        _assert_brand_catalog_write(request.user, catalog)

        catalog.delete()
        return Response({"status": "deleted"}, status=status.HTTP_204_NO_CONTENT)


class StudioSpreadManageView(APIView):
    """
    Gerencia spreads individuais (salvar alteracoes de layout e paginas duplas).
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, catalog_id):
        user = request.user
        catalog = _studio_catalogs_for(user).select_for_update(of=('self',)).filter(pk=catalog_id).first()

        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)
        _assert_brand_catalog_write(user, catalog)

        data = request.data
        try:
            spread_index = int(data.get("spread_index", catalog.spreads.count()))
            if spread_index < 0:
                spread_index = 0
        except (ValueError, TypeError):
            spread_index = catalog.spreads.count()
        title = data.get("title", f"Spread {spread_index + 1}")
        
        left_page = data.get("left_page")
        right_page = data.get("right_page")
        left_elements = data.get("left_page_elements")
        right_elements = data.get("right_page_elements")

        if left_page is not None:
            left_elements = [left_page]
        elif left_elements is None:
            left_elements = []

        if right_page is not None:
            right_elements = [right_page]
        elif right_elements is None:
            right_elements = []

        DocumentReconstructorService.validate_page_update(catalog, left_elements, spread_index * 2)
        DocumentReconstructorService.validate_page_update(catalog, right_elements, spread_index * 2 + 1)

        existing = catalog.spreads.filter(spread_index=spread_index).first()
        content_changed = existing is None or existing.left_page_elements != left_elements or existing.right_page_elements != right_elements
        spread, created = CatalogSpread.objects.update_or_create(
            catalog=catalog,
            spread_index=spread_index,
            defaults={
                "title": title,
                "left_page_elements": left_elements,
                "right_page_elements": right_elements,
            }
        )
        if content_changed:
            _invalidate_generation_approval(catalog, 'GENERATED_CONTENT_UPDATED')
            catalog.save(update_fields=['generation_metadata', 'import_metadata', 'updated_at'])

        return Response({
            'qualityGate': (catalog.generation_metadata or {}).get('qualityGate'),
            'import_metadata': catalog.import_metadata,
            "id": spread.id,
            "catalog_id": catalog.id,
            "spread_index": spread.spread_index,
            "title": spread.title,
            "created": created,
        })


class StudioSpreadBulkSyncView(APIView):
    """
    Sincroniza em lote todos os spreads de um catalogo em uma transacao atomica.
    """
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request, catalog_id):
        user = request.user
        catalog = _studio_catalogs_for(user).select_for_update(of=('self',)).filter(pk=catalog_id).first()

        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)
        _assert_brand_catalog_write(user, catalog)

        spreads_data = request.data.get("spreads", [])
        if not isinstance(spreads_data, list):
            return Response({"error": "O campo spreads deve ser uma lista"}, status=status.HTTP_400_BAD_REQUEST)

        from django.db import transaction
        saved_spreads = []
        content_changed = False
        with transaction.atomic():
            for item in spreads_data:
                try:
                    spread_index = int(item.get("spread_index", 0))
                    if spread_index < 0:
                        spread_index = 0
                except (ValueError, TypeError):
                    spread_index = 0

                title = item.get("title", f"Spread {spread_index + 1}")
                left_page = item.get("left_page")
                right_page = item.get("right_page")
                left_elements = item.get("left_page_elements")
                right_elements = item.get("right_page_elements")

                if left_page is not None:
                    left_elements = [left_page]
                elif left_elements is None:
                    left_elements = []

                if right_page is not None:
                    right_elements = [right_page]
                elif right_elements is None:
                    right_elements = []

                DocumentReconstructorService.validate_page_update(catalog, left_elements, spread_index * 2)
                DocumentReconstructorService.validate_page_update(catalog, right_elements, spread_index * 2 + 1)

                existing = catalog.spreads.filter(spread_index=spread_index).first()
                content_changed = content_changed or existing is None or existing.left_page_elements != left_elements or existing.right_page_elements != right_elements
                spread, _ = CatalogSpread.objects.update_or_create(
                    catalog=catalog,
                    spread_index=spread_index,
                    defaults={
                        "title": title,
                        "left_page_elements": left_elements,
                        "right_page_elements": right_elements,
                    }
                )
                saved_spreads.append(spread.spread_index)

            total_pages = request.data.get("total_pages")
            if total_pages is not None:
                try:
                    t_pages_int = int(total_pages)
                    if catalog.import_metadata and t_pages_int < len(catalog.source_import.previews):
                        raise ValidationError({'total_pages': 'Todas as páginas originais devem ser preservadas.'})
                    if t_pages_int > 0:
                        content_changed = content_changed or catalog.total_pages != t_pages_int
                        catalog.total_pages = t_pages_int
                        catalog.save(update_fields=["total_pages", "updated_at"])
                except (ValueError, TypeError):
                    pass
            if content_changed:
                _invalidate_generation_approval(catalog, 'GENERATED_CONTENT_UPDATED')
                catalog.save(update_fields=['generation_metadata', 'import_metadata', 'updated_at'])

        return Response({
            'qualityGate': (catalog.generation_metadata or {}).get('qualityGate'),
            'import_metadata': catalog.import_metadata,
            "status": "success",
            "catalog_id": catalog.id,
            "synced_spreads": saved_spreads,
            "count": len(saved_spreads),
        })


class StudioThreadMessagesView(APIView):
    """
    Recupera o historico de mensagens de uma sessao de chat.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        user = request.user
        thread = _studio_threads_for(user).filter(pk=thread_id).first()

        if not thread:
            return Response({"error": "Sessao nao encontrada"}, status=status.HTTP_404_NOT_FOUND)

        messages = []
        for msg in thread.messages.all().order_by("created_at"):
            messages.append({
                "id": msg.id,
                "sender_type": msg.sender_type,
                "agent_role": msg.agent_role,
                "content": msg.content,
                "metadata": msg.metadata,
                "created_at": msg.created_at.isoformat(),
            })

        return Response({
            "thread_id": thread.id,
            "title": thread.title,
            "active_agent": thread.active_agent,
            "messages": messages,
        })


def extract_patch_from_text(text: str) -> Optional[Dict[str, Any]]:
    """
    Extrai bloco estruturado de JSON Patch emitido pelo modelo.
    Suporta formatacao ```json:patch ... ``` ou ```json ... ``` contendo a chave 'actions' ou 'updates'.
    """
    if not text:
        return None
    pattern = r"```(?:json:patch|json)?\s*(\{[\s\S]*?(?:\"updates\"|\"actions\")[\s\S]*?\})\s*```"
    match = re.search(pattern, text)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    return None


class StudioChatStreamView(APIView):
    """
    Endpoint SSE (Server-Sent Events) para streaming de respostas dos agentes do Studio.
    Verifica cotas, aplica rate limiting, processa anexos multimodais e registra consumo de tokens.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        client_ip = request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "127.0.0.1"))
        if "," in client_ip:
            client_ip = client_ip.split(",")[0].strip()

        # Extrai parametros do corpo (JSON ou FormData)
        message = request.data.get("message", "").strip()
        agent_role = request.data.get("agent_role", "orchestrator").strip().lower()
        catalog_id = request.data.get("catalog_id")
        thread_id = request.data.get("thread_id")

        if not message and not request.FILES:
            return Response({"error": "Mensagem ou anexo sao obrigatorios."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Quota & Rate Limit Verification
        try:
            check_chat_guard(user=user, agent_role=agent_role, client_ip=client_ip)
        except (QuotaExceededException, RateLimitExceededException) as exc:
            detail_data = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail), "code": getattr(exc, "default_code", "limit_exceeded")}
            return Response(detail_data, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except CouncilFeatureLockedException as exc:
            detail_data = exc.detail if isinstance(exc.detail, dict) else {"error": str(exc.detail), "code": "feature_locked_pro"}
            return Response(detail_data, status=status.HTTP_403_FORBIDDEN)

        # 2. Processamento de Anexos
        attachments_info = []
        for file_key in request.FILES:
            uploaded = request.FILES[file_key]
            processed = FileAttachmentProcessor.process_file(uploaded)
            attachments_info.append(processed)

        # 3. Contexto do Catalogo e Thread (com isolamento estrito de proprietario)
        catalog = None
        if catalog_id:
            catalog = _studio_catalogs_for(user).filter(pk=catalog_id).first()
            if not catalog:
                return Response(
                    {"error": "Catalogo nao encontrado ou sem permissao de acesso"},
                    status=status.HTTP_404_NOT_FOUND
                )

        thread = None
        if thread_id:
            thread = _studio_threads_for(user).filter(pk=thread_id).first()
            if not thread:
                return Response(
                    {"error": "Sessao de chat nao encontrada ou sem permissao de acesso"},
                    status=status.HTTP_404_NOT_FOUND
                )
            if catalog_id and thread.catalog_id != catalog.id:
                raise ValidationError({'thread_id': 'A sessão deve pertencer ao catálogo informado.'})
            catalog = thread.catalog

        if catalog:
            _assert_brand_catalog_write(user, catalog)

        if not thread:
            thread = ChatThread.objects.create(
                catalog=catalog,
                user=user,
                title=f"Chat: {message[:30]}..." if message else "Nova Sessao",
                active_agent=agent_role,
            )

        # 4. Salva a mensagem do usuario no banco
        user_message_obj = ChatMessage.objects.create(
            thread=thread,
            sender_type="user",
            content=message,
            metadata={"attachments": attachments_info},
        )

        # 5. Historico recente para contexto da IA
        history = []
        for past_msg in thread.messages.exclude(id=user_message_obj.id).order_by("-created_at")[:8]:
            history.insert(0, {
                "role": "user" if past_msg.sender_type == "user" else "model",
                "content": past_msg.content,
            })

        # Contexto estendido do Canvas e Spread
        active_spread_data = request.data.get("active_spread_data")
        if isinstance(active_spread_data, str):
            try:
                active_spread_data = json.loads(active_spread_data)
            except Exception:
                pass

        catalog_skeleton = request.data.get("catalog_skeleton")
        if isinstance(catalog_skeleton, str):
            try:
                catalog_skeleton = json.loads(catalog_skeleton)
            except Exception:
                pass

        selected_element_id = request.data.get("selected_element_id")
        try:
            spread_index = int(request.data.get("spread_index", 0))
        except (ValueError, TypeError):
            spread_index = 0

        # 6. Prepara o agente especializado
        agent = get_agent(agent_role)
        catalog_context = {
            "catalog_id": catalog.id if catalog else None,
            "title": catalog.title if catalog else "",
            "brand_name": catalog.brand_name if catalog else "",
            "style_preset": catalog.style_preset if catalog else "",
            "primary_color": catalog.primary_color if catalog else "",
            "spread_index": spread_index,
            "active_spread_data": active_spread_data,
            "catalog_skeleton": catalog_skeleton,
            "selected_element_id": selected_element_id,
        }
        if catalog and catalog.brand_id:
            # Chat uses the catalog's historical identity, never today's Brand state.
            catalog_context['brand_context'] = copy.deepcopy(catalog.brand_snapshot)

        # 7. Gerador de Eventos SSE
        def sse_event_stream() -> Generator[str, None, None]:
            # Evento inicial de conexao
            init_payload = {
                "event": "start",
                "agent_role": agent.role,
                "agent_name": agent.name,
                "thread_id": thread.id,
                "catalog_id": catalog.id if catalog else None,
            }
            yield f"data: {json.dumps(init_payload)}\n\n"

            accumulated_text = []
            final_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}
            metadata = {}

            try:
                # Gateway do Orquestrador (Editor-Chefe): Inspecao e Normalizacao de Prompt
                from api.ai.agents.orchestrator import OrchestratorAgent
                orchestrator_agent = get_agent("orchestrator")
                clean_message = message
                if isinstance(orchestrator_agent, OrchestratorAgent):
                    gw_res = orchestrator_agent.format_and_guard_request(message, target_role=agent.role)
                    if not gw_res.get("is_safe") or gw_res.get("status") == "BLOCKED":
                        refusal = gw_res.get("refusal_response") or "Solicitacao bloqueada pelo Katana Guard."
                        yield f"data: {json.dumps({'event': 'token', 'text': refusal})}\n\n"
                        yield f"data: {json.dumps({'event': 'done', 'usage': final_usage, 'metadata': {'guardrail': 'BLOCKED'}})}\n\n"
                        return
                    clean_message = gw_res.get("formatted_prompt", message)

                stream_generator = agent.process_stream(
                    user_message=clean_message,
                    catalog_context=catalog_context,
                    attachments=attachments_info,
                    history=history,
                )

                for chunk in stream_generator:
                    if chunk.text:
                        accumulated_text.append(chunk.text)
                        token_payload = {
                            "event": "token",
                            "text": chunk.text,
                        }
                        yield f"data: {json.dumps(token_payload)}\n\n"

                    if chunk.done:
                        final_usage = chunk.usage
                        metadata = chunk.metadata

                full_content = "".join(accumulated_text)

                # Extrai bloco de patch estruturado para aplicacao no canvas
                patch_data = extract_patch_from_text(full_content)
                if patch_data:
                    yield f"data: {json.dumps({'event': 'patch', 'patch': patch_data})}\n\n"

                # Registra auditoria e consumo de tokens
                prompt_tok = final_usage.get("prompt_tokens", 0)
                comp_tok = final_usage.get("completion_tokens", 0)
                record_token_usage(
                    user=user,
                    catalog=catalog,
                    agent_role=agent.role,
                    prompt_tokens=prompt_tok,
                    completion_tokens=comp_tok,
                    model_name=metadata.get("model", "gemini-2.0-flash"),
                )

                # Salva mensagem do assistente no banco
                assistant_msg = ChatMessage.objects.create(
                    thread=thread,
                    sender_type="agent",
                    agent_role=agent.role,
                    content=full_content,
                    metadata={"usage": final_usage, "metadata": metadata, "patch": patch_data},
                )

                done_payload = {
                    "event": "done",
                    "message_id": assistant_msg.id,
                    "thread_id": thread.id,
                    "catalog_id": catalog.id if catalog else None,
                    "usage": final_usage,
                    "metadata": metadata,
                    "patch": patch_data,
                }
                yield f"data: {json.dumps(done_payload)}\n\n"

            except Exception as stream_err:
                logger.error(f"Erro no streaming SSE do agente {agent.role}: {stream_err}")
                error_payload = {
                    "event": "error",
                    "error": "Ocorreu um erro no processamento do agente. Tente novamente.",
                }
                yield f"data: {json.dumps(error_payload)}\n\n"

        response = StreamingHttpResponse(sse_event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response


class StudioTemplateListView(APIView):
    """
    Listagem e busca semantica de templates para o Studio
    GET /api/v2/studio/templates/?category=...&industry=...&q=...
    """
    permission_classes = [AllowAny]

    def get(self, request):
        category = request.query_params.get("category")
        industry = request.query_params.get("industry")
        style = request.query_params.get("style")
        q = request.query_params.get("q")

        user_org_id = None
        if request.user and request.user.is_authenticated:
            first_org = request.user.organizations.first()
            if first_org:
                user_org_id = first_org.id

        if q:
            templates = TemplateRAGService.search_templates(
                query=q,
                category=category,
                industry=industry,
                organization_id=user_org_id,
                limit=10,
            )
        else:
            qs = CatalogTemplate.objects.all()
            if user_org_id:
                qs = qs.filter(organization_id=user_org_id) | qs.filter(is_system=True)
            else:
                qs = qs.filter(is_system=True)

            if category:
                qs = qs.filter(category=category)
            if industry:
                qs = qs.filter(industry=industry)
            if style:
                qs = qs.filter(style_preset=style)

            templates = list(qs)

        results = [
            {
                "id": t.id,
                "title": t.title,
                "slug": t.slug,
                "category": t.category,
                "category_label": t.get_category_display(),
                "industry": t.industry,
                "style_preset": t.style_preset,
                "product_capacity": t.product_capacity,
                "description": t.description,
                "editorial_reasoning": t.editorial_reasoning,
                "blueprint_data": t.blueprint_data,
                "thumbnail_url": t.thumbnail_url,
                "is_system": t.is_system,
                "created_at": t.created_at.isoformat(),
            }
            for t in templates
        ]

        return Response({"count": len(results), "templates": results}, status=status.HTTP_200_OK)


class StudioTemplateSaveFromSpreadView(APIView):
    """
    Salva o spread atual do Studio como um novo template reutilizavel
    POST /api/v2/studio/templates/save-from-spread/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        data = request.data
        title = (data.get("title") or "").strip()
        if not title:
            return Response({"error": "O titulo do template e obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

        import uuid
        from django.utils.text import slugify
        base_slug = slugify(title) or "template"
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        category = data.get("category", "hero")
        industry = data.get("industry", "luxury_fashion")
        style_preset = data.get("style_preset", "editorial_clean")
        description = data.get("description", "")
        editorial_reasoning = data.get("editorial_reasoning", "Template personalizado criado no Catana Studio.")

        blueprint_data = data.get("blueprint_data") or {
            "left_page": data.get("left_page"),
            "right_page": data.get("right_page"),
        }

        user_org = None
        if request.user and request.user.is_authenticated:
            user_org = request.user.organizations.first()

        enrich_text = f"{title} {category} {industry} {description} {editorial_reasoning}"
        embedding_vec = generate_embedding(enrich_text)

        template = CatalogTemplate.objects.create(
            title=title,
            slug=slug,
            category=category,
            industry=industry,
            style_preset=style_preset,
            product_capacity=data.get("product_capacity", 1),
            description=description,
            editorial_reasoning=editorial_reasoning,
            blueprint_data=blueprint_data,
            embedding=embedding_vec,
            is_system=False,
            organization=user_org,
        )

        return Response(
            {
                "id": template.id,
                "title": template.title,
                "slug": template.slug,
                "message": "Template salvo com sucesso!",
            },
            status=status.HTTP_201_CREATED,
        )


class StudioCatalogImportDocumentView(APIView):
    """Private analysis precedes explicit, idempotent catalog confirmation."""
    permission_classes = [IsAuthenticated]

    def handle_exception(self, exc):
        from api.services.document_preflight import DocumentImportError, public_document_error
        if isinstance(exc, DocumentImportError):
            payload, status_code = public_document_error(exc.code)
            logger.info('document_import rejected code=%s', payload['code'])
        elif isinstance(exc, APIException):
            # Authentication, tenant/role access and normal input validation keep
            # their established DRF statuses and controlled validation guidance.
            return super().handle_exception(exc)
        else:
            # This also covers failures while building the four success DTOs.
            # Never serialize/log native parser exceptions, tracebacks or paths.
            payload, status_code = public_document_error('document_import_failed')
            logger.error('document_import internal failure')
        response = Response(payload, status=status_code)
        response.exception = True
        return response

    def get(self, request):
        job = DocumentReconstructorService.get_import(request.user, request.query_params.get('import_id'))
        return Response(DocumentReconstructorService.response(job))

    def delete(self, request):
        job = DocumentReconstructorService.get_import(request.user, request.query_params.get('import_id'), write=True, allow_expired=True)
        DocumentReconstructorService.cancel_import(job, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request):
        from api.services.document_preflight import DocumentImportError, MAX_SOURCE_BYTES
        try:
            action = request.data.get('action', 'analyze')
            if action not in ('analyze', 'prepare', 'confirm'):
                raise ValidationError({'action': 'Ação de importação inválida.'})
            if action in ('prepare', 'confirm'):
                job = DocumentReconstructorService.get_import(request.user, request.data.get('import_id'), write=True)
                organization_id = request.data.get('organization')
                if organization_id is not None and str(organization_id) != str(job.organization_id):
                    raise ValidationError({'organization': 'A prévia pertence a outra organização.'})
                explicit_brand = 'brand_id' in request.data or 'brand' in request.data
                requested_id = request.data.get('brand_id', request.data.get('brand'))
                brand = _requested_brand(request.user, {**request.data, 'organization': job.organization_id}) if requested_id else None
                if action == 'prepare':
                    with transaction.atomic():
                        job = DocumentImport.objects.select_for_update().get(pk=job.pk)
                        DocumentReconstructorService.prepare_preview(job, request.data.get('mode', job.mode),
                            brand=brand if explicit_brand else job.brand, brief=request.data.get('brief', ''))
                        job.save()
                    return Response(DocumentReconstructorService.response(job))
                job, created = DocumentReconstructorService.confirm_import(job, request.user,
                    title=request.data.get('title'), mode=request.data.get('mode'), brand=brand, brand_explicit=explicit_brand)
                return Response(DocumentReconstructorService.response(job), status=201 if created else 200)
            uploaded = request.FILES.get('file')
            if not uploaded:
                raise ValidationError({'file': 'Selecione um documento para analisar.'})
            if uploaded.size > MAX_SOURCE_BYTES:
                raise DocumentImportError('file_too_large', 'O documento excede o limite de 25 MB.', 413)
            organization_id = request.data.get('organization')
            if organization_id is None:
                raise ValidationError({'organization': 'Selecione a organização de destino.'})
            brand = _requested_brand(request.user, request.data)
            organization = _requested_organization(request.user, request.data, brand)
            job = DocumentReconstructorService.analyze_file(uploaded.read(MAX_SOURCE_BYTES + 1), uploaded.name, request.user, organization,
                content_type=uploaded.content_type or '', title=request.data.get('title'),
                mode=request.data.get('mode', 'preserve'), brand=brand, brief=request.data.get('brief', ''))
            return Response(DocumentReconstructorService.response(job), status=status.HTTP_200_OK)
        except OperationalError as error:
            # SQLite ignores row locks. Competing confirmations must remain safe
            # to retry; the transaction has rolled back before this response.
            if action in ('confirm', 'prepare') and any(message in str(error).lower()
                    for message in ('database is locked', 'database table is locked')):
                return Response({'error': 'A importação está sendo atualizada. Tente novamente.',
                                 'code': 'document_import_retry_conflict'}, status=status.HTTP_409_CONFLICT)
            raise


class StudioCatalogImportAssetView(APIView):
    """Only opted-in render assets are public; original files always require tenant access."""
    permission_classes = [AllowAny]

    def get(self, request, asset_id):
        from api.services.brand_intelligence import visible_organizations
        from api.services.document_reconstructor import RENDER_ASSET_KINDS, import_quality_passed, public_import_asset_ids
        asset = DocumentImportAsset.objects.select_related('document_import__catalog').filter(pk=asset_id).first()
        if asset is None:
            raise NotFound('Ativo de importação não encontrado.')
        job = asset.document_import
        private_access = visible_organizations(request.user).filter(pk=job.organization_id).exists()
        catalog = job.catalog
        public_access = (asset.kind in RENDER_ASSET_KINDS and job.status == 'confirmed' and catalog is not None
            and catalog.status == 'active' and catalog.import_metadata.get('share_enabled') is True and import_quality_passed(catalog.import_metadata)
            and str(asset.pk) in public_import_asset_ids(catalog))
        if not private_access and not public_access:
            raise NotFound('Ativo de importação não encontrado.')
        if job.status != 'confirmed' and job.expires_at <= timezone.now():
            raise NotFound('Esta prévia expirou.')
        try:
            response = FileResponse(asset.file.open('rb'), content_type='application/pdf' if asset.kind == 'source' else 'image/png',
                                    as_attachment=asset.kind == 'source', filename=job.filename if asset.kind == 'source' else '')
        except OSError as error:
            raise NotFound('Ativo indisponível.') from error
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response


class StudioMediaRemoveBackgroundView(APIView):
    """
    Remocao de fundo sob demanda para imagens de produtos no Canvas.
    POST /api/v2/studio/media/remove-background/
    Protegido contra SSRF e Path Traversal com fail-closed e isolamento de rede.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        uploaded_image = request.FILES.get("image")
        img_bytes = None
        filename = "image.png"

        if uploaded_image:
            is_valid, fmt, err_msg = validate_image_file(uploaded_image, max_size=10 * 1024 * 1024)
            if not is_valid:
                return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)
            img_bytes = uploaded_image.read()
            filename = uploaded_image.name or "product.png"
        elif request.data.get("image_url"):
            raw_url = str(request.data.get("image_url", "")).strip()
            if not raw_url:
                return Response({"error": "URL de imagem fornecida e vazia."}, status=status.HTTP_400_BAD_REQUEST)

            # Caso 1: Data URI (base64)
            if raw_url.startswith("data:image/"):
                try:
                    header, data_b64 = raw_url.split(",", 1)
                    img_bytes = base64.b64decode(data_b64)
                    ext = "png"
                    if "jpeg" in header or "jpg" in header:
                        ext = "jpg"
                    elif "webp" in header:
                        ext = "webp"
                    filename = f"upload_data_uri.{ext}"
                except Exception as b64_err:
                    return Response({"error": f"Falha ao decodificar imagem base64: {b64_err}"}, status=status.HTTP_400_BAD_REQUEST)

                is_valid, fmt, err_msg = validate_image_bytes(img_bytes, max_size=10 * 1024 * 1024)
                if not is_valid:
                    return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

            # Caso 2: URLs externas HTTP/HTTPS (Protecao Rigorosa contra SSRF)
            elif raw_url.startswith("http://") or raw_url.startswith("https://"):
                parsed = urllib.parse.urlparse(raw_url)
                hostname = (parsed.hostname or "").lower()

                # Bloqueio imediato de hostnames perigosos (localhost, servicos de metadados cloud, dominios locais)
                forbidden_hosts = {
                    'localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254',
                    'metadata.google.internal', 'instance-data'
                }
                if hostname in forbidden_hosts or hostname.endswith('.internal') or hostname.endswith('.local'):
                    return Response({"error": "Destino de rede invalido ou restrito (bloqueio de SSRF)."}, status=status.HTTP_400_BAD_REQUEST)

                # Resolucao de DNS e inspecao estrita de enderecos IP contra redes privadas/loopback/link-local
                try:
                    addr_info = socket.getaddrinfo(hostname, None)
                    for info in addr_info:
                        ip_str = info[4][0]
                        ip_obj = ipaddress.ip_address(ip_str)
                        if (
                            ip_obj.is_loopback
                            or ip_obj.is_private
                            or ip_obj.is_link_local
                            or ip_obj.is_reserved
                            or ip_obj.is_multicast
                        ):
                            return Response({"error": "Destino de rede invalido ou restrito (bloqueio de SSRF)."}, status=status.HTTP_400_BAD_REQUEST)
                except socket.gaierror:
                    return Response({"error": "Nao foi possivel resolver o endereco de rede da URL fornecida."}, status=status.HTTP_400_BAD_REQUEST)
                except ValueError:
                    return Response({"error": "Endereco de rede invalido."}, status=status.HTTP_400_BAD_REQUEST)

                # URLs externas arbitrarias nao autorizadas na allowlist sao sumariamente bloqueadas
                allowed_domains = getattr(settings, 'ALLOWED_EXTERNAL_IMAGE_DOMAINS', [])
                if not allowed_domains or hostname not in [d.lower() for d in allowed_domains]:
                    return Response({"error": "URLs externas nao sao permitidas. Realize o upload direto da imagem."}, status=status.HTTP_400_BAD_REQUEST)

                try:
                    req = urllib.request.Request(
                        raw_url,
                        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'}
                    )
                    with urllib.request.urlopen(req, timeout=10) as response:
                        img_bytes = response.read()
                    clean_ext_name = os.path.basename(raw_url.split("?")[0])
                    filename = clean_ext_name or "external_image.png"
                except Exception as dl_err:
                    logger.warning(f"[RemoveBackground] Falha ao baixar imagem remota '{raw_url}': {dl_err}")
                    return Response({"error": "Falha ao baixar imagem remota."}, status=status.HTTP_400_BAD_REQUEST)

                is_valid, fmt, err_msg = validate_image_bytes(img_bytes, max_size=10 * 1024 * 1024)
                if not is_valid:
                    return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)

            # Caso 3: Arquivos locais / relativos (Protecao Rigorosa contra Path Traversal)
            else:
                url_clean = raw_url
                for dev_origin in ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://127.0.0.1:3000"]:
                    if url_clean.startswith(dev_origin):
                        url_clean = url_clean[len(dev_origin):]
                        break

                media_url = getattr(settings, 'MEDIA_URL', '/media/')
                if url_clean.startswith(media_url):
                    rel_path = url_clean[len(media_url):]
                else:
                    if url_clean.startswith('/') or os.path.isabs(url_clean):
                        return Response({"error": "Caminho absoluto de arquivo nao permitido."}, status=status.HTTP_400_BAD_REQUEST)
                    rel_path = url_clean

                # Bloqueia sequencias de traversal e caminhos absolutos
                parts = rel_path.replace('\\', '/').split('/')
                if '..' in parts or any(p == '..' for p in parts):
                    return Response({"error": "Caminho de arquivo invalido (path traversal detectado)."}, status=status.HTTP_400_BAD_REQUEST)

                media_root = os.path.abspath(getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media')))
                target_abs = os.path.abspath(os.path.join(media_root, rel_path))

                # Confirma que o caminho real reside estritamente dentro de MEDIA_ROOT
                try:
                    common = os.path.commonpath([media_root, target_abs])
                    if common != media_root or target_abs == media_root:
                        return Response({"error": "Acesso a arquivo fora do diretorio permitido e proibido."}, status=status.HTTP_403_FORBIDDEN)
                except ValueError:
                    return Response({"error": "Caminho de arquivo invalido."}, status=status.HTTP_400_BAD_REQUEST)

                if not os.path.exists(target_abs) or not os.path.isfile(target_abs):
                    return Response({"error": "Arquivo de imagem local nao encontrado."}, status=status.HTTP_404_NOT_FOUND)

                with open(target_abs, "rb") as f:
                    img_bytes = f.read()
                filename = os.path.basename(target_abs)

                is_valid, fmt, err_msg = validate_image_bytes(img_bytes, max_size=10 * 1024 * 1024)
                if not is_valid:
                    return Response({"error": err_msg}, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({"error": "Envie um arquivo de imagem ou forneca image_url."}, status=status.HTTP_400_BAD_REQUEST)

        if img_bytes is None:
            return Response({"error": "Nao foi possivel carregar a imagem."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = BackgroundRemovalService.process_and_save(img_bytes, original_filename=filename)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.error(f"[RemoveBackground] Erro ao remover fundo da imagem ({filename}): {exc}")
            return Response(
                {"error": "Nao foi possivel isolar o fundo da imagem."},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY
            )


class StudioCatalogGenerateView(APIView):
    """
    Gera um catalogo editorial completo e autentico a partir do prompt via Google Gemini.
    POST /api/v2/studio/catalogs/generate/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from api.ai.catalog_builder import generate_catalog_from_gemini

        prompt = request.data.get("prompt", "")
        if not isinstance(prompt, str):
            raise ValidationError({'prompt': 'O briefing deve ser texto.'})
        prompt = prompt.strip()
        products = request.data.get("products", [])
        creative_seed = request.data.get('creativeSeed')
        if not isinstance(products, list) or not all(isinstance(product, dict) for product in products):
            return Response({'error':'products must be a list of product objects'}, status=status.HTTP_400_BAD_REQUEST)
        if creative_seed is not None and type(creative_seed) is not int:
            return Response({'error':'creativeSeed must be an integer'}, status=status.HTTP_400_BAD_REQUEST)
        if not prompt and not products:
            return Response({"error": "O campo prompt ou uma lista de produtos e obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

        if not prompt and products:
            first_cat = products[0].get("category") or "Produtos"
            prompt = f"Catálogo comercial para a linha {first_cat} com {len(products)} itens cadastrados."

        brand = None
        brand_context = None
        brand_id = request.data.get('brand_id', request.data.get('brand'))
        source_catalog_id = request.data.get('catalog_id')
        if brand_id or source_catalog_id:
            if not request.user or not request.user.is_authenticated:
                raise NotAuthenticated('Entre na sua conta para utilizar uma marca persistida.')
            from api.services.brand_intelligence import (
                BrandContextResolver, snapshot_hash, assert_organization_access,
            )
            if source_catalog_id:
                try:
                    source_catalog = _studio_catalogs_for(request.user).filter(pk=source_catalog_id).first()
                except (ValueError, TypeError):
                    raise ValidationError({'catalog_id': 'Identificador de catálogo inválido.'})
                if source_catalog is None:
                    raise NotFound('Catálogo não encontrado.')
                _assert_brand_catalog_write(request.user, source_catalog)
                if brand_id and str(source_catalog.brand_id) != str(brand_id):
                    raise ValidationError({'brand': 'A marca deve corresponder à identidade histórica do catálogo.'})
                if request.data.get('organization') is not None and str(source_catalog.organization_id) != str(request.data['organization']):
                    raise ValidationError({'organization': 'A organização deve corresponder ao catálogo.'})
                brand = source_catalog.brand
                if brand:
                    brand_context = copy.deepcopy(source_catalog.brand_snapshot)
                    if not brand_context:
                        raise ValidationError({'catalog_id': 'O catálogo não possui identidade histórica persistida.'})
            else:
                brand = _requested_brand(request.user, request.data)
                brand_context = BrandContextResolver.resolve(brand, products=products, user_request=prompt)
            if brand:
                assert_organization_access(request.user, brand.organization, write=True)
                # Preserve the exact version resolved before an expensive AI request.
                captured_hash = snapshot_hash(brand_context)
                captured_version = brand_context['meta']['brand_version']

        try:
            kwargs = {'prompt': prompt, 'products': products, 'creative_seed': creative_seed}
            if brand_context is not None:
                kwargs['brand_context'] = copy.deepcopy(brand_context)
            result = generate_catalog_from_gemini(**kwargs)
            if brand:
                # The backend owns the snapshot and persists the generated draft in one transaction.
                # A later Brand edit or a client-supplied snapshot cannot alter this catalog.
                palette = result.get('palette') if isinstance(result.get('palette'), dict) else {}
                pages = result.get('pages')
                if not isinstance(pages, list) or not all(isinstance(page, dict) for page in pages):
                    raise ValueError('Generation returned an invalid page envelope.')
                with transaction.atomic():
                    check_catalog_creation_guard(request.user, brand.organization)
                    catalog = StudioCatalog.objects.create(
                        title=str(result.get('title') or 'Novo Catálogo')[:255],
                        created_by=request.user, organization=brand.organization, brand=brand,
                        brand_name=brand_context['identity']['name'], brand_version=captured_version,
                        brand_snapshot=brand_context, brand_snapshot_hash=captured_hash,
                        palette_data=palette, total_pages=len(pages),
                        primary_color=palette.get('primary', '#111827'),
                        secondary_color=palette.get('background', '#FFFFFF'),
                        accent_color=palette.get('accent', '#6366f1'),
                        generation_metadata={
                            'qualityGate': copy.deepcopy(result.get('qualityGate')),
                            'generationStatus': result.get('generationStatus'),
                        },
                    )
                    CatalogSpread.objects.bulk_create([
                        CatalogSpread(
                            catalog=catalog, spread_index=index // 2,
                            title=f'Spread {index + 1}–{min(index + 2, len(pages))}',
                            left_page_elements=[pages[index]],
                            right_page_elements=[pages[index + 1]] if index + 1 < len(pages) else [],
                        ) for index in range(0, len(pages), 2)
                    ])
                    ChatThread.objects.create(catalog=catalog, user=request.user, title=f'Chat: {catalog.title}'[:255])
                result.update({
                    'studioCatalogId': str(catalog.pk), 'brandId': str(brand.pk),
                    'brandVersion': captured_version, 'brandSnapshot': copy.deepcopy(brand_context),
                    'brandSnapshotHash': captured_hash,
                })
                logger.info('Brand generation brand_id=%s version=%s snapshot_hash=%s schema=%s guidelines=%s assets=%s',
                            brand.pk, captured_version, captured_hash, brand_context['meta'].get('schema_version'),
                            len(brand_context.get('guidelines', [])), len(brand_context.get('assets', [])))
            return Response(result, status=status.HTTP_200_OK)
        except APIException:
            raise
        except Exception as err:
            logger.error(f"[StudioCatalogGenerate] Falha ao gerar catalogo: {err}")
            return Response({"error": "Falha na sintese generativa do catalogo."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudioProductImageGenerateView(APIView):
    """
    Gera ou resolve fotografia comercial de estudio para um produto via IA / acervo editorial.
    POST /api/v2/studio/products/generate-image/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from api.ai.catalog_builder import generate_product_image_with_ai

        name = request.data.get("name", "").strip()
        category = request.data.get("category", "").strip()
        description = request.data.get("description", "").strip()

        if not name:
            return Response({"error": "O campo name e obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = generate_product_image_with_ai(name=name, category=category, description=description)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as err:
            logger.error(f"[StudioProductImageGenerate] Falha ao gerar imagem: {err}")
            return Response({"error": "Falha na geracao de imagem para o produto."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudioSpriteGenerateView(APIView):
    """
    Sintetiza sprites e elementos visuais isolados com fundo transparente via Gemini.
    POST /api/v2/studio/sprites/generate/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        from api.services.sprite_generator import SpriteGeneratorService

        prompt = request.data.get("prompt", "").strip()
        palette = request.data.get("palette", [])
        style = request.data.get("style", "editorial_sticker")
        catalog_id = request.data.get("catalog_id")

        if not prompt:
            return Response({"error": "O campo prompt e obrigatorio."}, status=status.HTTP_400_BAD_REQUEST)

        # Inspecao de cotas de uso do plano se usuario estiver autenticado
        if request.user and request.user.is_authenticated:
            try:
                check_chat_guard(request.user)
            except Exception as quota_err:
                return Response(
                    {"error": "Limite de uso do plano atingido. Faca upgrade para continuar gerando sprites."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

        try:
            result = SpriteGeneratorService.generate_sprite(
                prompt=prompt,
                palette=palette,
                style=style,
                catalog_id=catalog_id,
            )
            abs_url = result["sprite_url"]
            if abs_url.startswith("/"):
                abs_url = request.build_absolute_uri(abs_url)
                result["sprite_url"] = abs_url

            if request.user and request.user.is_authenticated:
                record_token_usage(
                    user=request.user,
                    catalog=None,
                    agent_role="director",
                    prompt_tokens=50,
                    completion_tokens=200,
                    model_name="gemini-2.5-flash-image",
                )
            return Response(result, status=status.HTTP_200_OK)
        except Exception as err:
            logger.error(f"[StudioSpriteGenerate] Falha ao gerar sprite: {err}")
            return Response({"error": f"Falha na sintese do sprite: {str(err)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class StudioExportGuardCheckView(APIView):
    """
    Valida se a resolucao de exportacao solicitada (ex: 300 DPI) esta liberada para a cota/plano do usuario.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        dpi = int(request.data.get("dpi", 150))
        user = request.user if request.user.is_authenticated else None
        try:
            check_export_guard(user, dpi=dpi)
            return Response({
                "allowed": True,
                "dpi": dpi,
            })
        except ExportDpiRestrictedException:
            return Response(
                {
                    "allowed": False,
                    "code": "export_dpi_restricted",
                    "error": "A exportacao em 300 DPI (alta definicao grafica) e um recurso exclusivo do Plano Pro.",
                },
                status=status.HTTP_403_FORBIDDEN
            )


def sanitize_sheet_product(item: dict, index: int, catalog_id: Optional[int] = None) -> dict:
    """
    Higieniza e normaliza campos de produto extraidos de planilhas.
    """
    name = str(item.get("name", "")).strip() or f"Produto {index + 1:02d}"
    raw_price = str(item.get("price", "")).strip()

    # Sanitizacao e extracao do valor decimal
    clean_num = re.sub(r"[^\d,\.]", "", raw_price)
    decimal_val = Decimal("0.00")
    if "," in clean_num and "." in clean_num:
        clean_num = clean_num.replace(".", "").replace(",", ".")
    elif "," in clean_num:
        clean_num = clean_num.replace(",", ".")

    try:
        if clean_num:
            decimal_val = Decimal(clean_num)
    except Exception:
        decimal_val = Decimal("0.00")

    formatted_price = f"R$ {decimal_val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    sku = str(item.get("sku", "")).strip()
    if not sku:
        sku = f"SKU-{index + 1:03d}"

    category = str(item.get("category", "")).strip() or "COLECAO 2026"
    description = str(item.get("description", "")).strip() or "Item catalogado via importacao de planilha comercial."
    image = str(item.get("image", "")).strip()
    tag = str(item.get("tag", "")).strip() or "Importado"

    item_id = str(item.get("id", "")).strip()
    if not item_id:
        item_id = f"prod-sheet-{catalog_id or 'inv'}-{int(time.time())}-{index + 1}"

    return {
        "id": item_id,
        "name": name,
        "price": formatted_price,
        "numeric_price": float(decimal_val),
        "sku": sku,
        "category": category,
        "description": description,
        "image": image,
        "tag": tag,
        "index": f"{index + 1:02d}",
    }


class StudioProductSheetImportView(APIView):
    """
    Processa a importacao de produtos a partir de planilhas Excel (.xlsx/.xls) ou CSV.
    Permite envio de array JSON ja mapeado no front ou multipart com o arquivo bruto.
    Persiste os produtos no PostgreSQL (StudioCatalog.unassigned_products e Product).
    """
    permission_classes = [AllowAny]

    def post(self, request, catalog_id=None):
        user = request.user if request.user.is_authenticated else None
        target_catalog_id = catalog_id or request.data.get("catalog_id")
        catalog = None
        if target_catalog_id:
            try:
                cat_id_int = int(target_catalog_id)
                if user:
                    catalog = StudioCatalog.objects.filter(
                        Q(created_by=user) | Q(organization__in=user.organizations.all()),
                        id=cat_id_int
                    ).first()
                    if not catalog:
                        return Response({"error": "Catalogo nao encontrado ou sem permissao"}, status=status.HTTP_404_NOT_FOUND)
                else:
                    return Response({"error": "Autenticacao necessaria para vincular produtos a um catalogo"}, status=status.HTTP_401_UNAUTHORIZED)
            except (ValueError, TypeError):
                pass

        raw_items = []
        uploaded_file = request.FILES.get("file")

        if uploaded_file:
            fname = uploaded_file.name.lower()
            try:
                if fname.endswith(".csv"):
                    content = uploaded_file.read().decode("utf-8-sig", errors="ignore")
                    sniffer = csv.Sniffer()
                    try:
                        dialect = sniffer.sniff(content[:2048])
                        delimiter = dialect.delimiter
                    except Exception:
                        delimiter = ";" if ";" in content[:1000] else ","
                    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
                    rows = list(reader)
                    if rows:
                        headers = [str(h).strip().lower() for h in rows[0]]
                        for row in rows[1:]:
                            if not any(row):
                                continue
                            item_dict = {}
                            for h_idx, h_val in enumerate(headers):
                                if h_idx < len(row):
                                    item_dict[h_val] = row[h_idx]
                            raw_items.append(item_dict)

                elif fname.endswith((".xlsx", ".xls")):
                    import openpyxl
                    wb = openpyxl.load_workbook(uploaded_file, data_only=True)
                    ws = wb.active
                    rows = list(ws.iter_rows(values_only=True))
                    if rows:
                        headers = [str(h or "").strip().lower() for h in rows[0]]
                        for row in rows[1:]:
                            if not any(row):
                                continue
                            item_dict = {}
                            for h_idx, h_val in enumerate(headers):
                                if h_idx < len(row):
                                    item_dict[h_val] = row[h_idx]
                            raw_items.append(item_dict)
            except Exception as read_err:
                logger.error(f"[StudioProductSheetImport] Erro ao ler arquivo de planilha: {read_err}")
                return Response(
                    {"error": f"Nao foi possivel processar o arquivo de planilha: {str(read_err)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            # Recebe array JSON ja mapeado e validado
            raw_items = request.data.get("products", [])

        if not raw_items:
            return Response(
                {"error": "Nenhum produto identificado para importacao."},
                status=status.HTTP_400_BAD_REQUEST
            )

        sanitized_products = []
        for idx, item in enumerate(raw_items):
            # Mapeamento heuristico caso as chaves venham diretamente do cabeçalho da planilha
            norm_item = {}
            for k, v in item.items():
                knorm = str(k).lower().strip()
                if any(x in knorm for x in ["nome", "title", "produto", "item"]) and "name" not in norm_item:
                    norm_item["name"] = v
                elif any(x in knorm for x in ["preco", "preço", "valor", "vlr", "price"]) and "price" not in norm_item:
                    norm_item["price"] = v
                elif any(x in knorm for x in ["sku", "codigo", "código", "ref"]) and "sku" not in norm_item:
                    norm_item["sku"] = v
                elif any(x in knorm for x in ["categoria", "category", "linha", "grupo"]) and "category" not in norm_item:
                    norm_item["category"] = v
                elif any(x in knorm for x in ["descricao", "descrição", "description", "detalhes"]) and "description" not in norm_item:
                    norm_item["description"] = v
                elif any(x in knorm for x in ["foto", "imagem", "image", "img", "link"]) and "image" not in norm_item:
                    norm_item["image"] = v
                elif any(x in knorm for x in ["tag", "selo", "badge", "destaque"]) and "tag" not in norm_item:
                    norm_item["tag"] = v
                else:
                    norm_item[knorm] = v

            sanitized_products.append(sanitize_sheet_product(norm_item, idx, catalog.id if catalog else None))

        # 1. Se associado a um catalogo, atualiza unassigned_products
        if catalog:
            existing = catalog.unassigned_products or []
            existing_skus = {p.get("sku") for p in existing if p.get("sku")}
            merged = list(existing)
            for sp in sanitized_products:
                if sp["sku"] not in existing_skus:
                    merged.append(sp)
                    existing_skus.add(sp["sku"])
                else:
                    # Atualiza item existente
                    for m_idx, m_item in enumerate(merged):
                        if m_item.get("sku") == sp["sku"]:
                            merged[m_idx] = sp
                            break
            catalog.unassigned_products = merged
            catalog.save(update_fields=["unassigned_products"])

        # 2. Se usuario autenticado, sincroniza com o modelo relacional Product
        if user and user.is_authenticated:
            org = user.organizations.first() or user.owned_organizations.first()
            for sp in sanitized_products:
                try:
                    Product.objects.get_or_create(
                        sku=sp["sku"],
                        defaults={
                            "name": sp["name"],
                            "description": sp["description"],
                            "price": Decimal(str(sp["numeric_price"])),
                            "badge": sp["tag"],
                            "organization": org,
                            "created_by": user,
                        }
                    )
                except Exception as p_err:
                    logger.debug(f"[StudioProductSheetImport] Sincronizacao de Product model pulada: {p_err}")

        return Response({
            "status": "success",
            "count": len(sanitized_products),
            "catalog_id": catalog.id if catalog else None,
            "products": sanitized_products,
            "message": f"{len(sanitized_products)} produtos importados com sucesso para o acervo."
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PRIORIDADE 4: ONBOARDING & TEMPLATES DE DEMONSTRACAO CANONICOS (ZERO DATA STATE)
# ==============================================================================

CANONICAL_DEMO_TEMPLATES = {
    "maison_verdana": {
        "key": "maison_verdana",
        "title": "Maison Verdana — Coleção Inverno 2026",
        "brand_name": "Maison Verdana",
        "segment": "Moda & Luxo",
        "description": "Editorial de alta costura contemporânea com tipografia serifada nobre, proporções A4 harmônicas e respiro generoso.",
        "style_preset": "Luxe · Noir & Or",
        "primary_color": "#18181B",
        "secondary_color": "#52525B",
        "accent_color": "#B08D57",
        "palette_data": {
            "name": "Luxe · Noir & Or",
            "primary": "#18181B",
            "secondary": "#52525B",
            "accent": "#B08D57",
            "background": "#F5F1EA",
            "surface": "#FDFBF7",
            "contrastRatio": "9.2:1 (AAA)",
            "locked": True,
        },
        "total_pages": 6,
        "spreads": [
            {
                "spread_index": 0,
                "left_page": {
                    "id": "p-demo-mv-1",
                    "pageNumber": 1,
                    "type": "cover",
                    "title": "MAISON VERDANA",
                    "subtitle": "COLEÇÃO INVERNO 2026",
                    "label": "ALTA COSTURA CONTEMPORÂNEA",
                    "backgroundColor": "#18181B",
                    "textColor": "#F5F1EA",
                    "accentColor": "#B08D57",
                    "folio": "",
                },
                "right_page": {
                    "id": "p-demo-mv-2",
                    "pageNumber": 2,
                    "type": "manifesto",
                    "label": "MANIFESTO",
                    "title": "A Geometria do Cuidado",
                    "quote": "Onde o silêncio vira forma.",
                    "content": "Cada peça Maison Verdana nasce de uma contradição resolvida: a rigidez da estrutura e a fluidez do movimento. Brasil no gesto. Europa na precisão.",
                    "backgroundColor": "#F5F1EA",
                    "textColor": "#18181B",
                    "accentColor": "#B08D57",
                    "folio": "02 · MANIFESTO",
                },
            },
            {
                "spread_index": 1,
                "left_page": {
                    "id": "p-demo-mv-3",
                    "pageNumber": 3,
                    "type": "hero",
                    "label": "DESTAQUE · 01",
                    "backgroundColor": "#F5F1EA",
                    "textColor": "#18181B",
                    "accentColor": "#B08D57",
                    "folio": "03 · LOOKBOOK",
                    "products": [
                        {
                            "id": "prod-mv-1",
                            "name": "Casaco Structural Noir",
                            "sku": "VRD-CST-01",
                            "price": "R$ 4.800,00",
                            "description": "Lã fria pura com lapela estruturada e forro em cupro italiano de alta respirabilidade.",
                            "image": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
                            "tag": "Obra Prima",
                            "details": ["Lã pura 100%", "Costura manual sellier", "Garantia vitalícia"],
                        }
                    ],
                },
                "right_page": {
                    "id": "p-demo-mv-4",
                    "pageNumber": 4,
                    "type": "duo",
                    "label": "SELEÇÃO · PEÇAS CHAVE",
                    "backgroundColor": "#F5F1EA",
                    "textColor": "#18181B",
                    "accentColor": "#B08D57",
                    "folio": "04 · LOOKBOOK",
                    "products": [
                        {
                            "id": "prod-mv-2",
                            "name": "Blazer Ardoise Duplo",
                            "sku": "VRD-BLZ-02",
                            "price": "R$ 3.200,00",
                            "description": "Alfaiataria desconstruída com botões em madrepérola escura fosca.",
                            "image": "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
                            "tag": "Bestseller",
                        },
                        {
                            "id": "prod-mv-3",
                            "name": "Calça Palazzo Ivoire",
                            "sku": "VRD-CAL-03",
                            "price": "R$ 1.950,00",
                            "description": "Caimento amplo em crepe de seda com cintura alta e passantes reforçados.",
                            "image": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
                            "tag": "Novo",
                        },
                    ],
                },
            },
            {
                "spread_index": 2,
                "left_page": {
                    "id": "p-demo-mv-5",
                    "pageNumber": 5,
                    "type": "grid_4",
                    "label": "ACERVO COMPLEMENTAR",
                    "backgroundColor": "#F5F1EA",
                    "textColor": "#18181B",
                    "accentColor": "#B08D57",
                    "folio": "05 · ACERVO",
                    "products": [
                        {
                            "id": "prod-mv-4",
                            "name": "Vestido Column Or",
                            "sku": "VRD-VST-04",
                            "price": "R$ 5.600,00",
                            "description": "Seda pura drapeada com filetes metálicos sutis.",
                            "image": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=600&q=80",
                            "tag": "Limitado",
                        },
                        {
                            "id": "prod-mv-5",
                            "name": "Bolsa Envelope Noir",
                            "sku": "VRD-BLS-05",
                            "price": "R$ 2.700,00",
                            "description": "Couro box calf com fecho magnético em acabamento ouro satiné.",
                            "image": "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&q=80",
                            "tag": "Destaque",
                        },
                        {
                            "id": "prod-mv-6",
                            "name": "Scarpin Satiné 70mm",
                            "sku": "VRD-SCP-06",
                            "price": "R$ 1.480,00",
                            "description": "Salto escultural com bico fino e solado em couro natural.",
                            "image": "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&q=80",
                        },
                        {
                            "id": "prod-mv-7",
                            "name": "Sobretudo Long Ardoise",
                            "sku": "VRD-SBT-07",
                            "price": "R$ 6.200,00",
                            "description": "Cashmere blend com gola xale e cinto removível.",
                            "image": "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&q=80",
                            "tag": "Exclusivo",
                        },
                    ],
                },
                "right_page": {
                    "id": "p-demo-mv-6",
                    "pageNumber": 6,
                    "type": "backcover",
                    "label": "ATENDIMENTO EXECUTIVO",
                    "title": "MAISON VERDANA",
                    "content": "SHOWROOM: R. OSCAR FREIRE, 412 — JARDINS, SÃO PAULO\nWHATSAPP: +55 (11) 91234-5678 · COMERCIAL@MAISONVERDANA.COM.BR\nWWW.MAISONVERDANA.COM.BR",
                    "backgroundColor": "#18181B",
                    "textColor": "#F5F1EA",
                    "accentColor": "#B08D57",
                    "folio": "MAISON VERDANA · 2026",
                },
            },
        ],
        "unassigned_products": [
            {
                "id": "prod-mv-8",
                "name": "Blusa Silk Plissê",
                "sku": "VRD-BLS-08",
                "price": "R$ 980,00",
                "category": "Blusas",
                "description": "Tecido leve com plissado permanente e acabamento em viés.",
                "image": "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=600&q=80",
                "tag": "Disponível",
            },
            {
                "id": "prod-mv-9",
                "name": "Cinto Fivela Or Satiné",
                "sku": "VRD-ACC-09",
                "price": "R$ 650,00",
                "category": "Acessórios",
                "description": "Couro bovino legítimo com fivela retangular banhada.",
                "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
            },
            {
                "id": "prod-mv-10",
                "name": "Lenço de Seda Estampado",
                "sku": "VRD-ACC-10",
                "price": "R$ 520,00",
                "category": "Acessórios",
                "description": "Seda 100% com barra enrolada à mão e padronagem geométrica.",
                "image": "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600&q=80",
            },
        ],
    },
    "vektron_systems": {
        "key": "vektron_systems",
        "title": "VEKTRON Systems — Hardware Industrial & Edge Computing",
        "brand_name": "VEKTRON Systems",
        "segment": "Hardware & TI",
        "description": "Catálogo comercial e técnico B2B com códigos SKU, especificações elétricas, diagramação de alta densidade e acento cyan industrial.",
        "style_preset": "Minimaliste · Slate & Pure Ivory",
        "primary_color": "#0F0F11",
        "secondary_color": "#3F3F46",
        "accent_color": "#06B6D4",
        "palette_data": {
            "name": "Minimaliste · Slate & Pure Ivory",
            "primary": "#0F0F11",
            "secondary": "#3F3F46",
            "accent": "#06B6D4",
            "background": "#F4F4F5",
            "surface": "#FFFFFF",
            "contrastRatio": "8.5:1 (AAA)",
            "locked": True,
        },
        "total_pages": 6,
        "spreads": [
            {
                "spread_index": 0,
                "left_page": {
                    "id": "p-demo-vk-1",
                    "pageNumber": 1,
                    "type": "cover",
                    "title": "VEKTRON SYSTEMS",
                    "subtitle": "ENGENHARIA DE ALTA DISPONIBILIDADE · LINHA 2026",
                    "label": "HARDWARE INDUSTRIAL & SERVIDORES",
                    "backgroundColor": "#0F0F11",
                    "textColor": "#F4F4F5",
                    "accentColor": "#06B6D4",
                    "folio": "",
                },
                "right_page": {
                    "id": "p-demo-vk-2",
                    "pageNumber": 2,
                    "type": "manifesto",
                    "label": "MANIFESTO TÉCNICO",
                    "title": "Precisão Sem Tolerância a Falhas",
                    "quote": "Desempenho que não negocia com o tempo.",
                    "content": "Construímos para os profissionais que sabem que cada milissegundo importa. VEKTRON não fabrica apenas peças: entrega estabilidade operacional e throughput contínuo.",
                    "backgroundColor": "#F4F4F5",
                    "textColor": "#0F0F11",
                    "accentColor": "#06B6D4",
                    "folio": "02 · ENGENHARIA",
                },
            },
            {
                "spread_index": 1,
                "left_page": {
                    "id": "p-demo-vk-3",
                    "pageNumber": 3,
                    "type": "hero",
                    "label": "DESTAQUE SERVIDORES",
                    "backgroundColor": "#F4F4F5",
                    "textColor": "#0F0F11",
                    "accentColor": "#06B6D4",
                    "folio": "03 · PRODUTO HERO",
                    "products": [
                        {
                            "id": "prod-vk-1",
                            "name": "Servidor Edge VK-1000 Rack 1U",
                            "sku": "VK-SRV-1000",
                            "price": "R$ 18.900,00",
                            "description": "Processador Dual Xeon Scalable, 128GB ECC DDR5, 4x NVMe U.2 hot-swap com redundância 1+1 Platinum.",
                            "image": "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&q=80",
                            "tag": "Missão Crítica",
                            "details": ["Gabinete 1U reforçado", "Certificação IP54", "Garantia On-Site 3 Anos"],
                        }
                    ],
                },
                "right_page": {
                    "id": "p-demo-vk-4",
                    "pageNumber": 4,
                    "type": "duo",
                    "label": "INFRAESTRUTURA & REDES",
                    "backgroundColor": "#F4F4F5",
                    "textColor": "#0F0F11",
                    "accentColor": "#06B6D4",
                    "folio": "04 · INFRAESTRUTURA",
                    "products": [
                        {
                            "id": "prod-vk-2",
                            "name": "Switch Managed 24P 10GbE SFP+",
                            "sku": "VK-SW-24X",
                            "price": "R$ 7.450,00",
                            "description": "Backplane de 480 Gbps não-bloqueante, suporte L3 e alimentação DC redundante.",
                            "image": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&q=80",
                            "tag": "Pronta Entrega",
                        },
                        {
                            "id": "prod-vk-3",
                            "name": "Rack Industrial 42U Ventilado",
                            "sku": "VK-RCK-42U",
                            "price": "R$ 4.300,00",
                            "description": "Estrutura em aço galvanizado 2mm com portas perfuradas a 80% de fluxo de ar.",
                            "image": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80",
                            "tag": "B2B Atacado",
                        },
                    ],
                },
            },
            {
                "spread_index": 2,
                "left_page": {
                    "id": "p-demo-vk-5",
                    "pageNumber": 5,
                    "type": "grid_4",
                    "label": "COMPONENTES & MÓDULOS",
                    "backgroundColor": "#F4F4F5",
                    "textColor": "#0F0F11",
                    "accentColor": "#06B6D4",
                    "folio": "05 · COMPONENTES",
                    "products": [
                        {
                            "id": "prod-vk-4",
                            "name": "Módulo Transceiver 10G SFP+",
                            "sku": "VK-SFP-10G",
                            "price": "R$ 290,00 / un",
                            "description": "Alcance 10km monomodo 1310nm LC duplex.",
                            "image": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&q=80",
                        },
                        {
                            "id": "prod-vk-5",
                            "name": "Fonte Redundante 1200W Titanium",
                            "sku": "VK-PSU-1200",
                            "price": "R$ 1.850,00",
                            "description": "Eficiência 96% com PMBus 1.2 e ventoinha silenciosa.",
                            "image": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=600&q=80",
                            "tag": "Top Pick",
                        },
                        {
                            "id": "prod-vk-6",
                            "name": "Placa Aceleradora PCIe Gen5",
                            "sku": "VK-ACC-G5",
                            "price": "R$ 9.800,00",
                            "description": "FPGA de baixa latência para processamento de telemetria.",
                            "image": "https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&q=80",
                        },
                        {
                            "id": "prod-vk-7",
                            "name": "PDU Inteligente 16A com Medição",
                            "sku": "VK-PDU-16M",
                            "price": "R$ 1.250,00",
                            "description": "8 saídas C13 monitoradas via SNMP e display frontal OLED.",
                            "image": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=600&q=80",
                        },
                    ],
                },
                "right_page": {
                    "id": "p-demo-vk-6",
                    "pageNumber": 6,
                    "type": "backcover",
                    "label": "SUPORTE E CONDICOES COMERCIAIS",
                    "title": "VEKTRON SYSTEMS",
                    "content": "CENTRAL CORPORATIVA · CAMPINAS / SP\nWHATSAPP COMERCIAL: +55 (19) 99876-5432\nVENDAS@VEKTRON.COM.BR · WWW.VEKTRON.COM.BR",
                    "backgroundColor": "#0F0F11",
                    "textColor": "#F4F4F5",
                    "accentColor": "#06B6D4",
                    "folio": "VEKTRON · 2026",
                },
            },
        ],
        "unassigned_products": [
            {
                "id": "prod-vk-8",
                "name": "Cabo DAC 10G SFP+ 3 metros",
                "sku": "VK-DAC-3M",
                "price": "R$ 145,00",
                "category": "Cabos",
                "description": "Cobre passivo com baixa atenuação e travas metálicas.",
                "image": "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=600&q=80",
            },
            {
                "id": "prod-vk-9",
                "name": "Kit Trilhos Telescópicos para Rack",
                "sku": "VK-RAIL-1U",
                "price": "R$ 380,00",
                "category": "Acessórios",
                "description": "Suporta até 45kg com trava de extração rápida.",
                "image": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80",
            },
        ],
    },
    "atelier_sucre": {
        "key": "atelier_sucre",
        "title": "Atelier Sucré — Confeitaria & Pâtisserie Fina",
        "brand_name": "Atelier Sucré",
        "segment": "Gastronomia",
        "description": "Cardápio e catálogo para encomendas de doces finos, potes gourmet, sobremesas artesanais e lembranças de eventos.",
        "style_preset": "Édition · Terracotta & Sable",
        "primary_color": "#2C1E1A",
        "secondary_color": "#6A4D45",
        "accent_color": "#C86D51",
        "palette_data": {
            "name": "Édition · Terracotta & Sable",
            "primary": "#2C1E1A",
            "secondary": "#6A4D45",
            "accent": "#C86D51",
            "background": "#FAF6F0",
            "surface": "#FFFDF9",
            "contrastRatio": "7.9:1 (AA)",
            "locked": True,
        },
        "total_pages": 6,
        "spreads": [
            {
                "spread_index": 0,
                "left_page": {
                    "id": "p-demo-as-1",
                    "pageNumber": 1,
                    "type": "cover",
                    "title": "ATELIER SUCRÉ",
                    "subtitle": "PÂTISSERIE ARTESANAL & ENCOMENDAS 2026",
                    "label": "ALTA CONFEITARIA",
                    "backgroundColor": "#2C1E1A",
                    "textColor": "#FAF6F0",
                    "accentColor": "#C86D51",
                    "folio": "",
                },
                "right_page": {
                    "id": "p-demo-as-2",
                    "pageNumber": 2,
                    "type": "manifesto",
                    "label": "NOSSO PROCESSO",
                    "title": "A Confeitaria como Arte",
                    "quote": "O doce perfeito nasce da paciência e da matéria-prima nobre.",
                    "content": "Manteiga francesa, favas de baunilha de Madagascar e chocolate de origem sustentável. Cada doce e embalado como um presente memoravel.",
                    "backgroundColor": "#FAF6F0",
                    "textColor": "#2C1E1A",
                    "accentColor": "#C86D51",
                    "folio": "02 · MANIFESTO",
                },
            },
            {
                "spread_index": 1,
                "left_page": {
                    "id": "p-demo-as-3",
                    "pageNumber": 3,
                    "type": "hero",
                    "label": "DESTAQUE DO CHEF",
                    "backgroundColor": "#FAF6F0",
                    "textColor": "#2C1E1A",
                    "accentColor": "#C86D51",
                    "folio": "03 · DOCES FINOS",
                    "products": [
                        {
                            "id": "prod-as-1",
                            "name": "Caixa Prestige Macarons 12 un",
                            "sku": "SUC-MAC-12",
                            "price": "R$ 138,00",
                            "description": "Farinha de amêndoas californianas, ganaches puras de pistache, framboesa, baunilha e caramelo salgado.",
                            "image": "https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=800&q=80",
                            "tag": "Favorito",
                            "details": ["Gluten-free", "Sem conservantes", "Validade 5 dias"],
                        }
                    ],
                },
                "right_page": {
                    "id": "p-demo-as-4",
                    "pageNumber": 4,
                    "type": "duo",
                    "label": "POTES GOURMET & TORTAS",
                    "backgroundColor": "#FAF6F0",
                    "textColor": "#2C1E1A",
                    "accentColor": "#C86D51",
                    "folio": "04 · SOBREMESAS",
                    "products": [
                        {
                            "id": "prod-as-2",
                            "name": "Pote Duo Brigadeiro & Ninho 220g",
                            "sku": "SUC-POT-01",
                            "price": "R$ 28,00",
                            "description": "Camadas generosas de brigadeiro belga 54% e creme sedoso de leite Ninho.",
                            "image": "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=800&q=80",
                            "tag": "Bestseller",
                        },
                        {
                            "id": "prod-as-3",
                            "name": "Tartelette de Limão Siciliano",
                            "sku": "SUC-TAR-02",
                            "price": "R$ 32,00",
                            "description": "Massa sablée crocante com curd de limão e merengue suíço tostado.",
                            "image": "https://images.unsplash.com/photo-1519869325930-281384150729?w=800&q=80",
                            "tag": "Novo",
                        },
                    ],
                },
            },
            {
                "spread_index": 2,
                "left_page": {
                    "id": "p-demo-as-5",
                    "pageNumber": 5,
                    "type": "grid_4",
                    "label": "LEMBRANÇAS & LINHA FESTA",
                    "backgroundColor": "#FAF6F0",
                    "textColor": "#2C1E1A",
                    "accentColor": "#C86D51",
                    "folio": "05 · FESTAS",
                    "products": [
                        {
                            "id": "prod-as-4",
                            "name": "Bolo Veludo Vermelho 1.5kg",
                            "sku": "SUC-BOL-04",
                            "price": "R$ 180,00",
                            "description": "Massa aveludada com recheio de cream cheese frosting.",
                            "image": "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600&q=80",
                        },
                        {
                            "id": "prod-as-5",
                            "name": "Brownie Fudge com Nozes",
                            "sku": "SUC-BRW-05",
                            "price": "R$ 18,00 / un",
                            "description": "Casquinha craquelada e centro úmido e denso.",
                            "image": "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80",
                        },
                        {
                            "id": "prod-as-6",
                            "name": "Geleia Artesanal Amoras & Vinho",
                            "sku": "SUC-GEL-06",
                            "price": "R$ 35,00",
                            "description": "Frutas frescas cozidas em tacho de cobre sem pectina industrial.",
                            "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&q=80",
                        },
                        {
                            "id": "prod-as-7",
                            "name": "Trufas de Chocolate Belga 6 un",
                            "sku": "SUC-TRF-07",
                            "price": "R$ 48,00",
                            "description": "Polvilhadas com cacau alcalino 100% puro.",
                            "image": "https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=600&q=80",
                            "tag": "Presente",
                        },
                    ],
                },
                "right_page": {
                    "id": "p-demo-as-6",
                    "pageNumber": 6,
                    "type": "backcover",
                    "label": "ENCOMENDAS & EVENTOS",
                    "title": "ATELIER SUCRÉ",
                    "content": "ATELIER EM SÃO PAULO · JARDIM PAULISTA\nWHATSAPP ENCOMENDAS: +55 (11) 97721-3400\nENCOMENDAS@ATELIERSUCRE.COM · WWW.ATELIERSUCRE.COM",
                    "backgroundColor": "#2C1E1A",
                    "textColor": "#FAF6F0",
                    "accentColor": "#C86D51",
                    "folio": "ATELIER SUCRÉ · 2026",
                },
            },
        ],
        "unassigned_products": [
            {
                "id": "prod-as-8",
                "name": "Cookies Gotas de Chocolate Callebaut",
                "sku": "SUC-CK-08",
                "price": "R$ 14,00",
                "category": "Cookies",
                "description": "Massa amanteigada com pitada de flor de sal.",
                "image": "https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=600&q=80",
            },
        ],
    },
    "cristallo_joias": {
        "key": "cristallo_joias",
        "title": "Cristallo — Alta Joalheria & Gemas Raras",
        "brand_name": "Cristallo Joias",
        "segment": "Alta Joalheria",
        "description": "Lookbook exclusivo para diamantes certificados, esmeraldas colombianas e coleções de casamento em ouro 18k.",
        "style_preset": "Luxe · Noir & Or",
        "primary_color": "#121214",
        "secondary_color": "#4A4846",
        "accent_color": "#D4AF37",
        "palette_data": {
            "name": "Luxe · Noir & Or",
            "primary": "#121214",
            "secondary": "#4A4846",
            "accent": "#D4AF37",
            "background": "#FDFBF7",
            "surface": "#FFFFFF",
            "contrastRatio": "9.5:1 (AAA)",
            "locked": True,
        },
        "total_pages": 6,
        "spreads": [
            {
                "spread_index": 0,
                "left_page": {
                    "id": "p-demo-cj-1",
                    "pageNumber": 1,
                    "type": "cover",
                    "title": "CRISTALLO",
                    "subtitle": "ALTA JOALHERIA & GEMAS RARAS · 2026",
                    "label": "COLEÇÃO SOLEIL",
                    "backgroundColor": "#121214",
                    "textColor": "#FDFBF7",
                    "accentColor": "#D4AF37",
                    "folio": "",
                },
                "right_page": {
                    "id": "p-demo-cj-2",
                    "pageNumber": 2,
                    "type": "manifesto",
                    "label": "MANIFESTO DE LUXO",
                    "title": "A Eternidade na Matéria",
                    "quote": "Uma joia verdadeira transcende as gerações e guarda o tempo em sua luz.",
                    "content": "Ourivesaria tradicional com gemas selecionadas sob rigorosas normas gemológicas internacionais. chromatographic e cravação executada sob microscópio para brilho absoluto.",
                    "backgroundColor": "#FDFBF7",
                    "textColor": "#121214",
                    "accentColor": "#D4AF37",
                    "folio": "02 · OURIVESARIA",
                },
            },
            {
                "spread_index": 1,
                "left_page": {
                    "id": "p-demo-cj-3",
                    "pageNumber": 3,
                    "type": "hero",
                    "label": "PEÇA HERO · SOLITÁRIO",
                    "backgroundColor": "#FDFBF7",
                    "textColor": "#121214",
                    "accentColor": "#D4AF37",
                    "folio": "03 · DIAMANTES",
                    "products": [
                        {
                            "id": "prod-cj-1",
                            "name": "Solitário Éternité Diamante 2.1ct",
                            "sku": "CRIS-SOL-01",
                            "price": "R$ 48.000,00",
                            "description": "Diamante lapidação brilhante cor D pureza VVS1 cravado em platina 950 com aro em ouro amarelo 18k.",
                            "image": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=800&q=80",
                            "tag": "Certificado GIA",
                            "details": ["Certificado GIA", "Platina 950 & Ouro 18k", "Garantia vitalícia com polimento"],
                        }
                    ],
                },
                "right_page": {
                    "id": "p-demo-cj-4",
                    "pageNumber": 4,
                    "type": "duo",
                    "label": "ESMERALDAS & COLAR",
                    "backgroundColor": "#FDFBF7",
                    "textColor": "#121214",
                    "accentColor": "#D4AF37",
                    "folio": "04 · SELEÇÃO NOBRE",
                    "products": [
                        {
                            "id": "prod-cj-2",
                            "name": "Brincos Gota Esmeralda Colombiana",
                            "sku": "CRIS-BR-02",
                            "price": "R$ 19.500,00",
                            "description": "Par de esmeraldas gotas 4.2ct totais com auréola de diamantes navete.",
                            "image": "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&q=80",
                            "tag": "Edição Única",
                        },
                        {
                            "id": "prod-cj-3",
                            "name": "Colar Rivière Diamantes 8ct",
                            "sku": "CRIS-COL-03",
                            "price": "R$ 64.000,00",
                            "description": "Ouro branco 18k com fecho oculto de segurança.",
                            "image": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&q=80",
                            "tag": "Exclusivo",
                        },
                    ],
                },
            },
            {
                "spread_index": 2,
                "left_page": {
                    "id": "p-demo-cj-5",
                    "pageNumber": 5,
                    "type": "grid_4",
                    "label": "ALIANÇAS & CLÁSSICOS",
                    "backgroundColor": "#FDFBF7",
                    "textColor": "#121214",
                    "accentColor": "#D4AF37",
                    "folio": "05 · ALIANÇAS",
                    "products": [
                        {
                            "id": "prod-cj-4",
                            "name": "Aliança Abaulada 4mm Ouro Amarelo",
                            "sku": "CRIS-AL-04",
                            "price": "R$ 4.200,00",
                            "description": "Conforto interno anatômico em ouro maciço 18k 750.",
                            "image": "https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=600&q=80",
                        },
                        {
                            "id": "prod-cj-5",
                            "name": "Meia Aliança Cravejada Diamantes",
                            "sku": "CRIS-AL-05",
                            "price": "R$ 8.900,00",
                            "description": "15 diamantes calibrados de 10 pontos cada.",
                            "image": "https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600&q=80",
                        },
                        {
                            "id": "prod-cj-6",
                            "name": "Pulseira Tennis Ouro Branco 18k",
                            "sku": "CRIS-PLS-06",
                            "price": "R$ 22.000,00",
                            "description": "Articulação flexível ultra resistente com diamantes lapidação brilhante.",
                            "image": "https://images.unsplash.com/photo-1611591475841-863a154c1f96?w=600&q=80",
                            "tag": "Ícone",
                        },
                        {
                            "id": "prod-cj-7",
                            "name": "Anel Cocktail Safira Azul Ceilão",
                            "sku": "CRIS-AN-07",
                            "price": "R$ 31.000,00",
                            "description": "Safira natural sem tratamento térmico acompanhada de diamantes trapézio.",
                            "image": "https://images.unsplash.com/photo-1598560917505-59a3ad559071?w=600&q=80",
                        },
                    ],
                },
                "right_page": {
                    "id": "p-demo-cj-6",
                    "pageNumber": 6,
                    "type": "backcover",
                    "label": "CONCIERGE & ATENDIMENTO PRIVADO",
                    "title": "CRISTALLO JOIAS",
                    "content": "SALÃO PRIVADO · SÃO PAULO & RIO DE JANEIRO\nATENDIMENTO VIP WHATSAPP: +55 (11) 96543-2100\nVIP@CRISTALLOJOIAS.COM.BR · WWW.CRISTALLOJOIAS.COM.BR",
                    "backgroundColor": "#121214",
                    "textColor": "#FDFBF7",
                    "accentColor": "#D4AF37",
                    "folio": "CRISTALLO · 2026",
                },
            },
        ],
        "unassigned_products": [
            {
                "id": "prod-cj-8",
                "name": "Pingente Ponto de Luz Diamante 50pt",
                "sku": "CRIS-PNG-08",
                "price": "R$ 6.800,00",
                "category": "Pingentes",
                "description": "Corrente veneziana 45cm em ouro branco 18k.",
                "image": "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&q=80",
            },
        ],
    },
}


class StudioDemoTemplatesListView(APIView):
    """
    Lista os 4 templates canônicos de demonstração para onboarding do Katana Studio.
    GET /api/v2/studio/demo/templates/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        templates = []
        for key, tpl in CANONICAL_DEMO_TEMPLATES.items():
            templates.append({
                "key": key,
                "title": tpl["title"],
                "brand_name": tpl["brand_name"],
                "segment": tpl["segment"],
                "description": tpl["description"],
                "style_preset": tpl["style_preset"],
                "primary_color": tpl["primary_color"],
                "secondary_color": tpl["secondary_color"],
                "accent_color": tpl["accent_color"],
                "palette_data": tpl["palette_data"],
                "total_pages": tpl["total_pages"],
                "product_count": sum(
                    len(sp["left_page"].get("products", [])) + len(sp["right_page"].get("products", []))
                    for sp in tpl["spreads"]
                ) + len(tpl.get("unassigned_products", [])),
            })
        return Response({"templates": templates}, status=status.HTTP_200_OK)


class StudioDemoCatalogLoadView(APIView):
    """
    Carrega ou clona um catálogo de demonstração canônico para o usuário.
    Se autenticado, persiste registro real de StudioCatalog e StudioSpread no PostgreSQL.
    POST /api/v2/studio/demo/load-template/
    """
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        template_key = (request.data.get("template_key") or "maison_verdana").strip().lower()
        if template_key not in CANONICAL_DEMO_TEMPLATES:
            template_key = "maison_verdana"

        blueprint = CANONICAL_DEMO_TEMPLATES[template_key]
        user = request.user

        # Se o usuario estiver autenticado, cria e persiste no PostgreSQL
        if user and user.is_authenticated:
            org = _requested_organization(user, request.data)
            check_catalog_creation_guard(user, org)
            try:
                catalog = StudioCatalog.objects.create(
                    created_by=user,
                    organization=org,
                    title=blueprint["title"],
                    brand_name=blueprint["brand_name"],
                    style_preset=blueprint["style_preset"],
                    primary_color=blueprint["primary_color"],
                    secondary_color=blueprint["secondary_color"],
                    accent_color=blueprint["accent_color"],
                    palette_data=blueprint["palette_data"],
                    brand_lock=True,
                    total_pages=blueprint["total_pages"],
                    unassigned_products=blueprint.get("unassigned_products", []),
                )

                created_spreads = []
                for sp in blueprint["spreads"]:
                    spread_obj = CatalogSpread.objects.create(
                        catalog=catalog,
                        spread_index=sp["spread_index"],
                        title=f"Spread {sp['spread_index'] + 1}",
                        left_page_elements=[sp["left_page"]],
                        right_page_elements=[sp["right_page"]],
                    )
                    created_spreads.append({
                        "id": spread_obj.id,
                        "spread_index": spread_obj.spread_index,
                        "left_page": sp["left_page"],
                        "right_page": sp["right_page"],
                        "left_page_elements": spread_obj.left_page_elements,
                        "right_page_elements": spread_obj.right_page_elements,
                    })

                return Response({
                    "status": "success",
                    "persisted": True,
                    "catalog": {
                        "id": catalog.id,
                        "title": catalog.title,
                        "brand_name": catalog.brand_name,
                        "style_preset": catalog.style_preset,
                        "primary_color": catalog.primary_color,
                        "secondary_color": catalog.secondary_color,
                        "accent_color": catalog.accent_color,
                        "palette_data": catalog.palette_data,
                        "brand_lock": catalog.brand_lock,
                        "total_pages": catalog.total_pages,
                        "unassigned_products": catalog.unassigned_products,
                        "spreads": created_spreads,
                    },
                    "message": f"Catálogo '{catalog.title}' clonado e persistido na sua conta com sucesso."
                }, status=status.HTTP_201_CREATED)

            except Exception as err:
                transaction.set_rollback(True)
                logger.error(f"[StudioDemoCatalogLoad] Erro ao persistir catalogo demo no banco: {err}")
                # Fallback para resposta in-memory sem travar a experiencia do usuario

        # Resposta sem persistencia (usuario anonimo ou fallback)
        return Response({
            "status": "success",
            "persisted": False,
            "catalog": {
                "id": f"demo-{template_key}",
                "title": blueprint["title"],
                "brand_name": blueprint["brand_name"],
                "style_preset": blueprint["style_preset"],
                "primary_color": blueprint["primary_color"],
                "secondary_color": blueprint["secondary_color"],
                "accent_color": blueprint["accent_color"],
                "palette_data": blueprint["palette_data"],
                "brand_lock": True,
                "total_pages": blueprint["total_pages"],
                "unassigned_products": blueprint.get("unassigned_products", []),
                "spreads": blueprint["spreads"],
            },
            "message": f"Catálogo de demonstração '{blueprint['title']}' carregado com sucesso."
        }, status=status.HTTP_200_OK)


# ==============================================================================
# PRIORIDADE 5: COMPARTILHAMENTO PUBLICO & VISUALIZADOR INTERATIVO (DIGITAL FLIPBOOK)
# ==============================================================================

class StudioPublicCatalogView(APIView):
    """
    Endpoint publico para o Leitor Interativo Web (Digital Flipbook).
    Nao exige autenticacao (permission_classes = [AllowAny]).
    Suporta tanto IDs numericos de StudioCatalog no PostgreSQL quanto
    chaves canonicas de demonstracao ('maison_verdana', 'vektron_systems', etc.).
    Sanitiza dados sensiveis e expoe apenas informacoes visuais e editoriais.
    GET /api/v2/studio/public/catalogs/<str:catalog_id>/
    """
    permission_classes = [AllowAny]

    def get(self, request, catalog_id):
        cleaned_id = str(catalog_id or "").strip()
        if cleaned_id.startswith("demo-"):
            demo_key = cleaned_id[5:].strip().lower()
        elif cleaned_id.startswith("demo_"):
            demo_key = cleaned_id[5:].strip().lower()
        else:
            demo_key = cleaned_id.lower()

        # Suporta tanto formato com underline quanto com hifen
        canonical_key = demo_key if demo_key in CANONICAL_DEMO_TEMPLATES else demo_key.replace("-", "_")

        # 1. Checa se e um template de demonstracao canonico
        if canonical_key in CANONICAL_DEMO_TEMPLATES:
            blueprint = CANONICAL_DEMO_TEMPLATES[canonical_key]
            return Response({
                "id": canonical_key,
                "title": blueprint["title"],
                "brand_name": blueprint.get("brand_name", "Katana Studio"),
                "segment": blueprint.get("segment", ""),
                "description": blueprint.get("description", ""),
                "style_preset": blueprint.get("style_preset", "Minimaliste"),
                "primary_color": blueprint.get("primary_color", "#18181B"),
                "secondary_color": blueprint.get("secondary_color", "#52525B"),
                "accent_color": blueprint.get("accent_color", "#B08D57"),
                "palette_data": blueprint.get("palette_data", {}),
                "total_pages": blueprint.get("total_pages", len(blueprint.get("spreads", [])) * 2),
                "spreads": blueprint.get("spreads", []),
                "unassigned_products": blueprint.get("unassigned_products", []),
                "is_demo": True,
            }, status=status.HTTP_200_OK)

        # 2. Checa se e um ID numerico de catalogo no PostgreSQL
        try:
            cat_id_int = int(cleaned_id)
            catalog = StudioCatalog.objects.filter(id=cat_id_int).first()
        except (ValueError, TypeError):
            catalog = None

        if not catalog or catalog.status == 'archived':
            return Response(
                {"error": "Catálogo público não encontrado ou indisponível."},
                status=status.HTTP_404_NOT_FOUND
            )

        if catalog.import_metadata:
            from api.services.document_reconstructor import import_quality_passed
            if catalog.import_metadata.get('share_enabled') is not True or not import_quality_passed(catalog.import_metadata):
                return Response({'error': 'Este documento não foi autorizado para compartilhamento.',
                                 'code': 'import_catalog_private'}, status=status.HTTP_403_FORBIDDEN)

        if catalog.generation_metadata:
            gate = catalog.generation_metadata.get('qualityGate') or {}
            if not (isinstance(gate, dict) and gate.get('passed') is True
                    and gate.get('publishable') is True and gate.get('status') == 'passed'):
                return Response({'error': 'Este catálogo requer revisão antes do compartilhamento.',
                                 'code': 'brand_catalog_not_publishable'}, status=status.HTTP_403_FORBIDDEN)

        # Recupera as laminas ordenadas
        spreads_qs = catalog.spreads.all().order_by("spread_index")
        spreads_data = []
        for sp in spreads_qs:
            left_page = sp.left_page_elements[0] if sp.left_page_elements and len(sp.left_page_elements) > 0 else None
            right_page = sp.right_page_elements[0] if sp.right_page_elements and len(sp.right_page_elements) > 0 else None
            if catalog.import_metadata:
                from api.services.document_reconstructor import public_import_page
                left_page = public_import_page(left_page)
                right_page = public_import_page(right_page)
            spreads_data.append({
                "spread_index": sp.spread_index,
                "title": sp.title or f"Lâmina {sp.spread_index + 1}",
                "left_page": left_page,
                "right_page": right_page,
            })

        return Response({
            "id": str(catalog.id),
            "title": catalog.title,
            "brand_name": catalog.brand_name or "Katana Studio",
            "style_preset": catalog.style_preset or "Minimaliste",
            "primary_color": catalog.primary_color or "#18181B",
            "secondary_color": catalog.secondary_color or "#52525B",
            "accent_color": catalog.accent_color or "#B08D57",
            "palette_data": catalog.palette_data or {},
            "total_pages": catalog.total_pages or (len(spreads_data) * 2),
            "spreads": spreads_data,
            "unassigned_products": [] if catalog.import_metadata else (catalog.unassigned_products or []),
            "created_at": catalog.created_at.isoformat() if hasattr(catalog, "created_at") and catalog.created_at else None,
            "is_demo": False,
        }, status=status.HTTP_200_OK)
