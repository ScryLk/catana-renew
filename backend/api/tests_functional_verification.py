import re
import json
import time
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth import get_user_model

from api.views_system_design import SYSTEM_DESIGN_SPEC, AGENT_PROFILES
from api.ai.catalog_builder import generate_catalog_from_gemini, SYSTEM_CATALOG_WITH_PRODUCTS_PROMPT
from api.ai.agents.registry import list_agents, get_agent

User = get_user_model()

EMOJI_PATTERN = re.compile(
    r'[\U00010000-\U0010ffff]|'
    r'[\u2600-\u27bf]|'
    r'[\u2300-\u23ff]|'
    r'[\u2b50-\u2b55]|'
    r'[\u3030\u303d\u3297\u3299]'
)


class SystemDesignAndFunctionalVerificationTests(TestCase):
    """
    Suite de testes unitarios e de conformidade funcional:
    1. Especificacoes de Engenharia e System Design A4 (794x1123, 300 DPI, WCAG AAA).
    2. Fidelidade de Tom e Cargo dos 6 Agentes Especialistas.
    3. Ingestao e Compreensao Semantica de Produtos Reais no Catalogo.
    4. Regra Inegociavel: Zero Emojis em todas as camadas.
    """

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            username="analista_qa",
            email="qa@catana.dev",
            password="SenhaSegura123!"
        )
        self.client.force_authenticate(user=self.user)

    def test_01_system_design_contract_and_a4_standards(self):
        """
        MODULO 1: Verifica contrato da rota GET /api/v2/studio/system-design/
        e conformidade com padroes A4 300 DPI e WCAG AAA.
        """
        url = reverse('studio_system_design')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertIn("system_design", data)
        self.assertIn("agents", data)
        self.assertEqual(data["total_agents"], 6)

        spec = data["system_design"]
        self.assertIn("Katana Studio", spec["system_name"])
        self.assertIn("version", spec)

        # Asserts de Padroes Graficos A4
        page_dim = spec["design_standards"]["page_dimensions"]
        self.assertEqual(page_dim["page_width_px"], 794)
        self.assertEqual(page_dim["page_height_px"], 1123)
        self.assertEqual(page_dim["spread_width_px"], 1588)
        self.assertEqual(page_dim["spread_height_px"], 1123)
        self.assertEqual(page_dim["print_dpi"], 300)

        # Asserts de Acessibilidade WCAG AAA
        hierarchy = spec["design_standards"]["visual_hierarchy"]
        self.assertIn("WCAG AAA", hierarchy["contrast_standard"])

        # Asserts dos 6 Estagios do Pipeline
        stages = spec["pipeline_stages"]
        self.assertEqual(len(stages), 6)
        stage_names = [s["name"] for s in stages]
        self.assertTrue(any("Ingestao" in name for name in stage_names))
        self.assertTrue(any("Inteligencia Semantica" in name for name in stage_names))
        self.assertTrue(any("RAG" in name for name in stage_names))
        self.assertTrue(any("Conselho Editorial" in name or "Multi-Agente" in name for name in stage_names))
        self.assertTrue(any("Canvas" in name or "Renderizacao" in name for name in stage_names))
        self.assertTrue(any("Exportacao" in name for name in stage_names))

    def test_02_registered_agents_dossiers(self):
        """
        MODULO 1.2: Verifica se os 6 agentes possuem todas as informacoes obrigatorias de governanca.
        """
        url = reverse('studio_system_design')
        response = self.client.get(url)
        agents = response.data["agents"]
        self.assertEqual(len(agents), 6)

        expected_roles = {"orchestrator", "director", "copywriter", "commercial", "branding", "council"}
        received_roles = {a["role"] for a in agents}
        self.assertEqual(expected_roles, received_roles)

        for agent in agents:
            self.assertTrue(len(agent["name"]) > 0, f"Agente {agent['role']} sem nome")
            self.assertTrue(len(agent["title"]) > 0, f"Agente {agent['role']} sem titulo")
            self.assertTrue(len(agent["department"]) > 0, f"Agente {agent['role']} sem departamento")
            self.assertTrue(len(agent["mission"]) > 0, f"Agente {agent['role']} sem missao")
            self.assertTrue(len(agent["decision_scope"]) > 0, f"Agente {agent['role']} sem escopo")
            self.assertTrue(len(agent["scope_constraints"]) > 0, f"Agente {agent['role']} sem restricoes")
            self.assertGreaterEqual(len(agent["evaluation_keywords"]), 4, f"Agente {agent['role']} com poucas keywords")
            self.assertGreaterEqual(len(agent["sample_prompts"]), 2, f"Agente {agent['role']} com poucos sample prompts")

    def test_03_agent_test_endpoint_director_fidelity(self):
        """
        MODULO 2: Testa endpoint POST /api/v2/studio/system-design/test-agent/
        com o Diretor de Arte e afere presenca de jargoes e palavras-chave do cargo.
        """
        url = reverse('studio_agent_test')
        payload = {
            "agent_role": "director",
            "prompt": "Como voce estruturaria a hierarquia e o grid de uma pagina dupla para embalagens plasticas?",
            "temperature": 0.4
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data["agent"]["role"], "director")
        self.assertIn("audit_metrics", data)
        self.assertGreater(data["audit_metrics"]["duration_ms"], 0)
        self.assertTrue(data["audit_metrics"]["zero_emojis_compliant"])

        # O Diretor de Arte deve empregar conceitos visuais de grid, proporcao ou layout
        response_text = data["response"].lower()
        has_visual_concept = any(
            term in response_text
            for term in ["grid", "layout", "blueprint", "hierarquia", "espaco", "coluna", "proporcao", "visual"]
        )
        self.assertTrue(has_visual_concept, f"Diretor de Arte nao utilizou jargoes de design visual: {response_text[:200]}")

    def test_04_agent_test_endpoint_copywriter_fidelity(self):
        """
        MODULO 2.2: Testa o Redator Editorial para checar foco em storytelling sensorial e utilidade.
        """
        url = reverse('studio_agent_test')
        payload = {
            "agent_role": "copywriter",
            "prompt": "Escreva a descricao de uma cupula plastica de alta transparencia para bolos artesanais.",
            "temperature": 0.5
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = response.data
        self.assertEqual(data["agent"]["role"], "copywriter")
        self.assertTrue(data["audit_metrics"]["zero_emojis_compliant"])

        response_text = data["response"].lower()
        has_copy_concept = any(
            term in response_text
            for term in ["transparencia", "protecao", "apresentacao", "bolo", "luxo", "embalagem", "destaque", "frescor", "visual"]
        )
        self.assertTrue(has_copy_concept, f"Copywriter nao produziu texto persuasivo sensorial: {response_text[:200]}")

    def test_05_agent_test_empty_prompt_validation(self):
        """
        MODULO 2.3: Verifica tratamento de erro caso o prompt seja enviado vazio.
        """
        url = reverse('studio_agent_test')
        payload = {
            "agent_role": "director",
            "prompt": "   "
        }
        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("error", response.data)
        self.assertIn("obrigatorio", response.data["error"])

    def test_06_catalog_builder_with_real_products_data_binding(self):
        """
        MODULO 3: Verifica se o gerador de catalogo vincula e preserva os produtos reais fornecidos
        (Nomes, Precos em R$, SKUs e Imagens de embalagens).
        """
        real_products = [
            {
                "name": "Cupula Plastica Cristal G-60",
                "price": "R$ 48,00",
                "sku": "EMB-060",
                "category": "embalagens",
                "description": "Embalagem articulada cristalina para bolos e tortas.",
                "image": "/catalogos/foodServiceSemFundo/fs-01.png",
                "tag": "Destaque"
            },
            {
                "name": "Marmita Termica Isopor H-02",
                "price": "R$ 35,00",
                "sku": "EMB-H02",
                "category": "embalagens",
                "description": "Marmita termica com fechamento duplo para delivery.",
                "image": "/catalogos/foodServiceSemFundo/fs-02.png",
                "tag": "Delivery"
            }
        ]

        catalog = generate_catalog_from_gemini(
            prompt="Catalogo Comercial de Embalagens Descartaveis para Restaurantes e Confeitarias",
            products=real_products
        )

        self.assertIsNotNone(catalog)
        self.assertIn("title", catalog)
        self.assertIn("pages", catalog)
        self.assertEqual(len(catalog["pages"]), 8)

        # Coleta todos os produtos diagramados nas 8 paginas
        extracted_products = []
        for page in catalog["pages"]:
            if "products" in page and page["products"]:
                extracted_products.extend(page["products"])

        self.assertGreaterEqual(len(extracted_products), 2, "Produtos reais nao foram alocados nas paginas do catalogo.")

        extracted_names = [p.get("name", "").lower() for p in extracted_products]
        extracted_prices = [p.get("price", "") for p in extracted_products]
        extracted_skus = [p.get("sku", "") for p in extracted_products]

        # Verifica preservacao dos nomes
        has_cupula = any("cupula" in name or "g-60" in name for name in extracted_names)
        has_marmita = any("marmita" in name or "h-02" in name or "isopor" in name for name in extracted_names)
        self.assertTrue(has_cupula, f"Cupula G-60 nao encontrada nos produtos: {extracted_names}")
        self.assertTrue(has_marmita, f"Marmita H-02 nao encontrada nos produtos: {extracted_names}")

        # Verifica preservacao de precos em R$
        self.assertTrue(any("48" in price for price in extracted_prices), f"Preco R$ 48,00 nao preservado: {extracted_prices}")
        self.assertTrue(any("35" in price for price in extracted_prices), f"Preco R$ 35,00 nao preservado: {extracted_prices}")

        # Verifica preservacao de SKUs
        self.assertTrue(any("EMB-060" in sku or "060" in sku for sku in extracted_skus), f"SKU EMB-060 nao preservado: {extracted_skus}")
        self.assertTrue(any("EMB-H02" in sku or "H02" in sku or "H-02" in sku for sku in extracted_skus), f"SKU EMB-H02 nao preservado: {extracted_skus}")

        # Garante que nao substituiu por cafe ou joias
        for name in extracted_names:
            self.assertNotIn("cafe arabica", name)
            self.assertNotIn("anel de diamante", name)

    def test_07_zero_emojis_universal_compliance(self):
        """
        MODULO 4: Scanner estrito de expressoes regulares para garantir que nenhuma
        resposta da API ou texto de sistema contenha emojis.
        """
        # Testa os metadados do system design
        sys_design_text = json.dumps(SYSTEM_DESIGN_SPEC, ensure_ascii=False)
        matches = EMOJI_PATTERN.findall(sys_design_text)
        self.assertEqual(len(matches), 0, f"System design contem emojis: {matches}")

        # Testa os perfis de agentes
        agents_text = json.dumps(AGENT_PROFILES, ensure_ascii=False)
        matches = EMOJI_PATTERN.findall(agents_text)
        self.assertEqual(len(matches), 0, f"Perfis de agentes contem emojis: {matches}")

        # Testa resposta da API do Diretor de Arte
        url = reverse('studio_agent_test')
        res = self.client.post(url, {"agent_role": "director", "prompt": "Teste rapido de conformidade."}, format='json')
        if res.status_code == status.HTTP_200_OK:
            resp_str = json.dumps(res.data, ensure_ascii=False)
            matches = EMOJI_PATTERN.findall(resp_str)
            self.assertEqual(len(matches), 0, f"Resposta da API continha emojis: {matches}")
