# PIP-Hall v2: the living hall

Status: **planned** (2026-10-06). No deadline (D-093). Decisions: D-093 to D-097. Rules: `CLAUDE.md` → Product rules.

## The problem

v1 is technically mature, but a visit can collapse into *browse → flip → open profile → leave*. There's a beautiful reason to come in and not much reason to come back.

## The goal

> **PIP-Hall = a playable map of the people and work inside a community.**

Every person, project, skill and collaboration becomes something you can **discover, collect, connect and remember**. Not social media, not LinkedIn in pixel art, not a portfolio template.

## The loop everything hangs on

```text
DISCOVER → INTERACT → COLLECT → UNDERSTAND → CONNECT → CONTRIBUTE → UNLOCK → RETURN
   hall       flip,     Passport    "why Pip     Made by,   your card,   cosmetics,  Missions,
   search     open      stamps      picked"      lineage    projects     titles      events
```

## Who can do what (D-097)

| | Guest (no account) | Signed in, card not yet approved | Approved member |
|---|---|---|---|
| Explore the hall, search, profiles, Museum | ✅ | ✅ | ✅ |
| Passport and stamps | ✅ on this device | ✅ on this device | ✅ in the account |
| Missions | ✅ on this device, stamps only | ✅ on this device | ✅ with PIPs |
| Earn and spend PIPs, achievements | — | — | ✅ |
| Card, projects, collaborations | — | ✅ (editing) | ✅ |

**Graduation:** when a member's card is approved, the hall offers to import their device Passport as **history** (stamps and dates). It never grants PIPs, and people already stamped don't earn discovery PIPs later. New discoveries after that earn as usual. This keeps D-059's anti-farming gate intact.

## Words (fixed)

**Missions** = daily/weekly objectives (D-065) · **Quest Log** = a member's projects · **Achievements** = milestones · **Passport** = what you've discovered · **PIPs** = the currency.

## Phases

Each phase ships on its own, behind a feature switch where it changes the hall, and states its loop and budget. Do one phase, then stop and report.

### V2-0 · Foundations — done

- No deadline (D-093). v2 product rules in `CLAUDE.md` (D-094). Vercel functions boundary (D-095). Loop before network (D-096). Guests play, members own (D-097).
- "Do not build yet" becomes "Not yet justified".

### V2-1 · Share: link previews and badge export (P0) — done

**Loop:** member shares a link or a PNG → a friend sees a real card in chat → taps → lands on the member in the hall → explores → maybe makes a card → shares theirs.

- **Link previews** for `/member/:username`, `/museum/:id` and `/`: Vercel Routing Middleware spots link-preview crawlers (Messenger, Discord, Slack, X, LinkedIn, WhatsApp, Telegram, iMessage) and rewrites them to a function that returns the app's HTML with `og:`/`twitter:` tags from the **published** card. People get the normal app, untouched.
- **OG images** (`/api/og/member/:username`, `/api/og/museum/:id`, `/api/og/hall`): 1200×630 PNGs drawn from the same sprites and tokens (badge front, name, role, top skills; exhibit on its console). Cached at the edge.
- **Badge PNG export**: "Save badge" on a profile and in the editor downloads a print-quality PNG of the badge front with its QR (same renderer, `/api/card/member/:username.png`).
- **QR landing:** badge QRs carry `?via=qr`; opening one shows "You found *name*!" and stamps the Passport (once V2-2 lands).
- Budget: no change to the app's JS; functions use cached published data; images ≤ 150 KB.
- Tests: unit tests for crawler detection and tag building (escaping, missing member → hall card); renderer snapshot; e2e that the export button downloads a PNG.
- As built:
  - `vercel.json` routes crawlers by user agent to `api/preview`; images come from `api/og` (member, exhibit, hall) and `api/badge` (the download, 1080×1350, a portrait post).
  - Rendering is `satori` (layout and text) plus `sharp` (PNG, and WebP photos to PNG). The sprites are the hall's own (`src/lib/spriteSvg.ts` turns them into SVG), coloured from `theme.css`.
  - The **Save badge** button shows where the hall has its backend (Supabase data source); it exports the approved card. In the editor it reads "Save my badge (as approved)".
  - QR landing: badge QRs (in the app and in the PNG) open `/member/<name>?via=qr`; the profile greets "You found …!" once and tidies the address. The Passport stamp arrives with V2-2.
  - Evidence: `docs/build/evidence/share-previews/`.

### V2-2 · Passport and search as play (P0) — done (D-098)

**Loop:** open a profile or exhibit → a stamp lands in your Passport → the Passport shows what's left to find → search to find it → Pip walks you there.

