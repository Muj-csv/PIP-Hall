// /edit — Phase 2 part: who you're signed in as, Connect GitHub (FR-02), sign out.
// Phase 3 grows this into the card editor with the live badge.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../app/sessionContext';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage, Panel } from '../components/shell/MenuPage';
import { describeAuthError } from '../services/authErrors';
import { githubService } from '../services/githubService';

export default function Edit() {
  const { session, signOut } = useSession();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<'github' | 'signout' | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (session.status !== 'signed-in') return null; // RequireAuth handles the other states
  const { user } = session;

  const connect = async () => {
    setBusy('github');
    setError(null);
    try {
      await githubService.connect('/edit'); // leaves the page on success
    } catch (e) {
      setBusy(null);
      setError(describeAuthError((e as { code?: string }).code, (e as Error).message).message);
    }
  };

  const leave = async () => {
    setBusy('signout');
    // Leave the protected page first, so the guard doesn't bounce a deliberate sign-out to /login.
    navigate('/', { replace: true });
    await signOut().catch(() => {
      // The local session is cleared even if the server call fails; nothing to show here.
    });
  };

  const line =
    error ??
    (user.githubHandle
      ? `Nice, @${user.githubHandle} is connected. The card editor opens here next.`
      : 'Step one: connect GitHub. It proves the handle on your card is yours, and lets you pick repos to show.');

  return (
    <MenuPage title="My card">
      <DialogueBox text={line} emote={error ? 'attention' : user.githubHandle ? 'approved' : undefined} />

      <Panel label="Account">
        <h2 className="m-0 font-display text-h3 font-normal">Signed in</h2>
        <p className="m-0">
          {user.name ? <strong>{user.name}</strong> : null}
          {user.name && user.email ? ' · ' : null}
          <span className="font-mono text-caption">{user.email}</span>
        </p>
      </Panel>

      <Panel label="GitHub">
        <h2 className="m-0 font-display text-h3 font-normal">GitHub</h2>
        {user.githubHandle ? (
          <p className="m-0">
            <span className="sticker-inline">✓ VERIFIED</span> Connected as <span className="font-mono">@{user.githubHandle}</span>
          </p>
        ) : (
          <>
            <p className="m-0">Not connected yet. You’ll pick which public repos appear on your card; private repos never leave GitHub.</p>
            <button type="button" className="pixel-btn justify-self-start" data-variant="primary" onClick={connect} disabled={busy !== null} aria-busy={busy === 'github'}>
              {busy === 'github' ? 'Opening GitHub…' : 'Connect GitHub'}
            </button>
          </>
        )}
      </Panel>

      <div className="flex flex-wrap gap-space-3">
        <Link to="/" className="pixel-btn">
          ◀ Back to the hall
        </Link>
        <button type="button" className="pixel-btn" onClick={leave} disabled={busy !== null} aria-busy={busy === 'signout'}>
          {busy === 'signout' ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </MenuPage>
  );
}
