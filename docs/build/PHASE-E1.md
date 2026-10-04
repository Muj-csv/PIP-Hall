# Phase E1 — PIPs core (build brief)

**Goal:** members with an approved card earn PIPs for discovering members and getting projects approved, see their balance in the HUD, and unlock five achievements. Nothing to spend yet. Spec: `docs/plan/PIP-PROGRESSION-E1.md` (FR-E1-01…10, BR-E1-01…07). Decisions: D-058…D-065.

**Do**
1. Migration `supabase/migrations/<timestamp>_pips_core.sql`: `pip_ledger`, `discoveries`, `achievements` (seeded), `member_achievements`, internal `grant_pips` and `check_achievements`, client functions `discover_card` and `my_pips`, updated `approve_profile`, one-time backfill. Grants and RLS exactly as spec §5.
2. New cases in `supabase/tests/security.test.mjs` for every rule in spec §5.
3. `src/lib/features.ts` (`pipsEnabled` from `VITE_FEATURE_PIPS`); add the variable to `.env.example`, `playwright.config.ts` and the CLAUDE.md env list.
4. `src/services/pipService.ts`; extend `e2e/mockDb.ts` with the PIP functions.
5. Hall: discover on profile open, HUD balance, coin pickup, Pip's lines. Profile screen: achievements row. Settings: PIPs panel. Privacy page: PIPs section.
6. e2e for acceptance criteria 1–7; unit tests for any pure helpers (reason labels, PHT day boundary).

**Don't touch:** Mart, Missions, Spotlight, feedback, companions, Reputation, new sprite art. Don't change `published_cards`' shape.

**Acceptance:** spec §7, items 1–8, shown as evidence (tests plus screenshots of the HUD balance, the profile achievements row and the Settings panel).

Before reporting: typecheck, lint, test, test:db, build and e2e all pass, with `VITE_FEATURE_PIPS` both on and off. Then **stop and report**.
