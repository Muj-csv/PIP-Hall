// "Recent in the hall" (V2-4, D-100): the last few public things that really happened. Someone
// joined, added a project, put an exhibit in the Museum, was credited on a team project, unlocked
// an achievement, was featured, entered an event, or an event's results came in (V2-9). Never discoveries (D-063), never counts or rankings (rule 5).
// Every line goes to the member or exhibit, so the strip is another way into the hall.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ago, recentLine, type RecentEvent } from '../../lib/notifications';
import { notificationService } from '../../services/notificationService';
import { DialogueBox } from '../dialogue/DialogueBox';

const MARK: Record<RecentEvent['type'], string> = {
  CARD_APPROVED: '+',
  PROJECT_PUBLISHED: '◆',
  EXHIBIT_ADDED: '▣',
  COLLAB_PUBLISHED: '⇄',
  ACHIEVEMENT_UNLOCKED: '★',
  MEMBER_FEATURED: '✦',
  EVENT_SUBMITTED: '⚑',
  RESULTS_ANNOUNCED: '♛',
};

/** Only where the hall has its backend: fixture halls have no events, and none are invented. */
export const recentAvailable = import.meta.env.VITE_DATA_SOURCE === 'supabase';

export function RecentStrip() {
  const [events, setEvents] = useState<RecentEvent[] | null>(null);
  const [state, setState] = useState<'ok' | 'failed' | 'missing'>('ok');

  useEffect(() => {
    let on = true;
    notificationService
      .recent(8)
      .then((e) => on && setEvents(e))
      .catch((e: unknown) => {
        if (!on) return;
        const err = e as { message?: string; code?: string };
        // Before the V2-4 database update the function doesn't exist: no strip rather than an error.
        setState(err?.code === 'PGRST202' || /recent_hall_events/.test(err?.message ?? '') ? 'missing' : 'failed');
      });
    return () => {
      on = false;
    };
  }, []);

  if (state === 'missing') return null;
  const lines = (events ?? []).flatMap((e) => {
    const line = recentLine(e);
    return line ? [{ e, line }] : [];
  });

  return (
    <section className="menu-panel recent-panel" aria-labelledby="recent-title">
      <h2 id="recent-title" className="panel-title">
        Recent in the hall
      </h2>
      {state === 'failed' ? (
        <DialogueBox text="Pip can’t hear the hall right now. The news will be back soon." emote="attention" />
      ) : events === null ? (
        <p className="m-0 field-hint">Listening for news…</p>
      ) : lines.length === 0 ? (
        <DialogueBox text="Nothing new yet. When someone joins, adds a project or teams up, you’ll see it here." />
      ) : (
        <ol className="recent-list">
          {lines.map(({ e, line }) => (
            <li key={e.id}>
              <Link to={line.to}>
                <span className="recent-mark" aria-hidden="true">
                  {MARK[e.type]}
                </span>
                <span>{line.text}</span>
                <time dateTime={e.at} className="text-caption text-text-secondary">
                  {ago(e.at)}
                </time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
