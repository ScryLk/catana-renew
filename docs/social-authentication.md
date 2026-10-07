# Social authentication consolidation

## Baseline

Audited latest main `3cf4b7dee608bccf258c4039d4d2fc30725a1f50` after fetch and fast-forward pull. Work is on `fix/clerk-google-social-auth-consolidation`. The session, token, organization and agent-policy hardening already on main is retained.

## Current Google Auth Flow

Before this change, main mounted ClerkProvider and ClerkAuthSync when configured, while AuthModal, Login and Register unconditionally mounted GoogleLoginButton. That component injected `accounts.google.com/gsi/client`, initialized GIS and forwarded a Google ID token to `authStore.googleLogin`, which called the legacy `/api/auth/google/` path. The same UI called legacy password and registration methods. The hardened store rejected those sign-in methods in Clerk mode, but recovery still posted to Django's legacy reset endpoints. Legacy public auth endpoints could also issue SimpleJWT in a Clerk backend.

| Baseline entry | SDK / credential | Backend / user and organizations | Persistence |
| --- | --- | --- | --- |
| Password, Clerk UI | Custom legacy form / intended SimpleJWT | Store rejects before token POST; no successful Clerk login | No new session |
| Google, Clerk UI | Standalone GIS / Google ID token | Store rejects legacy Google call; cannot establish Clerk session | GIS state could coexist with Clerk |
| Password, legacy | Custom form / SimpleJWT | `/api/auth/token/`, then verified `/api/profile/` and memberships | Legacy access hint plus HttpOnly refresh cookie |
| Google, legacy | GIS / Google ID token → SimpleJWT | `/api/auth/google/`, then profile and memberships | Same legacy lifecycle |

## Root Cause

The authentication UI did not dispatch by the configured authority. A Clerk session cannot be created by Catana's legacy Google credential exchange, and the hardened store correctly refused that exchange. The reported popup COOP warning alone does not establish a login failure or justify weakening headers.

## New Provider Architecture

| Mode / method | Authority and completion | Catana boot |
| --- | --- | --- |
| Clerk password / verification / recovery | Clerk SignIn widget | ClerkAuthSync → SDK token → backend numeric profile → authorized organizations → ready |
| Clerk registration | Clerk SignUp widget | Same canonical synchronization |
| Clerk Google | Clerk SDK redirect → `/auth/callback` → Clerk callback completion | Same canonical synchronization; no Google ID token exchange with Django |
| Legacy password / registration / recovery | Existing Django / SimpleJWT forms and endpoints | Existing verified legacy boot |
| Legacy Google | LegacyGoogleLoginButton / GIS → legacy Google endpoint | Same verified legacy boot |

An explicit `VITE_AUTH_PROVIDER` wins even when both providers' browser-safe IDs are present. Invalid explicit modes fail closed. An explicitly requested but unconfigured Clerk mode shows a configuration error and mounts no legacy UI. Existing unconfigured local development retains legacy inference; production preflight requires an explicit provider. Backend mixed compatibility is restricted to development/test.

## Clerk Google Integration

The installed `@clerk/clerk-react` version is **5.61.9**. Its installed TypeScript definitions support `useSignIn`, `useSignUp`, `authenticateWithRedirect`, `useClerk().handleRedirectCallback`, and SignIn/SignUp virtual routing. The shared ClerkGoogleAuthButton calls the matching Clerk resource with `strategy: oauth_google`, `redirectUrl: /auth/callback`, and `redirectUrlComplete: /studio`. A ref and loading state prevent concurrent starts. Cancellation, disabled strategies and other errors become controlled Portuguese messages; raw provider payloads never enter logs or UI. No legacy fallback occurs.

ClerkAuthCallback delegates state, nonce, PKCE, transfer, verification and session completion to Clerk. It runs once under StrictMode and provides a usable return-to-login action on failure. ClerkAuthSync remains the sole owner of subsequent Catana identity resolution. Google must be enabled in the Clerk instance; this repository and mocked tests cannot verify that dashboard setting. SDK configuration failures are reported without a legacy fallback. Configure `/auth/callback` and the deployed application origin according to the Clerk instance's redirect/origin settings.

The chosen SDK flow redirects the current browser on both phone and desktop. Catana neither opens OAuth popups nor implements window.postMessage or forces FedCM. The installed SDK owns the provider protocol; Google-side browser behavior requires a real signed-in smoke test.

## Password / Registration / Recovery

