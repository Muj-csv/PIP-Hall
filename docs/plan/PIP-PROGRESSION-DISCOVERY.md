# PIP Progression — discovery (AERIAL, DISCOVERY mode)

**Status:** P0 decisions made (D-058…D-065) · E1 specified in `PIP-PROGRESSION-E1.md` · **Date:** 2026-10-05 · **Owner:** Jum Flores
**Still open:** PD-6 feedback timing, PD-7 companions vs. personal Pips, PD-8 art owner and launch count, PD-9 Reputation. None of them block E1.

Source: Jum's "PIP Progression" idea list (PIPs, PIP MART, quests, achievements, streaks, Spotlight, Golden Introduction, Pip customization, Reputation). Labels: **CONFIRMED** (stated by Jum or true in the repo) · **DERIVED** · **RECOMMENDED** (my proposal) · **ASSUMPTION** · **OPEN**.

---

## 1. What the idea is, in one paragraph

Members earn a currency (**PIPs**) by doing things that make the Hall better: discovering other members, publishing projects, giving useful feedback, finishing quests. They spend PIPs in the **PIP MART** on card cosmetics (frames, stickers, badges), on their own Pip (outfits, companions), and on short, capped visibility boosts (Spotlight, Featured Project, Golden Introduction). Achievements and a separate **Reputation** score record contribution permanently and can't be bought. Guiding line (CONFIRMED, Jum): *"Don't buy attention. Earn the ability to stand out."*

## 2. What already exists that this builds on (CONFIRMED, repo)

| Already in PIP-Hall | Relevance |
|---|---|
| Members sign in with Google; cards are **admin-approved** before going public (D-002) | A natural gate against fake accounts farming PIPs (see §5) |
| Public cards are a **snapshot** in `published_cards`; any content edit sends the card back to review | Cosmetics must not live in that snapshot, or every purchase would need re-approval (§6) |
| All privileged writes go through **security-definer SQL functions** with RLS; 76 security tests | The economy must work the same way: the browser never sets a balance |
| The HUD already shows a **coin counter** (`×00`) that counts flips, per visit, not saved | Becomes the PIP display, or gets renamed so the two aren't confused |
| **Pip** is PIXENDO's single host character (D-024) | "Your own Pip" changes that rule (see §4, A4) |
| The badge's back is already called **QUEST LOG** (your projects) | Name clash with quests as tasks (A1) |
| Stickers already exist: up to 3, placed from the username (D-032) | Sticker slots in the Mart fit the existing visual language |
| `CLAUDE.md` "Do not build yet (after 6 Oct)" includes **reactions** | Feedback is close to reactions; this whole system is post-launch work |
| Free tiers only (Supabase, Vercel) | Fine for the economy's data volume (§8) |

## 3. Where I agree strongly (RECOMMENDED)

- **PIPs** for the currency and **PIP MART** for the shop: native to the world, short, already on-brand.
- **Earned beats bought.** Achievements and Reputation earned only; PIPs separate from Reputation.
- **One reward per card**, never per click; daily caps; quality gates on feedback.
- **Visibility is temporary and capped**, never a permanent "top spot".
- **Ship a small first version.** Your §18 list is still too big for one step; §9 cuts it further.

## 4. Where I'd push back or change things

**A1 · P1 — "Quests" collides with the badge's QUEST LOG.** Today Quest Log means *my projects*. If tasks are also quests, "Quest Log" means two things on the same screen. Options: rename the tasks to **Missions** (Daily Missions, Weekly Missions; Achievements stay achievements), or rename the badge back to **PROJECTS** and give "Quests" to the tasks. My pick: **Missions**, because the badge's "QUEST LOG" is already printed, tested and shipped.

**A2 · P0 — Pay-for-visibility in an organization directory.** In a game this is normal. In an org's member directory, an officer with lots of free time can out-spotlight a newer member. Your caps help; the real question is whether the org's admins are comfortable with members buying prominence at all. My suggestion: Spotlight comes from a **small shared pool of slots** (say 3 at a time, 24 h each, one per member per week), admin "Featured" always wins over bought Spotlight, and admins can end one early.

