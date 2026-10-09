// A quest's picture (D-092, D-129): the uploaded screenshot, else GitHub's preview of the repo, else
// the drawn pixel cover; a picture that fails to load falls back to the pixel cover. Decorative:
// the quest's title is always next to it.

import { useMemo, useState } from 'react';
import { previewFor } from '../../lib/preview';
import { COVER_PALETTE, coverSprite } from '../../lib/sprites';
import { publicImageUrl } from '../../services/storageService';
import type { PublicProject } from '../../types/card';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

export function QuestArt({ project, className = 'quest-art' }: { project: PublicProject; className?: string }) {
  const preview = previewFor(project, publicImageUrl('project-covers', project.cover_path));
  const [failed, setFailed] = useState<string | null>(null);
  const cover = useMemo(() => coverSprite(project.title), [project.title]);
  const picture = preview.kind !== 'pixel' && failed !== preview.src ? preview : null;
  return (
    <span className={className} aria-hidden="true">
      {picture ? (
        <img src={picture.src} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(picture.src)} />
      ) : (
        <SpriteCanvas sprite={cover} palette={COVER_PALETTE} />
      )}
    </span>
  );
}
