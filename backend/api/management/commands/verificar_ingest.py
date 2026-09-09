"""
Verifica a FIDELIDADE do ingest catalogIO v1.0 -> banco.

1. Importa um JSON catalogIO de exemplo (modo new).
2. Reconstrói os elementos a partir das linhas gravadas usando a MESMA lógica do
   catalogLoader.service.ts (geometria do PageComponent, resto de Component.content)
   e compara campo a campo com o JSON de entrada.
3. Reimporta em modo replace e confirma que NÃO duplica páginas (idempotência).

Uso:  python manage.py verificar_ingest
"""
import json

from django.core.management.base import BaseCommand

from api.models import User, Page, PageComponent, Theme
from api.catalog_ingest import importar_catalogo_json


def _json_exemplo():
    """catalogIO v1.0 com elementos variados (geometria inteira p/ comparação exata)."""
    return {
        'app': 'Catana',
        'schemaVersion': '1.0',
        'exportedAt': '2026-06-29T00:00:00.000Z',
        'catalog': {'name': 'Catálogo Ingest Teste', 'description': 'round-trip'},
        'settings': {'gridSize': 8, 'snapToGrid': True, 'defaultZoom': 75},
        'designTokens': {'name': 'Tema X', 'version': '1.0',
                         'colors': {'primary': {'value': '#123456'}}},
        'pages': [
            {'logicalId': 'logical-0', 'name': 'Capa', 'order': 0, 'elements': [
                {'logicalId': 'logical-1', 'type': 'text-title', 'name': 'Título',
                 'position': {'x': 56, 'y': 120}, 'size': {'width': 682, 'height': 90},
                 'zIndex': 0, 'visible': True, 'locked': False, 'rotation': 0,
                 'style': {'fontFamily': 'Georgia, serif', 'fontSize': 48,
                           'fontWeight': 'bold', 'textColor': '#123456', 'textAlign': 'left'},
                 'content': {'text': 'Bem-vindo'}},
                {'logicalId': 'logical-2', 'type': 'image', 'name': 'Hero',
                 'position': {'x': 56, 'y': 230}, 'size': {'width': 682, 'height': 400},
                 'zIndex': 1, 'style': {'borderRadius': 16, 'objectFit': 'cover'},
                 'imageUrl': '/media/media/hero.jpg',
                 'imageData': {'src': '/media/media/hero.jpg', 'opacity': 1,
                               'borderRadius': 16, 'objectFit': 'cover', 'aspectRatioLocked': False}},
            ]},
            {'logicalId': 'logical-3', 'name': 'Produtos', 'order': 1, 'elements': [
                {'logicalId': 'logical-4', 'type': 'shape-rectangle', 'name': 'Card',
                 'position': {'x': 56, 'y': 200}, 'size': {'width': 320, 'height': 260},
                 'zIndex': 0, 'style': {'backgroundColor': '#FFFFFF', 'borderRadius': 14}},
                {'logicalId': 'logical-5', 'type': 'product-card', 'name': 'Produto',
                 'position': {'x': 72, 'y': 216}, 'size': {'width': 288, 'height': 150},
                 'zIndex': 1, 'style': {},
                 'productData': {'name': 'Pão', 'image': '', 'price': 9, 'currency': 'BRL'}},
                {'logicalId': 'logical-6', 'type': 'qr-code', 'name': 'QR',
                 'position': {'x': 600, 'y': 980}, 'size': {'width': 100, 'height': 100},
                 'zIndex': 2, 'style': {},
                 'qrCodeData': {'destinationType': 'url', 'data': 'https://x', 'color': '#000',
                                'backgroundColor': '#fff'}},
            ]},
        ],
    }


# Campos de geometria que o ingest move para o PageComponent (saem do content).
_GEOM = ('logicalId', 'position', 'size', 'zIndex')


def _reconstruir(catalog):
    """Reconstrói os elementos do banco como o catalogLoader.service.ts faria."""
    paginas = []
    for page in Page.objects.filter(catalog=catalog).order_by('order'):
        elementos = []
        for pc in PageComponent.objects.filter(page=page).order_by('layer'):
            oe = pc.component.content  # originalElement
            elementos.append({
                'type': oe.get('type', 'text'),
                'name': oe.get('name') or pc.component.name,
                'position': {'x': pc.position_x, 'y': pc.position_y},
                'size': {'width': pc.width, 'height': pc.height},
                'zIndex': pc.layer,
                'content_bruto': oe,  # para comparar Component.content campo a campo
            })
        paginas.append({'order': page.order, 'elements': elementos})
    return paginas


