"""
Suite de Testes Automatizados para a Expansao Criativa Universal do Catana Studio.
Verifica o protocolo de overlays, confetes de festa, aneis de foco em produtos,
setas geometricas com callout, selos promocionais e normalizacao no Orquestrador.
Regra Inegociavel: ZERO EMOJIS em qualquer texto, log ou assercao.
"""
from django.test import TestCase
from api.ai.agents.registry import get_agent
from api.ai.agents.orchestrator import OrchestratorAgent
from api.ai.agents.director import ArtDirectorAgent
from api.ai.agents.commercial import CommercialAgent
from api.ai.guardrails import KatanaGuardrailEngine
from api.views_studio import extract_patch_from_text


class CreativeOverlaysProtocolTestCase(TestCase):
    """
    Testes de integracao e conformidade dos agentes para acoes criativas de design editorial.
    """

    def test_01_orchestrator_prompt_contains_overlay_actions(self):
        """
        Garante que o Orquestrador contem todas as novas acoes criativas em seu schema formal.
        """
        orchestrator = get_agent("orchestrator")
        prompt = orchestrator.get_system_prompt()

        required_actions = [
            "add_overlay",
            "highlight_product",
            "remove_overlay",
            "clear_overlays",
            "update_overlay",
        ]
        for action in required_actions:
            self.assertIn(action, prompt, f"Acao '{action}' deve estar registrada no prompt do Orquestrador")

        # Verifica presenca dos exemplos normativos fundamentais
        self.assertIn("confetes de festa", prompt)
        self.assertIn("Destacar produto com circulo", prompt)
        self.assertIn("seta geometrica com callout", prompt)
        self.assertIn("selo promocional / desconto", prompt)

    def test_02_art_director_prompt_contains_composition_guidelines(self):
        """
        Verifica se o Diretor de Arte possui diretrizes para confetes, aneis de foco e setas.
        """
        director = get_agent("director")
        prompt = director.get_system_prompt()

        self.assertIn("add_overlay", prompt)
        self.assertIn("highlight_product", prompt)
        self.assertIn("confetti", prompt)
        self.assertIn("focus_ring", prompt)
        self.assertIn("arrow", prompt)

    def test_03_commercial_prompt_contains_badge_guidelines(self):
        """
        Verifica se a Tabela Comercial possui diretrizes para selos promocionais e tags de desconto.
        """
        commercial = get_agent("commercial")
        prompt = commercial.get_system_prompt()

        self.assertIn("badge", prompt)
        self.assertIn("discount_badge", prompt)
        self.assertIn("add_overlay", prompt)

    def test_04_target_role_routing_for_creative_demands(self):
        """
        Testa o roteamento inteligente do Orquestrador para demandas visuais e comerciais criativas.
        """
        orchestrator = get_agent("orchestrator")
        self.assertIsInstance(orchestrator, OrchestratorAgent)

        # Demandas de direcao de arte / design
        self.assertEqual(orchestrator.detect_target_role("adicione confetes de festa na capa"), "director")
        self.assertEqual(orchestrator.detect_target_role("circule o produto 1 com um traço dourado"), "director")
        self.assertEqual(orchestrator.detect_target_role("coloque uma seta apontando para a bolsa"), "director")
        self.assertEqual(orchestrator.detect_target_role("adicione uma estrela geometrica no canto"), "director")

        # Demandas comerciais / promocionais
        self.assertEqual(orchestrator.detect_target_role("adicione um selo de 20% de desconto"), "commercial")
        self.assertEqual(orchestrator.detect_target_role("coloque um badge promocional de Black Friday"), "commercial")

    def test_05_gateway_reformatting_colloquial_creative_commands(self):
        """
        Verifica se o gateway do Editor-Chefe normaliza dialetos informais para diretrizes editoriais.
        """
        orchestrator = get_agent("orchestrator")
        self.assertIsInstance(orchestrator, OrchestratorAgent)

        # 1. Metodo direto de reformatacao editorial
        dir_confetti = orchestrator._reformat_to_editorial_directive("taca confete na capa", "director")
        self.assertIn("organizar na prancheta", dir_confetti.lower())
        self.assertIn("capa", dir_confetti.lower())

        dir_circle = orchestrator._reformat_to_editorial_directive("circula o produto 2 da folha 3", "director")
        self.assertIn("anel de foco", dir_circle.lower())
        self.assertIn("pagina 3", dir_circle.lower())

        dir_arrow = orchestrator._reformat_to_editorial_directive("insira uma seta para a bolsa Verona", "director")
        self.assertIn("seta indicadora", dir_arrow.lower())

        # 2. Reformatacao com higienizacao de ruido no Gateway
        res_noisy = orchestrator.format_and_guard_request(
            "Arruma essa merda, circula o produto 1 da folha 2",
            target_role="director"
        )
        self.assertTrue(res_noisy["is_safe"])
        self.assertTrue(res_noisy.get("was_reformatted"))
        self.assertIn("anel de foco", res_noisy["formatted_prompt"].lower())
        self.assertNotIn("merda", res_noisy["formatted_prompt"].lower())

    def test_06_patch_extraction_for_all_creative_elements(self):
        """
        Testa a extracao de patches de confete, anel de foco, seta com callout e selo promocional.
        """
        sample_response = (
            "Compreendido. Adicionando os elementos visuais requeridos na prancheta pelo Conselho Editorial.\n\n"
            "```json:patch\n"
            "{\n"
            '  "spread_index": 0,\n'
            '  "actions": [\n'
            '    {\n'
            '      "action": "add_overlay",\n'
            '      "target": "page:1",\n'
            '      "params": {\n'
            '        "type": "confetti",\n'
            '        "subType": "festive_confetti",\n'
            '        "density": "high"\n'
            '      }\n'
            '    },\n'
            '    {\n'
            '      "action": "highlight_product",\n'
            '      "target": "page:2",\n'
            '      "params": {\n'
            '        "slotIndex": 0,\n'
            '        "style": "hand_drawn_circle",\n'
            '        "color": "#B08D57"\n'
            '      }\n'
            '    },\n'
            '    {\n'
            '      "action": "add_overlay",\n'
            '      "target": "page:2",\n'
            '      "params": {\n'
            '        "type": "arrow",\n'
            '        "subType": "callout_arrow",\n'
            '        "targetSlotIndex": 0,\n'
            '        "text": "Mais Vendido",\n'
            '        "arrowDirection": "to_bottom_right"\n'
            '      }\n'
            '    },\n'
            '    {\n'
            '      "action": "add_overlay",\n'
            '      "target": "page:2",\n'
            '      "params": {\n'
            '        "type": "badge",\n'
            '        "subType": "discount_badge",\n'
            '        "text": "25% OFF",\n'
            '        "x": 82,\n'
            '        "y": 12\n'
            '      }\n'
            '    }\n'
            '  ],\n'
            '  "summary": "Confetes festivos, circulo de destaque, seta e selo adicionados."\n'
            "}\n"
            "```\n"
            "Prancheta atualizada com exito."
        )

        patch = extract_patch_from_text(sample_response)
        self.assertIsNotNone(patch)
        self.assertEqual(patch["spread_index"], 0)
        self.assertEqual(len(patch["actions"]), 4)

        # Validacao da acao de confete
        act_confetti = patch["actions"][0]
        self.assertEqual(act_confetti["action"], "add_overlay")
        self.assertEqual(act_confetti["target"], "page:1")
        self.assertEqual(act_confetti["params"]["type"], "confetti")
        self.assertEqual(act_confetti["params"]["density"], "high")

        # Validacao da acao de destaque de produto
        act_highlight = patch["actions"][1]
        self.assertEqual(act_highlight["action"], "highlight_product")
        self.assertEqual(act_highlight["target"], "page:2")
        self.assertEqual(act_highlight["params"]["slotIndex"], 0)
        self.assertEqual(act_highlight["params"]["style"], "hand_drawn_circle")

        # Validacao da seta com callout
        act_arrow = patch["actions"][2]
        self.assertEqual(act_arrow["action"], "add_overlay")
        self.assertEqual(act_arrow["params"]["type"], "arrow")
        self.assertEqual(act_arrow["params"]["text"], "Mais Vendido")

        # Validacao do selo promocional
        act_badge = patch["actions"][3]
        self.assertEqual(act_badge["action"], "add_overlay")
        self.assertEqual(act_badge["params"]["type"], "badge")
        self.assertEqual(act_badge["params"]["text"], "25% OFF")

    def test_07_guardrail_allows_creative_intents_without_false_positives(self):
        """
        Verifica se termos como 'festa', 'confetes', 'circulo', 'seta', 'adesivo' nao sao bloqueados.
        """
        creative_prompts = [
            "coloque confetes de festa no catalogo",
            "faca um circulo ao redor do produto",
            "insira uma seta apontando para a promocao",
            "adicione um selo de desconto de 50%",
            "limpe todos os adesivos e overlays da pagina",
        ]
        for prompt in creative_prompts:
            res = KatanaGuardrailEngine.inspect_prompt(prompt, agent_role="director")
            self.assertTrue(res.is_safe, f"Prompt '{prompt}' nao deveria ter sido bloqueado")

    def test_08_stars_particles_overlay_protocol_and_extraction(self):
        """
        Garante que solicitacoes de estrelas e particulas de fundo escuro produzem e extraem
        corretamente overlays de estrelas com fidelidade visual.
        """
        stars_response = (
            "Camada de partículas estelares aplicada sobre o fundo preto da primeira página pelo Conselho Editorial.\n\n"
            "```json:patch\n"
            "{\n"
            '  "spread_index": 0,\n'
            '  "actions": [\n'
            '    {\n'
            '      "action": "add_overlay",\n'
            '      "target": "page:1",\n'
            '      "params": {\n'
            '        "type": "stars",\n'
            '        "subType": "stars",\n'
            '        "density": "high",\n'
            '        "color": "#FFFFFF"\n'
            '      }\n'
            '    }\n'
            '  ],\n'
            '  "summary": "Partículas em formato de estrelas adicionadas ao fundo escuro da capa."\n'
            "}\n"
            "```\n"
            "Prancheta atualizada."
        )

        patch = extract_patch_from_text(stars_response)
        self.assertIsNotNone(patch)
        self.assertEqual(len(patch["actions"]), 1)
        action = patch["actions"][0]
        self.assertEqual(action["action"], "add_overlay")
        self.assertEqual(action["target"], "page:1")
        self.assertEqual(action["params"]["type"], "stars")
        self.assertEqual(action["params"]["subType"], "stars")
        self.assertEqual(action["params"]["color"], "#FFFFFF")
