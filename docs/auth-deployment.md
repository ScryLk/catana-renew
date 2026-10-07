# Coherent production auth builds

Vite embeds VITE_* values when it builds JavaScript. Production Compose mounts frontend/dist into Nginx; `docker compose up --build` builds the backend, not the frontend. The audited deploy/sync_to_vps.sh previously ran npm build locally and copied dist. A runtime container variable cannot repair a bundle built without Clerk.

## Before deployment

Configure frontend/.env.production.local (ignored) or process variables:

- `VITE_AUTH_PROVIDER=clerk` (or explicit `legacy`).
- `VITE_CLERK_PUBLISHABLE_KEY` for Clerk; the key's format/encoded host is validated without logging it.
- Same-origin API URL in production as before.

Configure the backend securely with matching `AUTH_PROVIDER`, production ENVIRONMENT, DEBUG=False, strong SECRET_KEY, database, explicit hosts and deployment TLS/cookie settings. Clerk requires HTTPS CLERK_JWKS_URL; the api.clerk.com JWKS endpoint additionally needs CLERK_SECRET_KEY. A public instance-specific JWKS URL need not use a secret. The preflight checks configuration, not live JWKS connectivity or staging credentials.

From the intended clean revision:

```bash
bash scripts/build_frontend_production.sh
AUTH_PROVIDER=clerk PATH="$PWD/.venv/bin:$PATH" bash scripts/deploy_preflight.sh
```

The build performs npm ci, validates production Vite environment, builds, and records commit, auth mode, timestamp and SHA-256 hashes of index/assets in dist/build-metadata.json. The full preflight rejects missing or altered dist, revision mismatch, frontend/backend mode mismatch, missing shared registry, invalid backend auth settings and Django deployment security warnings. It never prints tokens, keys or Authorization headers. Supply production backend settings to the local preflight; the development .env deliberately fails it.

Deploy the frontend and backend from that same revision. For a transferred checkout without .git, explicitly supply EXPECTED_COMMIT and validate the metadata before activation. The sync script invokes build and preflight before syncing and excludes .env files, virtualenvs and SQLite data so local development state does not replace production state. Runtime environment settings remain managed on the server. Nginx's same-origin /api routing and production CORS allowlist are unchanged.

CI validates safe synthetic Clerk key wiring, tests missing-key rejection and backend auth requirements, and builds with a synthetic test key without Clerk network calls. This does not validate a real signed-in production browser session. Run a staging reload/account-switch/expiry smoke with real test-tenant configuration before deploying.

No VPS deployment or credential rotation is part of this change. Keep CodeQL; its pull-request workflow must complete before merge.

The full untagged `manage.py check --deploy` also runs the existing OpenAPI schema checks, which currently emit unrelated schema warnings. The deploy gate deliberately runs all Django security deployment checks (`--tag security`) alongside the explicit Catana config validation; schema cleanup is separate work.
