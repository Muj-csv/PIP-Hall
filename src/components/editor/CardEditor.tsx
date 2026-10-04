// The card editor (Phase 3, FR-03..FR-07): the live badge hangs where the hero badge does, the
// form sits beside it. Save is explicit (button or Ctrl/Cmd+S); leaving with unsaved changes asks
// first. Every rule is checked again by the database on save.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker } from 'react-router';
import { formFrom, previewCard } from '../../lib/editorModel';
import { focusFirstError } from '../../lib/focusFirstError';
import { LIMITS, validateCard, type FieldErrors } from '../../lib/validate';
import { describeAuthError } from '../../services/authErrors';
import type { AuthUser } from '../../services/authService';
import { githubService, refreshProject, repoToProject, type GithubRepo } from '../../services/githubService';
import { profileService, saveErrorMessage } from '../../services/profileService';
import type { CardForm, DraftProject, MyCard } from '../../types/draft';
import { Lanyard } from '../cards/Lanyard';
import { MemberCard } from '../cards/MemberCard';
import { QrFullscreen } from '../cards/QrFullscreen';
import { DialogueBox } from '../dialogue/DialogueBox';
import { Panel } from '../shell/MenuPage';
import { TextArea, TextField, Toggle } from './fields';
import { ManualProjectForm } from './ManualProjectForm';
import { MuseumPanel } from './MuseumPanel';
import { PhotoField } from './PhotoField';
import { ProjectList } from './ProjectList';
import { RepoPicker } from './RepoPicker';
import { SkillsInput } from './SkillsInput';
import { StatusBanner } from './StatusBanner';
import { statusView } from '../../lib/editorModel';

interface Props {
  user: AuthUser;
  initial: MyCard;
  onSignOut: () => void;
}

