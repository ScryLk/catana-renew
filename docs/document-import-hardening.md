# Document import hardening audit and validation

## Root causes confirmed

| File | Existing behavior / cause | Impact | Fix / regression |
| --- | --- | --- | --- |
| `backend/api/services/pdf_import_adapter.py` | `_font_details` recognized Arial/Times/Courier only; unknown fonts lowered the shared confidence below .9 | Reliable live text lost editability | Registry resolver and independent confidence; nonstandard-font eight-page fixture |
| Same | `_reconstruct` stopped at eight texts | Dense pages mostly raster | Resource/deadline budgets; dense-page fixture |
| Same | Later bounding-box overlap rejected candidates | Non-occluding artwork prevented editing | Actual ink/source contribution; outline-overlap fixture |
| Same | Batch removal plus page-wide rejection | A failed candidate lost other valid text | Per-candidate removal/reinsertion; failed-mask and concealed-object fixtures |
| Same | Every clipping path rejected | Harmless containing clips could block text | Rectangle classification and complete bounds containment; partial clips remain preserved |
| `backend/api/guards/quota_guard.py` | First organization's plan combined with cross-organization catalog count | False quota failures | Explicit organization and active-only count; Free A 2/5 versus Pro B 20/30 |
| `backend/api/models.py` | No catalog archive status | “Archive a catalog” had no real action | Active/archive migration and shared manager |
| `backend/api/views_studio.py` | Quota checked before destination resolved; generation/demo paths lacked an atomic final guard | Wrong scope and competing slot consumption | Stable organization lock in every persisting creation path; PostgreSQL race test |
| Same | Standalone chat created “Catalogo em Criacao” | Abandoned empty active catalogs | Unbound chat threads; no data deleted |
| `frontend/src/components/studio/ImportCatalogModal.tsx` | No quota preflight; generic Retry after quota error; preserve mode showed 0 editable | Late surprise and misleading failure | Scoped preflight, separate save eligibility, archive/billing recovery and mode-aware report |

## Import editability before and after

A deterministic eight-page synthetic born-digital PDF uses an unregistered
`ProprietaryMissingFont`, with 20 real PDF text objects per page. No customer
content and no OCR or AI call is used.

| Metric | Before (`main`) | After |
| --- | ---: | ---: |
| Source/imported pages | 8 / 8 | 8 / 8 |
| Live PDF text candidates | 160 | 160 |
| Editable targets | 0 | 159 |
| Editable targets using fallback | 0 | 159 |
| Processing seconds (single local run) | 0.665 | 3.451 |
| Warning | `font_unavailable_source_preserved` | `font_substitute_required_for_editing` |

This is a representative local benchmark, not a production performance promise.
One object still failed visibility admission and remained in source raster.
A second fixture uses eight pages with 30 nonstandard-font text objects each;
source pixel equality and materially nonzero coverage are asserted. Glyph-span
grouping retains all individual source provenance and does not merge a distant
label. Grouped target count and source-object coverage are intentionally distinct.

## Font resolution

Subset prefixes, case/spacing, PostScript, weight and style suffixes resolve
against the existing shared registry. `ABCDEF+Inter-Bold` resolves to Inter 700;
ArialMT and HelveticaNeueLTStd-Bd use compatible Arial; TimesNewRomanPSMT uses
Times New Roman. Unknown Grotesk uses registry body fallback Inter; Unknown Serif
uses registry display fallback Cormorant Garamond. An unregistered Montserrat name
uses fallback instead of claiming registry availability. Source font/family,
resolved family, explicit resolution status and fallback metadata remain separate.

Unedited text renders its original source appearance. Editing uses the resolved
font with fitting and an explicit substitution notice; Restore recovers the source
string and appearance without analysis. No font inference uses AI.

## Fidelity and security

Original snapshots, clean fallback snapshots, appearance crops and provenance are
retained. Initial source/fallback/crop composition still requires exact pixel
identity; the alpha-16 threshold affects visibility evidence only. Invisible,
white-on-white, off-crop, partially concealed and scanned/OCR text do not become
visible editable facts. Private source authorization, malformed-source rejection,
worker isolation, CPU/memory/pixel/asset limits and commercial integrity remain.
No source text is converted automatically into Product data.

