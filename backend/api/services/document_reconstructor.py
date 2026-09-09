import io
import os
import re
import uuid
import logging
from typing import List, Dict, Any, Optional
from django.conf import settings
from PIL import Image

from api.models import StudioCatalog, CatalogSpread
from api.services.background_removal import BackgroundRemovalService

logger = logging.getLogger(__name__)

try:
    import pypdf
    HAS_PYPDF = True
except ImportError:
    HAS_PYPDF = False


class DocumentReconstructorService:
    """
    Servico de Engenharia Reversa e Reconstrucao de Documentos (PDF / Word)
    para o Living Canvas do Catana 2.0.
    """

    @classmethod
    def extract_pdf_data(cls, file_bytes: bytes, remove_bg: bool = True) -> List[Dict[str, Any]]:
        """
        Extrai textos, metadados e imagens por pagina de um documento PDF.
        """
        pages_data = []

        if not HAS_PYPDF:
            logger.warning("[DocumentReconstructor] pypdf nao encontrado.")
            return pages_data

        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
            total_pages = len(reader.pages)

            media_root = getattr(settings, 'MEDIA_ROOT', os.path.join(settings.BASE_DIR, 'media'))
            extracted_dir = os.path.join(media_root, 'studio', 'extracted')
            os.makedirs(extracted_dir, exist_ok=True)
            media_url = getattr(settings, 'MEDIA_URL', '/media/')

            for page_idx, page in enumerate(reader.pages):
                text_content = page.extract_text() or ""
                image_urls = []

                # Extrai imagens embutidas na pagina do PDF
                try:
                    for img_file in page.images:
                        img_bytes = img_file.data
                        img_name = img_file.name

                        if remove_bg:
                            try:
                                processed_info = BackgroundRemovalService.process_and_save(
                                    img_bytes, original_filename=img_name
                                )
                                image_urls.append(processed_info["processed_url"])
                            except Exception as bg_err:
                                logger.warning(f"Erro ao remover fundo da imagem {img_name}: {bg_err}")
                                # Salva imagem original
                                unique_name = f"ext-{uuid.uuid4().hex[:8]}-{img_name}"
                                out_path = os.path.join(extracted_dir, unique_name)
                                with open(out_path, "wb") as f:
                                    f.write(img_bytes)
                                image_urls.append(f"{media_url}studio/extracted/{unique_name}")
                        else:
                            unique_name = f"ext-{uuid.uuid4().hex[:8]}-{img_name}"
                            out_path = os.path.join(extracted_dir, unique_name)
                            with open(out_path, "wb") as f:
                                f.write(img_bytes)
                            image_urls.append(f"{media_url}studio/extracted/{unique_name}")
                except Exception as img_exc:
                    logger.warning(f"Falha ao extrair imagens da pagina {page_idx + 1}: {img_exc}")

                pages_data.append({
                    "page_number": page_idx + 1,
                    "text": text_content.strip(),
                    "images": image_urls,
                })

        except Exception as exc:
            logger.error(f"[DocumentReconstructor] Erro durante leitura do PDF: {exc}")

        return pages_data

    @classmethod
    def parse_page_elements(cls, raw_text: str, images: List[str], page_num: int, total_pages: int) -> Dict[str, Any]:
        """
        Decompoe o texto bruto e as imagens da pagina em uma estrutura CatalogPageData.
        """
        lines = [line.strip() for line in raw_text.split("\n") if line.strip()]

        # 1. Deteccao de Precos e Moedas (R$ 99,00 ou $ 99.00)
        price_matches = re.findall(r'(?:R\$\s*[\d\.,]+|\$\s*[\d\.,]+)', raw_text)

        # 2. Deteccao de Codigos SKU
        sku_matches = re.findall(r'(?:SKU|REF|COD|CODIGO)[:\s\-]*([A-Z0-9\-_]{3,15})', raw_text, flags=re.IGNORECASE)

        # 3. Classificacao do tipo de layout
        if page_num == 1:
            layout_type = "cover"
            title = lines[0] if lines else "Catalogo Reconstruido"
            subtitle = lines[1] if len(lines) > 1 else "Edicao Digital Catana Studio"
            products = []
        elif page_num == total_pages:
            layout_type = "backcover"
            title = lines[0] if lines else "Informacoes de Contato"
            subtitle = "Todos os direitos reservados."
            products = []
        elif len(price_matches) >= 3 or len(images) >= 3:
            layout_type = "grid"
            title = lines[0] if lines else f"Colecao - Pagina {page_num}"
            subtitle = ""
            products = cls._build_product_list(lines, price_matches, sku_matches, images)
        elif len(price_matches) == 2 or len(images) == 2:
            layout_type = "duo"
            title = lines[0] if lines else f"Destaques - Pagina {page_num}"
            subtitle = ""
            products = cls._build_product_list(lines, price_matches, sku_matches, images, max_items=2)
        else:
            layout_type = "hero"
            title = lines[0] if lines else f"Peca em Destaque {page_num}"
            subtitle = lines[1] if len(lines) > 1 else ""
            products = cls._build_product_list(lines, price_matches, sku_matches, images, max_items=1)

        primary_img = images[0] if images else ""

        return {
            "id": f"page-{page_num}-{uuid.uuid4().hex[:4]}",
            "pageNumber": page_num,
            "type": layout_type,
            "title": title,
            "subtitle": subtitle,
            "label": f"SECAO {page_num:02d}",
            "editorialImage": primary_img,
            "products": products,
        }

    @classmethod
    def _build_product_list(
        cls,
        lines: List[str],
        prices: List[str],
        skus: List[str],
        images: List[str],
        max_items: int = 4
    ) -> List[Dict[str, Any]]:
        """
        Monta objetos de produto estruturados a partir dos dados extraidos.
        """
        num_items = max(1, min(max_items, max(len(prices), len(images), 1)))
        products = []

        for i in range(num_items):
            prod_id = f"prod-ext-{uuid.uuid4().hex[:6]}"
            price = prices[i] if i < len(prices) else "Sob consulta"
            sku = skus[i] if i < len(skus) else f"CAT-{page_idx_str(i + 1)}"
            img = images[i] if i < len(images) else ""

            # Tenta pegar uma linha de texto correspondente
            line_idx = i + 1 if i + 1 < len(lines) else 0
            name = lines[line_idx] if lines else f"Item em Destaque {i + 1}"
            if len(name) > 60:
                name = name[:57] + "..."

            products.append({
                "id": prod_id,
                "name": name,
                "sku": sku,
                "price": price,
                "description": "Especificacao extraida do documento original.",
                "image": img,
                "tag": "Importado",
                "details": ["Acabamento premium", "Verificar disponibilidade"],
            })

        return products

    @classmethod
    def reconstruct_from_file(
        cls,
        file_bytes: bytes,
        filename: str,
        title: Optional[str] = None,
        brand_name: Optional[str] = None,
        style_preset: str = "editorial_clean",
        remove_bg: bool = True,
        mode: str = "redesign",
        user = None,
    ) -> Dict[str, Any]:
        """
        Executa o pipeline completo de engenharia reversa e cria o catalogo no banco de dados.
        """
        doc_title = title.strip() if title and title.strip() else os.path.splitext(filename)[0]
        brand = brand_name.strip() if brand_name and brand_name.strip() else "Marca Comercial"

        # 1. Extrai dados do arquivo
        is_pdf = filename.lower().endswith(".pdf")
        pages_raw = cls.extract_pdf_data(file_bytes, remove_bg=remove_bg)

        # Se o PDF nao gerou paginas legiveis (ex: arquivo em branco ou corrompido), gera estrutura minima
        if not pages_raw:
            pages_raw = [
                {"page_number": 1, "text": doc_title, "images": []},
                {"page_number": 2, "text": "Produtos e Destaques", "images": []},
            ]

        # Garante numero par de paginas para spreads completos
        if len(pages_raw) % 2 != 0:
            pages_raw.append({
                "page_number": len(pages_raw) + 1,
                "text": "Contatos e Distribuicao",
                "images": [],
            })

        total_pages = len(pages_raw)

        # 2. Converte em CatalogPageData
        pages_processed = []
        for p in pages_raw:
            p_elem = cls.parse_page_elements(
                raw_text=p["text"],
                images=p["images"],
                page_num=p["page_number"],
                total_pages=total_pages
            )
            # Aplica paleta padrao
            p_elem["backgroundColor"] = "#1A1817" if p_elem["type"] in ["cover", "backcover"] else "#F5F1EA"
            p_elem["textColor"] = "#F5F1EA" if p_elem["type"] in ["cover", "backcover"] else "#1A1817"
            p_elem["accentColor"] = "#B08D57"
            pages_processed.append(p_elem)

        # 3. Cria StudioCatalog no Django
        user_org = None
        if user and user.is_authenticated:
            user_org = user.organizations.first()

        catalog = StudioCatalog.objects.create(
            title=doc_title,
            brand_name=brand,
            style_preset=style_preset,
            primary_color="#1A1817",
            secondary_color="#4A4846",
            accent_color="#B08D57",
            page_width=794,
            page_height=1123,
            organization=user_org,
            created_by=user if user and user.is_authenticated else None,
        )

        # 4. Agrupa paginas em Spreads duplos (left, right) e persiste
        spreads_created = []
        num_spreads = len(pages_processed) // 2

        for spread_idx in range(num_spreads):
            left_p = pages_processed[spread_idx * 2]
            right_p = pages_processed[spread_idx * 2 + 1]

            spread_obj = CatalogSpread.objects.create(
                catalog=catalog,
                spread_index=spread_idx,
                title=f"Spread {left_p['pageNumber']}-{right_p['pageNumber']}",
                left_page_elements=[left_p],
                right_page_elements=[right_p],
            )
            spreads_created.append(spread_obj)

        return {
            "catalog_id": catalog.id,
            "title": catalog.title,
            "brand_name": catalog.brand_name,
            "total_pages": total_pages,
            "spreads_count": len(spreads_created),
            "pages": pages_processed,
            "message": f"Catalogo '{catalog.title}' reconstruido com sucesso ({total_pages} paginas).",
        }


def page_idx_str(n: int) -> str:
    return f"{n:03d}"
