"""Bind an execution outcome to an authorized proposal and a server-observed save.

Browser result flags are diagnostic hints, never proof that a mutation succeeded.
Source edits and page sequences whose desired values can be checked independently
receive a confirmed result; other operations retain an unverified outcome.
"""
import copy
from uuid import UUID

from rest_framework.exceptions import ValidationError
from api.models import ChatMessage
from api.services.document_reconstructor import DocumentReconstructorService


def proposal_for(catalog, user, payload, lock=False):
    if not isinstance(payload, dict) or set(payload) != {'client_request_id', 'message_id'}:
        raise ValidationError({'code': 'invalid_execution_receipt'})
    try:
        request_id = str(UUID(str(payload['client_request_id'])))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({'code': 'invalid_execution_receipt'}) from None
    if type(payload['message_id']) is not int or payload['message_id'] <= 0:
        raise ValidationError({'code': 'invalid_execution_receipt'})
    messages = ChatMessage.objects.filter(pk=payload['message_id'], sender_type='agent',
        thread__catalog=catalog, thread__user=user)
    if lock:
        messages = messages.select_for_update()
    message = messages.first()
    metadata = message.metadata if message and isinstance(message.metadata, dict) else {}
    if (metadata.get('metadata', {}).get('client_request_id') != request_id
            or not isinstance(metadata.get('patch'), dict)
            or not metadata['patch'].get('actions')
            or not isinstance(metadata.get('execution_basis'), dict)):
        raise ValidationError({'code': 'invalid_execution_receipt'})
    return message, request_id


def begin_execution_save(catalog, user, execution):
    if execution is None:
        return None
    message, request_id = proposal_for(catalog, user, execution, lock=True)
    before = DocumentReconstructorService.reconstruction_revision(catalog)
    metadata = message.metadata
    saved = metadata.get('execution_save') or {}
    if saved:
        if saved.get('revision_after') != before or saved.get('client_request_id') != request_id:
            raise ValidationError({'code': 'stale_execution', 'error': 'O catálogo mudou; revise a proposta novamente.'})
    elif metadata['execution_basis'].get('revision_before') != before:
        # A repeated identical save may reuse the already recorded result. It
        # must never permit an old proposal to overwrite an intervening edit.
        raise ValidationError({'code': 'stale_execution', 'error': 'O catálogo mudou; revise a proposta novamente.'})
    return message, request_id, before


def finish_execution_save(catalog, binding):
    if not binding:
        return None
    message, request_id, before = binding
    after = DocumentReconstructorService.reconstruction_revision(catalog)
    metadata = copy.deepcopy(message.metadata)
    metadata['execution_save'] = {'client_request_id': request_id,
        'revision_before': before, 'revision_after': after}
    message.metadata = metadata
    message.save(update_fields=['metadata'])
    return metadata['execution_save']


def _replace_once(text, find, replacement):
    """Mirror the editor's normalized substring offsets without rewriting others."""
    import unicodedata
    normalized, starts, ends = '', [], []
    for index, char in enumerate(text):
        value = ''.join(c for c in unicodedata.normalize('NFD', char.lower())
                        if not unicodedata.combining(c))
        for letter in value:
            if letter.isspace():
                if normalized.endswith(' '):
                    ends[-1] = index + 1
                    continue
                letter = ' '
            normalized += letter
            starts.append(index)
            ends.append(index + 1)
    needle = ' '.join(''.join(c for c in unicodedata.normalize('NFD', find.strip().lower())
                             if not unicodedata.combining(c)).split())
    start = normalized.find(needle)
    if not needle or start < 0 or normalized.find(needle, start + len(needle)) >= 0:
        return None
    return text[:starts[start]] + replacement + text[ends[start + len(needle) - 1]:]


def _current_entries(catalog, actions):
    from api.services.imported_text_resolver import catalog_index
    from api.services.studio_action_policy import editorial_index
    import re
    indexed = {}
    targets = {action['target'] for action in actions}
    targets.update(member['target'] for action in actions for member in action['params'].get('members', []))
    for target in sorted(targets):
        match = re.fullmatch(r'page:(\d+)/(?:element:([^/]+)|field:[a-z]+)', target)
        if not match:
            continue
        page, selected = int(match[1]), match[2]
        entries, _ = catalog_index(catalog, selected=selected, page_number=page) if catalog.import_metadata else ([], 'ready')
        entries += editorial_index(catalog, page_number=page)
        indexed.update({entry['target']: entry for entry in entries if not entry.get('members')})
    return indexed