export function CardEditor({ user, initial, onSignOut }: Props) {
  const [mine, setMine] = useState(initial);
  const [baseline, setBaseline] = useState(() => formFrom(initial, user));
  const [form, setFormState] = useState(baseline);
  const [newPhoto, setNewPhoto] = useState<Blob | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | 'github' | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const dirty = newPhoto !== null || JSON.stringify(form) !== JSON.stringify(baseline);
  const locked = mine.profile?.username_locked ?? false;
  const handle = mine.profile?.github_username ?? user.githubHandle;

  const setForm = (patch: Partial<CardForm>) => {
    setFormState((f) => ({ ...f, ...patch }));
    setNotice(null);
  };
  const setProjects = (fn: (ps: DraftProject[]) => DraftProject[]) => setForm({ projects: fn(form.projects) });

  // Preview of a picked-but-unsaved photo.
  const photoUrl = useMemo(() => (newPhoto ? URL.createObjectURL(newPhoto) : null), [newPhoto]);
  useEffect(() => () => (photoUrl ? URL.revokeObjectURL(photoUrl) : undefined), [photoUrl]);

  const card = useMemo(() => previewCard(form, mine, user), [form, mine, user]);
  const view = statusView(mine.profile?.status ?? null, { hasLiveCard: mine.hasLiveCard, reviewNote: mine.profile?.review_note ?? null, dirty });

  const save = useCallback(async (): Promise<MyCard | null> => {
    const e = validateCard(form, { usernameLocked: locked });
    setErrors(e);
    if (Object.keys(e).length) {
      setNotice({ text: 'A few fields need a look. They’re marked with !', bad: true });
      requestAnimationFrame(() => focusFirstError(formRef.current, e));
      return null;
    }
    try {
      let saved = await profileService.save(user.id, form, mine, newPhoto);
      if (user.githubHandle && !saved.profile?.github_username) {
        await githubService.sync(); // copy the verified handle onto the new profile row
        saved = await profileService.getMine(user.id);
      }
      const next = formFrom(saved, user);
      setMine(saved);
      setBaseline(next);
      setFormState(next);
      setNewPhoto(null);
      return saved;
    } catch (err) {
      setNotice({ text: saveErrorMessage(err), bad: true });
      return null;
    }
  }, [form, locked, mine, newPhoto, user]);

  const onSave = async () => {
    if (busy) return;
    setBusy('save');
    const saved = await save();
    setBusy(null);
    if (saved) setNotice({ text: saved.profile?.status === 'draft' && saved.hasLiveCard ? 'Saved. Submit changes when you’re ready; the live card stays up meanwhile.' : 'Saved.' });
  };

  const onSubmit = async () => {
    if (busy) return;
    setBusy('submit');
    const saved = dirty || !mine.profile ? await save() : mine;
    if (!saved) {
      setBusy(null);
      return;
    }
    try {
      await profileService.submitForReview();
      setMine(await profileService.getMine(user.id));
      setNotice({ text: 'Sent! An admin will review your card. You’ll see the result here.' });
    } catch (err) {
      setNotice({ text: saveErrorMessage(err), bad: true });
    } finally {
      setBusy(null);
    }
  };

  const onConnect = async () => {
    setBusy('github');
    try {
      await githubService.connect('/edit'); // leaves the page
    } catch (e) {
      setBusy(null);
      setNotice({ text: describeAuthError((e as { code?: string }).code, (e as Error).message).message, bad: true });
    }
  };

  // Ctrl/Cmd+S saves.
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Warn before leaving with unsaved changes: in-app navigation and closing the tab.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  const onToggleRepo = (repo: GithubRepo, pick: boolean) =>
    setProjects((ps) => (pick ? (ps.length < LIMITS.projects ? [...ps, repoToProject(repo, `gh-${repo.id}`)] : ps) : ps.filter((p) => !(p.source === 'github' && p.github_repo_id === repo.id))));
  const onRefreshed = (repos: GithubRepo[]) => {
    const byId = new Map(repos.map((r) => [r.id, r]));
    setProjects((ps) => ps.map((p) => (p.source === 'github' && p.github_repo_id !== null && byId.has(p.github_repo_id) ? refreshProject(p, byId.get(p.github_repo_id)!) : p)));
  };

  const actions = (
    <div className="flex flex-wrap gap-space-2">
      <button type="button" className="pixel-btn" onClick={onSave} disabled={busy !== null || (!dirty && mine.profile !== null)} aria-busy={busy === 'save'} aria-keyshortcuts="Control+S Meta+S">
        {busy === 'save' ? 'Saving…' : dirty || !mine.profile ? 'Save' : 'Saved'}
      </button>
      {view.submit && (
        <button type="button" className="pixel-btn" data-variant="primary" onClick={onSubmit} disabled={busy !== null} aria-busy={busy === 'submit'}>
          {busy === 'submit' ? 'Sending…' : view.submit}
        </button>
      )}
    </div>
  );

  // One action bar, shown once: beside the badge on wide screens, pinned to the bottom on phones
  // (CSS hides the other copy with display: none, so it's never read twice either).
  const actionBar = (
    <>
      {notice && (
        <div className={notice.bad ? 'notice notice-bad' : 'notice'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </div>
      )}
      {actions}
      {view.submitHint && <p className="field-hint m-0">{view.submitHint}</p>}
      <p className="field-hint m-0">{dirty ? 'You have unsaved changes. Ctrl/⌘+S saves.' : 'All changes saved.'}</p>
    </>
  );

  return (
    <div className="editor-grid">
      <aside className="editor-side" aria-label="Your card">
        <div className="preview-stage">
          <Lanyard />
          <div className="flipper">
            <MemberCard
              card={card}
              flipped={flipped}
              focusable
              onActivate={() => setFlipped((f) => !f)}
              onOpen={() => setFlipped(false)}
              onShowQr={() => setShowQr(true)}
              photoUrl={photoUrl}
            />
          </div>
        </div>
        <button type="button" className="pixel-btn justify-self-center" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
          {flipped ? 'Show front' : 'Show Quest Log'}
        </button>
        <StatusBanner view={view} />
        <div className="editor-actions" data-at="side">
          {actionBar}
        </div>
      </aside>

      <div ref={formRef} className="grid gap-space-4">
        <Panel label="Who you are">
          <h2 className="panel-title">Who you are</h2>
          {locked ? (
            <div className="field" data-field="username">
              <span className="field-label">Username</span>
              <p className="m-0 font-mono">@{form.username}</p>
              <p className="field-hint">Locked after approval so printed QR codes keep working. An admin can change it.</p>
            </div>
          ) : (
            <TextField
              field="username"
              label="Username"
              value={form.username}
              error={errors.username}
              autoComplete="username"
              hint={<>Your page will be pip-hall/member/<span className="font-mono">{form.username || 'you'}</span>. It locks once approved.</>}
              onChange={(v) => setForm({ username: v.toLowerCase() })}
            />
          )}
          <TextField field="full_name" label="Name on the badge" value={form.full_name} max={LIMITS.full_name} error={errors.full_name} autoComplete="name" onChange={(v) => setForm({ full_name: v })} />
          <TextField field="role" label="Role" hint="One line, e.g. Frontend dev · design systems" value={form.role} max={LIMITS.role} error={errors.role} onChange={(v) => setForm({ role: v })} />
          <div className="grid gap-space-3 sm:grid-cols-2">
            <TextField field="org_position" label="Position (optional)" hint="Becomes a sticker, e.g. Team lead" value={form.org_position} max={LIMITS.org_position} error={errors.org_position} onChange={(v) => setForm({ org_position: v })} />
            <TextField field="department" label="Department tag (optional)" value={form.department} max={LIMITS.department} error={errors.department} onChange={(v) => setForm({ department: v })} />
          </div>
          <TextField field="tagline" label="Tagline (optional)" value={form.tagline} max={LIMITS.tagline} error={errors.tagline} onChange={(v) => setForm({ tagline: v })} />
          <TextArea field="bio" label="Bio" hint="The back of the badge shows the first three lines." value={form.bio} max={LIMITS.bio} error={errors.bio} onChange={(v) => setForm({ bio: v })} />
          <PhotoField
            hasPhoto={newPhoto !== null || form.avatar_path !== null}
            onPicked={(blob) => {
              setNewPhoto(blob);
              setNotice(null);
            }}
            onRemove={() => {
              setNewPhoto(null);
              setForm({ avatar_path: null });
            }}
          />
        </Panel>

        <Panel label="Links">
          <h2 className="panel-title">Links</h2>
          <p className="m-0 text-caption text-text-secondary">
            GitHub comes from your connected account{handle ? <> (<span className="font-mono">@{handle}</span>)</> : ''}. Empty links show as dashed slots.
          </p>
          <TextField field="linkedin_url" label="LinkedIn" type="url" inputMode="url" placeholder="https://www.linkedin.com/in/…" value={form.linkedin_url} error={errors.linkedin_url} onChange={(v) => setForm({ linkedin_url: v })} />
          <TextField field="portfolio_url" label="Website" type="url" inputMode="url" placeholder="https://" value={form.portfolio_url} error={errors.portfolio_url} onChange={(v) => setForm({ portfolio_url: v })} />
          <TextField field="public_email" label="Public email (optional)" type="email" inputMode="email" autoComplete="email" value={form.public_email} error={errors.public_email} onChange={(v) => setForm({ public_email: v })} />
          <Toggle field="show_email" label="Show my email on my card" hint="Off by default. When on, visitors tap to reveal it." checked={form.show_email} onChange={(v) => setForm({ show_email: v })} />
          <Toggle field="email_updates" label="Email me about my card (approval, news)" hint={`Sent to ${user.email ?? 'your Google email'}. You can turn this off any time.`} checked={form.email_updates} onChange={(v) => setForm({ email_updates: v })} />
        </Panel>

        <Panel label="Skills">
          <h2 className="panel-title">Skills</h2>
          <SkillsInput skills={form.skills} error={errors.skills} onChange={(skills) => setForm({ skills })} />
        </Panel>

        <Panel label="Projects">
          <h2 className="panel-title">
            Projects <span className="field-hint-inline">({form.projects.length}/{LIMITS.projects})</span>
          </h2>
          <RepoPicker
            handle={handle}
            projects={form.projects}
            onToggle={onToggleRepo}
            onRefreshed={onRefreshed}
            onConnect={onConnect}
            connectBusy={busy === 'github'}
            connectBlocked={dirty ? 'Save your changes first: connecting GitHub leaves this page for a moment.' : null}
          />
          {errors.projects && (
            <p className="field-error m-0" role="alert">
              <span aria-hidden="true">! </span>
              {errors.projects}
            </p>
          )}
          <ProjectList
            projects={form.projects}
            errors={errors}
            onChange={(key, patch) => setProjects((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)))}
            onMove={(key, by) =>
              setProjects((ps) => {
                const i = ps.findIndex((p) => p.key === key);
                const j = i + by;
                if (i < 0 || j < 0 || j >= ps.length) return ps;
                const next = [...ps];
                [next[i], next[j]] = [next[j]!, next[i]!];
                return next;
              })
            }
            onRemove={(key) => setProjects((ps) => ps.filter((p) => p.key !== key))}
          />
          <ManualProjectForm disabled={form.projects.length >= LIMITS.projects} onAdd={(p) => setProjects((ps) => [...ps, p])} />
        </Panel>

        {mine.hasLiveCard && <MuseumPanel projects={mine.projects} />}

        <Panel label="Account">
          <h2 className="panel-title">Account</h2>
          <p className="m-0">
            Signed in as <span className="font-mono">{user.email}</span>
          </p>
          <div className="flex flex-wrap gap-space-2">
            <Link to="/settings" className="pixel-btn">
              Settings
            </Link>
            <button
              type="button"
              className="pixel-btn"
              onClick={() => (dirty ? setNotice({ text: 'Save your changes before signing out, or they’ll be lost.', bad: true }) : onSignOut())}
            >
              Sign out
            </button>
          </div>
        </Panel>

        <div className="editor-actions" data-at="bottom">
          {actionBar}
        </div>
      </div>

      {blocker.state === 'blocked' && (
        <div className="leave-sheet" role="alertdialog" aria-labelledby="leave-title" aria-describedby="leave-text">
          <div className="menu-panel max-w-[420px]">
            <h2 id="leave-title" className="panel-title">
              Leave without saving?
            </h2>
            <DialogueBox text="You have changes that aren’t saved yet. If you leave now, they’re gone." emote="attention" />
            <p id="leave-text" className="sr-only">
              You have unsaved changes.
            </p>
            <div className="flex flex-wrap gap-space-2">
              <button type="button" className="pixel-btn" data-variant="primary" onClick={() => blocker.reset()} autoFocus>
                Stay and keep editing
              </button>
              <button type="button" className="pixel-btn" onClick={() => blocker.proceed()}>
                Leave without saving
              </button>
            </div>
          </div>
        </div>
      )}
      {showQr && <QrFullscreen card={card} onClose={() => setShowQr(false)} />}
    </div>
  );
}
