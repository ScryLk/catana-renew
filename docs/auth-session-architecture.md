# Authentication and workspace sessions

## Baseline audit

Audited main `d945ec7dfc45b8fb474ab7cc04d80f2eeb32dd4d`, after fetch and fast-forward pull. Work belongs to `fix/auth-session-agent-protocol-hardening`.

| Component | Existing responsibility / auth source | Persisted state | Confirmed race or scope problem | Change |
| --- | --- | --- | --- | --- |
| App | Calls checkAuth on mount | None | Runs alongside ClerkAuthSync and Studio boot | Only owns legacy boot |
| ClerkAuthSync | SDK user/token synchronization | access_token; 45-second token writes | Declares signed-in before token/backend identity; redundant polling | Single-flight identity initialization; SDK getter in runtime |
| authStore | Domain user and login | user and isAuthenticated | Both Clerk paths map a string ID to 1; cached boolean authorizes boot | Backend profile ID; nonpersisted lifecycle |
| api | Axios bearer attachment and 401 recovery | Clerk and legacy access_token share a key | Clerk failure falls back to old JWT; queued retries are inconsistently tagged | Explicit modes; bounded shared refresh; epoch checks |
| organization context | Organization and sede selection | Global active_organization | First org overwrites selection on refresh | User-scoped ID hint verified against memberships; global mirrors only for existing UI readers |
| PrivateRoute | Management-route auth checks | None | Separately invokes checkAuth/autoLogin, racing App on each reload | Pure readiness gate, no initialization side effects |
| KatanaStudio | Brands/catalog sync and detail restore | Reads user-only last-active key | Starts on cached boolean; restore races list sync | Gates on readiness and validates active list before detail |
| studioStore | Document, history, roles, chat | User-only session/last-active keys | Writes requested ID before load; 401 can fall through to local data | v2 user+org keys; success-only writes; no numeric-ID local fallback |
| StudioSidebar | Quota sync | Runtime quota | Mounted effects can fetch on cached boolean | Gates on readiness; clears quota on scope changes |
| Agent transport | Direct fetch plus its own refresh | Shared old bearer storage | Separate refresh algorithm; prose patch recovery | Shared streaming helper; stable logical request UUID |
| Backend stream | Buffers model and validates actions | Assistant text and metadata | Reattaches private fenced JSON after validation; truncated fence leaks | Parser terminates private protocol before SSE and persistence |

A–T from the request were confirmed, except that 403/404 already refused mock fallback (they still left the stale hint); numeric IDs on other failures fell through. Quotas were already organization scoped in the sidebar. The current store already had request counters and tenant/document epochs; those are extended rather than replaced. The backend already buffered model chunks before sending text, so this change does not remove an existing public token-by-token stream.

## Lifecycle and ownership

`unknown → loading → resolving_identity → ready`, with `signed_out`, `refreshing`, and recoverable `error` outcomes. `isAuthReady` accepts ready/refreshing for an already resolved identity. No authorization state or identity is restored from Zustand persistence, including old version-0 data. `isAuthenticated` remains a UI compatibility field, not permission to start protected boot.

ClerkAuthSync is the only Clerk boot owner. It configures the SDK token getter, obtains a token, then resolves `/api/profile/` and `/api/organizations/`. StrictMode invocations share the initialization promise. Catana `User.id` is the positive integer returned by Django; `externalAuthId` carries Clerk's string subject. Identity resolution must finish before readiness. An empty authorized organization list resolves to a null organization; Studio does not bootstrap an organization workspace in that case.

App owns legacy boot through a single-flight checkAuth. Legacy login/refresh also verifies the backend profile and organization memberships. Clerk mode never falls back to SimpleJWT. Explicit production provider configuration is `VITE_AUTH_PROVIDER` at build time and `AUTH_PROVIDER` at Django runtime. Development defaults retain existing mixed-backend compatibility. The production preflight requires an explicit clerk or legacy mode.

## Tokens and recovery

Clerk tokens live in the SDK and runtime memory; confirmed Clerk initialization removes obsolete access_token/refresh_token keys. There is no refresh polling. Normal requests obtain a token through the SDK; concurrent 401s share one forced refresh. Each original request retries once with the refreshed token, including queue members. A late 401 for an older token reuses the refreshed token. Another 401 becomes recoverable error and blocks further protected requests.

Legacy access-token persistence remains for compatibility; HttpOnly cookies are the refresh authority. Refresh calls include credentials even without a local refresh_token. Rotated cookie responses remove obsolete local refresh hints. Clerk and legacy requests share the same refresh coordinator without competing providers.

Identity and organization epochs reject late requests. Studio document epochs protect asynchronous document operations; scope resets abort the chat request and clear document, chat, undo/redo, role, palette, selection, and modal runtime state. Offline network failures do not invent a new identity or load local data for a server catalog. Reconnection refreshes the selected provider.

## Organization and workspace storage

Active organization hint: `catana:auth:v2:user:<CatanaID>:activeOrganization`. It stores an ID, restored only if `/api/organizations/` authorizes it. Organization selection goes through membership validation. Existing UI readers retain current active_organization/active_sede mirrors; they are cleared at identity transitions. Refresh preserves a still-authorized selection.

Workspace namespace: `catana:studio:v2:<CatanaID>:<organizationID>:<key>`.
Keys include `last_active_catalog`, `project:<catalogID>`, `brand_cache`, `brands`, `unlinked_catalogs`, and `custom_roles`. Anonymous previews use explicit anonymous/none scopes. Old session and restore keys are ignored, not copied or mass deleted. Old fake-user-1 brand migration suggestions are suppressed. Correctly scoped caches for other users remain intact on logout.

## Restoration and errors

Protected boot sets scope, synchronizes brands/catalogs, and checks the last-active hint against the active organization catalog list. A missing/archived catalog is removed from that scope's hint without a detail request. Detail 200 must match the active scope before hydration and hint persistence. Stale operations cannot overwrite a switched workspace.

401 goes through shared recovery and does not discard the hint. 403/404 clear only the matching scoped hint and refresh the list. Numeric backend IDs never load local copies on any error. Brand failures have their existing retry state; catalog sync failures expose a retry action; quota failure does not block an authorized catalog. Explicit local/demo string IDs retain separate local behavior.

## Provisioning

The existing unique clerk_user_id constraint chooses the winner for first-login provisioning. User, organization, sede and quota are created in one transaction; a uniqueness loser reuses the winner, and workspace failures roll back the user. Email reconciliation cannot overwrite an already linked Clerk subject. Existing JWT verification and tenant isolation remain in force.
