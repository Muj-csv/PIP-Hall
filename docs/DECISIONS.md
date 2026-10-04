# PIP-Hall — Decision log

Format: `ID — decision — date — who — rationale — affects`. **user** = Jum decided. **recommended** = AERIAL's pick, standing unless Jum objects. Superseding a decision adds a new row; old rows stay.

| ID | Decision | Date | Who | Rationale | Affects |
|---|---|---|---|---|---|
| D-001 | Personal project, built in phases with docs and design reviews | 2026-10-04 | user | — | plan |
| D-002 | Editing an approved card sends it back to draft/review; the approved version stays public until the new one is approved | 2026-10-04 | user | Only option where moderation is real without members vanishing from the carousel | schema (`published_cards`), ADR-002 |
| D-003 | Sign in with Google (email for updates); connect GitHub as a second identity; members pick which repos show on their card | 2026-10-04 | user | Google = contact channel; GitHub = verified handle + project source | auth, editor, ADR-003 |
| D-004 | Two worlds (DAY / NIGHT) following the device theme, with a toggle; the card looks the same in both | 2026-10-04 | user | — | tokens `modes.dark` |
| D-005 | Due end of Tue 6 Oct 2026 (Philippine time), as a live URL with real sign-ups working | 2026-10-04 | user | — | schedule |
| D-006 | Compressed plan: lean docs, design reviews at two gates (card, finished app) | 2026-10-04 | user | Full ceremony doesn't fit 2.5 days; keeps moderation and search in scope | plan |
| D-007 | Members can add non-GitHub projects through a manual form | 2026-10-04 | user | Devpost, design work, private repos | `projects.source` |
| D-008 | **Full colour, like the references.** Supersedes spec DESIGN_SYSTEM §2 (monochrome) | 2026-10-04 | user | References: pixel handheld scene + lanyard ID badge | tokens, brief |
| D-009 | Portrait badge (not landscape like ref2) | 2026-10-04 | user | Fills a phone, matches spec §5 | card component |
| D-010 | Card drawn as a pixel badge: ref2's structure with ref1's pixel outlines | 2026-10-04 | user | — | card component |
| D-011 | Carry over: handheld bezel, dialogue box + emote bubbles, lanyard clip with swing, stickers | 2026-10-04 | user | — | DESIGN_BRIEF §3, §7, §10 |
| D-012 | Single organization; drop `organization`, add `org_position` | 2026-10-04 | recommended | Multi-org adds ~40% work the deadline can't absorb | schema |
| D-013 | Greenfield repo `pip-hall` under GitHub Muj-csv (renamed from `pixel-pass`, D-025) | 2026-10-04 | recommended | Only the spec exists | repo |
| D-014 | Username defaults to the GitHub handle, locked after first approval; admins can rename | 2026-10-04 | recommended | QR codes point at the username | schema, `admin_set_username` |
| D-015 | Drop `organization_only` visibility from MVP | 2026-10-04 | recommended | Spec never defines who "the organization" is; every approved card is public | schema |
| D-016 | Public GitHub repos only, fetched in the browser without a token, saved as a copy | 2026-10-04 | recommended | No token to store or refresh; visitors never wait on GitHub | ADR-003 |
| D-017 | Max 6 projects and 8 skills per card; back of the card shows the first 3 projects | 2026-10-04 | recommended | Fits the card; full list on the profile page | schema, card |
| D-018 | Update emails: store opt-in now, send after launch (Gmail SMTP app password or Resend with a domain) | 2026-10-04 | recommended | Not needed for the 6th | `email_updates` |
| D-019 | Custom stack carousel on Motion, not Embla | 2026-10-04 | recommended | See ADR-001 | carousel |
| D-020 | **Mario-era platformer style for the stage** (a stated requirement): side-scrolling level, block row, coins, jumping hero, warp tube, goal flag, HUD. All art original; no Nintendo characters, items or console design | 2026-10-04 | user (style) · delegated (execution) | Requirement for the project's theme; genre conventions are shared, specific characters and assets aren't | world, sprites, brief §3 §16 |
| D-021 | Badge rebuilt at CR80 ID proportions (56 × 88u) as holder + insert + sleeve glare + stickers | 2026-10-04 | delegated | Reads as a real lanyard ID; fixed size keeps text legible | brief §13 |
| D-022 | Handheld becomes a two-grip slab: MOVE rocker left, FLIP/OPEN/theme right; folds into one row on phones | 2026-10-04 | delegated | Thumb positions of a real handheld without copying any console | brief §14 |
| D-023 | Two-clock motion: stepped sprite frames + spring physics; signature move is jump-to-flip | 2026-10-04 | delegated | Feels like a 16-bit game while physical things stay smooth | brief §7 §15 |
| D-024 | Pip, an original critter, is PIXENDO's host: the hero in the level and the face in the text window | 2026-10-04 | delegated | One character for both voice and action | sprites |
| D-025 | **Project renamed from PIXEL PASS (working title) to PIP-Hall — People, Identity & Projects Hall.** Tagline: "Where every person has a place." PIXENDO stays as the in-world console brand; Pip stays as the host | 2026-10-04 | user | Jum's chosen name and tagline | all docs, UI copy, repo name, DB setting `piphall.internal`, reserved usernames, QR serial prefix `PIP` |
| D-026 | Display font is **Jersey 10**, not Pixelify Sans | 2026-10-04 | delegated (legibility fix) | Render check with real fonts: Pixelify merged C/O and B/8 at 11–16px; Jersey 10 stayed legible and fits badge widths | tokens `font.display`, brief §4 |
| D-027 | **Images are Storage paths, not URLs.** `avatar_url`/`cover_url` become `avatar_path`/`cover_path`, pinned by a check to `<owner id>/<uuid>.<ext>`; the client builds the public URL | 2026-10-04 | user (AERIAL review H2) | Any https URL let a member swap an approved photo from a server they control, bypassing D-002 | migration `20261004000200_image_paths.sql`, `build_card()`, 8 new security tests |
| D-028 | Pin **TypeScript 6.0.3**, not 7.x | 2026-10-04 | user (AERIAL review H1) | `typescript-eslint` 8.71 (latest) supports `typescript <6.1.0`; TS 7 would break `npm run lint` | ARCHITECTURE §3 |
| D-029 | **PIP-Hall and PIXENDO are the only brands.** The hall never names a host organization, chapter or school; sample and prototype data carry no org/school codes. Repo holds the project at its root (no zip) | 2026-10-04 | user | PIP-Hall is the product, PIXENDO its world; it shouldn't read as one org's page | `docs/design/lab.html` (HUD `WORLD 1-1`), `docs/plan/build-plan.html`, fixtures in Phase 1 |
| D-030 | Credits name is **Jum Flores** (@Muj-csv). `font.body` Atkinson Hyperlegible Next confirmed | 2026-10-04 | user | Clears the last design HOLD before Gate 1 | README, docs owner lines, brief §4 |

## Picked for you (design) — confirm or change
- ~~`font.body` Atkinson Hyperlegible Next~~ confirmed (D-030) · `font.mono` Atkinson Hyperlegible Mono · type ratio 1.25 · easing curve · breakpoints 640/768/1024.
