# Phase 5 — Search, PWA, polish (Tue 6 Oct, morning)

**Goal:** discovery, install, and no rough edges. Implements FR-13, FR-14, FR-16.

**Do**
1. `/explore`: `SearchBar` + `FilterChips` (department, skill, featured), grid of compact cards, count, "Random player" button. `lib/search.ts` in-memory with normalized haystacks.
2. PWA per ARCHITECTURE §8: manifest, original pixel icons (192, 512, maskable), service worker caching, `InstallPrompt` (Android `beforeinstallprompt`, iOS steps), safe-area padding.
3. `/settings`: email opt-in, show email, theme, sign out, delete account (delete storage folder via API → `delete_my_account` → sign out), with an in-page confirm step.
4. Loading, empty, error states on every route. `design:accessibility-review` pass and fixes.

**Acceptance**
- Lighthouse: PWA installable, Performance ≥ 85 mobile, Accessibility ≥ 95.
- Install on an Android phone and an iPhone (or iOS simulator steps documented), launches standalone.
- Search finds a member by name, handle, skill and project title.

**Nothing new starts after noon.**
