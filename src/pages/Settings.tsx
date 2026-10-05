// /settings (FR-16): email choices, the world theme, sign out, and deleting the account.
// Deleting asks the member to type their username first, then removes their images, their
// account (which takes the draft and the public card with it) and signs out.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../app/sessionContext';
import { Toggle } from '../components/editor/fields';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage, Panel } from '../components/shell/MenuPage';
import { ThemeToggle } from '../components/shell/ThemeToggle';
import { InstallPrompt } from '../components/install/InstallPrompt';
import { useInstallMode } from '../lib/install';
import { accountService, type Preferences } from '../services/accountService';
import { profileService } from '../services/profileService';
import type { MyCard } from '../types/draft';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; mine: MyCard };

export default function Settings() {
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
      .catch(() => live && setLoad({ status: 'error' }));
    return () => {
      live = false;
    };
  }, [userId, attempt]);

  if (session.status !== 'signed-in') return null; // RequireAuth handles the other states
  const user = session.user;

  const leave = async () => {
    navigate('/', { replace: true });
    await signOut().catch(() => {
      // the local session is cleared even if the server call fails
    });
  };

  return (
    <MenuPage title="Settings">
      <Panel label="Account">
        <h2 className="panel-title">Account</h2>
        <p className="m-0">
          Signed in with Google as <span className="font-mono [overflow-wrap:anywhere]">{user.email}</span>
        </p>
        <p className="m-0">{user.githubHandle ? <>GitHub connected as <span className="font-mono">@{user.githubHandle}</span></> : 'GitHub not connected yet.'}</p>
        <div className="flex flex-wrap gap-space-2">
          <Link to="/edit" className="pixel-btn">
            Edit my card
          </Link>
          <button type="button" className="pixel-btn" onClick={() => void leave()}>
            Sign out
          </button>
        </div>
      </Panel>

      <Panel label="Email">
        <h2 className="panel-title">Email</h2>
        {load.status === 'loading' && <DialogueBox text="Fetching your choices…" emote="pending" />}
        {load.status === 'error' && (
          <DialogueBox text="Can’t load your choices right now. Check your connection and try again." emote="attention">
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
        {load.status === 'ready' && !load.mine.profile && (
          <DialogueBox text="These choices live on your card. Make your card first, then come back here." emote="attention">
            <Link to="/edit" className="hw-btn no-underline" data-variant="small">
              MAKE CARD
            </Link>
          </DialogueBox>
        )}
        {load.status === 'ready' && load.mine.profile && <EmailPrefs userId={user.id} mine={load.mine} onSaved={() => setAttempt((a) => a + 1)} />}
      </Panel>

      <Panel label="World">
        <h2 className="panel-title">World</h2>
        <p className="m-0">DAY, NIGHT, or AUTO to follow your device. Saved on this device.</p>
        <ThemeToggle />
      </Panel>

      <InstallPanel />

      <DeleteAccount username={load.status === 'ready' ? (load.mine.profile?.username ?? null) : null} userId={user.id} onDeleted={leave} />
    </MenuPage>
  );
}

function EmailPrefs({ userId, mine, onSaved }: { userId: string; mine: MyCard; onSaved: () => void }) {
  const p = mine.profile!;
  const [prefs, setPrefs] = useState<Preferences>({ email_updates: p.email_updates, show_email: p.show_email });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const dirty = prefs.email_updates !== p.email_updates || prefs.show_email !== p.show_email;
  const showChanged = prefs.show_email !== p.show_email;
  const reviewed = p.status === 'approved' || p.status === 'pending_review';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await accountService.savePreferences(userId, prefs);
      setNotice({ text: showChanged && reviewed ? 'Saved. Your card went back to draft: submit it from the card editor so the change goes live.' : 'Saved.' });
      onSaved();
    } catch {
      setNotice({ text: 'Saving didn’t work. Check your connection and try again.', bad: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="grid gap-space-3" onSubmit={save}>
      <Toggle
        field="email_updates"
        label="Email me about my card"
        hint="Only about your card and the hall (for example, when it’s approved). Turn it off any time."
        checked={prefs.email_updates}
        onChange={(email_updates) => setPrefs((x) => ({ ...x, email_updates }))}
      />
      <Toggle
        field="show_email"
        label="Show my email on my card"
        hint={
          p.public_email
            ? `Shows ${p.public_email} on your public card and page.${reviewed ? ' Changing this sends your card back to review; the live card stays up meanwhile.' : ''}`
            : 'Add a public email in the card editor first. Until then nothing is shown.'
        }
        checked={prefs.show_email}
        onChange={(show_email) => setPrefs((x) => ({ ...x, show_email }))}
      />
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}
      <button type="submit" className="pixel-btn justify-self-start" data-variant="primary" disabled={!dirty || busy}>
        {busy ? 'Saving…' : 'Save email choices'}
      </button>
    </form>
  );
}

function DeleteAccount({ userId, username, onDeleted }: { userId: string; username: string | null; onDeleted: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const opener = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Members without a card confirm with the word DELETE.
  const word = username ?? 'DELETE';
  const ok = typed.trim().toLowerCase() === word.toLowerCase();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await accountService.deleteAccount(userId);
      await onDeleted();
    } catch {
      setError('Deleting didn’t finish. Check your connection and try again.');
      setBusy(false);
    }
  };

  return (
    <Panel label="Delete account">
      <h2 className="panel-title">Delete account</h2>
      <p className="m-0">
        Removes your card from the hall, your page{username ? ` at /member/${username}` : ''}, your photos, projects and sign-in. This can’t be undone. Printed QR codes
        will stop working.
      </p>
      {!open ? (
        <button ref={opener} type="button" className="pixel-btn justify-self-start" onClick={() => setOpen(true)}>
          Delete my account…
        </button>
      ) : (
        <form className="notice notice-bad grid gap-space-3" onSubmit={submit}>
          <label htmlFor="confirm-delete" className="field-label">
            Type <span className="font-mono">{word}</span> to confirm
          </label>
          <input
            id="confirm-delete"
            className="pixel-input"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            autoFocus
          />
          {error && (
            <p className="m-0" role="alert">
              <span aria-hidden="true">! </span>
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-space-2">
            <button type="submit" className="pixel-btn" data-variant="primary" disabled={!ok || busy}>
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
            <button
              type="button"
              className="pixel-btn"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setTyped('');
                // Back to the button that opened the confirm step, not the top of the page.
                requestAnimationFrame(() => opener.current?.focus());
              }}
            >
              Keep my account
            </button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function InstallPanel() {
  const mode = useInstallMode();
  if (mode === 'unsupported') return null;
  return (
    <Panel label="App">
      <h2 className="panel-title">App</h2>
      {mode === 'installed' ? <p className="m-0">PIP-Hall is installed on this device.</p> : <InstallPrompt />}
    </Panel>
  );
}
