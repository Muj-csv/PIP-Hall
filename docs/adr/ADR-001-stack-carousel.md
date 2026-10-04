# ADR-001 — Custom stack carousel on Motion instead of Embla

Status: Accepted (recommended, D-019) · 2026-10-04

**Context.** The spec prefers Embla. The design hangs cards from lanyards: the current card is large and centred, neighbours hang smaller, lower and behind it, and each card swings with drag velocity (DESIGN_BRIEF §7). Tap flips; drag browses. Up to a few hundred cards.

**Options.** (a) Embla: a linear scrolling strip; every slide is in the DOM; depth, overlap and swing would fight its layout model. (b) Swiper "cards"/coverflow effects: heavier, opinionated visuals. (c) Custom: an index + Motion `drag="x"` on a gesture layer, cards positioned by their offset from the index.

**Decision.** (c). Render only current ±2. Drag offset maps to card x/scale/rotation; on release, snap by distance or velocity. Swing is a spring on `rotate` fed by drag velocity. A movement threshold (6px) separates drag from tap so a tap flips and a drag never does. Keyboard: ←/→ move, Enter/Space flip, `o` opens profile.

**Trade-offs.** We own ~200 lines of gesture code and its edge cases (momentum, resize, focus). In return: the exact layout, constant DOM size, no extra dependency.

**Update (2026-10-04, D-031).** Built without Motion: the design lab's camera spring, swing pendulum and Pip all run on one `requestAnimationFrame` loop that writes transforms straight to the DOM, so Motion would only add weight. Only current ±2 badges render (and the ±2 around the camera while dragging).

**Consequences.** `useCarousel` gets unit tests for index math; Playwright covers drag, keys and tap-vs-drag.
