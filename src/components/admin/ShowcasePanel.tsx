// Admin → Events → Showcase (V2-12, D-109, D-120, D-127): what an admin needs to run the showcase
// at an event. The kiosk's link carries the event's check-in code (made the first time this opens),
// so the screen at the event can check scanners in while the event is on. Renewing the code stops
// links handed out before. Placards and the winners poster are on the print page.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { takesEntries } from '../../lib/events';
import { publicOrigin } from '../../lib/publicUrl';
import { boothPath, printPath } from '../../lib/showcase';
import type { AdminSeason } from '../../services/seasonService';
import { showcaseService } from '../../services/showcaseService';

export function ShowcasePanel({ event }: { event: AdminSeason }) {
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let on = true;
    showcaseService
      .code(event.key)
      .then((c) => on && setCode(c))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [event.key, attempt]);

  const kiosk = code ? `${publicOrigin()}${boothPath(event.key, code)}` : null;
  const renew = async () => {
    setBusy(true);
    setNotice(null);
    try {
      setCode(await showcaseService.code(event.key, true));
      setAsking(false);
      setNotice('New code made. Kiosk links from before no longer check anyone in: open the new one on the screen.');
    } catch {
      setNotice('Couldn’t renew the code. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!kiosk) return;
    try {
      await navigator.clipboard.writeText(kiosk);
      setNotice('Kiosk link copied.');
    } catch {
      setNotice('Couldn’t copy: select the link and copy it.');
    }
  };

  return (
    <section className="menu-panel grid gap-space-3" aria-labelledby="showcase-title">
      <h3 id="showcase-title" className="panel-title">
        Showcase · {event.name}
      </h3>
      <p className="m-0 field-hint">
        Open the kiosk on the laptop, TV or projector at the event. It tours the Museum by itself and shows the hall; while {event.name} is on, its check-in QR gives each scanner a Passport stamp
        (once each, no PIPs), counted in the event’s numbers. Nobody signs in on the kiosk.
      </p>
      {failed && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>Can’t get the check-in code. If the showcase update hasn’t been run yet, see the deploy guide.{' '}
          <button
            type="button"
            className="pixel-btn"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
          >
            Retry
          </button>
        </p>
      )}
      {kiosk && (
        <>
          <div className="field">
            <label htmlFor="showcase-kiosk" className="field-label">
              Kiosk link
            </label>
            <input id="showcase-kiosk" className="pixel-input font-mono" readOnly value={kiosk} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="flex flex-wrap gap-space-2">
            <a href={boothPath(event.key, code)} target="_blank" rel="noopener" className="pixel-btn" data-variant="primary">
              Open the kiosk<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <button type="button" className="pixel-btn" onClick={() => void copy()}>
              Copy link
            </button>
            {!asking ? (
              <button type="button" className="pixel-btn" onClick={() => setAsking(true)}>
                Renew code
              </button>
            ) : (
              <span className="flex flex-wrap items-center gap-space-2">
                <span>Links handed out before will stop working.</span>
                <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void renew()}>
                  Renew
                </button>
                <button type="button" className="pixel-btn" onClick={() => setAsking(false)}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        </>
      )}
      <p className="m-0">
        <Link to={takesEntries(event) ? printPath({ kind: 'event', key: event.key }) : '/print'} className="underline decoration-2">
          Placards to print{takesEntries(event) ? ` for ${event.name}’s room` : ''}
        </Link>
        <span className="text-text-secondary">
          {' '}
          · A6, four to a page{takesEntries(event) ? ', and the winners poster once the results are announced' : ''}.
        </span>
      </p>
      {notice && (
        <p className="notice m-0" role="status">
          {notice}
        </p>
      )}
    </section>
  );
}
