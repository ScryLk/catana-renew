"""Private, bounded search evidence. Browser indices are never authority.

No OCR, PDF parsing or customer text is logged during command resolution. Source
appearance verification comes from the existing PDF adapter, not model guesses.
"""
import hashlib
import json
import math
import re
from api.models import DocumentImport
from api.services.document_reconstructor import _visible_rectangle as rectangle

INDEX_VERSION = 1
MAX_ENTRIES = 500
MAX_INDEX_CHARS = 32000
PROTECTED_ROLES = frozenset(('price', 'sku', 'quantity', 'technical_specs', 'product_name',
    'product_description', 'material', 'dimensions', 'reference_code', 'commercial_condition'))
PROTECTED_STYLE_ROLES = frozenset(('logo', 'logotype', 'brand_logo'))


def valid_font_weight(value):
    return type(value) is int and 100 <= value <= 900 and value % 100 == 0


def valid_style_revision(value):
    """Only the implemented visual capability can cross the source boundary."""
    return (isinstance(value, dict) and set(value) == {'fontWeight'}
            and valid_font_weight(value['fontWeight']))


def effective_font_weight(element, source=None):
    source = source or element
    revision = element.get('styleRevision')
    if valid_style_revision(revision):
        return revision['fontWeight']
    weight = source.get('fontWeight')
    return weight if valid_font_weight(weight) else 400


def font_weight_reliable(element, source=None):
    """Fallback family metadata is not proof of the original visible weight."""
    source = source or element
    if valid_style_revision(element.get('styleRevision')):
        return True
    confidence = source.get('fontResolutionConfidence')
    return (valid_font_weight(source.get('fontWeight'))
            and source.get('fontResolutionStatus') in ('exact', 'registry_alias')
            and type(confidence) in (int, float) and math.isfinite(confidence) and confidence >= .9)


def safe_element(element):
    if not isinstance(element, dict):
        return False
    appearance = element.get('appearance')
    return (element.get('type') == 'text' and element.get('editable') is True
        and isinstance(element.get('id'), str) and 0 < len(element['id']) <= 200
        and rectangle(element) and rectangle(appearance) and isinstance(appearance.get('asset'), dict)
        and bool(appearance['asset'].get('url')) and bool(appearance['asset'].get('hash'))
        and type(element.get('fontSize')) in (int, float) and math.isfinite(element['fontSize']) and 0 < element['fontSize'] <= 500
        and element.get('sourceVisible') is True and element.get('visibilityStatus') == 'sourceVisible'
        and all(type(element.get(k)) in (int, float) and math.isfinite(element[k]) and .9 <= element[k] <= 1
            for k in ('textExtractionConfidence', 'geometryConfidence', 'visibilityConfidence')))


def safe_readonly_text(element):
    """Painted source text may be readable even when removal is not pixel-safe.

    This does not admit hidden OCR, partial contributions or unproven ink and
    never grants mutation authority. The current private evidence must also be
    identical to the retained source before it enters the bounded index.
    """
    return (isinstance(element, dict) and element.get('type') == 'text'
        and isinstance(element.get('id'), str) and 0 < len(element['id']) <= 200
        and isinstance(element.get('text'), str) and rectangle(element)
        and type(element.get('fontSize')) in (int, float) and math.isfinite(element['fontSize']) and 0 < element['fontSize'] <= 500
        and element.get('sourceVisible') is True and element.get('visibilityStatus') == 'sourceVisible'
        and all(type(element.get(k)) in (int, float) and math.isfinite(element[k]) and .9 <= element[k] <= 1
            for k in ('textExtractionConfidence', 'geometryConfidence', 'visibilityConfidence')))


def immutable_element_fields(element):
    return {key: value for key, value in element.items()
            if key not in ('text', 'content', 'edited', 'styleRevision')}


def protected_text(text, element=None):
    element = element or {}
    if element.get('role') in PROTECTED_ROLES or element.get('bindingProduct') or element.get('productBinding'):
        return True
    provenance = element.get('provenance') or {}
    if provenance.get('productId') or provenance.get('productField'):
        return True
    # Numbers in editorial titles are legitimate. Require commercial context.
    return bool(re.search(r'(?:R\$|US\$|[$€£]|\b(?:SKU|MOQ|estoque|pre[cç]o|especifica[cç][aã]o|capacidade|dimens[oõ]es|quantidade|ref(?:er[eê]ncia)?)\b)', text, re.I))


