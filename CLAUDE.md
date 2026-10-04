# PIP-Hall — build rules for coding agents

**PIP-Hall (People, Identity & Projects Hall)** is a game-inspired showcase where organization members become interactive player cards: collectible pixel ID badges inside an original handheld console world called PIXENDO. Tagline: *Where every person has a place.* Visitors swipe through badges hanging from lanyards, flip one to see the member's projects, and scan its QR to open the member's public page. Members sign in with Google, connect GitHub, pick repos, and submit their card. An admin approves it into the public collection. Due **end of Tue 6 Oct 2026 (PHT)** as a live URL.

## Read first
1. `docs/DECISIONS.md` — what's decided. Don't relitigate; flag a concern once and move on.
2. `docs/ARCHITECTURE.md` — stack, data model, security, routes, folders.
3. `docs/design/DESIGN_BRIEF.md` + `src/styles/theme.css` — how it looks and moves.
4. `docs/build/PHASE-N.md` — the phase you're on. Do only that phase, then **stop and report**.
The original spec is in `docs/spec/`. Where it conflicts with the files above, the files above win (e.g. D-008 full colour replaces monochrome).

## Hard rules
- Stack: React + Vite + TypeScript (strict) + Tailwind 4 + Motion + React Router + Supabase. No Embla (ADR-001), no state library, no UI kit, no paid services.
- Styling only through `src/styles/theme.css` tokens (generated from `docs/design/tokens.json` — edit the JSON and re-export, never the CSS). No raw hex in components, no stock palette classes, no `border-radius`, no blurred shadows.
- Only `src/services/*` import the Supabase client. Components never call Supabase or `fetch` directly.
- Never put the service-role key, OAuth secrets, or any secret in code, `.env` committed files, or chat. Client env is `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DATA_SOURCE`, `VITE_PUBLIC_ORIGIN`.
- Database changes = a new file in `supabase/migrations/` + new cases in `supabase/tests/security.test.mjs`. All tests must pass.
- Public pages read `published_cards` only (ADR-002). Moderation happens only through the SQL functions.
- The stage is a Mario-era *style* platformer level (D-020), but no Mario, no Nintendo characters, items, logos, sounds, music, level art, console silhouettes or button layouts. No art copied from the two references. All pixel art is original and lives in `src/lib/sprites.ts`.
- PIP-Hall and PIXENDO are the only brands (D-029). Never put a host organization, chapter or school name or code in UI copy, fixtures, sprites or docs.
- Images are stored as Storage paths (`avatar_path`, `cover_path` = `<owner id>/<uuid>.<ext>`), never URLs (D-027). Build public URLs in `storageService`.
- No invented people in anything a visitor sees. Fixture data lives in `src/data/sample-cards.json` and is used only when `VITE_DATA_SOURCE=fixture`.
- Every screen handles loading, empty and error states (empty/error speak through `DialogueBox`).
- Accessibility floor: WCAG 2.2 AA, keyboard path for everything, `prefers-reduced-motion`, 44px touch targets, status never by colour alone.

## Do not build yet (after 6 Oct)
Update-email sending · Messenger/OG link previews · sound · booth mode · PNG export · reactions · extra themes · multi-org · private repos.

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
