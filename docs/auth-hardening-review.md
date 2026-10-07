# Auth session and agent protocol hardening review

## Baseline Audit

Fetched and fast-forwarded main at `d945ec7dfc45b8fb474ab7cc04d80f2eeb32dd4d` before creating `fix/auth-session-agent-protocol-hardening`. The [architecture audit](auth-session-architecture.md) maps boot owners, credentials, persistence, scope, and confirmed races. Existing ActionPolicyRouter, registry, commercial integrity and source-lineage protection were audited and retained.

## Regression Findings

Before fixes, five new frontend assertions failed: Clerk identity became numeric user 1, readiness did not exist, old authentication booleans survived persistence, workspace state crossed organization boundaries, and raw/truncated machine prose rendered. Two new backend SSE assertions failed because private patch fences remained in public/stored prose and malformed output lacked a controlled protocol error. Additional tests cover the third boot owner in PrivateRoute, stale identity responses (including delayed next-account SDK tokens), concurrent refresh, interruption, and concurrent provisioning.

## Bugs Fixed

| File / function | Cause | Impact / resulting behavior |
| --- | --- | --- |
| authStore / syncClerkUser, resolveIdentity | String Clerk ID mapped to 1; early cached auth | Verified backend numeric identity and memberships precede readiness |
| ClerkAuthSync / initializeClerkSession | Competing effects, token polling | One Clerk initialization owner and shared StrictMode promise |
| App, PrivateRoute, KatanaStudio | Three independent boot paths | App initializes legacy; route and Studio effects wait for readiness |
| authTokenProvider, api interceptors | Stale Clerk JWT fallback; independent queues | SDK authority, shared forced refresh, one retry and epoch checks |
| workspaceContext / resolveWorkspaceContext | Global organization selection trusted | User-scoped hint validated against backend memberships |
| studioStore / initializeWorkspace, loadExistingCatalog | Early hint write, list/detail race, local numeric fallback | Authorized list first, successful hydration before hint, scope-safe errors |
| brandService and studioStore storage | User-only cache namespace, historical fake user 1 | User plus organization v2 namespace; no fake-user-1 migration |
| views_studio / chat stream, agent_output | Machine protocol reattached to prose | Human SSE and stored content are separate from validated actions |
| AgentChatStream / displayMessages | Old malformed replies displayed verbatim | Defensive suppression of complete/partial private protocol |
| studioStore / sendMessageToAgent | Separate streaming auth; prose action recovery | Shared provider, stable request UUID, structured events only, execution feedback after save |
| clerk_auth / provision_local_user_from_clerk | Nonatomic first-login workspace | Unique identity winner with atomic organization/sede/quota creation |
| deploy/sync_to_vps.sh and build/preflight scripts | Build environment unverified; machine-specific path | Explicit provider, validated Vite configuration, asset/revision metadata and safe preflight |

## Authentication Architecture

`unknown → loading → resolving_identity → ready`; signed_out, refreshing and recoverable error are explicit. Only ready/refreshing permit protected effects. Persisted booleans and cached users cannot authorize boot. See [architecture](auth-session-architecture.md).

## Clerk Identity

The SDK supplies its string subject and token; authenticated `/api/profile/` supplies the real Catana numeric ID, and `/api/organizations/` supplies memberships. No numeric-1 fallback exists. Backend provisioning is atomic and tested with two concurrent PostgreSQL transactions.

## Token Strategy

Clerk uses the SDK and runtime memory, clears obsolete local bearer keys, and never falls back to legacy JWT. Explicit legacy mode retains compatible access storage; credentialed refresh uses HttpOnly cookies and removes obsolete local refresh hints after rotation. No token polling was added.

## 401 Recovery

Axios and streaming share one refresh flight and retry each request once. Late old-token failures reuse the new token. Identity/organization epochs discard stale responses. A streaming retry preserves the request UUID/body and occurs only before SSE consumption; interrupted streams never automatically replay.

## Organization Isolation

Restore `catana:auth:v2:user:<CatanaID>:activeOrganization` only when current memberships authorize it. Selection validates membership and invalidates request epochs. Workspace changes reset document/chat/history/roles/palette/selection state and abort active chat. Existing UI mirrors are cleared at identity transitions.

## Workspace Persistence

