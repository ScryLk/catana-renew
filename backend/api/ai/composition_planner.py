"""
Composition Planner - Construtor Generativo de Layouts e Blocos Espaciais.
Compõe pranchetas dinamicamente utilizando primitives, coordenadas normalizadas (0.0 a 1.0)
e safe areas, respeitando a narrativa editorial e o VisualDNA.
Utiliza o CompositionCandidateGenerator para gerar candidatos espaciais e selecionar
o arranjo vencedor, mantendo métodos de composição como safe recipes.
"""
from typing import Dict, Any, List, Optional
import random
import logging
from .requirement_contract import RequirementContract
from .visual_dna import VisualDNA
from .creative_director import CreativeDirection
from .narrative_planner import PageNarrativePlan
from .design_grammar import GenerativeBlock, GenerativeCompositionMeta, GenerativeGridSpec
from .composition_mutator import fit_block_to_safe_area, DEFAULT_SAFE_AREA
from .composition_candidates import CompositionCandidateGenerator

logger = logging.getLogger(__name__)


class CompositionPlanner:
    """
    Planejador e Compositor de Blocos Generativos.
    Elimina templates fixos e projeta geometrias exclusivas por prancheta.
    """

    SAFE_AREA = {"top": 0.04, "right": 0.04, "bottom": 0.04, "left": 0.04}

    @classmethod
    def compose_page(
        cls,
        narrative: PageNarrativePlan,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        contract: RequirementContract,
        page_dict: Dict[str, Any],
        palette: Dict[str, str],
        creative_seed: int = 42,
        previous_pages: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Gera a composição completa explorando múltiplos candidatos espaciais e elegendo a melhor prancheta.
        """
        page_num = narrative.page_number
        role = narrative.content_role
        prods = page_dict.get("products", [])
        title = str(page_dict.get("title", f"PÁGINA {page_num:02d}")).strip()
        subtitle = str(page_dict.get("subtitle", "")).strip()
        content = str(page_dict.get("content", "")).strip()
        quote = str(page_dict.get("quote", "")).strip()
        folio_str = str(page_dict.get("folio", f"{page_num:02d}")).strip()
        has_images = contract.assets.has_product_images and "NO_IMAGES" not in contract.constraints.negative
        font_p = direction.font_pairing

        balance = "axial" if visual_dna.symmetry > 0.65 else "asymmetric"
        grid_cols = 12 if visual_dna.grid_rigidity > 0.6 else 8
        base_blocks: List[GenerativeBlock] = []
        cls._dispatch_composition(
            role=role, page_num=page_num, blocks=base_blocks, title=title, subtitle=subtitle,
            content=content, quote=quote, folio=folio_str, visual_dna=visual_dna,
            direction=direction, font_p=font_p, palette=palette,
            rng=random.Random(creative_seed + page_num * 101), has_images=has_images,
            page_dict=page_dict, is_one_pager=(role == "one_pager"), prods=prods,
            axis_override=narrative.layout_axis,
        )
        for block in base_blocks:
            fit_block_to_safe_area(block.__dict__, cls.SAFE_AREA)
            if block.productId is not None and block.type == 'text':
                block.role = 'product_description' if block.role == 'body' else 'product_name'
        candidates = CompositionCandidateGenerator.generate_candidates(
            [b.to_dict() for b in base_blocks], role, visual_dna, contract, page_dict, creative_seed, previous_pages)
        if not candidates:
            raise ValueError('NO_VALID_COMPOSITION_CANDIDATE')
        winner = max(candidates, key=lambda c: c['score'])
        winner_blocks = [GenerativeBlock(**b) for b in winner['blocks']]
        winner_axis = winner['axis']

        # Adiciona o fólio editorial discreto se ainda não existir
        if not any(b.role == "folio" for b in winner_blocks):
            folio_x = 0.06 if winner_axis == "asymmetric_right" else 0.82
            winner_blocks.append(
                GenerativeBlock(
                    id=f"p{page_num}-folio",
                    type="folio",
                    role="folio",
                    x=folio_x,
                    y=0.94,
                    width=0.12,
                    height=0.03,
                    fontRole="metadata",
                    fontFamily=font_p.get("metadata", "monospace"),
                    fontSize=9,
                    colorToken="primary",
                    alignment="right" if folio_x > 0.5 else "left",
                    content=folio_str,
                    zIndex=10,
                )
            )

        # Regra de Ouro (Item 14 & 38): Todo bloco vencedor passa imediatamente pelo ajuste de Safe Area
        for b in winner_blocks:
            fit_block_to_safe_area(b.__dict__, cls.SAFE_AREA)

        final_meta = GenerativeCompositionMeta(
            grid=GenerativeGridSpec(columns=grid_cols, rows=16, gutter=0.02),
            balance=balance,
            axis=winner_axis,
            whitespaceRatio=narrative.whitespace_target,
            visualTension=visual_dna.axis_tension,
            dominantPrimitive=narrative.dominant_primitive,
        )

        return {
            "composition": {**final_meta.to_dict(), "candidateCount": len(candidates),
                "candidateSelected": winner['candidateId'], "candidateStrategy": winner['strategy'],
                "candidateScore": winner['score'], "candidateScoreBreakdown": winner['scoreBreakdown'],
                "candidates": [{k: v for k, v in c.items() if k != 'blocks'} for c in candidates]},
            "safeArea": cls.SAFE_AREA,
            "blocks": [b.to_dict() for b in winner_blocks],
        }

    @classmethod
    def _dispatch_composition(
        cls,
        role: str,
        page_num: int,
        blocks: List[GenerativeBlock],
        title: str,
        subtitle: str,
        content: str,
        quote: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        has_images: bool,
        page_dict: Dict[str, Any],
        is_one_pager: bool,
        prods: List[Dict[str, Any]],
        axis_override: Optional[str] = None,
    ):
        """Despacha a composição para a receita espacial correspondente."""
        if role in ["opening", "one_pager"] and page_num == 1:
            cls._compose_opening_page(
                blocks=blocks,
                title=title,
                subtitle=subtitle,
                content=content,
                folio=folio,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
                page_dict=page_dict,
                is_one_pager=is_one_pager,
                prods=prods,
                axis_override=axis_override,
            )
        elif role in ["manifesto"]:
            cls._compose_manifesto_page(
                blocks=blocks,
                title=title,
                subtitle=subtitle,
                content=content,
                quote=quote,
                folio=folio,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                axis_override=axis_override,
            )
        elif role in ["product_reveal"]:
            cls._compose_product_reveal_page(
                blocks=blocks,
                prods=prods,
                title=title,
                subtitle=subtitle,
                folio=folio,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
                axis_override=axis_override,
            )
        elif role in ["product_dialogue"]:
            cls._compose_product_dialogue_page(
                blocks=blocks,
                prods=prods,
                title=title,
                subtitle=subtitle,
                folio=folio,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
                axis_override=axis_override,
            )
        elif role in ["product_system"]:
            cls._compose_product_system_page(
                blocks=blocks,
                prods=prods,
                title=title,
                subtitle=subtitle,
                folio=folio,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
                axis_override=axis_override,
            )
        else:
            cls._compose_closing_page(
                blocks=blocks,
                title=title,
                subtitle=subtitle,
                content=content,
                folio=folio,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                axis_override=axis_override,
            )

    # ---------------- COMPOSIÇÃO DE ABERTURA / CAPA ----------------
    @classmethod
    def _compose_opening_page(
        cls,
        blocks: List[GenerativeBlock],
        title: str,
        subtitle: str,
        content: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        has_images: bool,
        page_dict: Dict[str, Any],
        is_one_pager: bool = False,
        prods: Optional[List[Dict[str, Any]]] = None,
        axis_override: Optional[str] = None,
    ):
        """Compõe a prancheta de capa com hierarquia monumental e anti-clichê."""
        is_asymmetric = visual_dna.symmetry < 0.60 or (axis_override and "asymmetric" in axis_override)
        headline_align = "left" if is_asymmetric else "center"
        headline_x = 0.06 if is_asymmetric else 0.12
        headline_w = 0.88 if is_asymmetric else 0.76

        headline_size = round(32.0 + (visual_dna.scale_jump * 22.0), 1)
        headline_y = 0.28 if visual_dna.whitespace_ratio > 0.45 else 0.20

        # 1. Headline Monumental
        blocks.append(
            GenerativeBlock(
                id="cover-headline",
                type="text",
                role="headline",
                x=round(headline_x, 3),
                y=round(headline_y, 3),
                width=round(headline_w, 3),
                height=0.22,
                fontRole="display",
                fontFamily=font_p.get("display", "serif"),
                fontSize=headline_size,
                fontWeight=400 if "serif" in font_p.get("display", "").lower() else 600,
                lineHeight=1.05,
                alignment=headline_align,
                textTransform="uppercase",
                letterSpacing="0.08em",
                colorToken="primary",
                content=title,
                zIndex=3,
            )
        )

        # 2. Subtítulo / Statement de Arte
        sub_y = headline_y + 0.24
        sub_x = headline_x if is_asymmetric else 0.15
        blocks.append(
            GenerativeBlock(
                id="cover-subtitle",
                type="text",
                role="subtitle",
                x=round(sub_x, 3),
                y=round(min(0.85, sub_y), 3),
                width=round(headline_w, 3),
                height=0.06,
                fontRole="body",
                fontFamily=font_p.get("body", "sans-serif"),
                fontSize=11,
                fontWeight=500,
                alignment=headline_align,
                textTransform="uppercase",
                letterSpacing="0.25em",
                colorToken="accent",
                content=subtitle or direction.concept_statement,
                zIndex=3,
            )
        )

        # 3. Logo / Selo de Marca
        logo_img = page_dict.get("editorialImage")
        if logo_img:
            blocks.append(
                GenerativeBlock(
                    id="cover-logo",
                    type="image",
                    role="brand_hallmark",
                    x=0.06 if is_asymmetric else 0.42,
                    y=0.06,
                    width=0.16,
                    height=0.08,
                    cropMode="contain",
                    imageUrl=logo_img,
                    zIndex=4,
                )
            )

        # 4. Prosa editorial de posicionamento
        if content:
            blocks.append(
                GenerativeBlock(
                    id="cover-manifesto-snippet",
                    type="text",
                    role="body",
                    x=round(headline_x, 3),
                    y=round(min(0.82, sub_y + 0.12), 3),
                    width=round(min(0.65, headline_w), 3),
                    height=0.14,
                    fontRole="body",
                    fontFamily=font_p.get("body", "sans-serif"),
                    fontSize=12,
                    fontWeight=300,
                    alignment="left",
                    colorToken="muted",
                    content=content[:240],
                    zIndex=2,
                )
            )

    # ---------------- COMPOSIÇÃO DE MANIFESTO ----------------
    @classmethod
    def _compose_manifesto_page(
        cls,
        blocks: List[GenerativeBlock],
        title: str,
        subtitle: str,
        content: str,
        quote: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        axis_override: Optional[str] = None,
    ):
        """Compõe prancheta de manifesto ou pausa contemplativa."""
        is_right = (axis_override and "right" in axis_override)
        lead_x = 0.48 if is_right else 0.08
        lead_w = 0.46

        # Seção de cabeçalho sutil
        blocks.append(
            GenerativeBlock(
                id="manifesto-category",
                type="text",
                role="category_label",
                x=round(lead_x, 3),
                y=0.12,
                width=round(lead_w, 3),
                height=0.04,
                fontRole="metadata",
                fontFamily=font_p.get("metadata", "monospace"),
                fontSize=10,
                textTransform="uppercase",
                letterSpacing="0.25em",
                colorToken="accent",
                content=subtitle or "MANIFESTO EDITORIAL",
                zIndex=2,
            )
        )

        quote_text = quote or "O essencial, executado sem pressa e sem concessões."
        blocks.append(
            GenerativeBlock(
                id="manifesto-quote",
                type="quote",
                role="pull_quote",
                x=round(lead_x, 3),
                y=0.20,
                width=round(lead_w, 3),
                height=0.28,
                fontRole="display",
                fontFamily=font_p.get("display", "serif"),
                fontSize=24,
                fontWeight=400,
                lineHeight=1.35,
                colorToken="primary",
                content=f'"{quote_text}"',
                zIndex=3,
            )
        )

        body_text = content or (
            "Cada forma nasce da função, despida de artifícios. "
            "A nobreza dos materiais e a precisão do corte estabelecem um diálogo silencioso entre tradição e contemporaneidade."
        )
        blocks.append(
            GenerativeBlock(
                id="manifesto-body",
                type="text",
                role="body",
                x=round(lead_x, 3),
                y=0.52,
                width=round(lead_w, 3),
                height=0.34,
                fontRole="body",
                fontFamily=font_p.get("body", "sans-serif"),
                fontSize=13,
                fontWeight=300,
                lineHeight=1.65,
                colorToken="muted",
                content=body_text,
                zIndex=2,
            )
        )

    # ---------------- COMPOSIÇÃO DE PRODUTO INDIVIDUAL (HERO) ----------------
    @classmethod
    def _compose_product_reveal_page(
        cls,
        blocks: List[GenerativeBlock],
        prods: List[Dict[str, Any]],
        title: str,
        subtitle: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        has_images: bool,
        axis_override: Optional[str] = None,
    ):
        """Compõe prancheta com 1 produto dominante em arranjo escultural assimétrico."""
        prod = prods[0] if prods else {"name": title, "price": None, "sku": None, "description": ""}

        is_left_photo = (axis_override == "asymmetric_left") or (visual_dna.symmetry < 0.45 and axis_override != "asymmetric_right")
        photo_x = 0.04 if is_left_photo else 0.44
        photo_w = 0.52
        photo_y = 0.08
        photo_h = 0.68

        # 1. Fotografia monumental
        img_url = prod.get("image") or ""
        if has_images and img_url:
            blocks.append(
                GenerativeBlock(
                    id=f"prod-{prod.get('id', '1')}-photo",
                    type="product_image",
                    role="hero_image",
                    x=round(photo_x, 3),
                    y=round(photo_y, 3),
                    width=round(photo_w, 3),
                    height=round(photo_h, 3),
                    cropMode="editorial",
                    imageUrl=img_url,
                    productId=prod.get("id"),
                    zIndex=2,
                )
            )

        # 2. Informações de texto em contra-ponto espacial
        has_photo = bool(has_images and img_url)
        text_x = (photo_x + photo_w + 0.04) if (has_photo and is_left_photo) else 0.06
        text_w = 0.38 if has_photo else 0.86

        # Categoria e SKU (se SKU não fornecido, não inventa)
        cat_val = prod.get("category", "PEÇA ÚNICA")
        meta_content = str(cat_val or "")

        blocks.append(
            GenerativeBlock(
                id=f"prod-{prod.get('id', '1')}-meta",
                type="metadata",
                role="category",
                x=round(text_x, 3),
                y=0.18,
                width=round(text_w, 3),
                height=0.04,
                fontRole="metadata",
                fontFamily=font_p.get("metadata", "monospace"),
                fontSize=10,
                textTransform="uppercase",
                letterSpacing="0.2em",
                colorToken="accent",
                content=meta_content,
                zIndex=3,
            )
        )

        # Nome do Produto
        blocks.append(
            GenerativeBlock(
                id=f"prod-{prod.get('id', '1')}-name",
                type="text",
                role="headline",
                x=round(text_x, 3),
                y=0.24,
                width=round(text_w, 3),
                height=0.16,
                fontRole="display",
                fontFamily=font_p.get("display", "serif"),
                fontSize=26,
                fontWeight=500,
                alignment="left",
                colorToken="primary",
                content=prod.get("name", title),
                productId=prod.get("id"),
                zIndex=3,
            )
        )

        # Preço: Inviolabilidade Comercial (Item 10) - Se ausente, usa None
        price_val = prod.get("price")
        if price_val:
            blocks.append(
                GenerativeBlock(
                    id=f"prod-{prod.get('id', '1')}-price",
                    type="price",
                    role="price",
                    x=round(text_x, 3),
                    y=0.42,
                    width=round(text_w, 3),
                    height=0.06,
                    fontRole="body",
                    fontFamily=font_p.get("body", "sans-serif"),
                    fontSize=18,
                    fontWeight=600,
                    alignment="left",
                    colorToken="primary",
                    content=price_val,
                    productId=prod.get("id"),
                    zIndex=3,
                )
            )

        # Descrição sensorial
        if prod.get("description"):
            blocks.append(
                GenerativeBlock(
                    id=f"prod-{prod.get('id', '1')}-desc",
                    type="text",
                    role="body",
                    x=round(text_x, 3),
                    y=0.50,
                    width=round(text_w, 3),
                    height=0.26,
                    fontRole="body",
                    fontFamily=font_p.get("body", "sans-serif"),
                    fontSize=12,
                    fontWeight=300,
                    lineHeight=1.65,
                    alignment="left",
                    colorToken="muted",
                    content=prod.get("description", ""),
                    productId=prod.get("id"),
                    zIndex=2,
                )
            )

    # ---------------- COMPOSIÇÃO DE DIÁLOGO DE DOIS PRODUTOS (DUO) ----------------
    @classmethod
    def _compose_product_dialogue_page(
        cls,
        blocks: List[GenerativeBlock],
        prods: List[Dict[str, Any]],
        title: str,
        subtitle: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        has_images: bool,
        axis_override: Optional[str] = None,
    ):
        """Compõe 2 produtos com descolamento óptico dinâmico."""
        p1 = prods[0] if len(prods) > 0 else {}
        p2 = prods[1] if len(prods) > 1 else {}

        y1 = 0.12
        x1 = 0.06
        w1 = 0.42
        h_photo1 = 0.38

        y2 = 0.38 if visual_dna.symmetry < 0.6 else 0.12
        x2 = 0.52
        w2 = 0.42
        h_photo2 = 0.38

        for idx, (p, px, py, pw, ph) in enumerate([(p1, x1, y1, w1, h_photo1), (p2, x2, y2, w2, h_photo2)]):
            if not p:
                continue
            pid = p.get("id", str(idx + 1))
            img_url = p.get("image")

            if has_images and img_url:
                blocks.append(
                    GenerativeBlock(
                        id=f"duo-{pid}-photo",
                        type="product_image",
                        role="primary_photo",
                        x=round(px, 3),
                        y=round(py, 3),
                        width=round(pw, 3),
                        height=round(ph, 3),
                        cropMode="editorial",
                        imageUrl=img_url,
                        productId=pid,
                        zIndex=2,
                    )
                )

            # Nome
            blocks.append(
                GenerativeBlock(
                    id=f"duo-{pid}-name",
                    type="text",
                    role="headline",
                    x=round(px, 3),
                    y=round(py + ph + 0.02, 3),
                    width=round(pw, 3),
                    height=0.08,
                    fontRole="display",
                    fontFamily=font_p.get("display", "serif"),
                    fontSize=18,
                    fontWeight=500,
                    alignment="left",
                    colorToken="primary",
                    content=p.get("name", f"Peça {idx + 1:02d}"),
                    productId=pid,
                    zIndex=3,
                )
            )

            # Preço: Inviolabilidade Comercial (Item 10)
            p_price = p.get("price")
            if p_price:
                blocks.append(
                    GenerativeBlock(
                        id=f"duo-{pid}-price",
                        type="price",
                        role="price",
                        x=round(px, 3),
                        y=round(py + ph + 0.10, 3),
                        width=round(pw, 3),
                        height=0.04,
                        fontRole="body",
                        fontFamily=font_p.get("body", "sans-serif"),
                        fontSize=14,
                        fontWeight=600,
                        alignment="left",
                        colorToken="primary",
                        content=p_price,
                        productId=pid,
                        zIndex=3,
                    )
                )

    # ---------------- COMPOSIÇÃO DE MATRIZ DE PRODUTOS ----------------
    @classmethod
    def _compose_product_system_page(
        cls,
        blocks: List[GenerativeBlock],
        prods: List[Dict[str, Any]],
        title: str,
        subtitle: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        has_images: bool,
        axis_override: Optional[str] = None,
    ):
        """Compõe 3 ou 4 produtos de forma organizada e proporcional."""
        blocks.append(
            GenerativeBlock(
                id="sys-header-label",
                type="text",
                role="label",
                x=0.06,
                y=0.06,
                width=0.88,
                height=0.04,
                fontRole="metadata",
                fontFamily=font_p.get("metadata", "monospace"),
                fontSize=10,
                textTransform="uppercase",
                letterSpacing="0.25em",
                colorToken="accent",
                content=subtitle or "SELEÇÃO CURADA · ESPECIFICAÇÕES",
                zIndex=2,
            )
        )

        display_prods = prods[:4] if prods else []
        coords_4 = [
            (0.06, 0.12, 0.42, 0.36),
            (0.52, 0.12, 0.42, 0.36),
            (0.06, 0.52, 0.42, 0.36),
            (0.52, 0.52, 0.42, 0.36),
        ]

        for idx, p in enumerate(display_prods):
            if idx >= len(coords_4):
                break
            px, py, pw, ph = coords_4[idx]
            pid = p.get("id", str(idx + 1))
            photo_h = 0.22

            img_url = p.get("image")
            if has_images and img_url:
                blocks.append(
                    GenerativeBlock(
                        id=f"grid-{pid}-photo",
                        type="product_image",
                        role="catalog_thumb",
                        x=round(px, 3),
                        y=round(py, 3),
                        width=round(pw, 3),
                        height=round(photo_h, 3),
                        cropMode="cover",
                        imageUrl=img_url,
                        productId=pid,
                        zIndex=2,
                    )
                )

            blocks.append(
                GenerativeBlock(
                    id=f"grid-{pid}-info",
                    type="text",
                    role="headline",
                    x=round(px, 3),
                    y=round(py + photo_h + 0.02, 3),
                    width=round(pw, 3),
                    height=0.06,
                    fontRole="display",
                    fontFamily=font_p.get("display", "serif"),
                    fontSize=15,
                    fontWeight=500,
                    alignment="left",
                    colorToken="primary",
                    content=p.get("name", f"Item {idx + 1}"),
                    productId=pid,
                    zIndex=3,
                )
            )

            p_price = p.get("price")
            if p_price:
                blocks.append(
                    GenerativeBlock(
                        id=f"grid-{pid}-price",
                        type="price",
                        role="price",
                        x=round(px, 3),
                        y=round(py + photo_h + 0.07, 3),
                        width=round(pw, 3),
                        height=0.04,
                        fontRole="body",
                        fontFamily=font_p.get("body", "sans-serif"),
                        fontSize=13,
                        fontWeight=600,
                        alignment="left",
                        colorToken="primary",
                        content=p_price,
                        productId=pid,
                        zIndex=3,
                    )
                )

    # ---------------- COMPOSIÇÃO DE ENCERRAMENTO (CONTRACAPA) ----------------
    @classmethod
    def _compose_closing_page(
        cls,
        blocks: List[GenerativeBlock],
        title: str,
        subtitle: str,
        content: str,
        folio: str,
        visual_dna: VisualDNA,
        direction: CreativeDirection,
        font_p: Dict[str, str],
        palette: Dict[str, str],
        rng: random.Random,
        axis_override: Optional[str] = None,
    ):
        """Compõe a contracapa com dignidade tipográfica e informações de contato."""
        align = "left" if visual_dna.symmetry < 0.55 else "center"
        head_x = 0.06 if align == "left" else 0.15
        head_w = 0.88 if align == "left" else 0.70

        blocks.append(
            GenerativeBlock(
                id="closing-label",
                type="text",
                role="label",
                x=round(head_x, 3),
                y=0.10,
                width=round(head_w, 3),
                height=0.04,
                fontRole="metadata",
                fontFamily=font_p.get("metadata", "monospace"),
                fontSize=10,
                textTransform="uppercase",
                letterSpacing="0.25em",
                colorToken="accent",
                content="COLOPHON · EDIÇÃO EXCLUSIVA",
                zIndex=2,
            )
        )

        blocks.append(
            GenerativeBlock(
                id="closing-title",
                type="text",
                role="headline",
                x=round(head_x, 3),
                y=0.36,
                width=round(head_w, 3),
                height=0.18,
                fontRole="display",
                fontFamily=font_p.get("display", "serif"),
                fontSize=26,
                fontWeight=400,
                alignment=align,
                textTransform="uppercase",
                letterSpacing="0.12em",
                colorToken="primary",
                content=title,
                zIndex=3,
            )
        )

        blocks.append(
            GenerativeBlock(
                id="closing-contact",
                type="text",
                role="metadata",
                x=round(head_x, 3),
                y=0.68,
                width=round(head_w, 3),
                height=0.16,
                fontRole="metadata",
                fontFamily=font_p.get("metadata", "monospace"),
                fontSize=11,
                lineHeight=1.8,
                alignment=align,
                colorToken="muted",
                content="ATENDIMENTO EXECUTIVO · CONCIERGE\nCONTATO@USACATANA.COM.BR\nEDIÇÃO LIMITADA · 2026",
                zIndex=2,
            )
        )
