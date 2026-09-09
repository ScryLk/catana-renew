from typing import Dict, List, Any
from api.ai.agents.base import BaseAgent
from api.ai.agents.orchestrator import OrchestratorAgent
from api.ai.agents.director import ArtDirectorAgent
from api.ai.agents.copywriter import CopywriterAgent
from api.ai.agents.commercial import CommercialAgent
from api.ai.agents.branding import BrandingAuditorAgent
from api.ai.agents.council import EditorialCouncilAgent

_AGENTS: Dict[str, BaseAgent] = {
    "orchestrator": OrchestratorAgent(),
    "director": ArtDirectorAgent(),
    "copywriter": CopywriterAgent(),
    "commercial": CommercialAgent(),
    "branding": BrandingAuditorAgent(),
    "council": EditorialCouncilAgent(),
}

def get_agent(role: str) -> BaseAgent:
    """
    Recupera a instancia do agente pelo identificador de papel.
    Retorna o OrchestratorAgent caso o papel nao seja reconhecido.
    """
    return _AGENTS.get(role.lower(), _AGENTS["orchestrator"])

def list_agents() -> List[Dict[str, Any]]:
    """
    Retorna a relacao de todos os agentes disponiveis no Studio.
    """
    return [
        {
            "role": agent.role,
            "name": agent.name,
            "description": agent.description,
        }
        for agent in _AGENTS.values()
    ]
