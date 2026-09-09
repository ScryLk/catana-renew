import json
from typing import Iterator, Dict, Any, Optional, List
from api.ai.provider import get_ai_provider, AIResponseChunk
from api.services.template_rag import TemplateRAGService

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
            "Seu foco e auxiliar na criacao, refinamento e producao de catalogos comerciais e editoriais de alto padrao.\n\n"
            "Diretrizes Gerais:\n"
            "1. Responda sempre em Portugues do Brasil com precisao profissional, objetividade e clareza editorial.\n"
            "2. Proporcao Padrao: Paginas A4 (794x1123 px por pagina), organizadas em pares de spreads duplos.\n"
            "3. Protocolo de Modificacao do Canvas (JSON Delta Patch):\n"
            "   Quando a solicitacao do usuario demandar criacao, atualizacao ou estilizacao de elementos no spread atual, "
            "finalize sua resposta com um bloco JSON delimitado exatamente por ```json:patch e ``` no formato:\n"
            "   ```json:patch\n"
            "   {\n"
            "     \"spread_index\": <numero_do_spread>,\n"
            "     \"updates\": [\n"
            "       {\"target\": \"left_page\" | \"right_page\" | \"<product_id>\", \"field\": \"<campo>\", \"value\": <novo_valor>}\n"
            "     ],\n"
            "     \"summary\": \"<descricao concisa da alteracao>\"\n"
            "   }\n"
            "   ```\n"
            "4. Regra Estrita: Nao utilize nenhum emoji em suas respostas sob qualquer hipotese."
        )

    def build_user_prompt(
        self,
        user_message: str,
        catalog_context: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Monta o prompt enriquecido com metadados do catalogo, spread ativo e anexos.
        """
        context_parts = []
        if catalog_context:
            title = catalog_context.get("title", "")
            brand = catalog_context.get("brand_name", "")
            style = catalog_context.get("style_preset", "")
            spread_idx = catalog_context.get("spread_index", 0)
            context_parts.append(
                f"[CONTEXTO DO PROJETO]: Catalogo: '{title}' | Marca: '{brand}' | "
                f"Estilo: '{style}' | Spread Ativo: {spread_idx} (A4 794x1123 px)."
            )

            # Indice resumido dos spreads (Skeleton)
            skeleton = catalog_context.get("catalog_skeleton")
            if skeleton:
                try:
                    skeleton_str = json.dumps(skeleton, ensure_ascii=False)
                    context_parts.append(f"[INDICE RESUMIDO DO CATALOGO]: {skeleton_str}")
                except Exception:
                    pass

            # Elemento focado pelo usuario
            selected_id = catalog_context.get("selected_element_id")
            if selected_id:
                context_parts.append(f"[ELEMENTO SELECIONADO PELO USUARIO]: {selected_id}")

            # Estado atual do spread ativo em JSON
            active_spread = catalog_context.get("active_spread_data")
            if active_spread:
                try:
                    spread_json = json.dumps(active_spread, ensure_ascii=False)
                    context_parts.append(f"[ESTADO ATUAL DO SPREAD VISIVEL (JSON)]:\n{spread_json}")
                except Exception:
                    pass

        # RAG de Templates Editoriais (Blueprints)
        # Ativado para Diretor de Arte, Orquestrador ou quando o usuario expressa intencao visual
        msg_lower = user_message.lower()
        should_query_rag = (
            self.role in ["director", "orchestrator"]
            or any(
                kw in msg_lower
                for kw in [
                    "template", "modelo", "layout", "spread", "lamina", "capa", "cover",
                    "manifesto", "hero", "destaque", "grade", "grid", "criar", "pagina",
                    "produtos", "b2b", "tabela", "novo spread"
                ]
            )
        )

        if should_query_rag:
            inferred_category = None
            if any(k in msg_lower for k in ["capa", "cover"]):
                inferred_category = "cover"
            elif "manifesto" in msg_lower:
                inferred_category = "manifesto"
            elif any(k in msg_lower for k in ["hero", "destaque", "unico"]):
                inferred_category = "hero"
            elif any(k in msg_lower for k in ["duo", "dupla", "dois", "par"]):
                inferred_category = "duo"
            elif any(k in msg_lower for k in ["grade", "grid", "4 produtos", "quatro", "tabela", "atacado", "b2b"]):
                inferred_category = "grid_4"
            elif any(k in msg_lower for k in ["divisor", "transicao", "secao"]):
                inferred_category = "divider"
            elif any(k in msg_lower for k in ["contracapa", "verso"]):
                inferred_category = "backcover"

            try:
                template_prompt = TemplateRAGService.retrieve_best_template_prompt(
                    query=user_message,
                    category=inferred_category,
                    industry=(catalog_context or {}).get("industry"),
                    organization_id=(catalog_context or {}).get("organization_id"),
                )
                if template_prompt:
                    context_parts.append(template_prompt)
            except Exception:
                pass

        if attachments:
            context_parts.append(f"[TOTAL DE ANEXOS RECEBIDOS]: {len(attachments)}")

        if context_parts:
            header = "\n\n".join(context_parts) + "\n\n"
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
