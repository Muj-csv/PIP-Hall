# DESIGN_BRIEF — PIP-Hall

Status: Locked — 2026-10-04, design v2 (platformer world). font.body confirmed (D-030)
Updated: 2026-10-04 · Owner: Jum Flores · Values: `docs/design/tokens.json` → exported to `src/styles/theme.css`
Upstream: `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, original spec in `docs/spec/` · Tier: Standard (deadline 6 Oct), Council at Gate 1 (card) and Gate 2 (app)

> **For anyone building:** read this file, then build against `src/styles/theme.css` (generated from `tokens.json`; never hand-edit it). Three rules: (1) only theme tokens, no raw hex and no stock Tailwind palette classes (`bg-indigo-500` etc.); (2) every component state listed in §10 exists; (3) run the AEGIS checks before calling a screen done.

> **Traces.** This file names tokens and gives the reason; values live only in `tokens.json`. Sources: **user** · **ref** (ref1, ref2 below) · **delegated** · **aegis-default** (not yet confirmed) · **brief(from x)**.

## 0. Change from the original spec

`docs/spec/DESIGN_SYSTEM.md` §2 ("visually monochrome") is **superseded by D-008: full colour, like the references.** Everything else in the spec's design system (square/stepped corners, thick outlines, hard shadows, tactile buttons, 200–400ms motion, reduced motion, card as hero) still holds.

**Design v2 (D-020 to D-024):** the stage is a Mario-era *style* side-scrolling level (a requirement Jum stated). §3, §7 and §10 below are updated; §13–§16 hold the construction details. Reference implementation: `docs/design/lab.html` (open it in a browser). Port its behaviour and measurements, not its code style: it's a single-file prototype.

## 1. Anchor

- **ref1 — pixel-art handheld scene** (user-supplied illustration). We take: a game seen *through a device bezel*; the **dialogue box with a portrait**; **emote bubbles** (`…`, `!`, ♥) above characters; crisp 1px-outline pixel art; the muted cozy palette (putty shell, slate-violet bezel, cream wall, teal floor, crimson buttons, green LED). We don't take: the console's silhouette, its D-pad and diagonal two-button layout, its wordmark, or any character or object from the scene.
- **ref2 — lanyard ID badge** (user-supplied illustration). We take: the card as a **badge hanging from a lanyard clip**; a coloured **header band** with an org mark and a department pill; the **photo window**; the **dashed divider**; the **barcode slot** (our QR goes there); **stickers slapped across the edges**; a **faint repeating mascot pattern** behind everything; the sage frame, mauve band and plum ink. We don't take: its logo, its characters, its sticker artwork, or its text.
- **The one job:** browse people as cards — see a face and name in under a second, flip to see their work, reach their profile in two taps.

## 2. Personality

- **Should feel:** cozy, collectible, handmade. Like picking up a friend's badge in a game you've played for years.
- **Should NOT feel:** a SaaS directory with a pixel font pasted on; a neon arcade; a copy of a specific console or game.

## 3. Layout intent

- **Skeleton (home):** one device, one screen. Desktop: the PIXENDO handheld (§14): a wide slab with a left grip (MOVE rocker ◀ ▶), the screen in the middle, a right grip (FLIP, OPEN, DAY/NIGHT). Inside the screen: a HUD strip (PIP-HALL · coins · world · player n/N), then the **level**: a ceiling row of bricks with one emblem block per member, each badge hanging from its block on a lanyard, hills and clouds behind, a ground row in front, and Pip (the hero) standing under the current badge. Under the level, the **text window** (Pip's portrait + one line of dialogue). Search and "Make your card" live in a slim top bar outside the device.
- **Level geometry (pixel units, 1u = 4px):** HUD 0–8u · bricks 10–20u · strap 20–24u · clip 24–28u · badge 28–116u · Pip 120–132u · ground 132–144u. Slot spacing 66u; neighbours scale to 0.84 and fade 12% per slot. The warp tube sits before the first slot (leads to Explore), the goal flag after the last ("you've met everyone").
- **Phone (<860px):** the grips fold into one row under the screen: rocker on the left, FLIP / OPEN / theme on the right. The level keeps the same geometry; only the current badge is fully on screen.
- **Why not the default:** no hero + feature grid, no sidebar + card grid. The page has one object and one way to move through it, the way a game level does.
- **Other screens** (editor, profile, admin, settings) open through the iris wipe into a "menu screen" inside the same device: a single column of pixel panels on `color.world.window`. The editor puts the live badge where the hero badge hangs.
- Trace: ref (ref1 bezel/dialogue, ref2 badge), user (spec §8 carousel model, D-004 both themes, Mario-era requirement), delegated (level geometry, D-020).

## 4. Typography

- `font.display` **Jersey 10** (ref; replaced Pixelify Sans on 2026-10-04 because Pixelify's C/O and B/8 merge at badge sizes): chunky, condensed pixel lettering matching ref1's dialogue box and ref2's bold name. Single weight, so set `font-synthesis: none` (no faux bold) and size it 1.25× the body scale. Used for the wordmark, names, labels, buttons, sticker text, dialogue text. Always caps with 0.04em tracking for labels; never for paragraphs.
- `font.body` **Atkinson Hyperlegible Next** (user, confirmed D-030): bios, project descriptions, form fields, help text. Chosen for legibility next to a decorative face.
- `font.mono` **Atkinson Hyperlegible Mono** (aegis-default): handles, URLs, repo names. Real data, same family as body.
- All three are OFL and self-hosted with `@fontsource` so the PWA works offline.
- **Scale:** 1.25 ratio from 16px (`size.*`). Card text uses `caption` and `body` only; the card never shrinks below 13px text.

## 5. Color

| Role (token) | Why it's this | Trace |
|---|---|---|
| `color.accent` (leads) | ref1's crimson buttons. Only the primary action per screen and the `!` alert. Never decoration. | user (D-008) + ref1 |
| `color.bg` · `surface` · `surface-raised` · `surface-hover` | ref2's paper, badge white and pattern tint. NIGHT derives from ref1's bezel violet. | ref2 / brief |
| `color.text-primary` · `text-secondary` · `text-on-accent` | ref1 ink, ref2 plum; cream at night. | ref |
| `color.border` · `focus-ring` | ref1 bezel violet; every pixel border uses it. Focus ring is the same violet (cream at night). | ref1 |
| `color.success` · `warning` · `danger` | Darkened from ref1's LED green and lamp gold; danger shares the crimson family because the emote shape carries the meaning. | brief |
| `color.shell` · `shell-shade` · `bezel` · `screen` · `floor` · `led` | The device and the stage. LED is green when online, dark when offline (it encodes real network state). | ref1 |
| `color.gold` · `ember` · `wood` · `card.frame` | Sticker fills. Always with ink text. | ref1/ref2 |
| `color.card.*` | The badge. Identical in DAY and NIGHT: the card is a physical object, it stays lit. | ref2 |

Contrast evidence (`tokens_export.py --check`, 2026-10-04): 0 errors; every text pair passes AA in both modes. Lowest: accent on NIGHT surface 4.47 (UI-only use, needs 3.0), band ink 4.76. No warnings remain (the `font.body` HOLD was cleared by D-030).

Rules: `color.card.band` takes ink text only (white fails at 3.4:1). Stickers: `gold` and `ember` take ink text, `wood` takes white (4.9:1). `color.led`, `gold`, `ember`, `wood` are fills, never text.

## 6. Spacing, geometry, density

- Spacing: `space.*`, a 4px pixel grid. Every edge lands on it; nothing off-scale.
- Radius: 0 everywhere. Rounded *looks* come from **stepped corners** (`clip-path` with 4px steps), never `border-radius`.
- Borders: 3px (controls) and 4px (panels, card frame) in `color.border`. Shadows are hard: `shadow.hard` 4px, `shadow.card` 8px, no blur ever.
- Density: game-menu density. Generous inside the stage, compact in forms.

## 7. Interaction character

Two clocks. **Sprites** animate on a stepped frame clock (`motion.sprite-fps`, 8–12fps). **Physical things** (camera, swing, flip) run on smooth springs. Full catalog with numbers in §15.

- **Signature move: jump-to-flip.** Tapping the badge makes Pip jump and headbutt it; the badge spins 180° with overshoot, the block above bumps, a coin pops out and the HUD counter ticks.
- **Swing:** every badge is a pendulum on its clip driven by the camera's acceleration (`motion.swing-spring`, damping 0.86, cap ±12°). Sleeve glare slides with the tilt.
- **Walk:** camera spring with flick detection; parallax clouds 0.2×, hills 0.5×, bushes 0.8×, ground 1×; Pip walks on a 2-frame cycle.
- **Open:** pixel iris closes on the badge (320ms), the profile screen appears, the iris opens.
- **Boot:** once per session: LED blinks, screen dissolves in from random pixels (700ms), Pip drops in.
- Buttons: hardware buttons drop 4px in two frames; page buttons press 3px (spec §11).
- Dialogue: types at ~40 chars/s with a blinking ▼; a tap completes it.
- Reduced motion: no swing, jump, typing, iris or boot; flip swaps instantly; camera jumps; coins still count.
- Sound: none for the 6th (cut list).

## 8. Forbidden list

- Any real console's silhouette, button layout or wordmark. The PIXENDO device is a two-grip slab with a MOVE rocker and labelled action buttons.
- Mario, any Nintendo character, item, logo, sound, music or level art. The *genre* is the requirement (side-scrolling level, blocks, coins, a jumping hero, warp tube, goal flag, HUD); every sprite is original and drawn from the text maps in `src/lib/sprites.ts`. Item blocks carry the PIP-Hall emblem, never a question mark.
- Anything copied from ref1 or ref2: characters, the TII logo, sticker art, text.
- `border-radius` above 0, blurred shadows, glassmorphism, gradients on text, aurora glows.
- Uniform hover-scale on every card; fade-in-on-scroll.
- Emoji as icons. Icons are 12×12 or 16×16 pixel SVGs drawn for this project.
- Placeholder people (Jane Doe, example avatars) in anything a visitor can see. Empty states use the dialogue box instead.
- Stock Tailwind palette classes and raw hex in components.

## 9. Deliberate choices

- allow: #F0ECEB — warm paper page background resembles the 2026 "cream" tell; it is sampled from ref2 and paired with a crimson accent, not sage (ref, 2026-10-04)
- allow: #97B5AA — sage, but only as the badge frame, sampled from ref2 (ref, 2026-10-04)
- allow: font-mono — monospace appears only for handles, URLs and repo names, which are real data (ref, 2026-10-04)

## 10. Components

| Component | Variants | States | Tokens | Notes |
|---|---|---|---|---|
| `HandheldShell` | desktop two-grip slab · phone (grips folded into a row) | online (LED on) · offline (LED off) | shell, bezel, led | LED has `aria-label` "Online"/"Offline"; MOVE rocker + FLIP/OPEN/theme are real buttons |
| `World` | day · night | booting · idle · scrolling | color.world.* | two canvases (bg behind badges, fg in front), drawn at 1px = 1u then scaled with `image-rendering: pixelated` |
| `Hero` (Pip) | idle · walk · jump | — | color.world.* | `aria-hidden`; purely visual, actions are on the buttons |
| `Hud` | — | — | color.world.hud | coins, world, player n/N; `aria-hidden`, the count is also announced by the dialogue |
| `IrisTransition` / `BootScreen` | — | — | ink | skipped under reduced motion |
| `Stage` | home · menu | loading · empty · error | screen, floor | holds carousel or menu panels |
| `CardCarousel` | — | loading (3 skeleton badges) · empty (dialogue) · error (dialogue + retry) | — | renders only current ±2; arrows, swipe, drag, ←/→ keys |
| `MemberCard` | front · back · preview (editor) · compact (grid) | default · focus-visible · flipping | card.* | a single `<button aria-pressed>` toggles flip; links inside are separate focus stops when face is visible |
| `Lanyard` | — | idle · swinging | card.lanyard | decorative, `aria-hidden` |
| `Sticker` | skill · officer · featured · verified-github | — | gold, ember, wood, card.frame | max 3 on front, deterministic placement from username hash |
| `PixelAvatar` | photo · generated | loading · error → generated | card.face, card.ink | generated 10×10 symmetric sprite from username |
| `QrBadge` | inline · fullscreen | — | card.ink, card.face | tap opens fullscreen "SCAN ME" sheet |
| `DialogueBox` | hint · onboarding · empty · error · admin-note | typing · complete | screen, border | portrait = original PIXENDO host sprite; `aria-live="polite"` |
| `Emote` | pending `…` · attention `!` · approved ♥ · featured ★ | pop-in | accent (`!` only), border | always paired with text for screen readers |
| `PixelButton` | primary (accent) · secondary · hardware (device row) · ghost | default · hover · focus-visible · active · disabled · loading | accent, surface, border, shadow.hard | 44px min height on touch |
| `PixelInput` / `PixelTextarea` | — | default · focus-visible · invalid · disabled | surface, border, danger | error text below, never color alone |
| `StatusBadge` | draft · pending_review · approved · rejected · unpublished | — | text tokens + Emote | editor and admin |
| `RepoPicker` | — | not connected · loading · list · rate-limited · empty | surface-raised | up to 6 repos, reorderable |
| `ProjectRow` | github · manual | default · editing · saving · error | — | |
| `SearchBar` + `FilterChips` | — | idle · typing · no results (dialogue) | — | filters in memory |
| `ThemeToggle` | DAY · NIGHT · SYSTEM | — | — | writes `data-theme` |
| `InstallPrompt` | android · ios-instructions | — | — | |
| `ModerationQueue` | pending · published · featured | loading · empty · error | — | same shell, menu stage |
| `Toast` | success · error | — | success, danger | `role="status"` |

Library: none. Everything is custom on top of the theme.

## 11. Responsive & accessibility

- Breakpoints `breakpoint.*`, mobile-first. <640: phone frame, bottom hardware bar. 640–1023: slab with smaller bezel. ≥1024: full slab, neighbours fully visible.
- Floor: WCAG 2.2 AA contrast (verified), visible focus ring (violet / cream), 44px touch targets, reduced motion as in §7, all actions are buttons or links, alt text on every photo ("Photo of {name}"), status never by colour alone (emote shape + text).

## 12. Log

- Explored & rejected: strict monochrome (original spec) — replaced by D-008. Landscape badge like ref2 — rejected for portrait (D-009), fills a phone and matches spec §5. Flat vector card — rejected for pixel-drawn badge (D-010).
- Picked for you (confirm or change): `font.body` confirmed (D-030); `font.mono` Atkinson Hyperlegible Mono, type scale 1.25, easing curve, breakpoints.
- Open questions for AERIAL: none blocking. Sticker sources depend on `skills[]`, `org_position`, `is_featured` and `github_username` (all in the schema).


## 13. Badge construction (design v2, D-021)

- **Size:** real ID-card proportions (CR80, 54 × 85.6 mm) on the pixel grid: 56 × 88u = 224 × 352px. One size on every screen.
- **Layers:** holder (sage plastic, 1u ink outline, lit top-left edge, shaded bottom-right, 4u top / 3u sides / 5u bottom, 2-step corners, slot hole 10 × 1.5u, PIXENDO print on the bottom lip, three tiny original flower/grass doodles) → insert (white card, 3px ink outline) → sleeve glare (two diagonal stripes, 28% white, `--gx` follows the swing angle) → stickers (outside the holder so they overlap edges).
- **Front, top to bottom:** header band (emblem block, PIP-HALL, No.###) · photo window 22u tall (mini level scene, avatar 12u standing on the ground strip, white character-select corner marks, department tag bottom-right, featured star top-right) · name (Jersey 10, 20px, max 2 lines) · @handle (mono) · role (1 line, ellipsis) · stats row (PRJ n · SKL n · YR ’yy, real counts only) · coin-dot divider · footer: three item slots (GitHub, LinkedIn, website; dashed when empty) and the QR (52px) with serial `PIP·###·ABC`.
- **Back (Quest Log):** band with project count n/6 · bio (3 lines) · first 3 projects as numbered stages (01–03) with description and language · skills as ★ power-up tags · VIEW PROFILE (accent). Zero projects shows a "No quests yet" slot.
- **Stickers:** die-cut look (2px ink, 3px white rim, 2px ink, hard shadow), max 3, rotated −8° to +7°, spots chosen from the username hash so a card never reshuffles. Sources: verified GitHub, featured, officer title (`org_position`), first skills.
- **Long content:** names wrap to 2 lines then shrink 1px steps down to 13px; roles ellipsize; bios clamp at 3 lines (full text on the profile page).

