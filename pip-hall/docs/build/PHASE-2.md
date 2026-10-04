# Phase 2 — Database + sign-in (Mon 5 Oct, morning)

**Goal:** real accounts and real public cards. Implements FR-01, FR-02 (connect only), the security model.

**Prerequisites from Ian:** Supabase project URL + anon key; Google and GitHub providers configured; manual linking on; redirect URLs set; migrations applied; himself promoted with `supabase/seed_first_admin.sql` after first sign-in.

**Do**
1. `services/supabase.ts` client; `cardService` `supabase` implementation (`published_cards`), switched by `VITE_DATA_SOURCE`.
2. Session provider, `RequireAuth`, `RequireAdmin` (reads own `user_roles` row; the database still enforces everything).
3. `/login` (Continue with Google), `/auth/callback`, sign out.
4. `githubService.connect()` → `linkIdentity({ provider: 'github' })`, then `rpc('sync_github_identity')`. Handle `identity_already_exists`.
5. `npm run test:db` wired into CI (`.github/workflows/ci.yml`) and `keepalive.yml`.

**Acceptance**
- Sign in with Google on localhost, connect GitHub, `profiles.github_username` set (after Phase 3 creates the row; until then the RPC returns the handle).
- Visiting `/` with `VITE_DATA_SOURCE=supabase` and an empty table shows the empty-state dialogue.
- Bundle contains no service-role key (`grep -r service_role dist` is empty).
- All 44+ DB tests pass.

**Don't touch:** card visuals (Gate 1 locked them).
