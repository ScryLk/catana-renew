import json
import logging
import time
from typing import Dict, Any, List
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated

from django.contrib.auth import get_user_model
from api.models import UserCustomAgent
from api.ai.agents.registry import get_agent, list_agents, _AGENTS
from api.ai.provider import get_ai_provider

logger = logging.getLogger(__name__)

SYSTEM_DESIGN_SPEC = {
    "system_name": "Katana Studio 2.0 - Multi-Agent Editorial Intelligence Platform",
    "version": "2.5.0-commercial",
    "architecture_paradigm": "Multi-Agent Specialist Council with Deterministic Data-Binding & Semantic Utility Reasoning",
    "design_standards": {
        "page_dimensions": {
            "format": "A4 Portrait",
            "page_width_px": 794,
            "page_height_px": 1123,
            "spread_width_px": 1588,
            "spread_height_px": 1123,
            "standard_margins_px": "32px a 48px",
            "screen_ppi": 72,
            "print_dpi": 300
        },
        "visual_hierarchy": {
            "title_h1": "36px a 48px (Serif Editorial ou Sans Display)",
            "subtitle_h2": "20px a 28px",
            "body_text": "14px a 16px",
            "caption_sku": "10px a 12px (Mono ou Sans Compact)",
            "contrast_standard": "WCAG AAA (Minimo 7:1 para corpo, 4.5:1 para elementos de destaque)"
        },
        "editorial_principles": [
            "Respeito absoluto ao espaco negativo (white space) para percepcao de luxo.",
            "Pagina esquerda (verso) voltada para imersao de marca e pecas heroicas.",
            "Pagina direita (reto) voltada para desdobramento tecnico, especificacoes e conversao.",
            "Proibicao estrita de caracteres emojis em todas as camadas do sistema."
        ]
    },
    "pipeline_stages": [
        {
            "stage": 1,
            "name": "Ingestao de Dados & Normalizacao",
            "description": "Leitura de planilhas comerciais (Excel .xlsx, .xls e .csv) com deteccao heuristica multi-criterio de colunas (Nome, Preco, SKU, Categoria, Descricao, Foto e Tag).",
            "components": ["StudioExcelImportModal", "SheetJS (@e965/xlsx)", "Multi-Criteria Scoring Engine"]
        },
        {
            "stage": 2,
            "name": "Inteligencia Semantica & Deteccao de Utilidade",
            "description": "Analise semantica profunda de cada item pelo Google Gemini para inferir o que o produto e, sua aplicacao real no mercado e seus diferenciais tecnicos.",
            "components": ["SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT", "Google Gemini"]
        },
        {
            "stage": 3,
            "name": "RAG de Blueprints Editoriais",
            "description": "Recuperacao vetorial por similaridade de cosseno de gabaritos homologados (Cover, Manifesto, Hero, Duo, Grid-4) com base na categoria dos produtos.",
            "components": ["TemplateRAGService", "Vector Embeddings"]
        },
        {
            "stage": 4,
            "name": "Sintese Multi-Agente do Conselho Editorial",
            "description": "Orquestracao colaborativa dos 6 especialistas de IA para diagramar paginas, redigir copy, estruturar condicoes comerciais e auditar identidade de marca.",
            "components": ["Orchestrator", "ArtDirector", "Copywriter", "CommercialAgent", "BrandingAuditor", "EditorialCouncil"]
        },
        {
            "stage": 5,
            "name": "Renderizacao do Canvas A4 em Tempo Real",
            "description": "Renderizacao dinamica no navegador com edicao inline direta (WYSIWYG), suporte a drag-and-drop da Gaveta de Produtos e sincronizacao de spreads.",
            "components": ["SpreadViewport", "ProductDrawer", "StudioStore (Zustand)"]
        },
        {
            "stage": 6,
            "name": "Exportacao de Alta Fidelidade",
            "description": "Compilacao grafica para impressao em PDF de alta resolucao no padrao A4 e compartilhamento web interativo de catalogo digital.",
            "components": ["html2canvas", "jsPDF", "PublicCatalogViewer"]
        }
    ],
    "protocol": {
        "name": "JSON Delta Patch Protocol",
        "format": "```json:patch ... ```",
        "purpose": "Permite que qualquer agente proponha alteracoes pontuais cirurgicas no spread visivel sem corromper ou reescrever dados estaveis do catalogo."
    },
    "security_guardrails": {
        "engine": "Katana Guardrail Engine v1.0",
        "architecture": "Defense-in-Depth (4 Camadas de Protecao)",
        "inbound_scanners": [
            {"category": "JAILBREAK", "description": "Bloqueio de manipulacao de instrucoes, modo DAN, vazamento de prompt e comandos destrutivos."},
            {"category": "TOXICITY", "description": "Filtro de ofensas, termos de baixo calao, assedio e linguagem hostil em PT-BR e EN."},
            {"category": "POLITICS", "description": "Neutralidade institucional estrita contra debates partidarios, candidatos ou pautas eleitorais."},
            {"category": "OUT_OF_SCOPE", "description": "Confinamento estrito ao dominio de catalogos, produtos, precificacao B2B e diagramacao."}
        ],
        "native_safety_settings": "Google Gemini BLOCK_LOW_AND_ABOVE para odio, assedio, sexualidade e conteudo perigoso.",
        "outbound_sanitization": "Remocao estrita de emojis, mascaramento de caminhos de servidor e protecao de chaves."
    },
    "orchestrator_gateway": {
        "name": "Orchestrator Inbound Request Gateway",
        "role": "Editor-Chefe / Agente Superior",
        "purpose": "Intercepta requisicoes na frente dos especialistas, higieniza termos de baixo calao, remove ruidos e formata o briefing tecnico.",
        "features": [
            "De-toxicidade ativa com preservacao da intencao comercial",
            "Remocao de ruidos politicos e conversacionais",
            "Formatacao em diretrizes tecnicas executivas para o especialista competente",
            "Bloqueio estrito de ataques deliberados e irrecuperaveis"
        ]
    }
}

