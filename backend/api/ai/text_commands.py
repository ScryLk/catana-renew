"""Bounded deterministic replacement planning, shared by mock and production."""
import json
import re
import unicodedata


def normalize(text):
    return ' '.join(''.join(c for c in unicodedata.normalize('NFD', text.casefold()) if not unicodedata.combining(c)).split())


def plan_text_replacement(user, context):
    page_number = None
    page_suffix = re.search(r'\s+(?:na|da)\s+p[aá]gina\s+([0-9]{1,4})\s*$', user, re.I)
    page_prefix = re.match(r'\s*na\s+p[aá]gina\s+([0-9]{1,4})\s*[,;:]\s*', user, re.I)
    if page_suffix:
        page_number = int(page_suffix[1])
        user = user[:page_suffix.start()]
    elif page_prefix:
        page_number = int(page_prefix[1])
        user = user[page_prefix.end():]
    # Whole-command parsing: context values never provide commands or targets.
    match = re.fullmatch(r'\s*(?:altere|alterar|troque|trocar|substitua|substituir|mude)\s+(.{1,1000}?)\s+(?:para|por)\s+(.{1,1000}?)\s*[.!]?\s*', user, re.I)
    selected_only = re.fullmatch(r'\s*(?:troque|altere|mude)\s+para\s+(.{1,1000}?)\s*', user, re.I)
    index = (context or {}).get('editable_text_index', [])
    if not isinstance(index, list):
        index = []
    if not match:
        if not selected_only:
            return None
        selected_matches = [item for item in index[:500] if isinstance(item, dict) and item.get('id') == (context or {}).get('selected_element_id') and isinstance(item.get('text'), str)]
        if len(selected_matches) != 1:
            return 'Selecione um único elemento de texto para editar.', {'actions': [], 'summary': 'Selecione um elemento.', 'planner_status': 'ambiguous'}
        old, new = selected_matches[0]['text'], selected_only[1].strip().strip('"\'')
    else:
        old, new = (part.strip().strip('\"\'') for part in match.groups())
    matches = [item for item in index[:500] if isinstance(item, dict) and isinstance(item.get('text'), str) and normalize(old) in normalize(item['text'])]
    if page_number is not None:
        matches = [item for item in matches if str(item.get('target', '')).startswith(f'page:{page_number}/')]
    if not matches and re.match(r'^(?:o\s+|a\s+)?(?:layout|diagrama[cç][aã]o|paleta|cor|cores|produto|item)\b', old, re.I):
        return None  # Preserve existing layout/product/style command routing.
    selected = (context or {}).get('selected_element_id')
    focused = [item for item in matches if item.get('id') == selected]
    visible = [item for item in matches if item.get('visible') is True]
    matches = focused or visible or matches
    status = 'not_found'
    actions = []
    if len(matches) > 1:
        status = 'ambiguous'
    elif matches:
        item = matches[0]
        if normalize(item['text']).count(normalize(old)) > 1:
            return 'Há mais de uma ocorrência no texto. Indique o trecho desejado.', {'actions': [], 'summary': 'Ocorrência ambígua.', 'planner_status': 'ambiguous'}
        if item.get('commercial'):
            status = 'blocked_by_integrity'
        elif item.get('editable') is not True:
            status = 'not_editable'
        elif isinstance(item.get('target'), str):
            status = 'proposed'
            actions = [{'action': 'update_text', 'type': 'update_text', 'target': item['target'],
                        'params': {'find': old, 'replacement': new, 'expectedText': item['text']}}]
    messages = {'proposed': 'Edição de texto proposta; aguardando validação da prancheta.',
                'ambiguous': 'Há mais de uma ocorrência. Selecione o texto ou indique a página.',
                'not_found': 'Texto não encontrado no índice do catálogo. Selecione o trecho desejado.',
                'not_editable': 'Este texto está preservado na imagem original e não pode ser editado com segurança. Use reconstrução ou redesign.',
                'blocked_by_integrity': 'Edição bloqueada pela integridade dos dados comerciais.'}
    return messages[status], {'actions': actions, 'summary': messages[status], 'planner_status': status}


def planner_response(plan):
    text, patch = plan
    return text + ('\n```json:patch\n' + json.dumps(patch, ensure_ascii=False) + '\n```' if patch['actions'] else '')