## Quota, lifecycle and import UX

Only active catalogs in the destination organization consume its limit. Legacy
personal catalogs have a separate creator scope. Active/archive is a real persisted
lifecycle with a reversible UI and indexed migration. Restore checks the same
quota guard as creation. Archiving retains historical Brand/source data; public
catalog and source-asset access is suspended while archived.

Analysis and preparation consume zero slots. Confirmation consumes exactly one in
its transaction. Confirmed retry returns the same catalog before quota checks;
the real API test fills five slots, analyzes while full, fails confirm without an
orphan, archives one, confirms, then retries successfully at full capacity.
PostgreSQL competing-creation test asserts exactly one 201 and one structured 403
when four of five slots are occupied. Foreign tenant archive/restore/quota requests
are denied. Every server persisting creation path uses the canonical guard.

Preflight is informational; server save remains authoritative. Browser regression
coverage retains the selected page and comparison state while archiving an
existing catalog, confirms the same analysis, and recovers a quota change during
confirmation without blind Retry. Lost-response recovery checks confirmed status
before disabling save due to a newly full quota. Existing billing events, Brand
selection, stale-preview protection, mobile access and comparison views remain.

## Tests added

- Eight-page nonstandard font and registry/PostScript name resolution.
- More than eight texts, no commercial synthesis, exact source composition.
- Per-object verification failure and mixed visible/concealed text.
- Later outline overlap, safe glyph grouping, rectangular clipping, source rotations.
- Organization-scoped plan/count, active/archive/restore, legacy personal count.
- Structured quota counters, foreign tenant permissions, demo clone limit.
- PostgreSQL final-slot race; full-quota analysis and idempotent confirmation.
- Browser preflight/archive recovery and quota change at confirmation.
- Structured error taxonomy and bounded text-fit/overflow unit checks.

## Real PDF validation

The Plaswill/customer PDF was not available: the only attachment was the task
prompt. No customer PDF was committed. Eight-page validation uses synthetic live
PDF text and existing browser source fixtures. Customer-specific font/geometry
coverage remains unverified.

## Remaining limitations

Nested text, complex/partial clipping, unsupported rotations (including current
90/180/270 text editing) and arbitrary affine transforms remain source raster.
Rectangle clipping is admitted only if full source bounds are contained; PDFium
can elide already harmless clips. Grouping is conservative and line-based, without
paragraph inference. Exact source composition can still reject objects affected
by renderer changes outside their crop. Unknown/font-substituted content can
change metrics after explicit editing; fitting does not promise original font
identity. The global worker/asset budgets deliberately bound recovery.

PostgreSQL protects competing slots; SQLite has no equivalent row locking and can
return transient write conflicts. Repository-wide frontend lint has pre-existing
errors outside the hardened components; validation distinguishes these from
changed-file lint. The customer PDF is still required for customer-specific
acceptance. No production deployment or merge was performed.

## Commands executed

All commands ran against local disposable databases. No production service was touched.

