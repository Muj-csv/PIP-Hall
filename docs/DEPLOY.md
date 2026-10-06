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
