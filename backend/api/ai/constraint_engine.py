"""
Constraint Engine - Motor de Arbitragem e Hierarquia de Prioridades (P0 - P8).
Garante que restrições rígidas (P1) e proibições (P3) nunca sejam sobrescritas
por conhecimento recuperado do RAG (P7) ou padrões do sistema (P8).
"""
import logging
import copy
import colorsys
import hashlib
import json
import math
import re
import unicodedata
from typing import Dict, Any, List, Optional, Tuple
from .requirement_contract import RequirementContract

logger = logging.getLogger(__name__)


class ConstraintPriority:
    P0_SECURITY = 0             # Limitações técnicas reais e segurança
    P1_HARD_CONSTRAINTS = 1     # Restrições cardinais do usuário (páginas exatas, etc.)
    P2_MANDATORY_CONTENT = 2    # Conteúdo/produtos obrigatórios fornecidos pelo usuário
    P3_NEGATIVE_CONSTRAINTS = 3 # Itens e estilos expressamente proibidos
    P4_FORMAT_MEDIA = 4         # Dimensões e orientação de mídia
    P5_OBJECTIVE = 5            # Objetivo comunicacional
    P6_SOFT_PREFERENCES = 6     # Preferências estéticas explícitas
    P7_RAG_KNOWLEDGE = 7        # Conhecimento e referências recuperadas pelo RAG
    P8_DEFAULTS = 8             # Padrões do sistema