def _verify_structure(actions, catalog, initial_ids):
    from api.services.catalog_page_origin import catalog_pages
    structural = {'add_page', 'remove_page', 'move_page', 'duplicate_page', 'reconfigure_catalog'}
    if not any(action['action'] in structural for action in actions):
        return {}
    if not isinstance(initial_ids, list):
        return {i: False for i, a in enumerate(actions) if a['action'] in structural}
    expected = list(initial_ids)
    additions = []
    for i, action in enumerate(actions):
        kind, params = action['action'], action['params']
        if kind not in structural:
            continue
        if kind == 'add_page':
            expected.insert(params['afterPage'], params['pageId'])
            additions.append((i, params))
        elif kind == 'reconfigure_catalog':
            expected = expected[:params['totalPages']]
        else:
            position = int(action['target'].split(':')[1]) - 1
            if not 0 <= position < len(expected):
                return {j: False for j, a in enumerate(actions) if a['action'] in structural}
            if kind == 'remove_page':
                expected.pop(position)
            elif kind == 'duplicate_page':
                expected.insert(params['afterPage'], params['pageId'])
            else:
                page_id = expected.pop(position)
                after = params['afterPage'] - int(params['afterPage'] > position)
                expected.insert(after, page_id)
    pages = catalog_pages(catalog)
    matches = [p.get('id') for p in pages] == expected
    outcomes = {i: ('unchanged' if matches and expected == initial_ids else matches)
        for i, a in enumerate(actions) if a['action'] in structural}
    for i, params in additions:
        page = next((p for p in pages if p.get('id') == params['pageId']), {})
        outcomes[i] = matches and all(page.get(key) == value for key, value in params.items()
            if key in {'type', 'contentRole', 'pageOrigin', 'title', 'subtitle', 'content', 'quote', 'label'})
        outcomes[i] = outcomes[i] and all(page.get(key) == value for key, value in params.get('pageColors', {}).items())
    return outcomes


def _verify_action(action, indexed, saved, basis, structural=None):
    kind, target, params = action['action'], action['target'], action['params']
    base = {'action': kind, 'target': target, 'status': 'unverified'}
    if not saved:
        return {**base, 'status': 'failed', 'reason': 'save_not_confirmed'}
    if structural is not None:
        if not structural:
            return {**base, 'status': 'failed', 'reason': 'saved_value_mismatch'}
        if structural == 'unchanged':
            return {**base, 'status': 'unchanged'}
        reason = (f"Página de finalização adicionada após a página {params['afterPage']}."
            if kind == 'add_page' and params.get('contentRole') == 'closing'
            else 'Sequência de páginas atualizada.')
        return {**base, 'status': 'applied', 'reason': reason}
    if kind == 'update_text_group':
        members = params.get('members', [])
        if not members or any(member['target'] not in indexed for member in members):
            return {**base, 'status': 'failed', 'reason': 'stale_target'}
        expected = [params['replacement'], *['' for _ in members[1:]]]
        actual = [indexed[member['target']]['text'] for member in members]
        if actual != expected:
            return {**base, 'status': 'failed', 'reason': 'saved_value_mismatch'}
        changed = any(member['text'] != value for member, value in zip(members, expected))
        return {**base, 'status': 'applied' if changed else 'unchanged', 'value': params['replacement']}
    if kind not in ('update_text', 'update_text_style'):
        return base
    entry = indexed.get(target)
    if entry is None:
        return {**base, 'status': 'failed', 'reason': 'stale_target'}
    if kind == 'update_text_style':
        if entry['text'] != params['expectedText'] or entry.get('fontWeight') != params['fontWeight']:
            return {**base, 'status': 'failed', 'reason': 'saved_value_mismatch'}
        # Establishing an explicit editing weight also changes an uncertain PDF
        # appearance even when its extracted numeric weight happened to match.
        changed = (params['fontWeight'] != params['expectedFontWeight']
            or basis.get('style_reliability', {}).get(target) is False)
        if changed and not entry.get('fontWeightReliable'):
            return {**base, 'status': 'failed', 'reason': 'saved_value_mismatch'}
        return {**base, 'status': 'applied' if changed else 'unchanged', 'fontWeight': params['fontWeight']}
    desired = (_replace_once(params['expectedText'], params['find'], params['replacement'])
        if 'find' in params else params['text'])
    if desired is None or entry['text'] != desired:
        return {**base, 'status': 'failed', 'reason': 'saved_value_mismatch'}
    return {**base, 'status': 'applied' if desired != params['expectedText'] else 'unchanged', 'value': desired}


