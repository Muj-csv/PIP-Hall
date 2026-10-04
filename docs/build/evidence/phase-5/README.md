# Phase 5 evidence (4–5 Oct 2026)

Production build (`npm run build`, fixture data) served by `vite preview`, audited with Lighthouse 13 (mobile emulation).

| Route | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/` | 90 | 99 → 100 after fix | 100 | 91 → robots.txt added |
| `/explore` | 97 | 100 | 100 | 91 → robots.txt added |
| `/member/sample-player-1` | 97 | 99 → 100 after fix | 100 | 91 → robots.txt added |

The one accessibility miss was the badge's QR `<svg role="img">` without a name; it is decoration inside a labelled button and is now hidden from screen readers.

**Installable:** Lighthouse 13 no longer has a PWA category, so installability was read from Chrome itself (`Page.getInstallabilityErrors` over CDP, normal profile): **no errors**. Manifest errors: none. After the service worker took control, with the network off: `/member/sample-player-2` and `/explore` still loaded.

**axe-core** (WCAG 2.0/2.1/2.2 A + AA + best practice) on `/`, `/explore`, `/explore?q=zzz`, `/member/…`, `/member/nobody`, `/privacy`, `/settings`, `/edit`, `/admin`, and a 404, in DAY and NIGHT, desktop and phone: **0 violations** on all 40 runs.

**Manual review (design:accessibility-review):** fixed
- 320px wide (400% zoom): the handheld overflowed by 26px → button grip stacks under the rocker (D-044).
- Badge link slots: 28px drawn, tap area now 33 × 44px (D-043).
- "Change username" summary 25px tall → 44px. Home "Privacy" link 42px → 44px.
- Settings: "Keep my account" returned focus to the page top → now returns to "Delete my account…".
- Filter chip counts read as bare numbers → "Design 2 players".

**Search acceptance** (`e2e/explore.spec.ts`, `src/lib/search.test.ts`): found by name (accent-insensitive), @handle, skill and project title; filters by department, skill, featured.

**Still on the owner** (needs real devices, see `docs/DEPLOY.md` §5): install on an Android phone and an iPhone and confirm it launches standalone.

Screenshots: `explore-*.png`, `settings-*.png`, `home-320px.png`.
