from django.core.management.base import BaseCommand
from api.models import CatalogTemplate
from api.services.template_rag import generate_embedding

CANONICAL_TEMPLATES = [
    {
        "slug": "cover-luxe-noir",
        "title": "Capa Minimalista Nobre (Cover Luxe)",
        "category": "cover",
        "industry": "luxury_fashion",
        "style_preset": "noir_or",
        "product_capacity": 0,
        "description": "Capa editorial para marcas de luxo, joalheria e alta moda com monograma circular, tipografia serifada em caixa alta e acabamento ouro envelhecido.",
        "editorial_reasoning": (
            "A capa estabelece o peso institucional da marca. O respiro superior cria antecipacao e nobreza, "
            "o monograma centralizado guia o olhar e o titulo em caixa alta espacada (tracking 0.35em) comunica atemporalidade."
        ),
        "blueprint_data": {
            "type": "cover",
            "backgroundColor": "#1A1817",
            "textColor": "#F5F1EA",
            "accentColor": "#B08D57",
            "title": "A U R E A",
            "subtitle": "Edicao Limitada / Alta Marroquinaria",
            "label": "COLECAO OUTONO-INVERNO 2026",
            "folio": "01",
            "editorialImage": "/aurea/aurea-monograma.png",
        },
    },
    {
        "slug": "manifesto-editorial-spread",
        "title": "Manifesto Editorial & Abertura (Manifesto Spread)",
        "category": "manifesto",
        "industry": "luxury_fashion",
        "style_preset": "noir_or",
        "product_capacity": 0,
        "description": "Lamina dupla de abertura editorial com foto conceitual full-bleed na pagina esquerda e manifesto poetico com citacao na pagina direita.",
        "editorial_reasoning": (
            "Abertura com ritmo contemplativo. A pagina esquerda transporta o cliente para a atmosfera da colecao, "
            "enquanto a pagina direita ancora o manifesto com tipografia serifada generosa e citacao em destaque."
        ),
        "blueprint_data": {
            "left_page": {
                "type": "divider",
                "backgroundColor": "#1A1817",
                "textColor": "#F5F1EA",
                "accentColor": "#B08D57",
                "title": "A Expressao do Essencial",
                "subtitle": "Capitulo I",
                "editorialImage": "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&q=80",
            },
            "right_page": {
                "type": "manifesto",
                "backgroundColor": "#F5F1EA",
                "textColor": "#1A1817",
                "accentColor": "#B08D57",
                "title": "Manifesto de Criacao",
                "quote": "O luxo verdadeiro nao reside no excesso, mas na perfeita harmonia entre a materia-prima pura e a paciencia artesanal.",
                "content": "Cada peca e esculpida sob os preceitos do design atemporal, unindo cortes cirurgicos a uma paleta neutra e acolhedora.",
            },
        },
    },
    {
        "slug": "hero-single-product",
        "title": "Hero Showcase (1 Produto em Destaque Absoluto)",
        "category": "hero",
        "industry": "luxury_fashion",
        "style_preset": "noir_or",
        "product_capacity": 1,
        "description": "Lamina dupla para peca heroica. Pagina esquerda dedicada a imagem de ambientacao em grande formato e pagina direita com especificacoes, codigo SKU e preco.",
        "editorial_reasoning": (
            "Hierarquia de foco maximo. A pagina esquerda cativa a atencao do comprador com a ambientacao da peca, "
            "e a pagina direita orienta a decisao de compra com respiro e clareza nos atributos nobres."
        ),
        "blueprint_data": {
            "left_page": {
                "type": "hero",
                "backgroundColor": "#F5F1EA",
                "textColor": "#1A1817",
                "accentColor": "#B08D57",
                "title": "Bolsa Tote Monolith",
                "editorialImage": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80",
                "label": "PECA EM DESTAQUE",
            },
            "right_page": {
                "type": "single",
                "backgroundColor": "#F5F1EA",
                "textColor": "#1A1817",
                "accentColor": "#B08D57",
                "products": [
                    {
                        "id": "prod-hero-1",
                        "name": "Bolsa Tote Monolith Couro Floter",
                        "sku": "AUR-TOT-01",
                        "price": "R$ 4.890,00",
                        "description": "Couro bovino integral de curtimento vegetal com ferragens em latao banhado a ouro 18k.",
                        "image": "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&q=80",
                        "tag": "Iconico",
                        "details": ["Couro legitimo 100%", "Costura manual sellier", "Garantia vitalicia"],
                    }
                ],
            },
        },
    },
    {
        "slug": "duo-lookbook-spread",
        "title": "Duo Lookbook (2 Produtos Harmonizados)",
        "category": "duo",
        "industry": "luxury_fashion",
        "style_preset": "atelier_silver",
        "product_capacity": 2,
        "description": "Lamina equilibrada de lookbook exibindo dois produtos complementares com espacamento uniforme, micro-detalhes e precificacao elegante.",
        "editorial_reasoning": (
            "Composicao em pares que estimula a compra casada (cross-selling) com simetria sutil e filetes de separacao delicados."
        ),
        "blueprint_data": {
            "left_page": {
                "type": "single",
                "backgroundColor": "#FFFFFF",
                "textColor": "#121214",
                "accentColor": "#C0C0C0",
                "products": [
                    {
                        "id": "prod-duo-1",
                        "name": "Carteira Bifold Minimalista",
                        "sku": "AUR-WAL-02",
                        "price": "R$ 890,00",
                        "description": "Acabamento fosco, 6 compartimentos para cartoes e forro em seda.",
                        "image": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=600&q=80",
                        "tag": "Essencial",
                    }
                ],
            },
            "right_page": {
                "type": "single",
                "backgroundColor": "#FFFFFF",
                "textColor": "#121214",
                "accentColor": "#C0C0C0",
                "products": [
                    {
                        "id": "prod-duo-2",
                        "name": "Cinto Casual Fivela Escovada",
                        "sku": "AUR-BEL-03",
                        "price": "R$ 720,00",
                        "description": "Couro atanado premium com fivela macica em acabamento prata 925.",
                        "image": "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&q=80",
                        "tag": "Novidade",
                    }
                ],
            },
        },
    },
    {
        "slug": "commercial-grid-4-b2b",
        "title": "Grade Comercial B2B (Matriz de 4 Produtos)",
        "category": "grid_4",
        "industry": "industrial_b2b",
        "style_preset": "minimaliste_slate",
        "product_capacity": 4,
        "description": "Matriz comercial otimizada para pedidos de atacado, distribuidores e representantes com codigos SKU, pedidos minimos e condicoes.",
        "editorial_reasoning": (
            "Diagramacao funcional com alta densidade de informacao sem comprometer a legibilidade. "
            "Blocos modulares 2x2 com destaque claro para codigos de referencia e condicoes comerciais."
        ),
        "blueprint_data": {
            "left_page": {
                "type": "duo",
                "backgroundColor": "#F8FAFC",
                "textColor": "#1E2022",
                "accentColor": "#64748B",
                "products": [
                    {
                        "id": "prod-b2b-1",
                        "name": "Valvula Esferica Inox 316",
                        "sku": "IND-VLV-316",
                        "price": "R$ 340,00 / un (MOQ 10)",
                        "description": "Pressao nominal PN40, vedacao PTFE, conexao roscada BSP.",
                        "image": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&q=80",
                    },
                    {
                        "id": "prod-b2b-2",
                        "name": "Atuador Pneumatico Dupla Acao",
                        "sku": "IND-ATU-040",
                        "price": "R$ 680,00 / un (MOQ 5)",
                        "description": "Corpo em aluminio anodizado, retorno por mola de seguranca.",
                        "image": "https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=600&q=80",
                    },
                ],
            },
            "right_page": {
                "type": "duo",
                "backgroundColor": "#F8FAFC",
                "textColor": "#1E2022",
                "accentColor": "#64748B",
                "products": [
                    {
                        "id": "prod-b2b-3",
                        "name": "Filtro Regulador de Pressao 1/2",
                        "sku": "IND-FLT-012",
                        "price": "R$ 290,00 / un (MOQ 10)",
                        "description": "Elemento filtrante 5 micras com manometro integrado.",
                        "image": "https://images.unsplash.com/photo-1581092162384-8987c1d64718?w=600&q=80",
                    },
                    {
                        "id": "prod-b2b-4",
                        "name": "Conexao Rapida Niquelada 8mm",
                        "sku": "IND-CNX-008",
                        "price": "R$ 45,00 / pacote 10un",
                        "description": "Latao niquelado para tubos de poliuretano e nylon.",
                        "image": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=600&q=80",
                    },
                ],
            },
        },
    },
    {
        "slug": "divider-quote-spread",
        "title": "Divisor de Secao & Citacao (Divider Spread)",
        "category": "divider",
        "industry": "luxury_fashion",
        "style_preset": "noir_or",
        "product_capacity": 0,
        "description": "Separador de secao ou linha de produtos com numeracao romana, citacao em destaque e filetes refinados.",
        "editorial_reasoning": (
            "Pausa visual necessaria em catalogos extensos para renovar a atencao do leitor antes de introduzir uma nova categoria de produtos."
        ),
        "blueprint_data": {
            "left_page": {
                "type": "divider",
                "backgroundColor": "#1A1817",
                "textColor": "#F5F1EA",
                "accentColor": "#B08D57",
                "title": "Linha Executiva",
                "subtitle": "Secao 02",
                "folio": "Secao 02",
            },
            "right_page": {
                "type": "manifesto",
                "backgroundColor": "#F5F1EA",
                "textColor": "#1A1817",
                "accentColor": "#B08D57",
                "title": "A Linha Executiva",
                "quote": "A sofisticacao nao e um detalhe acessorio, e a propria estrutura do objeto.",
                "content": "Desenvolvida especialmente para ambientes corporativos exigentes.",
            },
        },
    },
    {
        "slug": "backcover-institutional-minimal",
        "title": "Contracapa Institucional (Backcover Minimal)",
        "category": "backcover",
        "industry": "corporate",
        "style_preset": "noir_or",
        "product_capacity": 0,
        "description": "Contracapa solene com informacoes de contato, canais B2B, selo de garantia e creditos corporativos.",
        "editorial_reasoning": (
            "Encerramento elegante que reforca a seriedade da empresa e direciona o contato comercial imediato."
        ),
        "blueprint_data": {
            "type": "backcover",
            "backgroundColor": "#1A1817",
            "textColor": "#F5F1EA",
            "accentColor": "#B08D57",
            "title": "Catana Atelier & Studio",
            "subtitle": "Todos os direitos reservados. Impresso sob demanda em papel couche 250g.",
            "label": "CONTATO COMERCIAL E DISTRIBUICAO B2B",
            "content": "atendimento@catana.com.br | +55 11 3290-8800 | Sao Paulo, Brasil",
        },
    },
]


