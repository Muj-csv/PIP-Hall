// A member's full profile, shown inside the PIXENDO screen (brief §3): the hall's OPEN and VIEW
// PROFILE iris into it, and /member/:username (what a badge's QR opens) lands straight on it.
// The badge here is the real one: tap it, or "Show Quest Log", to turn it over.

import { useEffect, useRef } from 'react';
import { serialFor } from '../../lib/publicUrl';
import { useAchievements } from '../../lib/useAchievements';
import { publicImageUrl } from '../../services/storageService';
import type { PublicCard, PublicProject } from '../../types/card';
import { FlipBadge } from '../cards/BadgeStage';
import { DialogueBox } from '../dialogue/DialogueBox';

interface Props {
  card: PublicCard;
  onBack: () => void;
  onShowQr: () => void;
  /** Pip's line when opening this profile earned PIPs (E1). */
  reward?: string | null;
}

export function ProfileScreen({ card, onBack, onShowQr, reward = null }: Props) {
  const back = useRef<HTMLButtonElement>(null);
  const c = card.card;
  const achievements = useAchievements(card.profile_id);
  useEffect(() => back.current?.focus(), []);

  const meta = [`@${c.username}`, `No.${String(card.no).padStart(3, '0')}`, c.role, c.org_position, c.department].filter(Boolean).join(' · ');
  const links = [
    c.github_username && { label: `GitHub @${c.github_username}`, href: `https://github.com/${c.github_username}` },
    c.linkedin_url && { label: 'LinkedIn', href: c.linkedin_url },
    c.portfolio_url && { label: 'Website', href: c.portfolio_url },
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  return (
    <section className="menu-screen profile-screen" aria-labelledby="profile-name">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK<span className="sr-only"> to the hall</span>
      </button>

      <header className="grid gap-space-1">
        <h2 id="profile-name">{c.full_name}</h2>
        <p className="meta m-0">{meta}</p>
        {c.is_featured && (
          <p className="m-0 font-display tracking-[0.06em]">
            <span aria-hidden="true">★ </span>FEATURED
          </p>
        )}
        {c.tagline && <p className="m-0">{c.tagline}</p>}
        {achievements.length > 0 && (
          <ul className="powerup-list" aria-label="Achievements">
            {achievements.map((a) => (
              <li key={a.key} title={a.description}>
                <span aria-hidden="true">★ </span>
                {a.name}
              </li>
            ))}
          </ul>
        )}
      </header>

      {reward && <DialogueBox text={reward} emote="approved" />}

      <div className="profile-layout">
        <section className="profile-badge" aria-label="Badge">
          <FlipBadge card={card} onShowQr={onShowQr} />
          <button type="button" className="pixel-btn justify-self-center" data-variant="primary" onClick={onShowQr}>
            SCAN ME · show QR
          </button>
          <p className="m-0 text-center font-mono text-caption">{serialFor(card.no, c.username)}</p>
        </section>

        <div className="grid content-start gap-space-3">
          <section className="menu-panel" aria-labelledby="profile-about">
            <h3 id="profile-about" className="panel-title">
              About
            </h3>
            {c.bio ? <p className="m-0">{c.bio}</p> : <p className="m-0 text-text-secondary">No bio yet.</p>}
            {c.skills.length > 0 && (
              <ul className="powerup-list" aria-label="Skills">
                {c.skills.map((s) => (
                  <li key={s}>★ {s}</li>
                ))}
              </ul>
            )}
            {(links.length > 0 || c.public_email) && (
              <ul className="link-list" aria-label="Links">
                {links.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer">
                      {l.label}
                      <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </li>
                ))}
                {c.public_email && (
                  <li>
                    <a href={`mailto:${c.public_email}`}>{c.public_email}</a>
                  </li>
                )}
              </ul>
            )}
          </section>

          <section className="menu-panel" aria-labelledby="profile-quests">
            <h3 id="profile-quests" className="panel-title">
              Quest Log <span className="text-text-secondary">· {c.projects.length}</span>
            </h3>
            {c.projects.length === 0 ? (
              <DialogueBox text={`${c.full_name} hasn’t added any quests yet.`} />
            ) : (
              <ol className="quest-list">
                {c.projects.map((p, i) => (
                  <Quest key={`${p.title}-${i}`} project={p} n={i + 1} />
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}

/** /member/:username for someone who isn't in the hall (yet). */
export function MissingScreen({ username, onBack }: { username: string; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  return (
    <section className="menu-screen profile-screen" aria-labelledby="missing-title">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK<span className="sr-only"> to the hall</span>
      </button>
      <h2 id="missing-title">No card here</h2>
      <DialogueBox text={`Nobody in the hall goes by @${username} yet. They may still be in review, or the link has a typo.`} emote="attention" />
    </section>
  );
}

function Quest({ project: p, n }: { project: PublicProject; n: number }) {
  const cover = publicImageUrl('project-covers', p.cover_path);
  const facts = [p.language, p.stars ? `★ ${p.stars}` : null, p.project_date?.slice(0, 7)].filter(Boolean).join(' · ');
  return (
    <li className="quest-item">
      {cover && <img src={cover} alt="" className="quest-cover" loading="lazy" width={160} height={90} />}
      <div className="grid gap-space-1">
        <h4 className="m-0 text-body font-bold">
          <span className="font-mono text-text-secondary" aria-hidden="true">
            {String(n).padStart(2, '0')}{' '}
          </span>
          {p.title}
        </h4>
        {p.description && <p className="m-0">{p.description}</p>}
        {facts && <p className="m-0 text-caption text-text-secondary">{facts}</p>}
        {p.tech_stack.length > 0 && <p className="m-0 text-caption">{p.tech_stack.join(' · ')}</p>}
        {(p.project_url || p.github_url) && (
          <p className="m-0 flex flex-wrap gap-space-3">
            {p.project_url && (
              <a href={p.project_url} target="_blank" rel="noopener noreferrer">
                Open {p.title}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
            {p.github_url && (
              <a href={p.github_url} target="_blank" rel="noopener noreferrer">
                Code on GitHub
                <span className="sr-only"> for {p.title} (opens in a new tab)</span>
              </a>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
