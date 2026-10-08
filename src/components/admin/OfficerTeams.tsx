// Admin → Affiliations → officers' teams (V2-10b, D-123): for each affiliation marked as an
// officers' team, the day its term ends and its officers, each with a position and an order (1 is
// shown first). Officers must have a card in the hall. Taking someone off the team removes the
// affiliation. The database checks everything again.

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Officer } from '../../lib/officers';
import { useCards } from '../../lib/useCards';
import { affiliationService } from '../../services/museumService';
import { officerErrorMessage, officerService } from '../../services/officerService';
import type { Affiliation } from '../../types/museum';
import { DialogueBox } from '../dialogue/DialogueBox';
import { SelectField, TextField } from '../editor/fields';

export function OfficerTeams({ teams, onDone }: { teams: Affiliation[]; onDone: (message: string) => void }) {
  const [officers, setOfficers] = useState<Officer[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const reload = useCallback(() => setRound((r) => r + 1), []);
  useEffect(() => {
    let on = true;
    officerService
      .hall()
      .then((o) => on && setOfficers(o))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [round]);

  if (teams.length === 0) return null;
  return (
    <section className="menu-panel grid gap-space-3" aria-labelledby="officer-teams">
      <h2 id="officer-teams" className="panel-title">
        Officers’ teams
      </h2>
      <p className="m-0 field-hint">
        Current officers wear an officer pin, open the hall’s Officers door and fill the Museum’s Officers’ Wing. When a term ends, its officers stay on their profiles as past officers.
      </p>
      {failed && <DialogueBox text="Can’t load the officers. If the officers update hasn’t been run yet, see the deploy guide." emote="attention" />}
      {officers &&
        teams.map((t) => (
          <Team
            key={t.key}
            team={t}
            officers={officers.filter((o) => o.team_key === t.key)}
            onDone={(m) => {
              onDone(m);
              reload();
            }}
          />
        ))}
    </section>
  );
}

function Team({ team, officers, onDone }: { team: Affiliation; officers: Officer[]; onDone: (message: string) => void }) {
  const cards = useCards();
  const [ends, setEnds] = useState(team.term_ends ?? '');
  const [member, setMember] = useState('');
  const [position, setPosition] = useState('');
  const [seat, setSeat] = useState(String(officers.length + 1));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const members = useMemo(
    () =>
      cards.status === 'ready'
        ? [...cards.cards]
            .filter((c) => !officers.some((o) => o.profile_id === c.profile_id))
            .sort((a, b) => a.card.full_name.localeCompare(b.card.full_name))
            .map((c) => ({ value: c.profile_id, label: `${c.card.full_name} (@${c.username})` }))
        : [],
    [cards, officers],
  );

  const run = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await what();
      onDone(done);
      return true;
    } catch (e) {
      setError(officerErrorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-space-2 officer-team" aria-labelledby={`team-${team.key}`}>
      <h3 id={`team-${team.key}`} className="m-0 font-display font-normal">
        » {team.name}
      </h3>
      <div className="flex flex-wrap items-end gap-space-2">
        <TextField field={`term-${team.key}`} label="Term ends (optional)" type="date" value={ends} onChange={setEnds} />
        <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => officerService.setTeam(team.key, true, ends || null), `${team.name}’s term is saved.`)}>
          Save term<span className="sr-only"> of {team.name}</span>
        </button>
      </div>
      {officers.length === 0 ? (
        <p className="m-0 field-hint">No officers named yet.</p>
      ) : (
        <ul className="mart-list" aria-label={`Officers of ${team.name}`}>
          {officers.map((o) => (
            <OfficerRow key={o.profile_id} team={team} officer={o} busy={busy} run={run} />
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-space-2"
        aria-label={`Add an officer to ${team.name}`}
        onSubmit={(e) => {
          e.preventDefault();
          const who = members.find((m) => m.value === member)?.label ?? 'They';
          void run(() => officerService.setOfficer(member, team.key, position.trim(), Number(seat)), `${who.replace(/ \(@.*\)$/, '')} is now ${position.trim() || 'an officer'} of ${team.name}.`).then((ok) => {
            if (!ok) return;
            setMember('');
            setPosition('');
            setSeat(String(officers.length + 2));
          });
        }}
      >
        <SelectField field={`add-officer-${team.key}`} label="Member" value={member} options={[{ value: '', label: 'Pick a member' }, ...members]} onChange={setMember} />
        <TextField field={`add-position-${team.key}`} label="Position" max={40} value={position} onChange={setPosition} placeholder="e.g. President" />
        <TextField field={`add-seat-${team.key}`} label="Order" type="number" value={seat} onChange={setSeat} />
        <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy || !member}>
          Add officer
        </button>
      </form>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </section>
  );
}

function OfficerRow({ team, officer: o, busy, run }: { team: Affiliation; officer: Officer; busy: boolean; run: (what: () => Promise<void>, done: string) => Promise<boolean> }) {
  const [position, setPosition] = useState(o.position ?? '');
  const [seat, setSeat] = useState(String(o.seat));
  return (
    <li className="flex flex-wrap items-end gap-space-2" role="group" aria-label={o.full_name}>
      <b className="basis-full">
        {o.full_name} <span className="text-caption font-normal">@{o.username}</span>
      </b>
      <TextField field={`pos-${team.key}-${o.username}`} label="Position" max={40} value={position} onChange={setPosition} />
      <TextField field={`seat-${team.key}-${o.username}`} label="Order" type="number" value={seat} onChange={setSeat} />
      <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => officerService.setOfficer(o.profile_id, team.key, position.trim(), Number(seat)), `${o.full_name}’s seat is saved.`)}>
        Save<span className="sr-only"> {o.full_name}</span>
      </button>
      <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => affiliationService.setForMember(o.profile_id, team.key, false), `${o.full_name} is off ${team.name}.`)}>
        Remove<span className="sr-only"> {o.full_name} from {team.name}</span>
      </button>
    </li>
  );
}
