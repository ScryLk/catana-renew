"""
Requirement Parser - Extrator de Intenção e Requisitos Estruturados.
Analisa a linguagem natural do usuário, extrai restrições cardinais, restrições negativas,
preferências de formato e estilo, gerando uma instância completa do RequirementContract.
"""
import re
import logging
from typing import Dict, Any, Optional, List, Tuple
from .requirement_contract import (
    RequirementContract,
    OutputRequirements,
    ContentRequirements,
    DesignRequirements,
    ConstraintSet,
    AssetInventory,
    PageCountMode,
    OrientationType,
    ColorSpaceType,
)

logger = logging.getLogger(__name__)

# Mapeamento de numerais textuais comuns
WORD_TO_NUM: Dict[str, int] = {
    "uma": 1, "um": 1, "single": 1, "one": 1,
    "duas": 2, "dois": 2, "two": 2,
    "tres": 3, "três": 3, "three": 3,
    "quatro": 4, "four": 4,
    "cinco": 5, "five": 5,
    "seis": 6, "six": 6,
    "sete": 7, "seven": 7,
    "oito": 8, "eight": 8,
    "nove": 9, "nine": 9,
    "dez": 10, "ten": 10,
    "doze": 12, "twelve": 12,
    "dezesseis": 16, "sixteen": 16,
    "vinte": 20, "twenty": 20,
    "trinta": 30, "thirty": 30,
    "quarenta": 40, "forty": 40,
}


