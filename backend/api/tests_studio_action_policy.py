import json
from unittest.mock import patch
from django.test import TestCase
from api import tests_imported_text_resolver as resolver_tests
from api.ai.provider import AIResponseChunk


class StudioActionPolicyTests(TestCase):
    setUp = resolver_tests.ImportedTextResolverTests.setUp
    analyze = resolver_tests.ImportedTextResolverTests.analyze
    confirm = resolver_tests.ImportedTextResolverTests.confirm
    chat = resolver_tests.ImportedTextResolverTests.chat

    def test_exact_closing_page_regression(self):
        catalog = self.confirm(self.analyze([{} for _ in range(8)], mode="preserve"))
        proposed = {
            "actions": [
                {
                    "action": "add_page",
                    "target": "catalog:pages",
                    "params": {
                        "afterPage": 8,
                        "contentRole": "closing",
                        "type": "backcover",
                    },
                }
            ]
        }
        chunks = [
            AIResponseChunk(
                text="Proposta\n```json:patch\n" + json.dumps(proposed) + "\n```"
            ),
            AIResponseChunk(done=True, metadata={}),
        ]
        with patch(
            "api.ai.agents.base.BaseAgent.process_stream", return_value=iter(chunks)
        ):
            _, events = self.chat(
                catalog, "crie uma outra página de finalização do catálogo"
            )
        accepted = [e["patch"] for e in events if e["event"] == "patch"]
        self.assertTrue(accepted, events)
        self.assertEqual(accepted[0]["actions"][0]["params"]["contentRole"], "closing")

    def fixture(self, mode="preserve", text="PRODUTOS"):
        return self.confirm(
            self.analyze(
                [
                    {"content": f"BT /F1 20 Tf 30 100 Td ({text}) Tj ET"}
                    for _ in range(8)
                ],
                mode=mode,
            ),
            mode=mode,
        )

    def route(self, catalog, actions, **kwargs):
        from api.services.studio_action_policy import ActionPolicyRouter

        return ActionPolicyRouter(catalog, self.owner, **kwargs).validate_patch(
            {"actions": actions}
        )

    def action(self, action_name, target="catalog:pages", **params):
        return {"action": action_name, "target": target, "params": params}

    def pages(self, catalog):
        from api.services.catalog_page_origin import catalog_pages, normalize_page

        return [normalize_page(p, catalog) for p in catalog_pages(catalog)]

    def save(self, catalog, pages, **extra):
        from django.urls import reverse

        pages = [{**p, "pageNumber": i + 1} for i, p in enumerate(pages)]
        spreads = [
            {
                "spread_index": i // 2,
                "left_page_elements": [pages[i]],
                "right_page_elements": pages[i + 1 : i + 2],
            }
            for i in range(0, len(pages), 2)
        ]
        return self.client.post(
            reverse("studio_spread_bulk_sync", kwargs={"catalog_id": catalog.pk}),
            {"spreads": spreads, "total_pages": len(pages), **extra},
            format="json",
        )

    def authored(self, params):
        return {
            "id": params["pageId"],
            "pageOrigin": "catana_authored",
            "contentRole": params["contentRole"],
            "type": params["type"],
            "title": params.get("title", "Editorial"),
            "products": [],
        }

    def test_nine_pages_reload_share_and_source_count(self):
        from django.urls import reverse
        from api.services.document_reconstructor import (
            DocumentReconstructorService,
            public_import_page,
        )

        catalog = self.fixture()
        original_ir = json.dumps(catalog.source_import.document_ir, sort_keys=True)
        patch, decisions = self.route(
            catalog, [self.action("add_page", afterPage=8, contentRole="closing")]
        )
        self.assertTrue(all(d.allowed for d in decisions))
        pages = self.pages(catalog)
        original_pages = json.dumps(pages, sort_keys=True)
        pages.append(self.authored(patch["actions"][0]["params"]))
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        catalog.refresh_from_db()
        self.assertEqual(catalog.total_pages, 9)
        self.assertEqual(len(catalog.source_import.document_ir["pages"]), 8)
        self.assertEqual(
            json.dumps(catalog.source_import.document_ir, sort_keys=True), original_ir
        )
        persisted = self.pages(catalog)
        self.assertEqual(json.dumps(persisted[:8], sort_keys=True), original_pages)
        self.assertEqual(persisted[8]["pageOrigin"], "catana_authored")
        self.assertEqual(catalog.spreads.last().right_page_elements, [])
        self.assertTrue(DocumentReconstructorService.validate_catalog_source(catalog))
        shared = self.client.put(
            reverse("studio_catalog_detail", kwargs={"pk": catalog.pk}),
            {"share_import": True},
            format="json",
        )
        self.assertEqual(shared.status_code, 200, shared.data)
        self.assertEqual(public_import_page(persisted[8])["contentRole"], "closing")
        detail = self.client.get(
            reverse("studio_catalog_detail", kwargs={"pk": catalog.pk})
        ).data
        self.assertEqual(detail["total_pages"], 9)
        self.assertEqual(detail["source_page_count"], 8)
        # Persist undo and redo of a reversible authored addition.
        self.assertEqual(self.save(catalog, persisted[:8]).status_code, 200)
        catalog.refresh_from_db()
        self.assertEqual(catalog.total_pages, 8)
        self.assertEqual(catalog.spreads.count(), 4)
        self.assertEqual(self.save(catalog, persisted).status_code, 200)

    def test_insert_reorder_and_duplicate_keep_source_identity(self):
        catalog = self.fixture()
        pages = self.pages(catalog)
        patch, _ = self.route(catalog, [self.action("add_page", afterPage=3)])
        pages.insert(3, self.authored(patch["actions"][0]["params"]))
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        pages = self.pages(catalog)
        moved = pages.pop(7)
        pages.insert(2, moved)
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        self.assertEqual(self.pages(catalog)[2]["sourcePageNumber"], 7)
        patch, _ = self.route(catalog, [self.action("duplicate_page", "page:2")])
        source = self.pages(catalog)[1]
        clone = {
            **source,
            "id": patch["actions"][0]["params"]["pageId"],
            "pageOrigin": "derived_from_import",
            "derivedFromPageId": source["id"],
        }
        pages = self.pages(catalog) + [clone]
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        self.assertEqual(self.pages(catalog)[-1]["sourcePageNumber"], 2)
        from api.services.document_reconstructor import DocumentReconstructorService

        catalog.refresh_from_db()
        self.assertTrue(DocumentReconstructorService.validate_catalog_source(catalog))

    def test_source_removal_confirmation_is_revision_and_user_bound(self):
        from api.services.studio_action_policy import confirmation_token
        from django.urls import reverse

        catalog = self.fixture()
        proposal = {"actions": [self.action("remove_page", "page:4")]}
        accepted, decisions = self.route(catalog, proposal["actions"])
        self.assertIsNone(accepted)
        self.assertEqual(decisions[0].reasonCode, "confirmation_required")
        pages = self.pages(catalog)
        del pages[3]
        self.assertEqual(self.save(catalog, pages).status_code, 400)
        token = confirmation_token(catalog, self.owner, proposal)
        response = self.client.post(
            reverse("studio_action_confirm", kwargs={"catalog_id": catalog.pk}),
            {"confirmation_token": token},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            self.save(catalog, pages, confirmation_token=token).status_code, 200
        )
        self.assertEqual(len(catalog.source_import.document_ir["pages"]), 8)
        replay = self.client.post(
            reverse("studio_action_confirm", kwargs={"catalog_id": catalog.pk}),
            {"confirmation_token": token},
            format="json",
        )
        self.assertEqual(replay.status_code, 409)

    def test_atomic_mixed_patch_and_unknown_actions(self):
        catalog = self.fixture()
        accepted, decisions = self.route(
            catalog,
            [
                self.action("add_page"),
                self.action("adjust_pricing", "global", amount=15),
            ],
        )
        self.assertIsNone(accepted)
        self.assertEqual(decisions[-1].reasonCode, "commercial_integrity_blocked")
        self.assertEqual(len(self.pages(catalog)), 8)
        accepted, decisions = self.route(
            catalog, [self.action("destroy_entire_database")]
        )
        self.assertIsNone(accepted)
        self.assertEqual(decisions[0].reasonCode, "unsupported_action")
        accepted, _ = self.route(
            catalog,
            [
                self.action("add_page"),
                self.action("add_overlay", "page:9", type="badge", text=""),
            ],
        )
        self.assertIsNotNone(accepted)

    def test_forged_origin_snapshot_malformed_and_cross_tenant(self):
        from api.services.studio_action_policy import ActionPolicyRouter

        catalog = self.fixture()
        cases = [
            self.action("add_page", pageOrigin="imported_source"),
            self.action("add_page", sourceSnapshot={}),
            self.action("add_page", afterPage=-100),
            self.action("add_page", afterPage=999999),
            self.action("add_page", title="x" * 2001),
            self.action("add_page", title="javascript:alert(1)"),
            self.action("add_page", contentRole={}),
            self.action(
                "add_overlay", "page:1", type="sprite", imageUrl="https://evil.invalid"
            ),
        ]
        for action in cases:
            with self.subTest(action=action):
                self.assertIsNone(self.route(catalog, [action])[0])
        accepted, decisions = ActionPolicyRouter(catalog, self.foreign).validate_patch(
            {"actions": [self.action("add_page")]}
        )
        self.assertIsNone(accepted)
        self.assertEqual(decisions[0].reasonCode, "cross_tenant_target")
        forged = self.pages(catalog)
        forged.append({**forged[0], "id": "fake", "pageNumber": 9})
        self.assertEqual(self.save(catalog, forged).status_code, 400)
        forged = self.pages(catalog)
        forged.append(
            {
                "id": "fake",
                "pageOrigin": "catana_authored",
                "documentPage": forged[0]["documentPage"],
            }
        )
        self.assertEqual(self.save(catalog, forged).status_code, 400)

    def test_text_overlay_and_source_destroy_route_separately(self):
        from api.services.imported_text_resolver import catalog_index

        catalog = self.fixture("editable")
        entry = catalog_index(catalog)[0][0]
        text = self.action(
            "update_text",
            entry["target"],
            find="PRODUTOS",
            replacement="ITENS",
            expectedText=entry["text"],
        )
        accepted, decisions = self.route(catalog, [text])
        self.assertIsNotNone(accepted)
        self.assertEqual(decisions[0].actionCategory, "source_element_edit")
        accepted, decisions = self.route(
            catalog, [self.action("add_overlay", "page:1", type="badge", text="")]
        )
        self.assertIsNotNone(accepted)
        self.assertEqual(decisions[0].actionCategory, "catana_visual_layer")
        pages = self.pages(catalog)
        before = pages[0]["documentPage"]
        pages[0]["overlays"] = [
            {"id": "badge-1", "type": "badge", "x": 80, "y": 15, "text": ""}
        ]
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        self.assertEqual(self.pages(catalog)[0]["documentPage"], before)
        self.assertIsNone(
            self.route(
                catalog,
                [
                    self.action(
                        "remove_overlay", "page:1", id=before["elements"][0]["id"]
                    )
                ],
            )[0]
        )
        accepted, decisions = self.route(
            catalog, [self.action("delete_source", "catalog:source")]
        )
        self.assertIsNone(accepted)
        self.assertEqual(decisions[0].reasonCode, "source_integrity_violation")

    def test_closing_language_brand_snapshot_and_no_invented_contact(self):
        from api.ai.structural_commands import plan_structure

        catalog = self.fixture()
        catalog.brand_snapshot = {
            "palette": [
                {"role": "primary", "hex": "#003366", "status": "confirmed"},
                {"role": "accent", "hex": "#FFFF00", "status": "confirmed"},
            ]
        }
        catalog.save()
        for phrase in [
            "crie uma outra página de finalização do catálogo",
            "crie uma página de encerramento",
            "adicione uma contracapa",
            "crie uma página final de contato",
        ]:
            plan = plan_structure(
                phrase, {"catalog_id": catalog.pk, "catalog_page_count": 8}
            )
            self.assertEqual(plan[1]["actions"][0]["params"]["contentRole"], "closing")
        accepted, _ = self.route(
            catalog,
            [
                self.action(
                    "add_page",
                    afterPage=8,
                    contentRole="closing",
                    title="Ligue 555-0100",
                )
            ],
        )
        params = accepted["actions"][0]["params"]
        self.assertEqual(params["pageColors"]["backgroundColor"], "#003366")
        self.assertNotIn("555", json.dumps(params))
        self.assertNotIn("http", json.dumps(params))

    def test_action_contract_parity(self):
        import re
        from pathlib import Path
        from api.services.studio_action_policy import REGISTRY
        from api.ai.agents.orchestrator import OrchestratorAgent

        prompt = OrchestratorAgent().get_system_prompt()
        declaration = prompt.split('"action": ', 1)[1].split("\n", 1)[0]
        advertised = set(re.findall(r'"([a-z_]+)"', declaration))
        self.assertEqual(
            advertised, {a for a, spec in REGISTRY.items() if spec["executor"]}
        )
        root = Path(__file__).resolve().parents[2]
        executor = (root / "frontend/src/store/studioStore.ts").read_text()
        supported = set(re.findall(r"case '([a-z_]+)':", executor))
        self.assertFalse(advertised - supported)
        self.assertIn("shared/studio-actions.json", executor)

    def test_explicit_user_authored_product_and_unconfirmed_sku_are_separate(self):
        catalog = self.fixture()
        literal = "cadastre um produto Balde com SKU ABC-001 e preço R$ 20,00"
        action = self.action(
            "create_product",
            "catalog:products",
            name="Balde",
            sku="ABC-001",
            price="R$ 20,00",
        )
        accepted, _ = self.route(catalog, [action], context={"user_message": literal})
        self.assertIsNotNone(accepted)
        self.assertIsNone(
            self.route(
                catalog, [action], context={"user_message": "cadastre um produto"}
            )[0]
        )
        self.assertIsNone(
            self.route(
                catalog,
                [self.action("generate_skus", "catalog:products", prefix="ABC-")],
            )[0]
        )
        self.assertIsNone(
            self.route(
                catalog,
                [self.action("add_overlay", "page:1", type="badge", text="20% OFF")],
            )[0]
        )
        self.assertIsNone(
            self.route(catalog, [self.action("add_page", content="ABC-001")])[0]
        )

    def test_confirmed_contact_is_captured_snapshot_only(self):
        catalog = self.fixture()
        catalog.brand_snapshot = {
            "identity": {"website": "https://example.org/confirmed"}
        }
        catalog.save()
        accepted, _ = self.route(
            catalog, [self.action("add_page", contentRole="closing")]
        )
        self.assertIn(
            "https://example.org/confirmed", accepted["actions"][0]["params"]["content"]
        )

    def test_authored_text_and_reordered_source_text_have_distinct_authority(self):
        from api.services.imported_text_resolver import catalog_index

        catalog = self.fixture("editable")
        pages = self.pages(catalog)
        moved = pages.pop(6)
        pages.insert(1, moved)
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        entries, _ = catalog_index(catalog, page_number=2)
        self.assertTrue(entries)
        self.assertTrue(all(e["target"].startswith("page:2/") for e in entries))
        accepted, _ = self.route(
            catalog, [self.action("add_page", contentRole="closing")]
        )
        pages = self.pages(catalog)
        pages.append(self.authored(accepted["actions"][0]["params"]))
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        accepted, decisions = self.route(
            catalog,
            [
                self.action(
                    "update_text",
                    "page:9/field:title",
                    expectedText=pages[-1]["title"],
                    find="Obrigado",
                    replacement="Agradecemos",
                )
            ],
        )
        self.assertIsNotNone(accepted)
        self.assertIsNone(
            self.route(
                catalog,
                [
                    self.action(
                        "update_text",
                        "page:1/element:fake",
                        text="ITENS",
                        expectedText="PRODUTOS",
                    )
                ],
            )[0]
        )

    def test_source_relabeling_and_existing_product_fact_changes_are_blocked(self):
        catalog = self.fixture()
        pages = self.pages(catalog)
        pages[0] = {
            "id": pages[0]["id"],
            "pageNumber": 1,
            "pageOrigin": "catana_authored",
            "products": [],
        }
        self.assertEqual(self.save(catalog, pages).status_code, 400)
        pages = self.pages(catalog)
        accepted, _ = self.route(catalog, [self.action("add_page")])
        new = self.authored(accepted["actions"][0]["params"])
        new["products"] = [
            {
                "id": "customer-product",
                "name": "Balde",
                "price": "R$ 10,00",
                "sku": "ABC-001",
            }
        ]
        pages.append(new)
        self.assertEqual(self.save(catalog, pages).status_code, 200)
        pages = self.pages(catalog)
        pages[-1]["products"][0]["price"] = "R$ 99,00"
        self.assertEqual(self.save(catalog, pages).status_code, 400)

    def test_overlapping_text_batches_never_allow_partial_execution(self):
        from api.services.imported_text_resolver import catalog_index

        catalog = self.fixture("editable")
        entry = catalog_index(catalog)[0][0]
        text = self.action(
            "update_text",
            entry["target"],
            find="PRODUTOS",
            replacement="ITENS",
            expectedText=entry["text"],
        )
        self.assertIsNone(self.route(catalog, [text, text])[0])
        self.assertIsNone(self.route(catalog, [self.action("add_page"), text])[0])
