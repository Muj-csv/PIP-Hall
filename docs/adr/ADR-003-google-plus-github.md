# ADR-003 — Google sign-in, linked GitHub identity, public repos without a token

Status: Accepted (follows D-003, D-016) · 2026-10-04

**Context.** Jum wants Google for contact email and GitHub to bring in projects. Supabase's default mailer can't send confirmation emails to real users, so passwords are out.

**Options.** (a) GitHub-only sign-in (one provider, verified email included). (b) Google sign-in + `linkIdentity('github')`. (c) Google sign-in + a typed GitHub username.

**Decision.** (b), as chosen. GitHub handle is copied server-side from `auth.identities` by `sync_github_identity()`. Repos come from `GET https://api.github.com/users/{handle}/repos` in the member's browser with no token (public data, 60 requests/hour per IP, used only in the picker) and are saved as `projects` rows.

**Trade-offs.** Two OAuth apps to configure; manual identity linking is a Supabase beta feature. Option (a) was simpler and was offered; Jum kept both. Private repos are out of scope (would need storing a token Supabase doesn't refresh); they go in as manual projects.

**Consequences.** Fallback if linking misbehaves: a typed GitHub username marked unverified. Gate 2 must test sign-in with a second Google account and a GitHub account already linked elsewhere.
