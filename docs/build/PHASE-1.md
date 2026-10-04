# Phase 1 — Card + carousel on sample data (Sun 4 Oct, evening)

**Goal:** the hero experience works and looks finished on fixture data. Implements FR-09, FR-10, FR-12 (inline QR), FR-15.

**Do**
1. Scaffold Vite + React + TS strict + Tailwind 4 (`@tailwindcss/vite`) + Motion + React Router. Import `src/styles/theme.css`. Self-host fonts with `@fontsource`. Add `vercel.json` SPA rewrite now.
2. `src/types/card.ts` (`PublicCard` matching `build_card()` in the migration) and `cardService` with the `fixture` implementation reading `src/data/sample-cards.json` (6 clearly fictional sample cards named "Sample Player 1…6", one with no photo, one with 0 projects, one with 6, one featured, one with a 60-char name).
3. Components per DESIGN_BRIEF §10 and the construction specs in §13–§16 (reference: open `docs/design/lab.html`). Includes `World` (bg + fg canvases), `Hero`, `Hud`, `IrisTransition`, `BootScreen`, `src/lib/sprites.ts`, `useSwingPhysics`, and: `HandheldShell`, `Stage`, `HardwareBar`, `TopBar`, `ThemeToggle`, `MemberCard` (`CardFront`, `CardBack`), `Lanyard`, `Sticker`, `PixelAvatar`, `QrBadge`, `QrFullscreen`, `DialogueBox`, `Emote`, `PixelButton`, `PixelIcon`.
4. `CardCarousel` + `useCarousel` per ADR-001: current ±2 rendered, drag/swipe with snap, lanyard swing, arrows, ←/→, Enter/Space flip, tap-vs-drag threshold, reduced motion.
5. Home page `/`: wordmark, carousel inside the shell, dialogue hint "Drag to browse. Tap a card to flip it.", "Make your card" CTA (links to `/login`, inert for now).
6. Unit tests for `useCarousel` index math, `lib/avatar.ts` determinism, sticker placement determinism.

**Acceptance (show evidence)**
- Screenshots at 390, 768, 1440 in DAY and NIGHT, front and back.
- Keyboard only: browse, flip, open QR full screen, close it.
- Drag on desktop and touch emulation; a drag never flips; a tap always flips.
- AEGIS checks: `slop_lint.py src --allow docs/design/DESIGN_BRIEF.md --tokens docs/design/tokens.json`, `render_check.py` on the dev server.
- typecheck, lint, test, build pass.

**Don't touch:** Supabase, auth, editor, admin.

**Then stop:** this is Gate 1 (AEGIS Council on the card). Report and wait.
