// /admin — guarded by RequireAdmin (FR-08). The database checks is_admin() again on every read
// of a draft and every moderation call, so this guard is only for the screen.

import { useCallback, useEffect, useState } from 'react';
import { ModerationQueue } from '../components/admin/ModerationQueue';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { adminErrorMessage, adminService, type Queue } from '../services/adminService';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; queue: Queue };

export default function Admin() {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [notice, setNotice] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    adminService
      .queue()
      .then((queue) => live && setLoad({ status: 'ready', queue }))
      .catch((e) => live && setLoad({ status: 'error', message: `Can’t load the queue. ${adminErrorMessage(e)}` }));
    return () => {
      live = false;
    };
  }, [attempt]);

  const onDone = useCallback((message: string) => {
    setNotice(message);
    setAttempt((a) => a + 1);
  }, []);

  return (
    <MenuPage title="Admin" wide>
      <p className="notice m-0" role="status">
        {notice ?? 'Approve cards into the hall, send them back with a note, feature or unpublish them.'}
      </p>
      {load.status === 'loading' && <DialogueBox text="Opening the review queue…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox text={load.message} emote="attention">
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setLoad({ status: 'loading' });
              setAttempt((a) => a + 1);
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {load.status === 'ready' && <ModerationQueue queue={load.queue} onDone={onDone} />}
    </MenuPage>
  );
}
