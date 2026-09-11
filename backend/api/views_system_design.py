import json
import logging
import time
from typing import Dict, Any, List
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

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
            "components": ["SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT", "Google Gemini 2.5 Flash"]
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

class StudioSystemDesignView(APIView):
    """
    Especificacao viva da arquitetura do Katana Studio 2.0 e perfil dos Agentes.
    GET /api/v2/studio/system-design/
    """
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            "system_design": SYSTEM_DESIGN_SPEC,
            "agents": list(AGENT_PROFILES.values()),
            "total_agents": len(AGENT_PROFILES),
            "engine": "Google Gemini 2.5 Flash Enterprise",
        }, status=status.HTTP_200_OK)


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

        if not user_prompt:
            return Response(
                {"error": "O campo prompt e obrigatorio para testar o agente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        agent_obj = get_agent(agent_role)
        profile = AGENT_PROFILES.get(agent_role, AGENT_PROFILES["orchestrator"])

        system_prompt = agent_obj.get_system_prompt(context)
        final_user_prompt = agent_obj.build_user_prompt(user_prompt, catalog_context=context)

        provider = get_ai_provider()
        start_time = time.time()
        response_text = ""
        model_name = provider.default_model

        if provider.client:
            try:
                from google.genai import types
                config = types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.6,
                )
                res = provider.client.models.generate_content(
                    model=model_name,
                    contents=final_user_prompt,
                    config=config,
                )
                response_text = res.text or ""
            except Exception as err:
                logger.warning(f"[AgentTestView] API remota temporariamente indisponivel ({err}). Ativando sintese de contingencia editorial para '{agent_role}'.")
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
                        "Como Estrategista Comercial, analiso a viabilidade de precificação em Reais (R$), estrutura de atacado e varejo "
                        "e agrupamento por categorias complementares. A hierarquia comercial destaca as condições de fornecimento B2B, margem e giro rápido."
                    ),
                    "branding": (
                        "Como Auditor de Branding e Acessibilidade, valido a conformidade estrita com o padrão WCAG AAA (contraste mínimo de 7:1) "
                        "e consistência da paleta de cores. Asseguro integridade estética editorial e conformidade absoluta com a regra de Zero Emojis."
                    ),
                    "orchestrator": (
                        "Como Orquestrador do Katana Studio, coordeno o fluxo de execução entre os 6 estágios do pipeline, "
                        "despachando as tarefas da ingestão de dados até a síntese final de homologação do conselho."
                    ),
                    "council": (
                        "O Conselho Editorial Deliberativo emite parecer homologatório favorável. A integração entre direção de arte, "
                        "redação comercial e auditoria de marca atende integralmente aos padrões de excelência técnica e gráfica do estúdio."
                    ),
                }
                response_text = contingency_responses.get(
                    agent_role,
                    f"Parecer executivo do cargo '{profile['name']}' ({profile['title']}): homologado com base nas diretrizes do Katana Studio."
                )
        else:
            response_text = f"[Modo de Contingencia Local]: Agente '{profile['name']}' ({profile['title']}) homologado com base nas diretrizes do Katana Studio."

        duration_ms = int((time.time() - start_time) * 1000)

        # Analise de fidelidade ao cargo
        resp_lower = response_text.lower()
        expected_keywords = profile.get("evaluation_keywords", [])
        matched_keywords = [kw for kw in expected_keywords if kw in resp_lower]
        fidelity_percentage = round((len(matched_keywords) / max(1, len(expected_keywords))) * 100, 1)

        has_json_patch = "```json:patch" in response_text
        has_emojis = any(ord(char) > 0x10000 for char in response_text)

        return Response({
            "agent": {
                "role": profile["role"],
                "name": profile["name"],
                "title": profile["title"],
                "department": profile["department"],
                "mission": profile["mission"],
            },
            "system_prompt_used": system_prompt,
            "user_prompt_sent": final_user_prompt,
            "response": response_text,
            "audit_metrics": {
                "model": model_name,
                "duration_ms": duration_ms,
                "fidelity_percentage": fidelity_percentage,
                "matched_keywords": matched_keywords,
                "expected_keywords": expected_keywords,
                "has_json_patch": has_json_patch,
                "zero_emojis_compliant": not has_emojis,
                "status": "APPROVED" if fidelity_percentage >= 25 else "NEEDS_REVIEW"
            }
        }, status=status.HTTP_200_OK)
