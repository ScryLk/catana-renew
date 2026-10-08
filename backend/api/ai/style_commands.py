"""Restricted source-text weight planning from the authorized server index.

PDF font names are not evidence of perceived weight. Only a reliable reference
or an explicit user-selected numeric weight can authorize a style proposal.
"""

import json
import re

from api.ai.text_commands import (
    command_tokens, normalize, page_hint, token_literal, trailing_page,
)


WEIGHTS = set(range(100, 1000, 100))
STYLE_VERBS = {'deixe', 'deixar', 'coloque', 'colocar', 'aplique', 'aplicar',
               'defina', 'definir', 'altere', 'alterar', 'mude', 'mudar'}
MESSAGES = {
    'proposed': 'Alteração de peso tipográfico proposta; aguardando aplicação e salvamento.',
    'ambiguous': 'Há mais de um texto correspondente. Selecione o título ou indique a página; o logotipo será preservado.',
    'not_found': 'Não encontrei o título solicitado entre os textos seguros deste catálogo.',
    'not_editable': 'O texto está preservado na origem, mas não possui uma camada editável comprovada. Revise a recuperação de editabilidade antes de editar.',
    'reanalyze_required': 'Este catálogo precisa de uma revisão de editabilidade que preserve as edições existentes.',
    'invalid_target': 'Selecione um título deste catálogo e uma página válida.',
    'blocked_by_integrity': 'O peso deste elemento está protegido para preservar o logotipo ou dados comerciais.',
    'reference_not_found': 'Não encontrei o texto de referência na página indicada. Nenhum estilo foi alterado.',
    'reference_ambiguous': 'Há mais de uma referência com esse texto. Indique sua página ou selecione uma referência única.',
    'reference_style_unavailable': 'A referência não informa um peso visual confiável: a fonte extraída pode diferir da aparência original. Escolha um peso suportado para o título; a equivalência visual não será presumida.',
    'reference_index_limited': 'O índice da referência está incompleto e não permite confirmar seu peso com segurança. Escolha um peso explícito para o título ou uma referência comprovada.',
    'unsupported_action': 'Apenas o peso tipográfico de um texto individual editável pode ser alterado por esta operação.',
    'invalid_action': 'Informe um peso tipográfico inteiro de 100 a 900, em intervalos de 100.',
    'stale_target': 'O catálogo ou o título mudou desde a proposta. Peça uma nova escolha de peso antes de aplicar.',
    'unchanged': 'O título já possui esse peso tipográfico confirmado. Nenhuma alteração foi necessária.',
}


def _strip_prefix(tokens, prefixes):
    words = [t['word'] for t in tokens]
    for prefix in prefixes:
        if words[:len(prefix)] == list(prefix) and not any(t['quoted'] for t in tokens[:len(prefix)]):
            return tokens[len(prefix):]
    return tokens


def _target_tokens(tokens):
    return _strip_prefix(tokens, (
        ('o', 'negrito', 'destacado', 'de'), ('o', 'negrito', 'de'),
        ('o', 'peso', 'tipografico', 'de'), ('peso', 'tipografico', 'de'),
        ('o', 'peso', 'de'), ('peso', 'de'), ('o', 'texto'), ('no', 'texto'),
        ('do', 'texto'), ('texto',), ('o', 'titulo'), ('titulo',), ('de',),
    ))


