# AEGIS Council — Gate 2, the finished app — 2026-10-05

**Gate: CLEAR (self-reviewed)**: the design, states and accessibility are ready to ship, and the one production item is closed: the keepalive now reaches the database (`HTTP 200`, run #2).
Was HOLD until the owner added the `SUPABASE_URL` and `SUPABASE_ANON_KEY` repository secrets on 5 Oct.
<sub>P0 = blocks the build or demo · P1 = fix before building on it · P2/P3 = can ship with a note. "Self-reviewed" = the same pass built and reviewed it.</sub>

Reviewed: production build (`vite build`, fixture data, `vite preview`) at `/`, `/explore`, `/member/:username`, `/privacy`, a 404; evidence screenshots in `docs/build/evidence/phase-1…5/` (editor, admin, settings); `tokens.json`, `DESIGN_BRIEF.md`, `ARCHITECTURE.md`, `DECISIONS.md`. The live URL could not be opened from the build sandbox (network policy), so nothing here was checked on production itself.
Council: Council-lite (one pass through the four seat checklists; no independent reviewers were spawned).
Checks: slop lint ✓ 6 strong (all `example.org` in unit tests, not visitor-facing), 2 weak (stats row is three parallel stats; off-scale spacing now a Deliberate choice) · tokens/contrast ✓ 0 errors · render ✓ 390/768/1440 × DAY/NIGHT, no overflow or clipping · axe 0 violations (Phase 5) · Lighthouse mobile perf 90–97, a11y 99–100 (Phase 5)

## Picked for you (change any?)
Load-bearing tokens (`color.accent`, `color.bg`, `font.display`, `font.body`) and the layout intent are all traced `ref:` or `user:`. Not load-bearing and still `aegis-default:` (listed in DECISIONS "Picked for you"): `font.mono` Atkinson Hyperlegible Mono · type sizes caption/body/h3/h2/h1/display (ratio 1.25) · `motion.easing` · breakpoints 640/768/1024.

## Strengths
1. Adversary · whole app: passes the strip test. With the name removed it still reads as one product: lanyard ID badges in a handheld platformer, original sprites, every value traced.
2. Architect · every route: loading, empty and error states speak through `DialogueBox`, including the new route error screen (D-047); same components across hall, member page, explore, editor and admin.
3. Advocate · keyboard and screen reader: axe clean in both themes and viewports; tabs, chips and toggles say their state with text, not colour (aria-pressed, ✓, ★).
4. Engineer · token path: one `tokens.json` → generated `theme.css`; no raw hex in components (lint `--tokens` clean); first-load JS 89 KB gzipped.
5. Advocate · real-world failure paths: in-app browser warning on sign-in (D-051), iPhone photo fallback to JPEG (D-052), offline shell, wrong device clock (D-049).

## Problems
| # | Sev | Seat(s) | Location | What's wrong | Principle | Fix / question | Tag |
|---|---|---|---|---|---|---|---|
| 1 | P1 | Engineer | `.github/workflows/keepalive.yml`, repo secrets | The keepalive has never pinged: the secrets are unset, and the job skipped with a warning yet showed green. A free Supabase project pauses after a week idle, taking every card and QR offline | A check that can't fail isn't a check | **Fixed:** the job now fails when the secrets are missing; the owner added them and run #2 returned HTTP 200 | missing → resolved |
| 2 | P2 | Advocate | `/` at 390px | On a phone the top bar wraps to two rows (DAY · NIGHT · AUTO · Explore / Make your card) plus the tagline, so the hall's screen starts about 320px down | The one job (browse members) is first | Option: hide the top bar's DAY/NIGHT/AUTO on Home below 640px, since the handheld has its own DAY/NIGHT button. Your call | — |
| 3 | P2 | Advocate | `/` neighbour badges | Faded neighbours drop some text to about 4.0:1 (render check FAILs on No.003, `@sample-player-3`, the SAMPLE sticker) | Contrast | Accepted at Gate 1; neighbours are `aria-hidden` and become full contrast when they're the current card. No change | — |
| 4 | P3 | Advocate | badge holder print "PIXENDO" | 1.5:1, flagged by the render check | — | Decorative logotype, `aria-hidden`; WCAG exempts logotypes. No change | — |
| 5 | P3 | Architect | `README.md` | Status and screenshots still described the prototype | Docs match the product | **Fixed:** live URL, status, app screenshots | — |

## Tradeoffs for the user to decide
- Problem 2: a shorter phone header (theme switch only inside the handheld on Home) vs. the same top bar on every screen.

## Seat verdicts
Architect: CLEAR · Adversary: CLEAR · Advocate: CLEAR (P2s noted) · Engineer: CLEAR (keepalive green, HTTP 200).