```sh
# Repository safety, from /workspace/catana-renew
git status --short
git branch --show-current
git fetch origin --prune
git switch main
git pull --ff-only origin main
git switch -c fix/document-import-editability-quota
# Clean starting worktree; latest main fetched and fast-forward checked.

# Dependencies
python -m venv /tmp/catana-venv
/tmp/catana-venv/bin/pip install -r backend/requirements.txt
cd frontend
npm ci --cache /tmp/catana-npm-cache
# Installed successfully. Initial npm ci needed a writable cache under /tmp.

# Backend, from backend/
SECRET_KEY=local-test DEBUG=True DATABASE_URL=postgresql://agent@127.0.0.1:55432/postgres /tmp/catana-venv/bin/python manage.py test api.tests_catalog_lifecycle api.tests_document_adapter api.tests_document_import api.tests_document_security api.tests_studio api.tests_abacatepay api.tests_brand api.tests_brand_studio --noinput
# PASS: 177 tests, including real PostgreSQL final-slot contention.

SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py test api.tests_document_adapter --noinput
# PASS: 36 tests after the final font-availability metadata refinement.

SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py makemigrations --check --dry-run
# PASS: no changes detected. Migration 0035 applied during test DB setup.

# Frontend, from frontend/
npm test
# PASS: 113 tests across 11 files, including store import and blank quota denial.

PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- document-import.spec.ts
# PASS: 16 browser tests, desktop and 320/390px mobile.

npm run build
# PASS: TypeScript project build and production Vite build.
# Existing large-chunk warning remains.

npx eslint src/components/studio/DocumentPageRenderer.tsx src/components/studio/ImportCatalogModal.tsx src/components/studio/CatalogLifecycleManager.tsx src/components/studio/StudioSidebar.tsx src/services/documentImportService.ts src/services/documentImportService.test.tsx src/types/documentImport.ts src/utils/documentTextFit.ts e2e/document-import.spec.ts
# PASS: hardened components/services/types/utility and browser tests.

npm run lint
# Repository-wide lint remains non-green: 248 errors and 20 warnings.
# Compared with an isolated git archive of main using eslint JSON output:
# main also has 248 errors and 20 warnings; no new lint findings.

# Source fidelity / representative worker benchmark, from backend/
SECRET_KEY=local-test DEBUG=True PYTHONPATH=/workspace/catana-renew/backend /tmp/catana-venv/bin/python /tmp/catana-source-equality.py
# PASS: all 8 source snapshot hashes identical to main; 159 editable texts;
# source-object coverage .99375; verified-visible character coverage 1.0.
# Character denominator excludes unverified/partially occluded objects, so this
# does not claim every extracted character is editable.

# From /workspace/catana-renew
git diff --check
# PASS.
```

PostgreSQL 17 binaries were downloaded from Debian into `/tmp/catana-pg` and
initialized locally in UTF-8. An initial SQL_ASCII test cluster could not accept
Unicode JSON; it was replaced with a UTF-8 cluster, without changing application
logic or weakening tests. SQLite's row-lock race case is feature-gated; the same
case ran and passed on PostgreSQL with no skipped tests.

## Files changed

- `backend/api/ai/font_registry.py`
- `backend/api/guards/quota_guard.py`
- `backend/api/migrations/0035_studiocatalog_archived_at_studiocatalog_status_and_more.py`
- `backend/api/models.py`
- `backend/api/services/document_reconstructor.py`
- `backend/api/services/pdf_import_adapter.py`
- `backend/api/tests_abacatepay.py`
- `backend/api/tests_catalog_lifecycle.py`
- `backend/api/tests_document_adapter.py`
- `backend/api/tests_document_import.py`
- `backend/api/views_studio.py`
- `docs/catalog-import-engine.md`
- `docs/document-import-hardening.md`
- `frontend/e2e/document-import.spec.ts`
- `frontend/src/components/studio/CatalogLifecycleManager.tsx`
- `frontend/src/components/studio/DocumentPageRenderer.tsx`
- `frontend/src/components/studio/ImportCatalogModal.tsx`
- `frontend/src/components/studio/StudioSidebar.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/documentImportService.test.tsx`
- `frontend/src/services/documentImportService.ts`
- `frontend/src/store/studioStore.ts`
- `frontend/src/types/documentImport.ts`
- `frontend/src/utils/documentTextFit.ts`

## Publication

Branch: `fix/document-import-editability-quota`, pushed successfully to origin.
Implementation commit: `ed6366a` (followed by this validation/publication record).

```sh
git push -u origin fix/document-import-editability-quota
# PASS: branch pushed and upstream configured.
gh pr create --base main --head fix/document-import-editability-quota --title 'Harden document text editability and organization catalog quotas' --body-file /tmp/catana-pr-body.md
# BLOCKED: Post "https://api.github.com/graphql": Forbidden.
```

The GitHub API request was blocked; no PR was created automatically. The pushed
branch is reviewable and the PR title/body were prepared locally. Manual creation:
https://github.com/ScryLk/catana-renew/pull/new/fix/document-import-editability-quota

No force push, merge, production modification or deployment was performed.

## Production gate

DOCUMENT IMPORT HARDENING READY FOR PR REVIEW

