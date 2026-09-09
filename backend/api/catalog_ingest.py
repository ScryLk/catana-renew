"""
Ingest de catálogos no formato catalogIO v1.0 (o JSON que o editor exporta) para
linhas relacionais Page/PageComponent/Component/Theme — de modo que o catálogo
nasça TOTALMENTE EDITÁVEL no editor.

É o INVERSO exato do `catalogLoader.service.ts`:
- geometria  -> colunas do PageComponent (position_x/y, width, height, layer)
- resto do elemento (sem geometria) -> Component.content (lido de volta como o
  "originalElement" pelo loader: type, name, style, content, textData, ...)
- designTokens (se houver) -> Theme.styles['designTokens'], linkado em Catalog.theme

Tudo síncrono e transacional. Modos: 'new' (cria um Catalog) ou 'replace' (recria
sobre um catalog_id alvo, sem orfanar Components reutilizáveis de outros catálogos).
"""
from django.db import transaction

from .models import Catalog, Page, Component, PageComponent, Theme

VERSAO_SUPORTADA = '1.0'

# Campos do elemento que NÃO vão para o content (geometria mora no PageComponent).
_CAMPOS_GEOMETRIA = ('logicalId', 'position', 'size', 'zIndex')


class IngestError(ValueError):
    """Erro de validação do JSON de entrada (vira 400 na view)."""


def validar_catalogio(data):
    """Valida o envelope catalogIO v1.0. Levanta IngestError com mensagem clara."""
    if not isinstance(data, dict):
        raise IngestError('Corpo inválido: esperado um objeto JSON.')
    if data.get('app') != 'Catana':
        raise IngestError('Este JSON não foi gerado pelo Catana (app != "Catana").')
    versao = data.get('schemaVersion')
    if versao != VERSAO_SUPORTADA:
        raise IngestError(
            f'schemaVersion "{versao}" não suportado. Suportado: {VERSAO_SUPORTADA}.'
        )
    catalog = data.get('catalog')
    if not isinstance(catalog, dict) or not (catalog.get('name') or '').strip():
        raise IngestError('Metadados do catálogo ausentes ou sem "name".')
    pages = data.get('pages')
    if not isinstance(pages, list):
        raise IngestError('"pages" ausente ou não é uma lista.')

    for i, page in enumerate(pages):
        if not isinstance(page, dict):
            raise IngestError(f'Página {i} inválida (esperado objeto).')
        elements = page.get('elements')
        if not isinstance(elements, list):
            raise IngestError(f'Página {i}: "elements" ausente ou não é uma lista.')
        for j, el in enumerate(elements):
            if not isinstance(el, dict):
                raise IngestError(f'Página {i}, elemento {j}: esperado objeto.')
            if not el.get('type'):
                raise IngestError(f'Página {i}, elemento {j}: "type" obrigatório.')
            pos, size = el.get('position'), el.get('size')
            if not isinstance(pos, dict) or 'x' not in pos or 'y' not in pos:
                raise IngestError(f'Página {i}, elemento {j}: "position" {{x,y}} obrigatório.')
            if not isinstance(size, dict) or 'width' not in size or 'height' not in size:
                raise IngestError(f'Página {i}, elemento {j}: "size" {{width,height}} obrigatório.')


def _component_type(el_type):
    t = (el_type or '').lower()
    if t.startswith('text'):
        return 'text'
    if t.startswith('product'):
        return 'product'
    return 'image'


def _para_int(v, default=0):
    try:
        return int(round(float(v)))
    except (TypeError, ValueError):
        return default


def _conteudo_do_elemento(element):
    """Element JSON SEM a geometria (que vai para o PageComponent)."""
    return {k: v for k, v in element.items() if k not in _CAMPOS_GEOMETRIA}


def _limpar_conteudo(catalog):
    """Remove Pages/PageComponents/Components (não reutilizáveis) do catálogo.

    Só apaga Components com is_reusable=False referenciados pelas páginas DESTE
    catálogo — não orfana componentes reutilizáveis nem de outros catálogos.
    """
    pages = Page.objects.filter(catalog=catalog)
    pcs = PageComponent.objects.filter(page__in=pages)
    component_ids = list(pcs.values_list('component_id', flat=True))
    pcs.delete()
    Component.objects.filter(id__in=component_ids, is_reusable=False).delete()
    pages.delete()


@transaction.atomic
def importar_catalogo_json(data, *, user, organization=None, sede=None,
                           mode='new', catalog_id=None):
    """
    Materializa o JSON catalogIO v1.0 em linhas relacionais. Retorna o Catalog.

    mode='new'     -> cria um Catalog novo.
    mode='replace' -> exige catalog_id; recria o conteúdo daquele Catalog
                      (idempotente: reimportar o mesmo JSON não duplica páginas).
    """
    validar_catalogio(data)
    meta = data.get('catalog', {})

    if mode == 'replace':
        if not catalog_id:
            raise IngestError('mode="replace" exige "catalog_id".')
        try:
            catalog = Catalog.objects.get(id=catalog_id)
        except Catalog.DoesNotExist:
            raise IngestError(f'Catálogo {catalog_id} não encontrado para replace.')
        _limpar_conteudo(catalog)
        catalog.title = meta.get('name') or catalog.title
        catalog.description = meta.get('description') or catalog.description or ''
        catalog.save(update_fields=['title', 'description'])
    elif mode == 'new':
        catalog = Catalog.objects.create(
            title=meta.get('name'),
            description=meta.get('description') or '',
            organization=organization,
            sede=sede,
            created_by=user,
        )
    else:
        raise IngestError(f'mode "{mode}" inválido (use "new" ou "replace").')

    # Theme a partir dos designTokens (baked em styles.designTokens), se houver.
    design_tokens = data.get('designTokens')
    if design_tokens:
        theme = Theme.objects.create(
            name=f'{catalog.title} Theme',
            styles={'designTokens': design_tokens},
            organization=organization,
            sede=sede,
            created_by=user,
        )
        catalog.theme = theme
        catalog.save(update_fields=['theme'])

    total_paginas = 0
    total_elementos = 0
    for page_index, page_data in enumerate(data.get('pages', [])):
        page = Page.objects.create(
            catalog=catalog,
            order=_para_int(page_data.get('order'), page_index),
        )
        total_paginas += 1

        for el_index, element in enumerate(page_data.get('elements', [])):
            position = element.get('position', {}) or {}
            size = element.get('size', {}) or {}
            component = Component.objects.create(
                name=element.get('name') or element.get('type') or 'elemento',
                component_type=_component_type(element.get('type')),
                content=_conteudo_do_elemento(element),
                is_reusable=False,
                organization=organization,
                sede=sede,
                created_by=user,
            )
            PageComponent.objects.create(
                page=page,
                component=component,
                position_x=_para_int(position.get('x')),
                position_y=_para_int(position.get('y')),
                width=_para_int(size.get('width')),
                height=_para_int(size.get('height')),
                layer=_para_int(element.get('zIndex'), el_index),
            )
            total_elementos += 1

    return catalog, total_paginas, total_elementos
