// /member/:username — a member's shareable page (FR-11), where their QR code leads. Reads the
// published snapshot only (ADR-002), so drafts and hidden fields never reach it.

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { BadgeStage, FlipBadge } from '../components/cards/BadgeStage';
import { MemberCard } from '../components/cards/MemberCard';
import { QrFullscreen } from '../components/cards/QrFullscreen';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { Panel } from '../components/shell/MenuPage';
import { TopBar } from '../components/shell/TopBar';
import { serialFor } from '../lib/publicUrl';
import { useWide } from '../lib/useWide';
import { cardService } from '../services/cardService';
import { publicImageUrl } from '../services/storageService';
import type { PublicCard, PublicProject } from '../types/card';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'missing' } | { status: 'ready'; card: PublicCard };

export default function Member() {
  const { username = '' } = useParams();
  const [load, setLoad] = useState<{ for: string; load: Load }>({ for: username, load: { status: 'loading' } });
  const [attempt, setAttempt] = useState(0);
  const state: Load = load.for === username ? load.load : { status: 'loading' };

  useEffect(() => {
    let live = true;
    cardService
      .getByUsername(username)
      .then((card) => live && setLoad({ for: username, load: card ? { status: 'ready', card } : { status: 'missing' } }))
      .catch(() => live && setLoad({ for: username, load: { status: 'error' } }));
    return () => {
      live = false;
    };
  }, [username, attempt]);

  const name = state.status === 'ready' ? state.card.card.full_name : null;
  useEffect(() => {
    document.title = name ? `${name} · PIP-Hall` : state.status === 'missing' ? 'No card here · PIP-Hall' : 'PIP-Hall';
  }, [name, state.status]);

  return (
    <div className="mx-auto max-w-[1080px] px-space-4 pb-space-8">
      <TopBar />
      <main className="mx-auto mt-space-6 grid max-w-[1040px] gap-space-4">
        <Link to="/" className="pixel-btn justify-self-start">
          ◀ Back to the collection
        </Link>
        {state.status === 'loading' && (
          <>
            <h1 className="sr-only">Loading @{username}</h1>
            <DialogueBox text={`Looking for @${username} in the hall…`} emote="pending" />
          </>
        )}
        {state.status === 'error' && (
          <>
            <h1 className="m-0 font-display text-h1 font-normal">Can’t reach the hall</h1>
            <DialogueBox text="This card couldn’t load. Check your connection and try again." emote="attention">
              <button
                type="button"
                className="hw-btn"
                data-variant="small"
                onClick={() => {
                  setLoad({ for: username, load: { status: 'loading' } });
                  setAttempt((a) => a + 1);
                }}
              >
                RETRY
              </button>
            </DialogueBox>
          </>
        )}
        {state.status === 'missing' && (
          <>
            <h1 className="m-0 font-display text-h1 font-normal">No card here</h1>
            <DialogueBox text={`Nobody in the hall goes by @${username} yet. They may still be in review, or the link has a typo.`} emote="attention" />
          </>
        )}
        {state.status === 'ready' && <Profile card={state.card} />}
      </main>
    </div>
  );
}

function Profile({ card }: { card: PublicCard }) {
  const wide = useWide();
  const [showQr, setShowQr] = useState(false);
  const c = card.card;
  const meta = [`@${c.username}`, `No.${String(card.no).padStart(3, '0')}`, c.role, c.org_position, c.department].filter(Boolean).join(' · ');
  const links = [
    c.github_username && { label: `GitHub @${c.github_username}`, href: `https://github.com/${c.github_username}` },
    c.linkedin_url && { label: 'LinkedIn', href: c.linkedin_url },
    c.portfolio_url && { label: 'Website', href: c.portfolio_url },
  ].filter((l): l is { label: string; href: string } => Boolean(l));

  return (
    <>
      <header className="grid gap-space-1">
        <h1 className="m-0 font-display text-h1 font-normal">{c.full_name}</h1>
        <p className="m-0 text-text-secondary">{meta}</p>
        {c.is_featured && (
          <p className="m-0 font-display tracking-[0.06em]">
            <span aria-hidden="true">★ </span>FEATURED
          </p>
        )}
        {c.tagline && <p className="m-0">{c.tagline}</p>}
      </header>

      <div className="member-layout">
        <section className="member-badges" aria-label="Badge">
          {wide ? (
            <div className="member-faces">
              <BadgeStage label="Front">
                <MemberCard card={card} flipped={false} focusable onShowQr={() => setShowQr(true)} />
              </BadgeStage>
              <BadgeStage label="Quest Log">
                <MemberCard card={card} flipped focusable onShowQr={() => setShowQr(true)} />
              </BadgeStage>
            </div>
          ) : (
            <FlipBadge card={card} onShowQr={() => setShowQr(true)} />
          )}
          <button type="button" className="pixel-btn justify-self-center" data-variant="primary" onClick={() => setShowQr(true)}>
            SCAN ME · show QR
          </button>
          <p className="m-0 text-center font-mono text-caption">{serialFor(card.no, c.username)}</p>
        </section>

        <div className="grid content-start gap-space-4">
          <Panel label="About">
            <h2 className="m-0 font-display text-h3 font-normal">About</h2>
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
          </Panel>

          <Panel label="Quest Log">
            <h2 className="m-0 font-display text-h3 font-normal">
              Quest Log <span className="text-text-secondary">· {c.projects.length}</span>
            </h2>
            {c.projects.length === 0 ? (
              <DialogueBox text={`${c.full_name} hasn’t added any quests yet.`} />
            ) : (
              <ol className="quest-list">
                {c.projects.map((p, i) => (
                  <Quest key={`${p.title}-${i}`} project={p} n={i + 1} />
                ))}
              </ol>
            )}
          </Panel>
        </div>
      </div>
      {showQr && <QrFullscreen card={card} onClose={() => setShowQr(false)} />}
    </>
  );
}

function Quest({ project: p, n }: { project: PublicProject; n: number }) {
  const cover = publicImageUrl('project-covers', p.cover_path);
  const facts = [p.language, p.stars ? `★ ${p.stars}` : null, p.project_date?.slice(0, 7)].filter(Boolean).join(' · ');
  return (
    <li className="quest-item">
      {cover && <img src={cover} alt="" className="quest-cover" loading="lazy" width={160} height={90} />}
      <div className="grid gap-space-1">
        <h3 className="m-0 text-body font-bold">
          <span className="font-mono text-text-secondary" aria-hidden="true">
            {String(n).padStart(2, '0')}{' '}
          </span>
          {p.title}
        </h3>
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
