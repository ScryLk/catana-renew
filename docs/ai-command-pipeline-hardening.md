# AI command pipeline hardening

## Reproduced regression

A failing test was written and run before the fix. `BaseAgent.process_stream('altere catálogo de produtos para catálogo de itens', {'active_spread_data': {'unit': 'pt'}})` returned the institutional political refusal. The test failed on the presence of `neutralidade institucional`.

The Studio endpoint guarded literal input in the orchestrator, `BaseAgent` appended project/document/Brand/RAG data, and `GeminiAIProvider` classified that flattened string again. The standalone `pt` party pattern matched the technical geometry unit.

## Trust boundaries

- Literal current user input: the provider gateway invokes `OrchestratorAgent.format_and_guard_request`. `RequirementParser` receives that literal input. Safe requests have one intent inspection; recoverable profanity is inspected again after cleaning within the same gateway.
- Application metadata: a bounded numeric spread-index projection is separately validated. Client-supplied catalog geometry, titles, selections and text indexes remain presentation data, not privileged instructions.
- External content: document text, Brand facts, RAG, attachments and history have explicit provenance and are JSON-quoted as untrusted data. Recognized instruction injections quarantine their entire section. History does not become current user intent or elevated SDK roles.
- System instructions: supplied by application agent code, with universal policy and data-boundary directives. Imported native geometry takes precedence; A4 is a new-page default.

The provider validates envelope identity, limits, metadata schema and context screening. No approval boolean, `skip_guardrails`, or caller-supplied trust bypass exists. Legacy raw-string provider calls use the same gateway. `build_user_prompt` remains compatible for existing callers, but the production envelope keeps the literal request separate. The mock's old marker splitting remains only for compatibility with legacy mock tests.

## Guard and provider behavior

Isolated PT/PL, `pt-BR`, `PT-400`, `PL Design` and `12pt` are permitted. Explicit voting/party intent stays blocked. Direct jailbreaks and dangerous requests cannot become authorized merely by adding catalog words. Profanity recovery remains useful for legitimate editing.

One older functional assertion expected a direct voting question followed by a catalog instruction to be normalized. It now asserts `BLOCKED/POLITICS`, strengthening that security assertion.

Supported text replacements use a deterministic planner in production and mock mode, without a model call. Other mock operations retain their existing removal/layout/pricing action schemas and present proposals, not fictional execution reports. Unsupported mock requests state the limitation. Real-provider failure reports `fallback_used`, provider, model and planner metadata. A partially failed model candidate cannot emit an executable patch; complete candidate output is buffered before emission. Logs contain error types/categories, not customer text or exception values.

## Imported text editing

The shared planner matches case, accent and whitespace variants. It resolves selected text, then the visible spread, then the bounded catalog index. Duplicate occurrences ask for clarification; an explicit `na página 2` prefix or suffix resolves the page. `troque para ...` targets a unique selected element. Existing layout/product/style command routing is preserved.

Example proposal:

```json
{"actions":[{"type":"update_text","action":"update_text","target":"page:1/element:text-1","params":{"find":"catálogo de produtos","replacement":"catálogo de itens","expectedText":"CATÁLOGO DE PRODUTOS"}}]}
```

The executor checks the real current state, editability, source visibility/crop safety, stale text, target identity, length and commercial integrity. Generic edits reject protected roles, authoritative product values and numeric/SKU/specification text. It changes only reconstruction text and the edited marker. Source PDF/snapshots, provenance, original text, font metadata, geometry, color and rotation remain unchanged. Existing undo, restore and save paths remain in use.

Action results include `action_id`, target, status and optional reason/value. Results distinguish applied, unchanged, missing, ambiguous, noneditable, invalid and integrity-blocked actions. Chat and toast success follow actual mutations. Transport failure cannot fall through to the unguarded local command executor. Server chat records remain proposals; client execution results confirm canvas changes and the existing catalog save persists them.

The browser regression verifies the exact request with `unit: pt`, actual rendered text, concise execution feedback, original text/provenance/snapshot preservation, reload persistence and restore. Its SSE/storage transport is a browser fixture; separate Django integration tests exercise the canonical gateway and planner with Brand/RAG/document context.

## Validation

Run with local development settings and an isolated PostgreSQL database; no paid Gemini calls, deployment or merge:

