// The event banner under the top bar (V2-7, D-103): while an event is on, every page says so and
// leads to it in the hall; shortly before one, it says when. Nothing shows when nothing is scheduled.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { dateRange, NO_SEASON, type CurrentSeason } from '../../lib/seasons';
import { seasonService } from '../../services/seasonService';

export function SeasonBanner() {
  const [season, setSeason] = useState<CurrentSeason>(NO_SEASON);
  useEffect(() => {
    let on = true;
    seasonService
      .current()
      .then((s) => on && setSeason(s))
      .catch(() => undefined); // a banner is news, never a blocker
    return () => {
      on = false;
    };
  }, []);

  const s = season.live ?? season.next;
  if (!s) return null;
  const live = Boolean(season.live);
  return (
    <aside className="season-banner" data-live={live || undefined} aria-label="Event">
      <span className="season-flag" aria-hidden="true">
        {live ? '★' : '◇'}
      </span>
      <span>
        <b>{live ? s.name : `Coming up: ${s.name}`}</b> <span className="season-dates">· {dateRange(s.starts_on, s.ends_on)}</span>
        {s.blurb && <span className="season-blurb"> · {s.blurb}</span>}
      </span>
      {live && (
        <Link to="/#event" className="pixel-btn season-go">
          See the event
        </Link>
      )}
    </aside>
  );
}