def parse_style_request(user):
    if not isinstance(user, str) or len(user) > 20000:
        return None
    tokens = command_tokens(user)
    if not tokens:
        return None
    position = next((i for i, token in enumerate(tokens)
                     if not token['quoted'] and token['word'] in STYLE_VERBS), None)
    if position is None:
        return None
    target_page = page_hint(tokens[:position]) if position else None
    if position and target_page is None:
        return None
    body = tokens[position + 1:]
    words = [t['word'] if not t['quoted'] else '' for t in body]
    comparison = next((i for i, word in enumerate(words) if word in ('semelhante', 'igual')), None)
    if comparison is not None:
        if not any(word in ('negrito', 'peso') for word in words[:comparison]):
            return None
        left, left_page = trailing_page(body[:comparison])
        if left_page is not None and target_page is not None and left_page != target_page:
            return {'invalid': True}
        right, reference_page = trailing_page(body[comparison + 1:])
        right = _strip_prefix(right, (('ao', 'da'), ('ao', 'do'), ('ao', 'de'),
                                      ('ao',), ('a', 'da'), ('a', 'do'), ('a',), ('da',), ('do',), ('de',)))
        target = token_literal(user, _target_tokens(left))
        reference = token_literal(user, right, terminal=True)
        if not target or not reference:
            return None
        return {'target_text': target, 'target_page': left_page or target_page,
                'reference_text': reference, 'reference_page': reference_page}

    body, suffix_page = trailing_page(body)
    if suffix_page is not None:
        if target_page is not None and target_page != suffix_page:
            return {'invalid': True}
        target_page = suffix_page
    words = [t['word'] if not t['quoted'] else '' for t in body]
    # Explicit follow-up generated by the server: defina o peso de "X" para 700.
    weight_intent = (words[:2] == ['o', 'peso'] or words[:2] == ['peso', 'de']
                     or words[:2] == ['peso', 'tipografico']
                     or len(words) > 1 and words[0] == 'peso' and words[1].isdecimal())
    if weight_intent:
        numeric = [i for i, word in enumerate(words) if word.isdecimal()]
        if len(numeric) != 1:
            return {'invalid': True}
        number = numeric[0]
        weight_word = words[number]
        if len(weight_word) != 3 or not weight_word.isascii() or int(weight_word) not in WEIGHTS:
            return {'invalid': True}
        if number and words[number - 1] == 'para':
            target_tokens = _target_tokens(body[:number - 1])
        elif words.index('peso') + 1 == number:
            target_tokens = _target_tokens(body[number + 1:])
        else:
            return {'invalid': True}
        target = token_literal(user, target_tokens)
        return {'target_text': target, 'target_page': target_page, 'fontWeight': int(weight_word)} if target else {'invalid': True}
    if 'negrito' not in words:
        return None
    bold = words.index('negrito')
    if bold > 0 and words[bold - 1] == 'em':
        if bold != len(body) - 1:
            return None
        target_tokens = _target_tokens(body[:bold - 1])
    elif bold in (0, 1):
        target_tokens = _strip_prefix(body[bold + 1:], (('no', 'texto'), ('em',), ('no',), ('de',)))
    else:
        return None
    target = token_literal(user, target_tokens, terminal=True)
    return {'target_text': target, 'target_page': target_page, 'fontWeight': 700} if target else {'invalid': True}


def _single_candidates(index, text, page=None):
    needle = normalize(text)
    candidates = [e for e in index if not e.get('members') and needle
                  and needle in normalize(e['text'])
                  and (page is None or e.get('page') == page or e.get('target', '').startswith(f'page:{page}/'))]
    exact = [e for e in candidates if normalize(e['text']) == needle]
    return exact or candidates


def _weight(item):
    value = item.get('effectiveFontWeight', item.get('fontWeight'))
    return value if type(value) is int and value in WEIGHTS else None


def _choices(item, context):
    match = re.fullmatch(r'page:([0-9]{1,3})/element:([^/]{1,200})', item.get('target', ''))
    if not match or not isinstance(context.get('catalog_revision'), str) or not context.get('catalog_id'):
        return []
    literal = json.dumps(item['text'], ensure_ascii=False)
    labels = {400: 'Regular (400)', 600: 'Seminegrito (600)', 700: 'Negrito (700)', 800: 'Extranegrito (800)'}
    return [{'label': label, 'fontWeight': weight, 'target': item['target'],
             'elementId': item['id'], 'page': int(match[1]), 'expectedText': item['text'],
             'expectedFontWeight': _weight(item), 'catalog_id': context['catalog_id'],
             'catalog_revision': context['catalog_revision'],
             'command': f'defina o peso de {literal} para {weight} na página {match[1]}'}
            for weight, label in labels.items()]


