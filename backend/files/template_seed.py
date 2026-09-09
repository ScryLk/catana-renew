#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
ESQUELETO de script de seed — Gerador de Catálogo Temático para o Catana.

⚠️  ESTE É UM MOLDE, NÃO UM SCRIPT PRONTO.
    Antes de usar, ADAPTE ao schema real (Princípio nº1 da SKILL.md):
      - Confirme nomes de campos/FK em catana-back/api/models.py
      - Confirme a forma de Component.content em src/types/editor.ts + catalogLoader.service.ts
      - Pegue um Component.content REAL de um catálogo já semeado como molde exato
    Os pontos marcados com  # CONFIRMAR  são os que mais provavelmente precisam de ajuste.

Uso (exemplos):
    # estrutura essencial (default):
    python gerar_catalogo_<slug>.py --arquivo produtos.csv --tema confeitaria \
        --titulo "Catálogo de Páscoa" --periodo "2026"

    # estrutura completa, negócio B2B/atacado:
    python gerar_catalogo_<slug>.py --arquivo produtos.csv --tema mercado \
        --titulo "Atacado 2026" --estrutura completa --b2b

    # estrutura personalizada (escolher seções):
    python gerar_catalogo_<slug>.py --arquivo produtos.csv --tema confeitaria \
        --titulo "Vitrine" --secoes "capa,produtos,contracapa" [--limpar]