- **Passport** screen (inside the PIXENDO device): pages for **People**, **Projects visited**, **Skills seen** and **Collaborations found**. Each stamp shows the person's pixel stamp, number, top skills and the date. Progress is shown as pages filling up, not stats.
- Guests: saved on the device (`passportService`, local storage, wrapped so a blocked store just means no Passport). Members: built from `discoveries` plus a new `passport_visits` table for exhibits; graduation import (`import_passport()`, history only).
- **"Why Pip picked"**: every search result explains itself from real data (skill listed, project uses it, collaborated on X, GitHub verified). No AI.
- **Search → world:** choosing a result makes Pip run to that badge and its block light up. A **list mode** shows the same results as a plain list (keyboard and screen readers).
- Budget: ≤ 12 KB gzipped JS; no new requests for guests; one RPC for members.
- As built:
  - `/passport` opens inside the device like a profile (iris, BACK, Esc). A **Passport** button sits by Random player and shows the stamp count.
  - Account mode needs an approved card and PIPs on; otherwise the device Passport is used. An approved member sees "This device has N stamps… Bring them over" (history: no PIPs, no achievements; then the device copy is cleared).
  - A badge QR scan stamps the person and says so.
  - Evidence: `docs/build/evidence/passport/`.

### V2-3 · Missions and the event layer (P0) — done (D-099)

**Loop:** open the hall → today's Missions → go find → complete → stamp (+PIPs for members) → tomorrow's Missions.

- **`hall_events`** (append-only): `CARD_APPROVED`, `PROJECT_PUBLISHED`, `EXHIBIT_ADDED`, `COLLAB_ACCEPTED`, `ACHIEVEMENT_UNLOCKED`, `MISSION_COMPLETED`, `MEMBER_FEATURED`, with `visibility` (public / owner-only). Written only by the existing SQL functions and triggers. One event feeds PIPs, achievements, notifications, activity and Mission progress.
- **Missions:** three a day and one a week, picked deterministically from the date and **real** hall data (e.g. "Find someone who knows Python" only if someone does). Kinds: find by skill, find a collaboration, visit exhibits, visit members from different departments, a mystery hint from Pip.
- Guests complete them on the device (stamps). Members complete them server-side: `complete_mission()` checks the condition against `discoveries`/visits and the published cards, then grants PIPs through `grant_pips()` with ref `mission:<date>:<key>` (once, capped).
- Budget: ≤ 8 KB gzipped JS; one RPC per completion.
- As built:
  - The app picks the Missions; the database never trusts the pick, it checks the condition, the caps (3 a day, 1 a week) and a minimum size per kind before paying. Weekly Missions: meet 8 people, visit 5 exhibits, or meet people from 3 departments, offered only when the hall can do it.
  - Missions sit in a panel under the search, with TODAY and THIS WEEK. Members see "Claim" when a Mission is done; guests see it stamped.
  - Evidence: `docs/build/evidence/missions/`.

### V2-4 · Feedback: notifications and "Recent in the hall" (P1)

**Loop:** something real happens → the people it concerns hear about it in the app → they come back to act.

- In-app **bell** for members: tagged on a project, collaboration accepted, card approved or needs changes, achievement unlocked, exhibit featured. Built on `hall_events` (owner-visible). Email stays "not yet justified".
- **Recent in the hall** strip: public events only (approvals, new exhibits, accepted collaborations, achievements). Never discoveries (D-063), never counts or rankings.

### V2-5 · Identity and proof (P1)

- **Proof** panel on profiles: GitHub verified, projects (and their sources), accepted collaborations, skills, last synced.
- **Titles** earned from behavior (Card Holder, Explorer, Builder, Connector, Curator, Pioneer…), each traceable to events. A member chooses which earned title shows.
- More **PIP sinks** that respect rule 6: Passport page styles, Pip emotes, badge decorations, Mission rerolls, title plates.

### V2-6 · The Museum as a place (P1)

- **Wings** built from real data: by language or skill (e.g. Web, Games, Data), a **Collab wing** for team projects, the Featured wing. Each with a short admin-written curator note and paths to related exhibits.
- Wings are open to everyone; no wing is ever paywalled by PIPs.

### V2-7 · Seasons and events (P1)

- Admin-scheduled events (e.g. **Build Week**): a date range, a sky or banner change, event Missions, one limited frame. Event counters show only real numbers from `hall_events`.

### V2-8 · Network and lineage (density-gated, D-096)

- A constellation view of people ↔ projects ↔ skills, and **project lineage** (projects connected by shared makers), derived from published snapshots in the browser. Ships when the hall has enough verified relationships (about 30 members; judged by projects and collaborations).

### Not yet justified

Booth mode (strong for events; revisit before the next fair) · rule-based "Ask Pip" · sound · reactions · extra themes · multi-org · private repos · email · normalising the public snapshot into tables (only if discovery queries need it).

## Recommendations taken from the review, and where they changed

| Suggestion | Plan |
|---|---|
| Hall Quests | Called **Missions** (D-065); the badge's Quest Log stays projects |
| PIPs for scanning a QR | Members already earn on discovery; a QR opens the same discovery, plus the "You found" moment. Guests get a stamp |
| PIPs unlock Museum rooms | Not adopted: content is never paywalled (rule 6). PIPs buy cosmetics, pages and rerolls |
| Ask Pip | Rule-based only, and later. "Why Pip picked" delivers most of the value now |
| Move off the JSON snapshot | Not yet: at under 500 members the browser can derive relationships from snapshots. Revisit with V2-8 |
| Edge layer | Vercel functions, presentation only (D-095); Supabase stays the backend |
| Activity feed | Only public, real events; no counts, likes or rankings |

## Open questions for later phases

- V2-6: who writes curator notes (admins only?).
- V2-7: first event and its dates.