ClerkAuthExperience preserves the Catana logo, theme, responsive shell and desktop showcase. It uses styled Clerk SignIn/SignUp components for password, verification, MFA and signup rather than rebuilding credential protocols. The recovery entry renders Clerk SignIn and directs the user to its built-in password recovery option after entering their email. Old `/reset-password` links in Clerk mode enter this Clerk recovery experience and never submit a legacy uid/token. The modal's authenticated completion follows backend readiness, not OAuth initiation.

The actual `/login`, `/register` and `/forgot-password` app routes continue to use the Studio modal. The standalone Login/Register/ResetPassword exports also dispatch by provider, so reusing them cannot revive legacy authority in Clerk mode. Legacy UI is retained inside separate implementations. All legacy store mutation methods reject outside legacy mode; canonical mode also selects logout. Clerk logout calls the SDK, with a controlled error if SDK termination fails. Existing expired-session recovery remains distinct from an explicit logout.

## Legacy Compatibility

LegacyGoogleLoginButton is retained, typed and guarded; only explicit/inferred legacy mode can mount it. GIS is loaded only with a configured legacy client ID. The development mock is still confined to legacy development. Loading makes the rendered GIS area inert. Password, registration, cookie refresh, Google and legacy logout continue through the existing verified legacy pipeline. Real legacy Google verification now requires the intended client audience and strictly verified email.

Backend boundaries execute before authentication on legacy token/refresh/Google/register/reset/password/logout endpoints. Disabled endpoints cannot provision users, issue tokens, send reset mail, change passwords or blacklist sessions. Clerk webhook processing is disabled in legacy mode. No database migration or account deletion was added.

Existing Clerk subjects remain authoritative across sign-in methods. JWT and signed webhook creation share atomic reconciliation. Linking by email requires exactly one active, unlinked local user plus trusted verification evidence: signed JWT `email_verified` must be boolean true, or a signature-validated webhook primary email must be verified. Ambiguous, unverified or already-linked collisions return a generic identity-link-required error without overwrites or duplicate creation. Standard Clerk tokens may omit email claims; legacy migration then needs a signed verified webhook, suitable trusted claims or explicit migration. An unknown subject with no email cannot be linked to an existing legacy account by email; configure migration before inviting those legacy users. No account is merged from an unverified email string.

## COOP Investigation

Nginx's canonical TLS document server and Django's security default already used `same-origin-allow-popups`. The user supplied a live `curl -sSI https://usecatana.com.br` response dated `Wed, 07 Oct 2026 17:41:40 GMT` (14:41:40 Brasília time): HTTP/2 200, HTML served by nginx/1.31.6, and exactly one `cross-origin-opener-policy: same-origin-allow-popups`. HSTS, nosniff, XSS protection and the existing referrer policy were also present; the supplied response did not show CSP or X-Frame-Options. This verifies the existing deployed SPA document policy, not this PR's deployment.

Direct cloud curl was blocked by the proxy with CONNECT 403. A disposable local Nginx TLS integration test independently reproduced duplicate baseline COOP headers on a proxied API response and passed all four routes after the fix. It uses a temporary synthetic certificate trusted with `--cacert`; TLS verification stays enabled.

The warning's behavior after actual Clerk Google login is **not yet observed**: there are no configured live tenant credentials or signed-in staging browser here. Removing Catana's standalone GIS path eliminates the confirmed competing flow; it does not prove every Google/Clerk console warning disappears.

## Security Headers

The only header change is Nginx `proxy_hide_header Cross-Origin-Opener-Policy`, allowing the edge's existing policy to appear once on API/admin responses. The SPA document policy stays `same-origin-allow-popups`. No unsafe-none, global CORS allowance, CSP wildcard, frame-policy weakening or unrelated header change was introduced.

## Environment Variables

| Concern | Clerk | Legacy |
| --- | --- | --- |
| Frontend build mode | `VITE_AUTH_PROVIDER=clerk` | `VITE_AUTH_PROVIDER=legacy` |
| Browser-safe identity configuration | `VITE_CLERK_PUBLISHABLE_KEY` (supported NEXT_PUBLIC fallback) | `VITE_GOOGLE_CLIENT_ID` only when GIS is enabled |
| Backend authority | `AUTH_PROVIDER=clerk` | `AUTH_PROVIDER=legacy` |
| Provider verification | HTTPS instance `CLERK_JWKS_URL`; Clerk secret when using authenticated Clerk API JWKS; signed webhook secret if webhooks are used | `GOOGLE_CLIENT_ID` for real GIS verification; existing SimpleJWT/cookie settings |
| Google social connection | Enable Google in Clerk and configure its OAuth settings there | Configure legacy Google OAuth client |

