import json
import logging
import re
from typing import Generator, Optional, Dict, Any
from django.http import StreamingHttpResponse, JsonResponse
from django.db.models import Q
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema

from api.models import (
    StudioCatalog,
    CatalogSpread,
    ChatThread,
    ChatMessage,
    SubscriptionPlan,
    OrganizationQuota,
    CatalogTemplate,
)
from api.ai.agents.registry import get_agent, list_agents
from api.guards.quota_guard import (
    check_chat_guard,
    record_token_usage,
    get_user_quota,
    QuotaExceededException,
    RateLimitExceededException,
)
from api.services.file_processor import FileAttachmentProcessor
from api.services.template_rag import TemplateRAGService, generate_embedding

logger = logging.getLogger(__name__)

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
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        quota, plan = get_user_quota(user)

        tokens_used = quota.tokens_used_this_month if quota else 0
        monthly_quota = plan.monthly_token_quota if plan else 100000

        return Response({
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
        catalogs = StudioCatalog.objects.filter(
            Q(created_by=user) | Q(organization__in=user.organizations.all())
        ).distinct().order_by("-updated_at")
        results = []
        for cat in catalogs:
            spread_count = cat.spreads.count()
            results.append({
                "id": cat.id,
                "title": cat.title,
                "description": cat.description or "",
                "brand_name": cat.brand_name or "",
                "style_preset": cat.style_preset,
                "primary_color": cat.primary_color,
                "secondary_color": cat.secondary_color,
                "accent_color": cat.accent_color,
                "font_family": cat.font_family,
                "spread_count": spread_count,
                "created_at": cat.created_at.isoformat(),
                "updated_at": cat.updated_at.isoformat(),
            })
        return Response(results)

    def post(self, request):
        data = request.data
        title = data.get("title", "Novo Catalogo Studio")
        brand_name = data.get("brand_name", "")
        style_preset = data.get("style_preset", "editorial_clean")
        primary_color = data.get("primary_color", "#111827")
        secondary_color = data.get("secondary_color", "#6366f1")

        user = request.user
        org = user.organizations.first()

        catalog = StudioCatalog.objects.create(
            title=title,
            brand_name=brand_name,
            style_preset=style_preset,
            primary_color=primary_color,
            secondary_color=secondary_color,
            organization=org,
            created_by=user,
        )

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
            "id": catalog.id,
            "title": catalog.title,
            "brand_name": catalog.brand_name,
            "style_preset": catalog.style_preset,
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
        return StudioCatalog.objects.filter(
            Q(created_by=user) | Q(organization__in=user.organizations.all()),
            pk=pk
        ).first()

    def get(self, request, pk):
        catalog = self.get_catalog(request.user, pk)
        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)

        spreads = []
        for s in catalog.spreads.all().order_by("spread_index"):
            spreads.append({
                "id": s.id,
                "spread_index": s.spread_index,
                "title": s.title or f"Pagina Dupla {s.spread_index + 1}",
                "left_page_elements": s.left_page_elements,
                "right_page_elements": s.right_page_elements,
            })

        latest_thread = catalog.threads.first()
        thread_id = latest_thread.id if latest_thread else None

        return Response({
            "id": catalog.id,
            "title": catalog.title,
            "description": catalog.description or "",
            "brand_name": catalog.brand_name or "",
            "style_preset": catalog.style_preset,
            "primary_color": catalog.primary_color,
            "secondary_color": catalog.secondary_color,
            "accent_color": catalog.accent_color,
            "font_family": catalog.font_family,
            "page_width": catalog.page_width,
            "page_height": catalog.page_height,
            "thread_id": thread_id,
            "spreads": spreads,
            "created_at": catalog.created_at.isoformat(),
            "updated_at": catalog.updated_at.isoformat(),
        })

    def put(self, request, pk):
        catalog = self.get_catalog(request.user, pk)
        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        catalog.title = data.get("title", catalog.title)
        catalog.description = data.get("description", catalog.description)
        catalog.brand_name = data.get("brand_name", catalog.brand_name)
        catalog.style_preset = data.get("style_preset", catalog.style_preset)
        catalog.primary_color = data.get("primary_color", catalog.primary_color)
        catalog.secondary_color = data.get("secondary_color", catalog.secondary_color)
        catalog.accent_color = data.get("accent_color", catalog.accent_color)
        catalog.font_family = data.get("font_family", catalog.font_family)
        catalog.save()

        return Response({"status": "updated", "id": catalog.id, "title": catalog.title})

    def delete(self, request, pk):
        catalog = self.get_catalog(request.user, pk)
        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)

        catalog.delete()
        return Response({"status": "deleted"}, status=status.HTTP_204_NO_CONTENT)


class StudioSpreadManageView(APIView):
    """
    Gerencia spreads individuais (salvar alteracoes de layout e paginas duplas).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, catalog_id):
        user = request.user
        catalog = StudioCatalog.objects.filter(
            Q(created_by=user) | Q(organization__in=user.organizations.all()),
            pk=catalog_id
        ).first()

        if not catalog:
            return Response({"error": "Catalogo nao encontrado"}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        spread_index = int(data.get("spread_index", catalog.spreads.count()))
        title = data.get("title", f"Spread {spread_index + 1}")
        left_elements = data.get("left_page_elements", [])
        right_elements = data.get("right_page_elements", [])

        spread, created = CatalogSpread.objects.update_or_create(
            catalog=catalog,
            spread_index=spread_index,
            defaults={
                "title": title,
                "left_page_elements": left_elements,
                "right_page_elements": right_elements,
            }
        )

        return Response({
            "id": spread.id,
            "catalog_id": catalog.id,
            "spread_index": spread.spread_index,
            "title": spread.title,
            "created": created,
        })


class StudioThreadMessagesView(APIView):
    """
    Recupera o historico de mensagens de uma sessao de chat.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, thread_id):
        user = request.user
        thread = ChatThread.objects.filter(
            Q(user=user) | Q(catalog__created_by=user) | Q(catalog__organization__in=user.organizations.all()),
            pk=thread_id
        ).first()

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
    Suporta formatacao ```json:patch ... ``` ou ```json ... ``` contendo a chave updates.
    """
    if not text:
        return None
    pattern = r"```(?:json:patch|json)?\s*(\{[\s\S]*?\"updates\"[\s\S]*?\})\s*```"
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
            return Response(
                {"error": exc.detail, "code": getattr(exc, "default_code", "limit_exceeded")},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # 2. Processamento de Anexos
        attachments_info = []
        for file_key in request.FILES:
            uploaded = request.FILES[file_key]
            processed = FileAttachmentProcessor.process_file(uploaded)
            attachments_info.append(processed)

        # 3. Contexto do Catalogo e Thread
        catalog = None
        if catalog_id:
            try:
                catalog = StudioCatalog.objects.get(pk=catalog_id)
            except StudioCatalog.DoesNotExist:
                pass

        if not catalog and not catalog_id:
            # Se nao informou catalogo, cria ou usa um rascunho
            catalog = StudioCatalog.objects.create(
                title="Catalogo em Criacao",
                created_by=user,
            )

        thread = None
        if thread_id:
            try:
                thread = ChatThread.objects.get(pk=thread_id)
            except ChatThread.DoesNotExist:
                pass

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
                stream_generator = agent.process_stream(
                    user_message=message,
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

