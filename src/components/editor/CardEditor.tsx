// The card editor (Phase 3, FR-03..FR-07; V2-21, D-134): the live badge stays in view with Flip,
// Save, Submit and the card's status; beside it four tabs: Info (what you say about yourself),
// Projects (your Quest Log), Customize (how your badge looks) and Account. A first card gets a
// three-step guide and Next buttons. The tab is in the address (?tab=). Every tab stays mounted and
// only hides while another is open, so nothing typed is lost by switching. Save is explicit (button
// or Ctrl/Cmd+S); leaving with unsaved changes asks first. Every rule is checked again by the
// database on save.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useBlocker, useSearchParams } from 'react-router';
import { formFrom, previewCard } from '../../lib/editorModel';
import { focusFirstError } from '../../lib/focusFirstError';
import { LIMITS, validateCard, type FieldErrors } from '../../lib/validate';
import { describeAuthError } from '../../services/authErrors';
import type { AuthUser } from '../../services/authService';
import { githubService, refreshProject, repoToProject, type GithubRepo } from '../../services/githubService';
import { profileService, saveErrorMessage } from '../../services/profileService';
import { publicImageUrl } from '../../services/storageService';
import { SaveBadgeButton } from '../cards/SaveBadgeButton';
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
import { CollaboratorsPanel } from './CollaboratorsPanel';
import { ProjectList } from './ProjectList';
import { RepoPicker } from './RepoPicker';
import { SkillsInput } from './SkillsInput';
import { StatusBanner } from './StatusBanner';
import { SetupGuide } from './SetupGuide';
import { guideStages, jumpToField, setupSteps } from '../../lib/setupGuide';
import { statusView } from '../../lib/editorModel';
import { EDITOR_TABS, TAB_LABEL, errorsByTab, tabFrom, type EditorTab } from '../../lib/editorTabs';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { CustomizePanel } from './CustomizePanel';

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
  const [newCovers, setNewCovers] = useState<Record<string, Blob>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState<'save' | 'submit' | 'github' | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [showQr, setShowQr] = useState(false);
  /** Phones and tablets: the badge folds into a small preview above the tabs until asked for (D-134). */
  const wide = useMediaQuery('(min-width: 1024px)');
  const [badgeOpen, setBadgeOpen] = useState(false);

  // ---- the tabs (D-134): in the address, so the Mart and the bell can link straight to one.
  const [params, setParams] = useSearchParams();
  const tab = tabFrom(params.get('tab'));
  /** Customize asks the Mart only once it has been opened. */
  const [customizeSeen, setCustomizeSeen] = useState(tab === 'customize');
  const goTab = useCallback(
    (t: EditorTab, focusTab = false) => {
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (t === 'info') next.delete('tab');
          else next.set('tab', t);
          return next;
        },
        { replace: true },
      );
      if (t === 'customize') setCustomizeSeen(true);
      if (focusTab) document.getElementById(`card-tab-${t}`)?.focus();
    },
    [setParams],
  );
  // Moving focus into a tab (the first error after a failed save, a guide step's field) waits until
  // that tab is showing: hidden fields can't take focus.
  const [focusLater, setFocusLater] = useState<{ n: number; tab: EditorTab | null; run: () => void } | null>(null);
  const focused = useRef(0);
  const whenShowing = (t: EditorTab | null, run: () => void) => setFocusLater((r) => ({ n: (r?.n ?? 0) + 1, tab: t, run }));
  useEffect(() => {
    if (!focusLater || focusLater.n === focused.current || (focusLater.tab && focusLater.tab !== tab)) return;
    focused.current = focusLater.n;
    focusLater.run();
  }, [focusLater, tab]);

  const dirty = newPhoto !== null || Object.keys(newCovers).length > 0 || JSON.stringify(form) !== JSON.stringify(baseline);
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

  // Screen pictures (D-092): a new pick shows from memory, a saved one from Storage.
  const newCoverUrls = useMemo(() => Object.fromEntries(Object.entries(newCovers).map(([k, b]) => [k, URL.createObjectURL(b)])), [newCovers]);
  useEffect(() => () => Object.values(newCoverUrls).forEach((u) => URL.revokeObjectURL(u)), [newCoverUrls]);
  const coverUrls = useMemo(
    () => Object.fromEntries(form.projects.map((p) => [p.key, newCoverUrls[p.key] ?? publicImageUrl('project-covers', p.cover_path)])),
    [form.projects, newCoverUrls],
  );
  const setCover = (key: string, image: Blob | null) => {
    setNewCovers((c) => {
      const next = { ...c };
      if (image) next[key] = image;
      else delete next[key];
      return next;
    });
    if (!image) setProjects((ps) => ps.map((p) => (p.key === key ? { ...p, cover_path: null } : p)));
    setNotice(null);
  };

  const card = useMemo(() => previewCard(form, mine, user), [form, mine, user]);
  const guide = setupSteps({
    username: form.username,
    fullName: form.full_name,
    role: form.role,
    bio: form.bio,
    hasPhoto: newPhoto !== null || form.avatar_path !== null,
    githubHandle: handle ?? null,
    projects: form.projects.length,
    skills: form.skills.length,
    status: mine.profile?.status ?? null,
    hasLiveCard: mine.hasLiveCard,
  });
  const view = statusView(mine.profile?.status ?? null, { hasLiveCard: mine.hasLiveCard, reviewNote: mine.profile?.review_note ?? null, dirty });

  const save = useCallback(async (): Promise<MyCard | null> => {
    const e = validateCard(form, { usernameLocked: locked });
    setErrors(e);
    if (Object.keys(e).length) {
      // Submit opens the first tab with a problem (D-134).
      const first: EditorTab = errorsByTab(e).info > 0 ? 'info' : 'projects';
      setNotice({ text: `A few fields need a look. They’re marked with ! in ${TAB_LABEL[first]}.`, bad: true });
      goTab(first);
      whenShowing(first, () => focusFirstError(document.getElementById(`card-panel-${first}`), e));
      return null;
    }
    try {
      const covers = Object.fromEntries(Object.entries(newCovers).filter(([k]) => form.projects.some((p) => p.key === k)));
      let saved = await profileService.save(user.id, form, mine, newPhoto, covers);
      if (user.githubHandle && !saved.profile?.github_username) {
        await githubService.sync(); // copy the verified handle onto the new profile row
        saved = await profileService.getMine(user.id);
      }
      const next = formFrom(saved, user);
      setMine(saved);
      setBaseline(next);
      setFormState(next);
      setNewPhoto(null);
      setNewCovers({});
      return saved;
    } catch (err) {
      setNotice({ text: saveErrorMessage(err), bad: true });
      return null;
    }
  }, [form, locked, mine, newPhoto, newCovers, user, goTab]);

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
      await githubService.connect('/edit?tab=projects'); // leaves the page, and comes back to this tab
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

  // What each tab still needs, in words, never by colour alone: how many fields to fix, or (on a
  // first card) a ✓ once its required fields are done.
  const firstCard = !mine.hasLiveCard;
  const stages = guideStages(guide);
  const done: Partial<Record<EditorTab, boolean>> = firstCard ? { info: stages[0]!.done, projects: stages[1]!.done } : {};
  const toFix = errorsByTab(errors);
  const onTabKey = (e: ReactKeyboardEvent) => {
    const i = EDITOR_TABS.indexOf(tab);
    const n = EDITOR_TABS.length;
    const to = { ArrowRight: EDITOR_TABS[(i + 1) % n], ArrowLeft: EDITOR_TABS[(i + n - 1) % n], Home: EDITOR_TABS[0], End: EDITOR_TABS[n - 1] }[e.key];
    if (!to) return;
    e.preventDefault();
    goTab(to, true);
  };
  const panel = (t: EditorTab) => ({ id: `card-panel-${t}`, role: 'tabpanel', 'aria-labelledby': `card-tab-${t}`, hidden: tab !== t, className: 'grid gap-space-4' });
  // A first card's Next buttons (D-134): Info → Projects → the Submit button.
  const nextButton = (to: EditorTab | null, label: string) =>
    firstCard &&
    (to !== null || view.submit) && (
      <div className="editor-next">
        <button type="button" className="pixel-btn" onClick={() => (to ? goTab(to, true) : jumpToField(null))}>
          {label} <span aria-hidden="true">▶</span>
        </button>
      </div>
    );

  return (
    <div className="editor-grid">
      <aside className="editor-side" aria-label="Your card">
        {wide || badgeOpen ? (
          <>
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
            <div className="flex flex-wrap justify-center gap-space-2">
              <button type="button" className="pixel-btn" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                {flipped ? 'Show front' : 'Show Quest Log'}
              </button>
              {!wide && (
                <button type="button" className="pixel-btn" aria-expanded onClick={() => setBadgeOpen(false)}>
                  Fold my badge
                </button>
              )}
            </div>
            {mine.hasLiveCard && mine.profile && <SaveBadgeButton username={mine.profile.username} label="Save my badge (as approved)" />}
            <StatusBanner view={view} />
          </>
        ) : (
          // Phones and tablets: a small badge beside the status; tap it (or the button) for the big one.
          <div className="badge-mini">
            <div className="badge-mini-art" aria-hidden="true" inert onClick={() => setBadgeOpen(true)}>
              <div className="flipper">
                <MemberCard card={card} flipped={false} focusable={false} onActivate={() => setBadgeOpen(true)} onShowQr={() => setBadgeOpen(true)} photoUrl={photoUrl} />
              </div>
            </div>
            <div className="grid gap-space-2 content-center">
              <StatusBanner view={view} compact />
              <button type="button" className="pixel-btn justify-self-start" aria-expanded={false} onClick={() => setBadgeOpen(true)}>
                Show my badge
              </button>
            </div>
          </div>
        )}
        <div className="editor-actions" data-at="side">
          {actionBar}
        </div>
      </aside>

      <div className="grid gap-space-4 min-w-0">
        {firstCard && (
          <SetupGuide
            steps={guide}
            firstTime={mine.profile === null}
            onGo={(stage) => {
              const t = stage.key === 'submit' ? null : stage.key;
              if (t) goTab(t);
              // Nothing to type into there (e.g. Connect GitHub waits for a save)? Then the tab itself.
              whenShowing(t, () => jumpToField(stage.field) || (t && document.getElementById(`card-tab-${t}`)?.focus()));
            }}
          />
        )}

        <div role="tablist" aria-label="My card" className="tabs editor-tabs" onKeyDown={onTabKey}>
          {EDITOR_TABS.map((t) => (
            <button
              key={t}
              id={`card-tab-${t}`}
              type="button"
              role="tab"
              className="pixel-btn tab"
              aria-selected={tab === t}
              aria-controls={`card-panel-${t}`}
              tabIndex={tab === t ? 0 : -1}
              onClick={() => goTab(t)}
            >
              {TAB_LABEL[t]}
              {toFix[t] > 0 ? (
                <span className="tab-note">
                  {' '}
                  · {toFix[t]} to fix
                </span>
              ) : (
                done[t] && (
                  <>
                    <span aria-hidden="true"> ✓</span>
                    <span className="sr-only"> (done)</span>
                  </>
                )
              )}
            </button>
          ))}
        </div>

        <div {...panel('info')}>
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
          {nextButton('projects', 'Next: Projects')}
        </div>

        <div {...panel('projects')}>
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
              coverUrls={coverUrls}
              onCover={setCover}
            />
            <ManualProjectForm disabled={form.projects.length >= LIMITS.projects} onAdd={(p) => setProjects((ps) => [...ps, p])} />
          </Panel>

          {mine.profile && <CollaboratorsPanel projects={form.projects} myId={user.id} />}

          {mine.hasLiveCard && <MuseumPanel />}
          {nextButton(null, 'Next: send it for review')}
        </div>

        <div {...panel('customize')}>{(customizeSeen || tab === 'customize') && <CustomizePanel live={mine.hasLiveCard} />}</div>

        <div {...panel('account')}>
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
        </div>

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
