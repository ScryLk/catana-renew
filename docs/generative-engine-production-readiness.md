# Generative engine production readiness

The generative engine constructs deterministic editorial geometry inside the user's constraints. Commercial facts come exclusively from supplied structured products. Generated copy, geometry, rendering fallbacks and a successful HTTP response never confer publication approval.

## Architecture and immutable commercial boundary

The pipeline parses a requirement contract, arbitrates constraints, allocates the page budget, retrieves references, plans content, derives VisualDNA and creative direction, sequences narrative roles, generates candidates, validates runtime blocks, selects geometry, applies programmatic criticism and targeted repair, and audits the final document.

`shared/contracts/generative.json` defines block types, render modes, nullable product fields, protected commercial fields and contract versions. Python consumes it directly. The frontend consumes its generated TypeScript counterpart. Product identity uses the supplied ID; SKU is a fallback only when ID is absent. The adapter allocates a deterministic technical ID when needed; it never creates an SKU. Supplied nonempty values, including string quantities, are preserved without casting or trimming.

Protected fields include ID, SKU, price, name, description, quantity, technical specifications, availability, inventory, discount and tag. Missing values remain null. Both changed values and null-to-value fabrication fail the audit. Unknown products and unexpectedly missing allocated products fail; deliberately unallocated products do not. The SHA-256 snapshot covers every protected field with canonical Unicode JSON. Diagnostics identify field names and page/block locations without recording original prices, SKUs or full descriptions.

The generation API adapter preserves supplied products before invoking the pipeline. Model-generated products cannot become authoritative user data. Remote synthesis does not decide the deterministic document's metadata or composition. Explicit demo templates remain available separately; new user inventory starts empty. Local contingency does not populate inventory from demo products and is marked for review.

## Mandatory quality gate

Every final generated document contains `qualityGate` with `passed`, `publishable`, `status` and diagnostic `reasons`. Publication requires the final validator, critic, commercial integrity audit and runtime security validation all to pass. Structural or security/commercial failures are blocked. Remaining aesthetic failures require review. Novelty errors also flow through the validator.

The bounded repair loop runs on validator OR critic failure. Exhaustion applies an explicit legacy fallback; when diagnostic page locations exist, only offending pages fall back. The critic and validator run again. Approval is based on those actual results, never on the fallback renderer itself. Subsystem exceptions return a blocked legacy document with preserved products, not a successful generation report.

## Runtime validation and rendering

Every block is validated before candidate selection and by the document validator after generation, mutation and repair. Required finite numeric bounds, explicit limited bleed, closed block types and declarative properties prevent malformed geometry. Nested executable HTML/CSS/event-handler keys are rejected. Image URLs accept HTTP(S), local absolute paths, blob URLs and known base64 raster formats; active protocols, protocol-relative paths and SVG data URLs are rejected.

The frontend normalizes API documents before generation targets/store updates and validates again at rendering. Invalid blocks are discarded and mark the document blocked. Commercial blocks resolve authoritative product values by `productId`; contradictory cached content is discarded. Null price/SKU/description is omitted, missing images never create empty image elements, and percentage adjustments refuse absent prices with “Defina um preço antes de aplicar reajuste.” Manual product forms and imports do not invent prices, SKUs, photographs or descriptions.

Render mode is explicit. A generative page with no valid blocks remains generative rather than accidentally rendering legacy content. Legacy pages have an empty root `blocks` array. Their draft shape is `{blocks, composition, safeArea}`; the frontend also accepts old array-shaped drafts during normalization. Legacy documents without quality/DNA metadata remain readable. `GENERATIVE_COMPOSITION_ENGINE=false` selects legacy output with no root generative blocks.

## Candidate solver and deterministic output

Five candidate strategies explore edge alignment, mirrored editorial polarity, negative-space mass reduction, orthogonal split fields and typography-led hierarchy. Content role controls meaning while those strategies control geometry. Hard constraints, runtime validation, safe area and structural collisions are filtered before scoring. `NO_DIAGONALS` prevents diagonal axes and nonorthogonal rotations throughout selection and mutation.

