# PIP Progression — E1: PIPs core (spec)

**Status:** ready for review · **Date:** 2026-10-05 · **Owner:** Jum Flores · **Decisions:** D-058…D-065
**Build brief:** `docs/build/PHASE-E1.md` · **Discovery:** `PIP-PROGRESSION-DISCOVERY.md`

E1 proves the loop (do something good → earn → Pip notices) and that it can't be farmed, before anything is for sale. No Mart, no Missions, no Spotlight, no feedback in E1.

---

## 1. Scope

**In E1**
- PIP ledger and private balance (D-063)
- Rewards: first card approval, each project going live, discovering another member
- Five achievements (public on the profile, D-063)
- HUD coin shows the balance for approved members (D-064); Pip reacts in the dialogue box
- PIP history in Settings
- One-time backfill for already-approved members (D-062)
- Everything behind `VITE_FEATURE_PIPS` (D-058)

**Not in E1:** PIP MART (E2), Missions (E3), Spotlight / Golden Introduction / Featured Project (E4), feedback (E5), companions, Reputation, streaks, any spending.

## 2. Functional requirements

| ID | Requirement |
|---|---|
| FR-E1-01 | A member who has a card in `published_cards` (an **eligible member**, D-059) has a PIP balance equal to the sum of their ledger rows. Only they can read it |
| FR-E1-02 | When an eligible member opens another eligible member's profile (the in-device profile, D-054), the app calls `discover_card`. The first time ever for that pair it records a discovery and grants **+5 PIPs**; later times grant nothing |
| FR-E1-03 | When an admin approves a card for the first time, its owner gets **+100 PIPs** (welcome) |
| FR-E1-04 | Each project that goes live in an approval earns its owner **+25 PIPs**, once per project |
| FR-E1-05 | Achievements unlock automatically and grant their reward once (table in §4). Unlocked achievements are public on the member's profile |
| FR-E1-06 | Signed-in eligible members see their balance in the hall's HUD coin slot; a coin pickup plays when they earn. Everyone else sees the flip-count toy as today |
| FR-E1-07 | Pip announces each reward in the dialogue box ("You found someone new! +5 PIPs") and each achievement ("ACHIEVEMENT: Explorer! +100 PIPs") |
| FR-E1-08 | Settings shows the balance and the last 50 ledger entries (date, reason in plain words, amount) |
| FR-E1-09 | A migration grants already-approved members their first-approval, project and achievement rewards once (D-062) |
| FR-E1-10 | With `VITE_FEATURE_PIPS` off, the app behaves exactly as today and never calls the PIP functions |

## 3. Business rules

| ID | Rule |
|---|---|
| BR-E1-01 | Only eligible members earn. A card that is unpublished stops earning; its PIPs stay |
| BR-E1-02 | You can't discover yourself. You only earn for discovering eligible members |
| BR-E1-03 | Discovery PIPs are capped at **100 per day** (20 discoveries), days in PHT (UTC+8). Discoveries past the cap still count toward achievements but grant 0 PIPs |
| BR-E1-04 | Every grant has a unique key per member (`first_approval`, `project:<id>`, `discover:<id>`, `achievement:<key>`); the database refuses a second grant with the same key, so retries and double clicks are harmless |
| BR-E1-05 | Project rewards are capped at **12 per member, lifetime**, so deleting and re-adding projects can't farm PIPs |
| BR-E1-06 | Rewards are granted only by SQL functions. Members can read their own ledger and nothing else; nobody can insert, update or delete ledger rows directly |
| BR-E1-07 | Amounts and the cap are constants in one SQL function, so they can be tuned in one migration |

## 4. Achievements (E1)

No new art: shown as text chips with ★ in the badge's sticker style.

| Key | Name | Unlocks when | Reward |
|---|---|---|---|
| `first_card` | Card Holder | Your card is approved for the first time | 50 |
| `first_project` | First Quest | Your first project goes live | 50 |
| `builder` | Builder | 5 of your projects have gone live | 150 |
| `explorer` | Explorer | You've discovered 10 members | 100 |
| `hall_walker` | Hall Walker | You've discovered 50 members | 200 |

## 5. Data and functions (Supabase, same pattern as moderation)

