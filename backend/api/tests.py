"""
DIV-04: testes dos caminhos críticos.

Cobrem:
- Fase 2 (SEG-02): endpoints privados exigem autenticação (401), públicos não.
- Fase 3 (INC-01): save_content é transacional e idempotente (sem órfãos).
- Fase 4 (INC-05): bulk_import cria produtos e reporta erros por linha.

Usa force_authenticate (não assina JWT) para não depender de cripto no runner.
"""
from rest_framework.test import APITestCase, APIRequestFactory, force_authenticate

from .models import (
    User, Organization, Sede, Catalog, Page, Component, PageComponent, Category,
    Product,
)
from . import views


class AuthGateTests(APITestCase):
    """SEG-02: o gate de autenticação está ligado de verdade."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username='ed', email='ed@e.com', password='x', role='editor'
        )

    def _anon_status(self, viewset, action='list', method='get'):
        view = viewset.as_view({method: action})
        return view(getattr(self.factory, method)('/')).status_code

    def test_private_viewsets_require_auth(self):
        for vs in [views.ProductViewSet, views.OrganizationViewSet,
                   views.CatalogViewSet, views.MediaViewSet,
                   views.MediaFolderViewSet, views.CategoryViewSet,
                   views.SedeViewSet]:
            self.assertEqual(self._anon_status(vs), 401,
                             f'{vs.__name__} deveria exigir autenticação')

    def test_explore_is_public(self):
        self.assertEqual(self._anon_status(views.ExploreProductViewSet), 200)

    def test_authenticated_can_list_products(self):
        view = views.ProductViewSet.as_view({'get': 'list'})
        req = self.factory.get('/')
        force_authenticate(req, user=self.user)
        self.assertEqual(view(req).status_code, 200)


class SaveContentTests(APITestCase):
    """INC-01: persistência relacional do editor, transacional e idempotente."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username='ed', email='ed@e.com', password='x', role='editor'
        )
        self.org = Organization.objects.create(name='O', owner=self.user)
        self.user.organizations.add(self.org)
        self.catalog = Catalog.objects.create(
            title='C', description='', organization=self.org, created_by=self.user
        )

    def _save(self, payload):
        view = views.CatalogViewSet.as_view({'post': 'save_content'})
        req = self.factory.post('/', payload, format='json')
        force_authenticate(req, user=self.user)
        return view(req, pk=self.catalog.id)

    def _payload(self):
        return {'pages': [
            {'order': 0, 'elements': [
                {'type': 'text-title', 'name': 'T',
                 'position': {'x': 10, 'y': 20},
                 'size': {'width': 100, 'height': 30}, 'zIndex': 0,
                 'content': {'text': 'Oi'}},
                {'type': 'product-card',
                 'position': {'x': 5, 'y': 5},
                 'size': {'width': 200, 'height': 150}, 'zIndex': 1},
            ]},
            {'order': 1, 'elements': [
                {'type': 'image', 'position': {'x': 0, 'y': 0},
                 'size': {'width': 50, 'height': 50}, 'zIndex': 0},
            ]},
        ]}

    def test_save_creates_relational_content(self):
        resp = self._save(self._payload())
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(Page.objects.filter(catalog=self.catalog).count(), 2)
        self.assertEqual(Component.objects.count(), 3)
        self.assertEqual(PageComponent.objects.count(), 3)
        pc = PageComponent.objects.get(component__name='T')
        self.assertEqual((pc.position_x, pc.position_y, pc.width, pc.height),
                         (10, 20, 100, 30))

    def test_save_is_idempotent_without_orphans(self):
        self._save(self._payload())
        self._save(self._payload())
        # Mesmos números após salvar duas vezes: nada duplica nem fica órfão.
        self.assertEqual(Page.objects.filter(catalog=self.catalog).count(), 2)
        self.assertEqual(Component.objects.count(), 3)
        self.assertEqual(PageComponent.objects.count(), 3)


