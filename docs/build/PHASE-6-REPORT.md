# Phase 6 — Gate 2 report (5 Oct 2026)

Live URL: **https://the-pip-hall.vercel.app** (Vercel, from `main`).

The build sandbox's network policy blocks the live URL and the Supabase project, so this report separates what was **verified here** (latest `main`, `3bad2a2`, plus this phase's fixes) from what **you check on the live site**. Each live check takes a minute; tick them in this file.

## Definition of Done

| # | Check | Verified here | On the live site (owner) |
|---|---|---|---|
| 1 | New user registers (Google), connects GitHub, builds profile, adds projects, previews, submits | ✅ e2e against a mocked Supabase + GitHub API (`e2e/editor.spec.ts`, `auth.spec.ts`) | [ ] with an account that isn't yours |
| 2 | Admin approves; card appears in the public carousel | ✅ `e2e/admin.spec.ts` (approve → card in the hall from `published_cards`); DB: `approve_profile` tests | [ ] |
| 3 | Card flips (mouse, touch, keyboard); carousel drags, swipes, snaps | ✅ `e2e/hall.spec.ts` on desktop and phone (Pixel 7) | [ ] quick try on your phone |
| 4 | QR opens the public member page from a real phone; links work | ✅ cold load of `/member/:username` (fixture and Supabase); `vercel.json` rewrite | [ ] scan a printed or on-screen QR with a phone |
| 5 | Edit after approval → public card unchanged until re-approved | ✅ DB tests "editing an approved card returns it to draft", "public card still shows the approved bio"; editor e2e | [ ] |
| 6 | PWA installs; mobile and desktop layouts usable; DAY and NIGHT | ✅ Chrome reports no installability errors; offline load; render check 390/768/1440 × DAY/NIGHT, no overflow | [ ] install on Android and on an iPhone; opens full screen |
| 7 | Data persists across sessions and devices | — needs the real database | [ ] sign in on a second device, see the same card |
| 8 | Protected routes enforced; `/admin` refused for members (UI and RPC) | ✅ e2e (redirects, "Admins only", RPC refused) + 76 DB security tests (member cannot approve/reject/unpublish/feature/rename) | [ ] open `/admin` as a member |
| 9 | No secrets in the bundle or repo | ✅ full git history, tracked files and `dist/` scanned for service-role / secret keys, OAuth secrets, tokens: none. Only `.env.example` is tracked | — |
| 10 | Loading, empty and error states seen on every route | ✅ Phase 5 audit + route error screen; e2e covers empty and error for hall, explore, member, admin, settings | — |
| 11 | Google consent screen In production; tested with an account that isn't yours | — Google Cloud console | [ ] |
| 12 | Keepalive workflow green | ❌ **Ran once (manual): it skipped because `SUPABASE_URL` / `SUPABASE_ANON_KEY` secrets aren't set, yet showed green.** Fixed: it now fails when they're missing | [ ] add the two secrets, Actions → Keepalive → Run workflow, see green |
| 13 | AEGIS Council on the finished app → CLEAR or HOLD with only accepted items | **HOLD (self-reviewed)**: one P1 = row 12. See `docs/design/COUNCIL_2026-10-05_gate2.md` | clears with row 12 |
| 14 | README: what it is, live URL, screenshots, how to run, credits | ✅ live URL, production screenshots, setup, credits | — |

## Checks run on latest `main`

- typecheck ✓ · lint ✓ · 115 unit tests ✓ · build ✓ (first-load JS 89 KB gzipped, 33 precached files) · 70 e2e ✓ (desktop, phone, Supabase data source) · 76 database security tests ✓
- CI on `main` (`3bad2a2`): green
- AEGIS: token/contrast check 0 errors; slop lint: no visitor-facing findings; render check: no overflow or clipping at 390/768/1440 in DAY and NIGHT. Contrast flags only on faded neighbour badges (accepted at Gate 1) and the decorative "PIXENDO" holder print

## Changes in this phase

- `keepalive.yml` fails instead of skipping when its secrets are missing (a skipped ping looked green).
- README: live URL, "live" status, screenshots of the real app.
- Design brief: badge and handheld pixel offsets recorded as a Deliberate choice.
- Council report and this report.

## Open decision for you

- **Phone header on Home (Council P2):** hide the top bar's DAY/NIGHT/AUTO on Home below 640px (the handheld has its own DAY/NIGHT button), so the hall starts about 60px higher. Say the word and it's a small change.