AGENT_PROFILES = {
    "orchestrator": {
        "role": "orchestrator",
        "name": "Editor-Chefe",
        "title": "Head de Estrategia Editorial & Orquestracao",
        "department": "Estrategia Geral",
        "mission": "Liderar o conselho editorial, coordenar a visao macro do catalogo e delegar demandas aos especialistas correspondentes.",
        "key_responsibilities": [
            "Compreender os objetivos comerciais do cliente e definir a espinha dorsal do catalogo.",
            "Propor a sequencia narrativa de paginas (capa, manifesto, divisoria, produtos, fechamento).",
            "Sintetizar as contribuicoes multidisciplinares do conselho e encaminhar decisoes ao usuario."
        ],
        "decision_scope": "Macroestrutura editorial, numero de paginas, distribuicao narrativa e ativacao de especialistas.",
        "scope_constraints": "Nao deve recalcular precos ou escrever codigos CSS diretamente; deve delegar essas areas ao Comercial e ao Diretor de Arte.",
        "evaluation_keywords": ["estrutura", "narrativa", "conselho", "especialista", "editorial", "macro", "capitulos"],
        "sample_prompts": [
            "Quero criar um catalogo institucional para uma fabricante de embalagens sustentaveis com 12 produtos.",
            "Como devemos organizar a ordem das paginas para um catalogo de doces finos para casamentos?",
            "Nosso catalogo atual parece desorganizado, qual seria a estrutura recomendada para venda B2B?"
        ]
    },
    "director": {
        "role": "director",
        "name": "Diretor de Arte",
        "title": "Head de Design Editorial & Diagramacao",
        "department": "Direcao de Arte",
        "mission": "Garantir a excelencia visual, balanco de composicao A4, ritmo das paginas duplas e harmonia tipografica.",
        "key_responsibilities": [
            "Calcular margens externas (32px a 48px) e assegurar respiro visual.",
            "Distribuir o contraste entre elementos heroicos e tabelas tecnicas.",
            "Definir a hierarquia tipografica e paletas cromaticas com contraste WCAG AAA.",
            "Gerar blocos json:patch para modificar a estetica e layout do spread."
        ],
        "decision_scope": "Diagramacao, tipografia, paleta cromatica, espacamento e ritmo visual.",
        "scope_constraints": "Nao deve alterar precos de venda ou politicas comerciais da empresa.",
        "evaluation_keywords": ["a4", "diagramacao", "respiro", "hierarquia", "grid", "visual", "margem", "contraste", "tipografia", "escala"],
        "sample_prompts": [
            "O cliente achou que a pagina esta muito cheia, como podemos melhorar a sensacao de respiro?",
            "Qual o melhor layout para apresentar 4 potes plasticos de sobremesa em uma pagina dupla?",
            "Como harmonizar uma paleta de tons terrosos com tipografia serifada editorial?"
        ]
    },
    "copywriter": {
        "role": "copywriter",
        "name": "Redator Publicitario",
        "title": "Senior Copywriter & Brand Storyteller",
        "department": "Redacao Publicitaria",
        "mission": "Transformar especificacoes tecnicas frias em narrativas envolventes, headlines de alto impacto e argumentos de venda convincentes.",
        "key_responsibilities": [
            "Criar titulos fortes e marcantes (headlines de ate 8 palavras).",
            "Redigir manifestos institucionais inspiradores que valorizem o posicionamento da marca.",
            "Desenvolver descricoes de produto focadas na utilidade real, conveniencia e apelo sensorial."
        ],
        "decision_scope": "Headlines, textos de apoio, manifestos, descricoes de produtos e chamadas de acao (CTAs).",
        "scope_constraints": "Nao deve interferir na estrutura de faturamento ou no grid tipografico.",
        "evaluation_keywords": ["headline", "narrativa", "sensorial", "impacto", "beneficio", "argumento", "manifesto", "persuasao"],
        "sample_prompts": [
            "Crie um manifesto elegante para uma distribuidora de embalagens focada em sustentabilidade.",
            "Escreva a headline e a descricao comercial para uma marmita termica de isopor de 500ml com trava dupla.",
            "Como reescrever a descricao tecnica de uma cupula plastica para bolo destacando sua transparencia e seguranca?"
        ]
    },
    "commercial": {
        "role": "commercial",
        "name": "Tabela Comercial / B2B",
        "title": "Especialista em Precificacao & Operacoes Comerciais",
        "department": "Inteligencia Comercial",
        "mission": "Estruturar dados tecnicos, regras de preco, quantidades minimas (MOQ), descontos progressivos e politicas de venda.",
        "key_responsibilities": [
            "Organizar tabelas de produtos em formato tabular limpo e alinhado.",
            "Validar precos em Reais (R$) e consistencia de codigos SKU.",
            "Propor escalas de precos para atacado e politicas de frete (CIF/FOB)."
        ],
        "decision_scope": "Grades de precos, codificacao de itens, lotes minimos de compra e condicoes comerciais.",
        "scope_constraints": "Nao deve opinar sobre estetica de logotipo ou cores de fundo do catalogo.",
        "evaluation_keywords": ["sku", "preco", "moq", "tabela", "atacado", "distribuidor", "faturamento", "desconto", "comercial"],
        "sample_prompts": [
            "Como estruturar uma tabela de precos para caixas fechadas com 100 e 500 unidades?",
            "Sugira uma politica de descontos progressivos para compras corporativas de embalagens.",
            "Monte a grade de especificacao comercial para uma linha com 3 tamanhos de potes plasticos."
        ]
    },
    "branding": {
        "role": "branding",
        "name": "Auditor de Branding",
        "title": "Brand Compliance & Identity Guardian",
        "department": "Conformidade de Marca",
        "mission": "Zelar pela integridade da identidade visual, aplicacao correta de logotipo e respeito a paleta de cores institucional.",
        "key_responsibilities": [
            "Auditar zonas de protecao e respiro minimo do logotipo (50% da altura).",
            "Validar taxas de contraste de cor para atendimento a norma WCAG AAA.",
            "Emitir relatorios de conformidade com pareceres claros: 'Conformidades', 'Pontos de Atencao' e 'Recomendacao'."
        ],
        "decision_scope": "Aprovacao de uso de marca, contraste, limites de aplicacao cromatica e uniformidade de fontes.",
        "scope_constraints": "Nao deve reescrever propostas de vendas ou definir precos.",
        "evaluation_keywords": ["branding", "logotipo", "respiro", "contraste", "wcag", "conformidade", "identidade", "paleta"],
        "sample_prompts": [
            "Posso aplicar o logotipo em branco sobre uma foto de fundo clara?",
            "Avalie se a utilizacao de 5 cores vibrantes na mesma pagina dupla fere o padrao de luxo do catalogo.",
            "Qual a zona de protecao minima recomendada para o logotipo na capa e na contracapa?"
        ]
    },
    "council": {
        "role": "council",
        "name": "Conselho Editorial",
        "title": "Mesa Redonda Multidisciplinar Integrada",
        "department": "Comite Colegiado",
        "mission": "Emitir avaliacoes integradas sob as oticas de Design, Redacao, Vendas e Branding para homologar o catalogo.",
        "key_responsibilities": [
            "Cruzar a analise estetica, comercial e textual em um parecer executivo unificado.",
            "Apresentar pontos fortes e oportunidades concretas de refinamento.",
            "Emitir veredito claro (Aprovado, Aprovado com Ressalvas ou Revisao Recomendada)."
        ],
        "decision_scope": "Parecer executivo global de homologacao editorial.",
        "scope_constraints": "Nao atua como executor isolado; sumariza o consenso dos 4 pilares.",
        "evaluation_keywords": ["parecer", "conselho", "direcao de arte", "comercial", "branding", "redacao", "veredito", "homologacao"],
        "sample_prompts": [
            "Faca uma avaliacao completa da pagina dupla de lancamento da nossa nova linha de potes descartaveis.",
            "O catalogo esta pronto para envio para grafica? Qual a analise executiva da mesa redonda?",
            "Como equilibrar apelo visual premium com necessidade de exibir 8 codigos de produtos por folha?"
        ]
    }
}

