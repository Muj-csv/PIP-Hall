// /checkin/:key?c=… — the showcase's check-in (V2-12, D-109, D-127). The kiosk at an event shows a
// QR with the event's check-in code; scanning it while the event is on gives a Passport stamp,
// "Visited the showcase at <event>". Guests keep it on their device; members with a card in the
// hall keep it in their account (the database checks the code again). Once per event, no PIPs.
// The code leaves the address as soon as it's read, so a screenshot or a forwarded link of this
// page doesn't carry it (and admins can renew it).

import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { stampDate } from '../lib/passport';
import { usePassport } from '../lib/usePassport';
import { checkinError, showcaseService } from '../services/showcaseService';

type State =
  | { s: 'loading' }
  | { s: 'error' }
  | { s: 'none' }
  | { s: 'stamped'; name: string; fresh: boolean }
  | { s: 'not-live'; name: string }
  | { s: 'bad-code'; name: string; missing?: boolean };

export default function CheckIn() {
  const { key = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const [code] = useState(() => params.get('c')?.trim() ?? '');
  useEffect(() => {
    if (!params.has('c')) return;
    const next = new URLSearchParams(params);
    next.delete('c');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const passport = usePassport();
  const { checkIn, ready, mode } = passport;
  const [state, setState] = useState<State>({ s: 'loading' });
  const [attempt, setAttempt] = useState(0);
  // Once per attempt, even when React runs effects twice in development: a second call would say
  // "already stamped" over the first one's "stamped".
  const started = useRef<number | null>(null);

  useEffect(() => {
    if (!ready || started.current === attempt) return;
    started.current = attempt;
    void (async () => {
      try {
        const ev = await showcaseService.event(key, code);
        if (!ev) return setState({ s: 'none' });
        const had = passport.data.checkins.some((s) => s.id === key);
        if (ev.ok) return setState({ s: 'stamped', name: ev.name, fresh: await checkIn(key, ev.name, code) });
        if (had) return setState({ s: 'stamped', name: ev.name, fresh: false });
        setState(ev.live ? { s: 'bad-code', name: ev.name, missing: !code } : { s: 'not-live', name: ev.name });
      } catch (e) {
        const why = checkinError(e);
        // The event ended or the code was renewed between reading it and stamping.
        setState(why === 'NOT_LIVE' ? { s: 'not-live', name: '' } : why === 'BAD_CODE' ? { s: 'bad-code', name: '' } : { s: 'error' });
      }
    })();
    // The Passport's stamps are read once, when the check-in starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, attempt, key, code, checkIn]);

  const stampOf = passport.data.checkins.find((s) => s.id === key);
  const guest = mode === 'device';
  const at = (name: string) => (name ? `the showcase at ${name}` : 'this showcase');

  return (
    <MenuPage title="Check in">
      {state.s === 'loading' && <DialogueBox text="Checking you in…" emote="pending" />}
      {state.s === 'error' && (
        <DialogueBox text="Can’t reach the hall right now. Check your connection and try again." emote="attention">
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setState({ s: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {state.s === 'none' && (
        <DialogueBox text="There’s no event with this check-in. The hall is still open: come and meet everyone." emote="attention">
          <Link to="/" className="hw-btn no-underline" data-variant="small">
            HALL
          </Link>
        </DialogueBox>
      )}
      {state.s === 'not-live' && (
        <DialogueBox text={`Stamps for ${at(state.name)} are given while it’s on, and it isn’t right now. The Museum is open any time.`} emote="attention">
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
            MUSEUM
          </Link>
        </DialogueBox>
      )}
      {state.s === 'bad-code' && (
        <DialogueBox
          text={state.missing ? `Scan the check-in QR on the screen at ${at(state.name)} to get your stamp.` : `This check-in link for ${at(state.name)} has expired. Scan the QR on the showcase screen again to get your stamp.`}
          emote="attention"
        >
          <Link to="/museum" className="hw-btn no-underline" data-variant="small">
            MUSEUM
          </Link>
        </DialogueBox>
      )}

      {state.s === 'stamped' && (
        <>
          <div className="checkin-stamp" data-fresh={state.fresh || undefined} role="img" aria-label={`Passport stamp: visited the showcase at ${state.name}`}>
            <span className="checkin-stamp-kicker">SHOWCASE</span>
            <span className="checkin-stamp-name">{state.name}</span>
            {stampOf && <span className="checkin-stamp-date">{stampDate(stampOf.at)}</span>}
          </div>
          <DialogueBox
            text={
              state.fresh
                ? `Stamped! Visited the showcase at ${state.name}. ${guest ? 'It’s saved in the Passport on this device.' : 'It’s in your Passport.'}`
                : `You already have this stamp: visited the showcase at ${state.name}.`
            }
            emote="approved"
          />
          <nav className="flex flex-wrap gap-space-2" aria-label="What next">
            <Link to="/passport" className="pixel-btn" data-variant="primary">
              Open your Passport
            </Link>
            <Link to="/museum" className="pixel-btn">
              Walk the Museum
            </Link>
            {guest && (
              <Link to="/edit" className="pixel-btn">
                Make your card
              </Link>
            )}
          </nav>
          {guest && <p className="m-0 field-hint">With a card in the hall, your Passport is kept in your account and follows you to any device.</p>}
        </>
      )}
    </MenuPage>
  );
}