class IngestCatalogIOTests(APITestCase):
    """Ingest catalogIO v1.0 -> banco: fidelidade, Theme, idempotência, validação."""

    def _json(self):
        return {
            'app': 'Catana', 'schemaVersion': '1.0',
            'catalog': {'name': 'Cat Ingest', 'description': 'd'},
            'designTokens': {'name': 'T', 'colors': {'primary': {'value': '#abc'}}},
            'pages': [
                {'logicalId': 'l0', 'name': 'Capa', 'order': 0, 'elements': [
                    {'logicalId': 'l1', 'type': 'text-title', 'name': 'Título',
                     'position': {'x': 56, 'y': 120}, 'size': {'width': 682, 'height': 90},
                     'zIndex': 0, 'style': {'fontSize': 48}, 'content': {'text': 'Oi'}},
                ]},
                {'logicalId': 'l2', 'name': 'P2', 'order': 1, 'elements': [
                    {'logicalId': 'l3', 'type': 'image', 'position': {'x': 0, 'y': 0},
                     'size': {'width': 100, 'height': 80}, 'zIndex': 0,
                     'imageData': {'src': '/media/x.jpg'}, 'imageUrl': '/media/x.jpg'},
                ]},
            ],
        }

    def setUp(self):
        from .catalog_ingest import importar_catalogo_json
        self.importar = importar_catalogo_json
        self.user = User.objects.create_user(username='ig', email='i@i.com',
                                              password='x', role='admin')

    def test_materializa_geometria_e_content(self):
        cat, n_pag, n_el = self.importar(self._json(), user=self.user)
        self.assertEqual((n_pag, n_el), (2, 2))
        pc = PageComponent.objects.get(component__content__type='text-title')
        # geometria no PageComponent
        self.assertEqual((pc.position_x, pc.position_y, pc.width, pc.height, pc.layer),
                         (56, 120, 682, 90, 0))
        # content sem geometria, com o resto fiel
        self.assertNotIn('position', pc.component.content)
        self.assertEqual(pc.component.content['content'], {'text': 'Oi'})
        self.assertEqual(pc.component.content['style'], {'fontSize': 48})

    def test_theme_dos_design_tokens(self):
        cat, _, _ = self.importar(self._json(), user=self.user)
        self.assertIsNotNone(cat.theme)
        self.assertEqual(cat.theme.styles['designTokens']['colors']['primary']['value'], '#abc')

    def test_replace_idempotente(self):
        cat, _, _ = self.importar(self._json(), user=self.user)
        self.importar(self._json(), user=self.user, mode='replace', catalog_id=cat.id)
        self.importar(self._json(), user=self.user, mode='replace', catalog_id=cat.id)
        self.assertEqual(Page.objects.filter(catalog=cat).count(), 2)
        self.assertEqual(Component.objects.filter(organization__isnull=True).count(), 2)

    def test_endpoint_valida_antes_de_escrever(self):
        antes = Catalog.objects.count()
        r = self.client.post('/api/catalogs/import-json/',
                             {'app': 'X', 'schemaVersion': '1.0', 'catalog': {'name': 'y'}, 'pages': []},
                             format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(Catalog.objects.count(), antes)  # nada escrito

    def test_endpoint_importa(self):
        r = self.client.post('/api/catalogs/import-json/', self._json(), format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['pages'], 2)


class DemoGeneratorTests(APITestCase):
    """Catálogo de demonstração: gera, é idempotente e baka estilo no content."""

    def test_gera_padaria_completo(self):
        from .demo.generator import gerar_catalogo_demo
        from .models import Page, PageComponent
        cat = gerar_catalogo_demo(tema='padaria', estrutura='completo')
        self.assertTrue(cat.is_demo)
        self.assertGreaterEqual(cat.pages.count(), 10)
        # geometria no PageComponent, estilo baked no Component.content
        pc = PageComponent.objects.filter(component__content__type='text-title').first()
        self.assertIsNotNone(pc)
        self.assertIn('textColor', pc.component.content['style'])
        # imagem com URL relativa /media/ em imageUrl e imageData.src
        img = PageComponent.objects.filter(component__component_type='image').first()
        self.assertTrue(img.component.content['imageUrl'].startswith('/media/'))
        self.assertEqual(img.component.content['imageData']['src'],
                         img.component.content['imageUrl'])

    def test_idempotente(self):
        from .demo.generator import gerar_catalogo_demo
        from .models import Catalog, Organization
        gerar_catalogo_demo(tema='padaria')
        gerar_catalogo_demo(tema='padaria')
        self.assertEqual(Catalog.objects.filter(is_demo=True).count(), 1)
        self.assertEqual(Organization.objects.filter(name__startswith='[DEMO]').count(), 1)

    def test_endpoint_allowany(self):
        # Sem autenticação (decisão de produto: público).
        r = self.client.post('/api/catalogs/gerar-demo/',
                             {'tema': 'padaria', 'estrutura': 'essencial'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertIn('catalog_id', r.data)


class BulkImportTests(APITestCase):
    """INC-05: importação de produtos em lote."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create_user(
            username='ed', email='ed@e.com', password='x', role='editor'
        )
        self.org = Organization.objects.create(name='O', owner=self.user)
        self.user.organizations.add(self.org)
        self.sede = Sede.objects.create(name='S', organization=self.org)
        self.user.sedes.add(self.sede)

    def _import(self, products):
        view = views.ProductViewSet.as_view({'post': 'bulk_import'})
        req = self.factory.post('/', {
            'products': products,
            'organization': self.org.id,
            'sede': self.sede.id,
        }, format='json')
        force_authenticate(req, user=self.user)
        return view(req)

    def test_imports_valid_rows(self):
        resp = self._import([
            {'name': 'P1', 'sku': 'S1', 'price': '10.00'},
            {'name': 'P2', 'sku': 'S2', 'price': '20.00'},
        ])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['success'], 2)
        self.assertEqual(resp.data['failed'], 0)
        self.assertEqual(Product.objects.count(), 2)

    def test_duplicate_sku_is_reported(self):
        Product.objects.create(
            name='X', description='', price=1, sku='DUP', stock=0,
            organization=self.org, sede=self.sede, created_by=self.user,
        )
        resp = self._import([{'name': 'P', 'sku': 'DUP', 'price': '1.00'}])
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['failed'], 1)
        self.assertTrue(resp.data['errors'])
