# Imported catalog action architecture validation

Branch: `fix/imported-catalog-action-policy-router`.
Base: latest `main`, `3922e59` (including the merged server imported-text resolver).
No migration, deployment, merge or force push is part of this change.

## Regression reproduced before implementation

The first added regression imported eight synthetic PDF pages in Preserve mode,
then delivered a model `add_page` proposal for the exact command:

> crie uma outra página de finalização do catálogo

The test failed before the implementation:

```text
FAIL: test_exact_closing_page_regression
AssertionError: [] is not true
SSE token: Edição rejeitada: o destino não é editável ou os dados comerciais estão protegidos.
SSE done: planner_status=invalid_target, patch=None
Ran 1 test ... FAILED (failures=1)
```

The model proposal and existing frontend page factory were compatible. The
imported backend gate applied `imported_text_resolver.validate_patch` to all
patch actions, and therefore rejected structure. The router now owns the whole
patch; only verified source text actions delegate to that resolver.

## Result and limits of the real-API browser scenario

The isolated Django bridge analyzes and confirms an invented eight-page PDF,
uses authenticated real chat and bulk-save APIs, and serves real private source
assets. Browser traffic is transported to that Django test process; production
has no test endpoints. The exact command adds page 9 with `contentRole=closing`
and `pageOrigin=catana_authored`. Source page documents remain identical; source
count remains 8, catalog count becomes 9, and the last spread has no right page.
Reload, persisted undo/redo and all nine export snapshot pages are checked.

The separate PDF export test uses real jsPDF serialization with mocked pixel
capture and verifies nine PDF MediaBoxes: eight original point geometries and
one new A4 pixel geometry. The original seven-page mixed-size export tests remain.

No customer Plaswill PDF was attached to this session. These results establish
real API/executor behavior on synthetic source evidence, not visual acceptance
of the customer's actual artwork. No paid provider/model calls were made.

## Tests added

Backend `api.tests_studio_action_policy` adds 14 tests:

1. `test_exact_closing_page_regression`
2. `test_nine_pages_reload_share_and_source_count`
3. `test_insert_reorder_and_duplicate_keep_source_identity`
4. `test_source_removal_confirmation_is_revision_and_user_bound`
5. `test_atomic_mixed_patch_and_unknown_actions`
6. `test_forged_origin_snapshot_malformed_and_cross_tenant`
7. `test_text_overlay_and_source_destroy_route_separately`
8. `test_closing_language_brand_snapshot_and_no_invented_contact`
9. `test_action_contract_parity`
10. `test_explicit_user_authored_product_and_unconfirmed_sku_are_separate`
11. `test_confirmed_contact_is_captured_snapshot_only`
12. `test_authored_text_and_reordered_source_text_have_distinct_authority`
13. `test_source_relabeling_and_existing_product_fact_changes_are_blocked`
14. `test_overlapping_text_batches_never_allow_partial_execution`

Frontend `studioActionPolicy.test.ts` adds:

- closing-page execution, specific feedback, one history snapshot, full bulk
  persistence, no fake tenth page, undo and redo;
- insert/move/duplicate with stable IDs and source numbers;
- unknown/prototype action and stale sequence rejection without mutation/history.

`pdfExportService.test.ts` adds eight-source-plus-one-authored PDF serialization.
`document-import.spec.ts` adds the exact eight-to-nine-page real-API browser case.

Existing source tests were retained. The Studio guard regression now imports a
real private PDF instead of treating a browser index without a catalog as an
execution authority; all its guard/provider assertions remain. Source save tests
now inspect the full bulk payload rather than the former single visible spread.
The existing seven-page browser fixture supports that same bulk contract and
continues checking untouched source pages and the empty odd spread partner.

## Commands and observed results

Commands run from the indicated repository subdirectory:

```bash
# backend — full suite, final code including the 14 policy tests
SECRET_KEY=local-test DEBUG=True \
DATABASE_URL=postgresql://agent@127.0.0.1:55432/postgres \
/tmp/catana-venv/bin/python manage.py test api --noinput
# Ran 524 tests in 76.966s — OK

# backend — relevant SQLite suites, including new origin/commercial/atomicity cases
SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py test \
api.tests_studio_action_policy api.tests_imported_text_resolver \
api.tests_document_import api.tests_document_security api.tests_document_redesign \
api.tests_ai_command_pipeline api.tests_studio --noinput
# Ran 153 tests in 21.569s — OK

# backend — final action-schema/provider/ordinary-origin contract check
SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py test \
api.tests_studio_action_policy api.tests_studio api.tests_ai_command_pipeline --noinput
# Ran 70 tests in 9.935s — OK

# frontend — final tests, including actual jsPDF nine-page serialization
npm test
# 13 test files passed; 130 tests passed

npm run build
# fonts:check, tsc -b and Vite passed (11.43s final production build)

npm run lint
# Existing baseline: 248 errors, 20 warnings; no increase

CATANA_TEST_PYTHON=/tmp/catana-venv/bin/python \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
npm run test:e2e -- e2e/document-import.spec.ts
# 18 passed (1.5m)

# After the last rendering changes, repeat the real API scenarios:
CATANA_TEST_PYTHON=/tmp/catana-venv/bin/python \
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
npm run test:e2e -- e2e/document-import.spec.ts --grep 'real private|eight imported'
# 2 passed (40.2s)

# repository
python -m compileall -q backend/api/services backend/api/views_studio.py
git diff --check
# Both clean
```

Earlier runs caught and corrected: source metadata enrichment falsely invalidating
no-op saves; malformed role dictionaries raising instead of rejecting; missing
executor contracts; old browser-only authority fixtures; and stale text batch
partial-execution risk. An intermediate browser run timed out waiting for a quota
button before analysis; the unchanged retry scenario passed in the subsequent
full 18-test run. Failures were not hidden or skipped.

Lint still fails on the existing repository baseline. Vite still reports its
existing large main bundle warning. Neither is introduced by this change.

## Files changed

- `shared/studio-actions.json`
- `backend/api/services/studio_action_policy.py`
- `backend/api/services/catalog_page_origin.py`
- `backend/api/services/document_reconstructor.py`
- `backend/api/services/imported_text_resolver.py`
- `backend/api/ai/structural_commands.py`
- `backend/api/ai/provider.py`
- `backend/api/ai/agents/base.py`
- `backend/api/ai/agents/orchestrator.py`
- `backend/api/views_studio.py`
- `backend/api/urls.py`
- `backend/api/tests_studio_action_policy.py`
- `backend/api/tests_studio.py`
- `backend/tests_support/import_editing_bridge.py`
- `frontend/src/store/studioStore.ts`
- `frontend/src/store/studioActionPolicy.test.ts`
- `frontend/src/utils/textCommandExecution.ts`
- `frontend/src/data/editorialCatalog.mock.ts`
- `frontend/src/components/studio/ConfirmStudioAction.tsx`
- `frontend/src/components/studio/AgentChatStream.tsx`
- `frontend/src/components/studio/EditorialPageSnapshot.tsx`
- `frontend/src/components/studio/SpreadViewport.tsx`
- `frontend/src/components/studio/MiniPageThumbnail.tsx`
- `frontend/src/components/studio/PageOverlayLayer.tsx`
- `frontend/src/services/documentImportService.test.tsx`
- `frontend/src/services/pdfExportService.test.ts`
- `frontend/e2e/document-import.spec.ts`
- `frontend/e2e/import-editing-bridge.ts`
- `frontend/tsconfig.app.json`
- `docs/studio-action-policy.md`
- `docs/studio-action-policy-validation.md`
- `docs/catalog-import-engine.md`
- `docs/imported-document-editing-validation.md`

## Remaining capability limits

The [complete capability matrix](studio-action-policy.md) is the final policy,
not a blanket promise of arbitrary model execution. Browser-only SKU/price
rewrites are blocked; authoritative Product workflows remain necessary. Source
layout/image changes use existing reconstruction/redesign/asset workflows.
Five unimplemented generative executor names are no longer advertised. The
closing command reuses the existing backcover renderer and captured brand palette;
it does not invoke a new automatic composition engine. Arbitrary sprite/logo URLs
are not approved by the overlay policy. Mixed text/sequence or overlapping text
batches require separate proposals. Source text revisions still invalidate old
publication approval. History is session-local; cache counters are diagnostic,
not durable metrics. Source-removal confirmations expire and cannot replay across
revisions; a later source-removal redo may require a fresh confirmation.

## Publication

Pending final branch push and GitHub PR API result. No merge or production change.