class ConstraintEngine:
    """
    Motor de resolução e validação de restrições por precedência formal.
    """

    # Limite físico aproximado de palavras legíveis por página A4 (corpo 8pt mínimo)
    MAX_WORDS_PER_A4_PAGE = 1200
    # Limite de produtos legíveis por página única (formato tabela/matriz)
    MAX_PRODUCTS_PER_ONE_PAGER = 50

    @classmethod
    def evaluate_feasibility(
        cls,
        contract: RequirementContract,
        product_count: int,
        word_count: int = 0,
    ) -> Tuple[bool, Optional[str]]:
        """
        Verifica a viabilidade física e consistência lógica do briefing.
        Retorna (is_feasible, conflict_reason).
        """
        page_count = contract.output.page_count
        mode = contract.output.page_count_mode

        # 1. Checagem de Impossibilidade Física de Texto
        if mode == "exact" and page_count:
            max_capacity = page_count * cls.MAX_WORDS_PER_A4_PAGE
            if word_count > max_capacity * 2:
                msg = (
                    f"PHYSICAL_IMPOSSIBILITY: Solicitação de {word_count} palavras em "
                    f"{page_count} página(s). Limite físico editorial para legibilidade é de "
                    f"aproximadamente {max_capacity} palavras."
                )
                logger.warning(f"[ConstraintEngine] {msg}")
                return False, msg

        # 2. Checagem de Impossibilidade Física de Produtos em Página Única
        if page_count == 1 and mode == "exact" and product_count > cls.MAX_PRODUCTS_PER_ONE_PAGER:
            msg = (
                f"PHYSICAL_IMPOSSIBILITY: Inclusão de {product_count} produtos em página única "
                f"ultrapassa o limite de renderização legível ({cls.MAX_PRODUCTS_PER_ONE_PAGER} itens)."
            )
            logger.warning(f"[ConstraintEngine] {msg}")
            return False, msg

        return True, None

    @classmethod
    def arbitrate_style_vs_constraints(
        cls,
        contract: RequirementContract,
        product_count: int,
    ) -> RequirementContract:
        """
        Arbitra conflitos entre preferências estéticas (P6) e restrições rígidas (P1/P2/P3).
        Se houver contradição, a restrição superior anula a inferior.
        """
        output = contract.output
        design = contract.design

        # Conflito: Usuário pediu 1 página com muitos produtos (>= 8) E estilo minimalista com muito whitespace
        if output.page_count == 1 and output.page_count_mode == "exact" and product_count >= 8:
            if design.whitespace > 40:
                logger.info(
                    "[ConstraintEngine] Arbitragem P1 x P6: Reduzindo whitespace de "
                    f"{design.whitespace}% para 25% para acomodar {product_count} produtos no One-Pager sem violar P1."
                )
                design.whitespace = 25
                design.density = max(design.density, 75)
                design.layout_behavior.append("dense_spec_matrix")

        # Conflito: Proibição de cards (P3) presente, mas estilo técnico solicitado
        if "NO_CARDS" in contract.constraints.negative:
            if "no_cards" not in design.layout_behavior:
                design.layout_behavior.append("no_cards")
            design.layout_behavior.append("ruled_lines_layout")

        # Conflito: Proibição de gradientes (P3)
        if "NO_GRADIENTS" in contract.constraints.negative:
            design.layout_behavior.append("flat_colors_only")

        # Conflito: Proibição de cores (P3) ou pedido de monocromia
        if "NO_COLORS" in contract.constraints.negative or design.allowed_color_space == "monochrome":
            design.allowed_color_space = "monochrome"
            design.color_preferences = ["#000000", "#FFFFFF", "#1A1A1A", "#F5F5F5"]

        return contract

    @classmethod
    def filter_retrieved_knowledge(
        cls,
        contract: RequirementContract,
        rag_templates: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """
        Filtra candidatos de conhecimento do RAG (P7) removendo itens que violem
        restrições negativas (P3) ou hard constraints (P1).
        Regra: P7 NUNCA pode sobrescrever P1-P6.
        """
        filtered = []
        negatives = set(contract.constraints.negative)

        for item in rag_templates:
            blueprint = item.get("blueprint_data", {})
            slug = item.get("slug", "").lower()
            category = item.get("category", "").lower()
            description = item.get("description", "").lower()

            # 1. Se o usuário proibiu cards e o template é puramente baseado em cards
            if "NO_CARDS" in negatives:
                if "card" in slug or "card" in description or blueprint.get("containerStyle") == "card":
                    logger.debug(f"[ConstraintEngine] Descartando template '{slug}' por violar NO_CARDS (P3).")
                    continue

            # 2. Se o usuário proibiu gradientes e o template força gradiente
            if "NO_GRADIENTS" in negatives:
                if "gradient" in slug or "gradient" in description or "gradient" in str(blueprint):
                    logger.debug(f"[ConstraintEngine] Descartando template '{slug}' por violar NO_GRADIENTS (P3).")
                    continue

            # 3. Se o usuário solicitou exatamente 1 página, descarta templates de capa/contracapa ceremoniais isolados
            if contract.output.page_count == 1 and contract.output.page_count_mode == "exact":
                if category in ["backcover", "divider"] and not item.get("is_one_pager_compatible", False):
                    continue

            filtered.append(item)

        return filtered


    @staticmethod
    def brand_snapshot_hash(context):
        return hashlib.sha256(json.dumps(context, sort_keys=True, ensure_ascii=False,
                                        separators=(',', ':'), allow_nan=False).encode()).hexdigest()

    @staticmethod
    def _rule_text(value):
        return unicodedata.normalize('NFKD', str(value)).encode('ascii', 'ignore').decode().lower()

    @classmethod
    def _font_in_rule(cls, font, text):
        return bool(re.search(r'(?<![a-z0-9])' + re.escape(cls._rule_text(font)) + r'(?![a-z0-9])', text))

    @classmethod
    def brand_rules(cls, context):
        """Compile confirmed structured records; original documents never become instructions."""
        rules = {'forbidden_colors': [], 'forbidden_fonts': [], 'avoid_serif': False,
                 'negative': [], 'required_logo': False, 'prefer_whitespace': False,
                 'forbidden_expressions': [], 'unsupported': [], 'required_font': None,
                 'logo_crop_forbidden': False, 'logo_recolor_forbidden': False}
        if not context:
            return rules
        accepted = {'confirmed', 'user_supplied'}
        for color in context.get('palette', []):
            if color.get('status') in accepted and color.get('role') == 'forbidden':
                rules['forbidden_colors'].append(color.get('hex', ''))
        records = context.get('guidelines', []) + context.get('confirmed_memories', [])
        for item in records:
            if item.get('status') not in accepted:
                continue
            kind, category = item.get('type', '').upper(), item.get('category', '').lower()
            text = cls._rule_text(item.get('rule', ''))
            if kind == 'PREFER' and any(t in text for t in ['whitespace', 'espaco', 'respiro']):
                rules['prefer_whitespace'] = True
            if kind in {'MUST', 'AVOID'}:
                supported = False
                if category == 'color' and kind == 'AVOID':
                    supported = bool(re.search(r'#[0-9a-f]{3,6}\b|gold|ouro|dourad|blue|azul|green|verde|red|vermelh|yellow|amarel|purple|roxo|violeta', text))
                elif category == 'typography' and kind == 'AVOID':
                    from .font_registry import ALL_VERIFIED_FONTS
                    supported = ('serif' in text and 'sans' not in text) or any(cls._font_in_rule(f, text) for f in ALL_VERIFIED_FONTS)
                elif category == 'typography' and kind == 'MUST':
                    from .font_registry import ALL_VERIFIED_FONTS
                    required = next((f for f in ALL_VERIFIED_FONTS if cls._font_in_rule(f, text)), None)
                    if required:
                        rules['required_font'] = required
                        supported = True
                elif category == 'logo':
                    policy_terms = ['propor', 'aspect', 'distort', 'distor', 'crop', 'recort', 'recolor', 'repet', 'oversized', 'superdimension']
                    inclusion = any(t in text for t in ['include', 'incluir', 'usar logo', 'use logo', 'exibir'])
                    # V1 does not compile prose quantities, per-page schedules or fixed coordinates.
                    # Do not claim that generic presence/default asset policy satisfies these rules.
                    qualified = bool(re.search(
                        r'\d|\b(?:once|twice|exactly|every|each|all|cada|todas?|todos?|exatamente)\b|'
                        r'\b(?:uma|duas|tres|one|two|three)\s+(?:vez|vezes|time|times)\b|'
                        r'\b(?:center|centre|central|centro|left|right|esquerda|direita)\b', text))
                    if kind == 'AVOID':
                        supported = any(t in text for t in policy_terms)
                    else:
                        preserve_ratio = (any(t in text for t in ['preserv', 'maintain', 'manter'])
                                          and any(t in text for t in ['propor', 'aspect', 'ratio']))
                        no_transform = (any(t in text for t in ['nao ', 'not ', 'no ', 'sem '])
                                        and any(t in text for t in ['crop', 'recort', 'recolor', 'distort', 'distor']))
                        supported = inclusion or preserve_ratio or no_transform or any(t in text for t in ['safe', 'segur'])
                    supported = supported and not qualified
                    if supported and kind == 'MUST' and inclusion: rules['required_logo'] = True
                    if supported and any(t in text for t in ['crop', 'recort']): rules['logo_crop_forbidden'] = True
                    if supported and 'recolor' in text: rules['logo_recolor_forbidden'] = True
                elif category == 'commercial':
                    # The existing commercial guard always enforces source truth, independent of Brand.
                    supported = (any(t in text for t in ['price', 'preco', 'sku', 'stock', 'estoque', 'invent', 'quant', 'especific', 'specification', 'integridade'])
                                 and any(t in text for t in ['preserv', 'manter', 'original', 'fornecid', 'nao alter', 'not change', 'unchanged', 'integrity', 'integridade'])
                                 and kind == 'MUST')
                elif category in {'photography', 'composition', 'other'} and kind == 'AVOID':
                    supported = any(t in text for t in ['photograph', 'photos', 'fotos', 'fotografia', 'cards', 'cartoes', 'gradient', 'gradiente', 'diagonal', 'overlap', 'sobreposicao'])
                if not supported:
                    rules['unsupported'].append(str(item.get('id', category)))
            if kind != 'AVOID':
                continue
            if category == 'color':
                colors = re.findall(r'#[0-9a-f]{6}\b|#[0-9a-f]{3}\b', text)
                names = {'gold': ['gold', 'ouro', 'dourad'], 'blue': ['blue', 'azul'],
                         'green': ['green', 'verde'], 'red': ['red', 'vermelh'],
                         'yellow': ['yellow', 'amarelo'], 'purple': ['purple', 'roxo', 'violeta']}
                colors += [name for name, words in names.items() if any(word in text for word in words)]
                rules['forbidden_colors'].extend(colors)
            if category == 'typography':
                if any(word in text for word in ['serif', 'serifa']) and 'sans' not in text:
                    rules['avoid_serif'] = True
                from .font_registry import ALL_VERIFIED_FONTS
                rules['forbidden_fonts'].extend(f for f in ALL_VERIFIED_FONTS if cls._font_in_rule(f, text))
            macros = {'NO_IMAGES': ['photography', 'photographs', 'photos', 'fotografia', 'fotos'],
                      'NO_CARDS': ['cards', 'cartoes'], 'NO_GRADIENTS': ['gradient', 'gradiente'],
                      'NO_DIAGONALS': ['diagonal'], 'NO_OVERLAP': ['overlap', 'sobreposicao']}
            if category in {'photography', 'composition', 'other'}:
                rules['negative'].extend(code for code, words in macros.items() if any(word in text for word in words))
        rules['forbidden_expressions'] = list((context.get('tone') or {}).get('forbidden_expressions', []))
        return rules

    @classmethod
    def apply_brand_context(cls, contract, brand_context):
        if not brand_context:
            return contract
        contract.brand_context = copy.deepcopy(brand_context)
        rules = cls.brand_rules(brand_context)
        for negative in rules['negative']:
            if negative not in contract.constraints.negative:
                contract.constraints.negative.append(negative)
        for item in brand_context.get('guidelines', []):
            if item.get('status') in {'confirmed', 'user_supplied'}:
                code = 'BRAND_' + item.get('type', 'PREFER').upper() + ':' + str(item.get('id', item.get('category', 'other')))
                target = contract.constraints.soft if item.get('type') == 'PREFER' else contract.constraints.hard
                if code not in target:
                    target.append(code)
        return contract

    @classmethod
    def color_forbidden(cls, value, rules):
        if not isinstance(value, str):
            return False
        value = value.lower()
        rgb = re.fullmatch(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)', value)
        if rgb and all(0 <= int(c) <= 255 for c in rgb.groups()):
            value = '#' + ''.join(f'{int(c):02x}' for c in rgb.groups())
        if re.fullmatch(r'#[0-9a-f]{3}', value):
            value = '#' + ''.join(c * 2 for c in value[1:])
        if not re.fullmatch(r'#[0-9a-f]{6}', value):
            return value in rules['forbidden_colors']
        h, sat, brightness = colorsys.rgb_to_hsv(*(int(value[i:i+2], 16) / 255 for i in (1,3,5)))
        hue = h * 360
        for forbidden in rules['forbidden_colors']:
            forbidden = str(forbidden).lower()
            if re.fullmatch(r'#[0-9a-f]{3}', forbidden):
                forbidden = '#' + ''.join(c * 2 for c in forbidden[1:])
            if forbidden == value:
                return True
            if sat < .25 or brightness < .15:
                continue
            if forbidden == 'gold' and 32 <= hue <= 65:
                return True
            if forbidden == 'yellow' and 45 <= hue <= 70:
                return True
            if forbidden == 'blue' and 190 <= hue <= 260:
                return True
            if forbidden == 'green' and 70 <= hue <= 175:
                return True
            if forbidden == 'red' and (hue <= 20 or hue >= 345):
                return True
            if forbidden == 'purple' and 260 <= hue <= 325:
                return True
        return False

    @classmethod
    def font_forbidden(cls, font, rules):
        from .font_registry import DEFAULT_FONT_REGISTRY
        serif = DEFAULT_FONT_REGISTRY.get('editorial_serif', []) + DEFAULT_FONT_REGISTRY.get('high_contrast_serif', [])
        return (font in rules['forbidden_fonts'] or
                (rules['avoid_serif'] and font in serif))

    @classmethod
    def brand_palette(cls, palette, context):
        if not context:
            return palette
        result = dict(palette)
        role_tokens = {'primary': 'primary', 'secondary': 'secondary', 'accent': 'accent',
                       'background': 'background', 'neutral': 'muted', 'support': 'surface'}
        colors = sorted(context.get('palette', []), key=lambda c: c.get('status') == 'user_supplied')
        for color in colors:
            token = role_tokens.get(color.get('role'))
            if token and color.get('status') in {'confirmed', 'user_supplied'}:
                value = color.get('hex')
                if isinstance(value, str) and re.fullmatch(r'#[0-9a-fA-F]{6}', value):
                    result[token] = value.upper()
        rules = cls.brand_rules(context)
        fallbacks = ['#141416', '#FFFFFF', '#71717A', '#000000']
        for token, value in result.items():
            if cls.color_forbidden(value, rules):
                safe = next((c for c in fallbacks if not cls.color_forbidden(c, rules)), None)
                if not safe:
                    raise ValueError('BRAND_PALETTE_CONFLICT')
                result[token] = safe
        return result

    @classmethod
    def logo_assets(cls, context):
        from .design_grammar import is_safe_image_url
        return [a for a in (context or {}).get('assets', [])
                if str(a.get('type', '')).startswith('logo') or a.get('type') in {'symbol', 'wordmark'}
                if is_safe_image_url(a.get('url'))]

    @classmethod
    def validate_brand_expression(cls, contract, document):
        """Final output audit, also used after repair; does not inspect/mutate commercial truth."""
        context = contract.brand_context
        if not context:
            return []
        rules = cls.brand_rules(context)
        errors = []
        pages = document.get('pages', [])
        for value in document.get('palette', {}).values():
            if cls.color_forbidden(value, rules):
                errors.append('BRAND_FORBIDDEN_COLOR: palette')
        assets = {a['url']: a for a in cls.logo_assets(context)}
        counts = {}
        for page in pages:
            for key in ['backgroundColor', 'textColor', 'accentColor']:
                if cls.color_forbidden(page.get(key), rules):
                    errors.append('BRAND_FORBIDDEN_COLOR: ' + key)
            for block in page.get('blocks', []):
                token = block.get('colorToken', 'primary')
                effective_color = {'primary': page.get('textColor'), 'background': page.get('backgroundColor'),
                                   'accent': page.get('accentColor'), 'muted': '#71717A', 'surface': '#FFFFFF'}.get(token, token)
                if cls.color_forbidden(effective_color, rules):
                    errors.append('BRAND_FORBIDDEN_COLOR: block')
                if cls.font_forbidden(block.get('fontFamily'), rules):
                    errors.append('BRAND_FORBIDDEN_FONT')
                if rules['required_font'] and block.get('fontFamily') and block['fontFamily'] != rules['required_font']:
                    errors.append('BRAND_REQUIRED_FONT')
                if block.get('role') == 'brand_hallmark':
                    asset = assets.get(block.get('imageUrl'))
                    if not asset:
                        errors.append('BRAND_UNKNOWN_LOGO_ASSET')
                        continue
                    policy = asset.get('policy') or {}
                    counts[asset['url']] = counts.get(asset['url'], 0) + 1
                    if (rules['logo_crop_forbidden'] or not policy.get('crop_allowed', False)) and block.get('cropMode') != 'contain':
                        errors.append('BRAND_LOGO_CROP_FORBIDDEN')
                    if (rules['logo_recolor_forbidden'] or not policy.get('recolor_allowed', False)) and (block.get('colorToken') not in {None, 'primary'} or block.get('opacity', 1) != 1):
                        errors.append('BRAND_LOGO_RECOLOR_FORBIDDEN')
                    if block.get('rotation', 0) != 0:
                        errors.append('BRAND_LOGO_ROTATION_FORBIDDEN')
                    width, height = asset.get('width'), asset.get('height')
                    if width and height and block.get('height'):
                        ratio = block['width'] * 490 / (block['height'] * 693)
                        if abs(ratio / (width / height) - 1) > .02:
                            errors.append('BRAND_LOGO_ASPECT_RATIO')
                    minimum_width = float(policy.get('minimum_width', 48))
                    minimum_width = minimum_width / 490 if minimum_width > 1 else minimum_width
                    if block.get('width', 0) < minimum_width - .001:
                        errors.append('BRAND_LOGO_TOO_SMALL')
                    if block.get('width', 0) > .35 or block.get('width', 0) * block.get('height', 0) > .08:
                        errors.append('BRAND_LOGO_OVERSIZED')
                    role = cls.brand_page_role(page.get('contentRole') or page.get('type'))
                    allowed = policy.get('allowed_page_roles') or ['cover', 'opening', 'backcover', 'closing', 'one_pager']
                    if role not in [cls.brand_page_role(r) for r in allowed]:
                        errors.append('BRAND_LOGO_PAGE_ROLE')
                    preferred_bg = policy.get('preferred_background', 'light')
                    from .visual_critic import VisualCritic
                    white_contrast = VisualCritic._calculate_color_contrast(page.get('backgroundColor', '#FFFFFF'), '#FFFFFF')
                    if preferred_bg == 'light' and white_contrast > 2:
                        errors.append('BRAND_LOGO_BACKGROUND')
                    if preferred_bg == 'dark' and white_contrast < 4.5:
                        errors.append('BRAND_LOGO_BACKGROUND')
                    if isinstance(preferred_bg, str) and preferred_bg.startswith('#') and page.get('backgroundColor', '').lower() != preferred_bg.lower():
                        errors.append('BRAND_LOGO_BACKGROUND')
                    safe = .04 + max(0, float(policy.get('safe_space', .5))) * min(block.get('width', 0), block.get('height', 0))
                    if (block.get('x', 0) < safe - .001 or block.get('y', 0) < safe - .001 or
                        block.get('x', 0) + block.get('width', 0) > 1-safe+.001 or
                        block.get('y', 0) + block.get('height', 0) > 1-safe+.001):
                        errors.append('BRAND_LOGO_SAFE_SPACE')
        for url, count in counts.items():
            maximum = cls.logo_maximum(assets[url].get('policy') or {}, document.get('totalPages', len(pages)))
            if count > maximum:
                errors.append('BRAND_LOGO_FREQUENCY')
        if document.get('brandSnapshot') is not None:
            errors.extend('BRAND_GUIDELINE_REQUIRES_REVIEW:' + gid for gid in rules['unsupported'])
        # Local candidate validation does not assert document-wide required presence.
        if rules['required_logo'] and document.get('brandSnapshot') is not None and not counts:
            errors.append('BRAND_REQUIRED_LOGO_MISSING')
        return sorted(set(errors))


    @staticmethod
    def brand_page_role(role):
        return {'opening': 'cover', 'closing': 'back_cover', 'backcover': 'back_cover',
                'manifesto': 'institutional', 'narrative': 'institutional'}.get(role, role)

    @staticmethod
    def logo_maximum(policy, pages):
        frequency = float(policy.get('maximum_frequency', .35))
        return max(0, math.ceil(frequency * max(1, pages))) if frequency <= 1 else int(frequency)