## 14. Handheld construction (design v2, D-022)

- **Shape:** wide slab, 4-step staircase corners (16px), 4px lit top-left edge, 12px shaded bottom with a 4px deeper lip (it reads as a thick object), four screws, two 5 × 2 dot grilles, embossed PIXENDO under the screen.
- **Bezel:** slate violet with a lit inner edge; printed line under the screen: POWER LED on the left, "PIP-HALL · PEOPLE, IDENTITY & PROJECTS" on the right.
- **Controls:** left grip MOVE rocker (two halves, ◀ ▶); right grip FLIP (crimson, tallest), OPEN, theme (DAY/NIGHT). Buttons sit on a 6px shadow and travel 4px in two frames.
- **Rules:** one pixel unit everywhere (no mixels); light always from the top left; solid objects get bevels, paper objects don't; corners are staircases, never radii; the LED only shows real network state.

## 15. Motion catalog (design v2, D-023)

| Move | Trigger | Spec | Reduced motion |
|---|---|---|---|
| Boot | first visit per session | LED blinks ×4 (250ms steps) · 2u-cell random dissolve over ~700ms · Pip drops in with gravity 0.22u/f² | none |
| Walk | drag/swipe/◀ ▶/arrow keys | camera spring k 0.11, damping 0.34; flick > 0.5px/ms advances one slot; edges rubber-band at 30%; Pip max 2.2u/f, 2-frame walk every 6 frames | instant |
| Swing | camera acceleration | α = −0.09θ − 0.14ω − 0.9·a_cam; ω × 0.86 per frame; clamp ±12° | off |
| Jump + flip | tap badge, FLIP, Enter/Space | jump v −3.1u/f, gravity 0.22; on head contact (top ≤ 117u): toggle flip (520ms `cubic-bezier(.3,1.35,.45,1)`), block bump −2u for 6 frames, coin spin 4 frames, +1 HUD | instant flip, coin counts |
| Open | OPEN, O, VIEW PROFILE | pixel iris centred on the badge, 19 frames close + 19 open | cut |
| Twinkle | featured | 4-frame star blink every ~3s | static star |
| Talk | each line | ~40 chars/s, tap completes | full line |
| Approved | member's first view after approval | 12-coin shower ~1.2s + "CARD APPROVED!" | text only |

## 16. Sprites (design v2, D-024)

All original, defined as text maps in `src/lib/sprites.ts` with palette keys mapped to `color.world.*` (so NIGHT recolours them): Pip idle/walk/jump (12 × 12), coin ×3 frames (8 × 10), emblem block, used block, brick (10 × 10), ground tile (10 × 12), cloud (20 × 7), bush (14 × 5), warp tube (14 × 14), twinkle ×2 (5 × 5), clip (10 × 4), icons (code, briefcase, globe; 5 × 5), doodles (3 × 3). Hills are drawn procedurally. The generated member avatar is a symmetric 10 × 10 sprite seeded from the handle, outlined in ink so it reads on any background.
