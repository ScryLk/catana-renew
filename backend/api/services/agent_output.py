"""Terminate the model's private protocol before any public SSE or stored prose."""
import json
from dataclasses import dataclass

PRIVATE_MARKERS = ('json:patch', 'documentir', '"actions"', '"updates"', '"target"')

PROTOCOL_FAILURE = 'Não consegui transformar essa solicitação em uma alteração válida. Tente novamente.'

@dataclass
class AgentOutput:
    human_text: str
    patch_candidate: dict | None
    protocol_status: str

def parse_agent_output(text: str) -> AgentOutput:
    human = []
    candidates = []
    invalid = False
    cursor = 0
    while cursor < len(text):
        opening = text.find('```', cursor)
        if opening < 0:
            human.append(text[cursor:])
            break
        human.append(text[cursor:opening])
        newline = text.find('\n', opening + 3)
        if newline < 0:
            invalid = True
            break
        tag = text[opening + 3:newline].strip().lower()
        closing = text.find('```', newline + 1)
        if closing < 0:
            invalid = True
            break
        body = text[newline + 1:closing].strip()
        machine = tag in ('json:patch', 'patch', 'json', '')
        if machine:
            try:
                candidate = json.loads(body)
                if not isinstance(candidate, dict) or not any(isinstance(candidate.get(key), list) for key in ('actions','updates')):
                    invalid = True
                else:
                    candidates.append(candidate)
            except (ValueError, TypeError):
                invalid = True
        elif any(marker in body.lower() for marker in PRIVATE_MARKERS):
            invalid = True
        else:
            human.append(text[opening:closing + 3])
        cursor = closing + 3
    prose = ''.join(human)
    for marker in PRIVATE_MARKERS:
        position = prose.lower().find(marker)
        if position >= 0:
            fence = prose.rfind('```', 0, position)
            opening_object = prose.rfind('{', 0, position)
            start = fence if fence >= 0 else opening_object if opening_object >= 0 else position
            prose = prose[:start]
            invalid = True
    # Do not accept a valid block beside a malformed or unexpected second block.
    if invalid or len(candidates) > 1:
        return AgentOutput(prose.strip(), None, 'invalid')
    return AgentOutput(prose.strip(), candidates[0] if candidates else None, 'valid' if candidates else 'none')
