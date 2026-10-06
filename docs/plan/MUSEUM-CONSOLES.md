# Museum v3: console frames, app previews, makers' cards, collaborators

Status: **planned** (2026-10-06). Decisions agreed with the user are marked ✔.

## What changes for people

1. Every exhibit hangs inside an **original PIXENDO console** instead of a gold frame. Its screen shows a **preview of the app**.
2. **Opening a project** shows the **badges of the people who made it**: one badge for a solo project, all of them for a collaboration.
3. Members can **tag collaborators** on a project. A tag only shows once the tagged member **accepts** it and the owner's card is approved.

## Decisions

| # | Decision | Why |
|---|---|---|
| ✔ 1 | Five **original** console frames: portrait handheld, wide handheld with grips, home console on a CRT TV, arcade cabinet, flip-open handheld. No Nintendo (or other real) consoles, logos, silhouettes or button layouts. | CLAUDE.md hard rule (D-020, D-029); avoids trademark trouble. |
| ✔ 2 | The **maker picks** the console in their Museum panel; until they do, one is **assigned automatically** from the project id (stable, so it never changes on reload). | Variety by default, ownership when wanted. |
| ✔ 3 | **Preview order:** the member's uploaded cover (already supported) → GitHub's social preview image for the repo → our pixel cover. | Free and reliable. Live website screenshots need a paid service, and embedding a live site is blocked by most sites. |
| ✔ 4 | A tagged collaborator must **accept** before their badge appears. They can decline, or remove themselves later. | No unwanted tags. |
| 5 | Collaborators go public through the **approved card snapshot**, like everything public (ADR-002). An accepted tag shows from the owner's next approval. | Keeps one rule for what visitors see. |
| 6 | Only the **owner** puts a project in the Museum. Collaborators see it on their profile as "with @owner". | No duplicate exhibits, no need to merge them. |
| 7 | Tags only go to **members whose card is in the hall**; up to **8** collaborators per project. | Everyone shown has a public badge to show. |

## Phases (each ships on its own)

### Phase 1: collaborators (database + editor) — done (D-089)

- Migration `…_project_collaborators.sql`:
  - The `project_collaborators` table: `project_id` (references `projects`, cascade on delete), `member_id` (references `profiles`, cascade), `status` (`pending` / `accepted` / `declined`), timestamps.
  - Primary key on `(project_id, member_id)`. RLS so only the owner and the tagged member can read.
- Functions, all `security definer` with checks:
  - `tag_collaborator(project, username)`: owner only. The member must be in the hall, can't be the owner, max 8.
  - `untag_collaborator(project, member)`: owner only.
  - `respond_collaboration(project, accept)`: tagged member only.
  - `leave_collaboration(project)`: tagged member only.
  - `my_collaborations()`: incoming requests plus accepted ones.
- `build_card()` adds `collaborators: [{username, full_name, member_no}]` (accepted only) to each project in the snapshot.
- Security tests (about 25): strangers can't tag, read or accept; the owner can't accept for someone; untagging and deleting cascade; the snapshot holds only accepted tags.
- Editor:
  - Each project gets an **Add collaborator** search over hall members, with chips showing pending, accepted or declined.
  - The tagged member sees a **Collaboration requests** panel (Accept / Decline) in their editor and Settings.
- As built: one **Collaborators** panel in the editor holds both sides (tagging on your projects, and requests from others); Settings doesn't repeat it.

### Phase 2: "Made by": the makers' badges on the exhibit page

- `/museum/:id` shows a **Made by** row with the owner's real badge and each accepted collaborator's. Each badge flips, shows its QR, and opens the member's profile.
- Profiles list collaborations as "with @owner" in the Quest Log.
- `museum_exhibits()` returns the project's collaborators, so the gallery plaque can say "by A, B and C".

### Phase 3: console frames

- Five console frames in `sprites.ts` (casing, buttons, speaker grille, power LED), styled with theme tokens. DAY and NIGHT use the same art, because they're physical objects.
- The screen keeps the diorama: 3D tilt toward the pointer, layered parallax, spotlight, glint. A short **boot flicker** plays when it scrolls into view. Reduced motion means still and flat.
- Migration: `museum_entries.console` (checked against the list) plus `set_museum_console(project, console)`, owner only. Changing it doesn't need review (cosmetic, like D-060).
- The editor's Museum panel gets a console picker with a live preview.

### Phase 4: app previews

- `previewFor(project)`:
  1. `cover_path` (Storage).
  2. Otherwise, if `github_url` is a public GitHub repo, `https://opengraph.githubassets.com/1/<owner>/<repo>`.
  3. Otherwise the pixel cover.
- The image is cropped to the console's screen shape. If it fails to load, it falls back to the pixel cover, so the screen is never blank.
- The editor hints: "Upload a screenshot to show your app on the console screen."

## Tests and evidence

- Unit tests:
  - the console auto-pick is stable;
  - the preview order;
  - the sprite checks for the consoles;
  - collaborator limits.
- End-to-end, with the Supabase mock:
  - tag, accept and approve, then the badge appears on the exhibit;
  - decline means it never appears;
  - a stranger is refused;
  - the console picker;
  - the preview fallback.
- Screenshots of every console in DAY and NIGHT on desktop and phone.

## Deploy

- Two SQL migrations to run in the Supabase SQL editor, after the existing ones:
  - one for collaborators (phase 1);
  - one for the console choice (phase 3).
- Both are safe to re-run. No new environment variables.

## Out of scope for this plan

- Live website screenshots.
- Real-console artwork.
- Collaborators putting the shared project in the Museum themselves.
- Notifications or email about collaboration requests (the request shows in the app).
