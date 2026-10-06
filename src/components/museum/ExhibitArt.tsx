// The picture of an exhibit, shown on the screen of an original PIXENDO console (D-091) as a
// diorama (D-083): the console tilts in 3D toward the pointer while the pixel cover's layers (sky,
// hill, ground, emblem) shift by depth, under a hard-edged spotlight. An uploaded cover tilts as one
// layer with a glint. The pointer only sets two CSS variables, so nothing re-renders while it moves.
// The console boots (screen flicker, LED on) the first time it scrolls into view.

import { useEffect, useMemo, useRef, useState } from 'react';
import { COVER_PALETTE, consoleArt, coverLayers, spriteSize, type ConsoleKind, type Rect } from '../../lib/sprites';
import { publicImageUrl } from '../../services/storageService';
import type { PublicProject } from '../../types/card';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

const DEPTHS = ['sky', 'hills', 'ground', 'emblem'] as const;

function tilt(e: React.PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== 'mouse') return;
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--tx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
  e.currentTarget.style.setProperty('--ty', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
}
function settle(e: React.PointerEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty('--tx', '0');
  e.currentTarget.style.setProperty('--ty', '0');
}

/** A rect in sprite units as a box positioned in percent of the console. */
function place(r: Rect, w: number, h: number): React.CSSProperties {
  return { left: `${(r.x / w) * 100}%`, top: `${(r.y / h) * 100}%`, width: `${(r.w / w) * 100}%`, height: `${(r.h / h) * 100}%` };
}

/** True once the element has been on screen (at once where IntersectionObserver is missing). */
function useSeen(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

interface Props {
  project: PublicProject;
  console: ConsoleKind;
  eager?: boolean;
  featured?: boolean;
}

export function ExhibitArt({ project, console: kind, eager = false, featured = false }: Props) {
  const cover = publicImageUrl('project-covers', project.cover_path);
  const layers = useMemo(() => coverLayers(project.title), [project.title]);
  const art = consoleArt(kind);
  const { w, h } = spriteSize(art.sprite);
  const ref = useRef<HTMLDivElement>(null);
  const on = useSeen(ref);
  return (
    <div className="exhibit-view" onPointerMove={tilt} onPointerLeave={settle}>
      <div className="console-bay">
        <div
          ref={ref}
          className="exhibit-frame console"
          data-console={kind}
          data-featured={featured || undefined}
          data-on={on || undefined}
          style={{ ['--cw' as string]: w, ['--ch' as string]: h }}
        >
          <SpriteCanvas sprite={art.sprite} palette={art.palette} className="console-body" />
          <div className="exhibit-stage" style={place(art.screen, w, h)}>
            {cover ? (
              <img src={cover} alt="" className="exhibit-art" loading={eager ? 'eager' : 'lazy'} />
            ) : (
              <div className="exhibit-art exhibit-diorama">
                {DEPTHS.map((d) => (
                  <SpriteCanvas key={d} sprite={layers[d]} palette={COVER_PALETTE} className="diorama-layer" style={{ ['--depth' as string]: DEPTHS.indexOf(d) }} />
                ))}
              </div>
            )}
            <i className="exhibit-glint" aria-hidden="true" />
            <i className="exhibit-spot" aria-hidden="true" />
            <i className="console-scan" aria-hidden="true" />
          </div>
          <i className="console-led" style={place(art.led, w, h)} aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
