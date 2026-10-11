# Deploying PIP-Hall

The first deploy is done by the owner, because it needs your accounts (D-041). It takes about 30 minutes. Nothing here needs a secret in the repo: the only values in Vercel are the public Supabase URL and anon key.

You need: the GitHub repo, a Supabase project (free), a Vercel account (Hobby, free), and Google and GitHub OAuth apps.

---

## 1. Supabase

Skip any step you already did in Phase 2 (README → Getting started → 3).

1. **SQL editor:** run each migration in `supabase/migrations/` that you haven't run yet, oldest first:
   1. `20261004000000_init.sql`
   2. `20261004000100_storage.sql`
   3. `20261004000200_image_paths.sql`
   4. `20261004000300_member_no.sql`
   5. `20261004000400_admin_checks.sql` (new in Phase 4)
2. **Authentication → Providers:** Google and GitHub are on, each with its client ID and secret.
3. **Authentication → Settings:** **manual identity linking** is on.
4. Note two values from **Project Settings → API**: the **Project URL** and the **anon public** key. Never copy the `service_role` key anywhere.

## 2. Vercel

1. **Add New → Project →** import the GitHub repo. Framework preset: **Vite**. Build command `npm run build`, output `dist` (the defaults).
2. **Environment Variables** (Production and Preview):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | the Project URL |
   | `VITE_SUPABASE_ANON_KEY` | the anon public key |
   | `VITE_DATA_SOURCE` | `supabase` |
   | `VITE_PUBLIC_ORIGIN` | the production URL, e.g. `https://pip-hall.vercel.app` (no trailing slash) |

   `VITE_PUBLIC_ORIGIN` is what every QR code encodes. Set it to the production URL in Preview too, so a QR printed from a preview still opens production.
3. **Deploy.** Note the production URL. If it differs from what you guessed in step 2, fix `VITE_PUBLIC_ORIGIN` and redeploy (Deployments → ⋯ → Redeploy). Vite bakes env vars in at build time.

`vercel.json` already rewrites every route that isn't a file to `index.html`, so `/member/<username>` loads cold.

## 3. Point sign-in at the live URL

1. **Supabase → Authentication → URL configuration:**
   - **Site URL:** the production URL.
   - **Redirect URLs:** add `https://<production>/auth/callback` (keep `http://localhost:5173/auth/callback` for local work). To sign in on preview deploys, also add `https://*-<your-vercel-team>.vercel.app/**`.
2. **Google Cloud → OAuth consent screen:** publishing status **In production**, so anyone with a Google account can sign in. The authorized redirect URI stays the Supabase callback (`https://<project>.supabase.co/auth/v1/callback`), not the Vercel URL.
3. **GitHub OAuth app:** the callback URL is also the Supabase callback. Set the homepage URL to the production URL.

## 4. Make yourself admin

1. Open the live site, **Make your card → Continue with Google**.
2. Supabase **SQL editor:** paste `supabase/seed_first_admin.sql`, replace `YOUR_GOOGLE_EMAIL` with that Google address, run it. The last query should return your email with role `admin`.
3. Reload the site: **Admin** appears in the top bar.

## 5. Acceptance (Phase 4)

Do these on the live URL and keep a screenshot of each.

- [ ] **Second account:** in a private window, sign in with a different Google account, connect GitHub, build a card, **Submit for review**.
- [ ] **Approve:** as admin, open **Admin → Pending**, select the card, **Approve card**. Open `/`: the card hangs in the hall.
- [ ] **QR, cold:** on a real phone with no tabs open, scan the badge's QR. `/member/<username>` loads (no 404) with the full card and projects.
- [ ] **Not allowed:** signed in as the second account, open `/admin`. You see "Admins only". The database refusing the calls themselves is covered by `npm run test:db` ("member cannot approve", "member cannot reject", …).
- [ ] **Unknown page:** `/member/nobody-here` shows "No card here".

### Phase 5 checks on the live URL

