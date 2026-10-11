// The Journal's open spread (V2-24, D-137): the page in front swings forward and opens as a two-page
// spread. Left page: its cartridge in its console (Play → PRESS START, V2-23). Right page: its title,
// ribbons and makers, the making-of comic (or the description), the QR, and the way to its own page.
// A featured member opens to their badge and the curator's note. Opening an exhibit stamps the
// Passport, as its page does. A dialog: it takes focus, keeps Tab inside, and Esc or Close puts the
// exhibit back on the wall. Reduced motion: it simply appears.

import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { stopPath } from '../../lib/curation';
import { consoleFor } from '../../lib/museum';
import { awardLine, plaqueBy, plaqueOrigin } from '../../lib/museumWalk';
import { exhibitUrl, memberPath, memberQrUrl } from '../../lib/publicUrl';
import type { ShowcaseStop } from '../../lib/showcase';
import { usePassport } from '../../lib/usePassport';
import { QrCode } from '../cards/QrCode';
import { CartridgePlayer } from './CartridgePlayer';
import { MakingOfComic } from './MakingOfComic';
import { PortraitArt } from './PortraitArt';
import { Ribbon } from './Ribbon';

interface Props {
  stop: ShowcaseStop;
  /** Where it hangs: "Exhibit 3 of 12 · Winners' Hall". */
  kicker: string;
  reduce: boolean;
  /** Opening it stamps the visitor's Passport; the showcase kiosk is nobody's, so it doesn't. */
  stamp?: boolean;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function JournalSpread({ stop, kicker, reduce, stamp = true, onClose }: Props) {
  const e = stop.exhibit;
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const { stampExhibit } = usePassport();

  // Opening an exhibit is visiting it (V2-2): the Passport stamps it, as the exhibit's page does.
  useEffect(() => {
    if (stamp && !e.portrait) stampExhibit(e.project_id);
  }, [stamp, e.portrait, e.project_id, stampExhibit]);

  // The page behind stays put while the book is open; focus goes in, and comes back on close.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    document.documentElement.classList.add('spread-open');
    close.current?.focus({ preventScroll: true });
    return () => {
      document.documentElement.classList.remove('spread-open');
      before?.focus?.({ preventScroll: true });
    };
  }, []);

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.preventDefault();
      onClose();
      return;
    }
    if (ev.key !== 'Tab') return;
    const all = [...(box.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].filter((x) => x.offsetParent !== null);
    if (!all.length) return;
    const first = all[0]!;
    const last = all[all.length - 1]!;
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first.focus();
    }
  };

  const by = plaqueBy(e);
  const origin = plaqueOrigin(e);
  const place = stop.awards.map((a) => a.award.place).filter((p): p is 1 | 2 | 3 => p === 1 || p === 2 || p === 3).sort()[0] ?? null;

  return (
    <div className="spread-backdrop" onPointerDown={(ev) => ev.target === ev.currentTarget && onClose()}>
      <div ref={box} className="spread-book" role="dialog" aria-modal="true" aria-labelledby={titleId} data-still={reduce || undefined} onKeyDown={onKeyDown}>
        <div className="spread-page" data-page="left">
          {e.portrait ? (
            <div className="spread-portrait">
              <PortraitArt card={e.portrait.card} scale={0.75} />
            </div>
          ) : (
            <CartridgePlayer
              project={e.project}
              console={consoleFor(e.project_id, e.console)}
              featured={e.featured}
              memberNo={e.archive ? null : e.member_no}
              makers={e.archive ? [] : [e.full_name, ...(e.project.collaborators ?? []).map((c) => c.full_name)]}
            />
          )}
        </div>
        <i className="spread-spine" aria-hidden="true" />
        <div className="spread-page" data-page="right">
          <p className="spread-kicker m-0">{kicker}</p>
          <h2 id={titleId} className="spread-title m-0">
            {e.portrait ? e.full_name : e.project.title}
          </h2>
          {e.portrait ? (
            <>
              {e.portrait.card.card.role && <p className="m-0">{e.portrait.card.card.role}</p>}
              {e.portrait.note && (
                <q className="spread-note">
                  <span className="sr-only">Curator’s note: </span>
                  {e.portrait.note}
                </q>
              )}
            </>
          ) : (
            <>
              {stop.awards.map((a) => (
                <p key={awardLine(a)} className="award-plate m-0" data-place={a.award.place ?? 'award'}>
                  <Ribbon award={a.award} />
                  <span className="text-caption">{awardLine(a)}</span>
                </p>
              ))}
              {by &&
                (e.archive ? (
                  <p className="m-0">by {by}</p>
                ) : (
                  <p className="m-0">
                    by{' '}
                    <Link to={memberPath(e.username)} className="underline decoration-2">
                      {by}
                    </Link>
                  </p>
                ))}
              {origin && <p className="m-0 text-caption">▤ From the Archive · {origin}</p>}
              {e.project.story ? <MakingOfComic project={e.project} place={place} /> : e.project.description && <p className="m-0">{e.project.description}</p>}
            </>
          )}
          <div className="spread-foot">
            <div className="spread-qr">
              <QrCode value={e.portrait ? memberQrUrl(e.username) : exhibitUrl(e.project_id)} title={`QR code for ${e.portrait ? e.full_name : e.project.title}`} />
              <p className="m-0 text-caption">{e.portrait ? 'Scan to meet them.' : 'Scan to take it with you.'}</p>
            </div>
            <div className="spread-actions">
              <Link to={stopPath(e)} className="pixel-btn" data-variant="primary">
                {e.portrait ? 'Open profile' : 'Visit the exhibit'}
                <span className="sr-only"> {e.portrait ? `of ${e.full_name}` : e.project.title}</span>
              </Link>
              <button ref={close} type="button" className="pixel-btn" onClick={onClose}>
                Close<span className="sr-only"> the page</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
