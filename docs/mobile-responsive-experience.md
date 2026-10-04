# Catana mobile-first responsive experience

Repository: `ScryLk/catana-renew`.
Branch: `feat/mobile-first-responsive-experience`, based on `origin/main` (`7cf6d37`).
Implementation is isolated in `/workspace/catana-mobile`; existing production/security changes in `/workspace/catana-renew` are preserved. No merge or deployment is included.

## Mobile Audit

| Finding before implementation | Severity | Resolution |
| --- | --- | --- |
| Repeated fixed desktop rail/header offsets on management routes | P1 | Shared protected shell; rail removed below 1024px, bottom navigation below 768px |
| Search and notification panels wider than narrow phones | P1 | Search sheet and bounded popovers |
| Sidebar + 420px CoPilot + canvas concurrently on phone | P1 | Drawer and mounted primary panes |
| Canvas/reader fixed publication size clipped on phone | P1 | ResizeObserver fit, single page, separate presentation zoom |
| Tablet canvas padding exceeded measured fit margin | P1 | Compact canvas uses matching 12px padding; independent local-overflow regression |
| Tables without a narrow-screen reading model | P1 | Labeled record cards |
| Modal focus, Escape, scroll and landscape dimensions inconsistent | P1 | Shared Radix dialog surfaces and bounded scroll regions |
| Inbox reserved desktop rail and used static viewport height | P1 | Shared shell and dynamic viewport height |
| Small or hover-only media/editor controls | P2 | Touch targets and visible compact actions |
| Generation progress header/preview crowded on compact devices | P2 | Wrapping header, live status/console first on phone, desktop visual preview retained at 640px+ |
| Long first-session Studio splash | P2 | 600ms compact splash; skipped for reduced motion |
| Vite media proxy intercepted `/media` SPA route | P1 | Proxy only matches `/media/…` assets |

Audit covered App, LandingPage, Dashboard, UserCatalogs, Products/CreateProduct, Categories, MediaLibrary, Organizations, Inbox, SearchResults, Explore, PublicCatalogReader, Header/Sidebar and Studio shell, sidebar, home, CoPilot, input, chat stream, workspace, toolbar, viewport, filmstrip, product drawer and editor dialogs.

## Responsive Architecture

Phone: <768px. Tablet: 768–1023px. Desktop: >=1024px. CSS owns layout; `useResponsiveLayout` owns conditional interaction behavior with cleaned-up matchMedia subscriptions. One `ViewportFoundation` tracks visualViewport changes, dynamic height and safe areas; browser pinch zoom is preserved. Shared `ResponsiveAppShell` owns protected management navigation and removes page-specific offset duplication. `usePublicationFit` observes the actual available pane and only scales presentation. No catalog/store schema, commercial calculation, canonical document coordinates, backend contract or public route was changed.

## Catana Studio Mobile

Phone Assistant/Catalog tabs keep both working panes mounted, retaining prompt, conversation, attachments, page selection and document state. Keyboard tab navigation follows Arrow/Home/End. Sidebar opens on demand in a modal drawer. CoPilot uses available width; rare actions move into More. The toolbar prioritizes page navigation, fit and zoom; More retains editing, undo/redo, palette, sharing and export. Filmstrip selects individual pages with horizontal touch scrolling. Tablet retains assistant plus fitted single page with a collapsed drawer. Desktop shortcuts and multi-page presentation remain available. Phone zoom has independent state so resizing does not rewrite desktop zoom. Canonical pages remain 490×693 and publication data is unchanged by rotation. ProductDrawer and editor dialogs scroll within the active viewport. Generation cancellation/editor controls remain reachable on compact screens.

## Management Mobile

Dashboard: wrapping stats/actions and labeled recent catalog records. Catalogs/Products: labeled phone records with reachable actions. CreateProduct: single-column fields and image controls; decimal/numeric input modes. Categories: wrapping header and record layout. Media: wrapping controls, visible touch actions and an explicit open-file action. Organizations: stacked cards/actions. Inbox: one list/detail pane on phone with Back; full available viewport. Search/Explore: bounded search, wrapping filters and compact tabs. Shared bottom destinations: Home, Products, Catalogs, Messages, More; More retains Studio, Explore, Media, Categories, Organizations, profile/preferences and support/transparency destinations. Shared chrome and Dashboard follow light/dark theme.

