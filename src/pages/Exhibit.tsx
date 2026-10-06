// /museum/:id — one exhibit on its own page (D-073): the framed project as approved, its plaque,
// its links, its maker, a Share button, and the neighbouring exhibits. Shareable like a badge.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { FlipBadge } from '../components/cards/BadgeStage';
import { QrFullscreen } from '../components/cards/QrFullscreen';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { ExhibitArt } from '../components/museum/ExhibitArt';
import { MenuPage } from '../components/shell/MenuPage';
import { creditLine, makersOf } from '../lib/collab';
import { exhibitPath, exhibitUrl, memberPath } from '../lib/publicUrl';
import { consoleFor } from '../lib/museum';
import { CONSOLE_NAMES } from '../lib/sprites';
import { useCards } from '../lib/useCards';
import { usePassport } from '../lib/usePassport';
import type { PublicCard } from '../types/card';
import { museumService } from '../services/museumService';
import type { Exhibit as ExhibitRow } from '../types/museum';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; exhibits: ExhibitRow[] };

export default function Exhibit() {
  const { id = '' } = useParams();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [shared, setShared] = useState<string | null>(null);
  const [qrCard, setQrCard] = useState<PublicCard | null>(null);
  const cards = useCards();

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

  // A stable walking order (by title), so Previous and Next always lead to the same rooms.
  const ordered = useMemo(() => (load.status === 'ready' ? [...load.exhibits].sort((a, b) => a.project.title.localeCompare(b.project.title)) : []), [load]);
  const at = ordered.findIndex((e) => e.project_id === id);
  const exhibit = at >= 0 ? ordered[at] : undefined;
  const prev = ordered.length > 1 && at >= 0 ? ordered[(at - 1 + ordered.length) % ordered.length] : undefined;
  const next = ordered.length > 1 && at >= 0 ? ordered[(at + 1) % ordered.length] : undefined;

  const title = exhibit ? `${exhibit.project.title} · Museum` : load.status === 'ready' ? 'Not on show' : 'Museum';
  // The owner, then the collaborators who accepted, as approved (D-090).
  // Visiting an exhibit stamps the Passport (V2-2).
  const { stampExhibit } = usePassport();
  const exhibitId = exhibit?.project_id;
  useEffect(() => {
    if (exhibitId) stampExhibit(exhibitId);
  }, [exhibitId, stampExhibit]);
  const makers = exhibit && cards.status === 'ready' ? makersOf(exhibit.username, exhibit.project, cards.cards) : [];
  const withNames = (exhibit?.project.collaborators ?? []).map((c) => c.full_name);
  const kind = exhibit ? consoleFor(exhibit.project_id, exhibit.console) : null;

  const share = async () => {
    if (!exhibit) return;
    const url = exhibitUrl(exhibit.project_id);
    try {
      if (navigator.share) {
        await navigator.share({ title: exhibit.project.title, text: `${exhibit.project.title} by ${exhibit.full_name}, in the PIP-Hall Museum`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShared('Link copied.');
    } catch {
      setShared(null); // cancelled, or the clipboard is blocked: nothing to say
    }
  };

  return (
    <MenuPage title={title} wide>
      <Link to="/museum" className="pixel-btn justify-self-start">
        <span aria-hidden="true">◀ </span>Museum
      </Link>

      {load.status === 'loading' && <DialogueBox text="Fetching the exhibit…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text="Can’t reach the Museum right now. Check your connection and try again." emote="attention">
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {load.status === 'ready' && !exhibit && (
        <DialogueBox text="This exhibit isn’t on show anymore. Its maker may have taken it down. The rest of the Museum is one step back." emote="attention">
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
            MUSEUM
          </Link>
        </DialogueBox>
      )}

      {exhibit && (
        <article className="exhibit-page" aria-labelledby="exhibit-maker">
          <ExhibitArt project={exhibit.project} console={kind!} featured={exhibit.featured} eager />
          <div className="exhibit-plaque">
            {exhibit.project.description && <p className="m-0">{exhibit.project.description}</p>}
            <Facts exhibit={exhibit} />
            <p id="exhibit-maker" className="m-0">
              Made by{' '}
              <Link to={memberPath(exhibit.username)} className="underline decoration-2">
                {exhibit.full_name}
              </Link>
              {withNames.length > 0 && <> with {creditLine(withNames)}</>}{' '}
              <span className="text-text-secondary">· No.{String(exhibit.member_no).padStart(3, '0')}</span>
            </p>
            {kind && <p className="m-0 text-caption text-text-secondary">On show on a PIXENDO {CONSOLE_NAMES[kind]}</p>}
            <div className="flex flex-wrap gap-space-2">
              {exhibit.project.project_url && (
                <a href={exhibit.project.project_url} target="_blank" rel="noopener noreferrer" className="pixel-btn" data-variant="primary">
                  Open project<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              {exhibit.project.github_url && (
                <a href={exhibit.project.github_url} target="_blank" rel="noopener noreferrer" className="pixel-btn">
                  Code on GitHub<span className="sr-only"> (opens in a new tab)</span>
                </a>
              )}
              <button type="button" className="pixel-btn" onClick={() => void share()}>
                Share
              </button>
            </div>
            {shared && (
              <p className="notice m-0" role="status">
                {shared}
              </p>
            )}
          </div>
        </article>
      )}

      {exhibit && makers.length > 0 && (
        <section className="made-by" aria-labelledby="made-by-title">
          <h2 id="made-by-title" className="panel-title">
            Made by{makers.length > 1 ? ` · ${makers.length} makers` : ''}
          </h2>
          <ul className="made-by-list" aria-label="Makers">
            {makers.map((c) => (
              <li key={c.username}>
                <FlipBadge card={c} label={c.card.full_name} onShowQr={() => setQrCard(c)} />
                <Link to={memberPath(c.username)} className="pixel-btn justify-self-center">
                  Open profile<span className="sr-only"> of {c.card.full_name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {exhibit && prev && next && (
        <nav aria-label="More exhibits" className="flex flex-wrap justify-between gap-space-2">
          <Link to={exhibitPath(prev.project_id)} className="pixel-btn">
            <span aria-hidden="true">◀ </span>
            {prev.project.title}
          </Link>
          {next.project_id !== prev.project_id && (
            <Link to={exhibitPath(next.project_id)} className="pixel-btn">
              {next.project.title}
              <span aria-hidden="true"> ▶</span>
            </Link>
          )}
        </nav>
      )}
      {qrCard && <QrFullscreen card={qrCard} onClose={() => setQrCard(null)} />}
    </MenuPage>
  );
}

function Facts({ exhibit }: { exhibit: ExhibitRow }) {
  const p = exhibit.project;
  const rows: [string, string][] = [];
  if (p.language) rows.push(['Language', p.language]);
  if (p.tech_stack.length) rows.push(['Built with', p.tech_stack.join(' · ')]);
  if (p.stars) rows.push(['Stars', String(p.stars)]);
  if (p.project_date) rows.push(['Date', p.project_date]);
  if (!rows.length) return null;
  return (
    <dl className="exhibit-facts">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
