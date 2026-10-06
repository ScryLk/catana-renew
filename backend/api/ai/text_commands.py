"""Bounded deterministic replacement planning, shared by mock and production."""
import hashlib
import json
import logging
import unicodedata

logger = logging.getLogger(__name__)
VERBS = {'altere', 'altera', 'alterar', 'troque', 'trocar', 'substitua', 'substituir', 'mude', 'mudar', 'renomeie', 'renomear', 'change', 'replace'}


def normalize(text):
    return ' '.join(''.join(c for c in unicodedata.normalize('NFD', text.casefold()) if not unicodedata.combining(c)).split())


def parse_replacement(user):
    """Token parsing avoids backtracking on untrusted command strings."""
    words = user.split()
    normalized = [normalize(w).strip(',;:') for w in words]
    verb_positions = [i for i, w in enumerate(normalized) if w in VERBS]
    if not verb_positions:
        return None
    position = verb_positions[0]
    prefix = normalized[:position]
    body = words[position + 1:]
    page = None
    def page_hint(tokens):
        tokens = [t for t in tokens if t not in ('na', 'da', 'on', 'the')]
        if tokens == ['capa'] or tokens == ['primeira', 'pagina']:
            return 1
        if len(tokens) == 2 and tokens[0] in ('pagina', 'page'):
            if tokens[1] in ('um', 'uma', 'one'):
                return 1
            if tokens[1].isascii() and tokens[1].isdigit() and len(tokens[1]) <= 4 and int(tokens[1]) > 0:
                return int(tokens[1])
            return -1
        return None
    if prefix:
        page = page_hint(prefix)
        if page is None:
            return None
    normalized_body = [normalize(w).strip(',;:.') for w in body]
    for i in range(len(body)):
        if normalized_body[i] in ('na', 'da', 'on'):
            hint = page_hint(normalized_body[i:])
            if hint is not None:
                page, body = hint, body[:i]
                break
    separator = next((i for i, w in enumerate(body) if normalize(w) in ('para', 'por', 'to', 'with')), None)
    if separator is None:
        return None
    old = ' '.join(body[:separator]).strip('"\'“”')
    new = ' '.join(body[separator + 1:]).rstrip('.!').strip('"\'“”')
    selected = normalize(old) in ('', 'esse texto', 'este texto', 'isso', 'this text')
    if (not old and not selected) or not new or len(old) > 1000 or len(new) > 2000:
        return None
    return old, new, page, selected


def plan_text_replacement(user, context):
    parsed = parse_replacement(user)
    if parsed is None:
        return None
    old, new, page_number, selected_only = parsed
    context = context or {}
    index = context.get('editable_text_index', [])
    if not isinstance(index, list):
        index = []
    index = [item for item in index[:500] if isinstance(item, dict) and isinstance(item.get('text'), str)]
    state = context.get('imported_text_status')
    candidates = []
    messages = {
        'proposed': 'Edição de texto proposta; aguardando validação da prancheta.',
        'ambiguous': 'Há mais de uma ocorrência. Selecione o texto ou indique a página.',
        'not_found': 'Texto não encontrado no índice do catálogo. Selecione o trecho desejado.',
        'not_editable': 'Este texto está preservado na imagem original e ainda não possui uma camada editável segura. Use reconstrução ou redesign.',
        'reanalyze_required': 'Atualizar editabilidade: reanalise a origem preservada antes de editar este documento.',
        'invalid_target': 'Destino inválido; selecione um texto deste catálogo.',
        'blocked_by_integrity': 'Edição bloqueada pela integridade dos dados comerciais.',
    }
    def result(status, actions=None):
        if context.get('catalog_id'):
            logger.info('imported_text_resolution catalog_id=%s page=%s search_text_hash=%s candidate_count=%s group_candidate_count=%s resolution_status=%s selected_element_id=%s',
                context['catalog_id'], page_number, hashlib.sha256(old.encode()).hexdigest()[:16], len(index),
                sum(bool(e.get('members')) for e in index), status, context.get('selected_element_id'))
        description = messages[status]
        if status == 'ambiguous' and candidates:
            pages = ', '.join(str(p) for p in sorted({item.get('page', str(item.get('target', '')).split('/')[0].removeprefix('page:')) for item in candidates}, key=str))
            description = f"Encontrei {len(candidates)} ocorrências nas páginas {pages}. Selecione um texto ou indique a página."
        elif status == 'not_found' and page_number:
            description = f"Não encontrei '{old[:160]}' entre os textos editáveis da página {page_number}."
        patch = {'actions': actions or [], 'summary': description, 'planner_status': status}
        if status == 'ambiguous':
            patch['candidates'] = [{'id': e.get('id'), 'target': e.get('target')} for e in candidates[:10]]
        return description, patch
    if state in ('not_editable', 'reanalyze_required', 'invalid_target'):
        return result(state)
    selected = context.get('selected_element_id')
    if selected_only:
        focused = [item for item in index if item.get('id') == selected and not item.get('members')]
        if len(focused) != 1:
            return result('ambiguous')
        old = focused[0]['text']
    if not normalize(old):
        return result('not_found')
    if state == 'limited' and not any(item.get('id') == selected and normalize(old) in normalize(item['text']) for item in index):
        return result('ambiguous')
    matches = [item for item in index if normalize(old) in normalize(item['text'])]
    if page_number is not None:
        matches = [item for item in matches if str(item.get('target', '')).startswith(f'page:{page_number}/')]
    routing_words = normalize(old).split()
    if routing_words and routing_words[0] in ('o', 'a'):
        routing_words = routing_words[1:]
    if not matches and routing_words and routing_words[0] in ('layout', 'diagramação', 'diagramacao', 'paleta', 'cor', 'cores', 'produto', 'item'):
        return None
    focused = [item for item in matches if item.get('id') == selected and not item.get('members')]
    def best(items):
        singles = [i for i in items if not i.get('members')]
        exact = [i for i in singles if normalize(i['text']) == normalize(old)]
        if exact:
            return exact
        if singles:
            return singles
        # Groups may replace only the full logical string, never an arbitrary fragment.
        return [i for i in items if i.get('members') and normalize(i['text']) == normalize(old)]
    matches = best(focused) or best([i for i in matches if i.get('visible') is True]) or best(matches)
    candidates = matches
    if len(matches) > 1:
        return result('ambiguous')
    if not matches:
        return result('not_found')
    item = matches[0]
    if normalize(item['text']).count(normalize(old)) > 1:
        return result('ambiguous')
    if item.get('commercial'):
        return result('blocked_by_integrity')
    if item.get('editable') is not True:
        return result('not_editable')
    action_type = 'update_text_group' if item.get('members') else 'update_text'
    params = {'find': item['text'] if item.get('members') else old, 'replacement': new, 'expectedText': item['text']}
    if item.get('members'):
        params['members'] = item['members']
    return result('proposed', [{'action': action_type, 'type': action_type, 'target': item['target'], 'params': params}])


def planner_response(plan):
    text, patch = plan
    return text + ('\n```json:patch\n' + json.dumps(patch, ensure_ascii=False) + '\n```' if patch['actions'] else '')
