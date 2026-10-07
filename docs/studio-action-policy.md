# Studio action policy and mixed imported catalogs

Imported source is evidence, not a catalog-wide edit lock. The reported command,
“crie uma outra página de finalização do catálogo”, now proposes an appended
Catana-authored closing page. The existing Studio executor owns mutation,
history, saving and execution feedback; no second executor or generator exists.

## Regression and active flow

The pre-fix real-import regression test created eight retained PDF pages, mocked
a valid structured `add_page`, and observed no patch event. The only token was:
“Edição rejeitada: o destino não é editável ou os dados comerciais estão protegidos.”
`StudioChatStreamView` validated the whole patch with the text-only resolver.

Current flow:

1. Authenticated chat checks tenant and catalog write permissions and literal-user guard.
2. A narrow deterministic planner handles clear page/overlay/source-delete requests;
   complex requests continue to existing agents and provider.
3. Every structured action passes `ActionPolicyRouter`, including non-imported catalogs.
4. The router checks schemas, authoritative persisted pages, source origin and commercial implications.
5. All decisions must allow the patch before a sanitized patch or embedded delta is emitted.
6. Existing `applySpreadPatch` checks current page IDs and preflights text fit/staleness.
7. Existing history records one snapshot per batch. Full sequence saves atomically through bulk sync.
8. Chat success is derived from execution results after persistence; a failed save reports failure.

All responses are buffered before delivery to prevent the fallback embedded-patch
parser receiving unvalidated model JSON. A chat without an owned persisted
catalog cannot receive an executable delta. This changes the previous permissive
browser-only test contract deliberately.

## Canonical contract

`shared/studio-actions.json` supplies the backend category registry, Orchestrator
vocabulary and frontend recognized-action gate. A parity regression checks every
advertised name against the registry and actual executor switch. Aliases
`create_page`/`insert_page`, `delete_page` and `reorder_page` normalize server-side
into canonical structural actions. Names without an executor are not advertised.

The audit found five advertised generative names without frontend handlers:
`mutate_layout`, `regenerate_composition`, `increase_creativity`,
`decrease_creativity`, `change_visual_direction`. They remain classified and
return `unsupported_action`; the prompt no longer promises they can execute.

## Capability matrix and complete action audit

All names below were audited against planner vocabulary, backend dispatch,
frontend execution, source risk and commercial risk. “Existing” means a frontend
handler exists, not that arbitrary model parameters are accepted.

| Actions | Family / validator | Existing executor | Imported source | Catana authored | Derived from import | Principal risk |
| --- | --- | --- | --- | --- | --- | --- |
| navigate, export_pdf | Non-mutating | Yes | Allowed | Allowed | Allowed | Valid owned target; export opens existing export UI |
| update_text, update_text_group | Source edit → imported resolver; authored text → editorial policy | Yes | Verified visible text only | Stable field + exact expected text | Verified retained source text | Visibility, staleness, commercial binding |
| add_page (+ create_page, insert_page aliases) | Structure | Yes | Adds a separate authored page | Same | Same | Bounded position, role, safe copy, assigned UUID/origin |
| move_page (+ reorder_page alias) | Structure | Added to existing executor | Allowed | Allowed | Allowed | Display position must not rewrite source lineage |
| duplicate_page | Structure | Added to existing executor | New derived copy | New authored copy | New derived copy | Unique ID, retained evidence, parent lineage |
| remove_page (+ delete_page alias) | Structure | Yes | Signed confirmation | Allowed | Signed confirmation | Current sequence only; retained import survives |
| reconfigure_catalog | Structure | Yes | Reduction needs confirmation when source/derived pages are removed | Bounded reduction | Same confirmation rule | No silent truncation |
| add_overlay, update_overlay, remove_overlay, clear_overlays | Visual layer | Yes | Allowed Catana overlays | Allowed | Allowed | Bounded shapes/text; cannot address embedded PDF artwork |
| set_page_color | Visual layer | Yes | Mode-specific refusal | Valid color overrides | Mode-specific refusal | Source presentation is not silently rewritten |
| highlight_product | Visual layer | Yes | Unsupported AI capability | Unsupported AI capability | Unsupported AI capability | Product-specific callout requires stronger binding schema |
| set_palette, brand_lock | Visual layer | Yes | Unsupported AI delta | Unsupported AI delta | Unsupported AI delta | Historical brand identity uses existing dedicated workflows |
| summarize_content | Editorial | Yes | Unsupported implicit rewrite | Use explicit field edits | Unsupported implicit rewrite | No implicit factual rewrite |
| create_product | Commercial Integrity | Yes | Explicit new user-authored facts only | Same | Same | Every supplied fact must appear in literal user request; no PDF candidate promotion |
| assign_product, remove_product | Commercial Integrity | Yes | Mode-specific refusal | Exact existing product ID + bounded slot | Mode-specific refusal | No fallback to first product or new commercial facts |
| swap_product, adjust_pricing, generate_skus | Commercial Integrity | Yes | Blocked browser-only commercial rewrite | Same | Same | Authoritative Product workflows are required |
| change_layout | Generative / presentation | Yes | Reconstruction/redesign workflow required | Known layout allowed | Reconstruction/redesign required | Original representation stays intact |
| remove_background, generate_photo | Generative | Yes | Dedicated asset workflow required | Unsupported AI delta | Dedicated asset workflow required | Do not replace original assets or execute arbitrary image prompts |
| mutate_layout, regenerate_composition, increase_creativity, decrease_creativity, change_visual_direction | Generative | No | Unsupported | Unsupported | Unsupported | Not advertised; existing generation endpoints remain available |
| delete_source, replace_source, delete_source_snapshot | Source destructive | No | Prohibited | Prohibited | Prohibited | Original bytes/history never belong to normal AI deltas |