class Command(BaseCommand):
    help = 'Verifica a fidelidade do ingest catalogIO v1.0 -> banco.'

    def handle(self, *args, **opts):
        falhas = []

        def checa(cond, msg):
            self.stdout.write(('  OK   ' if cond else '  FALHA ') + msg)
            if not cond:
                falhas.append(msg)

        data = _json_exemplo()
        user = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if user is None:
            user = User.objects.create_user(username='ingest_test', email='i@t.com',
                                            password='x', role='admin')

        self.stdout.write(self.style.MIGRATE_HEADING('1) Import (modo new) + fidelidade'))
        catalog, n_pag, n_el = importar_catalogo_json(data, user=user)
        entrada_paginas = data['pages']
        checa(n_pag == len(entrada_paginas), f'contagem de páginas ({n_pag} == {len(entrada_paginas)})')
        checa(n_el == sum(len(p['elements']) for p in entrada_paginas),
              f'contagem de elementos ({n_el})')

        recon = _reconstruir(catalog)
        for pi, (pin, prec) in enumerate(zip(entrada_paginas, recon)):
            checa(len(pin['elements']) == len(prec['elements']),
                  f'pág {pi}: nº de elementos ({len(prec["elements"])})')
            for ei, (ein, erec) in enumerate(zip(pin['elements'], prec['elements'])):
                tag = f'pág {pi} el {ei} ({ein["type"]})'
                checa(erec['type'] == ein['type'], f'{tag}: type')
                checa(erec['position'] == {'x': ein['position']['x'], 'y': ein['position']['y']},
                      f'{tag}: position {erec["position"]}')
                checa(erec['size'] == {'width': ein['size']['width'], 'height': ein['size']['height']},
                      f'{tag}: size {erec["size"]}')
                checa(erec['zIndex'] == ein.get('zIndex', ei), f'{tag}: zIndex')
                # Component.content == elemento de entrada SEM a geometria (campo a campo)
                esperado = {k: v for k, v in ein.items() if k not in _GEOM}
                checa(erec['content_bruto'] == esperado,
                      f'{tag}: Component.content campo a campo')
                if erec['content_bruto'] != esperado:
                    self.stdout.write('     esperado: ' + json.dumps(esperado, ensure_ascii=False))
                    self.stdout.write('     gravado : ' + json.dumps(erec['content_bruto'], ensure_ascii=False))

        # Theme a partir dos designTokens
        checa(catalog.theme is not None, 'Theme criado a partir de designTokens')
        if catalog.theme:
            dt = (catalog.theme.styles or {}).get('designTokens')
            checa(dt == data['designTokens'], 'Theme.styles.designTokens == entrada')

        self.stdout.write(self.style.MIGRATE_HEADING('2) Idempotência (modo replace 2x)'))
        importar_catalogo_json(data, user=user, mode='replace', catalog_id=catalog.id)
        importar_catalogo_json(data, user=user, mode='replace', catalog_id=catalog.id)
        pag_apos = Page.objects.filter(catalog=catalog).count()
        checa(pag_apos == len(entrada_paginas),
              f'replace não duplica páginas (= {len(entrada_paginas)}, obtido {pag_apos})')

        self.stdout.write(self.style.MIGRATE_HEADING('3) Modo new cria catálogo separado'))
        catalog2, n_pag2, _ = importar_catalogo_json(data, user=user)
        checa(catalog2.id != catalog.id, 'novo catálogo tem id distinto')
        checa(n_pag2 == len(entrada_paginas) and
              Page.objects.filter(catalog=catalog).count() == len(entrada_paginas),
              'catálogo original intacto após novo import')

        self.stdout.write('')
        if falhas:
            self.stdout.write(self.style.ERROR(f'FALHOU: {len(falhas)} verificação(ões).'))
        else:
            self.stdout.write(self.style.SUCCESS('TODAS as verificações de fidelidade passaram.'))
