# Imported document editing validation

## Regression Reproduced

Before the fix, `test_private_source_resolves_without_browser_text` failed with no
patch and `planner_status: not_found`; SSE returned “Texto não encontrado no índice
do catálogo. Selecione o trecho desejado.” The real synthetic PDF contained
`PRODUTOS`, its private reconstruction was editable, and the browser index was empty.

## Root Cause

The planner trusted `request.editable_text_index`. Public projection intentionally
omits unedited text/provenance, while `editableTextIndex` requires element text.
That contract cannot bootstrap source search. Audit correction: authenticated
Studio detail currently carries private editing state, unlike the public reader.
The failure is reproducible with an absent browser index and with legacy persisted
render-only state; neither should dictate source authority.

## Server-Side Editable Index

The authorized catalog's private import and current spreads provide independently
verified, visible, in-crop candidates. The server ignores imported browser indices,
bounds context, validates fresh targets before SSE patch delivery and independently
validates immutable evidence and commercial protection during save. No migration,
new document model, OCR or PDF reparse is added to the chat path.

## Single Element Resolution

The natural request `na página 1, troque PRODUTOS por ITENS` resolves a stable
`page:1/element:<source-id>`. The real browser/API test starts without source text
or provenance, displays ITENS, saves through Studio and reloads ITENS.

## Visual Text Groups

Separate `CATALOGO DE` and `PRODUTOS` objects resolve from the accented user phrase
“catálogo de produtos”. Full-group replacement produces `Catálogo` in the first
object and an empty second object. Social/footer text stays unchanged. Group
validation and fit precede the state commit; stale/unsafe/overflowing members
leave the entire group untouched, and one undo restores both objects.

## Commercial Integrity

Editorial digits are allowed. Price/SKU/quantity/specification roles and authoritative
product bindings/provenance remain protected. Contextual currency and commercial
keywords replace the blanket digit rule. Manual editing and backend save also
reject protected revisions.

## Security

Tests cover forged browser indices/IDs, SDK embedded patch rejection, malformed
request boundaries, cross-tenant reads/writes/reanalysis, hidden OCR, off-crop text,
malicious visible PDF content remaining DATA, missing source bytes and atomic
save rejection. Safe public projection excludes source text and extraction evidence;
only an edited visible value needed for rendering is projected.

## Source Fidelity

Original PDF bytes, snapshot hashes, appearance crops, geometry, font metadata and
private source text/provenance remain retained. The renderer starts from original
pixels and erases only verified edited rectangles. Reanalysis prepares a separate
preview; replacement requires explicit confirmation and detects intervening edits.

## Persistence

The Playwright transport bridge invokes real Django import, chat, asset and save
APIs in an isolated temporary DB. Initial hydration uses the production public render
projection rather than handing source text to the browser. Server resolution is not
mocked and no correct target is injected. Reload retains ITENS; existing restore
recovers PRODUTOS; group undo restores both source objects.

## Tests Added

17 backend resolver cases cover the regression, grammar, groups, ambiguity,
selection, hidden/off-crop evidence, digit/commercial protection, render-only saves,
legacy IR derivation, reanalysis review/conflicts, injection and input validation,
product binding, grouping roles, missing bytes, search limits and persisted
render-only state. Frontend cases cover editorial digits with an invalid neighbor,
lazy selected text bootstrap, group atomicity/fit/undo and manual commercial protection.
The command E2E now uses real Django behavior; other import UI fixtures remain isolated.

## Commands Executed

Run backend commands from `backend/` and npm commands from `frontend/`.

```sh
# Before implementation: 1 expected failing regression (not_found, no patch).
SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py test api.tests_imported_text_resolver.ImportedTextResolverTests --noinput

# Full final backend verification on local PostgreSQL: 510 passed.
SECRET_KEY=local-test DEBUG=True DATABASE_URL=postgresql://agent@127.0.0.1:55432/postgres /tmp/catana-venv/bin/python manage.py test api --noinput

# Final relevant SQLite contract suites: 139 passed.
SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py test api.tests_imported_text_resolver api.tests_document_import api.tests_document_security api.tests_document_redesign api.tests_studio api.tests_ai_command_pipeline --noinput

# All frontend unit tests: 126 passed.
npm test

# Final selected renderer/executor suites: 34 passed.
npm test -- --run src/services/documentImportService.test.tsx src/utils/textCommandExecution.test.ts

# Full imported-document browser suite: 17 passed.
CATANA_TEST_PYTHON=/tmp/catana-venv/bin/python PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- e2e/document-import.spec.ts

# Final real-contract browser regression: 1 passed.
CATANA_TEST_PYTHON=/tmp/catana-venv/bin/python PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- e2e/document-import.spec.ts -g 'real private PDF'

# TypeScript and production bundle: passed; existing large-bundle warning remains.
npm run build

# Repository baseline lint: 248 errors, 20 warnings, unchanged.
npm run lint

# Patch formatting: passed.
git diff --check
```