**A3 · P1 — Feedback is a much bigger feature than it looks.** It's user-written text attached to someone else's work, so it needs moderation, reporting, deletion, notifications, a place to read it, and spam rules. Your "Nice project!" exploit (§10) is real, and "recipient marks useful" can be gamed by two friends trading marks. My suggestion: leave feedback out of the first version. Earn PIPs from discovery, projects, missions and achievements first; add feedback as its own phase with moderation designed in.

**A4 · P1 — "Your own Pip" vs. Pip the host (D-024).** If every member has a Pip, the Hall has dozens of Pips and the host loses its identity. Alternative: Pip stays the one host; members collect **companions** (small critters that sit on the badge's clip or holder) and **outfits for their card**, not for Pip. Pip still *reacts* to your earnings in the dialogue box, so the emotional link stays.

**A5 · P1 — Art is the real cost.** Every frame, sticker, hat and companion is original pixel art (CLAUDE.md: nothing copied, everything lives in `src/lib/sprites.ts`), drawn in both DAY and NIGHT palettes and readable at badge size. A Mart with 40 items is 40 pieces of art plus review. My suggestion: launch the Mart with about **10 items** (4 frames, 6 stickers) and grow it.

**A6 · P2 — Rewards for *visiting* invite empty clicking.** "Visit 5 cards a day" and a login streak reward presence, not contribution. They're fine as small rewards, but they shouldn't outweigh projects and help. Suggested weights are in §6.

**A7 · P2 — The HUD coin counter.** Today it counts flips for fun. Either make it the live PIP balance when signed in (and hide it for visitors) or keep it as a toy. My pick: **PIP balance when signed in**, coin pickups animate when you earn.

## 5. Exploits and how the design closes them (DERIVED)

| Exploit | Closed by |
|---|---|
| Spam-clicking one card | One "discovered" row per (member, card); unique constraint in the database |
| Fake Google accounts discovering each other | Only **members with an approved card** earn, and they earn for discovering **approved** cards. Admin approval is the gate |
| Add and delete projects for "+25 per project" | Reward on **first approval** of a project (from the published snapshot), keyed per project; deleting never refunds or re-rewards |
| Editing the browser to grant PIPs | Balance is computed from a server-side ledger; only SQL functions insert rows; RLS blocks direct writes |
| Double rewards from double clicks or retries | Every reward has an idempotency key (e.g. `discover:<card id>`), unique per member |
| Two friends trading "useful" marks | Feedback phase only: daily cap, one reward per pair per week, admins can see patterns |
| Hoarding then monopolizing Spotlight | Shared slot pool, one Spotlight per member per week, admin override |
| Inflation (everyone rich in a month) | Daily earning cap, prices set as data (admins can tune), sinks: Spotlight, streak shield, rotating Mart items |

## 6. A first sketch of the economy (RECOMMENDED, numbers to tune)

**Earn** (approved members only; daily cap ~150 PIPs from discovery and missions combined)

| Action | PIPs | Rule |
|---|---|---|
| Discover a member (open their profile) | 5 | Once per member, ever |
| Project goes live (first approval) | 25 | Once per project |
| Card approved for the first time | 100 | Once |
| Daily mission complete | 15–25 | Resets at midnight PHT |
| Weekly mission complete | 100–250 | Resets Monday PHT |
| Achievement unlocked | 50–200 | Once each |
| Helpful feedback (later phase) | 10 + 5 bonus | Capped, see A3 |

**Spend**

| Item | PIPs | Notes |
|---|---|---|
| Card frame | 250–1,500 | Permanent, swap any time |
| Sticker (3 slots) | 100–300 | Joins or replaces the automatic stickers (D-032) |
| Companion | 400–2,000 | Sits on the badge clip |
| Spotlight (24 h) | 750 | From the shared pool, see A2 |
| Featured Project slot | 750 | Permanent slot; project choice free to change |
| Golden Introduction (24 h) | 1,000 | Pip's special intro when visitors reach the card |
| Streak Shield | 300 | Only if streaks ship |

## 7. Decisions needed from you

| ID | Decision | Priority | My recommendation |
|---|---|---|---|
| PD-1 | Is this after the v1.0 launch (6 Oct), as a separate track? | P0 | **Decided (D-058): start E1 now, behind a switch** |
| PD-2 | Who earns and spends PIPs? | P0 | **Decided (D-059): approved members only** |
| PD-3 | Do cosmetic purchases need admin review? | P0 | **Decided (D-060): no review for Mart items** |
| PD-4 | Is buying visibility acceptable to your admins? | P0 | **Decided (D-061): yes, capped** |
| PD-5 | Missions vs. Quests naming | P1 | **Decided (D-065): Missions** |
| PD-6 | Feedback in the first version? | P1 | No, its own later phase (A3) |
| PD-7 | Personal Pips or companions? | P1 | Companions; Pip stays the host (A4) |
| PD-8 | Who draws the Mart art, and how many items at launch? | P1 | About 10 items at launch (A5) |
| PD-9 | Reputation in the first version? | P2 | Later: achievements cover "earned" status at first |

## 8. How it would be built (DERIVED, fits the current stack, no new services)

- **Tables:** `pip_ledger` (append-only: member, amount, reason, idempotency key, time), `discoveries` (member, card, time), `mart_items` (catalog as data: kind, price, art key, active), `inventory` (member, item), `card_appearance` (member's equipped frame, stickers, companion; **public read, outside the reviewed snapshot**), `missions` + `mission_progress`, `achievements` + `member_achievements`, `spotlights` (member, starts, ends).
- **SQL functions** (security definer, like `approve_profile`): `discover_card`, `buy_item`, `equip_item`, `start_spotlight`, `claim_mission`. Each checks the rules in §5 and writes the ledger in one transaction. Balance = sum of the ledger (or a cached column updated in the same transaction).
- **Earning on approval** happens inside `approve_profile`, so project and card rewards can't be faked.
- **Public card:** `published_cards` stays as is; the hall reads `card_appearance` next to it, so cosmetics show immediately without re-review.
- **Privacy:** discoveries are private to the member (no "who viewed you"); the privacy page gets a section on PIPs and what's stored.
- **Cost:** a few small tables; thousands of rows, far inside Supabase's free tier.
- **Tests:** the security test suite grows to cover every exploit in §5.

## 9. Suggested phases (RECOMMENDED, pending §7)

| Phase | Ships | Why first |
|---|---|---|
| **E1 — PIPs core** | Ledger, balance in the HUD, discovery reward, card/project approval rewards, transaction history, Pip's reaction lines, ~5 achievements | Proves the loop is fun and exploit-safe before anything is for sale |
| **E2 — PIP MART v1** | ~4 frames + ~6 stickers, inventory, equip, `card_appearance` on badges | First real thing to spend on; mostly art |
| **E3 — Missions** | Daily + weekly missions, mission panel | Gives a reason to come back |
| **E4 — Spotlight** | Spotlight pool, Featured Project slot, Golden Introduction in the hall | The visibility sink, with caps |
| **E5 — Feedback** | Feedback on projects with moderation, "helpful" marks, related missions | Big, needs its own design (A3) |
| Later | Companions, Reputation, streaks + shield, rotating Mart, admin economy dashboard | Nice-to-have once the base is stable |

## 10. What I'd measure to know it works (RECOMMENDED)

- Share of approved members who earn at least once in their first week.
- Projects added per member before and after E1.
- Distinct members discovered per active member per week (exploration, not repeat clicks).
- How many PIPs sit unspent (inflation signal) and how often Spotlight slots are full.
