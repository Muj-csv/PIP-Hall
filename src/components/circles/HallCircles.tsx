// The badge's back as two circles (D-129, D-132): flipping a badge in the level to its Quest Log
// brings the members onto one arc and the chosen member's quests onto the other, and between them
// that member's badge, still on its back (flip it to its front to go back to the level, open the
// profile) beside the chosen quest with VIEW. Picking someone else turns the quests' arc over to
// their projects. Side by side on wide screens, members along the top and quests along the bottom
// on narrow ones. The world behind it (sky, ground, Pip, the block the badge hangs from) is the
// level's own, drawn by the hall's loop with the camera still; this component lays out the arcs and
// the middle, and moves them from that same loop through its handle (D-031: one loop).

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { SLOT_SPACING, slotX } from '../../lib/carousel';
import { arcDots, circlesCentre, circlesLayout, panelBox, type CirclesLayout, type CirclesMode } from '../../lib/circles';
import { stepSwing, type SwingState } from '../../lib/swing';
import type { PublicCard } from '../../types/card';
import { Lanyard } from '../cards/Lanyard';
import { MemberCard } from '../cards/MemberCard';
import { PixelAvatar } from '../cards/PixelAvatar';
import { UNIT_PX, useCarousel } from '../carousel/useCarousel';
import { ArcList, type ArcPlacer } from './ArcList';
import { QuestArt } from './QuestArt';

export interface CirclesHandle {
  /** One frame of the hall's loop: turns both arcs to their places and swings the badge. */
  tick(dt: number, memberPos: number): void;
  /** Where Pip stands to face the badge or the chosen quest: CSS px from the screen's left. */
  spot(which: 'badge' | 'quest'): number | null;
  /** The next or previous quest (the ↑ and ↓ keys). */
  stepQuest(d: number): void;
  /** VIEW: opens the chosen quest. */
  viewQuest(): void;
  /** Whether the badge hangs from the ceiling (side by side) or under the members (stacked). */
  mode(): CirclesMode;
  /** Draws the two circles' rings, dotted, on the world's canvas (1 unit = 4 CSS px). */
  rings(ctx: CanvasRenderingContext2D, color: string): void;
}

interface Props {
  cards: PublicCard[];
  index: number;
  near: number;
  onMember: (i: number) => void;
  /** Dragging the members' arc: the hall's own carousel. */
  memberDrag: (e: React.PointerEvent) => void;
  memberMoved: React.RefObject<boolean>;
  flipped: boolean;
  onFlip: () => void;
  onOpen: () => void;
  onShowQr: (card: PublicCard) => void;
  onView: (card: PublicCard, quest: number) => void;
  /** A quest was picked: Pip walks over to it and says so. */
  onQuest: (card: PublicCard, quest: number) => void;
  onLayout: (mode: CirclesMode) => void;
  /** The quest to choose for a member (the one last opened on the quest screen). */
  pick?: { username: string; quest: number } | null;
  reduce: boolean;
}

