# PIP-Hall v2, part two: the Museum, hackathons, and a hall that comes alive

Status: **V2-9, V2-10, V2-10b, V2-11 and V2-15 built** (2026-10-08; V2-15 pulled forward with the calmer hall, D-126); V2-12 next. Follows `V2-LIVING-HALL.md` (V2-0 to V2-8, all built). No deadline (D-093). Decisions: D-106 to D-120 (the owner's answers, 2026-10-07), D-123 (the officers' space, 2026-10-08); build details D-121, D-122, D-124, D-125; the calmer hall D-126. Rules: `CLAUDE.md` → Product rules.

## Why this round

Two things drive it.

1. **The owner's assignment:** compile previous student projects and hackathon outputs, and find a unique, interactive way to show them *beyond a standard laptop display, like a museum display*. The organization runs hackathons and other building events, and winners should be showcased and acknowledged. So the Museum becomes the centrepiece: events with tracks, submissions and winners; an archive of past projects; a museum you walk through; and physical showcase pieces (kiosk tour, printable placards, a phone companion, posters).
2. **The rest of the v2 review** (30 points): the gaps in what was built, a world that reacts to real events (#26), the design rules reworded as invariants (#18), and #29 (Ask Pip, sound; multi-org on paper).

Same discipline as before: one phase at a time, SQL first where there is SQL, every feature states its loop and budget, then stop and report.

**Names stay data.** The code never names a host organization (D-029, D-067). Event names ("… Hackathon 2026"), award names ("Best UI") and track names are typed in Admin; the organization appears only there and in affiliations.

## Decisions taken for this round (2026-10-07)

| # | Question | Answer |
|---|---|---|
| D-106 | Multi-org | **Design only** (ADR-003, V2-19). One hall stays; no code |
| D-107 | World-centric device | **START menu + iris** (V2-15). The Museum and PIP MART keep full-size pages |
| D-108 | New PIP cosmetics | **All four:** badge stickers (public), Pip outfits, Passport covers, hall effects (owner-only) |
| D-109 | Booth mode | **Kiosk + check-in stamp**, now part of the showcase (V2-12) |
| D-110 | Sound | **Effects only, off by default**, synthesized in the browser (V2-18) |
| D-111 | Mentor title | **Built with 2 newer members** (V2-13) |
| D-112 | Member progress | **Only to the member** (V2-13) |
| D-113 | Event look | **A sky per event** (V2-14) |
| D-114 | Priority | **Museum and hackathons first**: V2-9 to V2-12, then the rest |
| D-115 | Hackathon events | Events get a **kind** (hackathon or other building events), **tracks**, a **submission window** where members submit projects, a **schedule with countdowns**, and **results** |
| D-116 | Winners | **Placements + named awards** per event (1st, 2nd, 3rd, and awards like "Best UI", optionally per track), each with a **judges' note**. Winning projects get a trophy plaque in the Museum's **Winners' Hall**; winning members get a **ribbon pin** on their badge and a bell notification; the hall announces results |
| D-117 | Champion title | **Yes:** earned by being a credited maker of a project that won a placement or award in a recorded event |
| D-118 | Past projects | **Admin-curated archive**: admins add past projects and hackathon outputs with event, year, links, picture and makers. Makers who are members link to their badges; others appear by name **only if they agreed**, otherwise by team name. Members can claim an archive project; an admin confirms |
| D-119 | Museum look | **A walkable Museum**: Pip walks through rooms (Winners' Hall, each event, each wing, the archive by year), exhibits hang on the walls in their consoles with plaques. A plain list stays for keyboards, screen readers and small phones |
| D-120 | Showcase pieces | **All four:** a kiosk museum tour, printable placards, a phone companion (scan a placard → the exhibit + a stamp), and exhibit and winners posters (PNG) |

## Phases

### V2-9 · Hackathons: tracks, submissions and winners (P0) · built

Built as planned (details: D-121). Evidence: `docs/build/evidence/hackathons/`. The Winners' Hall and event rooms live in today's Museum page until V2-11 makes it walkable.

**Loop:** an admin schedules a hackathon → members submit their projects during the window → the event's room in the Museum fills up → judges' results are announced → winners are acknowledged in the Museum, on their badges and in the hall → people come back for the next one.

- **Event kinds** (D-115): *Hackathon* and *Building event* (Build Week, workshop, showcase…). The kind changes the words and what's offered; the name is the admin's.
- **Schedule:** submissions open, submissions close, results. The banner counts down to the next one ("Submissions close in 2 days"), and shows "Results are in!" once announced.
- **Tracks:** an event can have up to 6 tracks (names typed by the admin, e.g. Health, Education). A submission picks one.
- **Submissions:** during the window, a member submits one of their own projects (with its collaborators) to the event, choosing a track. It appears in the event's room in the Museum once it's on their approved card (ADR-002: public pages only show approved snapshots). One project per event per owner can be withdrawn until the window closes. No Museum-access affiliation is needed for event rooms.
- **Results** (D-116): after the window, the admin records **1st, 2nd, 3rd** and any **named awards** ("Best UI", "People's Pick"), overall or per track, each with a short **judges' note** (up to 200 characters), then presses **Announce**. Until then nothing is public.
- **On announce:**
  - the hall's Recent strip says "Results are in for <event>" and lists the winners;
  - every credited maker who is a member hears it in the bell ("Your project 'Kite' won 1st place in <event>");
  - winning members get a **ribbon pin** on their badge (gold, silver, bronze or award ribbon; shape and words, not colour alone);
  - **Champion** title (D-117) for credited makers of winning projects;
  - the Proof panel lists the award with its event.
- **SQL:** event kind, schedule and tracks on `hall_seasons`; `event_submissions`; `event_awards` (placement or award name, track, note, project or archive exhibit); `announce_results()` (admin, once, logs public events); submission functions with the window and ownership checks; awards in `earned_titles()`, `hall_titles()`, `card_pins()`; security tests for every rule (no submissions outside the window, nothing public before announce, only admins record results, a project can't win twice the same award).
- Budget: ≤ 6 KB gzipped JS; one RPC for the event panel; no change to the hall's first load.

### V2-10 · The archive: past projects and hackathon outputs (P0) · built

Built as planned (details: D-122), with one change: the archive is read through its own `museum_archive()` rather than folded into `museum_exhibits()`, and the app hangs it with the other exhibits. Evidence: `docs/build/evidence/archive/`.

**Loop:** an admin compiles past work → it hangs in the Museum next to today's → a former maker who joins finds it and claims it → their badge links to it.

- **Admin → Archive** (D-118): add a past project with title, description, links (site, code, video), a picture, the **event and year** (an existing event, or a typed name for older ones), its **award** if it won one, and the makers.
- **Makers:** each maker is either a **member** (picked, linked to their badge) or a **typed name** shown only if the admin ticks "These makers agreed to be named"; otherwise the exhibit shows the **team name** (or "a team of 4").
- **Claim:** a member sees "Is this yours? Claim it" on an archive exhibit that names them; an admin confirms, and the exhibit links to their badge (and counts for Connector, Curator and Champion where it applies).
- Archive exhibits hang in the Museum alongside members' exhibits: in their event's room, in matching wings (by language or tools), in the Winners' Hall if they won, and in **The Archive** (by year).
- Real people only, entered by admins; nothing is invented (rule 7). Pictures are stored as paths (D-027).
- **SQL:** `archive_exhibits` (admin-written, public read of published rows), `archive_claims`, admin functions, the archive in `museum_exhibits()` (marked `archive`), security tests.
- Budget: ≤ 5 KB gzipped JS (admin screens are a lazy chunk).

### V2-10b · The officers' space (P0, added 2026-10-08) · built

Asked for by the owner after V2-10: the organization's officers want a part of the hall and the Museum where they can show their projects (D-123; details D-124). Evidence: `docs/build/evidence/officers/`.

**Loop:** an admin names this term's officers → they wear an officer pin, open the hall's Officers door and fill the Officers' Wing → visitors meet the people running the organization and their work → when the term ends, the next team takes the space and the old one stays on profiles as past officers.

- **Admin → Affiliations:** "Make it an officers' team" on an affiliation (e.g. "Officers 2026–27", typed by the admin), the day the term ends (optional), then each officer with a **position** (President, Vice President…) and an **order**. Taking someone off is the usual affiliation switch. Only admins name officers (D-068).
- **Hall:** an **Officers** button in the search (with Filters, Random player, Passport) shows only the current officers, in the team's order, with "The officers of <team>, as named by the hall's admins" and a "Why Pip picked" line. It's a door, not top placement: the default hall stays unranked (rule 5). Shareable as `/?officers=1`.
- **Badge:** current officers wear an original **officer pin** (a double chevron, `OFFICER_PIN` in `sprites.ts`) first on the lanyard holder, before ribbons and admin pins, with the position in words for screen readers (not colour alone).
- **Profile:** the team chip reads "Officers 2026–27 · President"; past terms read "(past)". Proof lists "✓ Officer: President, Officers 2026–27 (named by the hall's admins)" and past terms.
- **Museum:** a built-in **Officers' Wing** (like Featured and Collab; admins can rename it, write its note or close it) holds exhibits whose maker or a credited collaborator is a current officer. With V2-11 it becomes a room in the walkable Museum, like every wing.
- Doesn't depend on the PIPs switch; no PIPs, no ranking, nothing bought (rules 3, 5, 6). Every officer traces to an admin's entry (rule 4).
- **SQL** (`20261008000100_officers.sql`): `affiliations.officers` and `term_ends`; `member_affiliations.position` and `seat`; the `officers` wing kind and its seeded wing; `hall_officers()` (public), `admin_set_officers()`, `admin_set_officer()`; security tests.
- Budget: about 1 KB gzipped JS on the first load (the pin, the door, the wing rule); the admin panel is in the lazy admin chunk. One extra small request (`hall_officers`) with the hall's appearance data; no per-frame work.

### V2-11 · The walkable Museum (P0) · built

Built as planned (details: D-125), with three changes: a room for **All exhibits** before The Archive (an exhibit that fits no wing would otherwise be out of reach), the List view is `?view=list` on the same page (so every room's address works in both views), and the Winners' Hall, event rooms, All exhibits and the Archive have fixed styles while admins pick each wing's. Evidence: `docs/build/evidence/walk/`.

- **Budget, measured.** The walk is its own lazy chunk: 8.4 KB gzipped (MuseumWalk), plus 2.2 KB in the Museum page for the room plan and the view switch (≈ 10.6 KB of the 12 KB). The home page's first load is unchanged (160.8 KB of 200 KB; 161.0 KB before). No new requests: the walk uses what the Museum page already loads. On a production build in headless Chromium **without a GPU**, walking past 200 exhibits costs about 1.2 ms per frame in the walk's own loop and about 9 ms of main-thread work in all (style, layout, paint, layer commit), within the 16.7 ms of a 60 fps frame; standing still costs under 1 ms, because the level isn't redrawn. Only the exhibit in front of Pip and two on each side are on the page (at most six while walking), whatever the count. That machine rasterises in software, so its frames themselves take 50 ms, the hall's too; a device with a GPU doesn't pay that.
- **Also:** sprites are now drawn a run of one colour at a time (one rectangle, not one per pixel), which makes every console and cover cheaper to show, in the walk, the list and the hall.


**Loop:** enter the Museum → walk Pip through rooms → stop at an exhibit to read its plaque → open it or meet its makers → follow the path to the next room → leave a stamp in your Passport.

- **A museum level** (D-119), drawn on the hall's own animation loop (D-031, ADR-001: hand-written, no library): a floor, walls, room signs and doorways; exhibits hang on the walls **inside their consoles** (D-091), with a **plaque** under each (title, makers, event, award).
- **Rooms**, in this order: **Winners' Hall** (trophies, latest results first, by event) → **each event** (submissions, by track) → **each wing** (Featured, Collab, the Officers' Wing, Web, Games, Data…) → **The Archive** (by year). The Officers' room (D-123) is the Officers' Wing, so it needs nothing extra.
- **Walking:** arrow keys, drag or the device's MOVE rocker; Pip stops in front of an exhibit and its plaque lights up; Enter or OPEN opens the exhibit page. A **room map** jumps straight to any room.
- **Wing styles** (the old V2-13, #5): each room gets a style from fixed presets (Arcade, Lab, Library, Garden, Trophy room), original art and tokens; each room shows **Makers in this room** and **Next room →**.
- **Trophies:** winning exhibits stand on a pedestal with a pixel trophy or ribbon and the judges' note on the plaque.
- **Accessible and light:** the plain list ("List view") is one button away and is what screen readers and very small phones get first; reduced motion walks without animation. Only exhibits on screen are drawn; pictures load as they come into view.
- No new SQL beyond `museum_wings.style` (checked list).
- Budget: ≤ 12 KB gzipped JS (a lazy chunk); 60 fps with 200 exhibits.

### V2-12 · The showcase: beyond a laptop display (P0)

**Loop:** a screen at the event tours the Museum by itself → visitors read the placards beside the demos → they scan one → the exhibit opens on their phone and stamps their Passport → some make a card.

- **Kiosk** (D-109, D-120): `/booth` for a laptop, TV or projector, started by an admin. Two modes: **Museum tour** (walks exhibit to exhibit, shows its plaque, award and a big QR, about 12 seconds each, pauses when touched) and **Hall** (the hall's attract mode). Returns to the tour after a minute untouched; no sign-in on the kiosk.
- **Check-in stamp** (D-109): the kiosk's QR for the live event gives scanners a Passport stamp "Visited the showcase at <event>". Guests on their device, members in their account; no PIPs; once per event.
- **Printable placards:** a print page for an event, a room or a single exhibit: one label per exhibit (title, makers or team, event and year, award ribbon, judges' note, QR), sized to cut out (A6, four per A4 page). Printing uses the browser's print, so no PDF tool is needed.
- **Phone companion:** a placard's QR opens the exhibit on the visitor's phone ("You found this exhibit!"), stamps it in the Passport's **Museum stamp book**, and offers its makers and the next exhibit in the room.
- **Posters (PNG):** a poster for an exhibit and a **winners poster** for an event (all placements and awards, with QR), drawn in the browser like the badge (D-104), for walls and social posts.
- **SQL:** event check-ins for members (one per member per event), counted in the event's real numbers.
- Budget: the kiosk, print pages and poster drawer are lazy; nothing added to the hall's first load.

### V2-13 · Close the gaps (P1, small)

**Loop:** the things people already use answer one more question each (who else made this, who's near this person, what have I done).

- **#18 Design invariants.** `DESIGN_BRIEF.md` §8 "Forbidden list" becomes **Visual invariants** (tokens only, no blur, no rounding, original art, 4px grid, 44px targets, reduced motion, WCAG 2.2 AA) plus **How to change one**: a decision in `DECISIONS.md` with the reason, then the token or rule change. `CLAUDE.md` says the same.
- **#11 Connected projects on the exhibit page:** other projects (members' and archive) that share a maker, with who connects them. Shown whenever a link exists.
- **#2 "Made with" on profiles:** a small map of one member's own links. Always on; the full `/network` map keeps its gate.
- **#12 QR landing:** after "You found X!", a **Related people** row with Walk there buttons.
- **#21 Badge PNG:** carries the earned title on its plate, admin badges and award ribbons (pins).
- **#10 Your progress** (D-112): Missions completed and achievements unlocked, in your own Passport only. **Mentor title** (D-111).
- **#3 Two more Missions:** "Find a project made by 3 or more people" and "Meet 3 people who know <skill>" (offered only when the hall has them). Also: "Visit a winning exhibit" when the Winners' Hall has one.
- **#15** decided, no change: discoveries stay private (D-063); an "equipped a frame" event has nothing that would use it.
- **#23 Server check:** why the live server functions error (the badge download did; link previews may too). Needs from the owner: what `the-pip-hall.vercel.app/api/og/hall` shows, or that function's log in Vercel.
- **SQL:** Mentor in `earned_titles()`; the new Missions in `mission_met()` and `complete_mission()`.
- Budget: ≤ 4 KB gzipped JS.

### V2-14 · The world reacts (#26, #9 sky) (P1)

**Loop:** something real happens → the world shows it where it happened → people go and look.

- **NEW!** over a member's block for 7 days after their first approval; Pip reacts when reaching it.
- **Featured** blocks carry a star; **winners'** blocks carry their ribbon.
- **Threads** between badges of members who made something together, while both are on screen.
- **Mission complete:** a flag goes up at the end of the level and Pip celebrates.
- **Event skies** (D-113): Dusk, Starry night, Festival (bunting), for the event's dates.
- Reduced motion keeps the signs and stops the motion; every sign has words (badge labels, lists).
- **SQL:** a public first-approval date; `hall_seasons.sky` (checked list).
- Budget: ≤ 6 KB gzipped JS; threads drawn only for badges on screen.

### V2-15 · The device is the world (#25) (P1) · built

Built early, with the owner's call for a calmer first screen (D-126): START is the device's third button and opens its menu over the screen (Random player, Passport, Officers, Museum, Map when open, PIP MART for members, Share the hall, DAY/NIGHT); S opens it, Esc and BACK close it; the search row above the device keeps only the search and Filters, and the panels below it became tabs. The Museum and PIP MART stay full pages (D-107), so their items are links rather than an iris. Budget: 3.0 KB gzipped on the first load, measured (the menu, the tabs and the theme button; the home page now loads 163.8 KB of its 200 KB). No new requests: the tabs use the event the banner already asked for. Evidence: `docs/build/evidence/calm/`.


**Loop:** press START → pick a place → iris into it → BACK brings you home.

- A **START** button and an in-device menu: HALL, MUSEUM, PASSPORT, MAP (when open), MART (members). Keyboard and screen-reader friendly; the top bar stays as the plain way round (D-107).
- No SQL. Budget: ≤ 3 KB gzipped JS.

### V2-16 · More to spend PIPs on (#8) (P1)

**Loop:** earn PIPs by exploring → choose how you look or how your hall feels → it shows (to everyone, or just you).

- **Badge stickers** (public, up to 3; suggested 120–250 PIPs), **Pip outfits** (100–200), **Passport covers** (150–300), **hall effects** (150–250; off with reduced motion) (D-108).
- **Seasonal collectibles:** each event can sell one limited sticker; anyone who took part (submitted, checked in or completed its Mission) gets a free event stamp.
- Never visibility, ranking or access (rule 6). All art original, in `sprites.ts`.
- **SQL:** new PIP MART kinds with checked styles; what each member wears.
- Budget: ≤ 6 KB gzipped JS plus sprites.

### V2-17 · Ask Pip (#22) (P2)

**Loop:** ask in your own words → Pip answers with people (and exhibits) and why → Pip walks you to them.

- Rule-based, free, no AI service: words are matched to skills, tools, departments, tracks and project words, with a small synonym table (mobile → Flutter, Kotlin, Swift, React Native; data → Python, SQL, Pandas…). "Who won the last hackathon?" answers from recorded results.
- When nothing matches, Pip says so and suggests the closest things that exist.
- No SQL. Budget: ≤ 5 KB gzipped JS.

### V2-18 · Sound (#29) (P2)

- Original 8-bit effects made with the Web Audio API in code (coin, flip, stamp, Mission done, trophy), no files, nothing borrowed (D-020, D-029). Off by default; a speaker toggle, remembered on the device. No music (D-110).
- No SQL. Budget: ≤ 3 KB gzipped JS.

### V2-19 · Multi-org, on paper (#29) (P3)

- **ADR-003**: how several halls would share one PIP-Hall (a hall id on every row, rules per hall, hall admins, `/h/<hall>` URLs, one brand), with the cost. No code (D-106).

## Not yet justified (unchanged)

Update emails · reactions · extra themes · private repos · AI services (Ask Pip stays rule-based) · moving off the JSON snapshot (revisit if discovery queries need it) · building multi-org (design only, D-106).