The router is deterministic; it makes no LLM security calls. Existing import
analysis and `SourceIntegrityGuard` still enforce exact source page count/order
at initial reconstruction. Subsequent editing uses the distinct sequence and
page-evidence validation in `catalog_page_origin` and `DocumentReconstructorService`.

## Origin and integrity

Page origin lives in existing page JSON, so no migration is necessary:

- `imported_source`: unique original page ID, retained import ID, original source page number,
  document fingerprint and source-page fingerprint assigned/verified server-side.
- `catana_authored`: independently editable Studio content, with no imported document evidence.
- `derived_from_import`: new identity and `derivedFromPageId`; source evidence remains checked.

Legacy imported pages derive lineage from retained `documentPage`/`sourcePage`
and import evidence, including legacy jobs whose previews need derivation from
private IR. Owner detail returns normalized lineage. Existing imported wrappers
are not enriched by the frontend merely by opening them. Legacy ordinary pages
normalize to authored origin.

`pageNumber` is the current display sequence. `sourcePageNumber` and the nested
source document page number refer to the original PDF and never change on reorder.
Reusing an original page ID with a different origin is rejected, as are duplicate
original identities, fake authored source evidence and changed derived parentage.

Source bytes, assets, source snapshots, private IR, geometry, provenance and
fingerprints remain immutable. Visible source text revisions retain the prior
confidence/visibility and commercial checks. Source-derived product rows and
bound blocks, plus existing authored product facts, cannot be rewritten through
presentation saves. New explicit customer-authored rows do not become PDF truth
or authoritative Product entities merely by entering Studio JSON.

After adding a page to an eight-page source:

```text
source_page_count = 8  (retained import)
total_pages       = 9  (current catalog)
spreads           = 5  (last right side is an empty array, not page 10)
```

## Atomicity, confirmation and persistence

All action decisions pass before SSE delivery. Mixed structural + protected
commercial proposals yield no executable patch. Overlapping text targets and
batches combining sequence changes with text edits are rejected to avoid stale
position or partial text execution; submit those edits separately. Adding a new
page and a safe overlay to the new page can be validated in one batch.

Source/derived removal and truncation return `confirmation_required` with a
Django-signed proposal bound to user, catalog, current persisted revision and a
10-minute expiry. The responsive chat card requests the existing proposal through
`actions/confirm/`. The server revalidates it; bulk persistence checks the same
signature and the exact authorized removed IDs. It never deletes `DocumentImport`
or its evidence. A changed revision or replay is rejected. Manual source removal
is directed to that confirmation flow; ordinary authored-page removal is reversible.

Bulk sync validates the entire sequence and source evidence inside one database
transaction, saves current page count, and removes obsolete spread rows. The
single-spread route permits content revisions but refuses identity/sequence changes.
Undo/redo restore page count and use the same full-sequence persistence. History is
session-local, as before; reload does not reconstruct an undo stack. A later
source-removal redo needs a fresh confirmation if its original revision changed.

## Closing pages, brand, overlays, sharing and export

Closing purpose is `contentRole=closing`, separate from the existing `backcover`
layout. A clear “outra página de finalização” appends after the final current page.
The existing page factory and renderer are reused. Neutral editorial copy is
“Obrigado por conhecer nossas soluções.” A website may be appended only from the
catalog's historical captured identity. No phone, email, Instagram, price,
certification or commercial terms are invented. Confirmed palette entries come
from that captured snapshot; live Brand revisions are not consulted.

This change does not create a new generative subsystem. Sophisticated new-page
composition still requires the existing generation workflow; the deterministic
closing command uses the existing backcover renderer. Logo/sprite asset reuse is
not granted by an arbitrary URL in an overlay action.

Catana overlays render above imported pages in Studio, thumbnails and export.
Original comparison renders the retained source alone. Default badges/stamps no
longer invent an offer, authenticity claim or “Katana Atelier” brand attribution.

Sharing validates each source/derived page against its original evidence and
authored pages with runtime schema checks, rather than comparing page 9 to an
absent PDF page. Structural-only edits revoke share consent without invalidating
captured source quality. Source text edits still invalidate the previous quality
approval; existing review/reanalysis and generative publication gates remain.
Public projection keeps hidden extracted PDF text private and emits safe authored
runtime fields. The current export snapshot includes current pages and overlays;
odd spread partners are not exported. The original PDF remains separately retained.

## Decisions and observability

Decisions contain `allowed`, `actionCategory`, `reasonCode`,
`requiresConfirmation`, `sanitizedAction`. Codes are:
`allowed`, `invalid_action`, `invalid_target`, `unsupported_action`,
`source_target_not_editable`, `commercial_integrity_blocked`,
`source_integrity_violation`, `confirmation_required`, `mode_not_editable`,
`invalid_structure`, `stale_target`, `cross_tenant_target`.

Safe category counters (`studio_action_allowed`, `studio_action_blocked`,
`studio_action_confirmation_required`) use the configured Django cache with a
24-hour TTL. These are local diagnostics, not a durable metrics backend. Policy
logs contain catalog ID, category, action and reason, never private document text.
Compare category rejection ratios to detect future overblocking; a blocked action
is not automatically classified as an overprotection regression.
