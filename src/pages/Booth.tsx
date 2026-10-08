// /booth — the showcase kiosk (V2-12, D-109, D-120), for a laptop, TV or projector at an event.
// An admin opens it from Admin → Events (/booth?event=key&c=code); without an event it tours the
// whole Museum. Two modes: the Museum tour (exhibit to exhibit, about 12 seconds each: its plaque,
// what it won and a big QR that opens it on a phone) and the Hall (the hall's attract mode: one
// member's badge at a time, with their QR). A touch pauses it and shows the way around; after a
// minute untouched it goes back to its own mode and plays on. While the event is on, a second QR
// checks scanners in for a Passport stamp (D-127). No top bar and no sign-in: it's a public screen.

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useSearchParams } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { Lanyard } from '../components/cards/Lanyard';
import { MemberCard } from '../components/cards/MemberCard';
import { QrCode } from '../components/cards/QrCode';
import { ExhibitArt } from '../components/museum/ExhibitArt';
import { Ribbon } from '../components/museum/Ribbon';
import { SpriteCanvas } from '../components/pixel/SpriteCanvas';
import { consoleFor } from '../lib/museum';
import { awardLine, plaqueBy, plaqueOrigin } from '../lib/museumWalk';
import { hallUrl, memberQrUrl } from '../lib/publicUrl';
import { BOOTH, checkinUrl, placardUrl, tourStops, type ShowcaseStop } from '../lib/showcase';
import { SPR, WORLD_OVERRIDES, WORLD_PALETTE } from '../lib/sprites';
import { useCards } from '../lib/useCards';
import { useShowcaseRooms } from '../lib/useShowcaseRooms';
import { showcaseService, type CheckinEvent } from '../services/showcaseService';
import type { PublicCard } from '../types/card';

type Mode = 'tour' | 'hall';
const PIP = { ...WORLD_PALETTE, ...(WORLD_OVERRIDES.pipIdle ?? {}) };