## Public Reader Mobile

Single page below 1024px; desktop spread preference remains separate. Fit uses actual available width/height; page position survives rotation. Next/previous, page slider and horizontal swipe at fit zoom are supported. Zoom is scrollable within the publication viewport; swipe does not steal navigation while zoomed. Native pan/pinch remains available. Product sheet and named product dialog expose real catalog products on touch. Sharing/fullscreen handlers and `/view/:id` / `/c/:id` routes and metadata remain intact.

## Accessibility

Named dialogs, Radix focus trap/background scroll lock/focus return, Escape dismissal, removed conflicting Skills autofocus so focus returns to the original control, nondismissible required login, labeled icon actions, keyboard-operable inbox records, roving Studio tabs, 44px primary touch targets, 16px mobile form text, safe-area padding, reduced motion and image lazy decoding. Essential media actions do not require hover. This is functional keyboard/browser verification, not a WCAG certification or screen-reader audit.

## Files Changed

- `.github/workflows/responsive-browser.yml`
- `.gitignore`
- `docs/mobile-responsive-experience.md`
- `frontend/e2e/responsive.spec.ts`
- `frontend/index.html`
- `frontend/package-lock.json`
- `frontend/package.json`
- `frontend/playwright.config.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/ContextSelector.tsx`
- `frontend/src/components/Header.tsx`
- `frontend/src/components/QuickActions.tsx`
- `frontend/src/components/RecentCatalogs.tsx`
- `frontend/src/components/Sidebar.tsx`
- `frontend/src/components/StatsCards.tsx`
- `frontend/src/components/auth/AuthModal.tsx`
- `frontend/src/components/explore/ExploreHeader.tsx`
- `frontend/src/components/layout/ResponsiveAppShell.tsx`
- `frontend/src/components/layout/ViewportFoundation.tsx`
- `frontend/src/components/media/MediaCard.tsx`
- `frontend/src/components/mobile/MobileBottomNavigation.tsx`
- `frontend/src/components/mobile/MobileSheet.tsx`
- `frontend/src/components/mobile/ResponsiveModal.tsx`
- `frontend/src/components/search/GlobalSearchDropdown.tsx`
- `frontend/src/components/studio/AccountSettingsModal.tsx`
- `frontend/src/components/studio/AgentChatStream.tsx`
- `frontend/src/components/studio/AgentCoPilot.tsx`
- `frontend/src/components/studio/AgentInputBar.tsx`
- `frontend/src/components/studio/BrandModal.tsx`
- `frontend/src/components/studio/CanvasTopToolbar.tsx`
- `frontend/src/components/studio/CatalogCanvasWorkspace.tsx`
- `frontend/src/components/studio/CatalogGenerationExperience.tsx`
- `frontend/src/components/studio/CatalogGenerationModal.tsx`
- `frontend/src/components/studio/EditorialCouncilModal.tsx`
- `frontend/src/components/studio/ExportCatalogModal.tsx`
- `frontend/src/components/studio/ImportCatalogModal.tsx`
- `frontend/src/components/studio/LogoAreaSelectorModal.tsx`
- `frontend/src/components/studio/MiniPageThumbnail.tsx`
- `frontend/src/components/studio/NewCatalogModal.tsx`
- `frontend/src/components/studio/PageFilmstrip.tsx`
- `frontend/src/components/studio/PaletteManagerModal.tsx`
- `frontend/src/components/studio/ProductDrawer.tsx`
- `frontend/src/components/studio/RoleManagerModal.tsx`
- `frontend/src/components/studio/SkillsCatalogModal.tsx`
- `frontend/src/components/studio/SpreadViewport.tsx`
- `frontend/src/components/studio/StudioExcelImportModal.tsx`
- `frontend/src/components/studio/StudioHomeChat.tsx`
- `frontend/src/components/studio/StudioMobileNavigation.tsx`
- `frontend/src/components/studio/StudioPhoneCanvasToolbar.tsx`
- `frontend/src/components/studio/StudioResponsiveProvider.tsx`
- `frontend/src/components/studio/StudioSidebar.tsx`
- `frontend/src/components/studio/StudioSystemDesignModal.tsx`
- `frontend/src/components/ui/dialog.tsx`
- `frontend/src/hooks/responsive.test.tsx`
- `frontend/src/hooks/usePageSwipe.ts`
- `frontend/src/hooks/usePublicationFit.ts`
- `frontend/src/hooks/useResponsiveLayout.ts`
- `frontend/src/hooks/useStudioResponsive.ts`
- `frontend/src/index.css`
- `frontend/src/pages/Categories.tsx`
- `frontend/src/pages/CreateProduct.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Inbox.tsx`
- `frontend/src/pages/KatanaStudio.tsx`
- `frontend/src/pages/LandingPage.tsx`
- `frontend/src/pages/MediaLibrary.tsx`
- `frontend/src/pages/Organizations.tsx`
- `frontend/src/pages/Products.tsx`
- `frontend/src/pages/Profile.tsx`
- `frontend/src/pages/PublicCatalogReader.tsx`
- `frontend/src/pages/PublicProfile.tsx`
- `frontend/src/pages/SearchResults.tsx`
- `frontend/src/pages/UserCatalogs.tsx`
- `frontend/src/pages/explore/Explore.tsx`
- `frontend/vite.config.ts`