- Before changes: `SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python manage.py test api.tests_ai_provider_security api.tests_creative_overlays --keepdb --noinput` — 28 passed.
- Before fix: `... manage.py test api.tests_ai_command_pipeline --noinput` — expected failure reproducing the political refusal.
- Full backend: `DATABASE_URL=postgresql://agent@127.0.0.1:55432/postgres SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python backend/manage.py test api --noinput` — 488 passed, including document import/source integrity/private assets/creative/security suites. Subsequent focused checks cover the added page/context/API-boundary cases.
- `SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python backend/manage.py test api.tests_studio api.tests_ai_command_pipeline api.tests_functional_verification --noinput` — 67 passed after review changes. The final command planner module also passed all 20 cases.
- `npm test --prefix frontend` — 122 passed.
- `npm run build --prefix frontend` — passed TypeScript, font-registry check and production build; existing bundle-size warning remains.
- `npm run lint --prefix frontend -- --format json` — existing baseline: 248 errors, 20 warnings. New execution helper and tests have no findings.
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e --prefix frontend -- e2e/document-import.spec.ts` — 17 passed. The exact command case was also rerun after review changes.
- `git diff --check` — passed.

## Limits and review notes

The text index has a 32,000-character budget, at most 500 entries and 2,000 characters per entry; selected and visible text come first. Envelopes bound user input to 20,000 and presentation data to 48,000 characters. Very long blocks or omitted index entries may require selection/manual editing. Fuzzy replacement and implicit mass replacement are intentionally absent. Numeric/commercial detection is conservative and can reject editorial copy containing numbers; validated commercial workflows remain separate.

Recognized context-injection patterns are quarantined, and all remaining model context is treated as data. Live Gemini behavior was checked through SDK contract/failure fixtures, not a paid external call. General model-driven creative edits still require review under existing action and commercial policies. The change introduces no migration and does not rewrite retained source assets.

## PR publication

Implementation commit: `0d3fcff`, pushed on `fix/ai-guardrail-context-separation` from current `main`. Final security/provider/creative checks passed 48 tests; the latest focused backend run passed 67 and frontend run passed 122. Targeted ESLint for the new helper, tests and browser spec passed.

Both publication attempts were rejected by GitHub API access:

```text
gh pr create --repo ScryLk/catana-renew --base main --head fix/ai-guardrail-context-separation --title "Separate AI intent guards and safely edit imported catalog text" --body-file /tmp/catana-ai-command-pr.md
Post "https://api.github.com/graphql": Forbidden

gh api --method POST repos/ScryLk/catana-renew/pulls --input /tmp/catana-ai-command-pr.json --jq '.html_url'
Post "https://api.github.com/repos/ScryLk/catana-renew/pulls": Forbidden
```

No PR was created, merged or deployed; GitHub CI status could not be verified. Prepared PR title: **Separate AI intent guards and safely edit imported catalog text**. The implementation summary and validation above supply the review body. Open the published comparison at:

https://github.com/ScryLk/catana-renew/compare/main...fix/ai-guardrail-context-separation?expand=1

## PR #9 CodeQL follow-up

PR #9 now exists. Its check `112370111141` reported `Polynomial regular expression used on uncontrolled data` at `prompt_envelope.py`'s context scan. The role-tag alternative `<\s*/?\s*...` allowed two whitespace runs to overlap when the optional slash was absent, causing quadratic backtracking on `<` followed by many spaces.

The corrected alternative `<\s*(?:/\s*)?...` requires an actual slash before starting the second whitespace run. Opening/closing role tags, Unicode whitespace, case-insensitive matching, bracketed roles and directive detection retain their behavior. No guard, input limit or CodeQL check was disabled.

The timeout-backed regression failed before the fix at the 3-second bound. It now covers near-limit context, one million spaces, slash/no-slash cases and real quarantine behavior. A separate test preserves injection matches and rejects ordinary tags/technical PT/PL text.

Validation: `SECRET_KEY=local-test DEBUG=True /tmp/catana-venv/bin/python backend/manage.py test api.tests_ai_command_pipeline api.tests_ai_provider_security api.tests_creative_overlays --noinput` — 50 passed; `git diff --check` passed. GitHub CodeQL's new run remains the authority for clearing the alert.
