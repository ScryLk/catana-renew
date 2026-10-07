"""Terminate the model's private protocol before any public SSE or stored prose."""
import json
from dataclasses import dataclass

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
            tail = text[cursor:]
            # A raw payload or an un-fenced protocol label is also private.
            for marker in ('json:patch', 'DocumentIR', '"actions"', '"updates"', '"target"'):
                if marker in tail:
                    position = tail.index(marker)
                    opening_object = tail.rfind('{', 0, position)
                    tail = tail[:opening_object if opening_object >= 0 else position]
                    invalid = True
            human.append(tail)
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
        else:
            human.append(text[opening:closing + 3])
        cursor = closing + 3
    # Do not accept a valid block beside a malformed or unexpected second block.
    if invalid or len(candidates) > 1:
        return AgentOutput(''.join(human).strip(), None, 'invalid')
    return AgentOutput(''.join(human).strip(), candidates[0] if candidates else None, 'valid' if candidates else 'none')