"""

import os
import sys
import csv
import json
import argparse

# --- Bootstrap do Django (mesmo padrão dos scripts existentes do catana-back) -------------
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')  # CONFIRMAR módulo
import django
django.setup()

from django.db import transaction
from django.contrib.auth import get_user_model
from api.models import (  # CONFIRMAR imports / nomes reais
    Organization, Sede, Theme, Catalog, Page, Component, PageComponent,
)

User = get_user_model()

# === Dimensões de página (CONFIRMAR a dimensão padrão em editor.ts/editorStore.ts) ========
PAGE_W = 794    # ~A4 a 96dpi; ajuste ao que o editor usa
PAGE_H = 1123
MARGIN = 48

# === TEMAS =================================================================================
# Valores concretos (ver references/temas.md). Estes serão (a) gravados em
# Theme.styles.designTokens e (b) ASSADOS por elemento (ver references/aparencia.md).
TEMAS = {
    "confeitaria": {
        "colors": {"primary": "#E8A0BF", "secondary": "#B6856A", "accent": "#D4AF37",
                   "background": "#FFF6F0", "surface": "#FFFFFF",
                   "text": "#4A3B40", "textMuted": "#9B8186"},
        "typography": {"heading": "Playfair Display", "body": "Nunito"},
        "card": {"radius": 20, "shadow": "0 4px 16px rgba(0,0,0,0.06)", "border": "none"},
        "cols": 2,  # cards por linha
    },
    "mercado": {
        "colors": {"primary": "#3FA34D", "secondary": "#F4A300", "accent": "#E63946",
                   "background": "#F7FBF5", "surface": "#FFFFFF",
                   "text": "#1E2A22", "textMuted": "#5A6B5E"},
        "typography": {"heading": "Oswald", "body": "Inter"},
        "card": {"radius": 10, "shadow": "0 2px 6px rgba(0,0,0,0.08)", "border": "1px solid #EAEAEA"},
        "cols": 3,
    },
    # ... acrescente os outros presets de references/temas.md conforme necessário ...
}


def build_design_tokens(tema):
    """Monta o objeto designTokens para Theme.styles.
    Ideal: partir de DEFAULT_DESIGN_TOKENS (designTokens.ts) e sobrescrever. CONFIRMAR forma."""
    return {
        "colors": tema["colors"],
        "typography": {
            "fontFamily": {"heading": tema["typography"]["heading"],
                           "body": tema["typography"]["body"]},
        },
        "borderRadius": {"card": tema["card"]["radius"]},
        "shadows": {"card": tema["card"]["shadow"]},
    }


# === Carregar produtos =====================================================================
def carregar_produtos(caminho):
    """Lê CSV ou JSON. Normalize as chaves para: nome, preco, descricao, imagem, categoria."""
    if caminho.lower().endswith(".json"):
        with open(caminho, encoding="utf-8") as f:
            dados = json.load(f)
    else:
        with open(caminho, newline="", encoding="utf-8") as f:
            dados = list(csv.DictReader(f))
    produtos = []
    for row in dados:
        produtos.append({
            "nome": (row.get("nome") or row.get("name") or "").strip(),
            "preco": row.get("preco") or row.get("price") or "",
            "descricao": (row.get("descricao") or row.get("description") or "").strip(),
            "imagem": row.get("imagem") or row.get("image") or row.get("imageUrl") or "",
            "categoria": (row.get("categoria") or row.get("category") or "").strip(),
        })
    return [p for p in produtos if p["nome"]]


# === Construção dos elementos (content) — ASSANDO O TEMA ===================================
# ⚠️ A FORMA de `content` abaixo é PROVÁVEL e precisa casar com o que catalogLoader lê.
#    CONFIRME contra editor.ts / catalogLoader.service.ts / um content real.
def el_texto(eid, texto, x, y, w, h, tema, *, tamanho, cor, peso=400, fonte=None, align="left"):
    fonte = fonte or tema["typography"]["heading"]
    return {
        "id": eid, "type": "text",
        "position": {"x": x, "y": y}, "size": {"width": w, "height": h},
        "style": {},  # CONFIRMAR se estilo de texto vai em style ou textData
        "textData": {"text": texto, "fontFamily": fonte, "fontSize": tamanho,
                     "color": cor, "fontWeight": peso, "align": align},
    }

def el_card_produto(eid, produto, x, y, w, h, tema):
    """Card de produto com tema assado (cor de fundo, raio, sombra, fonte, preço em accent)."""
    return {
        "id": eid, "type": "product",
        "position": {"x": x, "y": y}, "size": {"width": w, "height": h},
        "style": {
            "backgroundColor": tema["colors"]["surface"],
            "borderRadius": tema["card"]["radius"],
            "boxShadow": tema["card"]["shadow"],
            "border": tema["card"]["border"],
        },
        "productData": {  # CONFIRMAR nomes que o loader/editor esperam
            "name": produto["nome"],
            "price": produto["preco"],
            "description": produto["descricao"],
            "imageUrl": produto["imagem"],
            "category": produto["categoria"],
            # estilos do conteúdo do card:
            "nameStyle":  {"fontFamily": tema["typography"]["heading"],
                           "color": tema["colors"]["text"], "fontWeight": 600},
            "priceStyle": {"fontFamily": tema["typography"]["body"],
                           "color": tema["colors"]["accent"], "fontWeight": 700},
            "descStyle":  {"fontFamily": tema["typography"]["body"],
                           "color": tema["colors"]["textMuted"], "fontSize": 13},
        },
    }


def grade_posicoes(n_cards, tema):
    """Calcula geometria em grade para n_cards numa página. Retorna lista de (x, y, w, h)."""
    cols = tema["cols"]
    gap = 24
    usable_w = PAGE_W - 2 * MARGIN
    card_w = (usable_w - (cols - 1) * gap) / cols
    card_h = card_w * 1.25
    top = MARGIN + 120  # espaço pro cabeçalho da página
    pos = []
    for i in range(n_cards):
        c = i % cols
        r = i // cols
        x = MARGIN + c * (card_w + gap)
        y = top + r * (card_h + gap)
        pos.append((x, y, card_w, card_h))
    return pos


def cards_por_pagina(tema):
    cols = tema["cols"]
    usable_h = PAGE_H - (MARGIN + 120) - MARGIN
    card_w = (PAGE_W - 2 * MARGIN - (cols - 1) * 24) / cols
    card_h = card_w * 1.25
    rows = max(1, int((usable_h + 24) // (card_h + 24)))
    return cols * rows


# === Seleção de seções (ver references/estrutura-catalogo.md, seção A) =====================
# Ordem canônica de renderização (capa → … → contracapa):
SECOES_ORDEM = [
    "capa", "apresentacao", "sobre_empresa", "sumario", "divisores",
    "produtos", "secoes_especiais", "tabela_precos", "como_comprar", "termos", "contracapa",
]
SECOES_COMPLETA = list(SECOES_ORDEM)
SECOES_ESSENCIAL_B2C = ["capa", "produtos", "contracapa"]
SECOES_ESSENCIAL_B2B = ["capa", "sumario", "produtos", "tabela_precos", "como_comprar", "contracapa"]


def resolver_secoes(estrutura, secoes_csv, *, b2b, n_produtos, por_pagina):
    """Decide a lista final de seções e a ordena pela ordem canônica."""
    if secoes_csv:                                   # personalizada
        escolhidas = {s.strip() for s in secoes_csv.split(",") if s.strip()}
        escolhidas |= {"capa", "contracapa"}         # mínimo forçado
        if "produtos" not in escolhidas:
            print("⚠️  Sem a seção 'produtos' — catálogo sem núcleo.")
    elif estrutura == "completa":
        escolhidas = set(SECOES_COMPLETA)
    else:                                            # essencial (default)
        escolhidas = set(SECOES_ESSENCIAL_B2B if b2b else SECOES_ESSENCIAL_B2C)
    # sumário só faz sentido em catálogo com várias páginas
    n_pag_prod = max(1, -(-n_produtos // por_pagina))  # ceil
    if "sumario" in escolhidas and n_pag_prod + 2 <= 8:
        escolhidas.discard("sumario")
    return [s for s in SECOES_ORDEM if s in escolhidas]


# === Construtores de seção =================================================================
# Cada construtor recebe (catalogo, tema, ctx, order) e devolve o próximo `order`.
# ctx = dicionário com 'titulo', 'produtos', 'empresa' (institucional, se houver), etc.
# IMPLEMENTADOS: capa, produtos, contracapa. Os demais são STUBS — desenvolva conforme
# os campos de references/estrutura-catalogo.md (seção B) e os dados que o usuário forneceu.

def secao_capa(catalogo, tema, ctx, order):
    page = Page.objects.create(catalog=catalogo, order=order)
    # fundo da capa com a cor primária do tema (CONFIRMAR como o loader trata bg de página)
    add_componente(page, {"id": "capa-bg", "type": "image",
                          "position": {"x": 0, "y": 0}, "size": {"width": PAGE_W, "height": PAGE_H},
                          "style": {"backgroundColor": tema["colors"]["primary"]}, "imageData": {}},
                   x=0, y=0, w=PAGE_W, h=PAGE_H, layer=0)
    add_componente(page, el_texto("capa-titulo", ctx["titulo"], MARGIN, PAGE_H * 0.40,
                                  PAGE_W - 2 * MARGIN, 80, tema, tamanho=48,
                                  cor=tema["colors"]["surface"], peso=700, align="center"),
                   x=MARGIN, y=PAGE_H * 0.40, w=PAGE_W - 2 * MARGIN, h=80, layer=1)
    if ctx.get("periodo"):
        add_componente(page, el_texto("capa-periodo", ctx["periodo"], MARGIN, PAGE_H * 0.40 + 90,
                                      PAGE_W - 2 * MARGIN, 40, tema, tamanho=20,
                                      cor=tema["colors"]["surface"], peso=400, align="center",
                                      fonte=tema["typography"]["body"]),
                       x=MARGIN, y=PAGE_H * 0.40 + 90, w=PAGE_W - 2 * MARGIN, h=40, layer=1)
    # TODO: logo da empresa, motivo decorativo do ramo, QR opcional
    return order + 1


def secao_produtos(catalogo, tema, ctx, order):
    produtos = ctx["produtos"]
    por_pag = cards_por_pagina(tema)
    grupos = [produtos[i:i + por_pag] for i in range(0, len(produtos), por_pag)]
    for grupo in grupos:
        page = Page.objects.create(catalog=catalogo, order=order)
        posicoes = grade_posicoes(len(grupo), tema)
        for k, (produto, (x, y, w, h)) in enumerate(zip(grupo, posicoes)):
            content = el_card_produto(f"o{order}-card{k}", produto, x, y, w, h, tema)
            add_componente(page, content, x=x, y=y, w=w, h=h, layer=1)
        order += 1
    return order


def secao_contracapa(catalogo, tema, ctx, order):
    page = Page.objects.create(catalog=catalogo, order=order)
    cta = (ctx.get("empresa", {}) or {}).get("cta", "Faça seu pedido")
    add_componente(page, el_texto("contracapa-cta", cta, MARGIN, PAGE_H * 0.45,
                                  PAGE_W - 2 * MARGIN, 60, tema, tamanho=32,
                                  cor=tema["colors"]["text"], peso=700, align="center"),
                   x=MARGIN, y=PAGE_H * 0.45, w=PAGE_W - 2 * MARGIN, h=60, layer=1)
    # TODO: logo, site/redes, contato, QR Code (imagem real)
    return order + 1


def _stub(nome):
    def _fn(catalogo, tema, ctx, order):
        # STUB: monte esta seção com os campos de estrutura-catalogo.md (seção B).
        # Pule silenciosamente se não houver dado para ela.
        print(f"   (seção '{nome}' não implementada neste esqueleto — pulada)")
        return order
    return _fn


CONSTRUTORES = {
    "capa": secao_capa,
    "apresentacao": _stub("apresentacao"),
    "sobre_empresa": _stub("sobre_empresa"),
    "sumario": _stub("sumario"),
    "divisores": _stub("divisores"),
    "produtos": secao_produtos,
    "secoes_especiais": _stub("secoes_especiais"),
    "tabela_precos": _stub("tabela_precos"),
    "como_comprar": _stub("como_comprar"),
    "termos": _stub("termos"),
    "contracapa": secao_contracapa,
}


# === Persistência ==========================================================================
@transaction.atomic
def gerar(ctx, tema_nome, secoes, *, org, sede, user, limpar=False):
    tema = TEMAS[tema_nome]
    titulo = ctx["titulo"]

    if limpar:
        Catalog.objects.filter(title=titulo, organization=org).delete()  # CONFIRMAR cascata

    theme = Theme.objects.create(  # CONFIRMAR campos obrigatórios
        styles={"designTokens": build_design_tokens(tema)},
        organization=org, created_by=user,
    )
    catalogo = Catalog.objects.create(  # CONFIRMAR campos
        title=titulo, description=f"Catálogo gerado — tema {tema_nome}",
        theme=theme, organization=org, sede=sede, is_public=False, created_by=user,
    )

    order = 0
    for secao in secoes:                      # já vem na ordem canônica
        order = CONSTRUTORES[secao](catalogo, tema, ctx, order)

    return catalogo, order  # order = total de páginas criadas


def add_componente(page, content, *, x, y, w, h, layer):
    """Cria Component (content) + PageComponent (geometria) coerentes. CONFIRMAR FKs/campos."""
    ctype = content.get("type")
    add_componente_type = ctype if ctype in ("text", "image", "product") else "text"
    comp = Component.objects.create(
        component_type=add_componente_type,
        content=content, is_reusable=False,
    )
    PageComponent.objects.create(  # CONFIRMAR nomes das FK (page/component) e campos de geometria
        page=page, component=comp,
        position_x=x, position_y=y, width=w, height=h, layer=layer,
    )
    return comp


# === Resolução de org/sede/usuário (ver references/dados-catana.md) ========================
def resolver_contexto():
    user = User.objects.filter(is_superuser=True).first()
    org = Organization.objects.first()           # CONFIRMAR / filtrar pela do usuário
    sede = Sede.objects.filter(organization=org).first() if org else None
    if not (user and org):
        sys.exit("Faltam Organization/superuser no banco. Crie-os antes de rodar o seed.")
    return org, sede, user


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--arquivo", required=True, help="CSV ou JSON de produtos")
    ap.add_argument("--tema", required=True, choices=list(TEMAS.keys()))
    ap.add_argument("--titulo", required=True)
    ap.add_argument("--periodo", default="", help="ex.: '2026', 'Verão 2026', 'Edição 01'")
    ap.add_argument("--estrutura", choices=["completa", "essencial"], default="essencial",
                    help="estrutura macro (ignorado se --secoes for usado)")
    ap.add_argument("--secoes", default="",
                    help="estrutura PERSONALIZADA: lista por vírgula, ex.: 'capa,produtos,contracapa'")
    ap.add_argument("--b2b", action="store_true",
                    help="negócio B2B/atacado (muda o conjunto 'essencial')")
    ap.add_argument("--limpar", action="store_true", help="apaga catálogo homônimo antes")
    args = ap.parse_args()

    produtos = carregar_produtos(args.arquivo)
    if not produtos:
        sys.exit("Nenhum produto válido encontrado no arquivo.")

    tema = TEMAS[args.tema]
    secoes = resolver_secoes(args.estrutura, args.secoes, b2b=args.b2b,
                             n_produtos=len(produtos), por_pagina=cards_por_pagina(tema))

    ctx = {
        "titulo": args.titulo,
        "periodo": args.periodo,
        "produtos": produtos,
        "empresa": {},   # preencha com institucional se for montar sobre_empresa/contracapa ricos
    }

    org, sede, user = resolver_contexto()
    catalogo, n_pag = gerar(ctx, args.tema, secoes,
                            org=org, sede=sede, user=user, limpar=args.limpar)

    print("✅ Catálogo gerado")
    print(f"   id={catalogo.id}  título={catalogo.title!r}")
    print(f"   {len(produtos)} produtos em {n_pag} páginas  ·  tema={args.tema}")
    print(f"   seções: {', '.join(secoes)}")
    print(f"   Abra no front para conferir o visual (URL conforme suas rotas).")


if __name__ == "__main__":
    main()