def visual_groups(entries):
    """Short local lines only; adjacency must be unique in both directions."""
    singles = [e for e in entries if e.get('editable') is True and len(e['text']) <= 500 and e['text'].strip()
               and e.get('role') not in ('logo', 'footer', 'page_number', 'social', 'caption')]
    links = {}
    for upper in singles:
        a = upper['geometry']
        options = []
        for lower in singles:
            b = lower['geometry']
            if upper is lower or upper['page'] != lower['page'] or upper['commercial'] != lower['commercial']:
                continue
            if upper.get('role') != lower.get('role'):
                continue
            ratio = lower['fontSize'] / max(upper['fontSize'], 1)
            gap = b['y'] - (a['y'] + a['height'])
            aligned = abs(a['x'] - b['x']) <= max(.015, min(a['height'], b['height']) * .5)
            same_line = abs((a['y'] + a['height'] / 2) - (b['y'] + b['height'] / 2)) <= min(a['height'], b['height']) * .25
            word_gap = b['x'] - (a['x'] + a['width'])
            horizontal = same_line and -.002 <= word_gap <= min(a['height'], b['height']) * .8
            vertical = aligned and -.002 <= gap <= max(a['height'], b['height']) * .85
            if .65 <= ratio <= 1.55 and (horizontal or vertical):
                options.append(lower)
        if len(options) == 1:
            links[upper['target']] = options[0]
    predecessors = {}
    for source, target in links.items():
        predecessors.setdefault(target['target'], []).append(source)
    groups = []
    for first in singles:
        if first['target'] in predecessors:
            continue
        chain = [first]
        while len(chain) < 8 and chain[-1]['target'] in links:
            next_entry = links[chain[-1]['target']]
            if len(predecessors[next_entry['target']]) != 1 or next_entry in chain:
                break
            chain.append(next_entry)
        # Include contiguous subgroups for phrases within a paragraph/headline.
        for start in range(len(chain)):
            for end in range(start + 2, len(chain) + 1):
                members = chain[start:end]
                text = ' '.join(e['text'].strip() for e in members)
                if len(text) > 2000:
                    continue
                identity = hashlib.sha256('|'.join(e['target'] for e in members).encode()).hexdigest()[:20]
                groups.append({'id': f'group-{identity}', 'target': f"page:{first['page']}/group:{identity}",
                    'text': text, 'editable': True, 'commercial': any(e['commercial'] for e in members),
                    'visible': first['visible'], 'page': first['page'],
                    'members': [{'target': e['target'], 'text': e['text']} for e in members]})
                if len(groups) >= MAX_ENTRIES:
                    return groups
    return groups


