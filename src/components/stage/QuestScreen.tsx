// One quest from a member's Quest Log, inside the PIXENDO screen (D-129): VIEW in the two circles
// irises into it, and /member/:username/quest/:id lands straight on it. Its picture, what it is,
// who made it, its links, what it won and whether it hangs in the Museum, and the maker's other
// quests one press away. BACK returns to the circles with this quest still chosen.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useAppearance } from '../../app/appearanceContext';
import { awardLabel } from '../../lib/events';
import { exhibitPath, memberPath, questPath } from '../../lib/publicUrl';
import { museumService } from '../../services/museumService';
import type { PublicCard } from '../../types/card';
import { QuestArt } from '../circles/QuestArt';
import { Ribbon } from '../museum/Ribbon';

interface Props {
  card: PublicCard;
  /** The quest's place in the member's Quest Log. */
  quest: number;
  onBack: () => void;
  /** Pip's line when opening this earned PIPs (as a profile does, E1). */
  reward?: string | null;
}

export function QuestScreen({ card, quest, onBack, reward = null }: Props) {
  const back = useRef<HTMLButtonElement>(null);
  const c = card.card;
  const p = c.projects[quest]!;
  const look = useAppearance();
  const won = look.awardsOf(card.profile_id).filter((a) => a.project_id === p.id);
  // Whether an admin featured it in the Museum (D-130); winners hang there anyway.
  const [featured, setFeatured] = useState(false);
  useEffect(() => {
    if (!p.id) return;
    let on = true;
    museumService
      .exhibits()
      .then((all) => on && setFeatured(all.some((e) => e.project_id === p.id)))
      .catch(() => undefined); // the quest stands without it
    return () => {
      on = false;
    };
  }, [p.id]);
  useEffect(() => back.current?.focus(), []);

  const onShow = Boolean(p.id) && (featured || won.length > 0);
  const facts = [p.language, p.stars ? `★ ${p.stars}` : null, p.project_date?.slice(0, 7)].filter(Boolean).join(' · ');
  const others = c.projects.map((x, i) => ({ x, i })).filter(({ i }) => i !== quest);
  return (
    <section className="menu-screen profile-screen quest-screen" aria-labelledby="quest-screen-title">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK<span className="sr-only"> to the hall</span>
      </button>
      <header className="grid gap-space-1">
        <p className="meta m-0">
          QUEST {quest + 1} OF {c.projects.length} ·{' '}
          <Link to={memberPath(c.username)} className="underline decoration-2">
            {c.full_name}
          </Link>
        </p>
        <h2 id="quest-screen-title">{p.title}</h2>
        {(p.collaborators?.length ?? 0) > 0 && (
          <p className="m-0">
            Made with{' '}
            {p.collaborators!.map((m, i) => (
              <span key={m.username}>
                {i > 0 && (i === p.collaborators!.length - 1 ? ' and ' : ', ')}
                <Link to={memberPath(m.username)} className="underline decoration-2">
                  {m.full_name}
                </Link>
              </span>
            ))}
          </p>
        )}
      </header>
      {reward && (
        <p className="notice m-0" role="status">
          {reward}
        </p>
      )}
      <div className="quest-screen-body">
        <QuestArt project={p} className="quest-art quest-art-big" />
        <div className="grid content-start gap-space-2">
          {p.description ? <p className="m-0">{p.description}</p> : <p className="m-0 text-text-secondary">No description yet.</p>}
          {facts && <p className="m-0 text-caption text-text-secondary">{facts}</p>}
          {p.tech_stack.length > 0 && (
            <ul className="powerup-list" aria-label="Built with">
              {p.tech_stack.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          )}
          {won.map((a) => (
            <p key={`${a.event_key}-${a.place ?? a.name}-${a.track ?? ''}`} className="award-plate m-0" data-place={a.place ?? 'award'}>
              <Ribbon award={a} />
              <span>
                <b>{awardLabel(a)}</b> <span className="text-caption">· {a.event}</span>
              </span>
            </p>
          ))}
          {(p.project_url || p.github_url || onShow) && (
            <p className="m-0 flex flex-wrap gap-space-3">
              {p.project_url && (
                <a href={p.project_url} target="_blank" rel="noopener noreferrer" className="pixel-btn no-underline" data-variant="primary">
                  Open {p.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {p.github_url && (
                <a href={p.github_url} target="_blank" rel="noopener noreferrer" className="pixel-btn no-underline">
                  Code on GitHub
                  <span className="sr-only"> for {p.title} (opens in a new tab)</span>
                </a>
              )}
              {onShow && (
                <Link to={exhibitPath(p.id!)} className="pixel-btn no-underline">
                  <span aria-hidden="true">⌂ </span>In the Museum
                </Link>
              )}
            </p>
          )}
        </div>
      </div>
      {others.length > 0 && (
        <section className="menu-panel" aria-labelledby="quest-more">
          <h3 id="quest-more" className="panel-title">
            More from {c.full_name.split(' ')[0]}
          </h3>
          <ul className="quest-more">
            {others.map(({ x, i }) => (
              <li key={`${x.title}-${i}`}>
                <Link to={questPath(c.username, x, i + 1)} replace className="quest-more-link">
                  <QuestArt project={x} className="quest-thumb" />
                  <span>
                    <b>{x.title}</b>
                    <span className="block text-caption text-text-secondary">Quest {i + 1}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