- [ ] **Android (Chrome):** open the site, tap **Install PIP-Hall** at the bottom of the hall (or Chrome's menu → Install app). It opens full screen from the home screen icon.
- [ ] **iPhone (Safari):** tap **Install PIP-Hall** for the steps: Share → Add to Home Screen → Add. It opens full screen.
- [ ] **Offline:** open the hall once, turn on airplane mode, reopen the installed app: the hall and pages you've visited still load.
- [ ] **Search the hall:** search for a member by name, @handle, skill and a project title; the hall shows only the matches, and they still flip and OPEN.
- [ ] **Delete account:** with a test account, Settings → Delete account. Its card disappears from `/` and `/member/<username>` says "No card here".

## PIP Progression (E1) — when you're ready to turn it on

1. Supabase **SQL editor:** run `supabase/migrations/20261005000000_pips_core.sql`. It also gives members already in the hall their approval rewards (D-062).
2. **Vercel → Environment Variables:** add `VITE_FEATURE_PIPS` = `on` (Production, and Preview if you want it there), then redeploy. Leave it unset or `off` to keep PIPs hidden; the migration is harmless while the switch is off.
3. Check: sign in as a member whose card is in the hall, open another member's profile, and see Pip's "+5 PIPs" line and the HUD balance; Settings → PIPs shows the history.

## PIP MART (E2)

Needs PIPs on (`VITE_FEATURE_PIPS=on`, see above).

1. Supabase **SQL editor:** run `supabase/migrations/20261006000000_pip_mart.sql` (after the Museum migrations). Run it once.
2. **Admin → Affiliations:** on an affiliation such as your organization, click **Give member frame**. Its members can then wear a free frame printed with its name (e.g. ACM MEMBER).
3. Check: a member in the hall opens **PIP MART**, tries a frame on, buys one, wears it; the hall shows it.

## Museum featured row and admin rewards (D-083, D-087)

Both are safe to run again (they only add columns and replace functions).

1. Supabase **SQL editor:** run `supabase/migrations/20261006000100_museum_featured.sql`. Members you mark **Featured** then hang in a pinned row on top of `/museum`.
2. Supabase **SQL editor:** run `supabase/migrations/20261006000200_admin_rewards.sql` (after the PIP MART one). It needs PIPs on.
3. In the app: **Admin → Rewards**. **Borders**: design one from the presets, sold in the Mart or reward-only. **Badges**: pick a gem and colour, a PIP reward and, if you like, a border it gives. **Give a badge**: pick a member and a badge.
4. Check: the member's profile lists the badge with its gem and their badge shows a pin by the clip; the border waits in their PIP MART, ready to wear.

## Project collaborators (D-089)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000300_project_collaborators.sql`. Safe to run again.
2. Check: a member opens **My card → Collaborators**, tags another member of the hall on a project; that member sees the request in their own **Collaborators** panel and accepts. After the owner's next approval, the project's public card lists them.

## The Museum curated end to end (V2-20, D-133)

1. Supabase **SQL editor:** run `supabase/migrations/20261011000000_museum_control.sql` (after the curated Museum one) **before** merging the app update. Run it as one query with nothing selected. Safe to run again. On its first run every winner already on show is hung, so nothing leaves the Museum; from then on, announcing an event's results doesn't hang its winners until you do. If it stops with "This database is missing an earlier migration", nothing was changed: run `20261009000000_curated_museum.sql` first (it names any others it needs), then this one. If you ever re-run the curated Museum migration, run this one again after it.
2. In the app, **Admin → Museum** has five tabs:
   - **Suggestions:** projects members offered from My card. Nothing hangs until you feature it.
   - **Projects:** feature any project on an approved card.
   - **Winners:** per announced event, **Hang** each winner (or **Hang all**). Ribbons, titles and the results news don't wait for this.
   - **Members:** feature a member (the same switch as the Featured tab) and write the note under their badge in the **Featured Members** room (up to 140 characters).
   - **Rooms:** the order visitors walk the rooms in, the sign on each door, and **Closed to visitors**. **Back to the usual order** undoes it all.
3. **Admin → Wings:** a wing can now have no tags; open one and tick its **Hand-picked exhibits** (any wing can have them, up to 60).
4. Check: `/museum` shows only what you hung, the rooms in your order; a featured member's badge hangs in the Featured Members room with your note and **OPEN PROFILE**; their bell says so.

## The two circles and the curated Museum (D-129, D-130)

1. Supabase **SQL editor:** run `supabase/migrations/20261009000000_curated_museum.sql` (after the close-the-gaps one) **before** merging the app update. Run it as one query with nothing selected. Safe to run again. On its first run, the exhibits of members you had **Featured** become featured projects, so the Museum's Featured row stays as it was; every other member exhibit leaves the Museum until you feature it. Event winners and the archive stay on show. If you ever re-run an older Museum, passport, hackathons, identity, close-the-gaps or notifications migration, run this one again after it. If it stops with "This database is missing earlier migrations", nothing was changed: run the files it names, in that order (each is safe to run again), then this one.
2. In the app: **Admin → Museum.** Tick **Feature** on each project that should hang in the Museum (members' offers are listed first, marked "offered by its maker"; winners are marked and hang anyway). It shows at once and needs no review.
3. Check: `/` opens the level. **FLIP** a badge: once it shows its back, the hall turns into the **two circles** (D-132): players on the left, the chosen player's quests on the right, their badge and the chosen quest between. Pick another player and the quests follow; **VIEW** opens the quest inside the device and BACK returns. **FLIP** again: the badge turns to its front and the level is back. `/museum` opens **Rooms and exhibits** the same way; **Walk the Museum** and **List view** are the links above it. An event's room appears once its results are announced, with its winners.

## Close the gaps (V2-13, D-111, D-112, D-128)

1. Supabase **SQL editor:** run `supabase/migrations/20261008000400_close_gaps.sql` (after the showcase one) **before** merging the app update. Safe to run again. It adds the Mentor title, three Missions and `my_progress()`; the live app keeps working. If you ever re-run the missions, identity, hackathons or archive migration, run this one again after it.
2. Check: a member's **Passport → Your progress** shows their Missions completed and achievements (only to them). A profile with team projects shows **Made with**; scanning a badge's QR shows **Related people** with **Walk there**. An exhibit that shares a maker with another shows **Connected projects**.
3. **Server check (#23):** open `https://<your site>/api/og` (the hall's link-preview image) and `https://<your site>/api/badge?u=<a username>`. If either fails, the response has an `X-PipHall-Stage` header (in the browser's dev tools → Network, or `curl -I`) saying which step broke: `fonts`, `layout`, `png` or `data`. Send that, or the function's log line from Vercel (Project → Logs, it starts with `[pip-hall]`).

## The showcase (V2-12, D-109, D-120, D-127)

1. Supabase **SQL editor:** run `supabase/migrations/20261008000300_showcase.sql` (after the museum walk one) **before** merging the app update. Safe to run again. It adds the check-in code and check-ins; the app that's live keeps working. If you ever re-run the passport or hackathons migration, run this one again after it.
2. Before the event: **Admin → Events → Showcase** on the event's row. Open the **kiosk link** on the laptop, TV or projector (then **Full screen**); it tours the event's room and shows the hall, and while the event is on its **CHECK IN** QR stamps visitors' Passports. **Renew code** if a kiosk link was shared where it shouldn't be.
3. **Placards to print** opens the print page: print at 100% on A4 and cut along the dashed lines (four A6 placards to a page). Once the results are announced, **Save winners poster** there; each exhibit's page has **Save poster**.
4. Check: scan a placard with a phone: the exhibit opens with "You found this exhibit!" and **Next in <room>**. Scan the kiosk's CHECK IN: "Stamped! Visited the showcase at <event>"; the event's numbers in the hall add "1 checked in at the showcase" for a member.

## The walkable Museum (V2-11, D-119, D-125)

1. Supabase **SQL editor:** run `supabase/migrations/20261008000200_museum_walk.sql` (after the officers one) **before** merging the app update. Safe to run again. It only adds a room style to each wing; the app that's live keeps working. If you ever re-run the wings migration, run this one again after it.
2. Check: `/museum` opens the walk inside the PIXENDO: Pip stands in the first room (the Winners' Hall when there are winners). ◀ ▶ (or the arrow keys, or a drag) walk, **MAP** lists every room, **OPEN** visits the exhibit and Back returns to it. **List view** at the top is the page as it was.
3. In the app: **Admin → Wings → Room style** for each wing (Arcade, Lab, Library, Garden or Trophy room), then **Save**. The built-in wings start in styles that fit them; a new wing opens as an Arcade unless you pick another.

## The officers' space (V2-10b, D-123, D-124)

1. Supabase **SQL editor:** run `supabase/migrations/20261008000100_officers.sql` (after the archive one) **before** merging the app update. Safe to run again.
2. In the app: **Admin → Affiliations.** Add the team as an affiliation (e.g. "Officers 2026–27"), then press **Make it an officers' team** on its row. In **Officers' teams** below, set the day the term ends (optional) and **Save term**. Under **Add an officer**, pick a member who has a card in the hall, type their position (e.g. President) and their order (1 shows first), and **Add officer**. **Save** changes a position or order; **Remove** takes someone off the team.
3. Check: the hall's search shows an **Officers** button; it lists only the officers, in order. Their badges wear the officer pin; their profiles read "Officers 2026–27 · President" and list it under Proof. `/museum` has an **Officers' Wing** with their projects (rename it or write its note in **Admin → Wings**).
4. Next term: make a new team ("Officers 2027–28") the same way. Once the old term's last day has passed, its officers show as past officers on their profiles, and the door, pins and wing follow the new team.

## The archive (V2-10, D-118, D-122)

1. Supabase **SQL editor:** run `supabase/migrations/20261008000000_archive.sql` (after the hackathons one). Safe to run again. If you ever re-run the hackathons, events or notifications migration, run this one again after it.
2. In the app: **Admin → Archive → Add a past project.** Fill in the title, year and event (one of the hall's events once it's over, or "An older event" with its name), the track and award if it won one (with the judges' note), the team name, what it was built with, links and a picture. Add its makers: pick members who have a card in the hall; type other names; leave a slot blank for someone who shouldn't be named. Tick **These makers agreed to be named** only when they did; without it the exhibit shows the team name or "a team of N". Leave **On show** off to keep a draft while you compile.
3. Check: `/museum` shows a door to **The Archive** (by year); winners stand in the Winners' Hall; each exhibit hangs in its wings and, for a hall event, in that event's room.
4. Claims: a member who made one opens it and presses **Claim it**. In **Admin → Archive → Claims waiting**, link them to the maker they were (or as a new maker) and **Confirm**, or **Decline** with a note. Confirmed members hear it in their bell; their profile lists the project and its award, with a ribbon on their badge.

## Hackathons and winners (V2-9, D-115 to D-117)

1. Supabase **SQL editor:** run `supabase/migrations/20261007000000_hackathons.sql` (after the events one) **before** merging the app update: the new Admin → Events form saves events the new way. Safe to run again. If you ever re-run the events (seasons) or notifications migration, run this one again after it.
2. In the app: **Admin → Events → Schedule an event**. Pick **Kind: Hackathon** (or Building event). Its first day is the kickoff and its last day the results day. Add tracks if you want them (e.g. "Health, Education"), when submissions close and when results are expected (Manila time).
3. While submissions are open, members with an approved card enter one project each from the event panel in the hall (`/#event`), in a track. Entries hang in the event's Museum room (`/museum?event=<key>`) from the first day.
4. After the deadline: **Admin → Events → Results**. Record 1st, 2nd and 3rd place and any named awards (overall or per track) with a short judges' note. Check them, then **Announce results**. That can't be undone: the hall announces it, every winning maker hears it in their bell, winners wear a ribbon on their badge and earn the **Champion** title, and the Museum's **Winners' Hall** shows them. A typo in a judges' note can still be fixed with **Edit note**.
5. Check: `/museum` opens with the Winners' Hall; the banner says "Results are in!" for a week.

## Map of the hall (V2-8, D-105)

No SQL. After the deploy, `/network` says how close the hall is to opening the map (30 members with projects and 10 team-ups). As an admin you can open it now to preview. When the hall gets there, a **Map** button appears in the hall by Passport for everyone.

## Events (V2-7, D-103)

1. Supabase **SQL editor:** run `supabase/migrations/20261006001000_seasons.sql` (after the wings one). Safe to run again. If you ever re-run the identity migration, run this one again after it (both define the PIP MART's shop functions).
2. In the app: **Admin → Events**. Schedule the first event: name (e.g. Build Week), first and last day, a banner line, an event Mission (e.g. "Meet N people", 3, 30 PIPs) and, if you like, a limited frame.
3. Check: on its first day every page shows the banner; the hall shows the event panel with real counts; the limited frame is in the PIP MART until the last day.

## Museum wings (V2-6, D-102)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000900_museum_wings.sql` (after the identity one). Safe to run again; it never overwrites notes you wrote.
2. In the app: **Admin → Wings**. Write a curator's note for each wing you want (up to 280 characters), rename or reorder them, add a tag wing (e.g. "Mobile Wing" with Kotlin, Swift, Flutter).
3. Check: `/museum` shows a door for each wing with something on show; open one: its note is at the top. An exhibit page lists its wings.

## Identity and proof (V2-5, D-101)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000800_identity.sql` (after the notifications one). Safe to run again. If you ever re-run the Missions or admin-rewards migration, run this one again after it.
2. Check: as an approved member (PIPs on), open **PIP MART**: "Your title" lists the six titles, earned ones can be worn, and the badge shows the title on a plate. Buy a plate and wear it. Open your profile: the **Proof** panel lists your titles. In the hall, **New set for today · 15 PIPs** swaps today's Missions once.

## Notifications and Recent in the hall (V2-4, D-100)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000700_notifications.sql` (after the Missions one). Safe to run again. If you ever re-run an earlier migration that it changes (the Missions one), run this one again after it.
2. Check: signed in, the top bar has a **bell**. Tag another member on a project: they see "… tagged you on …" in their bell. Reject a card in Admin with a note: that member's bell shows the note. As a visitor, the hall shows **Recent in the hall** under Missions.

## Missions and events (V2-3, D-099)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000600_missions_events.sql` (after the Passport one). Safe to run again.
2. Check: the hall shows **Missions** under the search. As an approved member (PIPs on), finish one (e.g. open three new profiles) and press **Claim**: +10 PIPs on the HUD. In the SQL editor, `select event_type, created_at from hall_events order by id desc limit 5;` lists what happened.

## Passport (V2-2, D-098)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000500_passport.sql` (after the console one). Safe to run again.
2. Check: as a visitor, open a few profiles, then **Passport** in the hall: they're stamped. As an approved member (PIPs on), open an exhibit, then **Passport**: it's in "Exhibits visited", saved to your account.

## Link previews and badge export (V2-1, D-095)

No SQL and no new settings: the functions in `api/` use the same `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_PUBLIC_ORIGIN` the site already has (Vercel gives project variables to functions too).

1. Deploy as usual. Vercel builds `api/preview.ts`, `api/og.ts` and `api/badge.ts` as functions; `vercel.json` sends only link-preview crawlers (Messenger, Discord, Slack, X, LinkedIn, WhatsApp, Telegram…) to the preview page.
2. Check: open `https://<your site>/api/og?member=<username>` in a browser. You should see a 1200×630 image of that member's badge.
3. Check: paste a member link into the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) (that's what Messenger uses) or send it to yourself on Messenger/Discord. The preview shows the member's name, role and badge image. Chat apps cache previews for a while; the debugger's **Scrape Again** refreshes it.
4. Check: on a member's profile, **Save badge (PNG)** downloads `pip-hall-<username>.png`; its QR opens the profile with "You found …!".

## Museum consoles (D-091)

1. Supabase **SQL editor:** run `supabase/migrations/20261006000400_museum_consoles.sql` (after the collaborators one). Safe to run again.
2. Check: the Museum shows each exhibit inside a PIXENDO console. A member with Museum access opens **My card → Museum**, picks a console for an exhibit, and the Museum shows it at once (no review).

## MUSEUM and affiliations

1. Supabase **SQL editor:** run `supabase/migrations/20261005000100_museum.sql` (after `…_pips_core.sql`). It also adds project ids to the cards already in the hall, so their projects can go in the Museum. Then run `…_museum_relink.sql` and `…_museum_follows_card.sql`, in that order. Together they give every project on an approved card an id (matching renamed projects by GitHub link, project link or title), and make the Museum follow the approved card: editing the draft never changes the Museum; the next approval does. Both are safe to run on a database that already has cards; `npm run test:db` proves it with an upgrade test.
2. In the app: **Admin → Affiliations**, add e.g. "CS Student" with **Gives Museum access**, and your organization as a label. Then **Published**, pick a member, and tick their affiliations.
3. That member opens **My card**: a **Museum** panel lists their approved projects; ticking one puts it on `/museum` straight away.

## 6. Keep the free project awake

Add repository secrets `SUPABASE_URL` and `SUPABASE_ANON_KEY` (GitHub → Settings → Secrets and variables → Actions). `.github/workflows/keepalive.yml` then reads one public card every Monday.

## If something goes wrong

| Symptom | Likely cause |
|---|---|
| Google returns to `localhost` or says the redirect is not allowed | The production `/auth/callback` is missing from Supabase redirect URLs, or Site URL is still localhost |
| "Access blocked: app has not completed verification" | Google consent screen still in Testing |
| The hall shows sample players | `VITE_DATA_SOURCE` isn't `supabase` in that environment; redeploy after fixing |
| QR opens a preview URL or localhost | `VITE_PUBLIC_ORIGIN` wrong at build time; fix and redeploy |
| Admin queue says "Only hall admins can do that" | `seed_first_admin.sql` not run for this Google account |
