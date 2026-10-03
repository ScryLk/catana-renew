"""
Composition Planner - Construtor Generativo de Layouts e Blocos Espaciais.
Compõe pranchetas dinamicamente utilizando primitives, coordenadas normalizadas (0.0 a 1.0)
e safe areas, respeitando a narrativa editorial e o VisualDNA.
"""
from typing import Dict, Any, List, Optional
import random
import logging
from .requirement_contract import RequirementContract
from .visual_dna import VisualDNA
from .creative_director import CreativeDirection
from .narrative_planner import PageNarrativePlan
from .design_grammar import GenerativeBlock, GenerativeCompositionMeta, GenerativeGridSpec

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
    ) -> Dict[str, Any]:
        """
        Gera a composição completa e a lista de GenerativeBlocks para uma prancheta.
        """
        rng = random.Random(creative_seed + narrative.page_number * 1337)
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

        blocks: List[GenerativeBlock] = []

        # 1. Determina as propriedades compositivas gerais da prancheta
        balance = "axial" if visual_dna.symmetry > 0.65 else "asymmetric"
        grid_cols = 12 if visual_dna.grid_rigidity > 0.6 else 8
        composition_meta = GenerativeCompositionMeta(
            grid=GenerativeGridSpec(columns=grid_cols, rows=16, gutter=0.02),
            balance=balance,
            axis=narrative.layout_axis,
            whitespaceRatio=narrative.whitespace_target,
            visualTension=visual_dna.axis_tension,
            dominantPrimitive=narrative.dominant_primitive,
        )

        # 2. Composição baseada no content_role e na narrativa
        if role in ["opening", "one_pager"] and page_num == 1:
            cls._compose_opening_page(
                blocks=blocks,
                title=title,
                subtitle=subtitle,
                content=content,
                folio=folio_str,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
                page_dict=page_dict,
                is_one_pager=(role == "one_pager"),
                prods=prods,
            )

        elif role in ["manifesto"]:
            cls._compose_manifesto_page(
                blocks=blocks,
                title=title,
                subtitle=subtitle,
                content=content,
                quote=quote,
                folio=folio_str,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
            )

        elif role in ["product_reveal"]:
            cls._compose_product_reveal_page(
                blocks=blocks,
                prods=prods,
                title=title,
                subtitle=subtitle,
                folio=folio_str,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
            )

        elif role in ["product_dialogue"]:
            cls._compose_product_dialogue_page(
                blocks=blocks,
                prods=prods,
                title=title,
                subtitle=subtitle,
                folio=folio_str,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
            )

        elif role in ["product_system"]:
            cls._compose_product_system_page(
                blocks=blocks,
                prods=prods,
                title=title,
                subtitle=subtitle,
                folio=folio_str,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
                has_images=has_images,
            )

        else:
            # closing / default
            cls._compose_closing_page(
                blocks=blocks,
                title=title,
                subtitle=subtitle,
                content=content,
                folio=folio_str,
                visual_dna=visual_dna,
                direction=direction,
                font_p=font_p,
                palette=palette,
                rng=rng,
            )

        # 3. Adiciona sempre o fólio editorial discreto
        if not any(b.role == "folio" for b in blocks):
            folio_x = 0.06 if narrative.layout_axis == "asymmetric_right" else 0.82
            blocks.append(
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
                    colorToken="muted",
                    alignment="right" if folio_x > 0.5 else "left",
                    content=folio_str,
                    zIndex=10,
                )
            )

        return {
            "composition": composition_meta.to_dict(),
            "safeArea": cls.SAFE_AREA,
            "blocks": [b.to_dict() for b in blocks],
        }

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
    ):
        """Compõe a capa sem cair no clichê do monograma central com linha dourada."""
        # Variação estrutural orientada por assimetria e escala
        is_asymmetric = visual_dna.symmetry < 0.60
        align = "left" if is_asymmetric else "center"
        headline_x = rng.uniform(0.06, 0.12) if is_asymmetric else 0.10
        headline_w = 0.80 if not is_asymmetric else rng.uniform(0.68, 0.84)
        headline_y = rng.uniform(0.12, 0.28) if visual_dna.whitespace > 0.55 else rng.uniform(0.08, 0.18)

        # 1. Headline Monumental
        blocks.append(
            GenerativeBlock(
                id="cover-headline",
                type="text",
                role="headline",
                x=round(headline_x, 3),
                y=round(headline_y, 3),
                width=round(headline_w, 3),
                height=0.24,
                fontRole="display",
                fontFamily=font_p.get("display", "serif"),
                fontSize=round(38 + (visual_dna.scale_contrast * 28), 1),
                fontWeight=300 if "serif" in font_p.get("display", "").lower() else 700,
                alignment=align,
                textTransform="uppercase",
                letterSpacing="0.08em" if is_asymmetric else "0.18em",
                colorToken="primary",
                content=title,
                zIndex=3,
            )
        )

        # 2. Subtítulo / Rótulo Editorial Deslocado
        sub_y = headline_y + 0.26
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
                alignment=align,
                textTransform="uppercase",
                letterSpacing="0.25em",
                colorToken="accent",
                content=subtitle or direction.concept_statement,
                zIndex=3,
            )
        )

        # 3. Logo / Selo de Marca não-centralizado obrigatoriamente
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
    ):
        """Compõe prancheta de manifesto ou pausa contemplativa."""
        # Seção de cabeçalho sutil
        blocks.append(
            GenerativeBlock(
                id="manifesto-category",
                type="text",
                role="label",
                x=0.06,
                y=0.08,
                width=0.60,
                height=0.04,
                fontRole="metadata",
                fontFamily=font_p.get("metadata", "monospace"),
                fontSize=10,
                textTransform="uppercase",
                letterSpacing="0.25em",
                colorToken="accent",
                content=subtitle or "MANIFESTO & DIRETRIZES",
                zIndex=2,
            )
        )

        # Citação / Título com forte assimetria e dramaticidade tipográfica
        main_text = quote if quote else title
        blocks.append(
            GenerativeBlock(
                id="manifesto-title",
                type="quote" if quote else "text",
                role="headline",
                x=0.06,
                y=0.18,
                width=0.78,
                height=0.28,
                fontRole="display",
                fontFamily=font_p.get("display", "serif"),
                fontSize=round(28 + (visual_dna.scale_contrast * 20), 1),
                fontWeight=400,
                alignment="left",
                lineHeight=1.35,
                colorToken="primary",
                content=f"“{main_text}”" if quote else main_text,
                zIndex=3,
            )
        )

        # Prosa de marca em coluna editorial estreita com espaço negativo abundante
        body_text = content if content else direction.concept_statement
        blocks.append(
            GenerativeBlock(
                id="manifesto-body",
                type="text",
                role="body",
                x=0.06 if visual_dna.symmetry < 0.5 else 0.40,
                y=0.52,
                width=0.50,
                height=0.30,
                fontRole="body",
                fontFamily=font_p.get("body", "sans-serif"),
                fontSize=12,
                fontWeight=300,
                alignment="left",
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
    ):
        """Compõe prancheta com 1 produto dominante em arranjo escultural assimétrico."""
        prod = prods[0] if prods else {"name": title, "price": "Sob Consulta", "sku": "CAT-01", "description": ""}

        # Eixo fotográfico: esquerda ou direita dependendo de axis
        is_left_photo = visual_dna.symmetry < 0.45 or rng.random() > 0.5
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

        # Categoria e SKU
        blocks.append(
            GenerativeBlock(
                id=f"prod-{prod.get('id', '1')}-meta",
                type="metadata",
                role="sku",
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
                content=f"{prod.get('category', 'PEÇA ÚNICA')} · {prod.get('sku', '')}",
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

        # Preço
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
                content=prod.get("price", "R$ 0,00"),
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

    # ---------------- COMPOSIÇÃO DE DUPLA (DUO) ----------------
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
    ):
        """Compõe 2 produtos com descolamento óptico dinâmico (não dois cards iguais)."""
        p1 = prods[0] if len(prods) > 0 else {"id": "1", "name": f"{title} · Look I", "price": "Sob Consulta", "sku": "VER-01"}
        p2 = prods[1] if len(prods) > 1 else {"id": "2", "name": f"{title} · Look II", "price": "Sob Consulta", "sku": "VER-02"}

        # Item 1: mais alto e à esquerda
        y1 = 0.12
        x1 = 0.06
        w1 = 0.42
        h_photo1 = 0.38

        # Item 2: escalonado para baixo (tensão diagonal)
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

            # Metadata + Nome + Preço
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
                    content=p.get("price", "R$ 0,00"),
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
    ):
        """Compõe 3 ou 4 produtos de forma organizada e proporcional."""
        # Cabeçalho da seção
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
                content=subtitle or "COLEÇÃO & CATÁLOGO",
                zIndex=2,
            )
        )

        count = len(prods)
        # Grid 2x2 modular
        coords = [
            (0.06, 0.14, 0.42, 0.36),
            (0.52, 0.14, 0.42, 0.36),
            (0.06, 0.54, 0.42, 0.36),
            (0.52, 0.54, 0.42, 0.36),
        ]

        for idx, p in enumerate(prods[:4]):
            px, py, pw, ph = coords[idx]
            pid = p.get("id", str(idx + 1))
            img_url = p.get("image")
            photo_h = 0.22 if (has_images and img_url) else 0.0

            if has_images and img_url:
                blocks.append(
                    GenerativeBlock(
                        id=f"grid-{pid}-photo",
                        type="product_image",
                        role="primary_photo",
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

            # Nome e Preço
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
                    content=p.get("price", "R$ 0,00"),
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