## New Components / Hooks

- `frontend/src/components/layout/ResponsiveAppShell.tsx`
- `frontend/src/components/layout/ViewportFoundation.tsx`
- `frontend/src/components/mobile/MobileBottomNavigation.tsx`
- `frontend/src/components/mobile/MobileSheet.tsx`
- `frontend/src/components/mobile/ResponsiveModal.tsx`
- `frontend/src/components/studio/StudioMobileNavigation.tsx`
- `frontend/src/components/studio/StudioPhoneCanvasToolbar.tsx`
- `frontend/src/components/studio/StudioResponsiveProvider.tsx`
- `frontend/src/hooks/usePageSwipe.ts`
- `frontend/src/hooks/usePublicationFit.ts`
- `frontend/src/hooks/useResponsiveLayout.ts`
- `frontend/src/hooks/useStudioResponsive.ts`

## Tests Added

Unit tests (`frontend/src/hooks/responsive.test.tsx`):

- reacts to breakpoint crossings and removes matchMedia listeners
- fits late-mounted and rotated viewports without changing source geometry
- sheet locks background, has a named dialog and closes with Escape

Playwright (`frontend/e2e/responsive.spec.ts`), 33 generated cases:

- `critical routes fit ${width}x${height}`
- 'phone Studio keeps prompt, thread and document across pane changes and rotation'
- 'mobile management search, more navigation and modal Escape'
- 'reader fit and page selection survive orientation; zoom remains locally scrollable'
- `representative screenshots ${width}`
- `editor dialogs fit and restore focus ${width}x${height}`
- 'reader exposes products through a touch-friendly sheet and named product dialog'
- 'authentication fits phone and does not dismiss a required login'
- 'simulated visual keyboard keeps the focused assistant input inside the active viewport'
- 'reader swipe advances at fit zoom and is ignored while zoomed'
- 'phone inbox shows one conversation pane and returns to the list'
- 'desktop Studio preserves sidebar shortcuts, CoPilot visibility and document coordinates'
- 'shared management chrome follows light and dark themes on phone'
- 'generation progress keeps cancel and editor actions reachable on compact screens'
- 'tablet catalog fits inside its pane alongside the assistant'

The critical-route test expands over 15 sizes; screenshots expand over three sizes and editor dialogs over three sizes. Fixtures intercept API responses and use existing Vite store/document modules. They do not introduce production test hooks or call paid generation services. Browser QA workflow runs on frontend PRs to main and uploads evidence.

## Test Matrix

Chromium 151.0.7922.173, headless Linux, responsive desktop browser contexts:

