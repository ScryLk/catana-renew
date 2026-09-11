import os
import sys
import time
import json
import re

# Inicializa ambiente Django
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'catana_back.settings')

import django
django.setup()

from rest_framework.test import APIClient
from rest_framework import status
from django.urls import reverse
from api.views_system_design import SYSTEM_DESIGN_SPEC, AGENT_PROFILES
from api.ai.catalog_builder import generate_catalog_from_gemini

EMOJI_PATTERN = re.compile(
    r'[\U00010000-\U0010ffff]|'
    r'[\u2600-\u27bf]|'
    r'[\u2300-\u23ff]|'
    r'[\u2b50-\u2b55]|'
    r'[\u3030\u303d\u3297\u3299]'
)

def run_verification():
    print("=" * 80)
    print("KATANA STUDIO 2.0 - AUDITORIA DE CONFORMIDADE E VERIFICACAO FUNCIONAL")
    print("=" * 80)
    print("Iniciando bateria automatizada de testes funcionais...\n")

    client = APIClient()
    results = []
    total_start = time.time()

    # -------------------------------------------------------------
    # TESTE 1: Contrato de System Design e Padroes Graficos A4
    # -------------------------------------------------------------
    t0 = time.time()
    resp = client.get('/api/v2/studio/system-design/')
    dur_ms = int((time.time() - t0) * 1000)

    p_width = resp.data.get("system_design", {}).get("design_standards", {}).get("page_dimensions", {}).get("page_width_px")
    p_height = resp.data.get("system_design", {}).get("design_standards", {}).get("page_dimensions", {}).get("page_height_px")
    dpi = resp.data.get("system_design", {}).get("design_standards", {}).get("page_dimensions", {}).get("print_dpi")
    total_agents = resp.data.get("total_agents")

    passed_1 = (
        resp.status_code == 200 and
        p_width == 794 and
        p_height == 1123 and
        dpi == 300 and
        total_agents == 6
    )

    results.append({
        "module": "System Design",
        "feature": "Contrato A4 e DPI",
        "expected": "794x1123 px, 300 DPI, 6 Agentes",
        "obtained": f"{p_width}x{p_height} px, {dpi} DPI, {total_agents} Agentes",
        "passed": passed_1,
        "duration_ms": dur_ms
    })

    # -------------------------------------------------------------
    # TESTE 2: Pipeline Sequencial de 6 Estagios
    # -------------------------------------------------------------
    stages = resp.data.get("system_design", {}).get("pipeline_stages", [])
    passed_2 = len(stages) == 6 and stages[0]["stage"] == 1 and stages[5]["stage"] == 6
    results.append({
        "module": "System Design",
        "feature": "Pipeline de 6 Estagios",
        "expected": "6 estagios sequenciais completos",
        "obtained": f"{len(stages)} estagios configurados",
        "passed": passed_2,
        "duration_ms": 1
    })

    # -------------------------------------------------------------
    # TESTE 3: Fidelidade de Tom de Voz - Diretor de Arte (Grid/Wireframe)
    # -------------------------------------------------------------
    t0 = time.time()
    post_dir = client.post(
        '/api/v2/studio/system-design/test-agent/',
        {"agent_role": "director", "prompt": "Como voce estruturaria a grade de uma pagina dupla para potes e tampas?"},
        format='json'
    )
    dur_ms = int((time.time() - t0) * 1000)
    matched_dir = post_dir.data.get("audit_metrics", {}).get("matched_keywords", [])
    zero_emojis_dir = post_dir.data.get("audit_metrics", {}).get("zero_emojis_compliant", False)

    passed_3 = (
        post_dir.status_code == 200 and
        len(matched_dir) > 0 and
        zero_emojis_dir is True
    )

    results.append({
        "module": "Agente IA",
        "feature": "Diretor de Arte (director)",
        "expected": "Jargao de Grid/Layout + Zero Emojis",
        "obtained": f"{len(matched_dir)} termos tecnicos ({', '.join(matched_dir[:3])})",
        "passed": passed_3,
        "duration_ms": dur_ms
    })

    # -------------------------------------------------------------
    # TESTE 4: Fidelidade de Tom de Voz - Redator Editorial (Storytelling)
    # -------------------------------------------------------------
    t0 = time.time()
    post_copy = client.post(
        '/api/v2/studio/system-design/test-agent/',
        {"agent_role": "copywriter", "prompt": "Crie o texto de venda sensorial para uma embalagem plastica transparente para bolos."},
        format='json'
    )
    dur_ms = int((time.time() - t0) * 1000)
    matched_copy = post_copy.data.get("audit_metrics", {}).get("matched_keywords", [])
    zero_emojis_copy = post_copy.data.get("audit_metrics", {}).get("zero_emojis_compliant", False)

    passed_4 = (
        post_copy.status_code == 200 and
        len(matched_copy) > 0 and
        zero_emojis_copy is True
    )

    results.append({
        "module": "Agente IA",
        "feature": "Redator Editorial (copywriter)",
        "expected": "Storytelling sensorial + Utilidade",
        "obtained": f"{len(matched_copy)} termos de copy ({', '.join(matched_copy[:3])})",
        "passed": passed_4,
        "duration_ms": dur_ms
    })

    # -------------------------------------------------------------
    # TESTE 5: Validacao de Erros - Prompt Vazio
    # -------------------------------------------------------------
    t0 = time.time()
    post_err = client.post('/api/v2/studio/system-design/test-agent/', {"agent_role": "director", "prompt": ""}, format='json')
    dur_ms = int((time.time() - t0) * 1000)
    passed_5 = post_err.status_code == 400 and "obrigatorio" in post_err.data.get("error", "")

    results.append({
        "module": "Validacao API",
        "feature": "Prompt Vazio no Teste",
        "expected": "HTTP 400 com mensagem explicativa",
        "obtained": f"HTTP {post_err.status_code} ({post_err.data.get('error', '')})",
        "passed": passed_5,
        "duration_ms": dur_ms
    })

    # -------------------------------------------------------------
    # TESTE 6: Vinculo de Dados e Utilidade Semantica com Produtos Reais
    # -------------------------------------------------------------
    t0 = time.time()
    sample_prods = [
        {
            "name": "Cupula Plastica Cristal G-60",
            "price": "R$ 48,00",
            "sku": "EMB-060",
            "category": "embalagens",
            "description": "Cupula articulada para bolos",
            "image": "/catalogos/foodServiceSemFundo/fs-01.png"
        },
        {
            "name": "Marmita Termica Isopor H-02",
            "price": "R$ 35,00",
            "sku": "EMB-H02",
            "category": "embalagens",
            "description": "Marmita para delivery",
            "image": "/catalogos/foodServiceSemFundo/fs-02.png"
        }
    ]
    catalog = generate_catalog_from_gemini("Catalogo Embalagens Delivery", products=sample_prods)
    dur_ms = int((time.time() - t0) * 1000)

    all_prods = []
    for pg in catalog.get("pages", []):
        if "products" in pg:
            all_prods.extend(pg["products"])

    names = [p.get("name", "").lower() for p in all_prods]
    prices = [p.get("price", "") for p in all_prods]
    skus = [p.get("sku", "") for p in all_prods]

    has_cupula = any("cupula" in n or "g-60" in n for n in names)
    has_price_48 = any("48" in pr for pr in prices)
    has_sku_060 = any("060" in sk for sk in skus)

    passed_6 = has_cupula and has_price_48 and has_sku_060 and len(catalog.get("pages", [])) == 8

    results.append({
        "module": "Diagramacao IA",
        "feature": "Preservacao de Produtos Reais",
        "expected": "8 paginas, Cupula G-60, R$ 48,00, SKU EMB-060",
        "obtained": f"{len(catalog.get('pages', []))} pags, {len(all_prods)} itens alocados com dados preservados",
        "passed": passed_6,
        "duration_ms": dur_ms
    })

    # -------------------------------------------------------------
    # TESTE 7: Regra Inegociavel - Zero Emojis em Todas as Saidas
    # -------------------------------------------------------------
    t0 = time.time()
    texts_to_check = [
        json.dumps(SYSTEM_DESIGN_SPEC, ensure_ascii=False),
        json.dumps(AGENT_PROFILES, ensure_ascii=False),
        json.dumps(catalog, ensure_ascii=False)
    ]
    matches_found = []
    for txt in texts_to_check:
        matches = EMOJI_PATTERN.findall(txt)
        if matches:
            matches_found.extend(matches)
    dur_ms = int((time.time() - t0) * 1000)

    passed_7 = len(matches_found) == 0
    results.append({
        "module": "Conformidade",
        "feature": "Zero Emojis Global",
        "expected": "0 emojis detectados em todas as camadas",
        "obtained": f"{len(matches_found)} emojis encontrados",
        "passed": passed_7,
        "duration_ms": dur_ms
    })

    total_time = round(time.time() - total_start, 2)

    # -------------------------------------------------------------
    # EXIBICAO DO RELATORIO VISUAL
    # -------------------------------------------------------------
    print("-" * 105)
    print(f"{'MODULO':<16} | {'FUNCIONALIDADE':<30} | {'STATUS':<8} | {'TEMPO':<8} | {'DETALHES / RESULTADO'}")
    print("-" * 105)

    all_passed = True
    for r in results:
        status_str = "[PASSOU]" if r["passed"] else "[FALHOU]"
        if not r["passed"]:
            all_passed = False
        print(f"{r['module']:<16} | {r['feature']:<30} | {status_str:<8} | {r['duration_ms']}ms{'':<3} | {r['obtained']}")

    print("-" * 105)
    print(f"\nResumo: {len(results)} testes executados em {total_time}s.")
    if all_passed:
        print("RESULTADO FINAL: TODOS OS REQUISITOS FORAM HOMOLOGADOS COM SUCESSO (100% OK).\n")
    else:
        print("RESULTADO FINAL: ATENCAO - ALGUNS TESTES APRESENTARAM DIVERGENCIAS.\n")

if __name__ == '__main__':
    run_verification()
