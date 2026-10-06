// The bell in the top bar (V2-4, D-100): things that happened to you, from hall_events. Someone
// tagged you, accepted your tag or credited you; your card was approved or needs changes; you
// unlocked an achievement or were featured. Each line goes where you can act on it. Opening the
// bell marks everything as seen. Email stays "not yet justified".

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { ago, notificationLine, ownUsername, unread, type MyNotifications } from '../../lib/notifications';
import { CARD_PALETTE, SPR } from '../../lib/sprites';
import { notificationService } from '../../services/notificationService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

const REFRESH_MS = 60_000;

export const bellAvailable = import.meta.env.VITE_DATA_SOURCE === 'supabase';

export function NotificationBell() {
  const { session } = useSession();
  const me = session.status === 'signed-in' ? session.user.id : null;
  const { pathname } = useLocation();
  const [data, setData] = useState<MyNotifications | null>(null);
  const [failed, setFailed] = useState(false);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  /** The marker as it was when the bell opened, so this visit's new lines stay marked NEW. */
  const [before, setBefore] = useState<string | null>(null);
  const loadedAt = useRef(0);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const load = useCallback(
    (force = false) => {
      if (!me || (!force && Date.now() - loadedAt.current < REFRESH_MS)) return;
      loadedAt.current = Date.now();
      notificationService
        .mine()
        .then((d) => {
          setData(d);
          setFailed(false);
        })
        .catch((e: { code?: string; message?: string }) => {
          // Before the V2-4 database update there is no bell yet.
          if (e?.code === 'PGRST202' || /my_notifications/.test(e?.message ?? '')) setMissing(true);
          else setFailed(true);
        });
    },
    [me],
  );

  // On sign-in, on each page, and when the tab comes back; at most once a minute.
  useEffect(() => {
    if (!me) return;
    load();
  }, [me, pathname, load]);
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [load]);

  const close = useCallback((focus: boolean) => {
    setOpen(false);
    if (focus) button.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(true);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) close(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  // Close when the page changes (a line was followed).
  const [where, setWhere] = useState(pathname);
  if (where !== pathname) {
    setWhere(pathname);
    if (open) setOpen(false);
  }

  if (!me || missing) return null;
  const count = unread(data);

  const toggle = () => {
    if (open) return close(false);
    setBefore(data?.seenAt ?? null);
    setOpen(true);
    if (!data) load(true);
    if (count > 0) {
      notificationService
        .markSeen()
        .then((at) => setData((d) => (d ? { ...d, seenAt: at } : d)))
        .catch(() => undefined); // they stay new until next time
    }
  };

  const mine = data ? ownUsername(data.items) : null;
  const lines = (data?.items ?? []).flatMap((n) => {
    const line = notificationLine(n, mine);
    return line ? [{ n, line, fresh: Date.parse(n.at) > (before ? Date.parse(before) : -Infinity) }] : [];
  });

  return (
    <div className="bell">
      <button ref={button} type="button" className="pixel-btn nav-btn bell-btn" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
        <SpriteCanvas sprite={SPR.iconBell} palette={CARD_PALETTE} className="h-5 w-5" />
        <span className="sr-only">Notifications</span>
        {count > 0 && (
          <span className="bell-count">
            {count > 9 ? '9+' : count}
            <span className="sr-only"> new</span>
          </span>
        )}
      </button>
      {open && (
        <div ref={panel} id={panelId} className="menu-panel bell-panel" role="region" aria-label="Notifications">
          <h2 className="panel-title">Notifications</h2>
          {failed && !data ? (
            <DialogueBox text="Pip can’t reach the hall right now. Try again in a moment." emote="attention" />
          ) : !data ? (
            <p className="m-0 field-hint">Checking…</p>
          ) : lines.length === 0 ? (
            <DialogueBox text="Nothing yet. When someone tags you on a project or your card is reviewed, you’ll hear it here." />
          ) : (
            <ol className="bell-list">
              {lines.map(({ n, line, fresh }) => (
                <li key={n.id} data-fresh={fresh || undefined}>
                  <Link to={line.to} className="bell-item">
                    {fresh && <span className="bell-new">NEW</span>}
                    <span>{line.text}</span>
                    <time dateTime={n.at} className="text-caption text-text-secondary">
                      {ago(n.at)}
                    </time>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
