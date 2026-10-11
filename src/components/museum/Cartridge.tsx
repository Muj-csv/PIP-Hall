// An exhibit's cartridge (V2-23, D-136): an original pixel shell (stepped corners, grip ridges, a
// notch) whose label is drawn from the exhibit's own data: its picture (the screenshot, else
// GitHub's preview, else the pixel cover), its title, a stripe in its language's colour and the
// maker's number. No real console's cartridge or label shape is copied (D-020). It is a picture:
// the Play button beside it is the control.

import { useMemo, useState } from 'react';
import { stripeTone } from '../../lib/cartridge';
import { previewFor } from '../../lib/preview';
import { COVER_PALETTE, coverLayers } from '../../lib/sprites';
import { publicImageUrl } from '../../services/storageService';
import type { PublicProject } from '../../types/card';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

interface Props {
  project: PublicProject;
  /** The maker's member number, or null for an archive exhibit. */
  memberNo: number | null;
  /** Sliding into the console's slot. */
  inserting?: boolean;
  onClick?: () => void;
}

export function Cartridge({ project, memberNo, inserting = false, onClick }: Props) {
  const preview = previewFor(project, publicImageUrl('project-covers', project.cover_path));
  const [failed, setFailed] = useState<string | null>(null);
  const picture = preview.kind !== 'pixel' && failed !== preview.src ? preview : null;
  const layers = useMemo(() => coverLayers(project.title), [project.title]);
  const tone = stripeTone(project.language);
  return (
    <div
      className="cartridge"
      data-inserting={inserting || undefined}
      style={{ ['--stripe' as string]: `var(--color-card-${tone})` }}
      aria-hidden="true"
      onClick={onClick}
    >
      <span className="cart-ridges" />
      <div className="cart-label">
        <div className="cart-art">
          {picture ? (
            <img src={picture.src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(picture.src)} />
          ) : (
            (['sky', 'hills', 'ground', 'emblem'] as const).map((d) => <SpriteCanvas key={d} sprite={layers[d]} palette={COVER_PALETTE} className="cart-cover" />)
          )}
        </div>
        <span className="cart-name">{project.title}</span>
        <span className="cart-meta">
          {memberNo ? `No.${String(memberNo).padStart(3, '0')}` : 'ARCHIVE'}
          {project.language ? ` · ${project.language}` : ''}
        </span>
      </div>
    </div>
  );
}
