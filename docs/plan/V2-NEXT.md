# PIP-Hall v2, part two: the hall comes alive

Status: **planned** (2026-10-07). Follows `V2-LIVING-HALL.md` (V2-0 to V2-8, all built). No deadline (D-093). Decisions: D-106 to D-113 (the owner's answers, 2026-10-07). Rules: `CLAUDE.md` → Product rules.

## Why this round

The audit of the original v2 review (30 points) found most of it built. What's left falls into three groups:

- **Gaps** in things that were built ("mostly built"): two Missions, connected projects, the QR landing, the badge PNG, member progress, a Mentor title, Museum wings with character, event skies, more PIP sinks.
- **The best candidates** not built at all: the design rules reworded as invariants (#18) and a world that reacts to real events (#26).
- **#29**: Ask Pip, booth mode and sound (P2); multi-org (P3, design only).

Same discipline as before: one phase at a time, SQL first where there is SQL, every feature states its loop and budget, then stop and report.

## Decisions taken for this round (2026-10-07)

| # | Question | Answer |
|---|---|---|
| D-106 | Multi-org (#29) | **Design only.** One hall stays. An architecture note (ADR-003) describes how halls would be separated, so it's ready if a second organization asks. No code |
| D-107 | World-centric device (#25) | **START menu + iris.** A START button on the device opens an in-device menu (HALL, MUSEUM, PASSPORT, MAP, MART); choosing one irises into that place. The Museum and Mart keep full-size pages |
| D-108 | New PIP cosmetics (#8) | **All four:** badge stickers (public), Pip outfits, Passport covers, hall effects (the last three only visible to the owner) |
| D-109 | Booth mode (#29) | **Kiosk + check-in stamp.** Full-screen attract mode for a laptop or projector, a big QR, and a Passport stamp for visitors who check in during that event (no PIPs for guests) |
| D-110 | Sound (#29) | **Effects only, off by default.** Original 8-bit effects synthesized in the browser (no audio files, nothing borrowed); a speaker toggle, remembered on the device |
| D-111 | Mentor title (#10) | **Built with 2 newer members:** credited on team projects with 2 different members who joined the hall after you |
| D-112 | Member progress (#10) | **Only to the member.** "Missions completed" and achievement progress show in your own Passport and My card; the public profile keeps proof (titles, achievements), no activity counts |
| D-113 | Event look (#9) | **A sky per event.** The admin picks one of a few original skies (Dusk, Starry night, Festival with bunting) when scheduling; the hall changes for the event's dates |

## Phases (suggested order)

The order puts the cheap, high-value gaps first, then the things that make the world feel alive, then the bigger features. Say if you want a different order.

### V2-9 · Close the gaps (P1, small)

**Loop:** the things people already use answer one more question each (who else made this, who's near this person, what have I done).

- **#18 Design invariants.** `DESIGN_BRIEF.md` §8 "Forbidden list" becomes **Visual invariants** (what never changes: tokens only, no blur, no rounding, original art, 4px grid, 44px targets, reduced motion, WCAG 2.2 AA) plus **How to change one**: a decision in `DECISIONS.md` with the reason, then the token or rule change. `CLAUDE.md` says the same. No code.
- **#11 Connected projects on the exhibit page.** "Connected projects": other projects that share a maker, with who connects them. Shown whenever such a link exists (one real link is honest even in a small hall; the density gate is for the whole map).
- **#2 "Made with" on profiles.** A small map of one member's own links (projects made together, shared skills). Always on, because it only shows that member's real credits; the full `/network` map keeps its gate.
- **#12 QR landing.** After "You found X!", a short **Related people** row (made something together, shares a skill) with Walk there buttons that walk Pip to them.
- **#21 Badge PNG.** The download also carries the member's earned title on its plate and their admin-given badges (pins), like the badge in the hall.
- **#10 Your progress.** In your own Passport: Missions completed (today, this week, all time) and achievements unlocked out of the total. Never on the public profile (D-112).
- **#10 Mentor title** (D-111): credited on team projects with 2 different members who joined after you.
- **#3 Two more Missions:** "Find a project made by 3 or more people" and "Meet 3 people who know <skill>" (offered only when the hall has them).
- **#15** decided, no change: discoveries stay private (D-063), and an "equipped a frame" event has nothing that would use it.
- **#23 Server check.** Find out why the live server functions error (the badge download did; link previews may too). Needs from you: what `the-pip-hall.vercel.app/api/og/hall` shows in a browser, or that function's log in Vercel.
- **SQL:** Mentor in `earned_titles()`; the two Missions in `mission_met()` and `complete_mission()`; a public `connected_projects` is not needed (cards carry the credits).
- Budget: ≤ 4 KB gzipped JS; no new requests on the hall's first load.

### V2-10 · The world reacts (#26, #9 sky) (P1)

**Loop:** something real happens → the world shows it where it happened → people go and look.

- **NEW!** over a member's block for 7 days after their first approval; when Pip reaches it, Pip reacts and a few coins pop (once per visit).
- **Featured** members' blocks carry a star.
- **Threads:** a thin dashed line between the badges of two members who made something together, while both are on screen.
- **Mission complete:** the world answers (a flag goes up at the end of the level and Pip celebrates), not just a message.
- **Event skies** (D-113): Dusk, Starry night, or Festival (bunting across the sky), original art and tokens, for the event's dates only.
- **Temporary event wing:** during an event, the Museum gets a wing of exhibits added during the event, which closes when it ends.
- All of it still with reduced motion (signs stay, motion stops), and every change has a words equivalent (NEW and Featured are in the badge's label; threads are in the "Made with" list).
- **SQL:** a public first-approval date (`member_first_seen` or a column set at first approval); `hall_seasons.sky` (checked list); the event wing as a built-in wing kind.
- Budget: ≤ 6 KB gzipped JS; per frame, threads are drawn only for badges on screen.

### V2-11 · The device is the world (#25) (P1)

**Loop:** press START → pick a place → iris into it → BACK brings you home.

- A **START** button on the device and an in-device menu: HALL, MUSEUM, PASSPORT, MAP (when open), MART (members). Keyboard: Enter/Esc, arrows; screen readers get a normal menu.
- Choosing a place irises out of the device into that page; the page's BACK irises back into the hall where you left it.
- The top bar stays (it's the plain way round).
- No SQL. Budget: ≤ 3 KB gzipped JS.

### V2-12 · More to spend PIPs on (#8) (P1)

**Loop:** earn PIPs by exploring → choose how you look or how your hall feels → it shows (to everyone, or just you).

- **Badge stickers** (public): 6–8 original pixel stickers, up to 3 placed on your badge in fixed spots. Suggested 120–250 PIPs each.
- **Pip outfits** (only you): hats and scarves for your Pip. Suggested 100–200.
- **Passport covers** (only you): 3–4 cover and page styles. Suggested 150–300.
- **Hall effects** (only you): a coin trail behind Pip, a sparkle on flip. Suggested 150–250; off with reduced motion.
- **Seasonal collectibles:** each event can sell one limited sticker, and anyone who did something during the event gets a free event stamp in their Passport (earned, not bought).
- Never visibility, ranking or access (rule 6). All art original, in `sprites.ts`.
- **SQL:** new PIP MART kinds (sticker, outfit, cover, effect) with checked styles; what each member wears in `card_appearance` (stickers public through `card_appearances()`); everything else read only by its owner.
- Budget: ≤ 6 KB gzipped JS plus sprites.

### V2-13 · Museum wings with character (#5) (P2)

**Loop:** enter a wing → it looks and feels like its subject → meet its makers → follow the path to the next wing.

- Each wing gets a **style** from fixed presets (e.g. Arcade, Lab, Library, Garden): door art, an accent and a header scene, original sprites and tokens.
- In each room: **Makers in this wing** (their badges), **Skills in this wing**, and **Next wing →**.
- **SQL:** `museum_wings.style` (checked list).
- Budget: ≤ 4 KB gzipped JS plus sprites.

### V2-14 · Ask Pip (#22) (P2)

**Loop:** ask in your own words → Pip answers with people and why → Pip walks you to them.

- A question box ("Who could help me build a mobile app?"). Rule-based, free, no AI service (CLAUDE.md): words are matched to skills, tools, departments and project words, with a small synonym table (mobile → Flutter, Kotlin, Swift, React Native; data → Python, SQL, Pandas…).
- The answer lists people with the reasons ("Why Pip picked"), and Pip walks to the first one; a plain list for keyboards.
- When nothing matches, Pip says so and suggests the closest skills that exist.
- No SQL. Budget: ≤ 5 KB gzipped JS.

### V2-15 · Booth mode (#29) (P2)

**Loop:** a laptop at a fair shows the hall → visitors scan → they land in the hall with a check-in stamp → some make a card.

- **`/booth`** (admins start it): full screen, cycles through badges and the Museum on its own, a large QR ("Scan to explore the hall"), returns to the start after a minute untouched, no sign-in on the kiosk.
- **Check-in** (D-109): the QR points at the live event; scanning stamps the visitor's Passport "Visited the PIP-Hall booth at Build Week". Guests: on their device; members: in their account. No PIPs (rule 3); once per event.
- **SQL:** event check-ins for members (one per member per event), counted in the event's real counters.
- Budget: a lazy page; no change to the hall.

### V2-16 · Sound (#29) (P2)

**Loop:** turn sound on → the hall answers your actions (coin, flip, stamp, Mission done) → it stays your choice.

- Original 8-bit effects made with the Web Audio API in code (no files, nothing sampled or borrowed, D-029/D-020).
- Off by default; a speaker toggle in the top bar and in Settings, remembered on the device. No sound without a gesture first (browsers require it anyway).
- No music (D-110).
- No SQL. Budget: ≤ 3 KB gzipped JS.

### V2-17 · Multi-org, on paper (#29) (P3)

- **ADR-003**: how several halls would share one PIP-Hall (a hall id on every row, security rules per hall, hall admins, URLs like `/h/<hall>`, one brand still, D-029), with the cost and what would change. No code (D-106).

## Not yet justified (unchanged)

Update emails · reactions · extra themes · private repos · AI services (Ask Pip stays rule-based) · moving off the JSON snapshot (revisit if discovery queries need it) · building multi-org (design only, D-106).
