// One arc of the two circles (D-129): a listbox whose options sit on a curve, the chosen one at the
// apex. Only the options near the chosen one are in the page (with their place in the whole list
// for screen readers); their positions are written straight to the DOM by the hall's animation
// loop through the function it registers, so turning the arc never re-renders. Keyboard: the arrow keys along the
// arc (either pair), Home and End, Enter to open the chosen one. A tap picks; a tap on the chosen
// one opens it. A drag or the mouse wheel turns the arc.

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { arcIndices, arcLook, WHEEL_STEP, type Arc } from '../../lib/circles';

/** Writes every rendered option's place for the arc turned to `pos`. */
export type ArcPlacer = (pos: number, arc: Arc) => void;

interface Props {
  id: string;
  label: string;
  count: number;
  /** The chosen option, and the one nearest the arc's apex while it is dragged. */
  index: number;
  near: number;
  optionLabel: (i: number) => string;
  renderOption: (i: number, chosen: boolean) => ReactNode;
  onPick: (i: number) => void;
  onOpen?: (i: number) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  /** True from the moment a press becomes a drag until just after release. */
  moved: React.RefObject<boolean>;
  /** Receives the function that places the options (null when the arc goes). Keep it stable. */
  register: (place: ArcPlacer | null) => void;
  className?: string;
}

export function ArcList({ id, label, count, index, near, optionLabel, renderOption, onPick, onOpen, onPointerDown, moved, register, className }: Props) {
  const items = useRef(new Map<number, HTMLDivElement>());
  const last = useRef<{ pos: number; arc: Arc } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const live = useRef({ index, count, onPick });
  useEffect(() => {
    live.current = { index, count, onPick };
  });

  const placeOne = useCallback((i: number, el: HTMLElement, pos: number, arc: Arc) => {
    const look = arcLook(i, pos, arc);
    // Whole pixels, and the chosen tile at exactly its size: a tile between pixels is drawn blurred.
    el.style.transform = `translate(${Math.round(look.x - arc.item / 2)}px,${Math.round(look.y - arc.item / 2)}px) scale(${look.scale.toFixed(3)})`;
    el.style.opacity = String(look.opacity);
    el.style.zIndex = String(look.zIndex);
    el.style.width = el.style.height = `${arc.item}px`;
  }, []);

  useEffect(() => {
    register((pos, arc) => {
      last.current = { pos, arc };
      for (const [i, el] of items.current) placeOne(i, el, pos, arc);
    });
    return () => register(null);
  }, [register, placeOne]);

  // The mouse wheel turns the arc one option per notch's worth of travel.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      const { index: i, count: n, onPick: pick } = live.current;
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if ((d < 0 && i <= 0) || (d > 0 && i >= n - 1)) return; // at an end: let the page scroll
      e.preventDefault();
      acc += e.deltaMode === 1 ? d * 20 : d;
      if (Math.abs(acc) < WHEEL_STEP) return;
      pick(i + Math.sign(acc));
      acc = 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (step) onPick(Math.max(0, Math.min(count - 1, index + step)));
    else if (e.key === 'Home') onPick(0);
    else if (e.key === 'End') onPick(count - 1);
    else if ((e.key === 'Enter' || e.key === ' ') && onOpen && count > 0) onOpen(index);
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const shown = [...new Set([...arcIndices(index, count), ...arcIndices(near, count)])].sort((a, b) => a - b);
  const optionId = (i: number) => `${id}-${i}`;
  return (
    <div
      ref={box}
      id={id}
      role="listbox"
      tabIndex={count > 0 ? 0 : -1}
      aria-label={label}
      aria-activedescendant={count > 0 ? optionId(index) : undefined}
      className={`arc ${className ?? ''}`}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
    >
      {shown.map((i) => (
        <div
          key={i}
          id={optionId(i)}
          ref={(el) => {
            if (el) {
              items.current.set(i, el);
              if (last.current) placeOne(i, el, last.current.pos, last.current.arc);
            } else items.current.delete(i);
          }}
          role="option"
          aria-selected={i === index}
          aria-setsize={count}
          aria-posinset={i + 1}
          aria-label={optionLabel(i)}
          className="arc-option"
          data-chosen={i === index || undefined}
          onClick={() => {
            if (moved.current) return; // the end of a drag is not a pick
            if (i === index) onOpen?.(i);
            else onPick(i);
          }}
        >
          {renderOption(i, i === index)}
        </div>
      ))}
    </div>
  );
}
