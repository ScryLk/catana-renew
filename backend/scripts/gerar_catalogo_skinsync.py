"""
Geração de Capa Editorial A4 Minimalista — SKINSYNC (L'Oréal Beauty Tech)
Baseado em:
- docs/CATALOG_JSON_SPEC.md (envelope catalogIO v1.0, dimensões A4 794x1123)
- docs/VISTORIA_VISUAL_CATALOGOS.md (regras de renderização do ElementRenderer)
- catana-back/files/SKILL.md (convenções do Catana)

Execução:
    python scripts/gerar_catalogo_skinsync.py
Persistência:
    POST http://localhost:8001/api/catalogs/import-json/
"""

import json
import os
import urllib.request
import urllib.error

# Dimensões da Página A4 @ 96dpi
PAGE_W = 794
PAGE_H = 1123
CENTER_X = PAGE_W // 2  # 397

# Tipografia
SANS_DISPLAY = "Jost, 'Inter', Arial, sans-serif"
SANS_BODY = "Jost, 'Inter', Arial, sans-serif"

# Paleta Quiet Luxury / Science & Beauty (L'Oréal Beauty Tech)
COLOR_BG = "#F7F5F0"
COLOR_BG_GRAD = "linear-gradient(180deg, #F8F6F2 0%, #F5F2EC 100%)"
COLOR_TEXT_PRIMARY = "#1E1E1E"    # Charcoal suave / soft near-black
COLOR_TEXT_SECONDARY = "#4E4C48"  # Grafite editorial neutro
COLOR_TEXT_MUTED = "#8A8782"      # Greige mineral
COLOR_DIVIDER = "#D8D4CD"         # Filete mineral sutil
COLOR_LOREAL_ACCENT = "#7E1B28"   # Rubi profundo / muted deep burgundy institucional