const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const HallCircles = forwardRef<CirclesHandle, Props>(function HallCircles(
  { cards, index, near, onMember, memberDrag, memberMoved, flipped, onFlip, onOpen, onShowQr, onView, onQuest, onLayout, pick = null, reduce },
  ref,
) {
  const root = useRef<HTMLDivElement>(null);
  const hang = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const layout = useMemo<CirclesLayout | null>(() => (size ? circlesLayout(size.w, size.h) : null), [size]);
  const centre = useMemo(() => (layout && size ? circlesCentre(layout, size.w) : null), [layout, size]);
  const mode = layout?.mode ?? 'side';

  const card = cards[index];
  const projects = useMemo(() => card?.card.projects ?? [], [card]);
  // Only a quest picked for this member walks Pip over (not the reset when the member changes).
  const questOwner = useRef<string | null>(null);
  const quest = useCarousel({
    count: projects.length,
    reduce,
    axis: mode === 'side' ? 'y' : 'x',
    slotPx: layout?.second.spacing ?? 76,
    onIndexChange: (i) => {
      if (card && questOwner.current === card.username) onQuest(card, i);
    },
  });

  // Another member: their quests turn into place from the start of the arc, and the badge swings in.
  const swing = useRef<SwingState>({ angle: 0, vel: 0 });
  const username = card?.username ?? null;
  const pickRef = useRef(pick);
  pickRef.current = pick;
  useEffect(() => {
    const p = pickRef.current;
    const start = p && p.username === username ? p.quest : 0;
    questOwner.current = null;
    quest.go(start);
    if (start > 0) {
      quest.cam.current.x = slotX(start);
      quest.cam.current.v = 0;
    }
    questOwner.current = username;
    if (!reduce && username && start === 0) {
      quest.cam.current.x = -SLOT_SPACING * 1.5;
      quest.cam.current.v = 0;
      swing.current = { angle: swing.current.angle, vel: swing.current.vel + 2.2 };
    }
    // quest's functions and refs are stable; this follows the member only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);
  // A quest opened on the quest screen (its "More from…" links too) is the one chosen back here.
  useEffect(() => {
    if (!pick || pick.username !== username || pick.quest === quest.indexRef.current) return;
    questOwner.current = null;
    quest.go(pick.quest);
    questOwner.current = username;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pick]);

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => setSize((s) => (s && s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => onLayout(mode), [mode, onLayout]);

  const members = useRef<ArcPlacer | null>(null);
  const quests = useRef<ArcPlacer | null>(null);
  const registerMembers = useCallback((f: ArcPlacer | null) => {
    members.current = f;
  }, []);
  const registerQuests = useCallback((f: ArcPlacer | null) => {
    quests.current = f;
  }, []);
  const last = useRef({ m: NaN, q: NaN, a: NaN, layout: null as CirclesLayout | null });
  const live = useRef({ layout, centre, size, reduce, quest, card, onView, projects });
  useEffect(() => {
    live.current = { layout, centre, size, reduce, quest, card, onView, projects };
  });

  const viewQuest = useCallback(() => {
    const l = live.current;
    if (l.card && l.projects.length > 0) l.onView(l.card, l.quest.indexRef.current);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      tick(dt, memberPos) {
        const l = live.current;
        if (!l.layout || !l.centre) return;
        l.quest.step(dt);
        const q = l.quest.cam.current.x / SLOT_SPACING;
        const relaid = last.current.layout !== l.layout;
        // Only what moved is written: a still hall touches nothing.
        if (relaid || Math.abs(memberPos - last.current.m) > 0.0005) members.current?.(memberPos, l.layout.first);
        if (relaid || Math.abs(q - last.current.q) > 0.0005) quests.current?.(q, l.layout.second);
        const s = l.reduce ? { angle: 0, vel: 0 } : stepSwing(swing.current, 0, dt);
        swing.current = Math.abs(s.angle) < 0.01 && Math.abs(s.vel) < 0.01 ? { angle: 0, vel: 0 } : s;
        if (hang.current && (relaid || swing.current.angle !== last.current.a)) {
          hang.current.style.transform = `rotate(${swing.current.angle.toFixed(2)}deg) scale(${l.centre.badge.scale.toFixed(3)})`;
        }
        last.current = { m: memberPos, q, a: swing.current.angle, layout: l.layout };
      },
      spot(which) {
        const c = live.current.centre;
        if (!c) return null;
        return which === 'badge' ? c.badge.left + c.badge.width / 2 : c.panel.left + c.panel.width / 2;
      },
      stepQuest(d) {
        const l = live.current;
        if (l.projects.length > 0) l.quest.go(l.quest.indexRef.current + d);
      },
      viewQuest,
      mode: () => live.current.layout?.mode ?? 'side',
      rings(ctx, color) {
        const { layout: l, size: sz } = live.current;
        if (!l || !sz) return;
        ctx.fillStyle = color;
        // Under the brick ceiling when the badge hangs from it; always above the ground.
        const top = l.mode === 'side' ? 88 : 24;
        for (const arc of [l.first, l.second])
          for (const d of arcDots(arc, sz.w, sz.h, 8)) if (d.y > top && d.y < 524) ctx.fillRect(Math.round(d.x / UNIT_PX), Math.round(d.y / UNIT_PX), 1, 1);
      },
    }),
    [viewQuest],
  );

  const qi = Math.min(quest.index, Math.max(0, projects.length - 1));
  const chosen = projects[qi];
  const name = card ? first(card.card.full_name) : '';
  return (
    <div ref={root} className="circles" data-mode={mode}>
      {layout && centre && card && (
        <>
          <ArcList
            id="hall-members"
            label="Players"
            className="arc-members"
            count={cards.length}
            index={index}
            near={near}
            optionLabel={(i) => `${cards[i]!.card.full_name}, player ${i + 1} of ${cards.length}`}
            renderOption={(i) => {
              const c = cards[i]!;
              return (
                <span className="arc-tile member-tile">
                  <PixelAvatar username={c.username} name={c.card.full_name} avatarPath={c.card.avatar_path} />
                </span>
              );
            }}
            onPick={onMember}
            onOpen={() => onOpen()}
            onPointerDown={memberDrag}
            moved={memberMoved}
            register={registerMembers}
          />
          <ArcList
            id="hall-quests"
            label={`${name}’s quests`}
            className="arc-quests"
            count={projects.length}
            index={qi}
            near={quest.near}
            optionLabel={(i) => `Quest ${i + 1} of ${projects.length}: ${projects[i]!.title}`}
            renderOption={(i) => (
              <span className="arc-tile quest-tile">
                <QuestArt project={projects[i]!} className="quest-thumb" />
                <span className="quest-no" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
              </span>
            )}
            onPick={(i) => quest.go(i)}
            onOpen={viewQuest}
            onPointerDown={quest.onPointerDown}
            moved={quest.moved}
            register={registerQuests}
          />

          <div className="circles-badge" style={{ left: centre.badge.left, top: centre.badge.top, width: centre.badge.width, height: centre.badge.height }}>
            <div ref={hang} className="circles-hang" style={{ transform: `scale(${centre.badge.scale})` }}>
              <Lanyard />
              <div className="flipper">
                <MemberCard key={card.username} card={card} flipped={flipped} focusable onActivate={onFlip} onOpen={onOpen} onShowQr={() => onShowQr(card)} />
              </div>
            </div>
          </div>

          <section className="quest-panel" style={panelBox(centre)} aria-labelledby="quest-title">
            {chosen ? (
              <>
                <p className="quest-count m-0">
                  QUEST {qi + 1}/{projects.length}
                </p>
                <QuestArt project={chosen} />
                <h3 id="quest-title" className="quest-title m-0">
                  {chosen.title}
                </h3>
                {chosen.description && <p className="quest-desc m-0">{chosen.description}</p>}
                {(chosen.language || chosen.tech_stack.length > 0) && (
                  <p className="quest-facts m-0">{[chosen.language, ...chosen.tech_stack].filter(Boolean).slice(0, 4).join(' · ')}</p>
                )}
                <button type="button" className="pixel-btn quest-view" data-variant="primary" onClick={viewQuest}>
                  <span aria-hidden="true">▶ </span>VIEW<span className="sr-only"> {chosen.title}</span>
                </button>
              </>
            ) : (
              <>
                <h3 id="quest-title" className="quest-title m-0">
                  No quests yet
                </h3>
                <p className="quest-desc m-0">{name} hasn’t added a project to their Quest Log.</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
});
