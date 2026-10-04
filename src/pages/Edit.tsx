// /edit — the card editor (Phase 3). Loads the member's own draft, then hands it to CardEditor.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSession } from '../app/sessionContext';
import { CardEditor } from '../components/editor/CardEditor';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { profileService } from '../services/profileService';
import type { MyCard } from '../types/draft';

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; mine: MyCard };

export default function Edit() {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const userId = session.status === 'signed-in' ? session.user.id : null;

  useEffect(() => {
    if (!userId) return;
    let live = true;
    profileService
      .getMine(userId)
      .then((mine) => live && setLoad({ status: 'ready', mine }))
      .catch(() => live && setLoad({ status: 'error', message: 'Can’t load your card right now. Check your connection and try again.' }));
    return () => {
      live = false;
    };
  }, [userId, attempt]);

  if (session.status !== 'signed-in') return null; // RequireAuth handles the other states

  const leave = async () => {
    // Leave first, synchronously: if the sign-out landed while the move was still pending, the
    // guard on this page would send the visitor to /login instead of the hall.
    await navigate('/', { replace: true, flushSync: true });
    await signOut().catch(() => {
      // the local session is cleared even if the server call fails
    });
  };

  return (
    <MenuPage title="My card" wide>
      {load.status === 'loading' && <DialogueBox text="Fetching your card…" emote="pending" />}
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
      {load.status === 'ready' && <CardEditor user={session.user} initial={load.mine} onSignOut={leave} />}
    </MenuPage>
  );
}