| Size | Critical routes | Additional evidence |
| --- | --- | --- |
| 320×568 | 14 | Dialogs, authentication, Inbox, generation |
| 360×800 | 14 | Overflow/route checks |
| 375×667 | 14 | Overflow/route checks |
| 390×844 | 14 | Studio state, keyboard simulation, reader, theme, products, screenshots |
| 393×852 | 14 | Overflow/route checks |
| 412×915 | 14 | Overflow/route checks |
| 430×932 | 14 | Overflow/route checks |
| 768×1024 | 14 | Screenshots, generation and local canvas fit beside assistant |
| 820×1180 | 14 | Overflow/route checks |
| 844×390 | 14 | Rotation, dialogs, authentication, generation |
| 932×430 | 14 | Overflow/route checks |
| 1024×768 | 14 | Overflow/route checks |
| 1280×800 | 14 | Overflow/route checks |
| 1440×900 | 14 | Screenshots, dialogs, desktop shortcuts and document invariance |
| 1920×1080 | 14 | Overflow/route checks |

Routes: `/`, `/studio`, `/dashboard`, `/catalogs`, `/products`, `/products/new`, `/categories`, `/media`, `/organizations`, `/explore`, `/search`, `/inbox`, `/view/maison_verdana`, `/c/maison_verdana`. 210 route/size visits. Additional authentication state is tested explicitly. Seven screenshots per representative size: Studio home, assistant, canvas, Products, CreateProduct, Dashboard, Reader (21 images). Evidence is saved outside git at `/workspace/catana-mobile-qa/verified`, with logs under `/tmp/catana-mobile-*.log`.

## Commands Executed

Commands run from `frontend` unless otherwise stated:

| Command | Result |
| --- | --- |
| `npm ci --cache /tmp/catana-npm-cache` | PASS; dependencies installed |
| `npm test -- --run` | PASS: 7 files, 67 tests |
| `npm run lint` | FAIL: baseline repository lint debt; 250 errors, 20 warnings |
| `npx eslint . --format json` | Same 250 errors/20 warnings; comparison of file/rule/message against clean origin/main produced zero new diagnostics |
| `npx tsc -b` | PASS: exit 0 |
| `npm run build` | PASS: font registry check, TypeScript and Vite build |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --output=/workspace/catana-mobile-qa/verified` | PASS: 33/33 cases in 4.7 minutes, exit 0 |
| `git diff --check` (repository root) | PASS |

Final focus verification: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --grep 'editor dialogs' --output=/workspace/catana-mobile-qa/focus-verified` — PASS, 3/3 cases, 30 dialog openings, 11.1s. The final screenshot/desktop/tablet targeted replay passed those five cases; its initial three focus checks failed before the Skills fix and now pass in this separate replay.

Initial full browser run passed 30/30; supplemental tests passed theme/progress and phone state 3/3. Screenshot inspection then found tablet local canvas overflow that document-level overflow checks missed; added a local-pane assertion and corrected padding. Two overlapping targeted runs collided in their artifact directory (ENOENT); the final full suite ran alone in a distinct output directory. A stronger modal focus-return assertion exposed conflicting Skills autofocus; it was removed and all ten dialog variants were revalidated at phone, landscape and desktop sizes.

## Known Limitations

- Existing lint fails on clean origin/main with the same diagnostics; no unrelated lint cleanup included.
- Browser coverage is Chromium responsive viewport emulation; no real iOS/Android, Safari/WebKit, physical keyboard, OS safe-area or screen-reader certification. Keyboard occlusion is simulated via visualViewport changes, and swipe uses synthetic pointer input.
- API/auth responses are mocked for deterministic visual/interaction checks. Live Clerk redirects, upload persistence, paid AI generation, export service, WhatsApp and production infrastructure require integration QA. Advanced manual logo-crop touch dragging was not independently verified.
- Vite retains the pre-existing >500KB chunk warning. Baseline JS gzip 820.23KB; current JS gzip 827.52KB (+7.29KB, ~0.89%); current CSS gzip 33.92KB (baseline 31.74KB). This task does not introduce a runtime UI library; Playwright is development-only.
- GitHub CLI reports invalid session GH_TOKEN; PR publication outcome is recorded in the final delivery. No production deployment or merge attempted.

## Desktop Regression Status

PASS for tested Chromium route/layout checks, dialogs, Ctrl+B/Ctrl+J and canonical document invariance.

## Tablet Status

PASS for tested Chromium sizes, fitted local canvas and compact generation controls.

## Phone Status

PASS for tested Chromium sizes, state preservation, navigation, forms, reader, dialogs and simulated keyboard.

MOBILE EXPERIENCE READY FOR PR REVIEW
