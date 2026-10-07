import os
import time
import logging
import json
from typing import Iterator, Dict, Any, Optional, List
from django.conf import settings

logger = logging.getLogger(__name__)

# Operational operands stay small enough for bounded conversion and JSON output.
# Consume the entire Unicode decimal token before accepting it, never its suffix.
_MAX_NUMERIC_OPERAND_DIGITS = 9
_INVALID_NUMERIC_OPERAND = object()


def _decimal_operand(message, start):
    end = start
    while end < len(message) and message[end].isdecimal():
        end += 1
    if end - start > _MAX_NUMERIC_OPERAND_DIGITS:
        return _INVALID_NUMERIC_OPERAND, end
    return int(message[start:end]), end


def _first_percentage_operand(message):
    """Scan each numeric run/whitespace once; missing '%' cannot cause backtracking."""
    cursor = 0
    while cursor < len(message):
        if not message[cursor].isdecimal():
            cursor += 1
            continue
        value, cursor = _decimal_operand(message, cursor)
        if value is _INVALID_NUMERIC_OPERAND:
            return value
        while cursor < len(message) and message[cursor].isspace():
            cursor += 1
        if cursor < len(message) and message[cursor] == '%':
            return value
    return None


def _first_page_operand(message):
    cursor = 0
    while cursor < len(message):
        if not message.startswith(('pagina', 'página'), cursor):
            cursor += 1
            continue
        cursor += len('pagina')
        while cursor < len(message) and message[cursor].isspace():
            cursor += 1
        if cursor < len(message) and message[cursor].isdecimal():
            value, _ = _decimal_operand(message, cursor)
            return value
    return None


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
        # Extrai a mensagem real do usuário caso venha empacotada com contexto
        clean_user_prompt = prompt
        if "Solicitacao do Usuario:" in prompt:
            clean_user_prompt = prompt.split("Solicitacao do Usuario:", 1)[1].strip()
        elif "Solicitação do Usuário:" in prompt:
            clean_user_prompt = prompt.split("Solicitação do Usuário:", 1)[1].strip()

        if isinstance(context, dict) and 'editable_text_index' in context:
            from api.ai.text_commands import plan_text_replacement, planner_response
            plan = plan_text_replacement(clean_user_prompt, context)
            if plan is not None:
                return planner_response(plan)
        lower = clean_user_prompt.lower()

        remove_requested = any(k in lower for k in ["retire", "remover", "remova", "tire", "apague", "limpar"])
        layout_requested = any(k in lower for k in ["layout", "transforme", "converta", "mude"])
        pricing_requested = any(k in lower for k in ["preço", "preco", "preços", "precos", "aumente", "reajuste", "desconto"])
        page_operand = _first_page_operand(lower) if remove_requested or layout_requested else None
        percentage_operand = _first_percentage_operand(lower) if pricing_requested else None
        if page_operand is _INVALID_NUMERIC_OPERAND or percentage_operand is _INVALID_NUMERIC_OPERAND:
            return "O número informado excede o limite de 9 dígitos. Reenvie a página ou a porcentagem desejada para aplicar a alteração."

        # Detecção de Ações Funcionais (para garantir execução mesmo em modo fallback)
        actions = []

        # 1. Remoção de produto
        if remove_requested:
            rm_page = page_operand if page_operand is not None else 3
            actions.append({
                "action": "remove_product",
                "type": "remove_product",
                "target": f"page:{rm_page}",
                "page": rm_page,
                "params": {"slotIndex": 0, "returnToDrawer": True}
            })

        # 2. Mudança de Layout
        if layout_requested:
            lo_page = page_operand if page_operand is not None else 4
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

        # 3. Reajuste de Preços
        if pricing_requested:
            pct = percentage_operand if percentage_operand is not None else 10
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

        if actions:
            patch_obj = {"actions": actions, "summary": "Proposta operacional para validação na prancheta."}
            return "Proposta do Diretor de Arte / Conselho Editorial; nenhuma execução confirmada.\n```json:patch\n" + json.dumps(patch_obj, ensure_ascii=False) + "\n```"
        return "O provedor simulado está ativo. O Diretor de Arte e os demais especialistas não executaram alterações; esta solicitação requer o provedor de IA disponível ou uma edição manual."


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
                logger.warning(f"Nao foi possivel inicializar cliente Gemini: {type(exc).__name__}. Usando fallback mock.")
                self.client = None
        else:
            logger.info("GEMINI_API_KEY nao fornecida. Operando em modo Mock inteligente.")

    def _mock_stream(self, diagnostics, **kwargs):
        for chunk in self.mock_provider.generate_stream(**kwargs):
            if chunk.done:
                chunk.metadata.update(diagnostics)
                chunk.metadata["mock"] = True
                chunk.metadata["model"] = "mock-operational-planner"
                chunk.metadata["action_planner"] = "mock-operational"
                chunk.metadata["execution_status"] = "proposed"
            yield chunk

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
        envelope=None,
    ) -> Iterator[AIResponseChunk]:
        """
        Executa a chamada streaming. Se o cliente real estiver disponivel, consome do Gemini;
        caso contrario, entrega a resposta estruturada do MockGeminiProvider.
        """
        from api.ai.guardrails import KatanaGuardrailEngine
        from api.ai.agents.orchestrator import OrchestratorAgent
        from api.ai.prompt_envelope import PromptEnvelope, DATA_BOUNDARY_DIRECTIVE
        from api.ai.text_commands import plan_text_replacement, planner_response
        # No caller may supply an approval flag. Every entry path validates literal input.
        if envelope is not None and (not isinstance(envelope, PromptEnvelope) or envelope.current_user != prompt):
            raise ValueError("invalid_prompt_boundary")
        envelope = envelope or PromptEnvelope.build(prompt, context, history, attachments)
        envelope.validate()
        gateway = OrchestratorAgent().format_and_guard_request(envelope.current_user, target_role=agent_role)
        diagnostics = {"user_guard_status": gateway["status"], "context_guard_status": envelope.context_guard_status,
                       "guard_stage": "current_user_gateway", "matched_category": gateway.get("threat_category"),
                       "fallback_used": False}
        if not gateway["is_safe"]:
            yield AIResponseChunk(text=gateway["refusal_response"])
            yield AIResponseChunk(done=True, metadata={**diagnostics, "provider": "katana-guard", "guardrail_status": "BLOCKED"})
            return
        literal_prompt = gateway["formatted_prompt"]
        if gateway["status"] == "NORMALIZED":
            literal_prompt = KatanaGuardrailEngine.sanitize_and_extract_intent(envelope.current_user)[1]
        plan = plan_text_replacement(literal_prompt, context)
        if plan is not None:
            yield AIResponseChunk(text=planner_response(plan))
            yield AIResponseChunk(done=True, metadata={**diagnostics, "provider": "local-command-planner", "model": "deterministic", "planner_status": plan[1]["planner_status"], "resolution_candidates": plan[1].get('candidates', []), "action_planner": "normalized-text-replacement"})
            return
        # Mock receives only literal intent, never serialized customer context.
        prompt = literal_prompt
        history = None
        attachments = None
        system_instruction = (system_instruction or "Voce e um assistente profissional do Catana Studio para criacao e edicao de catalogos.") + KatanaGuardrailEngine.UNIVERSAL_SYSTEM_GUARDRAIL_DIRECTIVE + DATA_BOUNDARY_DIRECTIVE
        if self.is_mock:
            yield from self._mock_stream(diagnostics,
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

            # History and attachments remain quoted DATA in the single request envelope.
            full_prompt = envelope.render(literal_prompt)
            contents = [types.Content(role="user", parts=[types.Part.from_text(text=full_prompt)])]

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

            for current_model in ordered_models:
                try:
                    response_stream = self.client.models.generate_content_stream(
                        model=current_model,
                        contents=contents,
                        config=config,
                    )

                    candidate_text = []
                    total_prompt_tokens = 0
                    total_completion_tokens = 0

                    for chunk in response_stream:
                        if chunk.text:
                            clean_chunk = KatanaGuardrailEngine.sanitize_output(chunk.text)
                            if clean_chunk:
                                candidate_text.append(clean_chunk)

                        # Se metadados de tokens estiverem disponiveis no chunk
                        if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                            total_prompt_tokens = getattr(chunk.usage_metadata, "prompt_token_count", total_prompt_tokens)
                            total_completion_tokens = getattr(chunk.usage_metadata, "candidates_token_count", total_completion_tokens)

                    for clean_chunk in candidate_text:
                        yield AIResponseChunk(text=clean_chunk, done=False)

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
                            **diagnostics,
                            "provider": "google-gemini",
                            "model": current_model,
                            "agent_role": agent_role,
                        }
                    )
                    success = True
                    break
                except Exception as model_err:
                    logger.warning(
                        f"[GeminiAIProvider] Modelo '{current_model}' falhou ({type(model_err).__name__}). "
                        "Tentando próximo modelo candidato..."
                    )

            if not success:
                logger.error("All Gemini models failed; using explicit mock fallback")
                diagnostics["fallback_used"] = True
                # Fallback seguro caso ocorra erro em tempo de execucao (ex: chave revogada, limite da Google atingido)
                yield from self._mock_stream(diagnostics,
                    prompt=prompt,
                    system_instruction=system_instruction,
                    agent_role=agent_role,
                    history=history,
                    attachments=attachments,
                    context=context,
                )
        except Exception as e:
            logger.error("Gemini gateway failure: %s", type(e).__name__)
            diagnostics["fallback_used"] = True
            yield from self._mock_stream(diagnostics,
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