def plan_text_style(user, context):
    request = parse_style_request(user)
    if request is None:
        return None
    context = context or {}
    choices = []
    candidates = []
    def result(status, actions=None):
        patch = {'actions': actions or [], 'summary': MESSAGES[status], 'planner_status': status}
        if candidates and status in ('ambiguous', 'reference_ambiguous'):
            patch['candidates'] = [{'id': e.get('id'), 'target': e.get('target')} for e in candidates[:10]]
        if choices:
            patch['style_choices'] = choices
        return MESSAGES[status], patch
    if request.get('invalid'):
        return result('invalid_action')
    if any(type(request.get(k)) is int and (request[k] < 1
           or type(context.get('catalog_page_count')) is int and request[k] > context['catalog_page_count'])
           for k in ('target_page', 'reference_page')):
        return result('invalid_target')
    state = context.get('imported_text_status')
    if state in ('not_editable', 'reanalyze_required', 'invalid_target'):
        return result(state)
    index = context.get('editable_text_index', [])
    index = [e for e in index[:500] if isinstance(e, dict) and isinstance(e.get('text'), str)] if isinstance(index, list) else []
    target_text = request['target_text']
    selected = context.get('selected_element_id')
    selected_only = normalize(target_text) in ('esse texto', 'este texto', 'texto selecionado', 'isso', 'this text')
    if selected_only:
        candidates = [e for e in index if e.get('id') == selected and not e.get('members')]
    else:
        candidates = _single_candidates(index, target_text, request.get('target_page'))
        focused = [e for e in candidates if e.get('id') == selected]
        if focused:
            candidates = focused
    hint = context.get('style_choice')
    if hint is not None:
        if (not isinstance(hint, dict) or request.get('reference_text')
                or hint.get('fontWeight') != request.get('fontWeight')
                or not isinstance(context.get('catalog_revision'), str)
                or not context.get('catalog_id')):
            return result('stale_target')
        hinted = [e for e in candidates if e.get('target') == hint.get('target')]
        if (len(hinted) != 1 or hint.get('catalog_id') != context.get('catalog_id')
                or hint.get('catalog_revision') != context.get('catalog_revision')
                or hint.get('expectedText') != hinted[0]['text']
                or hint.get('expectedFontWeight') != _weight(hinted[0])):
            return result('stale_target')
        candidates = hinted
    if len(candidates) != 1:
        if not candidates and any(e.get('members') and normalize(e['text']) == normalize(target_text) for e in index):
            return result('unsupported_action')
        return result('ambiguous' if candidates else 'not_found')
    target = candidates[0]
    if state == 'limited' and hint is None and target.get('id') != selected:
        return result('ambiguous')
    if target.get('commercial') or target.get('role') in ('logo', 'logotype', 'brand_logo'):
        return result('blocked_by_integrity')
    if target.get('editable') is not True:
        return result('not_editable')
    if not selected_only and normalize(target['text']) != normalize(target_text):
        return result('unsupported_action')
    current_weight = _weight(target)
    if not re.fullmatch(r'page:[0-9]{1,3}/element:[^/]{1,200}', target.get('target', '')) or current_weight is None:
        return result('unsupported_action')
    weight = request.get('fontWeight')
    if request.get('reference_text'):
        if state == 'limited':
            choices = _choices(target, context)
            return result('reference_index_limited')
        references = _single_candidates(index, request['reference_text'], request.get('reference_page'))
        if len(references) != 1:
            candidates = references
            choices = _choices(target, context) if not references else []
            return result('reference_ambiguous' if references else 'reference_not_found')
        reference = references[0]
        weight = _weight(reference)
        if reference.get('fontWeightReliable') is not True or weight is None:
            choices = _choices(target, context)
            return result('reference_style_unavailable')
    if current_weight == weight and target.get('fontWeightReliable') is True:
        return result('unchanged')
    return result('proposed', [{'action': 'update_text_style', 'type': 'update_text_style',
                               'target': target['target'], 'params': {'fontWeight': weight,
                               'expectedFontWeight': current_weight, 'expectedText': target['text']}}])