Each candidate exposes ID, seed, axis, strategy, score and a breakdown. The weighted score uses hierarchy (0.20), balance (0.15), DNA fit (0.20), novelty (0.15), safe area (0.15) and constraint compliance (0.15), minus cliché and collision penalties. Nearby page fingerprints inform novelty. The winner records the surviving candidate count and score breakdown. Complexities that admit no valid candidate fail closed rather than choosing a prohibited layout.

Persistent seeds and generation fingerprints use SHA-256, never Python `hash()`. Canonical document checks remove only measured elapsed/timing fields and compare the entire remaining document. The reusable invariant script compares independent processes under `PYTHONHASHSEED=1,42,999`, verifies sparse products, luxury, technical B2B, no images and no diagonals, and requires actual block geometry to vary across seeds.

## Programmatic critic and fonts

The critic computes WCAG relative luminance using sRGB linearization and reports the actual contrast ratio separately from its normalized score. Text density, font/container sizes, collisions and contrast inform legibility. Area, layer and primitive importance weight center of mass. Brand fit compares symmetry, density, whitespace, image dominance, grid rigidity, typographic drama and axis tension. The composer selects legible foreground tokens when accent colors lack text contrast. No LLM determines the final score.

`shared/font_registry.json` is the sole manually maintained typography registry: 17 fonts with categories, roles, weights, italics and provider metadata. Python derives categories and role fallbacks. `scripts/generate_font_registry.mjs` deterministically generates frontend types, contract constants and Google Fonts CSS. `npm run fonts:check` fails on drift without altering tracked outputs; use `npm run fonts:generate` after changing the canonical registry. The build checks the generated files.

## Local checks and CI

From the repository root, with backend virtualenv active and the local Django environment configured:

```bash
bash scripts/run_backend_checks.sh
npm test --prefix frontend
npm run build --prefix frontend
python scripts/check_contract_parity.py
node scripts/check_font_registry.mjs
python scripts/check_generative_invariants.py
```

The invariant script creates a temporary SQLite database; it does not migrate or modify user data. Run Django tests from `backend`, as the script does, so discovery finds the full suite. Parallel Django tests are not used because a serialization error can mask failures.

`ci.yml` runs separate backend, frontend tests, frontend build, contract and determinism jobs on main PRs/pushes. Permissions are read-only; concurrency cancels stale runs. The existing live checkout and remote agent tests use injected transport fixtures to exercise payloads and endpoint behavior without real charges, credentials or network dependency. No production transport is mocked.

`security.yml` configures free CodeQL analysis for Python and JavaScript/TypeScript on PRs, main pushes and a weekly schedule. GitHub must support CodeQL for this repository (private repositories may require GitHub Code Security entitlement); local security regression tests run independently. Workflow syntax and their commands can be checked locally, but hosted CodeQL results require an actual GitHub run.

`production-readiness.yml` is a manual audit only. It reruns all gates, security regression tests and a read-only comparison of production and main, then uploads `production-readiness-report.txt` containing the audited SHA/ref, outcomes and production diff. It contains no push, merge or deployment step. It does not promote production.

## Future promotion and branch protection

No promotion workflow is installed. A future reviewed manual promotion must use main as its source, rerun all checks on the exact reviewed commit, verify production ancestry, require protected GitHub environment approval, and use fast-forward only. Abort if those protections are missing. Never force push, automatically merge or delete production.

Recommended main protection: require PR review and successful backend tests, frontend tests/build, contract and determinism checks. Recommended production protection: reviewed/manual promotion, a successful readiness audit of the exact source commit, no force pushes and no branch deletion. Repository administrators must configure these policies; this change does not modify administrative settings.

## Limits of this audit

Programmatic geometry metrics cannot establish browser typography loading or visual fidelity of a printed/PDF page. External AI, payment, Clerk and font CDN integrations require their own authorized credentials/network and are not established by offline transport tests. Existing legacy documents are readable without asserting they have passed a new generation audit. Deployment and production promotion remain separate reviewed actions.