`VITE_GOOGLE_CLIENT_ID`, Django GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not Clerk requirements. The current GIS ID-token verifier uses the client ID, not a client secret. Backend secrets belong only in backend/runtime configuration, never in Vite variables. Required production DEBUG, environment, allowed hosts, HTTPS and strong secret settings remain enforced.

## Production Build

Vite values are compiled into the bundle. `scripts/build_frontend_production.sh` performs a locked install, validates explicit mode and a safe decoded Clerk key host when needed, runs TypeScript/Vite, and records revision, provider and asset hashes. No legacy Google credentials are required for Clerk. Preflight checks matching build/runtime authority and revision, hashes, registry, backend production configuration, COOP repository configuration and Django security deployment checks. It no longer supplies a dummy SECRET_KEY or guesses AUTH_PROVIDER. See [deployment steps](deployment.md).

## Tests Added

- 34 provider/config routing tests across modal, standalone pages, reset, both modes, missing config and invalid explicit mode.
- 10 legacy GIS isolation/loading/mock tests; 12 store mutation/logout boundary tests.
- 9 Clerk social/widget/readiness/callback tests, including safe errors, cancellation, double-click and delayed real identity resolution.
- Backend provider, audience, verified-email collision, signed-webhook and PostgreSQL concurrency coverage in `api.tests_social_auth`; existing auth/Clerk assertions updated for strict configuration.
- 12 isolated Chromium browser cases using an explicit test-only Clerk alias, covering both providers, 320/390/desktop light/dark, retry, callback failure and numeric identity/org readiness. The production Vite configuration never aliases Clerk. Browser fixtures have separate caches and artifacts and do not replicate or validate Clerk-hosted form internals.
- COOP scope/mount/inheritance/deduplication checks and actual disposable Nginx TLS responses; additional safe build-environment cases.

CI/readiness separately reports AUTH PROVIDER ISOLATION, CLERK SOCIAL AUTH, LEGACY AUTH ISOLATION, COOP CONFIGURATION and FRONTEND AUTH BUILD CONFIG, plus isolated social browser QA. The existing session/workspace/protocol, full-suite, deterministic generation and security jobs remain.

## Commands Executed

```bash
git status --short
git branch --show-current
git fetch origin --prune
git switch main
git pull --ff-only origin main
git switch -c fix/clerk-google-social-auth-consolidation

npm test --prefix frontend                     # 228 passed in 24 files
npm run build --prefix frontend                # TypeScript / Vite passed
npm run lint --prefix frontend                 # Existing repository lint failures; see below

DATABASE_URL=postgresql://postgres:catana-local-test-only@127.0.0.1:55432/catana_social_auth_ci \
AUTH_PROVIDER=mixed DEBUG=True ENVIRONMENT=development \
PATH="$PWD/.venv/bin:$PATH" bash scripts/run_backend_checks.sh # 550 passed, no skips

node --test scripts/frontend_build_config.test.mjs scripts/check_coop_config.test.mjs # 10 passed
# Synthetic Clerk wiring: browser-safe test key, no live tenant network.
VITE_AUTH_PROVIDER=clerk \
VITE_CLERK_PUBLISHABLE_KEY=pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk \
bash scripts/build_frontend_production.sh
# Synthetic backend production configuration; not live OAuth acceptance.
AUTH_PROVIDER=clerk DEBUG=False ENVIRONMENT=production \
SECRET_KEY=catana-synthetic-preflight-only-long-key-abcdefghijklmnopqrstuvwxyz-123456789 \
ALLOWED_HOSTS=localhost \
CLERK_JWKS_URL=https://example.clerk.accounts.dev/.well-known/jwks.json \
SECURE_SSL_REDIRECT=True PATH="$PWD/.venv/bin:$PATH" bash scripts/deploy_preflight.sh

node scripts/check_coop_config.mjs             # Passed
bash scripts/test_nginx_coop.sh                # Four local TLS routes passed
python scripts/check_contract_parity.py        # Passed
node scripts/check_font_registry.mjs           # Passed

cd frontend
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
npx playwright test --config playwright.social-auth.config.ts # 12 passed
# Existing full browser suite uses the normal configuration and remains separate:
CI=true PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium \
CATANA_TEST_PYTHON=/workspace/catana-renew/.venv/bin/python npm run test:e2e
```

