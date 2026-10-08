// The event banner under the top bar (V2-7, D-103): while an event is on, every page says so and
// leads to it in the hall; shortly before one, it says when. Hackathons and building events (V2-9,
// D-115) also count down to their deadline and results, and once results are announced the banner
// says so for a week and leads to the winners. Nothing shows when nothing is scheduled.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { eventRoomPath, KIND_NAME, kindOf, phaseLine, takesEntries } from '../../lib/events';
import { dateRange, NO_SEASON, type CurrentSeason } from '../../lib/seasons';
import { seasonService } from '../../services/seasonService';

export function SeasonBanner() {
  const [season, setSeason] = useState<CurrentSeason>(NO_SEASON);
  // The countdown moves on once a minute: words only, nothing animates.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let on = true;
    seasonService
      .current()
      .then((s) => on && setSeason(s))
      .catch(() => undefined); // a banner is news, never a blocker
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      on = false;
      window.clearInterval(tick);
    };
  }, []);

  const results = !season.live && season.results ? season.results : null;
  const s = season.live ?? results ?? season.next;
  if (!s) return null;
  const live = Boolean(season.live);
  const entries = takesEntries(s);
  const status = results ? 'Results are in!' : phaseLine(s, now);
  const kind = kindOf(s) !== 'event' ? `${KIND_NAME[kindOf(s)]}: ` : '';
  const go =
    results || (live && s.phase === 'results')
      ? { to: eventRoomPath(s.key), label: 'See the winners' }
      : live && entries && s.phase !== 'open'
        ? { to: eventRoomPath(s.key), label: 'See the entries' }
        : live
          ? { to: '/#event', label: 'See the event' }
          : null;
  return (
    <aside className="season-banner" data-live={live || Boolean(results) || undefined} aria-label="Event">
      <span className="season-flag" aria-hidden="true">
        {results || s.phase === 'results' ? '♛' : live ? '★' : '◇'}
      </span>
      <span>
        <b>{live || results ? `${kind}${s.name}` : `Coming up: ${kind}${s.name}`}</b> <span className="season-dates">· {dateRange(s.starts_on, s.ends_on)}</span>
        {status && <span className="season-status"> · {status}</span>}
        {s.blurb && !results && <span className="season-blurb"> · {s.blurb}</span>}
      </span>
      {go && (
        <Link to={go.to} className="pixel-btn season-go">
          {go.label}
        </Link>
      )}
    </aside>
  );
}
