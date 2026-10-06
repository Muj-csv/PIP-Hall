# PIP-Hall v1.0: launch report (6 Oct 2026)

**Live:** https://the-pip-hall.vercel.app (Vercel, from `main` at `449e157`).
**Due:** end of Tue 6 Oct 2026 (PHT). **Status:** launched and checked on the live site by the owner.

This picks up where the Gate 2 report ([`PHASE-6-REPORT.md`](PHASE-6-REPORT.md), 5 Oct) left off. It lists what shipped after Gate 2, the checks run on the final `main`, the database steps and what's left for after launch.

## What shipped after Gate 2

Decision numbers point to [`docs/DECISIONS.md`](../DECISIONS.md); each feature has screenshots in [`evidence/`](evidence/).

| Area | What visitors and members get | Decisions | Evidence |
|---|---|---|---|
| **PIPs** *(feature switch `VITE_FEATURE_PIPS`)* | Earn PIPs for discovering members and getting projects approved; achievements on profiles; HUD coin counter | D-058 – D-066 | [`phase-e1/`](evidence/phase-e1/) |
| **PIP MART** | Badge frames to buy and equip, plus affiliation perk frames | D-074 – D-076 | [`phase-e2/`](evidence/phase-e2/) |
| **Museum** | A public gallery of members' projects; admins grant access through affiliations; members choose what hangs; exhibits follow the approved card; every exhibit has its own page | D-067 – D-073 | [`museum/`](evidence/museum/) |
| **Hall + search** | Search, filters and Random player moved into the hall | D-072 | [`hall-explore/`](evidence/hall-explore/) |
| **First run** | A power-on screen; new members get a guided setup | D-077, D-078 | [`polish/`](evidence/polish/) |
| **Art and feel** | Art and navigation pass; collectible badges; grab and fling; badge motion and shine; panels v2; a deeper original world (trees, birds, moon, stars) | D-079 – D-086 | [`art-pass/`](evidence/art-pass/), [`collectible/`](evidence/collectible/), [`fling/`](evidence/fling/), [`badge-motion/`](evidence/badge-motion/), [`panels-v2/`](evidence/panels-v2/), [`world-depth/`](evidence/world-depth/), [`world-panels/`](evidence/world-panels/) |
| **Museum featured row** | Featured makers' exhibits pinned on top, out of the shuffle; diorama frames | D-083 | [`museum-v3/`](evidence/museum-v3/) |
| **Admin rewards** | Admins design badges, borders and achievement rewards, and give them | D-087 | [`admin-rewards/`](evidence/admin-rewards/) |
| **Share the hall** | A button with a QR code for the site, for posters and screens | D-088 | [`share/`](evidence/share/) |
| **Collaborators** | Tag members on a project; they accept or decline; credits go public with the next approval | D-089 | [`collaborators/`](evidence/collaborators/) |
| **Made by** | An exhibit shows every maker's badge; profiles list collaborations | D-090 | [`made-by/`](evidence/made-by/) |
| **Console frames** | Exhibits hang in five original PIXENDO consoles; the maker picks one or it's automatic; the screen boots when seen | D-091 | [`consoles/`](evidence/consoles/) |
| **App previews** | Screens show the member's screenshot, else GitHub's repo preview, else a pixel cover | D-092 | [`previews/`](evidence/previews/) |

The full Museum v3 plan (collaborators, Made by, consoles, previews) is in [`docs/plan/MUSEUM-CONSOLES.md`](../plan/MUSEUM-CONSOLES.md).

## Checks on the final `main` (`449e157`)

| Check | Result |
|---|---|
| CI on `main` (typecheck, lint, unit, build, secret scan, e2e, database) | ✅ green, run #137 |
| TypeScript strict, ESLint | ✅ 0 errors |
| Unit tests (Vitest) | ✅ 181 |
| End-to-end (Playwright: desktop, phone, mocked Supabase) | ✅ 156 |
| Database security tests (embedded Postgres) | ✅ 272, plus 7 upgrade checks |
| Production build | ✅ |
| Secrets | ✅ none in the repo or bundle; CI fails the build if `service_role` appears in `dist/` |
| Live site, signed in, by the owner | ✅ hall, card editor (screen picture, collaborator), approval, Museum consoles and previews, Made by, NIGHT |

Test counts at Gate 2 were 115 unit, 70 e2e and 76 database tests.

## Database: migrations in order

All are in `supabase/migrations/`, run in name order in the Supabase SQL editor, one query per file. Each is safe to run again. [`docs/DEPLOY.md`](../DEPLOY.md) has a check for each.

| Migration | Adds |
|---|---|
| `20261004000000_init.sql` … `20261004000400_admin_checks.sql` | Core schema, Storage, image paths, member numbers, admin checks (Gate 2) |
| `20261005000000_pips_core.sql` | PIPs and achievements |
| `20261005000100_museum.sql` | Affiliations, Museum entries |
| `20261005000200_museum_relink.sql` | Links approved projects to stable ids |
| `20261005000300_museum_follows_card.sql` | Exhibits follow the approved card |
| `20261006000000_pip_mart.sql` | PIP MART items and inventory |
| `20261006000100_museum_featured.sql` | Featured flag on exhibits |
| `20261006000200_admin_rewards.sql` | Admin-made badges, borders and rewards |
| `20261006000300_project_collaborators.sql` | Collaborators, credits in the public card |
| `20261006000400_museum_consoles.sql` | Console choice per exhibit |

## Rules kept

- **Original art only:** every sprite, the PIXENDO handheld, the five consoles and Pip are drawn in `src/lib/sprites.ts`. No real console shapes, logos or button layouts. PIP-Hall and PIXENDO are the only brands.
- **One rule for what's public:** visitors read only approved snapshots (ADR-002). Collaborators and screen pictures go public with an approval; Museum picks and console choices are cosmetic and show at once.
- **Consent:** nobody is credited on a project unless they accept.
- **Accessibility floor:** WCAG 2.2 AA, a keyboard path for everything, `prefers-reduced-motion` (the consoles stay still and flat), 44px targets.

## Known limits

- GitHub's repo preview is GitHub's own generated image. It exists only for public repos, and if it fails to load the screen shows the pixel cover.
- Collaborators can only be tagged on saved projects, and only members whose card is in the hall can be tagged (up to 8 per project).
- The live site can't be reached from the build sandbox, so live checks are the owner's (done for this release).

## After launch

From the "Do not build yet (after 6 Oct)" list in [`CLAUDE.md`](../../CLAUDE.md), suggested order:

1. **Link previews** (Messenger and other chat apps show the member's card when a profile link is shared). The most useful one, since links are being shared from launch day.
2. **PNG export** of a badge.
3. **Update emails** (the opt-in is already stored).
4. Booth mode, reactions, sound, extra themes, multi-org, private repos.