export default function Booth() {
  const [params] = useSearchParams();
  const eventKey = params.get('event');
  const code = params.get('c')?.trim() ?? '';
  const asked: Mode = params.get('mode') === 'hall' ? 'hall' : 'tour';
  const [attempt, setAttempt] = useState(0);
  const load = useShowcaseRooms(attempt);
  const cards = useCards();
  const stops = useMemo(() => (load.status === 'ready' ? tourStops(load.rooms, eventKey) : []), [load, eventKey]);
  const people = useMemo(() => (cards.status === 'ready' ? [...cards.cards].sort((a, b) => a.no - b.no) : []), [cards]);
  // The kiosk's own mode; with nothing in the Museum yet, it shows the hall.
  const home: Mode = asked === 'tour' && load.status === 'ready' && stops.length === 0 ? 'hall' : asked;
  const [picked, setPicked] = useState<Mode | null>(null);
  const mode = picked ?? home;
  const [tourAt, setTourAt] = useState(0);
  const [hallAt, setHallAt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [touchedAt, setTouchedAt] = useState<number | null>(null);
  const [checkin, setCheckin] = useState<CheckinEvent | null>(null);
  const [full, setFull] = useState(false);

  useEffect(() => {
    document.title = 'Showcase · PIP-Hall';
  }, []);

  // The check-in QR, read again every few minutes: the event may end, or its code be renewed.
  useEffect(() => {
    if (!eventKey || !code) return;
    let on = true;
    const read = () =>
      showcaseService
        .event(eventKey, code)
        .then((e) => on && setCheckin(e))
        .catch(() => undefined); // keep the last answer through a dropped connection
    void read();
    const t = window.setInterval(read, BOOTH.checkinMs);
    return () => {
      on = false;
      window.clearInterval(t);
    };
  }, [eventKey, code]);

  // The show moves on by itself unless it's paused.
  const count = mode === 'tour' ? stops.length : people.length;
  const at = count ? (mode === 'tour' ? tourAt : hallAt) % count : 0;
  useEffect(() => {
    if (paused || count < 2) return;
    const t = window.setTimeout(() => (mode === 'tour' ? setTourAt(at + 1) : setHallAt(at + 1)), mode === 'tour' ? BOOTH.tourMs : BOOTH.hallMs);
    return () => window.clearTimeout(t);
  }, [paused, mode, count, at]);

  // A minute untouched: back to the kiosk's own mode, playing.
  useEffect(() => {
    if (touchedAt === null) return;
    const t = window.setTimeout(() => {
      setPaused(false);
      setPicked(null);
      setTouchedAt(null);
    }, BOOTH.idleMs);
    return () => window.clearTimeout(t);
  }, [touchedAt]);

  // The screen stays on while the kiosk is open (where the browser allows it).
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let on = true;
    const ask = () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock
        .request('screen')
        .then((l) => (on ? (lock = l) : void l.release()))
        .catch(() => undefined);
    };
    ask();
    document.addEventListener('visibilitychange', ask);
    return () => {
      on = false;
      document.removeEventListener('visibilitychange', ask);
      void lock?.release();
    };
  }, []);
  useEffect(() => {
    const sync = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const touch = useCallback(() => setTouchedAt(Date.now()), []);
  const step = (d: number) => {
    touch();
    setPaused(true);
    if (count) (mode === 'tour' ? setTourAt : setHallAt)((at + d + count) % count);
  };
  const show = (m: Mode) => {
    touch();
    setPicked(m);
  };
  // A touch anywhere but the controls pauses the show, so a visitor can read and scan.
  const onPointerDown = (e: PointerEvent) => {
    touch();
    if (!(e.target as HTMLElement).closest('.booth-controls')) setPaused(true);
  };
  const onKey = (e: KeyboardEvent) => {
    touch();
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      step(e.key === 'ArrowRight' ? 1 : -1);
    } else if (e.key === ' ' && !(e.target as HTMLElement).closest('button, a')) {
      e.preventDefault();
      setPaused((p) => !p);
    }
  };
  const fullscreen = () => {
    touch();
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };

  const eventName = checkin?.name ?? (load.status === 'ready' && eventKey ? load.events.find((e) => e.key === eventKey)?.name : undefined) ?? null;
  const stop = mode === 'tour' ? stops[at] : undefined;
  const person = mode === 'hall' ? people[at] : undefined;
  const settled = load.status !== 'loading' && cards.status !== 'loading';
  const nothing = settled && stops.length === 0 && people.length === 0;

  return (
    // The kiosk takes any touch or key as "someone is here".
    <main className="booth" data-mode={mode} data-paused={paused || undefined} aria-label="PIP-Hall showcase" onPointerDownCapture={onPointerDown} onKeyDown={onKey}>
      <header className="booth-head">
        <p className="booth-brand">
          PIP-HALL <span>{eventName ? `· ${eventName}` : '· MUSEUM'}</span>
        </p>
        <div className="booth-controls" role="group" aria-label="Showcase controls">
          <button type="button" className="pixel-btn" aria-pressed={mode === 'tour'} disabled={stops.length === 0} onClick={() => show('tour')}>
            Museum tour
          </button>
          <button type="button" className="pixel-btn" aria-pressed={mode === 'hall'} disabled={people.length === 0} onClick={() => show('hall')}>
            Hall
          </button>
          <button type="button" className="pixel-btn" disabled={count < 2} onClick={() => step(-1)}>
            <span aria-hidden="true">◀ </span>Back
          </button>
          <button
            type="button"
            className="pixel-btn"
            data-variant="primary"
            onClick={() => {
              touch();
              setPaused((p) => !p);
            }}
          >
            {paused ? '▶ Play' : '❚❚ Pause'}
          </button>
          <button type="button" className="pixel-btn" disabled={count < 2} onClick={() => step(1)}>
            Next<span aria-hidden="true"> ▶</span>
          </button>
          <button type="button" className="pixel-btn" onClick={fullscreen}>
            {full ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </header>

      {!settled && <DialogueBox text="Setting up the showcase…" emote="pending" />}
      {load.status === 'error' && cards.status !== 'ready' && (
        <DialogueBox text="Can’t reach the hall right now. Check the connection and try again." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={() => setAttempt((a) => a + 1)}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {nothing && <DialogueBox text="The hall and the Museum are waiting for their first members and exhibits. Members make their card at the hall, and it shows here once it’s approved." />}

      {stop && <TourSlide key={stop.exhibit.project_id} stop={stop} nth={at + 1} count={count} live={paused} />}
      {person && <HallSlide key={person.username} card={person} nth={at + 1} count={count} live={paused} />}

      <footer className="booth-foot">
        <div className="booth-status">
          {count > 0 && (
            <>
              <Walk n={count} at={at} />
              <div className="booth-progress" key={`${mode}-${at}`} aria-hidden="true" style={{ ['--ms' as string]: `${mode === 'tour' ? BOOTH.tourMs : BOOTH.hallMs}ms` }}>
                <i />
              </div>
            </>
          )}
          <p className="booth-hint">{paused ? 'Paused. It plays on by itself after a minute.' : 'Touch the screen to pause.'}</p>
        </div>
        {checkin?.ok && eventKey ? (
          <aside className="booth-checkin" aria-labelledby="booth-checkin-title">
            <QrCode value={checkinUrl(eventKey, code)} title={`QR code to check in at ${checkin.name}`} />
            <div>
              <h2 id="booth-checkin-title">CHECK IN</h2>
              <p>Scan for a Passport stamp: visited the showcase at {checkin.name}.</p>
            </div>
          </aside>
        ) : (
          mode === 'hall' && (
            <aside className="booth-checkin" aria-labelledby="booth-join-title">
              <QrCode value={hallUrl()} title="QR code for PIP-Hall" />
              <div>
                <h2 id="booth-join-title">JOIN THE HALL</h2>
                <p>Scan to meet everyone, and make your own card.</p>
              </div>
            </aside>
          )
        )}
      </footer>
    </main>
  );
}

function TourSlide({ stop, nth, count, live }: { stop: ShowcaseStop; nth: number; count: number; live: boolean }) {
  const e = stop.exhibit;
  const by = plaqueBy(e);
  const origin = plaqueOrigin(e);
  const note = stop.awards.map((a) => a.award.note?.trim()).find(Boolean);
  return (
    <section className="booth-slide" aria-labelledby="booth-title" aria-live={live ? 'polite' : 'off'}>
      <div className="booth-art">
        <ExhibitArt project={e.project} console={consoleFor(e.project_id, e.console)} featured={e.featured} eager />
      </div>
      <div className="booth-plaque">
        <p className="booth-kicker">
          {stop.roomName} · {nth} of {count}
        </p>
        <h1 id="booth-title" className="booth-title">
          {e.project.title}
        </h1>
        {by && <p className="booth-by">by {by}</p>}
        {origin && <p className="booth-origin">{origin}</p>}
        {stop.awards.length > 0 && (
          <ul className="booth-awards" aria-label="Awards">
            {stop.awards.slice(0, 3).map((a) => (
              <li key={`${a.award.place ?? a.award.name}-${a.award.track ?? ''}-${a.event ?? ''}`}>
                <Ribbon award={a.award} className="booth-ribbon" />
                {awardLine(a)}
              </li>
            ))}
          </ul>
        )}
        {note && (
          <q className="booth-note">
            <span className="sr-only">Judges’ note: </span>
            {note}
          </q>
        )}
        {e.project.description && !note && <p className="booth-desc">{e.project.description}</p>}
        <div className="booth-qr">
          <QrCode value={placardUrl(e.project_id, stop.room)} title={`QR code for ${e.project.title}`} />
          <p>
            <b>SCAN TO VISIT</b>
            Open it on your phone and stamp your Passport.
          </p>
        </div>
      </div>
    </section>
  );
}

function HallSlide({ card, nth, count, live }: { card: PublicCard; nth: number; count: number; live: boolean }) {
  const c = card.card;
  return (
    <section className="booth-slide booth-hall" aria-labelledby="booth-title" aria-live={live ? 'polite' : 'off'}>
      <div className="booth-badge preview-stage" aria-hidden="true">
        <Lanyard />
        <div className="flipper">
          <MemberCard card={card} flipped={false} focusable={false} onShowQr={() => undefined} />
        </div>
      </div>
      <div className="booth-plaque">
        <p className="booth-kicker">
          In the hall · {nth} of {count}
        </p>
        <h1 id="booth-title" className="booth-title">
          {c.full_name}
        </h1>
        {c.role && <p className="booth-by">{c.role}</p>}
        {c.skills.length > 0 && <p className="booth-origin">{c.skills.slice(0, 5).join(' · ')}</p>}
        {c.projects.length > 0 && (
          <p className="booth-desc">
            {c.projects.length} {c.projects.length === 1 ? 'project' : 'projects'} in their Quest Log: {c.projects.slice(0, 3).map((p) => p.title).join(', ')}
          </p>
        )}
        <div className="booth-qr">
          <QrCode value={memberQrUrl(card.username)} title={`QR code for ${c.full_name}’s page`} />
          <p>
            <b>SCAN TO MEET</b>
            {c.full_name.split(' ')[0]} is in PIP-Hall.
          </p>
        </div>
      </div>
    </section>
  );
}

/** Pip walking the tour: one mark per stop, Pip at the current one (motion: where we are). */
function Walk({ n, at }: { n: number; at: number }) {
  const pct = n > 1 ? (at / (n - 1)) * 100 : 0;
  return (
    <div className="booth-walk" aria-hidden="true">
      {n <= 40 && Array.from({ length: n }, (_, k) => <i key={k} style={{ left: `${n > 1 ? (k / (n - 1)) * 100 : 0}%` }} data-past={k < at || undefined} />)}
      <span className="booth-pip" style={{ left: `${pct}%` }}>
        <SpriteCanvas sprite={SPR.pipIdle} palette={PIP} />
      </span>
    </div>
  );
}