def catalog_index(catalog, spread_index=0, selected=None, page_number=None, search_texts=None):
    """Caller has already authorized catalog write access; verify import scope too."""
    try:
        job = catalog.source_import
    except DocumentImport.DoesNotExist:
        return [], 'reanalyze_required'
    if (job.organization_id != catalog.organization_id or job.status != 'confirmed'
            or catalog.import_metadata.get('sourceFingerprint', job.source_fingerprint) != job.source_fingerprint):
        return [], 'invalid_target'
    previews = job.previews
    if not isinstance(previews, list) or not previews:
        from api.services.document_reconstructor import DocumentReconstructorService
        document = job.document_ir
        previews = DocumentReconstructorService._document_pages(document, job.mode) if isinstance(document, dict) and isinstance(document.get('pages'), list) else []
    if not previews:
        return [], 'reanalyze_required'
    if page_number is not None and not 1 <= page_number <= catalog.total_pages:
        return [], 'invalid_target'
    if catalog.import_metadata.get('mode') == 'preserve' or job.mode == 'preserve':
        return [], 'not_editable'
    if job.mode == 'redesign':
        return [], 'redesign'
    from api.ai.text_commands import normalize
    needles = [normalize(value) for value in (search_texts or []) if isinstance(value, str) and normalize(value)]
    entries = []
    budget = MAX_INDEX_CHARS - 2
    evidence_found = False
    legacy_evidence = False
    limited = False
    visible_pages = {spread_index * 2 + 1, spread_index * 2 + 2}
    spreads = list(catalog.spreads.order_by('spread_index')[:250])
    def priority(spread):
        contains_selected = any(isinstance(e, dict) and e.get('id') == selected
            for values in (spread.left_page_elements, spread.right_page_elements)
            if isinstance(values, list) for page in values if isinstance(page, dict)
            for e in (page.get('documentPage') or {}).get('elements', [])) if selected else False
        return (not contains_selected, spread.spread_index != spread_index, spread.spread_index)
    spreads.sort(key=priority)
    for spread in spreads:
        for side, values in enumerate((spread.left_page_elements, spread.right_page_elements)):
            number = spread.spread_index * 2 + side + 1
            if page_number is not None and number != page_number:
                continue
            if not isinstance(values, list) or len(values) != 1 or not isinstance(values[0], dict):
                continue
            from api.services.catalog_page_origin import source_number, origin
            source_no = source_number(values[0])
            if origin(values[0], catalog) == 'catana_authored' or type(source_no) is not int or not 1 <= source_no <= len(previews):
                continue
            source_page = previews[source_no - 1].get('documentPage') or {}
            current_page = values[0].get('documentPage') or {}
            if any(current_page.get(k) != source_page.get(k) for k in ('width', 'height', 'unit')):
                continue
            from api.services.document_reconstructor import public_import_page
            projected_source = public_import_page(previews[source_no - 1])
            projected_elements = {e['id']: e for e in projected_source['documentPage']['elements']} if projected_source else {}
            source_elements = {e.get('id'): e for e in source_page.get('elements', []) if isinstance(e, dict)}
            evidence_found = evidence_found or any(isinstance(e.get('text'), str) for e in source_elements.values())
            legacy_evidence = legacy_evidence or any(e.get('editable') is True
                and ('visibilityConfidence' not in e or 'sourceVisible' not in e)
                for e in source_elements.values())
            if current_page.get('visibility') == 'source_only' or not source_page.get('fallbackSnapshot'):
                continue
            current_elements = current_page.get('elements', [])[:5000]
            current_elements.sort(key=lambda element: not (isinstance(element, dict) and element.get('id') == selected))
            for current in current_elements:
                if not isinstance(current, dict):
                    continue
                source = source_elements.get(current.get('id'))
                editable = safe_element(source)
                if not editable and (not safe_readonly_text(source) or current != source):
                    continue
                if editable and not safe_element(current):
                    # Older catalogs may persist only render fields. Missing evidence
                    # is supplied by the private source, never by a client approval flag.
                    if 'sourceVisible' in current:
                        continue
                    projected = projected_elements.get(current.get('id'))
                    comparison = dict(current)
                    revision = comparison.pop('styleRevision', None)
                    if 'styleRevision' in current and not valid_style_revision(revision):
                        continue
                    for key in ('text', 'content', 'edited'):
                        comparison.pop(key, None)
                    provenance = comparison.pop('provenance', None)
                    if provenance not in (None, {'sourceText': source.get('text')}):
                        continue
                    expected = {k: v for k, v in (projected or {}).items() if k not in ('text', 'content', 'edited')}
                    if not projected or comparison != expected:
                        continue
                    current = {**source, 'text': current.get('text', source.get('text')), 'edited': current.get('edited') is True,
                               **({'styleRevision': revision} if revision is not None else {})}
                if 'styleRevision' in current and not valid_style_revision(current['styleRevision']):
                    continue
                if immutable_element_fields(current) != immutable_element_fields(source):
                    continue
                text = current.get('text') if current.get('edited') is True else source.get('text')
                if not isinstance(text, str) or len(text) > 2000:
                    continue
                # Search all retained source pages, then budget only relevant
                # evidence. Adding typography must not make a unique cover
                # command ambiguous merely because unrelated text fills 32 KB.
                # Include constituents of a full phrase so safe visual groups
                # remain available across native text objects.
                from api.ai.prompt_envelope import data_section
                if needles and current.get('id') != selected and not any(
                        needle in normalize(text) or normalize(text) in needle for needle in needles) and not data_section(text)[1]:
                    continue
                entry = {'id': source['id'], 'target': f"page:{number}/element:{source['id']}", 'page': number,
                    'text': text, 'editable': editable, 'commercial': protected_text(source.get('text', ''), source) or protected_text(text, source),
                    'visible': number in visible_pages, 'role': source.get('role'),
                    'geometry': {k: source[k] for k in ('x', 'y', 'width', 'height')}, 'fontSize': source.get('fontSize', 12),
                    'resolvedFont': source.get('resolvedFont'), 'fontStyle': source.get('fontStyle', 'normal'),
                    'fontWeight': effective_font_weight(current, source),
                    'effectiveFontWeight': effective_font_weight(current, source),
                    'fontWeightReliable': font_weight_reliable(current, source)}
                cost = len(json.dumps(entry, ensure_ascii=False)) + 2
                if len(entries) < MAX_ENTRIES and cost <= budget:
                    entries.append(entry)
                    budget -= cost
                else:
                    limited = True
    groups = visual_groups(entries)
    if len(groups) >= MAX_ENTRIES:
        limited = True
    for group in groups:
        cost = len(json.dumps(group, ensure_ascii=False)) + 2
        if len(entries) >= MAX_ENTRIES or cost > budget:
            limited = True
            break
        entries.append(group)
        budget -= cost
    state = 'limited' if limited else 'ready' if entries else 'not_editable' if evidence_found else 'reanalyze_required'
    if not entries and legacy_evidence:
        state = 'reanalyze_required'
    if selected is not None and (not isinstance(selected, str) or len(selected) > 200 or not any(e['id'] == selected for e in entries)):
        state = 'invalid_target'
    return entries, state


