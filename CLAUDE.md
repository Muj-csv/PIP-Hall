# PIP-Hall — build rules for coding agents

**PIP-Hall (People, Identity & Projects Hall)** is a game-inspired showcase where organization members become interactive player cards: collectible pixel ID badges inside an original handheld console world called PIXENDO. Tagline: *Where every person has a place.* Visitors swipe through badges hanging from lanyards, flip one to see the member's projects, and scan its QR to open the member's public page. Members sign in with Google, connect GitHub, pick repos, and submit their card. An admin approves it into the public collection. v1.0 launched on 6 Oct 2026; there is **no deadline** now (D-093): work ships when it's ready and checked.

**Direction (v2, `docs/plan/V2-LIVING-HALL.md`):** a small living world where people, projects and the relationships between them can be discovered, collected and connected. Not social media, not LinkedIn in pixel art.

## Read first
1. `docs/DECISIONS.md` — what's decided. Don't relitigate; flag a concern once and move on.
2. `docs/ARCHITECTURE.md` — stack, data model, security, routes, folders.
3. `docs/design/DESIGN_BRIEF.md` + `src/styles/theme.css` — how it looks and moves.
4. `docs/plan/V2-LIVING-HALL.md` — the v2 plan and its phases. Do only the phase you're on, then **stop and report**.
5. `docs/build/PHASE-N.md` — v1 phase briefs (history).
The original spec is in `docs/spec/`. Where it conflicts with the files above, the files above win (e.g. D-008 full colour replaces monochrome).

## Hard rules
- Stack: React + Vite + TypeScript (strict) + Tailwind 4 + React Router + Supabase. Carousel springs, swing and sprites are hand-written on one `requestAnimationFrame` loop (D-031); no Motion, no Embla (ADR-001), no state library, no UI kit, no paid services.
- Styling only through `src/styles/theme.css` tokens (generated from `docs/design/tokens.json` — edit the JSON and re-export, never the CSS). No raw hex in components, no stock palette classes, no `border-radius`, no blurred shadows.
- Only `src/services/*` import the Supabase client. Components never call Supabase, `fetch` or browser storage for app state directly.
- **Vercel functions (`api/`, D-095)** are a presentation layer only: link previews, OG images, badge PNGs. They read **published** data with the public anon key (never the service-role key, never drafts) and never write. They must not grow into a second backend; data, auth and security stay in Supabase.
- Never put the service-role key, OAuth secrets, or any secret in code, `.env` committed files, or chat. Client env is `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE`, `VITE_PUBLIC_ORIGIN`, and the public feature switch `VITE_FEATURE_PIPS` (`on`/`off`, D-058).
- Database changes = a new file in `supabase/migrations/` + new cases in `supabase/tests/security.test.mjs`. All tests must pass.
- Public pages read `published_cards` only (ADR-002). Moderation happens only through the SQL functions.
- The stage is a Mario-era *style* platformer level (D-020), but no Mario, no Nintendo characters, items, logos, sounds, music, level art, console silhouettes or button layouts. No art copied from the two references. All pixel art is original and lives in `src/lib/sprites.ts`.
- PIP-Hall and PIXENDO are the only brands (D-029). Never put a host organization, chapter or school name or code in UI copy, fixtures, sprites or docs. Org names appear only as admin-entered affiliation data in the database (D-067), never as logos.
- Images are stored as Storage paths (`avatar_path`, `cover_path` = `<owner id>/<uuid>.<ext>`), never URLs (D-027). Build public URLs in `storageService`.
- No invented people in anything a visitor sees. Fixture data lives in `src/data/sample-cards.json` and is used only when `VITE_DATA_SOURCE=fixture`.
- Every screen handles loading, empty and error states (empty/error speak through `DialogueBox`).
- Accessibility floor: WCAG 2.2 AA, keyboard path for everything, `prefers-reduced-motion`, 44px touch targets, status never by colour alone.

## Product rules (v2, D-094)
1. **Every feature has a loop.** Its plan states Trigger → Action → Feedback → Persistent consequence → Reason to return. No loop, no feature.
2. **Useful before registration.** Visitors can explore, search, use the Passport and do Missions without an account (saved on their device). Signing in unlocks persistence, identity, collaboration and the PIP economy, never basic access.
3. **Members own the economy.** Only members with an approved card earn or spend PIPs (D-059). Guest progress is collection history only; it never turns into PIPs.
4. **Every reward has provenance.** Each PIP, achievement, title, stamp or collectible traces to a real action recorded in a ledger or event table (`pip_ledger`, `hall_events`, …). No state that matters lives only in components.
5. **No vanity metrics.** No follower counts, likes, popularity scores, public rankings or engagement streaks. Relationships must be backed by evidence (an accepted collaboration, a shared project).
6. **PIPs never buy reach or access.** They buy cosmetics, collection pages and Mission rerolls; never visibility, ranking or public content.
7. **Don't fake activity.** No invented people, projects, achievements, events or activity to make the world look full. Empty states say so honestly.
8. **The world is the navigation.** When something can happen inside the PIXENDO world (Pip walks to a search result, a block lights up), prefer that to a dashboard list, and always keep a plain list/keyboard equivalent (accessibility).
9. **Motion carries meaning.** New animation must signal navigation, status, ownership, discovery or reward.
10. **Performance budget per feature.** State its added JS (gzipped), images, requests and per-frame work in its plan; the home page stays under 200 KB initial JS and the hall at 60 fps.
11. **Words are fixed:** **Missions** = daily/weekly objectives (D-065); **Quest Log** = a member's projects; **Achievements** = milestones; **Passport** = what you've discovered; **PIPs** = the currency.
12. **Wait for density.** The network graph and project lineage ship only once the hall has enough verified relationships to look alive (about 30 members, judged by projects and collaborations, D-096).

## Not yet justified
Build only when a plan justifies it (and the owner says go): update emails · sound · booth mode · reactions · extra themes · multi-org · private repos · AI features (any "Ask Pip" stays rule-based and free; no paid AI service).

## Commands
```bash
npm run dev          # Vite on :5173
npm run typecheck
npm run lint
npm test             # Vitest
npm run test:db      # node supabase/tests/security.test.mjs (embedded Postgres)
npm run test:e2e     # Playwright
npm run build
```
Before reporting a phase done: typecheck, lint, test, test:db and build all pass, and the phase's acceptance checks are shown as evidence (screenshots for UI).
