// Route guards (Phase 2). They only decide what to show; the database enforces every rule.

import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { MenuPage } from '../components/shell/MenuPage';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { useSession } from './sessionContext';

function Waiting() {
  return (
    <MenuPage title="One moment">
      <DialogueBox text="Checking your pass…" emote="pending" />
    </MenuPage>
  );
}

function NotSetUp() {
  return (
    <MenuPage title="Sign-in isn’t on yet">
      <DialogueBox text="This copy of PIP-Hall isn’t connected to its database yet, so nobody can sign in. The hall itself still works." emote="attention" />
      <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
        ◀ Back to the hall
      </Link>
    </MenuPage>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  if (session.status === 'unavailable') return <NotSetUp />;
  if (session.status === 'loading') return <Waiting />;
  if (session.status === 'signed-out') {
    const next = location.pathname + location.search;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session } = useSession();
  return (
    <RequireAuth>
      {session.status === 'signed-in' && session.role === null ? (
        <Waiting />
      ) : session.status === 'signed-in' && session.role === 'admin' ? (
        children
      ) : (
        <MenuPage title="Admins only">
          <DialogueBox text="This room is for hall admins. Your card and the hall are just a step away." emote="attention" />
          <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
            ◀ Back to the hall
          </Link>
        </MenuPage>
      )}
    </RequireAuth>
  );
}
