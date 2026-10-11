// The making-of comic (V2-23, D-136): the maker's three lines as three pixel panels. The problem:
// Pip puzzled under a "?"; what we built: the project's own picture; what happened: Pip jumping under
// stars, or the trophy when it won a place. Only the lines that were written are drawn. An ordered
// list, so the three steps are read in order; the pictures are decoration.

import { useId, useMemo, useState } from 'react';
import { previewFor } from '../../lib/preview';
import { COVER_PALETTE, coverLayers, MUSEUM_SPR, SPR, TROPHY_PALETTES, WORLD_OVERRIDES, WORLD_PALETTE } from '../../lib/sprites';
import { comicPanels } from '../../lib/story';
import { publicImageUrl } from '../../services/storageService';
import type { ProjectStory, PublicProject } from '../../types/card';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

const PIP = { ...WORLD_PALETTE, ...(WORLD_OVERRIDES.pipIdle ?? {}) };
const STAR = { ...WORLD_PALETTE, ...(WORLD_OVERRIDES.star0 ?? {}) };

export function MakingOfComic({ project, place }: { project: PublicProject; place: 1 | 2 | 3 | null }) {
  const id = useId();
  const panels = comicPanels(project.story);
  if (!panels.length) return null;
  return (
    <section className="menu-panel comic" aria-labelledby={id}>
      <h2 id={id} className="panel-title">
        How it was made
      </h2>
      <ol className="comic-strip">
        {panels.map((p) => (
          <li key={p.key} className="comic-panel" data-panel={p.key}>
            <div className="comic-art" aria-hidden="true">
              <PanelArt panel={p.key} project={project} place={place} />
            </div>
            <p className="comic-text">
              <b>{p.heading}</b> <span>{p.text}</span>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function PanelArt({ panel, project, place }: { panel: keyof ProjectStory; project: PublicProject; place: 1 | 2 | 3 | null }) {
  if (panel === 'problem')
    return (
      <>
        <span className="comic-bubble">?</span>
        <SpriteCanvas sprite={SPR.pipIdle} palette={PIP} className="comic-pip" />
      </>
    );
  if (panel === 'built') return <ComicPicture project={project} />;
  return place ? (
    <SpriteCanvas sprite={MUSEUM_SPR.trophy} palette={TROPHY_PALETTES[place]} className="comic-trophy" />
  ) : (
    <>
      <SpriteCanvas sprite={SPR.star0} palette={STAR} className="comic-star" style={{ left: '22%', top: '14%' }} />
      <SpriteCanvas sprite={SPR.star0} palette={STAR} className="comic-star" style={{ right: '22%', top: '24%' }} />
      <SpriteCanvas sprite={SPR.pipJump} palette={PIP} className="comic-pip" />
    </>
  );
}

/** The project's own picture, as the exhibit shows it (screenshot, GitHub's preview, or the pixel cover). */
function ComicPicture({ project }: { project: PublicProject }) {
  const preview = previewFor(project, publicImageUrl('project-covers', project.cover_path));
  const [failed, setFailed] = useState<string | null>(null);
  const layers = useMemo(() => coverLayers(project.title), [project.title]);
  const picture = preview.kind !== 'pixel' && failed !== preview.src ? preview : null;
  return picture ? (
    <img className="comic-picture" src={picture.src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(picture.src)} />
  ) : (
    <span className="comic-picture">
      {(['sky', 'hills', 'ground', 'emblem'] as const).map((d) => (
        <SpriteCanvas key={d} sprite={layers[d]} palette={COVER_PALETTE} className="cart-cover" />
      ))}
    </span>
  );
}