## Real Plaswill Validation

The real Plaswill PDF is unavailable in this workspace; the supplied attachments
are pasted request text. No customer source was fabricated or downloaded. Acceptance
above uses invented born-digital PDFs and exercises the same source contracts.

## Files Changed

- `.github/workflows/responsive-browser.yml`
- `backend/api/ai/provider.py`
- `backend/api/ai/text_commands.py`
- `backend/api/services/document_reconstructor.py`
- `backend/api/services/imported_text_resolver.py`
- `backend/api/tests_document_import.py`
- `backend/api/tests_imported_text_resolver.py`
- `backend/api/views_studio.py`
- `backend/tests_support/import_editing_bridge.py`
- `docs/catalog-import-engine.md`
- `docs/document-import-hardening.md`
- `docs/imported-document-editing-validation.md`
- `frontend/e2e/document-import.spec.ts`
- `frontend/e2e/import-editing-bridge.ts`
- `frontend/src/components/studio/AgentChatStream.tsx`
- `frontend/src/components/studio/DocumentPageRenderer.tsx`
- `frontend/src/components/studio/UpdateDocumentEditability.tsx`
- `frontend/src/data/editorialCatalog.mock.ts`
- `frontend/src/services/documentImportService.test.tsx`
- `frontend/src/services/documentImportService.ts`
- `frontend/src/store/studioStore.ts`
- `frontend/src/types/documentImport.ts`
- `frontend/src/utils/textCommandExecution.test.ts`
- `frontend/src/utils/textCommandExecution.ts`

## Remaining Limitations

Visual grouping remains conservative: at most eight neighboring objects, compatible
font hierarchy/roles and unambiguous adjacency. Dense/branching layouts require a
narrower selection or review. No fuzzy/global replacement or OCR was added. Imported
native text changes require backend evidence; generative redesign retains its existing
path. Repository-wide lint debt and large bundle warnings remain outside this change.
Public sharing still requires the existing import quality gates after material edits.

## Production Gate

Final code verification: **510 backend tests**, **126 frontend unit tests**, the
full **17-test import browser suite**, final **139-test SQLite contract suite**,
final real-API browser regression, TypeScript/production build and diff checks passed.
The final renderer/executor subset passed all 34 cases after selection wiring.
Lint retains the existing 248 errors and 20 warnings; no new lint findings appeared.

The implementation is pushed on `fix/server-imported-text-resolver`, based on latest
main `84896ab` (PR #9 merge); implementation commit `cd08021`. GitHub GraphQL and
REST PR creation both returned `Forbidden`, so no PR was created and remote CI
results are not claimed. The normal branch push was verified against the remote.

Open review: https://github.com/ScryLk/catana-renew/compare/main...fix/server-imported-text-resolver?expand=1

No merge or deployment was performed. The change is ready for PR review. Actual
Plaswill validation remains pending access to the original customer PDF.


Publication commands executed from the repository root:

```sh
git fetch origin main
git push -u origin fix/server-imported-text-resolver
git ls-remote --heads origin fix/server-imported-text-resolver
# Push and remote verification succeeded; main remained 84896ab.

gh pr create --repo ScryLk/catana-renew --base main --head fix/server-imported-text-resolver --draft --title 'Resolve imported document text from server evidence' --body-file /tmp/imported-editing-pr-body.md
# GitHub GraphQL: Forbidden.

gh api --method POST repos/ScryLk/catana-renew/pulls --input /tmp/imported-editing-pr.json
# GitHub REST: Forbidden.
```

## Follow-up: imported catalog action architecture

The text-only resolver is now scoped to imported source text. Full Studio patches
pass the category router, and source lineage is independent of display position.
See [Studio action policy](studio-action-policy.md) and
[action architecture validation](studio-action-policy-validation.md). The earlier
text confidence, visibility, geometry, product binding and immutable-source tests
remain active. Browser-provided text without an owned persisted catalog is no
longer an execution authority; the old Studio guard test now uses a real private
PDF and an empty browser index instead.
