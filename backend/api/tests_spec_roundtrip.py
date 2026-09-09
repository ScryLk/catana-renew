"""Validação temporária do exemplo §7 do docs/CATALOG_JSON_SPEC.md.

Importa o JSON mínimo do spec via o tradutor real (importar_catalogo_json) e
reconstrói os elementos pelos MESMOS passos do catalogLoader.service.ts,
conferindo geometria + content. Garante que o exemplo do doc é fiel.
"""
from rest_framework.test import APITestCase

from .models import User, Page, PageComponent
from .catalog_ingest import importar_catalogo_json

SPEC_MINIMO = {
    "app": "Catana", "schemaVersion": "1.0",
    "exportedAt": "2026-06-30T12:00:00.000Z",
    "catalog": {"name": "Catálogo Mínimo", "description": "Exemplo de 1 página"},
    "settings": {"gridSize": 8, "snapToGrid": True, "defaultZoom": 75},
    "designTokens": {
        "name": "Tema Exemplo", "version": "1.0",
        "colors": {
            "primary": {"value": "#1F6F54"}, "secondary": {"value": "#E0A458"},
            "background": {"value": "#FFFFFF"}, "surface": {"value": "#F6F4EF"},
            "border": {"value": "#E4E0D8"},
            "text": {"primary": {"value": "#1A1A1A"}, "secondary": {"value": "#6B6B6B"},
                     "disabled": {"value": "#BDBDBD"}},
        },
        "typography": {"h1": {"fontFamily": "Georgia, serif", "fontSize": 44, "fontWeight": 700, "lineHeight": 1.2},
                       "body": {"fontFamily": "Inter, sans-serif", "fontSize": 16, "fontWeight": 400, "lineHeight": 1.6}},
        "spacing": {"base": 8, "xxs": 2, "xs": 4, "sm": 8, "md": 16, "lg": 24, "xl": 32, "xxl": 48, "xxxl": 64},
        "borderRadius": {"none": 0, "sm": 4, "md": 8, "lg": 12, "xl": 16, "full": 9999},
        "shadows": {"none": {"value": "none"}, "sm": {"value": "0 1px 2px rgba(0,0,0,0.05)"},
                    "md": {"value": "0 4px 6px rgba(0,0,0,0.1)"}, "lg": {"value": "0 10px 15px rgba(0,0,0,0.1)"},
                    "xl": {"value": "0 20px 25px rgba(0,0,0,0.15)"}},
    },
    "pages": [
        {"name": "Capa", "order": 0, "elements": [
            {"type": "shape-rectangle", "name": "Faixa",
             "position": {"x": 0, "y": 0}, "size": {"width": 794, "height": 160}, "zIndex": 0,
             "style": {"backgroundColor": "$tokens.colors.primary", "borderRadius": 0}},
            {"type": "text-title", "name": "Título",
             "position": {"x": 56, "y": 48}, "size": {"width": 682, "height": 70}, "zIndex": 1,
             "style": {"fontFamily": "Georgia, serif", "fontSize": 44, "fontWeight": "bold",
                       "textColor": "#FFFFFF", "textAlign": "left", "lineHeight": 1.2},
             "content": {"text": "Catálogo Primavera"}},
            {"type": "shape-rectangle", "name": "Card",
             "position": {"x": 56, "y": 220}, "size": {"width": 330, "height": 360}, "zIndex": 2,
             "style": {"backgroundColor": "#F6F4EF", "borderColor": "#E4E0D8", "borderWidth": 1,
                       "borderStyle": "solid", "borderRadius": 14}},
            {"type": "image", "name": "Foto",
             "position": {"x": 66, "y": 230}, "size": {"width": 310, "height": 170}, "zIndex": 3,
             "style": {"borderRadius": 10, "objectFit": "cover"},
             "imageUrl": "/media/media/produto.jpg",
             "imageData": {"src": "/media/media/produto.jpg", "opacity": 1, "borderRadius": 10,
                           "objectFit": "cover", "aspectRatioLocked": False}},
            {"type": "text-subtitle", "name": "Nome",
             "position": {"x": 72, "y": 412}, "size": {"width": 298, "height": 44}, "zIndex": 4,
             "style": {"fontFamily": "Georgia, serif", "fontSize": 17, "fontWeight": "bold",
                       "textColor": "#1A1A1A", "textAlign": "left", "lineHeight": 1.2},
             "content": {"text": "Embalagem PET 500ml"}},
            {"type": "text-paragraph", "name": "Desc",
             "position": {"x": 72, "y": 460}, "size": {"width": 298, "height": 70}, "zIndex": 5,
             "style": {"fontFamily": "Inter, sans-serif", "fontSize": 12, "fontWeight": "normal",
                       "textColor": "#6B6B6B", "textAlign": "left", "lineHeight": 1.3},
             "content": {"text": "Transparente, atóxica, ideal para confeitaria e food service."}},
            {"type": "text-subtitle", "name": "Preço",
             "position": {"x": 72, "y": 536}, "size": {"width": 298, "height": 30}, "zIndex": 6,
             "style": {"fontFamily": "Georgia, serif", "fontSize": 21, "fontWeight": "bold",
                       "textColor": "$tokens.colors.secondary", "textAlign": "left"},
             "content": {"text": "R$ 2,90"}},
        ]},
    ],
}

