# MUSEUM and affiliations (spec)

**Status:** built (`feat/museum`, merged); v2 on `fix/museum-relink`: entries follow the approved card (D-071), admin summary, upgrade test. Evidence in `docs/build/evidence/museum/` · **Date:** 2026-10-05 · **Decisions:** D-067…D-071

## What it is
- **Affiliations** are labels an admin gives members, such as "ACM" or "CS Student" (D-067, D-068). Each one can grant **Museum access** and, from E2, name a perk frame (D-070). They show as public chips on the member's profile.
- **The MUSEUM** (`/museum`, public) is a gallery of projects, shuffled on every visit. Members whose affiliation grants Museum access choose which of their live projects go in (D-069). Exhibits show the project as approved, with a link to the creator's profile.

## Requirements
| ID | Requirement |
|---|---|
| FR-M-01 | Admins create, rename and delete affiliations (key, name, grants Museum access) in /admin |
| FR-M-02 | Admins turn affiliations on and off for a member in /admin; members can't |
| FR-M-03 | A member's affiliations show as chips on their profile (public, members in the hall only) |
| FR-M-04 | A member with Museum access sees "Show in the Museum" on each project that is live on their approved card, and can turn it on or off; this never sends the card back to review |
| FR-M-05 | `/museum` lists every opted-in project of members who currently have Museum access, shuffled; "Shuffle" reshuffles; each exhibit links to its creator's profile |
| FR-M-06 | Exhibits use the approved snapshot, so later unapproved edits never appear; a project removed from the card disappears from the Museum at the next approval |
| FR-M-07 | Loading, empty ("The Museum is waiting for its first exhibit") and error states, like every screen |

## Business rules
| ID | Rule |
|---|---|
| BR-M-01 | Only admins write affiliations and member affiliations (SQL functions check `is_admin()`) |
| BR-M-02 | A member can opt in only their own project, only if it is in their published card, and only while they have Museum access |
| BR-M-03 | Losing Museum access (affiliation removed) or unpublishing hides their exhibits; opt-ins are kept and return if access does |
| BR-M-04 | Project ids are added to the published snapshot (`build_card`), so exhibits are matched to the approved content |

## Data
`affiliations` (key, name, grants_museum, frame_key, sort) · `member_affiliations` (member_id, key, granted_at) · `museum_entries` (project_id, member_id, added_at). Functions: `admin_save_affiliation`, `admin_delete_affiliation`, `set_member_affiliation` (admin), `my_museum_access`, `set_museum` (member), `museum_exhibits` (public).
