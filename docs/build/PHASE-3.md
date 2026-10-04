# Phase 3 — Card editor + repo picker (Mon 5 Oct, afternoon)

**Goal:** a member builds and submits their card without help. Implements FR-03, FR-04, FR-05, FR-06, FR-07.

**Do**
1. `/edit` (and `/create` → redirect): `CardEditor` with the live `MemberCard` preview where the hero card sits; sections Identity, Links, Skills, Projects; username prefilled from the GitHub handle, shown read-only once locked.
2. Validation in `lib/validate.ts` mirroring the database checks (lengths, https, LinkedIn domain, reserved usernames, max 8 skills, max 6 projects). Errors under fields, focus moves to the first error.
3. Avatar: `lib/image.ts` resizes to 512px WebP (~80 quality) before upload to `avatars/<uid>/<uuid>.webp`; covers to 960px. Reject > 8 MB before processing.
4. `RepoPicker`: lists public repos (name, description, language, stars, updated), tick up to 6, reorder, edit description, "refresh from GitHub". States: not connected, loading, list, empty, rate-limited (show reset time).
5. `ManualProjectForm` (D-007).
6. `StatusBanner` with `Emote` per status and the admin's `review_note` when rejected; "Submit for review" / "Submit changes" calls `submit_for_review`.
7. Save is explicit (button + Ctrl/Cmd+S); warn on leaving with unsaved changes.

**Acceptance**
- Full path on localhost: sign in → connect GitHub → pick 3 repos → add 1 manual project → photo → submit → status shows pending.
- Editing after approval shows "Live version is older — submit changes" and the public card is unchanged.
- Vitest covers validators and image sizing.
