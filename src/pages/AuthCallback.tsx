// /auth/callback: where Google (sign-in) and GitHub (connect) send the browser back.
// The Supabase client exchanges the ?code= on its own; this page waits for the session,
// syncs a newly linked GitHub handle, then moves on. Errors speak through the DialogueBox.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useSession } from '../app/sessionContext';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { authErrorFromUrl, describeAuthError, safeNext, type AuthProblem } from '../services/authErrors';
import { githubService } from '../services/githubService';

const GIVE_UP_MS = 10000;

export default function AuthCallback() {
  const { session } = useSession();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [urlProblem] = useState<AuthProblem | null>(() => authErrorFromUrl(window.location.href));
  const [timedOut, setTimedOut] = useState(false);
  const done = useRef(false);
  const problem =
    urlProblem ??
    (session.status === 'unavailable' ? describeAuthError('not_configured') : timedOut ? describeAuthError('flow_state_expired') : null);

  useEffect(() => {
    if (problem || done.current) return;
    if (session.status === 'signed-in') {
      done.current = true;
      const go = () => navigate(next, { replace: true });
      if (session.user.githubHandle) githubService.sync().then(go, go);
      else go();
      return;
    }
    const t = window.setTimeout(() => setTimedOut(true), GIVE_UP_MS);
    return () => window.clearTimeout(t);
  }, [session, problem, navigate, next]);

  if (problem) {
    const linking = problem.code.startsWith('identity_') || problem.code === 'manual_linking_disabled';
    return (
      <MenuPage title={linking ? 'GitHub not connected' : 'Sign-in didn’t finish'}>
        <DialogueBox text={problem.message} emote="attention" />
        <div className="flex flex-wrap gap-space-3">
          <Link to={linking ? '/edit' : `/login?next=${encodeURIComponent(next)}`} className="pixel-btn" data-variant="primary">
            {linking ? 'Back to my card' : 'Try again'}
          </Link>
          <Link to="/" className="pixel-btn">
            ◀ Back to the hall
          </Link>
        </div>
      </MenuPage>
    );
  }

  return (
    <MenuPage title="Signing you in">
      <DialogueBox text="Checking your pass with the hall…" emote="pending" />
    </MenuPage>
  );
}