_GEOM = ('logicalId', 'position', 'size', 'zIndex')


def _reconstruir(catalog):
    """Igual ao catalogLoader.service.ts: geometria do PC, resto do content."""
    paginas = []
    for page in Page.objects.filter(catalog=catalog).order_by('order'):
        elementos = []
        for pc in PageComponent.objects.filter(page=page).order_by('layer'):
            oe = pc.component.content
            elementos.append({
                'type': oe.get('type', 'text'),
                'position': {'x': pc.position_x, 'y': pc.position_y},
                'size': {'width': pc.width, 'height': pc.height},
                'zIndex': pc.layer,
                'style': oe.get('style', {}),
                'content': oe.get('content'),
                'imageUrl': oe.get('imageUrl'),
                'content_bruto': oe,
            })
        paginas.append(elementos)
    return paginas


class SpecMinimalRoundTrip(APITestCase):
    def test_spec_minimo_round_trip(self):
        user = User.objects.create_user(username='spec', email='s@s.com',
                                        password='x', role='admin')
        catalog, n_pag, n_el = importar_catalogo_json(SPEC_MINIMO, user=user)
        self.assertEqual((n_pag, n_el), (1, 7))

        # Theme criado a partir dos designTokens
        self.assertIsNotNone(catalog.theme)
        self.assertEqual(
            catalog.theme.styles['designTokens']['colors']['primary']['value'], '#1F6F54')

        recon = _reconstruir(catalog)
        self.assertEqual(len(recon), 1)
        els = recon[0]
        self.assertEqual(len(els), 7)

        entrada = SPEC_MINIMO['pages'][0]['elements']
        for ein, erec in zip(entrada, els):
            self.assertEqual(erec['type'], ein['type'])
            self.assertEqual(erec['position'], ein['position'])
            self.assertEqual(erec['size'], ein['size'])
            self.assertEqual(erec['zIndex'], ein['zIndex'])
            # content == elemento de entrada SEM geometria, campo a campo
            esperado = {k: v for k, v in ein.items() if k not in _GEOM}
            self.assertEqual(erec['content_bruto'], esperado)

        # campos round-trip-safe específicos
        faixa = els[0]
        self.assertEqual(faixa['style']['backgroundColor'], '$tokens.colors.primary')
        titulo = els[1]
        self.assertEqual(titulo['content'], {'text': 'Catálogo Primavera'})
        foto = els[3]
        self.assertEqual(foto['imageUrl'], '/media/media/produto.jpg')
        self.assertEqual(foto['content_bruto']['imageData']['src'], '/media/media/produto.jpg')
