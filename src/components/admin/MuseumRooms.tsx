// Admin → Museum → Rooms (V2-20, D-133): the Museum's rooms in the admins' order, each with the sign
// on its door and whether it is open. A closed room keeps its exhibits; its door is shut. Rooms come
// and go with what is on show (an event's room once a winner hangs, a wing once it has exhibits);
// those not arranged here follow in their usual order. Saved as one arrangement; the database
// checks is_admin() and every room.

import { useEffect, useMemo, useState } from 'react';
import { useAppearance } from '../../app/appearanceContext';
import { inLayoutOrder, isShut, layoutOf, MEMBERS_ROOM } from '../../lib/curation';
import { officerUsernames } from '../../lib/officers';
import { showcaseRooms, type MuseumData } from '../../lib/showcase';
import { loadMuseumData } from '../../lib/useShowcaseRooms';
import { museumErrorMessage, museumService } from '../../services/museumService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { TextField, Toggle } from '../editor/fields';

interface Row {
  id: string;
  name: string;
  sign: string;
  closed: boolean;
}

const KIND: Record<string, string> = { winners: '♛', members: '☺', all: '✶', archive: '▤' };
const glyph = (id: string) => KIND[id] ?? (id.startsWith('event:') ? '⚑' : '▣');
const badSign = (s: string) => s.trim().length > 0 && (s.trim().length < 2 || s.trim().length > 30);

export function MuseumRooms({ onDone }: { onDone: (message: string) => void }) {
  const [data, setData] = useState<MuseumData | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { officers } = useAppearance();
  const names = useMemo(() => officerUsernames(officers), [officers]);

  useEffect(() => {
    let on = true;
    loadMuseumData()
      .then((d) => on && setData(d))
      .catch((e) => on && setFailed(museumErrorMessage(e)));
    return () => {
      on = false;
    };
  }, [attempt]);

  // Every room on show now, as the visitors' Museum would plan it, before the admins' arrangement.
  const rooms = useMemo(() => {
    if (!data) return null;
    const planned = showcaseRooms({ ...data, curation: undefined }, { officers: names }).map((r) => ({ id: r.id, name: r.name, kind: r.kind as string }));
    if ((data.curation?.portraits.length ?? 0) > 0) {
      const at = planned.findIndex((r) => r.kind === 'wing' || r.kind === 'all' || r.kind === 'archive');
      planned.splice(at < 0 ? planned.length : at, 0, { id: MEMBERS_ROOM, name: 'Featured Members', kind: 'members' });
    }
    return planned;
  }, [data, names]);

  // The admin's working copy starts from the saved arrangement (set during render when the data arrives).
  const [from, setFrom] = useState<typeof rooms>(null);
  if (rooms !== from) {
    setFrom(rooms);
    const c = data?.curation ?? { rooms: [] };
    setRows(rooms ? inLayoutOrder(rooms, c).map((r) => ({ id: r.id, name: r.name, sign: layoutOf(c, r.id)?.sign ?? '', closed: isShut(c, r.id) })) : null);
  }

  const move = (i: number, d: number) =>
    setRows((l) => {
      if (!l || i + d < 0 || i + d >= l.length) return l;
      const next = [...l];
      [next[i], next[i + d]] = [next[i + d]!, next[i]!];
      return next;
    });
  const set = (i: number, patch: Partial<Row>) => setRows((l) => l?.map((r, k) => (k === i ? { ...r, ...patch } : r)) ?? l);

  const save = async (arrangement: Row[] | null) => {
    setBusy(true);
    setError(null);
    try {
      await museumService.saveRooms((arrangement ?? []).map((r) => ({ key: r.id, sign: r.sign.trim() || null, hidden: r.closed })));
      onDone(arrangement ? 'The Museum’s rooms are arranged.' : 'The Museum’s rooms are back in their usual order.');
      setAttempt((a) => a + 1);
    } catch (e) {
      setError(museumErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="grid gap-space-3" aria-labelledby="museum-rooms-title">
      <h2 id="museum-rooms-title" className="panel-title">
        Rooms
      </h2>
      <p className="m-0 field-hint">
        The order visitors walk the rooms in (the circles, the walk and the list), the sign on each door, and which are open. A closed room keeps its exhibits. Rooms appear as they get something on show.
      </p>
      {error && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      {failed && (
        <DialogueBox text={`Can’t read the Museum. ${failed}`} emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={() => (setFailed(null), setAttempt((a) => a + 1))}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {!rows && !failed && <DialogueBox text="Walking the rooms…" emote="pending" />}
      {rows && rows.length === 0 && <DialogueBox text="The Museum has no rooms yet: nothing is on show. Feature a project, hang a winner or publish the archive, and its room appears here." />}
      {rows && rows.length > 0 && (
        <>
          <ol className="grid gap-space-2 m-0 p-0 list-none" aria-label="Rooms in walking order">
            {rows.map((r, i) => (
              <li key={r.id} className="menu-panel grid gap-space-2" data-closed={r.closed || undefined}>
                <p className="m-0 font-display tracking-[0.04em]">
                  <span aria-hidden="true">{glyph(r.id)} </span>
                  {i + 1}. {r.name}
                  {r.closed && <span className="text-caption text-text-secondary"> · closed</span>}
                </p>
                <TextField field={`room-${r.id}-sign`} label="Sign on the door" hint={`Leave empty for “${r.name}”.`} max={30} error={badSign(r.sign) ? '2 to 30 characters.' : undefined} value={r.sign} onChange={(v) => set(i, { sign: v })} />
                <Toggle field={`room-${r.id}-closed`} label="Closed to visitors" checked={r.closed} onChange={(v) => set(i, { closed: v })} />
                <div className="flex flex-wrap gap-space-2">
                  <button type="button" className="pixel-btn" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    ▲ Up<span className="sr-only"> {r.name}</span>
                  </button>
                  <button type="button" className="pixel-btn" disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)}>
                    ▼ Down<span className="sr-only"> {r.name}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-space-2">
            <button type="button" className="pixel-btn" data-variant="primary" disabled={busy || rows.some((r) => badSign(r.sign))} onClick={() => void save(rows)}>
              Save the rooms
            </button>
            <button type="button" className="pixel-btn" disabled={busy} onClick={() => void save(null)}>
              Back to the usual order
            </button>
          </div>
        </>
      )}
    </section>
  );
}
