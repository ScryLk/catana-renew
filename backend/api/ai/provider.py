import os
import time
import logging
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
        catalog_title = (context or {}).get("catalog_title", "Catalogo Comercial")
        
        has_files = bool(attachments and len(attachments) > 0)
        file_summary = ""
        if has_files:
            file_names = ", ".join([a.get("name", "arquivo") for a in attachments])
            file_summary = f"\n\nArquivos analisados com sucesso: {file_names}."

        if agent_role == "director":
            return (
                f"Analise de Direcao de Arte para {catalog_title} ({brand}):\n\n"
                f"1. Hierarquia e Grid Visual: Para a pagina dupla (A4 794x1123 px), recomendo organizar "
                f"o spread com uma area nobre de 60% na pagina esquerda para imagem heroica de impacto, "
                f"e a pagina direita estruturada em grid modular de 2x3 para exposicao limpa dos produtos.\n"
                f"2. Paleta Editorial: Mantendo o padrao clean com tipografia refinada, contraste equilibrado "
                f"entre espacos em branco e blocos de conteudo.\n"
                f"3. Elementos Sugeridos: Banner institucional superior, bloco de destaque do produto principal "
                f"e tabela de variacoes com margens de seguranca de 32px.{file_summary}\n\n"
                f"Deseja que eu aplique este layout estrutural diretamente nas paginas do catalogo?"
            )
        elif agent_role == "copywriter":
            return (
                f"Proposta de Copywriting Comercial para {catalog_title}:\n\n"
                f"Titulo de Abertura: 'Elegancia e Precisao em Cada Detalhe.'\n"
                f"Subtitulo: Desenvolvido para superar as expectativas mais rigorosas do mercado corporativo.\n\n"
                f"Texto de Apoio:\n"
                f"Apresentamos uma colecao concebida sob o equilibrio exato entre funcionalidade e design atemporal. "
                f"Cada peca reflete processos fabris refinados, materiais nobres e acabamento impecavel, garantindo "
                f"posicionamento exclusivo e alto valor percebido aos seus clientes.\n\n"
                f"Chamadas em Destaque (Call to Action):\n"
                f"- 'Solicite agora a grade completa para distribuicao B2B.'\n"
                f"- 'Disponibilidade imediata para pronta-entrega.'{file_summary}\n\n"
                f"Podemos consolidar estas redacoes nos blocos de texto da sua pagina?"
            )
        elif agent_role == "commercial":
            return (
                f"Estruturacao da Tabela Comercial e Dados B2B para {catalog_title}:\n\n"
                f"Tabela de Itens e Escala de Precos Sugerida:\n"
                f"| Codigo (SKU) | Descricao Tecnica | Qtd Minima | Preco Unitario (R$) | Preco Atacado (R$) |\n"
                f"|---|---|---|---|---|\n"
                f"| CT-101 | Modelo Master Premium A4 | 10 un | R$ 189,90 | R$ 142,50 |\n"
                f"| CT-102 | Edicao Executiva Prime | 20 un | R$ 249,00 | R$ 186,75 |\n"
                f"| CT-103 | Pack Distribuicao Corporativa | 50 un | R$ 129,50 | R$ 97,00 |\n\n"
                f"Condicoes Comerciais:\n"
                f"- Faturamento: 28/42 dias via boleto bancario.\n"
                f"- Frete: CIF para capitais nas compras acima do pedido minimo.{file_summary}\n\n"
                f"Deseja importar estes dados em formato tabular na pagina direita do seu catalogo?"
            )
        elif agent_role == "branding":
            return (
                f"Auditoria de Branding e Conformidade Visual:\n\n"
                f"Diagnostico da Identidade da Marca '{brand}':\n"
                f"1. Consistencia de Voz: A linguagem respeita o tom institucional e corporativo, sem excessos ou jargoes descartaveis.\n"
                f"2. Integridade Tipografica: A combinacao de familias sem serifa para rotulos e serifa para editoriais garante alta legibilidade.\n"
                f"3. Respeito ao Respiro e Zonas de Protecao: O logotipo principal deve manter o espacamento minimo equivalente a 1/2 de sua altura nas bordas do A4.\n"
                f"4. Aderencia as Diretrizes: Aprovado para continuidade no fluxo de publicacao.{file_summary}\n\n"
                f"Recomendo avancar com o fechamento do spread."
            )
        elif agent_role == "council":
            return (
                f"Parecer Executivo do Conselho Editorial (Mesa Redonda):\n\n"
                f"Avaliamos o projeto '{catalog_title}' sob as quatro perspectivas de especialistas:\n\n"
                f"1. Direcao de Arte: Layout harmonico e pronto para distribuicao digital e impressa em proporcao A4.\n"
                f"2. Redacao Comercial: Mensagem clara, persuasiva e com forte apelo de valor B2B.\n"
                f"3. Tabela de Vendas: Grade tecnica organizada com codificacao SKU e precos transparentes.\n"
                f"4. Auditoria de Marca: Fidelidade estetica confirmada, transmitindo solidez e credibilidade.{file_summary}\n\n"
                f"Conclusao do Conselho: O material atinge grau profissional de excelencia e esta pronto para validacao final."
            )
        else: # orchestrator / default
            return (
                f"Ola! Sou o Editor-Chefe do Catana Studio. Recebi sua solicitacao: '{prompt}'.\n\n"
                f"Para este catalogo de '{brand}', organizei a equipe de especialistas nos seguintes eixos:\n"
                f"1. Direcao de Arte: Configuracao da grade visual e harmonia das paginas duplas.\n"
                f"2. Redacao Publicitaria: Desenvolvimento de textos de alto impacto comercial.\n"
                f"3. Tabela Comercial: Inclusao de dados de produtos, codigos e condicoes de venda.\n"
                f"4. Auditoria de Branding: Validacao de consistencia de marca e padrao visual.{file_summary}\n\n"
                f"Como prefere comecar? Posso sugerir a primeira pagina dupla ou detalhar a grade de produtos."
            )


class GeminiAIProvider:
    """
    Provedor principal integrado a API Google Gemini (GenAI SDK).
    Alterna automaticamente para o MockProvider caso a GEMINI_API_KEY nao esteja configurada.
    """

    def __init__(self, api_key: Optional[str] = None, default_model: Optional[str] = None):
        self.api_key = api_key or getattr(settings, "GEMINI_API_KEY", "") or os.environ.get("GEMINI_API_KEY", "")
        self.default_model = default_model or getattr(settings, "AI_DEFAULT_MODEL", "gemini-2.0-flash")
        self.mock_provider = MockGeminiProvider()
        self.client = None

        if self.api_key and self.api_key.strip() and self.api_key != "SUA_API_KEY_AQUI":
            try:
                from google import genai
                self.client = genai.Client(api_key=self.api_key.strip())
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

            config = types.GenerateContentConfig(
                system_instruction=system_instruction or "Voce e um assistente profissional do Catana Studio especializado na criacao e edicao de catalogos de produtos.",
                temperature=0.7,
            )

            response_stream = self.client.models.generate_content_stream(
                model=self.default_model,
                contents=contents,
                config=config,
            )

            total_prompt_tokens = 0
            total_completion_tokens = 0

            for chunk in response_stream:
                if chunk.text:
                    yield AIResponseChunk(text=chunk.text, done=False)
                
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
                    "model": self.default_model,
                    "agent_role": agent_role,
                }
            )

        except Exception as exc:
            logger.error(f"Erro durante geracao de conteudo com Gemini: {exc}. Alternando para fallback mock.")
            # Fallback seguro caso ocorra erro em tempo de execucao (ex: chave revogada, limite da Google atingido)
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
