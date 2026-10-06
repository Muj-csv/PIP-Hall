// The picture inside an exhibit's gold frame (D-073), shown as a diorama (D-083): the frame tilts in
// 3D toward the pointer while the pixel cover's layers (sky, hill, ground, emblem) shift by depth,
// under a hard-edged spotlight. An uploaded cover tilts as one layer with a glint. The pointer only
// sets two CSS variables on the frame, so nothing re-renders while it moves.

import { useMemo } from 'react';
import { COVER_PALETTE, coverLayers } from '../../lib/sprites';
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

export function ExhibitArt({ project, eager = false, featured = false }: { project: PublicProject; eager?: boolean; featured?: boolean }) {
  const cover = publicImageUrl('project-covers', project.cover_path);
  const layers = useMemo(() => coverLayers(project.title), [project.title]);
  return (
    <div className="exhibit-view" onPointerMove={tilt} onPointerLeave={settle}>
    <div className="exhibit-frame" data-featured={featured || undefined}>
      <div className="exhibit-stage">
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
      </div>
    </div>
    </div>
  );
}