class RequirementParser:
    """
    Parser semântico e determinístico para converter prompts de usuário
    em um RequirementContract formal.
    """

    @classmethod
    def parse(
        cls,
        prompt: str,
        products: Optional[List[Dict[str, Any]]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
    ) -> RequirementContract:
        """Processa a solicitação do usuário e constrói o contrato de requisitos."""
        raw_text = (prompt or "").strip()
        p_lower = raw_text.lower()

        # 1. Extração de Mídia e Páginas
        page_count, page_count_mode = cls._extract_page_count_and_mode(p_lower)
        orientation, dimensions = cls._extract_orientation_and_dimensions(p_lower)
        doc_type = cls._extract_document_type(p_lower)

        output_req = OutputRequirements(
            type=doc_type,
            page_count=page_count,
            page_count_mode=page_count_mode,
            orientation=orientation,
            dimensions=dimensions,
            language="pt-BR",
        )

        # 2. Extração de Restrições Negativas
        negative_constraints = cls._extract_negative_constraints(p_lower)

        # 3. Preservação de Conteúdo (Verbatim) e Requisitos de Dados
        preserve_verbatim, user_content = cls._extract_verbatim_rules(raw_text, p_lower)
        required_content: List[str] = []
        if products:
            for p in products:
                name = str(p.get("name", "")).strip()
                if name:
                    required_content.append(name)

        content_req = ContentRequirements(
            required=required_content,
            optional=[],
            forbidden=negative_constraints,
            user_provided_content=user_content,
            preserve_verbatim=preserve_verbatim,
        )

        # 4. Estilo, Energia Visual e Densidade
        design_req = cls._extract_design_requirements(p_lower, negative_constraints)

        # 5. Classificação na Hierarquia de Restrições (P1-P6)
        hard_constraints: List[str] = []
        if page_count is not None:
            hard_constraints.append(f"PAGE_COUNT_{page_count_mode.upper()}:{page_count}")
        if orientation != "portrait":
            hard_constraints.append(f"ORIENTATION:{orientation.upper()}")
        if "NO_CARDS" in negative_constraints:
            hard_constraints.append("FORBIDDEN:CARDS")
        if "NO_GRADIENTS" in negative_constraints:
            hard_constraints.append("FORBIDDEN:GRADIENTS")
        if preserve_verbatim:
            hard_constraints.append("PRESERVE_VERBATIM:USER_TEXT")

        soft_preferences: List[str] = design_req.style_keywords.copy()

        constraint_set = ConstraintSet(
            hard=hard_constraints,
            content_mandatory=required_content,
            negative=negative_constraints,
            format=[f"ORIENTATION:{orientation}", f"TYPE:{doc_type}"],
            soft=soft_preferences,
        )

        # 6. Inventário de Ativos
        asset_inventory = cls._build_asset_inventory(products, attachments, negative_constraints)

        # 7. Detecção de Indústria / Setor
        detected_industry = cls._detect_industry(p_lower, products)

        return RequirementContract(
            output=output_req,
            content=content_req,
            design=design_req,
            constraints=constraint_set,
            assets=asset_inventory,
            raw_prompt=raw_text,
            detected_industry=detected_industry,
        )

    @classmethod
    def _extract_page_count_and_mode(cls, text: str) -> Tuple[Optional[int], PageCountMode]:
        """Detecta o número de páginas e se a restrição é exata, máxima, mínima ou automática."""
        # Expressões de página única (One-Pager)
        if re.search(r'\b(?:1|uma|um|single|one)\s*(?:p[aá]gina|pag\b|p[aá]g\b|folha|l[aâ]mina|prancheta|spread|one[- ]?pager?|onepager?|single[- ]?pager?)\b', text):
            return 1, "exact"
        if re.search(r'\b(?:one[- ]?pager?|onepager?|single[- ]?pager?|folha\s*[uú]nica|l[aâ]mina\s*[uú]nica|p[aá]gina\s*[uú]nica)\b', text):
            return 1, "exact"

        # Padrões de MÁXIMO ("no máximo X páginas", "até X páginas", "max X pages")
        match_max = re.search(
            r'\b(?:no\s+m[aá]ximo|at[eé]|limite\s+de|max(?:\b|\.))\s*(\d+|[a-zçãé]+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|slides?)\b',
            text,
        )
        if match_max:
            num = cls._parse_number_str(match_max.group(1))
            if num:
                return num, "maximum"

        # Padrões de MÍNIMO ("pelo menos X páginas", "no mínimo X páginas", "ao menos X páginas", "min X pages")
        match_min = re.search(
            r'\b(?:pelo\s+menos|no\s+m[ií]nimo|ao\s+menos|min(?:\b|\.))\s*(\d+|[a-zçãé]+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|slides?)\b',
            text,
        )
        if match_min:
            num = cls._parse_number_str(match_min.group(1))
            if num:
                return num, "minimum"

        # Padrões de EXATO EXPLÍCITO ("exatamente X páginas", "X páginas exatas")
        match_exact = re.search(
            r'\b(?:exatament[ea]|cravado)\s*(\d+|[a-zçãé]+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|slides?)\b',
            text,
        )
        if match_exact:
            num = cls._parse_number_str(match_exact.group(1))
            if num:
                return num, "exact"

        match_exact_post = re.search(
            r'\b(\d+|[a-zçãé]+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|slides?)\s*(?:exatas?|sem\s+tirar\s+nem\s+p[oô]r)\b',
            text,
        )
        if match_exact_post:
            num = cls._parse_number_str(match_exact_post.group(1))
            if num:
                return num, "exact"

        # Padrão Numérico Padrão (Ex: "catálogo de 4 páginas") -> Considera como EXATO por padrão
        match_num = re.search(r'\b(\d+)\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|slides?)\b', text)
        if match_num:
            val = int(match_num.group(1))
            if 1 <= val <= 100:
                return val, "exact"

        for word, num in WORD_TO_NUM.items():
            if re.search(rf'\b{word}\s*(?:p[aá]ginas?|pags?\b|p[aá]gs?\b|folhas?|l[aâ]minas?|slides?)\b', text):
                return num, "exact"

        return None, "auto"

    @classmethod
    def _parse_number_str(cls, raw: str) -> Optional[int]:
        """Converte dígitos ou palavras em inteiros."""
        clean = raw.strip().lower()
        if clean.isdigit():
            return int(clean)
        return WORD_TO_NUM.get(clean)

    @classmethod
    def _extract_orientation_and_dimensions(cls, text: str) -> Tuple[OrientationType, Dict[str, int]]:
        """Determina a orientação e dimensões base do canvas."""
        if any(k in text for k in ["16:9", "slide", "slides", "apresenta", "paisagem", "landscape", "horizontal", "wide"]):
            return "landscape", {"width": 1920, "height": 1080}
        if any(k in text for k in ["quadrado", "square", "1:1", "feed", "instagram"]):
            return "square", {"width": 1080, "height": 1080}
        # Padrão: A4 vertical
        return "portrait", {"width": 794, "height": 1123}

    @classmethod
    def _extract_document_type(cls, text: str) -> str:
        """Determina a categoria semântica do documento."""
        if any(k in text for k in ["apresenta", "pitch", "slide"]):
            return "presentation"
        if any(k in text for k in ["lookbook", "moda", "fashion"]):
            return "lookbook"
        if any(k in text for k in ["menu", "cardapio", "cardápio"]):
            return "menu"
        if any(k in text for k in ["ficha tecnica", "especifica", "manual", "tabela"]):
            return "data_sheet"
        if any(k in text for k in ["relatorio", "relatório", "report", "sustentabilidade"]):
            return "report"
        return "catalog"

    @classmethod
    def _extract_negative_constraints(cls, text: str) -> List[str]:
        """Identifica proibições explícitas de componentes, estilos e cores."""
        negatives: List[str] = []

        # Proibição de Cards / Caixas
        if re.search(r'\b(?:n[aã]o\s+use|sem|proibid[oa]|nada\s+de|livre\s+de)\s*(?:cards?|cart[oõ]es|caixas?)\b', text):
            negatives.append("NO_CARDS")

        # Proibição de Gradientes
        if re.search(r'\b(?:n[aã]o\s+use|sem|proibid[oa]|nada\s+de)\s*(?:gradientes?|degrad[eê]s?)\b', text):
            negatives.append("NO_GRADIENTS")

        # Proibição de Imagens / Fotos
        if re.search(r'\b(?:n[aã]o\s+use|sem|proibid[oa]|sem\s+nenhuma|sem\s+imagens\s+dispon[ií]veis)\s*(?:fotos?|imagens?|fotografias?)\b', text):
            negatives.append("NO_IMAGES")

        # Proibição de Sombras
        if re.search(r'\b(?:n[aã]o\s+use|sem|proibid[oa]|nada\s+de)\s*(?:sombras?|drop[- ]?shadows?)\b', text):
            negatives.append("NO_SHADOWS")

        # Proibição de Cantos Arredondados
        if re.search(r'\b(?:n[aã]o\s+use|sem|proibid[oa])\s*(?:cantos?\s+arredondados?|bordas?\s+arredondadas?|border[- ]?radius)\b', text):
            negatives.append("NO_ROUNDED_CORNERS")

        # Proibição de Cores Específicas
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa](?:\s+usar)?|nada\s+de)\s*(?:a\s+cor\s+)?azul\b', text):
            negatives.append("FORBIDDEN_COLOR_BLUE")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa](?:\s+usar)?|nada\s+de)\s*(?:a\s+cor\s+)?verde\b', text):
            negatives.append("FORBIDDEN_COLOR_GREEN")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa](?:\s+usar)?|nada\s+de)\s*(?:a\s+cor\s+)?marrom\b', text):
            negatives.append("FORBIDDEN_COLOR_BROWN")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa]|nada\s+de)\s*(?:fundo\s+escuro|fundo\s+preto|dark\s+mode)\b', text):
            negatives.append("NO_DARK_BACKGROUND")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa](?:\s+usar)?|nada\s+de)\s*(?:cores|cor|colorido)\b', text) or "somente preto e branco" in text or "monocromático" in text or "monocromatico" in text:
            negatives.append("NO_COLORS")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa]|nada\s+de)\s*(?:neon|cores\s+neon)\b', text):
            negatives.append("NO_NEON")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa]|nada\s+de)\s*(?:diagonais|inclinad[oa]s)\b', text):
            negatives.append("NO_DIAGONALS")
        if re.search(r'\b(?:sem(?:\s+usar)?|n[aã]o\s+(?:use|utilize)|proibid[oa]|nada\s+de)\s*(?:ilustra[cç][oõ]es)\b', text):
            negatives.append("NO_ILLUSTRATIONS")

        # Proibição de Textos Longos
        if re.search(r'\b(?:sem|n[aã]o\s+use|proibido|m[ií]nimo\s+poss[ií]vel\s+de)\s*(?:textos?\s+longos?|par[aá]grafos?|prosa)\b', text):
            negatives.append("NO_LONG_TEXTS")

        return negatives

    @classmethod
    def _extract_verbatim_rules(cls, raw_text: str, p_lower: str) -> Tuple[List[str], List[str]]:
        """Identifica se o usuário exigiu preservação estrita de seus textos."""
        preserve: List[str] = []
        user_content: List[str] = []

        is_verbatim_requested = bool(
            re.search(r'\b(n[aã]o\s+altere\s+(?:meus?\s+)?textos?|mantenha\s+fiel|preserve\s+verbatim|n[aã]o\s+mude\s+o\s+texto|exatamente\s+estas\s+palavras|n[aã]o\s+altere\s+nenhuma\s+palavra)\b', p_lower)
        )

        # Procura por blocos entre aspas ou seções explícitas de texto do usuário
        quotes = re.findall(r'["\']([^"\']{20,})["\']', raw_text)
        for q in quotes:
            user_content.append(q.strip())
            if is_verbatim_requested:
                preserve.append(q.strip())

        if is_verbatim_requested and not preserve:
            preserve.append("USER_PROMPT_CONTENT_VERBATIM")

        return preserve, user_content

    @classmethod
    def _extract_design_requirements(cls, p_lower: str, negatives: List[str]) -> DesignRequirements:
        """Calcula parâmetros de energia visual, densidade e vocabulário compositivo."""
        style_keywords: List[str] = []
        visual_energy = 50
        density = 50
        whitespace = 50
        symmetry = 50
        typographic_contrast = 50
        image_dominance = 50
        decorative_intensity = 30
        grid_rigidity = 60
        allowed_color_space: Optional[ColorSpaceType] = None
        image_behavior: Optional[str] = None
        layout_behavior: List[str] = []

        # Análise de Palavras-Chave de Estilo
        if any(k in p_lower for k in ["minimalista", "clean", "sobrio", "sóbrio", "respiro"]):
            style_keywords.append("minimalist")
            whitespace = max(whitespace, 65)
            density = min(density, 35)
            decorative_intensity = 15

        if any(k in p_lower for k in ["luxo", "alta joalheria", "premium", "alta costura"]):
            style_keywords.append("luxury")
            whitespace = max(whitespace, 60)
            typographic_contrast = max(typographic_contrast, 70)

        if any(k in p_lower for k in ["brutalista", "brutalist"]):
            style_keywords.append("brutalist")
            visual_energy = max(visual_energy, 80)
            whitespace = min(whitespace, 25)
            density = max(density, 75)
            grid_rigidity = max(grid_rigidity, 85)
            typographic_contrast = max(typographic_contrast, 90)
            decorative_intensity = 10

        if any(k in p_lower for k in ["suico", "suíço", "swiss", "internacional", "international style"]):
            style_keywords.append("swiss")
            grid_rigidity = 95
            symmetry = 40  # Assimetria funcional controlada
            typographic_contrast = 80
            whitespace = 40

        if any(k in p_lower for k in ["tecnico", "técnico", "industrial", "b2b", "especifica"]):
            style_keywords.append("technical")
            density = max(density, 80)
            whitespace = min(whitespace, 30)
            decorative_intensity = 10
            grid_rigidity = 90

        if any(k in p_lower for k in ["dinamico", "dinâmico", "energetico", "enérgico"]):
            style_keywords.append("dynamic")
            visual_energy = max(visual_energy, 85)
            typographic_contrast = max(typographic_contrast, 80)
            symmetry = 35

        if any(k in p_lower for k in ["editorial", "revista", "magazine", "lookbook"]):
            style_keywords.append("editorial")
            image_dominance = max(image_dominance, 70)
            typographic_contrast = max(typographic_contrast, 75)

        # Regras de Cor e Imagem
        if "NO_COLORS" in negatives or "preto e branco" in p_lower or "monocromático" in p_lower:
            allowed_color_space = "monochrome"
        elif "duotone" in p_lower:
            allowed_color_space = "duotone"

        if "NO_IMAGES" in negatives:
            image_behavior = "typography_led"
            image_dominance = 0
            typographic_contrast = max(typographic_contrast, 85)

        if "NO_CARDS" in negatives:
            layout_behavior.append("no_cards")

        return DesignRequirements(
            style_keywords=style_keywords,
            visual_energy=visual_energy,
            density=density,
            whitespace=whitespace,
            symmetry=symmetry,
            typographic_contrast=typographic_contrast,
            image_dominance=image_dominance,
            decorative_intensity=decorative_intensity,
            grid_rigidity=grid_rigidity,
            layout_behavior=layout_behavior,
            allowed_color_space=allowed_color_space,
            image_behavior=image_behavior,
        )

    @classmethod
    def _build_asset_inventory(
        cls,
        products: Optional[List[Dict[str, Any]]],
        attachments: Optional[List[Dict[str, Any]]],
        negatives: List[str],
    ) -> AssetInventory:
        """Constrói o inventário de ativos disponíveis para composição."""
        has_imgs = False
        images: List[Dict[str, Any]] = []
        logos: List[Dict[str, Any]] = []

        if products:
            for p in products:
                img = str(p.get("image", "")).strip()
                if img:
                    has_imgs = True
                    images.append({"url": img, "name": p.get("name")})

        if attachments:
            for a in attachments:
                a_type = a.get("type")
                if a_type == "image":
                    has_imgs = True
                    images.append(a)
                elif a_type == "logo":
                    logos.append(a)

        if "NO_IMAGES" in negatives:
            has_imgs = False

        return AssetInventory(
            images=images,
            logos=logos,
            has_product_images=has_imgs,
        )

    @classmethod
    def _detect_industry(cls, text: str, products: Optional[List[Dict[str, Any]]] = None) -> str:
        """Identifica o setor comercial / industrial do catálogo."""
        corpus = text
        if products:
            for p in products[:6]:
                corpus += " " + (str(p.get("name", "")) + " " + str(p.get("category", "")) + " " + str(p.get("description", ""))).lower()

        if any(k in corpus for k in ["cutelaria", "faca", "facas", "forja", "damasco", "chef", "lamina", "lâmina", "katana"]):
            return "cutlery_craftsmanship"
        if any(k in corpus for k in ["embalag", "descartav", "pote", "marmita", "food service", "vedacao", "sacola"]):
            return "packaging_food_service"
        if any(k in corpus for k in ["doce", "confeit", "bolo", "patisserie", "sobremesa", "chocolate", "brigadeiro", "festa"]):
            return "gastronomy_sweets"
        if any(k in corpus for k in ["carne", "acougue", "açougue", "churrasco", "corte", "angus", "bovino"]):
            return "butcher_meat"
        if any(k in corpus for k in ["tech", "tecnolog", "hardware", "setup", "computad", "software"]):
            return "tech_hardware"
        if any(k in corpus for k in ["joia", "joalher", "luxo", "ouro", "diamante", "prata", "couro", "moda"]):
            return "luxury_fashion"
        if any(k in corpus for k in ["valvula", "industrial", "b2b", "tubo", "usinagem", "maquina", "ferramenta"]):
            return "industrial_b2b"
        return "general_retail"
