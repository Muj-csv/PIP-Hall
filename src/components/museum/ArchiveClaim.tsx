// "Is this yours?" (D-118): on an archive exhibit, a member with a card in the hall asks the
// admins to link them as one of its makers; an admin confirms or declines in Admin → Archive. A
// member who is linked can take their name off again. Visitors are told how to claim.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { archiveErrorMessage, archiveService, type MyArchive } from '../../services/archiveService';
import { TextArea } from '../editor/fields';

export function ArchiveClaim({ exhibitId, title }: { exhibitId: string; title: string }) {
  const { session } = useSession();
  const signedIn = session.status === 'signed-in';
  const [mine, setMine] = useState<MyArchive | null>(null);
  const [failed, setFailed] = useState(false);
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let on = true;
    archiveService
      .mine()
      .then((m) => on && setMine(m))
      .catch(() => on && setFailed(true));
    return () => {
      on = false;
    };
  }, [signedIn, round]);

  const run = async (what: () => Promise<void>, done: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await what();
      setNotice({ text: done });
      setOpen(false);
      setNote('');
      setRound((r) => r + 1);
    } catch (e) {
      setNotice({ text: archiveErrorMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  const claim = mine?.claims.find((c) => c.exhibit_id === exhibitId) ?? null;
  const credited = Boolean(mine?.credited.includes(exhibitId));

  return (
    <section className="menu-panel archive-claim" aria-labelledby="claim-title">
      <h2 id="claim-title" className="panel-title">
        Is this yours?
      </h2>
      {!signedIn && (
        <p className="m-0">
          If you made “{title}”, sign in with your card in the hall and claim it: once an admin confirms, it links to your badge.{' '}
          <Link to="/login" className="underline decoration-2">
            Sign in
          </Link>
        </p>
      )}
      {signedIn && failed && <p className="m-0 field-hint">Can’t check your claims right now. Try again later.</p>}
      {signedIn && mine && !mine.eligible && (
        <p className="m-0">
          Claiming opens once your card is approved.{' '}
          <Link to="/edit" className="underline decoration-2">
            Go to My card
          </Link>
        </p>
      )}
      {mine?.eligible && credited && (
        <div className="grid gap-space-2">
          <p className="m-0">
            <span aria-hidden="true">✓ </span>You’re credited on this exhibit; it’s linked to your badge.
          </p>
          <div>
            <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => archiveService.leave(exhibitId), 'Your name is off it. The admins can link you again if you claim it.')}>
              Take my name off
            </button>
          </div>
        </div>
      )}
      {mine?.eligible && !credited && claim?.status === 'pending' && (
        <p className="m-0">
          <span aria-hidden="true">⧗ </span>Your claim is with the admins. You’ll hear in your bell when it’s answered.
        </p>
      )}
      {mine?.eligible && !credited && claim?.status !== 'pending' && (
        <div className="grid gap-space-2">
          {claim?.status === 'declined' && <p className="m-0 field-hint">Your last claim wasn’t confirmed. You can claim it again with more detail.</p>}
          {open ? (
            <form
              className="grid gap-space-2"
              aria-label={`Claim ${title}`}
              onSubmit={(e) => {
                e.preventDefault();
                void run(() => archiveService.claim(exhibitId, note.trim()), 'Claim sent. An admin will check it and link it to your badge.');
              }}
            >
              <TextArea field="claim-note" label="What did you do on it? (optional, for the admins)" max={200} value={note} onChange={setNote} />
              <div className="flex flex-wrap gap-space-2">
                <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy}>
                  Send claim
                </button>
                <button type="button" className="pixel-btn" onClick={() => setOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <button type="button" className="pixel-btn" onClick={() => setOpen(true)}>
                Claim it
              </button>
            </div>
          )}
        </div>
      )}
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
    </section>
  );
}
