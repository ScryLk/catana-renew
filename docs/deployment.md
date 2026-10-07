# Authentication deployment checks

Review [social authentication](social-authentication.md) and [session deployment configuration](auth-deployment.md) before deploying. This change does not deploy or merge automatically.

Set the frontend build authority explicitly to match backend runtime authority. Clerk builds need a publishable key; they do not need legacy Google credentials. Enable Google in the Clerk instance and configure the deployed application origin and `/auth/callback` according to that instance's OAuth settings. Store backend provider secrets in the deployment environment, never in frontend variables.

```bash
# Run with the intended browser-safe build environment already configured:
bash scripts/build_frontend_production.sh

# Run with the intended production backend environment and explicit AUTH_PROVIDER:
PATH="$PWD/.venv/bin:$PATH" bash scripts/deploy_preflight.sh

# Verify the effective HTML document header after any authorized deployment:
curl -sSI https://usecatana.com.br
curl -sSI https://usecatana.com.br/login
# Also inspect proxied headers for exactly one coherent policy:
curl -sSI https://usecatana.com.br/api/profile/
```

Expected document COOP is exactly one `Cross-Origin-Opener-Policy: same-origin-allow-popups`. In browser Network, inspect the top-level Document response, not only API requests. Nginx suppresses upstream COOP and supplies the canonical edge policy once. Keep HSTS, nosniff, frame restrictions and existing referrer policy. Do not disable TLS verification or weaken COOP to hide a console warning.

In a real staging browser with Google enabled, test login, new signup, cancellation, disabled-provider error, password sign-in, recovery, required verification/MFA and sign-out. Check desktop Chromium and mobile rotation/theme. Successful OAuth must reach the same backend numeric user and authorized organization, then Studio readiness. Confirm Catana has not injected `accounts.google.com/gsi/client` and has not called `/api/auth/google/`, `/api/auth/token/`, `/api/register/` or legacy reset endpoints in Clerk mode. Clerk's own Google requests are SDK-owned and are not Catana's legacy integration.

Inspect Google redirect/SDK traces if the warning persists. The verified existing production document policy alone does not prove warning-free OAuth. Compare the actual deployed build metadata, revision and provider with the intended artifact. No live credentials or OAuth acceptance are simulated by the synthetic preflight.

Test legacy mode separately with its own client ID and runtime authority if it remains a supported deployment. Never enable production mixed mode. Before moving legacy users to Clerk, ensure subject mappings or trusted verified-email claims/signed webhook reconciliation exist. An unverified/ambiguous email collision fails closed and requires explicit migration.