def build_catalog_payload():
    elements = [
        # 1. Fundo Warm Ivory Unificado (Textura Táctil Mineral Sutil)
        {
            "logicalId": "el-bg",
            "name": "Fundo Warm Ivory",
            "type": "shape-rectangle",
            "position": {"x": 0, "y": 0},
            "size": {"width": PAGE_W, "height": PAGE_H},
            "zIndex": 0,
            "style": {
                "backgroundColor": COLOR_BG_GRAD,
                "borderRadius": 0
            }
        },

        # 2. Top Area: Identificador Editorial L'Oréal Groupe
        {
            "logicalId": "el-top-brand",
            "name": "L'Oréal Groupe",
            "type": "text-title",
            "position": {"x": 56, "y": 84},
            "size": {"width": 682, "height": 22},
            "zIndex": 1,
            "className": "tracking-widest uppercase font-medium",
            "style": {
                "fontFamily": SANS_DISPLAY,
                "fontSize": 11,
                "fontWeight": "500",
                "textColor": "#2B2927",
                "textAlign": "center"
            },
            "content": {
                "text": "L'ORÉAL GROUPE"
            }
        },
        {
            "logicalId": "el-top-sub",
            "name": "Sub-identificador 2026",
            "type": "text-title",
            "position": {"x": 56, "y": 110},
            "size": {"width": 682, "height": 18},
            "zIndex": 1,
            "className": "tracking-widest uppercase",
            "style": {
                "fontFamily": SANS_BODY,
                "fontSize": 8.5,
                "fontWeight": "400",
                "textColor": COLOR_TEXT_MUTED,
                "textAlign": "center"
            },
            "content": {
                "text": "BEAUTY MAKE YOUR MOVE • 2026"
            }
        },

        # 3. Center Area: Símbolo Abstrato de Sincronização (Produto → Pessoa → Rotina)
        {
            "logicalId": "el-sync-symbol",
            "name": "Gesto Abstrato de Sincronização",
            "type": "image",
            "position": {"x": (PAGE_W - 160) // 2, "y": 428},
            "size": {"width": 160, "height": 56},
            "zIndex": 2,
            "imageUrl": "/media/media/skinsync_symbol.png",
            "imageData": {
                "src": "/media/media/skinsync_symbol.png",
                "opacity": 0.9,
                "objectFit": "contain",
                "aspectRatioLocked": True
            },
            "style": {
                "objectFit": "contain"
            }
        },

        # 4. Protagonista Tipográfico Central: SKIN · SYNC
        # Metade Esquerda "SKIN" (4 letras) + Micro-Acento Rubi (#7E1B28) + Metade Direita "SYNC" (4 letras)
        # Perfeita simetria óptica ao redor do eixo x=397.
        {
            "logicalId": "el-title-skin",
            "name": "SKIN",
            "type": "text-title",
            "position": {"x": 196, "y": 502},
            "size": {"width": 188, "height": 48},
            "zIndex": 3,
            "className": "tracking-widest uppercase font-medium",
            "style": {
                "fontFamily": SANS_DISPLAY,
                "fontSize": 34,
                "fontWeight": "400",
                "textColor": COLOR_TEXT_PRIMARY,
                "textAlign": "right"
            },
            "content": {
                "text": "SKIN"
            }
        },

        # Detalhe Tipográfico Sutil: Micro-Acento circular de sincronização (#7E1B28)
        {
            "logicalId": "el-accent-dot",
            "name": "Micro-Acento Rubi L'Oréal",
            "type": "shape-rectangle",
            "position": {"x": 395, "y": 524},
            "size": {"width": 4, "height": 4},
            "zIndex": 5,
            "style": {
                "backgroundColor": COLOR_LOREAL_ACCENT,
                "borderRadius": 9999
            }
        },

        {
            "logicalId": "el-title-sync",
            "name": "SYNC",
            "type": "text-title",
            "position": {"x": 410, "y": 502},
            "size": {"width": 188, "height": 48},
            "zIndex": 3,
            "className": "tracking-widest uppercase font-medium",
            "style": {
                "fontFamily": SANS_DISPLAY,
                "fontSize": 34,
                "fontWeight": "400",
                "textColor": COLOR_TEXT_PRIMARY,
                "textAlign": "left"
            },
            "content": {
                "text": "SYNC"
            }
        },

        # 5. Tagline Editorial: "Sua pele. Seus produtos. Sua rotina."
        # Usando text-title para evitar padding/overflow-hidden e garantir centralização perfeita
        {
            "logicalId": "el-tagline",
            "name": "Tagline Editorial",
            "type": "text-title",
            "position": {"x": 56, "y": 570},
            "size": {"width": 682, "height": 28},
            "zIndex": 2,
            "style": {
                "fontFamily": SANS_BODY,
                "fontSize": 13.5,
                "fontWeight": "400",
                "textColor": COLOR_TEXT_SECONDARY,
                "textAlign": "center",
                "letterSpacing": 2.5
            },
            "content": {
                "text": "Sua pele. Seus produtos. Sua rotina."
            }
        },

        # 6. Conceito Intermediário: BEAUTY • SCIENCE • TECHNOLOGY
        {
            "logicalId": "el-concept-line",
            "name": "Beauty Science Technology",
            "type": "text-title",
            "position": {"x": 56, "y": 618},
            "size": {"width": 682, "height": 20},
            "zIndex": 2,
            "className": "tracking-widest uppercase",
            "style": {
                "fontFamily": SANS_BODY,
                "fontSize": 9,
                "fontWeight": "400",
                "textColor": COLOR_TEXT_MUTED,
                "textAlign": "center"
            },
            "content": {
                "text": "BEAUTY • SCIENCE • TECHNOLOGY"
            }
        },

        # 7. Bottom Area: Linha Divisória de Precisão + Conceito Estratégico
        {
            "logicalId": "el-bottom-divider",
            "name": "Hairline Inferior",
            "type": "shape-rectangle",
            "position": {"x": (PAGE_W - 56) // 2, "y": 975},
            "size": {"width": 56, "height": 1},
            "zIndex": 1,
            "style": {
                "backgroundColor": COLOR_DIVIDER,
                "borderRadius": 0
            }
        },
        {
            "logicalId": "el-bottom-concept",
            "name": "Beauty Tech Concept",
            "type": "text-title",
            "position": {"x": 56, "y": 996},
            "size": {"width": 682, "height": 20},
            "zIndex": 2,
            "className": "tracking-widest uppercase font-medium",
            "style": {
                "fontFamily": SANS_BODY,
                "fontSize": 9,
                "fontWeight": "500",
                "textColor": "#55524E",
                "textAlign": "center"
            },
            "content": {
                "text": "BEAUTY TECH CONCEPT"
            }
        },
        {
            "logicalId": "el-bottom-transition",
            "name": "Transição Estratégica",
            "type": "text-title",
            "position": {"x": 56, "y": 1020},
            "size": {"width": 682, "height": 22},
            "zIndex": 2,
            "style": {
                "fontFamily": SANS_BODY,
                "fontSize": 11.5,
                "fontWeight": "400",
                "textColor": "#76736E",
                "textAlign": "center"
            },
            "content": {
                "text": "Grande Público  →  Beleza Dermatológica"
            }
        }
    ]

    design_tokens = {
        "name": "L'Oréal Beauty Tech — SKINSYNC",
        "version": "1.0",
        "description": "Identidade minimalista premium para conceito de inovação Beauty Tech L'Oréal.",
        "colors": {
            "primary": {"value": COLOR_TEXT_PRIMARY, "description": "Charcoal suave"},
            "secondary": {"value": COLOR_LOREAL_ACCENT, "description": "Rubi profundo L'Oréal"},
            "accent": {"value": COLOR_LOREAL_ACCENT, "description": "Detalhe de sincronização"},
            "background": {"value": COLOR_BG, "description": "Warm ivory / mineral beige"},
            "surface": {"value": "#FFFFFF"},
            "border": {"value": COLOR_DIVIDER},
            "text": {
                "primary": {"value": COLOR_TEXT_PRIMARY},
                "secondary": {"value": COLOR_TEXT_SECONDARY},
                "disabled": {"value": COLOR_TEXT_MUTED}
            }
        },
        "typography": {
            "h1": {"fontFamily": SANS_DISPLAY, "fontSize": 34, "fontWeight": 400, "lineHeight": 1.2},
            "body": {"fontFamily": SANS_BODY, "fontSize": 13.5, "fontWeight": 400, "lineHeight": 1.4}
        },
        "spacing": {"base": 8, "xxs": 2, "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32, "xxl": 48, "xxxl": 64},
        "borderRadius": {"none": 0, "sm": 4, "md": 8, "lg": 14, "xl": 20, "full": 9999},
        "shadows": {
            "none": {"value": "none"},
            "sm": {"value": "0 1px 2px rgba(0,0,0,0.04)"},
            "md": {"value": "0 4px 10px rgba(0,0,0,0.06)"},
            "lg": {"value": "0 12px 24px rgba(0,0,0,0.08)"},
            "xl": {"value": "0 20px 32px rgba(0,0,0,0.10)"}
        }
    }

    envelope = {
        "app": "Catana",
        "schemaVersion": "1.0",
        "exportedAt": "2026-09-08T00:00:00.000Z",
        "catalog": {
            "name": "SKINSYNC — L'Oréal Beauty Tech",
            "description": "Apresentação de Inovação Estratégica: Sua pele. Seus produtos. Sua rotina."
        },
        "settings": {
            "gridSize": 8,
            "snapToGrid": True,
            "defaultZoom": 75
        },
        "designTokens": design_tokens,
        "pages": [
            {
                "logicalId": "page-skinsync-cover",
                "name": "Capa",
                "order": 0,
                "elements": elements
            }
        ]
    }
    return envelope


def main():
    payload = build_catalog_payload()
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    output_path = os.path.join(base_dir, "catalogo_skinsync.json")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"✅ Arquivo JSON gerado: {output_path}")
    print(f"   Páginas: {len(payload['pages'])}, Elementos: {len(payload['pages'][0]['elements'])}")

    # Enviar para a API Catana (POST /api/catalogs/import-json/) com mode replace
    api_url = "http://localhost:8001/api/catalogs/import-json/"
    body_data = {
        "data": payload,
        "mode": "replace",
        "catalog_id": 289
    }
    json_bytes = json.dumps(body_data, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        api_url,
        data=json_bytes,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            print(f"\n🎉 Catálogo atualizado com sucesso!")
            print(f"   ID do Catálogo: {data.get('catalog_id')}")
            print(f"   Título: {data.get('title')}")
            print(f"   Páginas: {data.get('pages')}")
            print(f"   Elementos: {data.get('elements')}")
            print(f"   URL do Editor: http://localhost:5173/editor?catalog={data.get('catalog_id')}")

            # Garantir escopo demo Org e flag is_demo=True
            try:
                import django
                os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')
                django.setup()
                from api.models import Catalog, Organization, User
                cat = Catalog.objects.filter(id=data.get('catalog_id')).first()
                if cat:
                    org = Organization.objects.filter(name='demo Org').first()
                    u = User.objects.filter(username='demo').first()
                    if org:
                        cat.organization = org
                        cat.sede = org.sedes.first()
                    if u:
                        cat.created_by = u
                    cat.is_demo = True
                    cat.is_public = True
                    cat.save()
            except Exception:
                pass

            return data.get('catalog_id')
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode('utf-8')
        print(f"❌ Erro HTTP {e.code}: {err_msg}")
    except Exception as e:
        print(f"❌ Erro ao conectar na API ({api_url}): {e}")


if __name__ == "__main__":
    main()
