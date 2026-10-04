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
