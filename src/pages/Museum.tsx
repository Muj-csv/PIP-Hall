// /museum (D-069): a walk through members' projects, shuffled on every visit. Members with
// Museum access choose which of their approved projects hang here; exhibits show them as approved.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { memberPath } from '../lib/publicUrl';
import { shuffle } from '../lib/shuffle';
import { museumService } from '../services/museumService';
import { publicImageUrl } from '../services/storageService';
import type { Exhibit } from '../types/museum';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; exhibits: Exhibit[] };

export default function Museum() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let on = true;
    museumService
      .exhibits()
      .then((exhibits) => on && setLoad({ status: 'ready', exhibits }))
      .catch(() => on && setLoad({ status: 'error' }));
    return () => {
      on = false;
    };
  }, [attempt]);

  const exhibits = load.status === 'ready' ? load.exhibits : null;
  // A new order on every visit and every Shuffle (round is the trigger).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const order = useMemo(() => (exhibits ? shuffle(exhibits) : []), [exhibits, round]);
  const retry = useCallback(() => {
    setLoad({ status: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  return (
    <MenuPage title="Museum" wide>
      {load.status === 'loading' && <DialogueBox text="Unlocking the gallery…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text="Can’t reach the Museum right now. Check your connection and try again." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={retry}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {exhibits && exhibits.length === 0 && (
        <DialogueBox text="The Museum is waiting for its first exhibit. Members with Museum access can add projects from their card editor." />
      )}
      {exhibits && exhibits.length > 0 && (
        <>
          <DialogueBox text="Welcome to the Museum: projects from members of the hall, in a new order every visit." />
          <div className="flex flex-wrap items-center gap-space-3">
            <button type="button" className="pixel-btn" data-variant="primary" onClick={() => setRound((r) => r + 1)}>
              <span aria-hidden="true">⟳ </span>Shuffle
            </button>
            <p className="m-0 font-display tracking-[0.04em]" role="status">
              {exhibits.length} {exhibits.length === 1 ? 'exhibit' : 'exhibits'}
            </p>
          </div>
          <ul className="museum-grid" aria-label="Exhibits">
            {order.map((e) => (
              <li key={e.project_id}>
                <ExhibitFrame exhibit={e} />
              </li>
            ))}
          </ul>
        </>
      )}
    </MenuPage>
  );
}

function ExhibitFrame({ exhibit: e }: { exhibit: Exhibit }) {
  const p = e.project;
  const cover = publicImageUrl('project-covers', p.cover_path);
  const facts = [p.language, ...p.tech_stack].filter(Boolean).slice(0, 4).join(' · ');
  return (
    <article className="exhibit" aria-labelledby={`ex-${e.project_id}`}>
      <div className="exhibit-frame">
        {cover ? (
          <img src={cover} alt="" className="exhibit-art" loading="lazy" />
        ) : (
          <div className="exhibit-art exhibit-art-blank" aria-hidden="true">
            <span>{p.title.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="exhibit-plaque">
        <h2 id={`ex-${e.project_id}`} className="m-0 font-display text-h3 font-normal">
          {p.title}
        </h2>
        {p.description && <p className="m-0">{p.description}</p>}
        {facts && <p className="m-0 text-caption text-text-secondary">{facts}</p>}
        <p className="m-0 text-caption">
          by{' '}
          <Link to={memberPath(e.username)} className="underline decoration-2">
            {e.full_name}
          </Link>{' '}
          <span className="text-text-secondary">· No.{String(e.member_no).padStart(3, '0')}</span>
        </p>
        {(p.project_url || p.github_url) && (
          <p className="m-0 flex flex-wrap gap-space-3">
            {p.project_url && (
              <a href={p.project_url} target="_blank" rel="noopener noreferrer" className="exhibit-link">
                Open {p.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {p.github_url && (
              <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="exhibit-link">
                Code<span className="sr-only"> for {p.title} on GitHub (opens in a new tab)</span>
              </a>
            )}
          </p>
        )}
      </div>
    </article>
  );
}