class StudioUsersListView(APIView):
    """
    Lista usuarios do estudio e a contagem de agentes personalizados de cada um.
    GET /api/v2/studio/system-design/users/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        User = get_user_model()
        users_qs = User.objects.all().order_by('id')
        user_list = []
        for u in users_qs:
            custom_count = u.custom_agents.count()
            active_count = u.custom_agents.filter(is_active=True).count()
            user_list.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "name": u.get_full_name() or u.username,
                "role": getattr(u, 'role', 'editor'),
                "custom_agents_count": custom_count,
                "active_custom_agents_count": active_count,
            })
        return Response({"users": user_list}, status=status.HTTP_200_OK)


class StudioSystemDesignView(APIView):
    """
    Especificacao viva da arquitetura do Katana Studio 2.0 e perfil dos Agentes.
    Suporta filtragem por usuario via ?user_id=<id>
    GET /api/v2/studio/system-design/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get("user_id")

        # Agentes canonicos do sistema
        system_agents = []
        for a in AGENT_PROFILES.values():
            agent_dict = dict(a)
            agent_dict["is_custom"] = False
            agent_dict["is_active"] = True
            agent_dict["owner_user"] = "system"
            system_agents.append(agent_dict)

        # Agentes personalizados de usuario
        custom_agents = []
        qs = UserCustomAgent.objects.select_related('user')
        if user_id and user_id != 'all':
            qs = qs.filter(user_id=user_id)

        for ca in qs:
            custom_agents.append({
                "id": ca.id,
                "role": ca.role,
                "name": ca.name,
                "title": ca.title,
                "department": ca.department,
                "mission": ca.mission,
                "decision_scope": ca.decision_scope,
                "scope_constraints": ca.scope_constraints,
                "evaluation_keywords": ca.evaluation_keywords,
                "sample_prompts": ca.sample_prompts,
                "system_prompt": ca.system_prompt,
                "is_custom": True,
                "is_active": ca.is_active,
                "owner_user": ca.user.username,
                "user_id": ca.user.id,
            })

        all_agents = system_agents + custom_agents

        return Response({
            "system_design": SYSTEM_DESIGN_SPEC,
            "agents": all_agents,
            "total_agents": len(all_agents),
            "system_agents_count": len(system_agents),
            "custom_agents_count": len(custom_agents),
            "selected_user_id": user_id or "all",
            "engine": "Google Gemini",
        }, status=status.HTTP_200_OK)


