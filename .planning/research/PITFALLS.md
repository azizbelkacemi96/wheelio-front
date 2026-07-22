# Pitfalls Research

**Domain:** Frontend SPA dashboard for a multi-tenant SaaS (Wheelio Front) — JWT auth against an existing Go API, field photo-based damage inspections on mobile, bilingual FR/EN from v1, authenticated PDF downloads, no existing design system
**Researched:** 2026-07-22
**Confidence:** MEDIUM (web-sourced, cross-checked across multiple independent articles/discussions per topic; no official framework docs consulted for this dimension — treat as directional, verify against the chosen stack's own docs during Phase planning)

## Critical Pitfalls

### Pitfall 1: Refresh-token stampede on concurrent 401s

**What goes wrong:**
A dashboard view typically fires several requests at once (fleet list, notifications, current user, agency stats). With a ~15min access-token TTL, the moment it expires, every one of those in-flight or newly-fired requests hits 401 at roughly the same time. If each request independently triggers its own "refresh the access token" call, you get a refresh stampede — several parallel refresh calls racing each other. Since this API uses **rotating** refresh tokens, the first refresh call rotates the token and invalidates the old one; the second, third, fourth refresh calls (which still hold the now-stale refresh token) fail, and the user gets logged out despite having a technically-valid session. This bug is nearly invisible in local dev (you test one request at a time) and appears only in production once dashboard pages fire multiple parallel calls.

**Why it happens:**
Naive interceptor code checks "is this a 401? → call refresh → retry" independently per request, with no shared state between concurrent requests.

**How to avoid:**
Implement a single-flight refresh pattern in the HTTP client layer (axios interceptor or fetch wrapper), not per-feature: keep one shared in-flight `Promise` for the refresh call. The first 401 triggers the refresh and stores that promise; every other concurrent 401 awaits the *same* promise instead of calling refresh again, then retries with the new token once it resolves. Maintain a queue of failed/pending requests that gets drained (retried) only after the shared refresh promise settles. Mark retried requests to avoid infinite retry loops if the refreshed token still gets a 401 (force logout instead of retrying forever).

**Warning signs:**
- Random logouts that seem to correlate with "loading a page with several widgets/cards"
- Multiple `POST /auth/refresh` calls visible in the network tab within the same tens-of-milliseconds window
- Logout happening more often on slower devices/connections (more requests overlap while previous ones are still pending)

**Phase to address:**
Auth/session-handling phase (the HTTP client / API layer setup), before any feature makes its first authenticated call — this is infrastructure, not a feature, and retrofitting it after multiple features already call the API independently is expensive.

---

### Pitfall 2: Expired-token redirect silently destroys in-progress work (especially field inspection forms)

**What goes wrong:**
The single most damaging manifestation of this domain: an agent is mid-way through an état des lieux (damage inspection) on a tablet in a parking lot — several photos captured, damage zones annotated — and the 15-minute access token expires. If the app's failure mode on auth failure is "hard redirect to /login", all unsaved form state (annotations, in-memory captured photos not yet uploaded) is lost, and the agent has to redo the entire walk-around. This is much worse here than in a typical CRUD app because the "form" involves physical, time-consuming, on-site data capture (walking around a car, photographing each damage) that cannot be trivially redone from memory.

**Why it happens:**
Auth failure handling is usually built once, generically, early ("any 401 → send to login") without considering that some flows have expensive, hard-to-reconstruct local state.

**How to avoid:**
Pitfall 1's silent refresh should mean users basically never see this — auth failures should be invisible mid-session. But defense in depth matters for the inspection flow specifically: persist in-progress inspection state (damage annotations, captured-but-not-yet-uploaded photo blobs/references) to durable client storage (e.g. IndexedDB, not just React state) as the user works, independent of auth state, so that even a hard logout (refresh token itself expired/revoked, e.g. after a long field session or device left overnight) does not destroy captured work — the user can log back in and resume rather than restart.

**Warning signs:**
- No local persistence for the inspection form beyond in-memory component state
- Auth-error handling implemented as a single global "on 401 → navigate('/login')" with no distinction between flows
- No manual test of "let the token expire mid-inspection-flow" during UAT

**Phase to address:**
The inspection/état des lieux phase specifically (in addition to the auth phase for the general refresh mechanism) — flag this phase for extra resilience/local-persistence work given the field-usage constraint in PROJECT.md.

---

### Pitfall 3: EXIF orientation bug on inspection photos

**What goes wrong:**
Phone/tablet cameras write photo pixels in the sensor's native orientation and record the intended rotation as EXIF metadata, not as an actual pixel transform. Browsers' `<img>` rendering does not reliably honor that metadata across all browsers/versions. Result: damage photos captured in portrait mode on a phone can appear rotated 90°/180° when displayed in the dashboard (or in the generated PDF état des lieux), on a document whose entire purpose is protecting both parties with an accurate visual record — a sideways damage photo undermines the feature's core value proposition.

**Why it happens:**
Developers test camera capture on one device/browser where orientation happens to render correctly and don't notice the metadata-vs-pixel distinction until a different device/OS combination produces visibly wrong photos in QA or, worse, in front of a customer.

**How to avoid:**
Never trust that a browser will auto-correct orientation. On capture (client-side, before/during upload), read the image's EXIF orientation tag and physically rotate the pixels via `<canvas>` (e.g. using a small library or a manual EXIF-orientation-to-canvas-transform routine), producing a new Blob with orientation already baked in and EXIF orientation stripped/normalized to 1. Since the backend also stores and later composes these photos into a PDF, treat the corrected, canvas-rotated blob as the canonical upload payload — do not rely on the API or PDF renderer to compensate for orientation either.

**Warning signs:**
- Photos looking correct on the capturing device/browser but wrong in the dashboard gallery or generated PDF
- Any photo-handling code that uploads the raw `File` from `<input type="file">` without a canvas re-encode step
- Different orientation bugs appearing only on specific phone models/browsers during QA

**Phase to address:**
The état des lieux / photo capture phase — build the canvas-based EXIF normalization into the shared photo-capture component from the start, since every damage photo goes through the same capture path.

---

### Pitfall 4: Losing captured photos / form state on iOS Safari camera backgrounding

**What goes wrong:**
Tapping a file input with `capture` on iOS Safari launches the native camera app, backgrounding the browser tab. iOS can reclaim tab memory under pressure while backgrounded, especially on longer inspection sessions with multiple photos taken in sequence; if the inspection screen holds unsent state only in JS memory (React state, not persisted), returning from the camera can find the page reloaded from scratch, silently discarding prior captures/annotations from that session. Separately, the file input itself must be triggered by a genuine user gesture in the same synchronous event-handler call — if the "take photo" button defers `input.click()` behind an async step (e.g. a permission check, an API call), iOS Safari can silently refuse to open the camera at all, with no visible error, which looks like a broken/unresponsive button to the field agent.

**Why it happens:**
Standard web form patterns (in-memory-only state, deferred/async click handlers) are safe on desktop but break under iOS Safari's stricter user-gesture requirement and its more aggressive backgrounded-tab memory reclamation.

**How to avoid:**
- Trigger the hidden file input's `.click()` synchronously inside the click handler of the visible "take photo" button/label — no `await` before it.
- Use a visually-hidden input technique that iOS reliably honors (`position: absolute; left: -9999px`, not `display: none`), paired with a `<label>` as the tappable trigger.
- Persist each captured photo (as a Blob reference/thumbnail, plus the damage-zone metadata already entered) to IndexedDB as soon as it's captured, not just to component state, so a background/foreground cycle or accidental reload during a multi-photo inspection does not lose already-captured work.
- Upload photos incrementally as they're captured rather than batching them all for a single submit at the end of the walk-around.

**Warning signs:**
- "Take photo" button appears unresponsive specifically on iPhone/Safari during QA
- Photos from earlier in an inspection session disappearing after taking a later photo, on iOS specifically
- No IndexedDB/localStorage persistence anywhere in the inspection photo-capture flow

**Phase to address:**
État des lieux / photo capture phase — this is the same phase as Pitfall 3, since both concern the shared photo-capture component; test explicitly on real iOS Safari (not just desktop dev tools device emulation, which does not reproduce this class of bug).

---

### Pitfall 5: Single giant multipart upload with no retry/resumability on flaky field connectivity

**What goes wrong:**
An agency's parking lot or garage may have poor cellular/WiFi coverage. If each damage photo (or worse, a batch of several photos submitted together) is uploaded as one large, unchunked multipart request with only a whole-request retry (or no retry at all) on failure, a dropped connection mid-upload forces the user to redo the entire upload from zero, burning mobile data and battery repeatedly, and risking data loss if the user gives up or navigates away out of frustration.

**Why it happens:**
Upload code is usually written and tested on office WiFi where large payloads succeed in one shot; the flaky-network failure mode never surfaces until real field usage.

**How to avoid:**
Upload photos one at a time as they're captured (not batched), keep individual photo payloads reasonably sized (compress/resize before upload — a full-resolution phone photo is often 3-8MB and rarely needed at that resolution for a damage record), and implement automatic retry with exponential backoff per photo upload (not per full-form submit). Track upload status per photo in local state/IndexedDB (pending/uploading/done/failed) so the UI can show and let the user manually retry any individual failed photo without re-submitting everything else already uploaded successfully.

**Warning signs:**
- Upload implemented as "submit whole inspection form with all photos in one request"
- No visible per-photo upload progress/status in the UI
- No retry logic beyond the browser's default (none) on a failed fetch/XHR

**Phase to address:**
État des lieux / photo capture phase — design the upload flow as incremental per-photo with retry from the start, since this directly serves the "field usage on mobile" constraint called out in PROJECT.md.

---

### Pitfall 6: Client-side-only role checks mistaken for security

**What goes wrong:**
Because the API already returns `Scope.CanRead/CanOperate/CanManage` and `IsOrgAdmin`, it's tempting — and easy — to hide/disable UI purely based on that same payload and consider the job done. That's correct for UX, but if any engineer *also* writes independent frontend-only logic (e.g., re-deriving "is this user allowed to void an invoice" from a locally hardcoded role string instead of the actual scope flags from `/me`), two problems emerge: (1) the frontend's notion of permissions can silently drift out of sync with the backend's actual RBAC as roles evolve, producing UI that shows the wrong actions for a role; (2) more seriously, if anyone assumes hiding a button server-side-equivalent to enforcing the restriction, they may skip double-checking that the backend independently rejects the same action for that role — a client that can be manipulated (browser devtools, direct API calls) must never be the only barrier.

**Why it happens:**
It's faster to write `if (role === 'agent') return null` scattered through components than to consistently gate everything off the single source of truth (`/me` scope data), especially under time pressure to ship a demo-able v1.

**How to avoid:**
Treat the API's scope/role payload (`CanRead/CanOperate/CanManage`, `IsOrgAdmin`) as the single source of truth for all frontend permission logic — build one small permission-checking utility/hook (e.g. `usePermission('rental:void')`) that all components call, rather than letting each component re-derive role logic ad hoc. Never invent a parallel client-side role taxonomy. Explicitly verify (as part of this project, even though the backend is "already stable") that every state-changing endpoint still enforces the restriction server-side regardless of what the UI shows — this is a verification/UAT item, not a build item, since the backend already exists.

**Warning signs:**
- Permission checks scattered as inline conditionals (`user.role === 'x'`) instead of routed through one shared utility
- Any hardcoded role-name string comparison instead of checking the `Can*` scope flags/`IsOrgAdmin` from `/me`
- No UAT step that attempts a restricted action directly against the API (bypassing the UI) to confirm server-side enforcement

**Phase to address:**
Auth/RBAC-driven navigation phase — build the single permission utility here, before any feature phase starts writing role-gated UI; the "Looks Done But Isn't" checklist below should be run at the end of every feature phase.

---

### Pitfall 7: Hiding actions entirely instead of disabling them, causing confusing/unstable UI

**What goes wrong:**
For roles that lack permission for an action (e.g. an agent trying to void an invoice, a viewer-role user in an agency), completely removing the button/menu item from the DOM can cause two UX problems: layout instability (different users see different-shaped toolbars/cards for the "same" screen, making support/training harder — "I don't see that button" becomes ambiguous between "you don't have permission" and "something is broken"), and loss of discoverability (a manager who could request an upgrade, or who wants to understand what a lower role *can't* do, has no way to know the feature exists at all).

**Why it happens:**
"Hide if not allowed" feels like the simplest implementation and is often the default first instinct, without distinguishing cases where the user genuinely should never know a feature exists (true hide) from cases where they can see it happens/exists but just aren't allowed to trigger it themselves (disable-with-explanation).

**How to avoid:**
Adopt a simple rule per action: hide only if the user has zero legitimate path to ever needing awareness of that action (e.g. an agent should probably never see organization-level billing settings at all); disable-with-tooltip/explanation for actions that exist in the same view other roles see performed (e.g. a "Void invoice" button visible-but-disabled for an agent viewing the same invoice a manager could void, so the UI is visually consistent across roles and the restriction is legible rather than mysterious).

**Warning signs:**
- Different roles see structurally different page layouts for what's meant to be "the same screen" (not just extra admin-only sections, but core action buttons appearing/disappearing)
- Support/training confusion between "you don't have permission" and "bug, the button is missing"
- No design decision documented anywhere about which actions are hide-class vs disable-class

**Phase to address:**
Auth/RBAC-driven navigation phase and the design-system/UI-kit phase — decide and document the hide-vs-disable rule as part of the design system conventions, then apply consistently per feature phase.

---

### Pitfall 8: i18n retrofitted instead of architected, breaking on French pluralization/formatting

**What goes wrong:**
If UI strings are written directly in components first ("ship the demo, translate later") and only wrapped in a translation function afterward, hardcoded strings creep in everywhere and the retrofit means hunting every literal across the whole codebase — expensive and error-prone, and PROJECT.md explicitly calls out that this project wants to avoid exactly that cost. A more subtle version of the same mistake even when translation functions ARE used from day one: doing naive pluralization (`count === 1 ? singular : plural`) or manually concatenating a number/date into a string (`` `${count} véhicules` ``) instead of using ICU MessageFormat placeholders. This breaks two ways specific to French: French's plural rule treats 0 as singular ("0 véhicule", not "0 véhicules" — unlike English where 0 takes the plural form), and gendered nouns/adjectives (e.g. "inscrit" vs "inscrite") can't be handled by simple string interpolation, requiring ICU `select` formatting or distinct message keys instead.

**Why it happens:**
Naive string concatenation "just works" in English during initial development, so the ICU-formatting discipline isn't obviously necessary until French copy is actually written and native speakers or the numbers 0/1 expose the bug — often after dozens of components already violate the pattern.

**How to avoid:**
Choose an ICU-based i18n library (react-intl/FormatJS, or i18next with its ICU plugin) before writing the first component's UI copy, and enforce (via lint rule or code review discipline) that every user-facing string goes through the translation function — no bare JSX text nodes. Use ICU plural/select syntax for any string involving a count or a gendered term from the very first instance, not just once a bug is found. Route all dates, numbers, and currency (DZD, given the Algerian invoicing requirement) through `Intl.DateTimeFormat`/`Intl.NumberFormat` with the active locale rather than manual formatting — this also naturally handles Algerian date/number conventions correctly for both FR and EN without separate manual logic per locale.

**Warning signs:**
- Any UI string not passed through the translation function found during code review
- String concatenation like `` `${t('vehicles')} : ${count}` `` instead of a single ICU-formatted message with an embedded plural
- Manual `.toFixed(2)` / manual date string building instead of `Intl.NumberFormat`/`Intl.DateTimeFormat`
- French copy for "0 X" showing plural form ("0 véhicules") instead of correct singular ("0 véhicule")

**Phase to address:**
The very first UI-building phase (setup/foundations), before any feature screen is built — this is explicitly called out in PROJECT.md as "i18n architecture from the start, not added after," so the roadmap should place i18n library setup + ICU convention + lint enforcement at the very beginning, not as a later phase.

---

### Pitfall 9: Broken or insecure PDF/document download pattern

**What goes wrong:**
The API streams PDFs (`application/pdf`, never cached) behind JWT auth. A plain `<a href="/api/rentals/123/invoice.pdf">` or `window.open(url)` cannot attach an `Authorization: Bearer <token>` header, so the request either fails (401, since browsers don't send the JWT automatically for a bare navigation) or gets "solved" by putting the access token in the URL query string — which is insecure (tokens end up in browser history, server access logs, Referer headers, and are shareable/bookmarkable) and inconsistent with a ~15min-TTL access token anyway (the link breaks the moment the token expires, e.g. if the user bookmarks or copies it). A second, separate bug: even with the correct `fetch()` + blob approach, forgetting to call `URL.revokeObjectURL()` after each download leaks memory — in a dashboard where users may download several invoices/contrats/états des lieux in one session without a page reload, this can accumulate and degrade the tab over time.

**Why it happens:**
The simplest-looking implementation (an `<a>` tag or new-tab link) is what most examples online show for "download a file," without accounting for the fact that this endpoint requires header-based auth, not cookie-based session auth.

**How to avoid:**
Fetch the PDF via `fetch()`/`axios` with the `Authorization` header explicitly set (reusing the same authenticated HTTP client as every other API call, so it also benefits from the single-flight refresh logic in Pitfall 1 — a PDF download triggered right as the token expires should transparently refresh first, not fail silently), read the response as a `blob()`, create an object URL with `URL.createObjectURL()`, trigger the download via a programmatically-clicked temporary `<a download>`, and call `URL.revokeObjectURL()` immediately after (or on a short timeout) to release the memory. Never put the primary JWT in a URL query string for this purpose.

**Warning signs:**
- Any `<a href="...">` or `window.open()` pointed directly at a PDF API endpoint without a preceding authenticated fetch
- Token or credentials visible in a URL (address bar, browser history, server logs)
- Repeated PDF downloads in one session with no `revokeObjectURL` call anywhere in the download code path
- PDF download silently failing right when the access token happens to be near expiry, with no graceful refresh-then-retry

**Phase to address:**
The billing/PDF phase (invoice, contrat, état des lieux downloads) — build one shared "download authenticated file" utility here (blob fetch + object URL + revoke, wired through the same HTTP client as everything else) rather than reimplementing per document type.

---

### Pitfall 10: No design tokens, ad-hoc styling per screen, looking amateurish despite effort

**What goes wrong:**
With no existing brand/design system (explicitly the case per PROJECT.md) and a v1 built as a fast-moving sequence of feature phases (fleet → clients → contrats → EDL → facturation), it's easy for each phase to introduce its own slightly different spacing values, font sizes, button styles, and color shades — nobody chooses inconsistency on purpose, but without a shared token set to reuse, ten different screens accumulate ten slightly different visual languages. The result reads as "amateurish" not because any single screen looks bad, but because nothing feels like the same product across screens — inconsistent padding, several near-identical-but-not-quite button styles, arbitrary color shades instead of a defined palette. Given that PROJECT.md's stated success metric explicitly includes "UI/UX assez soignée pour être un argument de vente" (polished enough to be a sales argument), this pitfall directly threatens the project's core value, not just aesthetics.

**Why it happens:**
Building a design system feels like overhead that doesn't obviously map to a shipped feature, so under time pressure each feature phase just styles its own screens directly (inline utility classes or ad hoc component styles) without referencing a shared source of truth, especially when no dedicated "design system" phase exists in the roadmap.

**How to avoid:**
Define a small, explicit token set — color palette (including a defined DZD/invoice-appropriate palette), a type scale (3-4 sizes, 2 weights is enough for a professional look, per how well-regarded SaaS dashboards like Linear do it), a spacing scale (e.g. a 4px/8px base grid), and 2-3 border-radius values — *before* building the first feature screen, then build a small library of 15-20 shared core components (buttons, inputs, cards, tables, badges, modals) on top of those tokens. Every subsequent feature phase must reuse existing tokens/components rather than introducing new one-off values; treat introducing a new color, spacing value, or font size outside the token set as something that requires deliberate justification, not a default. This project already has design-oriented skills pre-installed (`ui-ux-pro-max`, `design-system`, `ui-styling`, `brand`) — use them at the very start to establish the direction once, rather than making per-screen visual decisions repeatedly.

**Warning signs:**
- Spacing/padding values that aren't multiples of a consistent base unit scattered through the codebase
- More than 2-3 button visual variants that all mean "primary action" with slightly different colors/sizes
- No single file/config defining the color palette, type scale, and spacing scale that components reference
- Each new feature phase's screens "feeling different" from the previous phase's screens when reviewed side-by-side

**Phase to address:**
A dedicated design-system/foundations phase very early (ideally phase 1 or 2, before or alongside auth), producing the token set + core component library that every subsequent feature phase consumes — do not let the design system emerge implicitly from the first feature phase's needs alone.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Per-request 401→refresh→retry without single-flight | Faster to write initially | Random logouts, refresh-token invalidation loops in production once >1 concurrent request is normal | Never — dashboards always end up with concurrent requests |
| Hardcoded UI strings "to be translated later" | Faster initial screen-building | Expensive full-codebase string hunt later; risk of missed strings shipping untranslated | Never, given i18n is an explicit v1 requirement |
| Batch-upload all inspection photos at form submit | Simpler upload code | Full re-upload on any network drop mid-session in the field; higher risk of lost work | Only for a throwaway prototype/demo, never for the shipped field flow |
| Ad hoc per-screen styling without tokens | Ships individual screens faster short-term | Compounding visual inconsistency that undermines the "professional/sales-ready" success metric | Only acceptable for a disposable spike/sketch, never for shipped screens |
| Client-side-only role checks with no shared permission utility | Quick to hide a button | Permission logic drifts from backend truth as roles evolve; harder to audit | Never — reuse the API's own scope flags from day one |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| JWT access+refresh (~15min TTL, rotating refresh) | Independent per-request refresh causing stampede/invalidation | Single-flight refresh + request queue in the HTTP client interceptor |
| Multipart photo upload (état des lieux) | One giant request per photo/batch, no retry | Per-photo incremental upload with backoff retry and local pending/failed status |
| PDF streaming endpoint (`application/pdf`, never cached) | Plain `<a>`/`window.open` or token-in-URL | Authenticated `fetch()` → blob → object URL → programmatic download → `revokeObjectURL` |
| `/me` scope payload (`Can*`, `IsOrgAdmin`) | Re-deriving role logic independently in frontend | Single shared permission hook/utility reading directly from the scope payload |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Uploading full-resolution phone photos unmodified | Slow uploads, high data usage, timeouts on poor field connectivity | Client-side resize/compress before upload (e.g. cap at ~1600-2000px longest edge, JPEG quality ~80%) | Immediately in the field on 3G/weak signal; not visible on office WiFi testing |
| No object-URL revocation on repeated PDF downloads | Growing memory usage in long dashboard sessions | Always pair `createObjectURL` with `revokeObjectURL` right after use | After several downloads in one session without a page reload |
| Unbounded concurrent photo uploads during an inspection | Network congestion, some uploads silently stalling on weak connections | Cap concurrent in-flight uploads (e.g. 2-3 at a time) with a simple queue | As soon as an inspection involves more than a handful of photos on a weak connection |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating hidden/disabled UI as the actual authorization boundary | A user with devtools/API access performs an action the UI hid, if backend enforcement has any gap | Verify server-side enforcement for every action independent of UI state, as a UAT/verification step, not just a build assumption |
| Putting the JWT access token in a URL query string to work around header-less `<a>` downloads | Token leaks via browser history, server access logs, Referer headers | Always fetch protected binary content via header-based `fetch()`, never via bare URL navigation |
| Storing tokens in `localStorage` without considering XSS exposure | Any XSS vulnerability becomes full session takeover | Prefer `httpOnly` cookies for refresh token where the API supports it, or at minimum isolate token storage/access through a single audited module |
| Independently reinventing role-name checks instead of using the API's scope flags | Frontend role logic drifts from backend RBAC as roles evolve, creating inconsistent/incorrect UI | Single shared permission utility sourced directly from `/me` scope data |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Hard redirect-to-login on token expiry mid-form | Field agent loses in-progress inspection work, must redo physical walk-around | Silent single-flight refresh (invisible to user) + local persistence of in-progress inspection state as a backstop |
| Hiding role-restricted actions entirely rather than disabling with explanation | Confusing "is this broken or am I not allowed" experience; inconsistent layouts across roles | Disable-with-tooltip for actions visible to other roles in the same view; hide only when truly irrelevant to that role |
| Naive pluralization/concatenation breaking French copy at 0/1 boundaries | Grammatically wrong or awkward-sounding UI text for a French-speaking primary market | ICU MessageFormat plural/select from the first string written |
| Camera "take photo" button that silently does nothing on iOS Safari (deferred click) | Field agent thinks the app is broken, may abandon the digital inspection for a paper workaround | Synchronous `input.click()` inside the direct tap handler, tested on real iOS Safari |

## "Looks Done But Isn't" Checklist

- [ ] **Auth/refresh handling:** Looks done when login/logout work in manual single-request testing — verify by firing several simultaneous authenticated requests right as the access token is about to expire and confirming exactly one refresh call occurs and no logout happens.
- [ ] **Photo capture flow:** Looks done when a photo taken on a laptop webcam or Android emulator displays correctly — verify orientation and backgrounding behavior specifically on a real iOS Safari device with a multi-photo capture sequence.
- [ ] **i18n coverage:** Looks done when the language switcher toggles the main nav/labels — verify by searching the codebase for un-wrapped string literals in JSX and checking French plural forms at count=0, 1, 2, and a gendered string.
- [ ] **PDF download:** Looks done when clicking "download invoice" once produces a correct file — verify by downloading several documents in a row in one session (checking for memory growth / stale blob URLs) and by testing the download right as the access token is near/at expiry.
- [ ] **Role-based UI:** Looks done when a lower-role user sees fewer buttons in the browser — verify by attempting the hidden/disabled action directly against the API (bypassing the UI, e.g. via devtools or a REST client) and confirming the backend independently rejects it.
- [ ] **Design consistency:** Looks done when each individual screen looks polished in isolation — verify by reviewing 3-4 different feature screens side by side for consistent spacing, type sizes, and button styles.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Refresh-token stampede already shipped | MEDIUM | Introduce a single shared refresh promise + queue in the existing HTTP client interceptor; requires touching one central module, not every call site, if the client was already centralized |
| Hardcoded strings scattered across many components | HIGH | Codebase-wide search-and-wrap pass to route every literal through the translation function; costly the longer it's deferred — this is the primary reason to prevent it from the start |
| Photos uploaded without EXIF correction already in production | MEDIUM | Add canvas-based correction going forward for new uploads; optionally batch-reprocess already-stored photos server-side if orientation errors are visible in shipped PDFs |
| Design system introduced after several screens already built ad hoc | HIGH | Retrofit tokens, then progressively refactor each existing screen to consume them — effectively a redesign pass across all shipped screens |
| Client-side-only permission logic already diverged from backend scope | LOW-MEDIUM | Replace ad hoc role checks with a single shared permission hook reading `/me` scope data; localized to component-level changes, not architecture-level |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|---------------|
| Refresh-token stampede on concurrent 401s | Auth/session/HTTP-client foundation phase | Fire several parallel authenticated calls right at token expiry; confirm one refresh call, no logout |
| Expired-token redirect destroying in-progress inspection work | Auth foundation phase + État des lieux phase | Manually let token expire mid-inspection; confirm no data loss and seamless continuation |
| EXIF orientation bug on inspection photos | État des lieux / photo capture phase | Capture photos in portrait/landscape on a real phone; confirm correct orientation in dashboard and generated PDF |
| Lost photos/state on iOS Safari camera backgrounding | État des lieux / photo capture phase | Multi-photo capture session on real iOS Safari device, backgrounding between shots |
| No retry/resumability on flaky uploads | État des lieux / photo capture phase | Simulate network drop mid-upload (dev tools throttling/offline toggle); confirm per-photo retry, no full-form re-upload needed |
| Client-side-only role checks mistaken for security | Auth/RBAC navigation phase | Attempt a restricted action directly against the API bypassing the UI; confirm server-side rejection |
| Hiding vs disabling actions inconsistently | Auth/RBAC navigation phase + design-system phase | Cross-role screen comparison for layout stability and legibility of restrictions |
| i18n retrofitted instead of architected | First foundations/setup phase (before any feature UI) | Lint/search for un-wrapped strings; verify French plural/gender forms at each feature phase's review |
| Broken/insecure PDF download pattern | Billing/PDF phase | Repeated downloads in one session (memory check) + download attempt at/near token expiry |
| No design tokens, ad hoc per-screen styling | Dedicated design-system/foundations phase (before or alongside auth) | Side-by-side visual review of screens from different feature phases for consistency |

## Sources

- [JWT Refresh Token Race Conditions: How I Finally Fixed It](https://spiritcode.blog/jwt-refresh-token-race-conditions-how-i-finally-fixed-it/)
- [Single-Flight Pattern — luminary.blog](https://luminary.blog/techs/04-single-flight-pattern/)
- [JWT Token Refresh Patterns in React 19: Avoiding the Silent Auth Death Spiral](https://dev.to/uaslimcreate/jwt-token-refresh-patterns-in-react-19-avoiding-the-silent-auth-death-spiral-3fg4)
- [You're Probably Refreshing Auth Tokens Wrong. Here's a 40-Line Fix.](https://dev.to/graciesharma/youre-probably-refreshing-auth-tokens-wrong-heres-a-40-line-fix-11f6)
- [Race conditions in JWT refresh token rotation](https://dev.to/silentwatcher_95/race-conditions-in-jwt-refresh-token-rotation-3j5k)
- [Handling JWT refresh tokens in axios without the headache](https://dev.to/tai_tran_36c0d039fde1e560/handling-jwt-refresh-tokens-in-axios-without-the-headache-56nb)
- [Repeating Failed Requests After Token Refresh in Axios Interceptors for React.js Apps](https://medium.com/@sina.alizadeh120/repeating-failed-requests-after-token-refresh-in-axios-interceptors-for-react-js-apps-50feb54ddcbc)
- [Axios Interceptor: How to Refresh Token and Retry Multiple 401 Requests Successfully](https://www.cyberangles.org/blog/axios-interceptor-refresh-token-for-multiple-requests/)
- [How to Handle 401 Authentication Error in React with Axios](https://www.xjavascript.com/blog/how-to-handle-401-authentication-error-in-axios-and-react/)
- [message view: EXIF orientation is ignored, causing images to look rotated — zulip/zulip#8177](https://github.com/zulip/zulip/issues/8177)
- [Handle image rotation on mobile — Wassa](https://medium.com/wassa/handle-image-rotation-on-mobile-266b7bd5a1e6)
- [The Silent Rotator: Understanding EXIF Orientation and How I Fixed It](https://vsidhu.com/blogs/fixing-exif-orientation-in-react-native-camera)
- [image orientation on the web - justmarkup](https://justmarkup.com/articles/2019-10-21-image-orientation/)
- [Uploading images via the phone camera is broken on iOS — backdrop-issues#4185](https://github.com/backdrop/backdrop-issues/issues/4185)
- [Fix iOS Safari input type="file" Not Opening Camera - Real Solution](https://devnote.in/fix-ios-safari-input-typefile-not-opening-camera-real-solution/)
- [Tus | Uppy](https://uppy.io/docs/tus/)
- [Understanding tus.io: The Open Protocol for Resumable File Uploads](https://iniakunhuda.medium.com/understanding-tus-io-the-open-protocol-for-resumable-file-uploads-b7365e654fb5)
- [Choosing Optimal Chunk Sizes for Resumable Uploads — Resumable.js Guides](https://www.resumablejs.com/guides/optimal-chunk-sizes-resumable-uploads-2026/)
- [A Practical Guide to Role-Based Permissions in React](https://dev.to/victoryndukwu/a-practical-guide-to-role-based-permissions-in-react-1g4m)
- [Implementing Role Based Security in a Web App](https://medium.com/bluecore-engineering/implementing-role-based-security-in-a-web-app-89b66d1410e4)
- [Choosing the best access control model for your frontend - LogRocket Blog](https://blog.logrocket.com/choosing-best-access-control-model-frontend/)
- [Best React i18n Libraries in 2026: A Practical Comparison | Tolgee](https://tolgee.io/blog/react-i18n-libraries-comparison)
- [ICU message format: Guide to plurals, dates & localization syntax | SimpleLocalize](https://simplelocalize.io/blog/posts/what-is-icu/)
- [ICU Message Format Guide: Syntax, Plurals & Real-World Examples (2026) | Crowdin Blog](https://crowdin.com/blog/icu-guide)
- [20 i18n Mistakes Developers Make in React Apps (And How to Fix Them)](https://www.translatedright.com/blog/20-i18n-mistakes-developers-make-in-react-apps-and-how-to-fix-them/)
- [How to Handle Pluralization in React | General Translation](https://generaltranslation.com/en-US/blog/plurals)
- [Generate PDF URL from Blob in React Application](https://medium.com/@natanael280198/generate-pdf-url-from-blob-in-react-application-f23cef6dd6c6)
- [Web Security: File downloads behind Auth](https://gaurav5430.medium.com/web-security-file-downloads-behind-auth-c38c4cb1842b)
- [Download API Files With React & Fetch](https://medium.com/yellowcode/download-api-files-with-react-fetch-393e4dae0d9e)
- [fetch() leaks memory on each request due to unreleased Blobs — react-native#19248](https://github.com/facebook/react-native/issues/19248)
- [SaaS Design System Guide: Scale UI Without Chaos | F1Studioz](https://f1studioz.com/blog/saas-design-system-guide/)
- [Design Systems 101: Build Scalable UI for SaaS | Orbix](https://www.orbix.studio/blogs/design-systems-101-saas-guide)
- [An introduction to design tokens](https://donux.com/blog/introduction-to-design-tokens)
- [What a Design System Actually Is — and the 4 Signals Your SaaS Product Needs One](https://www.letsgroto.com/blog/design-system)

---
*Pitfalls research for: Wheelio Front (SaaS fleet-management dashboard, Algeria car rental market)*
*Researched: 2026-07-22*
