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
            "      \"action\": \"remove_page\" | \"remove_product\" | \"assign_product\" | \"swap_product\" | \"create_product\" | \"change_layout\" | \"update_text\" | \"adjust_pricing\" | \"generate_skus\" | \"set_palette\" | \"brand_lock\" | \"remove_background\" | \"generate_photo\" | \"navigate\",\n"
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
            "- Remover página: action 'remove_page', target 'page:2'\n"
            "- Remover produto: action 'remove_product', target 'page:3', params {'slotIndex': 0, 'returnToDrawer': true}\n"
            "- Alocar produto: action 'assign_product', target 'page:4', params {'slotIndex': 0, 'productQuery': 'Bolsa Verona'}\n"
            "- Mudar layout: action 'change_layout', target 'page:5', params {'type': 'grid_4' | 'hero' | 'duo' | 'manifesto' | 'divider'}\n"
            "- Reajustar precos: action 'adjust_pricing', target 'global', params {'mode': 'percentage', 'amount': 15}\n"
            "- Gerar SKUs: action 'generate_skus', target 'catalog:products', params {'prefix': 'ART-', 'format': '000'}\n"
            "- Editar texto: action 'update_text', target 'page:2', params {'quote': '...', 'title': '...', 'content': '...'}\n"
            "- Remover fundo: action 'remove_background', target 'page:4', params {'slotIndex': 0}\n"
            "- Paleta e Trava: action 'set_palette' com 'brand_lock', params {'paletteName': 'Slate & Noir Minimaliste', 'locked': true}"
        )

    def detect_target_role(self, prompt: str) -> str:
        """
        Deduze o especialista mais indicado para a demanda caso nao informado.
        """
        p_lower = prompt.lower()
        if any(k in p_lower for k in ["layout", "diagrama", "grid", "respiro", "a4", "visual", "foto", "imagem", "cor", "paleta", "tipografia"]):
            return "director"
        if any(k in p_lower for k in ["texto", "copy", "headline", "narrativa", "storytelling", "sensorial", "descricao", "descri"]):
            return "copywriter"
        if any(k in p_lower for k in ["preco", "preço", "tabela", "sku", "moq", "desconto", "custo", "b2b", "condic"]):
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

        # Substitui verbos informais de comando
        t = re.sub(r'^arrum(ar|a|e)\s+', 'Revisar e aprimorar ', t, flags=re.IGNORECASE)
        t = re.sub(r'^melhor(ar|a|e)\s+', 'Otimizar e refinar ', t, flags=re.IGNORECASE)
        t = re.sub(r'^faz(er)?\s+', 'Estruturar e desenvolver ', t, flags=re.IGNORECASE)
        t = re.sub(r'^coloc(ar|a|e)\s+', 'Organizar no spread ', t, flags=re.IGNORECASE)
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

