# Phase 4 — Public page, QR, admin, first deploy (Mon 5 Oct, evening)

**Goal:** the loop closes: approved cards are public and shareable. Implements FR-08, FR-11, FR-12.

**Do**
1. `/member/:username`: full card (both faces side by side on desktop, flippable on phone), all projects, links, QR, "Back to the collection". Not-found state through `DialogueBox`. Page `<title>` = member name.
2. `QrBadge` encodes `${VITE_PUBLIC_ORIGIN}/member/${username}`; `QrFullscreen` "SCAN ME" sheet with max brightness hint.
3. `/admin`: `ModerationQueue` tabs Pending / Published / Featured; `ReviewPanel` shows the draft card next to the live card (if any); Approve, Reject (note required), Unpublish, Feature toggle, Rename. All through `adminService` RPCs.
4. Deploy to Vercel; set env vars; add the production URL to Supabase redirect URLs.

**Acceptance**
- On the live URL: sign in as a second Google account, submit; approve as admin; card appears on `/`.
- Scan the QR with a real phone → `/member/<username>` loads cold (no 404).
- Non-admin visiting `/admin` sees the "not allowed" dialogue and the RPCs refuse.