class Command(BaseCommand):
    help = "Popula o banco com os templates canonicos de catalogo e gera seus embeddings semanticos."

    def handle(self, *args, **options):
        self.stdout.write("Iniciando povoamento de templates canonicos para RAG...")
        created_count = 0
        updated_count = 0

        for tpl_data in CANONICAL_TEMPLATES:
            slug = tpl_data["slug"]
            enrich_text = (
                f"{tpl_data['title']} {tpl_data['category']} {tpl_data['industry']} "
                f"{tpl_data['description']} {tpl_data['editorial_reasoning']}"
            )
            embedding_vector = generate_embedding(enrich_text)

            obj, created = CatalogTemplate.objects.update_or_create(
                slug=slug,
                defaults={
                    "title": tpl_data["title"],
                    "category": tpl_data["category"],
                    "industry": tpl_data["industry"],
                    "style_preset": tpl_data["style_preset"],
                    "product_capacity": tpl_data["product_capacity"],
                    "description": tpl_data["description"],
                    "editorial_reasoning": tpl_data["editorial_reasoning"],
                    "blueprint_data": tpl_data["blueprint_data"],
                    "embedding": embedding_vector,
                    "is_system": True,
                },
            )

            if created:
                created_count += 1
                self.stdout.write(f"  + Criado template: {obj.title} ({obj.slug})")
            else:
                updated_count += 1
                self.stdout.write(f"  * Atualizado template: {obj.title} ({obj.slug})")

        self.stdout.write(
            self.style.SUCCESS(
                f"Povoamento concluido com sucesso! Total criados: {created_count}, atualizados: {updated_count}."
            )
        )
