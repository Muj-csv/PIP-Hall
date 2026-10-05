# PIP Progression — E2: PIP MART v1 (spec)

**Status:** built on `feat/pips-e2-mart`, behind `VITE_FEATURE_PIPS` · **Date:** 2026-10-05 · **Decisions:** D-074…D-076 (and D-060, D-067, D-070)
**Evidence:** `docs/build/evidence/phase-e2/`

Members in the hall spend the PIPs they earned in E1 on **badge frames**, and wear an affiliation's free **perk frame** (e.g. ACM MEMBER).

## Scope
- In: four frames for sale, inventory, equip/unequip, frames on every badge (hall, profile, editor preview, Mart preview), affiliation perk frames, the admin switch for them, purchases in the PIP history.
- Not in E2: stickers, Pip outfits, companions, Spotlight (E4), refunds, gifting, rotating stock.

## Rules
| ID | Rule |
|---|---|
| BR-E2-01 | Only members with a card in the hall can buy or equip (same eligibility as E1) |
| BR-E2-02 | Buying is locked per member and refused without enough PIPs; each item is bought once |
| BR-E2-03 | A purchase is one negative `purchase` row in `pip_ledger`; nobody writes the ledger, inventory or appearance directly |
| BR-E2-04 | A member can wear only a frame they own, or the member frame of an affiliation that gives one and that they have |
| BR-E2-05 | Prices, names and availability are data (`mart_items`); retired items stay owned and wearable but can't be bought |
| BR-E2-06 | What a badge wears is public (`card_appearances()`); inventories and balances stay private |
| BR-E2-07 | A frame that is no longer valid (affiliation removed) simply isn't shown; nothing is deleted |

## Data and functions
`supabase/migrations/20261006000000_pip_mart.sql`: `mart_items` (seeded), `inventory`, `card_appearance`; `my_mart()`, `buy_item(key)`, `equip_frame(frame, affiliation)`, public `card_appearances()`, admin `admin_set_affiliation_frame(key, frame)`; internal `valid_frame(member)`, `perk_label(name)`. Ledger reasons gain `purchase`. 37 security tests in `supabase/tests/security.test.mjs` ("PIP MART (E2)").

## Frontend
`/mart` (signed in; "PIP MART" in the top bar when PIPs are on): balance, try-on preview on your own badge, buy with an inline confirm, wear, perk frames. `AppearanceProvider` loads every badge's frame once; `MemberCard` wears it (`data-frame`, corner ornaments, perk label). Admin → Affiliations: **Give member frame**. e2e: `e2e/mart.pips.spec.ts`.