`catana:studio:v2:<CatanaID>:<organizationID>:<key>` contains project, last-active, brand, unlinked-catalog and custom-role cache state. Historical user-1 caches are untrusted. Other users' scoped caches survive logout.

## Catalog Restoration

Studio waits for identity/token readiness, syncs active catalog lists, then validates the hint before GET. Success must match scope. 401 preserves the hint and recovers through auth; 403/404 remove only the matching scoped hint and refresh the list. Numeric server IDs never fall back to browser/demo data on failure.

## Agent Protocol

Human token events and stored prose contain only readable text. Structured patch events reach the existing action executor once, even if done includes a compatibility copy. ActionResult and persistence determine success feedback. See [protocol](studio-agent-protocol.md).

## Malformed Patch Handling

A truncated `json:patch` fence containing `{"actions":[` produces a readable retry message, protocol_error metadata and no executable patch. Invalid JSON, unclosed/multiple blocks and raw known private markers are suppressed. Old stored replies receive a defensive frontend filter.

## Action Policy Integration

ActionPolicyRouter and `shared/studio-actions.json` are unchanged and authoritative. Existing action schema, confirmations, tenant access, source lineage, imported text and commercial protections remain tested. No prose parser authorizes execution.

## Production Build

`build_frontend_production.sh` runs npm ci, validates explicit Vite provider/key wiring, compiles TypeScript/Vite, and records revision/mode/asset hashes in ignored dist metadata. Vite embeds values at build time; runtime container variables cannot repair an incorrectly built bundle. See [deployment](auth-deployment.md).

## Deployment Preflight

Checks dist existence/hash/revision, matching auth modes, shared registry, explicit backend production mode, strong secret, hosts, HTTPS JWKS/required Clerk API secret, and Django deployment security checks. It emits no credential values. Local preflight used synthetic configuration and performed no production activation.

## CI / Workflows

Added auth-session-contracts to PR CI and production-readiness, with PostgreSQL and independent auth, workspace, protocol, backend-config and frontend-build-env outcomes. Production-readiness reports each outcome. Existing backend/frontend/build/contracts/determinism and CodeQL gates remain.

## Tests Added

- authSession: backend identity, nonauthoritative persistence, mode separation and offline identity preservation.
- authTokenProvider: cold boot, simultaneous 401, bounded failure, safe streaming retry and stale account refresh.
- ClerkAuthSync and PrivateRoute: single initialization, membership readiness, stale resolution and pure route gates.
- workspaceSession: per-organization cache isolation, readiness, untrusted legacy hints, successful restore and scoped errors/late responses.
- AgentChatStream and agentProtocol: rendering, nested action/delegation suppression, no false success for empty protocol replies, and complete/partial/raw protocol suppression.
- tests_agent_protocol: valid policy-routed actions, malformed SSE/persistence, atomic provisioning/concurrency and config requirements.
- frontend_build_config: missing/malformed configuration and synthetic Clerk wiring without network calls.

## Commands Executed

Final validation commands and results are recorded below; synthetic fixture values are not production credentials.

```bash
# 531 tests passed on PostgreSQL, including concurrent first-login provisioning.
DATABASE_URL=postgresql://postgres:catana-local-test-only@127.0.0.1:55432/catana_auth_ci \
PATH="$PWD/.venv/bin:$PATH" bash scripts/run_backend_checks.sh

# 163 tests passed in 20 frontend files.
npm test --prefix frontend

# TypeScript and Vite production build passed.
VITE_AUTH_PROVIDER=clerk \
VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk \
bash scripts/build_frontend_production.sh

node --test scripts/frontend_build_config.test.mjs # 3 passed
python scripts/check_contract_parity.py            # passed
node scripts/check_font_registry.mjs               # passed
.venv/bin/python scripts/check_generative_invariants.py # passed: hash seeds 1,42,999
bash -n scripts/build_frontend_production.sh scripts/deploy_preflight.sh deploy/sync_to_vps.sh

git diff --check # passed

# Synthetic production env: provider clerk, DEBUG=False, production, strong test
# SECRET_KEY, localhost allowlist, HTTPS instance JWKS, SECURE_SSL_REDIRECT=True.
PATH="$PWD/.venv/bin:$PATH" bash scripts/deploy_preflight.sh # passed with those env settings

PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
CATANA_TEST_PYTHON="$PWD/.venv/bin/python" npm run test:e2e --prefix frontend
```