def validate_patch(patch, entries):
    """Only imported source text actions pass this boundary."""
    if not isinstance(patch, dict) or not isinstance(patch.get('actions'), list) or not 1 <= len(patch['actions']) <= 100 or patch.get('updates'):
        return None
    indexed = {entry['target']: entry for entry in entries}
    accepted = []
    for action in patch['actions']:
        if not isinstance(action, dict) or action.get('action', action.get('type')) not in ('update_text', 'update_text_group', 'update_text_style'):
            return None
        target = action.get('target')
        if not isinstance(target, str) or len(target) > 250:
            return None
        entry = indexed.get(target)
        params = action.get('params')
        kind = action.get('action', action.get('type'))
        if kind == 'update_text_style':
            if (not entry or entry.get('commercial') or entry.get('role') in PROTECTED_STYLE_ROLES
                    or not entry.get('editable') or entry.get('members')
                    or not isinstance(params, dict) or set(params) != {'fontWeight', 'expectedFontWeight', 'expectedText'}
                    or not valid_font_weight(params['fontWeight']) or not valid_font_weight(params['expectedFontWeight'])
                    or params['expectedFontWeight'] != entry.get('fontWeight') or params['expectedText'] != entry.get('text')):
                return None
            accepted.append({'action': kind, 'type': kind, 'target': target, 'params': dict(params)})
            continue
        if not entry or not entry.get('editable') or entry['commercial'] or not isinstance(params, dict) or set(params) - {'find','replacement','text','expectedText','members'}:
            return None
        replacement = params.get('replacement', params.get('text'))
        if not isinstance(replacement, str) or len(replacement) > 2000 or protected_text(replacement):
            return None
        if params.get('expectedText') != entry['text']:
            return None
        if 'find' in params:
            from api.ai.text_commands import normalize
            find = params['find']
            if (not isinstance(find, str) or not 0 < len(find) <= 2000
                    or not normalize(find) or normalize(entry['text']).count(normalize(find)) != 1):
                return None
        if entry.get('members'):
            if action.get('action', action.get('type')) != 'update_text_group' or params.get('members') != entry['members'] or params.get('find') != entry['text']:
                return None
        elif action.get('action', action.get('type')) != 'update_text':
            return None
        kind = action.get('action', action.get('type'))
        accepted.append({'action': kind, 'type': kind, 'target': target, 'params': params})
    return {'actions': accepted, 'summary': 'Edição proposta; aguardando execução.',
            'planner_status': 'proposed', 'resolver_version': INDEX_VERSION}