Local browser validation: the full existing suite passed 63 cases; a source edit during the Vite run triggered recorded HMR and detached the quota-import modal. That unchanged case passed on targeted rerun after edits stopped. The final PR workflow runs all 64 from a fresh checkout. The isolated social-auth suite passed all 12 cases after separating Vite caches and artifacts.

The Clerk-mode GIS regression was captured before production edits. Baseline Nginx reproduced two COOP headers on `/api/profile/`; the fixed config passes `/`, `/sign-in`, `/api/profile/` and `/admin/`. Repository lint was compared against an untouched archive of the audited main using the same installed tooling: baseline 223 errors / 21 warnings, changed tree 220 errors / 21 warnings, and no introduced findings. The three removed errors were untyped legacy GIS trust-boundary values. Focused ESLint on new auth/test code passes. The existing large Vite bundle warning remains.

## Files Changed

Changes are confined to authentication UI and store guards, backend provider/reconciliation boundaries, Nginx COOP deduplication, provider build/readiness checks, isolated browser fixtures and associated documentation. Studio action policy, document commands, commercial integrity and workspace execution are unchanged. GoogleLoginButton is renamed to LegacyGoogleLoginButton.

- `.github/workflows/ci.yml`
- `.github/workflows/production-readiness.yml`
- `.gitignore`
- `backend/.env.example`
- `backend/api/auth_provider.py`
- `backend/api/clerk_auth.py`
- `backend/api/tests_auth.py`
- `backend/api/tests_clerk.py`
- `backend/api/tests_social_auth.py`
- `backend/api/views.py`
- `backend/api/views_auth.py`
- `backend/api/views_clerk_webhook.py`
- `docker-compose.prod.yml`
- `docs/auth-session-architecture.md`
- `docs/deployment.md`
- `docs/social-authentication.md`
- `frontend/.env.example`
- `frontend/e2e/fixtures/clerkSdk.tsx`
- `frontend/e2e/social-auth.spec.ts`
- `frontend/playwright.config.ts`
- `frontend/playwright.social-auth.config.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/auth/AuthModal.tsx`
- `frontend/src/components/auth/ClerkAuthCallback.tsx`
- `frontend/src/components/auth/ClerkAuthExperience.test.tsx`
- `frontend/src/components/auth/ClerkAuthExperience.tsx`
- `frontend/src/components/auth/GoogleLoginButton.tsx`
- `frontend/src/components/auth/LegacyGoogleLoginButton.test.tsx`
- `frontend/src/components/auth/LegacyGoogleLoginButton.tsx`
- `frontend/src/components/auth/socialAuthError.ts`
- `frontend/src/pages/Login.tsx`
- `frontend/src/pages/Register.tsx`
- `frontend/src/pages/ResetPassword.tsx`
- `frontend/src/services/authConfig.ts`
- `frontend/src/services/authProviderRouting.test.tsx`
- `frontend/src/store/authProviderIsolation.test.ts`
- `frontend/src/store/authStore.ts`
- `frontend/vite.social-auth-test.config.ts`
- `nginx/nginx.conf`
- `scripts/check_coop_config.mjs`
- `scripts/check_coop_config.test.mjs`
- `scripts/deploy_preflight.mjs`
- `scripts/deploy_preflight.sh`
- `scripts/frontend_build_config.mjs`
- `scripts/frontend_build_config.test.mjs`
- `scripts/test_nginx_coop.sh`

## Remaining Risks

Live Clerk Google enablement and tenant OAuth/origin/callback settings must be confirmed. Run real login/signup/recovery/logout in a signed-in staging browser on desktop Chrome and a phone; inspect the document and popup/redirect trace to determine whether the reported warning remains. This environment has no ready live Clerk/Google credentials. Mocked SDK tests establish Catana boundaries and readiness, not provider cookie compatibility or Clerk-hosted UI internals. WebKit is not in the existing browser matrix. Review legacy identity migration claims/webhooks before migrating users with email collisions. Global lint remains pre-existing technical debt. No production deployment, merge, force push, credential commit or rotation occurred.

## Production Gate

PR review readiness is distinct from deployment readiness. Automated results and the final commit's CI/CodeQL status must be checked in the PR. Live staged provider acceptance remains a deployment gate.
