import re
import logging
from typing import Dict, Any, Optional, List, Tuple
from api.ai.agents.base import BaseAgent
from api.ai.guardrails import KatanaGuardrailEngine, ThreatCategory

logger = logging.getLogger(__name__)

class OrchestratorAgent(BaseAgent):
    """
    Editor-Chefe / Orquestrador Central.
    Atua como o Gateway de Requisicao Unica do Katana Studio:
    1. Analisa, formata e higieniza os prompts dos usuarios antes do envio aos especialistas.
    2. Neutraliza termos ofensivos e ruidos desconexos preservando a intencao comercial real.
    3. Bloqueia ataques irrecuperaveis (jailbreaks puros, armas, vazamento de credenciais).
    4. Encaminha diretrizes claras, tecnicas e alinhadas aos especialistas do conselho.
    """
    role = "orchestrator"
    name = "Editor-Chefe"
    description = "Coordenacao geral do catalogo, fluxo de criacao e sintese editorial"

    def get_system_prompt(self, context: Optional[Dict[str, Any]] = None) -> str:
        return (
            "Voce e o Editor-Chefe e Orquestrador Central do Katana Studio 2.0, responsavel pela coordenacao "
            "estrategica, direcao criativa e execucao operacional de catalogos corporativos, B2B e de alta costura.\n\n"
            "Sua missao e coordenar o Conselho Editorial composto por quatro especialistas tecnicos:\n"
            "1. Diretor de Arte: Proporcoes A4 (794x1123 px), respiro negativo de 96px, ritmo visual e hierarquia tipografica.\n"
            "2. Redator Publicitario: Headlines de impacto, narrativa sensorial de valor, manifestos e descricoes persuasivas.\n"
            "3. Tabela Comercial / B2B: Estrutura de precos em Reais (R$), condicoes de atacado, markups, codigos SKU e pedidos minimos (MOQ).\n"
            "4. Auditor de Branding: Conformidade com o Brand Lock, contraste cromático WCAG AA/AAA e margens de monograma.\n\n"
            "DIRETRIZES DE COMUNICACAO E CONDUTA:\n"
            "- Responda sempre em Portugues do Brasil com precisao profissional, objetividade e elegancia editorial.\n"
            "- Regra Estrita: Nao utilize nenhum emoji sob qualquer hipotese em suas mensagens, respostas ou blocos de codigo.\n"
            "- Formato da Resposta:\n"
            "  1. Acao Realizada (Texto Principal): Escreva estritamente em UMA frase concisa e direta apenas a ACAO EXECUTADA na prancheta (ex: 'Segunda página removida e diagramação reorganizada pelo Conselho Editorial.'). NUNCA escreva relatórios longos ou listas enumeradas de agentes no texto principal.\n"
            "  2. Pareceres dos Especialistas: O parecer detalhado de cada especialista (Diretor de Arte, Redator, Comercial, Branding) DEVE estar obrigatoriamente no array 'delegations' do bloco ```json:patch.\n\n"
            "PROTOCOLO OBRIGATORIO DE MODIFICACAO DO CANVAS (JSON DELTA PATCH):\n"
            "Toda solicitacao que demandar adicao, remocao, troca de produto, alteracao de preco, mudanca de layout, geracao de SKU, "
            "edicao de texto, remocao de fundo, fotografia com IA ou governanca de marca DEVE ser finalizada com um bloco delimitado estritamente por ```json:patch e ```.\n\n"
            "ESTRUTURA FORMAL DO BLOCO:\n"
            "```json:patch\n"
            "{\n"
            "  \"spread_index\": <indice_zero_based_da_lamina_afetada>,\n"
            "  \"actions\": [\n"
            "    {\n"
            "      \"action\": \"add_page\" | \"remove_page\" | \"reconfigure_catalog\" | \"summarize_content\" | \"remove_product\" | \"assign_product\" | \"swap_product\" | \"create_product\" | \"change_layout\" | \"update_text\" | \"set_page_color\" | \"adjust_pricing\" | \"generate_skus\" | \"set_palette\" | \"brand_lock\" | \"remove_background\" | \"generate_photo\" | \"navigate\" | \"export_pdf\" | \"add_overlay\" | \"highlight_product\" | \"remove_overlay\" | \"clear_overlays\" | \"update_overlay\" | \"mutate_layout\" | \"regenerate_composition\" | \"increase_creativity\" | \"decrease_creativity\" | \"change_visual_direction\",\n"
            "      \"target\": \"page:<numero>\" | \"product:<id>\" | \"catalog:theme\" | \"catalog:products\" | \"global\",\n"
            "      \"params\": { <parametros_da_acao> }\n"
            "    }\n"
            "  ],\n"
            "  \"summary\": \"<resumo conciso da mutacao para exibicao na tela>\",\n"
            "  \"delegations\": [\n"
            "    {\"role\": \"director\", \"action\": \"<contribuicao do Diretor de Arte>\"},\n"
            "    {\"role\": \"commercial\", \"action\": \"<contribuicao da Tabela Comercial>\"},\n"
            "    {\"role\": \"branding\", \"action\": \"<contribuicao do Auditor de Branding>\"},\n"
            "    {\"role\": \"copywriter\", \"action\": \"<contribuicao do Redator Publicitario>\"}\n"
            "  ]\n"
            "}\n"
            "```\n\n"
            "EXEMPLOS NORMATIVOS:\n"
            "- Reconfigurar catálogo / definir total de páginas: action 'reconfigure_catalog', target 'global', params {'totalPages': 1 | 2 | 4 | 6, 'title': '...'}\n"
            "- Adicionar página: action 'add_page', target 'catalog:pages', params {'type': 'hero' | 'manifesto' | 'duo' | 'grid_4', 'afterPage': 2}\n"
            "- Remover página: action 'remove_page', target 'page:2'\n"
            "- Resumir conteúdo: action 'summarize_content', target 'page:2', params {'condensedText': '...'}\n"
            "- Remover produto: action 'remove_product', target 'page:3', params {'slotIndex': 0, 'returnToDrawer': true}\n"
            "- Alocar produto: action 'assign_product', target 'page:4', params {'slotIndex': 0, 'productQuery': 'Bolsa Verona'}\n"
            "- Cadastrar produto: action 'create_product', target 'catalog:products', params {'title': '...', 'price': 'R$ ...', 'category': '...'}\n"
            "- Mudar layout: action 'change_layout', target 'page:5', params {'type': 'grid_4' | 'hero' | 'duo' | 'manifesto' | 'divider'}\n"
            "- Reajustar precos: action 'adjust_pricing', target 'global', params {'mode': 'percentage', 'amount': 15}\n"
            "- Gerar SKUs: action 'generate_skus', target 'catalog:products', params {'prefix': 'ART-', 'format': '000'}\n"
            "- Editar texto: action 'update_text', target 'page:2', params {'quote': '...', 'title': '...', 'content': '...'}\n"
            "- Alterar cor da página / capa: action 'set_page_color', target 'page:1', params {'backgroundColor': '#000000'}\n"
            "- Remover fundo: action 'remove_background', target 'page:4', params {'slotIndex': 0}\n"
            "- Paleta e Trava: action 'set_palette' com 'brand_lock', params {'paletteName': 'Slate & Noir Minimaliste', 'locked': true}\n"
            "- Exportar PDF: action 'export_pdf', target 'global'\n"
            "- Adicionar particulas e estrelas no fundo escuro / capa cosmica: action 'add_overlay', target 'page:1', params {'type': 'stars', 'color': '#FFFFFF', 'density': 'high'}\n"
            "- Adicionar confetes de festa: action 'add_overlay', target 'page:1', params {'type': 'confetti', 'subType': 'festive_confetti', 'density': 'high'}\n"
            "- Destacar produto com circulo: action 'highlight_product', target 'page:3', params {'slotIndex': 0, 'style': 'hand_drawn_circle', 'color': '#B08D57'}\n"
            "- Inserir seta geometrica com callout: action 'add_overlay', target 'page:4', params {'type': 'arrow', 'subType': 'callout_arrow', 'targetSlotIndex': 1, 'text': 'Mais Vendido', 'arrowDirection': 'to_bottom_right'}\n"
            "- Adicionar selo promocional / desconto: action 'add_overlay', target 'page:2', params {'type': 'badge', 'subType': 'discount_badge', 'text': '20% OFF', 'x': 80, 'y': 15}\n"
            "- Adicionar carimbo editorial: action 'add_overlay', target 'page:1', params {'type': 'stamp', 'text': 'Edicao Limitada', 'subText': 'Katana Atelier'}\n"
            "- Inserir forma geometrica ou estrela: action 'add_overlay', target 'page:2', params {'type': 'shape', 'subType': 'star', 'x': 50, 'y': 50, 'color': '#D4AF37'}\n"
            "- Remover overlays / limpar: action 'remove_overlay', target 'page:1', params {'type': 'confetti'} ou action 'clear_overlays', target 'page:1'\n\n"
            "REGRA DE FIDELIDADE VISUAL PARA AGENTES:\n"
            "- Quando a solicitacao referir-se a estrelas estaticas, ceu estrelado, cosmos, poeira cosmica ou particulas de fundo em pagina preta/escura, defina estritamente params {'type': 'stars', 'color': '#FFFFFF'}. Nao emita confetes de festa coloridos para demandas estelares.\n"
            "- Quando a solicitacao referir-se a festa, comemoracao, aniversario ou carnaval, utilize params {'type': 'confetti', 'subType': 'festive_confetti'}."
        )

    def detect_target_role(self, prompt: str) -> str:
        """
        Deduze o especialista mais indicado para a demanda caso nao informado.
        """
        p_lower = prompt.lower()
        if any(k in p_lower for k in [
            "layout", "diagrama", "grid", "respiro", "a4", "visual", "foto", "imagem", "cor", "paleta", "tipografia",
            "confete", "festa", "circulo", "circul", "seta", "estrela", "forma", "geometric", "carimbo", "overlay", "decorac",
            "particula"
        ]):
            return "director"
        if any(k in p_lower for k in ["texto", "copy", "headline", "narrativa", "storytelling", "sensorial", "descricao", "descri"]):
            return "copywriter"
        if any(k in p_lower for k in ["preco", "preço", "tabela", "sku", "moq", "desconto", "custo", "b2b", "condic", "selo", "badge", "promoc"]):
            return "commercial"
        if any(k in p_lower for k in ["marca", "branding", "logo", "identidade", "manual", "conformidade", "proibic"]):
            return "branding"
        return "orchestrator"

    def format_and_guard_request(
        self,
        user_prompt: str,
        target_role: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Gateway Unico de Entrada:
        Inspeciona o prompt do usuario e formata caso contenha palavras ofensivas,
        ruidos ou informalidades, preservando a demanda real do catalogo.
        """
        raw_text = (user_prompt or "").strip()
        effective_role = target_role or self.detect_target_role(raw_text)

        # 0. Parser de Requisitos e Restrições Estruturadas (P0 - P8)
        from api.ai.requirement_parser import RequirementParser
        contract = RequirementParser.parse(raw_text)

        # 1. Inspecao padrao de seguranca
        guard_result = KatanaGuardrailEngine.inspect_prompt(raw_text, agent_role=effective_role)

        # Se o prompt ja e homologado como seguro
        if guard_result.is_safe:
            return {
                "is_safe": True,
                "status": "PASSED",
                "original_prompt": raw_text,
                "formatted_prompt": raw_text,
                "was_reformatted": False,
                "reformatting_actions": [],
                "orchestrator_notes": "Prompt em conformidade com as diretrizes do conselho editorial.",
                "target_role": effective_role,
                "requirement_contract": contract.to_dict(),
                "hard_constraints": contract.constraints.hard,
                "negative_constraints": contract.constraints.negative,
            }

        # 2. Se falhou na inspecao, avalia se ha intencao genuina de catalogo recuperavel
        has_intent, clean_text, actions = KatanaGuardrailEngine.sanitize_and_extract_intent(raw_text)

        if has_intent and clean_text:
            # Reformata o prompt para um padrao editorial nobre e polido
            formatted_prompt = self._reformat_to_editorial_directive(clean_text, effective_role)
            actions.append("ALIGNED_TO_CATALOG_CONTEXT")

            logger.info(
                f"[OrchestratorGateway] Prompt reformatado com sucesso: '{raw_text[:60]}...' -> '{formatted_prompt[:60]}...'"
            )

            return {
                "is_safe": True,
                "status": "NORMALIZED",
                "original_prompt": raw_text,
                "formatted_prompt": formatted_prompt,
                "was_reformatted": True,
                "reformatting_actions": actions,
                "orchestrator_notes": (
                    "O Editor-Chefe neutralizou termos ofensivos e ruidos da solicitacao, "
                    f"reformatando a demanda em diretrizes tecnicas e polidas para o {effective_role}."
                ),
                "target_role": effective_role,
                "threat_category": guard_result.threat_category,
                "threat_detail": guard_result.threat_detail,
            }

        # 3. Solicitacao irrecuperavel (ataque deliberado de jailbreak, armas ou ofensa pura)
        logger.warning(
            f"[OrchestratorGateway] Requisicao bloqueada por ameaca nao recuperavel: {guard_result.threat_category}"
        )
        return {
            "is_safe": False,
            "status": "BLOCKED",
            "original_prompt": raw_text,
            "formatted_prompt": raw_text,
            "was_reformatted": False,
            "reformatting_actions": ["BLOCKED_BY_SECURITY"],
            "orchestrator_notes": (
                f"Solicitacao bloqueada pela barreira de seguranca ({guard_result.threat_category}). "
                "Conteudo deliberadamente desconexo ou violador das diretrizes corporativas."
            ),
            "target_role": effective_role,
            "refusal_response": guard_result.refusal_response,
            "threat_category": guard_result.threat_category,
            "threat_detail": guard_result.threat_detail,
            "risk_score": guard_result.risk_score,
        }

    def _reformat_to_editorial_directive(self, text: str, role: str) -> str:
        """
        Converte o texto higienizado em uma diretriz executiva formal para o especialista.
        """
        # Remove pontuacoes desnecessarias, saudações e frases de preenchimento
        t = re.sub(r'^(por favor|pfv|ei|ola|olá|me ajuda a|ajuda a|quero que você|preciso que você|tanto faz[,\.\s]*|deixa disso[,\.\s]*)\s*', '', text, flags=re.IGNORECASE).strip()

        # Normalizacao de termos coloquiais frequentes
        t = re.sub(r'\b(folha|folhinha|l[aâ]mina|prancha|prancheta)\b', 'pagina', t, flags=re.IGNORECASE)
        t = re.sub(r'\b(pagna|pagnia|pajina)\b', 'pagina', t, flags=re.IGNORECASE)
        t = re.sub(r'\b(preso|precos)\b', 'preco', t, flags=re.IGNORECASE)
        t = re.sub(r'\b(pintura|tinta)\b', 'paleta', t, flags=re.IGNORECASE)
        t = re.sub(r'\b(conto|pau)\b', 'reais', t, flags=re.IGNORECASE)

        # Substitui verbos informais de comando e dialetos regionais
        t = re.sub(r'^(tira|tirar|arranca|arrancar|apaga|apagar|limpa|limpar)\s+', 'Remover da prancheta ', t, flags=re.IGNORECASE)
        t = re.sub(r'^(bota|botar|taca|tacar|mete|meter|poe|põe|coloca|colocar)\s+', 'Organizar na prancheta ', t, flags=re.IGNORECASE)
        t = re.sub(r'(?:^|[,\.]\s*)(circul(ar|a|e)|fa[cç]a um c[ií]rculo em|faz um c[ií]rculo em)\s+', 'Destacar com anel de foco ', t, flags=re.IGNORECASE)
        t = re.sub(r'(?:^|[,\.]\s*)(apont(ar|a|e)|ponha uma seta em|bota uma seta em|insira uma seta para|insere uma seta para)\s+', 'Inserir seta indicadora para ', t, flags=re.IGNORECASE)
        t = re.sub(r'^(enxuga|enxugar|poda|podar|diminui|diminuir)\s+', 'Sintetizar e resumir ', t, flags=re.IGNORECASE)
        t = re.sub(r'^arrum(ar|a|e)\s+', 'Revisar e aprimorar ', t, flags=re.IGNORECASE)
        t = re.sub(r'^melhor(ar|a|e)\s+', 'Otimizar e refinar ', t, flags=re.IGNORECASE)
        t = re.sub(r'^faz(er)?\s+', 'Estruturar e desenvolver ', t, flags=re.IGNORECASE)
        t = re.sub(r'^mont(ar|a|e)\s+', 'Compor a diagramacao de ', t, flags=re.IGNORECASE)

        if not t:
            t = "Estruturar proposta de composicao editorial para os produtos informados"

        # Adiciona orientacao profissional conforme o especialista
        role_suffixes = {
            "director": " Assegurar proporcoes A4 (794x1123 px), respiro visual adequado e hierarquia tipografica.",
            "copywriter": " Destacar atributos sensoriais, clareza dos diferenciais tecnicos e apelo comercial.",
            "commercial": " Organizar codigos SKU, precos em Reais (R$), pedidos minimos e condicoes de fornecimento.",
            "branding": " Garantir conformidade com as diretrizes de identidade visual e espacamento de seguranca do logotipo.",
        }
        suffix = role_suffixes.get(role, " Garantir qualidade editorial e alinhamento aos padroes Katana Studio.")

        formatted = t[0].upper() + t[1:] if len(t) > 1 else t.upper()
        if not formatted.endswith('.'):
            formatted += '.'

        return f"{formatted}{suffix}"