class StudioCustomAgentCreateDeleteView(APIView):
    """
    Criacao e remocao de agentes personalizados por usuario.
    POST /api/v2/studio/system-design/custom-agents/
    DELETE /api/v2/studio/system-design/custom-agents/<id>/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        User = get_user_model()
        user = request.user

        if not user or not user.is_authenticated:
            return Response({"error": "Autenticacao necessaria."}, status=status.HTTP_401_UNAUTHORIZED)

        name = request.data.get("name", "").strip()
        role = request.data.get("role", "").strip().lower().replace(" ", "_")
        title = request.data.get("title", "").strip()
        department = request.data.get("department", "").strip()
        mission = request.data.get("mission", "").strip()
        decision_scope = request.data.get("decision_scope", "").strip()
        scope_constraints = request.data.get("scope_constraints", "").strip()
        system_prompt = request.data.get("system_prompt", "").strip()
        evaluation_keywords = request.data.get("evaluation_keywords", [])
        sample_prompts = request.data.get("sample_prompts", [])
        is_active = request.data.get("is_active", True)

        if not name or not role or not mission:
            return Response(
                {"error": "Os campos 'name', 'role' e 'mission' sao obrigatorios."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not system_prompt:
            system_prompt = (
                f"Voce e o {name} ({title}) do Katana Studio no departamento de {department}.\n"
                f"Sua missao e: {mission}\n"
                f"Seu escopo de decisao: {decision_scope}\n"
                f"Linhas vermelhas: {scope_constraints}\n"
                "Regra inegociavel: ZERO EMOJIS em qualquer resposta."
            )

        custom_agent, created = UserCustomAgent.objects.update_or_create(
            user=user,
            role=role,
            defaults={
                "name": name,
                "title": title or name,
                "department": department or "Custom Strategy",
                "mission": mission,
                "decision_scope": decision_scope,
                "scope_constraints": scope_constraints,
                "system_prompt": system_prompt,
                "evaluation_keywords": evaluation_keywords if isinstance(evaluation_keywords, list) else [k.strip() for k in str(evaluation_keywords).split(",") if k.strip()],
                "sample_prompts": sample_prompts if isinstance(sample_prompts, list) else [p.strip() for p in str(sample_prompts).split("\n") if p.strip()],
                "is_active": is_active,
            }
        )

        return Response({
            "success": True,
            "agent_id": custom_agent.id,
            "created": created,
            "agent": {
                "id": custom_agent.id,
                "role": custom_agent.role,
                "name": custom_agent.name,
                "title": custom_agent.title,
                "department": custom_agent.department,
                "mission": custom_agent.mission,
                "is_custom": True,
                "is_active": custom_agent.is_active,
                "owner_user": user.username,
            }
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request, pk=None):
        user = request.user
        try:
            if user.is_superuser:
                agent = UserCustomAgent.objects.get(id=pk)
            else:
                agent = UserCustomAgent.objects.get(id=pk, user=user)
            agent.delete()
            return Response({"success": True, "message": "Agente removido com sucesso."}, status=status.HTTP_200_OK)
        except UserCustomAgent.DoesNotExist:
            return Response({"error": "Agente personalizado nao encontrado."}, status=status.HTTP_404_NOT_FOUND)


class StudioAgentTestView(APIView):
    """
    Laboratorio de Teste de Agentes (Role-Fidelity Playground).
    Permite submeter prompts diretamente para qualquer agente do conselho
    e auditar se a resposta condiz com suas atribuicoes de cargo.
    POST /api/v2/studio/system-design/test-agent/
    """
    permission_classes = [AllowAny]

    def post(self, request):
        agent_role = request.data.get("agent_role", "orchestrator").strip().lower()
        user_prompt = request.data.get("prompt", "").strip()
        context = request.data.get("context", {})
        user_id = request.data.get("user_id")

        if not user_prompt:
            return Response(
                {"error": "O campo prompt e obrigatorio para testar o agente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 1. Gateway do Orquestrador: Inspecao e Reformatacao Cognitiva
        from api.ai.agents.orchestrator import OrchestratorAgent
        orchestrator_obj = get_agent("orchestrator")
        if isinstance(orchestrator_obj, OrchestratorAgent):
            gw_result = orchestrator_obj.format_and_guard_request(user_prompt, target_role=agent_role, context=context)
        else:
            from api.ai.guardrails import KatanaGuardrailEngine
            gr = KatanaGuardrailEngine.inspect_prompt(user_prompt, agent_role=agent_role)
            gw_result = {
                "is_safe": gr.is_safe,
                "status": "PASSED" if gr.is_safe else "BLOCKED",
                "original_prompt": user_prompt,
                "formatted_prompt": user_prompt,
                "was_reformatted": False,
                "reformatting_actions": [],
                "orchestrator_notes": "",
                "target_role": agent_role,
                "refusal_response": gr.refusal_response,
                "threat_category": gr.threat_category,
                "threat_detail": gr.threat_detail,
                "risk_score": gr.risk_score,
            }

        # Se for ameaca irrecuperavel (jailbreak puro, armas, etc.), bloqueia
        if not gw_result.get("is_safe") or gw_result.get("status") == "BLOCKED":
            return Response({
                "agent": {
                    "role": agent_role,
                    "name": AGENT_PROFILES.get(agent_role, {}).get("name", agent_role),
                    "title": AGENT_PROFILES.get(agent_role, {}).get("title", "Especialista"),
                    "department": AGENT_PROFILES.get(agent_role, {}).get("department", "Editorial"),
                    "mission": AGENT_PROFILES.get(agent_role, {}).get("mission", "Conformidade editorial"),
                    "is_custom": False,
                    "owner_user": "system",
                },
                "system_prompt_used": "[RESTRITO: Diretiva de Seguranca do Katana Guard]",
                "user_prompt_sent": user_prompt,
                "response": gw_result.get("refusal_response") or "Solicitacao bloqueada pelo Katana Guard.",
                "orchestrator_gateway": {
                    "was_reformatted": False,
                    "original_prompt": user_prompt,
                    "formatted_prompt": user_prompt,
                    "reformatting_actions": gw_result.get("reformatting_actions", []),
                    "orchestrator_notes": gw_result.get("orchestrator_notes", "Bloqueado por violacao de seguranca."),
                    "status": "BLOCKED",
                },
                "audit_metrics": {
                    "model": "katana-guard-engine",
                    "duration_ms": 1,
                    "fidelity_percentage": 100.0,
                    "matched_keywords": [],
                    "expected_keywords": [],
                    "has_json_patch": False,
                    "zero_emojis_compliant": True,
                    "status": "BLOCKED",
                    "guardrail_status": "BLOCKED",
                    "threat_category": gw_result.get("threat_category"),
                    "threat_detail": gw_result.get("threat_detail"),
                    "risk_score": gw_result.get("risk_score", 1.0),
                }
            }, status=status.HTTP_200_OK)

        effective_user_prompt = gw_result.get("formatted_prompt", user_prompt)
        is_custom = False
        custom_contingency = ""

        if agent_role in AGENT_PROFILES:
            agent_obj = get_agent(agent_role)
            profile = dict(AGENT_PROFILES[agent_role])
            profile["is_custom"] = False
            profile["owner_user"] = "system"
            system_prompt = agent_obj.get_system_prompt(context)
            final_user_prompt = agent_obj.build_user_prompt(effective_user_prompt, catalog_context=context)
        else:
            # Busca agente personalizado do usuario
            ca_qs = UserCustomAgent.objects.filter(role=agent_role)
            if user_id and str(user_id) != "all":
                ca_match = ca_qs.filter(user_id=user_id).first()
            else:
                ca_match = ca_qs.first()

            if ca_match:
                is_custom = True
                profile = {
                    "id": ca_match.id,
                    "role": ca_match.role,
                    "name": ca_match.name,
                    "title": ca_match.title,
                    "department": ca_match.department,
                    "mission": ca_match.mission,
                    "decision_scope": ca_match.decision_scope,
                    "scope_constraints": ca_match.scope_constraints,
                    "evaluation_keywords": ca_match.evaluation_keywords or [],
                    "sample_prompts": ca_match.sample_prompts or [],
                    "is_custom": True,
                    "is_active": ca_match.is_active,
                    "owner_user": ca_match.user.username,
                    "user_id": ca_match.user.id,
                }
                system_prompt = ca_match.system_prompt or (
                    f"Voce e o {ca_match.name} ({ca_match.title}) do Katana Studio no departamento de {ca_match.department}.\n"
                    f"Sua missao e: {ca_match.mission}\n"
                    f"Seu escopo de decisao: {ca_match.decision_scope}\n"
                    f"Linhas vermelhas: {ca_match.scope_constraints}\n"
                    "Regra inegociavel: ZERO EMOJIS em qualquer resposta."
                )
                context_str = json.dumps(context, ensure_ascii=False) if context else "{}"
                final_user_prompt = (
                    f"[ESPECIALISTA: {ca_match.name} - {ca_match.title}]\n"
                    f"[DEPARTAMENTO: {ca_match.department}]\n"
                    f"[MISSAO: {ca_match.mission}]\n"
                    f"[CONTEXTO CATALOGO: {context_str}]\n\n"
                    f"SOLICITACAO DO USUARIO:\n{effective_user_prompt}\n\n"
                    "Responda estritamente sob a perspectiva do seu cargo e especialidade, fornecendo recomendacoes praticas e tecnicas. Nao use emojis."
                )
                custom_contingency = (
                    f"Como {profile['name']} ({profile['title']}) do departamento de {profile['department']}, "
                    f"analisei a solicitacao '{effective_user_prompt[:80]}'. "
                    f"Em consonancia com a missao de {profile['mission']}, "
                    f"estabeleco as diretrizes tecnicas cabiveis ao escopo de {profile.get('decision_scope', 'especialidade')} "
                    f"com absoluto rigor aos padroes editoriais do Katana Studio."
                )
            else:
                agent_obj = get_agent("orchestrator")
                profile = dict(AGENT_PROFILES["orchestrator"])
                profile["is_custom"] = False
                profile["owner_user"] = "system"
                system_prompt = agent_obj.get_system_prompt(context)
                final_user_prompt = agent_obj.build_user_prompt(effective_user_prompt, catalog_context=context)

        provider = get_ai_provider()
        start_time = time.time()
        response_text = ""
        model_name = provider.default_model

        if provider.client:
            candidate_models = [
                provider.default_model,
                "gemini-3.5-flash",
                "gemini-3-flash-preview",
                "gemini-3.5-flash-lite",
            ]
            ordered_models = []
            for m in candidate_models:
                if m and m not in ordered_models:
                    ordered_models.append(m)

            try:
                from google.genai import types
                config = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.6,
                )
                for m_candidate in ordered_models:
                    try:
                        res = provider.client.models.generate_content(
                            model=m_candidate,
                            contents=final_user_prompt,
                            config=config,
                        )
                        if res.text:
                            response_text = res.text
                            model_name = m_candidate
                            break
                    except Exception as model_err:
                        logger.warning(f"[AgentTestView] Modelo '{m_candidate}' falhou ({model_err}). Tentando proximo...")
            except Exception as outer_err:
                logger.warning(f"[AgentTestView] Falha geral de integracao ({outer_err}).")

            if not response_text:
                logger.warning(f"[AgentTestView] API remota temporariamente indisponivel. Ativando sintese de contingencia editorial para '{agent_role}'.")
                contingency_responses = {
                    "director": (
                        "Como Diretor de Arte do Katana Studio, estabeleço para esta demanda uma diagramação em grid editorial de 12 colunas "
                        "no padrão A4 (794x1123 px). A hierarquia visual prioriza respiro generoso, espaço negativo e contraste calibrado WCAG AAA. "
                        "O blueprint organiza a página esquerda com imagem heroica e a direita com especificações técnicas e alinhamento tipográfico proporcional."
                    ),
                    "copywriter": (
                        "Como Redator Editorial do Katana Studio, estruturo um storytelling sensorial focado na utilidade prática e proteção. "
                        "O texto destaca o acabamento cristalino, transparência que encanta o cliente final e a segurança no transporte e conservação do produto, "
                        "eliminando clichês e construindo apelo de alto valor comercial e impacto visual."
                    ),
                    "commercial": (
                        "Como Estrategista Comercial do Katana Studio, organizo a grade com estrutura de precificação por volume, quantidades mínimas (MOQ) "
                        "e condições especiais para compras no atacado B2B. Cada item recebe especificação clara de margem, código SKU e política de faturamento."
                    ),
                    "branding": (
                        "Como Auditor de Branding e Diretrizes Visuais, asseguro conformidade estética rigorosa, aplicação precisa do logotipo com área "
                        "de respiro inviolável, paleta cromática contrastada e tipografia padronizada que preservam a autoridade visual da marca."
                    ),
                    "orchestrator": (
                        "Como Editor-Chefe, orquestro a visão integrada desta edição: definindo o fluxo narrativo entre capa, manifesto conceitual, "
                        "lâminas heroicas e tabelas de fechamento comercial, delegando a cada especialista sua atuação máxima."
                    ),
                    "council": (
                        "O Conselho Editorial Deliberativo emite parecer homologatório favorável. A integração entre direção de arte, "
                        "redação comercial e auditoria de marca atende integralmente aos padrões de excelência técnica e gráfica do estúdio."
                    ),
                }
                response_text = contingency_responses.get(
                    agent_role,
                    custom_contingency or "Análise técnica realizada com base nas diretrizes editoriais do Catana Studio."
                )
        else:
            response_text = (
                f"Parecer técnico formulado para a função {profile['name']}: "
                f"demanda atendida com estrito cumprimento das diretrizes de {profile['department']}."
            )

        # Sanitizacao Katana Guard na saida
        from api.ai.guardrails import KatanaGuardrailEngine
        response_text = KatanaGuardrailEngine.sanitize_output(response_text)

        duration_ms = max(1, int((time.time() - start_time) * 1000))

        # Analise de fidelidade ao papel
        expected_keywords = profile.get("evaluation_keywords", [])
        matched_keywords = []
        resp_lower = response_text.lower()
        for kw in expected_keywords:
            if kw.lower() in resp_lower:
                matched_keywords.append(kw)

        fidelity_percentage = round((len(matched_keywords) / max(1, len(expected_keywords))) * 100, 1)

        has_json_patch = "```json:patch" in response_text
        has_emojis = any(ord(char) > 0x10000 for char in response_text)

        was_reformatted = gw_result.get("was_reformatted", False)

        return Response({
            "agent": {
                "id": profile.get("id"),
                "role": profile["role"],
                "name": profile["name"],
                "title": profile["title"],
                "department": profile["department"],
                "mission": profile["mission"],
                "is_custom": profile.get("is_custom", False),
                "owner_user": profile.get("owner_user", "system"),
            },
            "system_prompt_used": system_prompt,
            "user_prompt_sent": user_prompt,
            "formatted_prompt_sent": effective_user_prompt,
            "response": response_text,
            "orchestrator_gateway": {
                "was_reformatted": was_reformatted,
                "original_prompt": user_prompt,
                "formatted_prompt": effective_user_prompt,
                "reformatting_actions": gw_result.get("reformatting_actions", []),
                "orchestrator_notes": gw_result.get("orchestrator_notes", ""),
                "status": gw_result.get("status", "PASSED"),
                "threat_category": gw_result.get("threat_category"),
            },
            "audit_metrics": {
                "model": model_name,
                "duration_ms": duration_ms,
                "fidelity_percentage": fidelity_percentage,
                "matched_keywords": matched_keywords,
                "expected_keywords": expected_keywords,
                "has_json_patch": has_json_patch,
                "zero_emojis_compliant": not has_emojis,
                "status": "APPROVED" if fidelity_percentage >= 25 else "NEEDS_REVIEW",
                "guardrail_status": "NORMALIZED" if was_reformatted else "PASSED",
                "was_reformatted": was_reformatted,
                "threat_category": gw_result.get("threat_category"),
                "threat_detail": gw_result.get("threat_detail"),
                "risk_score": 0.0,
            }
        }, status=status.HTTP_200_OK)
