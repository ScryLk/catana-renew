import os
import time
import logging
import re
import json
from typing import Iterator, Dict, Any, Optional, List
from django.conf import settings

logger = logging.getLogger(__name__)

class AIResponseChunk:
    def __init__(self, text: str = "", done: bool = False, usage: Optional[Dict[str, int]] = None, metadata: Optional[Dict[str, Any]] = None):
        self.text = text
        self.done = done
        self.usage = usage or {}
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "done": self.done,
            "usage": self.usage,
            "metadata": self.metadata,
        }


class MockGeminiProvider:
    """
    Provedor simulado inteligente para desenvolvimento e testes sem necessidade de chave de API.
    Produz respostas ricas e contextualizadas com fluxo streaming simulado.
    """

    def generate_stream(
        self,
        prompt: str,
        system_instruction: str = "",
        agent_role: str = "orchestrator",
        history: Optional[List[Dict[str, str]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Iterator[AIResponseChunk]:
        logger.info(f"[MockGeminiProvider] Gerando stream para agente: {agent_role}")
        
        # Gera texto contextualizado de acordo com o papel do agente
        response_text = self._build_mock_response(agent_role, prompt, attachments, context)
        
        # Simula streaming por palavras/blocos com leve intervalo
        tokens = response_text.split(" ")
        prompt_token_count = max(10, len(prompt.split()) + len(system_instruction.split()) // 4)
        completion_token_count = len(tokens)
        
        accumulated = []
        for i, token in enumerate(tokens):
            chunk_text = token + (" " if i < len(tokens) - 1 else "")
            accumulated.append(chunk_text)
            yield AIResponseChunk(text=chunk_text, done=False)
            time.sleep(0.015)
            
        yield AIResponseChunk(
            text="",
            done=True,
            usage={
                "prompt_tokens": prompt_token_count,
                "completion_tokens": completion_token_count,
                "total_tokens": prompt_token_count + completion_token_count,
            },
            metadata={
                "provider": "mock",
                "agent_role": agent_role,
            }
        )

    def _build_mock_response(
        self,
        agent_role: str,
        prompt: str,
        attachments: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        brand = (context or {}).get("brand_name", "Marca Exemplo")
        catalog_title = (context or {}).get("catalog_title", "Catálogo Comercial")
        
        has_files = bool(attachments and len(attachments) > 0)
        file_summary = ""
        if has_files:
            file_names = ", ".join([a.get("name", "arquivo") for a in attachments])
            file_summary = f"\n\nArquivos analisados com sucesso: {file_names}."

        # Extrai a mensagem real do usuário caso venha empacotada com contexto
        clean_user_prompt = prompt
        if "Solicitacao do Usuario:" in prompt:
            clean_user_prompt = prompt.split("Solicitacao do Usuario:", 1)[1].strip()
        elif "Solicitação do Usuário:" in prompt:
            clean_user_prompt = prompt.split("Solicitação do Usuário:", 1)[1].strip()

        lower = clean_user_prompt.lower()

        # Detecção de Ações Funcionais (para garantir execução mesmo em modo fallback)
        actions = []
        delegations = []
        summary_parts = []

        # 1. Remoção de produto
        if any(k in lower for k in ["retire", "remover", "remova", "tire", "apague", "limpar"]):
            pg_match = re.search(r"p[aá]gina\s*(\d+)", lower)
            rm_page = int(pg_match.group(1)) if pg_match else 3
            actions.append({
                "action": "remove_product",
                "type": "remove_product",
                "target": f"page:{rm_page}",
                "page": rm_page,
                "params": {"slotIndex": 0, "returnToDrawer": True}
            })
            summary_parts.append(f"Remoção de produto da Página {rm_page}")
            delegations.append({
                "role": "director",
                "action": f"Liberou o slot da Página {rm_page} preservando o respiro de 96px."
            })

        # 2. Mudança de Layout
        if any(k in lower for k in ["layout", "transforme", "converta", "mude"]):
            lo_match = re.search(r"p[aá]gina\s*(\d+)", lower)
            lo_page = int(lo_match.group(1)) if lo_match else 4
            target_layout = "duo"
            if "grid" in lower or "grade" in lower:
                target_layout = "grid_4"
            elif "hero" in lower:
                target_layout = "hero"
            elif "single" in lower:
                target_layout = "single"
            elif "manifesto" in lower:
                target_layout = "manifesto"
            elif "duo" in lower:
                target_layout = "duo"

            actions.append({
                "action": "change_layout",
                "type": "change_layout",
                "target": f"page:{lo_page}",
                "page": lo_page,
                "layout": target_layout,
                "params": {"type": target_layout, "layout": target_layout}
            })
            summary_parts.append(f"Conversão da Página {lo_page} para layout {target_layout}")
            delegations.append({
                "role": "director",
                "action": f"Reconfigurou a Página {lo_page} para o template {target_layout.upper()}."
            })

        # 3. Reajuste de Preços
        if any(k in lower for k in ["preço", "preco", "preços", "precos", "aumente", "reajuste", "desconto"]):
            pct_match = re.search(r"(\d+)\s*%", lower)
            pct = int(pct_match.group(1)) if pct_match else 10
            is_discount = any(k in lower for k in ["desconto", "reduza", "diminua"])
            actions.append({
                "action": "adjust_pricing",
                "type": "adjust_pricing",
                "target": "global",
                "percentage": -pct if is_discount else pct,
                "params": {
                    "mode": "percentage",
                    "percentage": -pct if is_discount else pct,
                    "amount": -pct if is_discount else pct
                }
            })
            summary_parts.append(f"Reajuste de {pct}% nos preços")
            delegations.append({
                "role": "commercial",
                "action": f"Aplicou calibragem de {pct}% na matriz de preços e markups comerciais."
            })

        # Se identificou ações operacionais a executar no canvas
        if actions:
            delegations.append({
                "role": "branding",
                "action": "Validou consistência geométrica, alinhamentos e contraste sob WCAG AA."
            })
            delegations.append({
                "role": "copywriter",
                "action": "Harmonizou a hierarquia de claims e descrições sensoriais."
            })

            patch_obj = {
                "spread_index": 1,
                "actions": actions,
                "summary": ", ".join(summary_parts) + ".",
                "delegations": delegations
            }

            patch_json = json.dumps(patch_obj, ensure_ascii=False, indent=2)

            return (
                f"### Relatório Editorial Executivo\n\n"
                f"Como Editor-Chefe e Orquestrador Central do Katana Studio, confirmo o recebimento e a execução técnica "
                f"das modificações solicitadas pelo usuário com o respaldo do Conselho Editorial:\n\n"
                + "\n".join([f"• **{d['role'].title()}**: {d['action']}" for d in delegations]) +
                f"\n\nAs pranchetas do catálogo foram sincronizadas e os parâmetros operacionais foram atualizados.{file_summary}\n\n"
                f"```json:patch\n{patch_json}\n```"
            )

        if agent_role == "director":
            return (
                f"Análise de Direção de Arte para {catalog_title} ({brand}):\n\n"
                f"1. Hierarquia e Grid Visual: Para a página dupla (A4 794x1123 px), recomendo organizar "
                f"o spread com uma área nobre de 60% na página esquerda para imagem heroica de impacto, "
                f"e a página direita estruturada em grid modular de 2x3 para exposição limpa dos produtos.\n"
                f"2. Paleta Editorial: Mantendo o padrão clean com tipografia refinada, contraste equilibrado "
                f"entre espaços em branco e blocos de conteúdo.\n"
                f"3. Elementos Sugeridos: Banner institucional superior, bloco de destaque do produto principal "
                f"e tabela de variações com margens de segurança de 32px.{file_summary}\n\n"
                f"Deseja que eu aplique este layout estrutural diretamente nas páginas do catálogo?"
            )
        elif agent_role == "copywriter":
            return (
                f"Proposta de Redação Publicitária para {catalog_title}:\n\n"
                f"Título de Abertura: 'Elegância e Precisão em Cada Detalhe.'\n"
                f"Subtítulo: Desenvolvido para superar as expectativas mais rigorosas do mercado corporativo.\n\n"
                f"Texto de Apoio:\n"
                f"Apresentamos uma coleção concebida sob o equilíbrio exato entre funcionalidade e design atemporal. "
                f"Cada peça reflete processos fabris refinados, materiais nobres e acabamento impecável, garantindo "
                f"posicionamento exclusivo e alto valor percebido aos seus clientes.\n\n"
                f"Chamadas em Destaque (Call to Action):\n"
                f"- 'Solicite agora a grade completa para distribuição B2B.'\n"
                f"- 'Disponibilidade imediata para pronta-entrega.'{file_summary}\n\n"
                f"Podemos consolidar estas redações nos blocos de texto da sua página?"
            )
        elif agent_role == "commercial":
            return (
                f"Estruturação da Tabela Comercial e Dados B2B para {catalog_title}:\n\n"
                f"Tabela de Itens e Escala de Preços Sugerida:\n"
                f"| Código (SKU) | Descrição Técnica | Qtd Mínima | Preço Unitário (R$) | Preço Atacado (R$) |\n"
                f"|---|---|---|---|---|\n"
                f"| CT-101 | Modelo Master Premium A4 | 10 un | R$ 189,90 | R$ 142,50 |\n"
                f"| CT-102 | Edição Executiva Prime | 20 un | R$ 249,00 | R$ 186,75 |\n"
                f"| CT-103 | Pack Distribuição Corporativa | 50 un | R$ 129,50 | R$ 97,00 |\n\n"
                f"Condições Comerciais:\n"
                f"- Faturamento: 28/42 dias via boleto bancário.\n"
                f"- Frete: CIF para capitais nas compras acima do pedido mínimo.{file_summary}\n\n"
                f"Deseja importar estes dados em formato tabular na página direita do seu catálogo?"
            )
        elif agent_role == "branding":
            return (
                f"Auditoria de Branding e Conformidade Visual:\n\n"
                f"Diagnóstico da Identidade da Marca '{brand}':\n"
                f"1. Consistência de Voz: A linguagem respeita o tom institucional e corporativo, sem excessos ou jargões descartáveis.\n"
                f"2. Integridade Tipográfica: A combinação de famílias sem serifa para rótulos e serifa para editoriais garante alta legibilidade.\n"
                f"3. Respeito ao Respiro e Zonas de Proteção: O logotipo principal deve manter o espaçamento mínimo equivalente a 1/2 de sua altura nas bordas do A4.\n"
                f"4. Aderência às Diretrizes: Aprovado para continuidade no fluxo de publicação.{file_summary}\n\n"
                f"Recomendo avançar com o fechamento do spread."
            )
        elif agent_role == "council":
            return (
                f"Parecer Executivo do Conselho Editorial (Mesa Redonda):\n\n"
                f"Avaliamos o projeto '{catalog_title}' sob as quatro perspectivas de especialistas:\n\n"
                f"1. Direção de Arte: Layout harmônico e pronto para distribuição digital e impressa em proporção A4.\n"
                f"2. Redação Comercial: Mensagem clara, persuasiva e com forte apelo de valor B2B.\n"
                f"3. Tabela de Vendas: Grade técnica organizada com codificação SKU e preços transparentes.\n"
                f"4. Auditoria de Marca: Fidelidade estética confirmada, transmitindo solidez e credibilidade.{file_summary}\n\n"
                f"Conclusão do Conselho: O material atinge grau profissional de excelência e está pronto para validação final."
            )
        else: # orchestrator / default
            return (
                f"Olá! Sou o Editor-Chefe do Katana Studio. Recebi sua solicitação: '{clean_user_prompt}'.\n\n"
                f"Para este catálogo de '{brand}', organizei a equipe de especialistas nos seguintes eixos:\n"
                f"1. Direção de Arte: Configuração da grade visual e harmonia das páginas duplas.\n"
                f"2. Redação Publicitária: Desenvolvimento de textos de alto impacto comercial.\n"
                f"3. Tabela Comercial: Inclusão de dados de produtos, códigos e condições de venda.\n"
                f"4. Auditoria de Branding: Validação de consistência de marca e padrão visual.{file_summary}\n\n"
                f"Como prefere começar? Posso sugerir a primeira página dupla ou detalhar a grade de produtos."
            )


class GeminiAIProvider:
    """
    Provedor principal integrado a API Google Gemini (GenAI SDK).
    Alterna automaticamente para o MockProvider caso a GEMINI_API_KEY nao esteja configurada.
    """

    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")
        self.default_model = default_model or getattr(settings, "AI_DEFAULT_MODEL", "gemini-flash-latest")
        self.mock_provider = MockGeminiProvider()
        self.client = None

        if self.api_key and self.api_key.strip() and self.api_key != "SUA_API_KEY_AQUI":
            try:
                from google import genai
                from google.genai import types
                http_opts = types.HttpOptions(
                    timeout=12000,
                    retry_options=types.HttpRetryOptions(attempts=1),
                )
                self.client = genai.Client(api_key=self.api_key.strip(), http_options=http_opts)
                logger.info(f"GeminiAIProvider inicializado com sucesso (modelo: {self.default_model}).")
            except Exception as exc:
                logger.warning(f"Nao foi possivel inicializar cliente Gemini: {exc}. Usando fallback mock.")
                self.client = None
        else:
            logger.info("GEMINI_API_KEY nao fornecida. Operando em modo Mock inteligente.")

    @property
    def is_mock(self) -> bool:
        return self.client is None

    def generate_stream(
        self,
        prompt: str,
        system_instruction: str = "",
        agent_role: str = "orchestrator",
        history: Optional[List[Dict[str, str]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Iterator[AIResponseChunk]:
        """
        Executa a chamada streaming. Se o cliente real estiver disponivel, consome do Gemini;
        caso contrario, entrega a resposta estruturada do MockGeminiProvider.
        """
        # Verificacao de Seguranca e Protecao de Prompts (Katana Guard)
        from api.ai.guardrails import KatanaGuardrailEngine
        guard_result = KatanaGuardrailEngine.inspect_prompt(prompt, agent_role=agent_role)
        if not guard_result.is_safe:
            logger.warning(
                f"[GeminiAIProvider] Prompt bloqueado por seguranca ({guard_result.threat_category}): "
                f"{guard_result.threat_detail}"
            )
            refusal_text = guard_result.refusal_response or (
                "Esta solicitacao viola as diretrizes de seguranca e conformidade do Katana Studio. "
                "Por favor, formule uma demanda voltada ao catalogo de produtos."
            )
            yield AIResponseChunk(text=refusal_text, done=False)
            yield AIResponseChunk(
                text="",
                done=True,
                usage={"prompt_tokens": 10, "completion_tokens": len(refusal_text.split()), "total_tokens": 20},
                metadata={
                    "provider": "katana-guard",
                    "guardrail_status": "BLOCKED",
                    "threat_category": guard_result.threat_category,
                    "threat_detail": guard_result.threat_detail,
                    "risk_score": guard_result.risk_score,
                }
            )
            return

        if self.is_mock:
            yield from self.mock_provider.generate_stream(
                prompt=prompt,
                system_instruction=system_instruction,
                agent_role=agent_role,
                history=history,
                attachments=attachments,
                context=context,
            )
            return

        # Chamada real ao Gemini SDK
        try:
            from google.genai import types

            # Constrói o conteúdo contextual
            contents = []
            if history:
                for msg in history:
                    role = "user" if msg.get("role") in ["user", "human"] else "model"
                    contents.append(
                        types.Content(
                            role=role,
                            parts=[types.Part.from_text(text=msg.get("content", ""))]
                        )
                    )

            # Informações de contexto e anexos anexadas ao prompt final
            full_prompt = prompt
            if attachments:
                attachment_info = "\n\n[ANEXOS PROCESSADOS]:\n"
                for att in attachments:
                    att_name = att.get("name", "arquivo")
                    att_text = att.get("extracted_text", "")
                    if att_text:
                        attachment_info += f"- Arquivo: {att_name}\nConteudo extraido:\n{att_text[:3000]}\n"
                    else:
                        attachment_info += f"- Arquivo: {att_name}\n"
                full_prompt += attachment_info

            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=full_prompt)]
                )
            )

            safety_settings = [
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                    threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_HARASSMENT,
                    threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                    threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                ),
                types.SafetySetting(
                    category=types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                    threshold=types.HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
                ),
            ]

            config = types.GenerateContentConfig(
                system_instruction=system_instruction or "Voce e um assistente profissional do Catana Studio especializado na criacao e edicao de catalogos de produtos.",
                temperature=0.7,
                safety_settings=safety_settings,
            )

            # Lista de modelos candidatos em ordem de prioridade com rodízio inteligente
            candidate_models = [
                self.default_model or "gemini-flash-latest",
                "gemini-flash-latest",
                "gemini-flash-lite-latest",
                "gemini-2.5-flash",
                "gemini-3-flash-preview",
            ]
            ordered_models = []
            for m in candidate_models:
                if m and m not in ordered_models:
                    ordered_models.append(m)

            success = False
            last_exc = None

            for current_model in ordered_models:
                try:
                    response_stream = self.client.models.generate_content_stream(
                        model=current_model,
                        contents=contents,
                        config=config,
                    )

                    total_prompt_tokens = 0
                    total_completion_tokens = 0

                    for chunk in response_stream:
                        if chunk.text:
                            clean_chunk = KatanaGuardrailEngine.sanitize_output(chunk.text)
                            if clean_chunk:
                                yield AIResponseChunk(text=clean_chunk, done=False)

                        # Se metadados de tokens estiverem disponiveis no chunk
                        if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                            total_prompt_tokens = getattr(chunk.usage_metadata, "prompt_token_count", total_prompt_tokens)
                            total_completion_tokens = getattr(chunk.usage_metadata, "candidates_token_count", total_completion_tokens)

                    # Fallback de contagem aproximada se a API nao retornar metadata
                    if total_prompt_tokens == 0:
                        total_prompt_tokens = max(10, len(full_prompt.split()) + len(system_instruction.split()) // 4)
                    if total_completion_tokens == 0:
                        total_completion_tokens = 150

                    yield AIResponseChunk(
                        text="",
                        done=True,
                        usage={
                            "prompt_tokens": total_prompt_tokens,
                            "completion_tokens": total_completion_tokens,
                            "total_tokens": total_prompt_tokens + total_completion_tokens,
                        },
                        metadata={
                            "provider": "google-gemini",
                            "model": current_model,
                            "agent_role": agent_role,
                        }
                    )
                    success = True
                    break
                except Exception as model_err:
                    last_exc = model_err
                    logger.warning(
                        f"[GeminiAIProvider] Modelo '{current_model}' falhou ({model_err}). "
                        "Tentando próximo modelo candidato..."
                    )

            if not success:
                logger.error(f"Todos os modelos Gemini falharam. Último erro: {last_exc}. Alternando para fallback mock.")
                # Fallback seguro caso ocorra erro em tempo de execucao (ex: chave revogada, limite da Google atingido)
                yield from self.mock_provider.generate_stream(
                    prompt=prompt,
                    system_instruction=system_instruction,
                    agent_role=agent_role,
                    history=history,
                    attachments=attachments,
                    context=context,
                )
        except Exception as e:
            logger.error(f"[GeminiAIProvider] Falha geral na chamada Gemini: {e}. Alternando para mock.")
            yield from self.mock_provider.generate_stream(
                prompt=prompt,
                system_instruction=system_instruction,
                agent_role=agent_role,
                history=history,
                attachments=attachments,
                context=context,
            )


# Instancia singleton para uso facil nos agentes
_provider_instance: Optional[GeminiAIProvider] = None

def get_ai_provider() -> GeminiAIProvider:
    global _provider_instance
    if _provider_instance is None:
        _provider_instance = GeminiAIProvider()
    return _provider_instance
