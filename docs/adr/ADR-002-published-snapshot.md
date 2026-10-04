# ADR-002 — Public reads come from a `published_cards` snapshot table

Status: Accepted (follows D-002) · 2026-10-04

**Context.** Edits to an approved card must be reviewed again while the approved version stays public (D-002). The spec's design had visitors read `profiles` and `projects` directly under RLS.

**Options.** (a) Visitors read drafts; edits go live immediately (breaks D-002). (b) A `published jsonb` column on `profiles`, exposed through a view (views bypass RLS unless `security_invoker`; easy to leak draft columns). (c) A separate `published_cards` table, written only by admin functions, readable by everyone.

**Decision.** (c). `approve_profile()` builds the card with `build_card()` and upserts it; `unpublish_profile()` deletes it; `set_featured()` and `admin_set_username()` patch it.

**Trade-offs.** Data is duplicated (draft + snapshot), so a field added to the card must be added to `build_card()`. In exchange: visitors can't see a single draft column, public reads are one indexed query, and search loads one table.

**Consequences.** Images use a new file name per upload so the snapshot keeps its approved image. Deleting an account cascades to the snapshot.
