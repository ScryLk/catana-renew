import json
from typing import Iterator, Dict, Any, Optional, List
from api.ai.provider import get_ai_provider, AIResponseChunk

class BaseAgent:
    """
    Classe base para agentes especializados do Catana Studio.
    Fornece o contrato padrao de prompt de sistema, contextualizacao e streaming.
    """

    role: str = "base"
    name: str = "Agente Base"
    description: str = "Especialista generico em processamento de catalogos"

    def get_system_prompt(self, context: Optional[Dict[str, Any]] = None) -> str:
        """
        Retorna o prompt de sistema personalizado para este agente.
        """
        return (
            "Voce e um agente de inteligencia artificial especializado do Catana Studio 2.0. "
            "Seu foco e auxiliar na criacao, refinamento e producao de catalogos comerciais e editoriais de alto padrao. "
            "Responda sempre em Portugues do Brasil com precisao profissional, objetividade e clareza. "
            "Nao utilize nenhum emoji em suas respostas."
        )

    def build_user_prompt(
        self,
        user_message: str,
        catalog_context: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Monta o prompt enriquecido com metadados do catalogo e anexos.
        """
        context_parts = []
        if catalog_context:
            title = catalog_context.get("title", "")
            brand = catalog_context.get("brand_name", "")
            style = catalog_context.get("style_preset", "")
            spread_idx = catalog_context.get("spread_index", 0)
            context_parts.append(
                f"[CONTEXTO DO PROJETO]: Catalogo: '{title}' | Marca: '{brand}' | "
                f"Estilo: '{style}' | Spread Atual: {spread_idx} (A4 794x1123 px)."
            )

        if attachments:
            context_parts.append(f"[TOTAL DE ANEXOS RECEBIDOS]: {len(attachments)}")

        if context_parts:
            header = "\n".join(context_parts) + "\n\n"
            return f"{header}Solicitacao do Usuario: {user_message}"
        
        return user_message

    def process_stream(
        self,
        user_message: str,
        catalog_context: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        history: Optional[List[Dict[str, str]]] = None,
    ) -> Iterator[AIResponseChunk]:
        """
        Executa a chamada streaming atraves do provider central.
        """
        provider = get_ai_provider()
        system_prompt = self.get_system_prompt(context=catalog_context)
        final_prompt = self.build_user_prompt(
            user_message=user_message,
            catalog_context=catalog_context,
            attachments=attachments,
        )

        return provider.generate_stream(
            prompt=final_prompt,
            system_instruction=system_prompt,
            agent_role=self.role,
            history=history,
            attachments=attachments,
            context=catalog_context,
        )
