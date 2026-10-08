// The Passport inside the PIXENDO screen (V2-2, D-097, D-098): who you've met, the skills they
// showed you, the team projects whose makers you've all met, the Museum stamp book (every exhibit
// you've opened, from members, event rooms and the archive) and the showcases you checked in at
// (V2-12, D-109).
// Progress reads as pages filling with stamps, not as statistics. Every stamp links back into the
// hall, so the Passport is also a way around it.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { passportPages, stampDate } from '../../lib/passport';
import { exhibitPath, memberPath } from '../../lib/publicUrl';
import { usePassport } from '../../lib/usePassport';
import { archiveAsExhibit } from '../../lib/archive';
import { archiveService } from '../../services/archiveService';
import { eventService } from '../../services/eventService';
import { museumService } from '../../services/museumService';
import type { PublicCard } from '../../types/card';
import type { Exhibit } from '../../types/museum';
import { PixelAvatar } from '../cards/PixelAvatar';
import { DialogueBox } from '../dialogue/DialogueBox';

interface Props {
  hall: readonly PublicCard[];
  onBack: () => void;
}

function Progress({ have, total, label }: { have: number; total: number | null; label: string }) {
  const pct = total ? Math.round((have / total) * 100) : 0;
  return (
    <div className="passport-progress">
      <span className="font-display tracking-[0.04em]">
        {have}
        {total !== null && ` / ${total}`}
      </span>
      {total !== null && total > 0 && (
        <div className="passport-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={total} aria-valuenow={have}>
          <div style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function PassportScreen({ hall, onBack }: Props) {
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => back.current?.focus(), []);
  const { session } = useSession();
  const me = session.status === 'signed-in' ? session.user.id : null;
  const passport = usePassport();
  const [exhibits, setExhibits] = useState<Exhibit[] | null>(null);
  const [museumFailed, setMuseumFailed] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    // The whole Museum: members' exhibits, event entries and the archive (the extras may fail alone).
    Promise.all([museumService.exhibits(), eventService.museumEvents().catch(() => []), archiveService.list().catch(() => [])])
      .then(([shown, events, past]) => {
        if (!on) return;
        const seen = new Set(shown.map((e) => e.project_id));
        const entered = events.flatMap((ev) => ev.entries).filter((e) => !seen.has(e.project_id) && (seen.add(e.project_id), true));
        setExhibits([...shown, ...entered, ...past.filter((a) => !seen.has(a.id)).map(archiveAsExhibit)]);
      })
      .catch(() => on && setMuseumFailed(true));
    return () => {
      on = false;
    };
  }, []);

  const pages = useMemo(() => passportPages(passport.data, hall, exhibits, me), [passport.data, hall, exhibits, me]);
  const extra = passport.importable.people.length + passport.importable.exhibits.length + passport.importable.checkins.length;
  const showcases = passport.data.checkins;
  const empty = pages.people.length === 0 && pages.exhibits.length === 0 && showcases.length === 0;
  const left = pages.peopleTotal - pages.people.length;

  const bringOver = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const n = await passport.importDevice();
      setNotice({ text: n ? `Added ${n} ${n === 1 ? 'stamp' : 'stamps'} from this device to your Passport, as history.` : 'Your account already had those stamps.' });
    } catch {
      setNotice({ text: 'Couldn’t bring the stamps over. Try again.', bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="menu-screen passport-screen" aria-labelledby="passport-title">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK<span className="sr-only"> to the hall</span>
      </button>
      <header className="grid gap-space-1">
        <h2 id="passport-title">PASSPORT</h2>
        <p className="meta m-0">
          {passport.mode === 'account' ? 'Saved to your account.' : 'Saved on this device.'}{' '}
          {passport.mode === 'device' && (
            <Link to="/edit" className="underline decoration-2">
              Make your card to keep it everywhere
            </Link>
          )}
        </p>
      </header>

      {passport.mode === 'account' && extra > 0 && (
        <div className="menu-panel grid gap-space-2">
          <p className="m-0">
            This device has {extra} {extra === 1 ? 'stamp' : 'stamps'} your account doesn’t. Bring them over as history (they don’t earn PIPs).
          </p>
          <button type="button" className="pixel-btn justify-self-start" data-variant="primary" disabled={busy} onClick={() => void bringOver()}>
            Bring them over
          </button>
        </div>
      )}
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}

      {!passport.ready ? (
        <DialogueBox text="Opening your Passport…" emote="pending" />
      ) : (
        empty && <DialogueBox text="Your Passport is empty. Open someone’s profile in the hall to get your first stamp." />
      )}

      <section className="menu-panel" aria-labelledby="pp-people">
        <h3 id="pp-people" className="panel-title">
          People
        </h3>
        <Progress have={pages.people.length} total={pages.peopleTotal} label="People found" />
        {pages.people.length > 0 && (
          <ul className="stamp-grid" aria-label="People you found">
            {pages.people.map(({ card, stamp }) => (
              <li key={card.profile_id} className="stamp">
                <Link to={memberPath(card.username)} className="stamp-link">
                  <span className="stamp-photo">
                    <PixelAvatar username={card.username} name={card.card.full_name} avatarPath={card.card.avatar_path} />
                  </span>
                  <b>{card.card.full_name}</b>
                  <span className="font-mono text-caption">No.{String(card.member_no).padStart(3, '0')}</span>
                  {(card.card.skills ?? []).length > 0 && <span className="text-caption">{(card.card.skills ?? []).slice(0, 3).join(' · ')}</span>}
                  <span className="text-caption text-text-secondary">
                    {stamp.imported ? 'From this device · ' : 'Found '}
                    {stampDate(stamp.at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 field-hint">
          {left > 0 ? `${left} more to find. Search the hall, or try Random player.` : pages.peopleTotal > 0 ? 'You’ve met everyone in the hall!' : 'Nobody is in the hall yet.'}
        </p>
      </section>

      <section className="menu-panel" aria-labelledby="pp-skills">
        <h3 id="pp-skills" className="panel-title">
          Skills seen
        </h3>
        <Progress have={pages.skills.length} total={pages.skillsTotal} label="Skills seen" />
        {pages.skills.length > 0 ? (
          <ul className="skill-stamps" aria-label="Skills you’ve seen">
            {pages.skills.map((s) => (
              <li key={s.name}>
                <span aria-hidden="true">★ </span>
                {s.name}
                <span className="sr-only">, from {s.from.card.full_name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 field-hint">Each person you meet adds the skills on their card.</p>
        )}
      </section>

      <section className="menu-panel" aria-labelledby="pp-collabs">
        <h3 id="pp-collabs" className="panel-title">
          Collaborations found
        </h3>
        <Progress have={pages.collaborations.length} total={pages.collaborationsTotal} label="Collaborations found" />
        {pages.collaborations.length > 0 && (
          <ul className="grid gap-space-2 m-0 p-0 list-none" aria-label="Team projects you’ve found">
            {pages.collaborations.map((t) => (
              <li key={`${t.owner.username}-${t.project.title}`}>
                <b>{t.project.title}</b>{' '}
                <span className="text-text-secondary">by {t.makers.map((m) => m.card.full_name).join(', ')}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 field-hint">
          {pages.collaborationsTotal === 0 ? 'No team projects in the hall yet.' : 'Meet every maker of a team project to find it.'}
        </p>
      </section>

      <section className="menu-panel" aria-labelledby="pp-exhibits">
        <h3 id="pp-exhibits" className="panel-title">
          Museum stamp book
        </h3>
        <Progress have={pages.exhibits.length} total={pages.exhibitsTotal} label="Museum stamps" />
        {pages.exhibits.length > 0 && (
          <ul className="grid gap-space-2 m-0 p-0 list-none" aria-label="Exhibits you’ve visited">
            {pages.exhibits.map(({ exhibit, stamp }) => (
              <li key={exhibit.project_id}>
                <Link to={exhibitPath(exhibit.project_id)} className="underline decoration-2">
                  {exhibit.project.title}
                </Link>{' '}
                <span className="text-caption text-text-secondary">
                  {exhibit.archive ? 'From the Archive' : `by ${exhibit.full_name}`} · {stamp.imported ? 'From this device · ' : ''}
                  {stampDate(stamp.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 field-hint">
          {museumFailed
            ? 'Can’t reach the Museum right now.'
            : exhibits === null
              ? 'Loading the Museum…'
              : pages.exhibitsTotal === 0
                ? 'No exhibits on show yet.'
                : 'Open an exhibit in the Museum, or scan a placard beside a demo, to stamp it.'}
        </p>
      </section>

      <section className="menu-panel" aria-labelledby="pp-showcases">
        <h3 id="pp-showcases" className="panel-title">
          Showcases
        </h3>
        {showcases.length > 0 ? (
          <ul className="showcase-stamps" aria-label="Showcases you checked in at">
            {showcases.map((s) => (
              <li key={s.id}>
                <span className="showcase-stamp-mark" aria-hidden="true">
                  ◆
                </span>
                <span>
                  Visited the showcase at <b>{s.name}</b>
                  <span className="block text-caption text-text-secondary">
                    {s.imported ? 'From this device · ' : ''}
                    {stampDate(s.at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 field-hint">At a hall event, scan the check-in QR on the showcase screen for a stamp.</p>
        )}
      </section>
    </section>
  );
}