New migration `supabase/migrations/2026100XXXXXXX_pips_core.sql`:

- `pip_ledger` (`id`, `member_id` → profiles on delete cascade, `amount int not null check (amount <> 0)`, `reason text check (reason in ('first_approval','project_live','discover','achievement'))`, `ref text not null`, `created_at`; `unique (member_id, ref)`). RLS: select own rows only; no insert/update/delete grants.
- `discoveries` (`member_id`, `card_id`, `created_at`; primary key (member_id, card_id)). RLS: select own; no write grants.
- `achievements` (`key` primary key, `name`, `description`, `reward`, `sort`), seeded with §4; public read.
- `member_achievements` (`member_id`, `key`, `unlocked_at`; primary key (member_id, key)). Public read **only for members with a published card**; no write grants.
- `grant_pips(member, amount, reason, ref)` internal (not executable by clients): inserts with `on conflict do nothing`, returns whether it granted.
- `check_achievements(member)` internal: unlocks and rewards any achievement whose condition now holds.
- `discover_card(p_card uuid) returns jsonb` (authenticated, security definer): checks BR-E1-01/02/03, records the discovery, grants, runs `check_achievements`, returns `{granted, amount, balance, unlocked: [...]}`.
- `my_pips() returns jsonb` (authenticated): `{eligible, balance}`.
- `approve_profile` updated: after publishing, grants `first_approval` and `project:<id>` for each of the owner's projects (respecting BR-E1-05), then `check_achievements`.
- Backfill block in the same migration (D-062).

**Security tests** (`supabase/tests/security.test.mjs`): member can't insert/update/delete ledger, discoveries or member_achievements; can't call `grant_pips` or `check_achievements`; can't read another member's ledger or balance; anon can't call `discover_card`; discovering yourself gives nothing; discovering an unpublished card gives nothing; a member without a published card earns nothing; second discovery of the same card gives nothing; the 21st discovery in a day gives 0 PIPs but still counts; approving twice doesn't re-grant `first_approval`; re-approval grants only new projects; the 13th project reward is refused; achievements unlock once; backfill gives an existing approved member the expected total; unpublished member keeps their balance.

## 6. Frontend

- `src/services/pipService.ts` (the only place that calls the PIP functions): `summary()`, `discover(cardProfileId)`, `history()`, `achievementsFor(memberId)`.
- `src/lib/features.ts`: `pipsEnabled` from `VITE_FEATURE_PIPS` (adds a fifth public client env var; update the CLAUDE.md env list).
- **Hall:** on opening a profile, if eligible, call `discover` once per card per session; on a grant, add the coin pickup and Pip's line; HUD shows the balance.
- **Profile screen:** an "Achievements" row of chips (hidden when none).
- **Settings:** a "PIPs" panel with balance and history (loading, empty "No PIPs yet: discover a member to earn your first", error with Retry).
- **Failure:** a failed PIP call never blocks browsing or the profile; the reward simply doesn't show, and the next open retries (the unique key keeps it single).
- **Privacy page:** a section on PIPs, what's stored (who you discovered, privately) and that nobody can see whom you viewed.

## 7. Acceptance criteria

1. Eligible member opens a new profile → +5 and Pip's line; opening it again → nothing; HUD balance updates.
2. 21 new profiles in one PHT day → the 21st grants 0 PIPs, but the Explorer achievement still counts it.
3. Admin approves a new member with 2 projects → that member has 100 + 50 (Card Holder) + 2×25 + 50 (First Quest) = **250 PIPs**.
4. Visitor (signed out) and signed-in member without an approved card → HUD shows the flip toy; no PIP calls are made.
5. Another member's profile shows their achievements; their balance is never visible anywhere.
6. Settings lists the ledger entries in plain words, newest first.
7. With the switch off, the existing e2e suite passes unchanged and no PIP requests are made.
8. All security tests in §5 pass; existing 76 still pass.

## 8. Effort and risk

- **Effort (DERIVED):** about 1–1.5 days for one developer with this codebase: 1 migration, ~20 security tests, 1 service, 3 UI touch points, e2e.
- **Risk:** low for the launch, because of the switch. Main technical risk is the `approve_profile` change; the security tests cover it.