def _content(results):
    applied = [item for item in results if item['status'] == 'applied']
    if len(applied) == 1 and len(results) == 1:
        item = applied[0]
        if item['action'] == 'update_text_style':
            return f"Peso do texto atualizado para {item['fontWeight']}."
        if 'value' in item:
            return f"Texto da página atualizado para '{item['value'][:160]}'."
        return item['reason']
    parts = [f'{len(applied)} alteração(ões) aplicada(s) e salva(s).'] if applied else []
    if any(item['status'] == 'failed' for item in results):
        if any(item.get('reason') == 'save_not_confirmed' for item in results):
            parts.append('Não foi possível confirmar o salvamento desta alteração. Revise o catálogo e tente novamente.')
        if any(item.get('reason') in {'saved_value_mismatch', 'stale_target'} for item in results):
            parts.append('A revisão foi salva, mas a alteração solicitada não consta do catálogo. Solicite uma nova proposta.')
        diagnostics = {'style_overflow': 'O navegador informou que o peso excede a caixa de origem.',
            'font_unavailable': 'O navegador informou que a fonte para edição não está disponível.',
            'stale_style': 'O navegador informou que o texto ou o peso mudou desde a proposta.',
            'not_editable': 'O navegador informou que este elemento não possui uma camada editável.'}
        parts.extend(dict.fromkeys(diagnostics[item['application_diagnostic']] for item in results
            if item.get('application_diagnostic') in diagnostics))
    if any(item['status'] == 'unchanged' for item in results):
        parts.append('O catálogo já corresponde ao resultado solicitado; nenhuma alteração necessária.')
    if any(item['status'] == 'unverified' for item in results):
        parts.append('A revisão foi salva, mas o resultado desta operação ainda não pôde ser confirmado.')
    return ' '.join(parts)


def record_execution(catalog, user, payload):
    if not isinstance(payload, dict) or set(payload) - {'client_request_id', 'message_id', 'results'}:
        raise ValidationError({'code': 'invalid_execution_receipt'})
    hints = payload.get('results', [])
    if not isinstance(hints, list) or len(hints) > 100 or any(not isinstance(item, dict) for item in hints):
        raise ValidationError({'code': 'invalid_execution_receipt'})
    # Hints are bounded and ignored for verification, including an "applied" flag.
    if len(str(hints)) > 64000:
        raise ValidationError({'code': 'invalid_execution_receipt'})
    message, request_id = proposal_for(catalog, user,
        {key: payload.get(key) for key in ('client_request_id', 'message_id')}, lock=True)
    metadata = copy.deepcopy(message.metadata)
    current = DocumentReconstructorService.reconstruction_revision(catalog)
    saved = metadata.get('execution_save') or {}
    saved_matches = saved.get('client_request_id') == request_id and saved.get('revision_after') == current
    previous = metadata.get('execution_receipt') or {}
    if previous.get('status') == 'confirmed':
        # This is a receipt for a historical save, not a claim that later edits
        # still have its values. Replays cannot rewrite a confirmed outcome.
        return {'message_id': message.pk, 'client_request_id': request_id, 'content': message.content,
            'execution_results': metadata['execution_results'], 'execution_receipt': previous}
    indexed = _current_entries(catalog, metadata['patch']['actions'])
    structure = _verify_structure(metadata['patch']['actions'], catalog, metadata['patch'].get('expectedPageIds'))
    results = [{**_verify_action(action, indexed, saved_matches, metadata['execution_basis'], structure.get(index)), 'action_id': str(index)}
        for index, action in enumerate(metadata['patch']['actions'])]
    for result in results:
        hint = next((item for item in hints if item.get('action_id') == result['action_id'] or item.get('target') == result['target']), {})
        diagnostic = hint.get('reason', hint.get('status'))
        if result.get('reason') == 'saved_value_mismatch' and diagnostic in {'style_overflow', 'font_unavailable', 'stale_style', 'not_editable'}:
            # A bounded application diagnostic explains a failure, but can
            # never promote it to a server-confirmed success.
            result['application_diagnostic'] = diagnostic
    content = _content(results)
    confirmed = all(item['status'] in ('applied', 'unchanged') for item in results)
    receipt = {'client_request_id': request_id, 'status': 'confirmed' if confirmed else 'unverified',
        'revision_before': metadata['execution_basis']['revision_before'], 'revision_after': current}
    metadata.setdefault('proposal_content', message.content)
    metadata['execution_receipt'] = receipt
    metadata['execution_results'] = results
    message.content, message.metadata = content, metadata
    message.save(update_fields=['content', 'metadata'])
    return {'message_id': message.pk, 'client_request_id': request_id, 'content': content,
        'execution_results': results, 'execution_receipt': receipt}
