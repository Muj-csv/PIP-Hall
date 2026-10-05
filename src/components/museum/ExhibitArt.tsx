// The picture inside an exhibit's gold frame: the project's cover, or a pixel cover drawn from its
// title when it has none (D-073), so the gallery never shows an empty frame.

import { useMemo } from 'react';
import { COVER_PALETTE, coverSprite } from '../../lib/sprites';
import { publicImageUrl } from '../../services/storageService';
import type { PublicProject } from '../../types/card';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

export function ExhibitArt({ project, eager = false }: { project: PublicProject; eager?: boolean }) {
  const cover = publicImageUrl('project-covers', project.cover_path);
  const sprite = useMemo(() => coverSprite(project.title), [project.title]);
  return (
    <div className="exhibit-frame">
      {cover ? (
        <img src={cover} alt="" className="exhibit-art" loading={eager ? 'eager' : 'lazy'} />
      ) : (
        <SpriteCanvas sprite={sprite} palette={COVER_PALETTE} className="exhibit-art" />
      )}
    </div>
  );
}
