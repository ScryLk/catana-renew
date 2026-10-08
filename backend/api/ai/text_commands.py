"""Bounded deterministic replacement planning, shared by mock and production."""
import hashlib
import json
import logging
import unicodedata

logger = logging.getLogger(__name__)
VERBS = {'altere', 'altera', 'alterar', 'troque', 'trocar', 'substitua', 'substituir', 'mude', 'mudar', 'renomeie', 'renomear', 'change', 'replace'}


def normalize(text):
    return ' '.join(''.join(c for c in unicodedata.normalize('NFD', text.casefold()) if not unicodedata.combining(c)).split())


def command_tokens(user):
    """Scan once; quoted literals keep separators/page words and original offsets."""
    tokens = []
    cursor = 0
    quotes = {'"': '"', "'": "'", '“': '”', '‘': '’'}
    while cursor < len(user):
        if user[cursor].isspace():
            cursor += 1
            continue
        start = cursor
        quoted = user[cursor] in quotes
        if quoted:
            end_quote = quotes[user[cursor]]
            cursor += 1
            escaped = False
            while cursor < len(user):
                char = user[cursor]
                cursor += 1
                if char == end_quote and not escaped:
                    break
                escaped = char == '\\' and not escaped
            else:
                return None
        else:
            while cursor < len(user) and not user[cursor].isspace():
                cursor += 1
        raw = user[start:cursor]
        if not raw.strip(',;:.!'):
            continue
        tokens.append({'raw': raw, 'word': normalize(raw).strip(',;:.'),
                       'quoted': quoted, 'start': start, 'end': cursor})
    return tokens


ORDINAL_PAGES = {'primeira': 1, 'segunda': 2, 'terceira': 3, 'quarta': 4,
                 'quinta': 5, 'sexta': 6, 'setima': 7, 'oitava': 8}


def page_hint(tokens):
    if any(t.get('quoted') for t in tokens):
        return None
    words = [t['word'] for t in tokens if t['word'] not in ('na', 'da', 'on', 'the')]
    if words == ['capa']:
        return 1
    if len(words) == 2 and words[0] in ORDINAL_PAGES and words[1] in ('pagina', 'page'):
        return ORDINAL_PAGES[words[0]]
    if len(words) == 2 and words[0] in ('pagina', 'page'):
        if words[1] in ('um', 'uma', 'one'):
            return 1
        if words[1].isascii() and words[1].isdigit() and len(words[1]) <= 4 and int(words[1]) > 0:
            return int(words[1])
        return -1
    return None


def trailing_page(tokens):
    """A suffix scope never consumes a page phrase inside a quoted literal."""
    for position, token in enumerate(tokens):
        if not token['quoted'] and token['word'] in ('na', 'da', 'on'):
            hint = page_hint(tokens[position:])
            if hint is not None:
                return tokens[:position], hint
    return tokens, None


def token_literal(user, tokens, terminal=False):
    if not tokens:
        return ''
    value = user[tokens[0]['start']:tokens[-1]['end']].strip()
    if len(tokens) == 1 and tokens[0]['quoted']:
        value = value[1:-1]
        # JSON literals are generated for recovery commands; decode escaped quotes.
        if tokens[0]['raw'].startswith('"'):
            try:
                value = json.loads(tokens[0]['raw'])
            except (ValueError, TypeError):
                pass
        return value
    return value.rstrip('.!') if terminal else value


def parse_replacement(user):
    """Bounded syntax; only an unquoted leading 'de' is a routing preposition."""
    if not isinstance(user, str) or len(user) > 20000:
        return None
    tokens = command_tokens(user)
    if tokens is None:
        return None
    position = next((i for i, t in enumerate(tokens) if not t['quoted'] and t['word'] in VERBS), None)
    if position is None:
        return None
    page = page_hint(tokens[:position]) if position else None
    if position and page is None:
        return None
    body, suffix_page = trailing_page(tokens[position + 1:])
    if suffix_page is not None:
        if page is not None and page != suffix_page:
            return None
        page = suffix_page
    separator = next((i for i, t in enumerate(body) if not t['quoted'] and t['word'] in ('para', 'por', 'to', 'with')), None)
    if separator is None:
        return None
    old_tokens = body[:separator]
    if len(old_tokens) > 1 and not old_tokens[0]['quoted'] and old_tokens[0]['word'] == 'de':
        old_tokens = old_tokens[1:]
    old = token_literal(user, old_tokens)
    new = token_literal(user, body[separator + 1:], terminal=True)
    selected = normalize(old) in ('', 'esse texto', 'este texto', 'isso', 'this text')
    if not new or len(old) > 1000 or len(new) > 2000:
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
    if page_number is not None and (page_number < 1 or type(context.get('catalog_page_count')) is int
                                   and page_number > context['catalog_page_count']):
        return result('invalid_target')
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
