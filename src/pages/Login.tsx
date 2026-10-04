// /login (FR-01): Continue with Google. Everything else about the account happens after.

import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { useSession } from '../app/sessionContext';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage, Panel } from '../components/shell/MenuPage';
import { describeAuthError, safeNext } from '../services/authErrors';
import { authService } from '../services/authService';

export default function Login() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const urlError = params.get('error');
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: urlError ? describeAuthError(urlError).message : null,
  });

  if (session.status === 'signed-in') return <Navigate to={next} replace />;

  if (session.status === 'unavailable') {
    return (
      <MenuPage title="Make your card">
        <DialogueBox text={describeAuthError('not_configured').message + ' You can still browse the hall.'} emote="attention" />
        <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
          ◀ Back to the hall
        </Link>
      </MenuPage>
    );
  }

  const start = async () => {
    setState({ busy: true, error: null });
    try {
      await authService.signInWithGoogle(next); // leaves the page on success
    } catch (e) {
      setState({ busy: false, error: describeAuthError((e as { code?: string }).code, (e as Error).message).message });
    }
  };

  return (
    <MenuPage title="Make your card">
      <DialogueBox
        text={state.error ?? 'Sign in with Google to make your card. Your email stays private unless you choose to show it.'}
        emote={state.error ? 'attention' : undefined}
      />
      <Panel label="Sign in">
        <p className="m-0">
          New here? Signing in creates your account. Next you’ll connect GitHub, so your card can show your real projects and a verified handle.
        </p>
        <button type="button" className="pixel-btn justify-self-start" data-variant="primary" onClick={start} disabled={state.busy || session.status === 'loading'} aria-busy={state.busy}>
          {state.busy ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <p className="m-0 text-caption text-text-secondary">PIP-Hall asks Google only for your name, email and profile picture.</p>
      </Panel>
    </MenuPage>
  );
}