Browser validation: the broad run passed 61 cases and exposed three fixture boot races (desktop shortcuts, generation progress and tablet rendering). Those fixtures now wait for workspace readiness; all three passed on a clean server. Both real imported-document API cases passed again after execution was deferred until stream completion. The PR browser workflow reruns the entire 64-case suite.

```bash
# 3 passed after fixture correction.
cd frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
CATANA_TEST_PYTHON=/workspace/catana-renew/.venv/bin/python \
npx playwright test e2e/responsive.spec.ts \
  --grep 'desktop Studio preserves|generation progress keeps|tablet catalog fits' \
  --workers=1 --reporter=line --output=/tmp/hardening-clean-layout-browser

# 2 real API cases passed after the incomplete-stream regression fix.
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
CATANA_TEST_PYTHON=/workspace/catana-renew/.venv/bin/python \
npx playwright test e2e/document-import.spec.ts \
  --grep 'real private PDF|eight imported pages' \
  --workers=1 --reporter=line --output=/tmp/hardening-final-stream-browser
```

## Files Changed

- `.github/workflows/ci.yml`
- `.github/workflows/production-readiness.yml`
- `backend/.env.example`
- `backend/api/apps.py`
- `backend/api/auth_config.py`
- `backend/api/checks.py`
- `backend/api/clerk_auth.py`
- `backend/api/services/agent_output.py`
- `backend/api/tests_agent_protocol.py`
- `backend/api/views_studio.py`
- `backend/catana_back/settings.py`
- `deploy/sync_to_vps.sh`
- `docs/auth-deployment.md`
- `docs/auth-hardening-review.md`
- `docs/auth-session-architecture.md`
- `docs/studio-agent-protocol.md`
- `frontend/.env.example`
- `frontend/e2e/brand-intelligence.spec.ts`
- `frontend/e2e/document-import.spec.ts`
- `frontend/e2e/responsive.spec.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/ContextSelector.tsx`
- `frontend/src/components/auth/ClerkAuthSync.test.tsx`
- `frontend/src/components/auth/ClerkAuthSync.tsx`
- `frontend/src/components/auth/PrivateRoute.test.tsx`
- `frontend/src/components/auth/PrivateRoute.tsx`
- `frontend/src/components/studio/AgentChatStream.test.tsx`
- `frontend/src/components/studio/AgentChatStream.tsx`
- `frontend/src/components/studio/StudioSidebar.tsx`
- `frontend/src/main.tsx`
- `frontend/src/pages/KatanaStudio.tsx`
- `frontend/src/pages/Organizations.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/authConfig.ts`
- `frontend/src/services/authTokenProvider.test.ts`
- `frontend/src/services/authTokenProvider.ts`
- `frontend/src/services/brandService.ts`
- `frontend/src/services/documentImportService.test.tsx`
- `frontend/src/services/organizationService.ts`
- `frontend/src/services/workspaceContext.ts`
- `frontend/src/store/authSession.test.ts`
- `frontend/src/store/authStore.ts`
- `frontend/src/store/studioStore.ts`
- `frontend/src/store/workspaceSession.test.ts`
- `frontend/src/utils/agentProtocol.test.ts`
- `frontend/src/utils/agentProtocol.ts`
- `scripts/build_frontend_production.sh`
- `scripts/deploy_preflight.mjs`
- `scripts/deploy_preflight.py`
- `scripts/deploy_preflight.sh`
- `scripts/frontend_build_config.mjs`
- `scripts/frontend_build_config.test.mjs`

## Remaining Risks

Live Clerk tenant credentials and a signed-in staging browser are required to verify real JWKS/network/expiry behavior before deployment. Local tests use mocked SDK identity and synthetic keys; no claim of live production auth validation is made. Request IDs bound safe automatic auth retry and frontend duplicate execution, but are not a persistent server ledger for arbitrary manual POST replays. Existing untagged Django deploy checks emit unrelated OpenAPI schema warnings; the preflight runs security-tagged deployment checks plus explicit Catana config validation. Vite still reports an existing large bundle warning. GitHub CI and CodeQL results must be checked before merge. No production deployment, merge, force push or credential rotation occurred.
