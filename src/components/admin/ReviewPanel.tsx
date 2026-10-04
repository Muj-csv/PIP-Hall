// One card under review (FR-08): the submitted draft beside the live card it would replace,
// and the admin's moves. Every move is an RPC that checks is_admin() in the database.

import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { memberPath } from '../../lib/publicUrl';
import { LIMITS, validateUsername } from '../../lib/validate';
import { adminErrorMessage, adminService, type ReviewItem } from '../../services/adminService';
import type { PublicCard } from '../../types/card';
import { FlipBadge } from '../cards/BadgeStage';
import { QrFullscreen } from '../cards/QrFullscreen';
import { TextArea, TextField } from '../editor/fields';
import { MemberAffiliations } from './AffiliationsManager';

type Done = (message: string) => void;

interface Shared {
  /** Called after a move succeeds: reload the queue and say what happened. */
  onDone: Done;
}

function useMove(onDone: Done) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (name: string, move: () => Promise<void>, success: string) => {
    setBusy(name);
    setError(null);
    try {
      await move();
      onDone(success);
    } catch (e) {
      setError(adminErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return { busy, error, run };
}

function MoveError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="notice notice-bad m-0" role="alert">
      <span aria-hidden="true">! </span>
      {error}
    </p>
  );
}

export function PendingReview({ item, onDone }: Shared & { item: ReviewItem }) {
  const { profile, draft, live } = item;
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | undefined>();
  const [qr, setQr] = useState<PublicCard | null>(null);
  const { busy, error, run } = useMove(onDone);
  const name = profile.full_name;

  const reject = (e: FormEvent) => {
    e.preventDefault();
    if (!note.trim()) {
      setNoteError('Write a note so the member knows what to change.');
      return;
    }
    if (note.length > LIMITS.review_note) {
      setNoteError(`Keep the note under ${LIMITS.review_note} characters.`);
      return;
    }
    setNoteError(undefined);
    void run('reject', () => adminService.reject(profile.id, note.trim()), `Sent ${name}’s card back with your note.`);
  };

  return (
    <section className="menu-panel" aria-labelledby="review-title">
      <h2 id="review-title" className="m-0 font-display text-h3 font-normal">
        Reviewing {name} <span className="text-text-secondary">@{profile.username}</span>
      </h2>
      <p className="m-0 text-caption text-text-secondary">
        {item.submittedAt ? `Submitted ${formatWhen(item.submittedAt)}. ` : ''}
        {live ? 'Already in the hall: approving replaces the live card.' : 'New card: approving gives it the next member number.'}
      </p>
      <div className="review-faces" data-count={live ? 2 : 1}>
        <FlipBadge card={draft} label="Submitted" onShowQr={() => setQr(draft)} />
        {live && <FlipBadge card={live} label="Live now" onShowQr={() => setQr(live)} />}
      </div>
      {draft.card.public_email && <p className="m-0 text-caption">Shows email publicly: {draft.card.public_email}</p>}
      <MoveError error={error} />
      <div className="review-actions">
        <button
          type="button"
          className="pixel-btn"
          data-variant="primary"
          disabled={busy !== null}
          onClick={() => void run('approve', () => adminService.approve(profile.id), `Approved ${name}. Their card is in the hall.`)}
        >
          {busy === 'approve' ? 'Approving…' : `Approve ${live ? 'changes' : 'card'}`}
        </button>
      </div>
      <form className="grid gap-space-2" onSubmit={reject} noValidate>
        <TextArea field="review_note" label="Note for the member (needed to reject)" value={note} onChange={setNote} error={noteError} max={LIMITS.review_note} hint="They see this on their card editor." />
        <button type="submit" className="pixel-btn justify-self-start" disabled={busy !== null}>
          {busy === 'reject' ? 'Sending…' : 'Reject with note'}
        </button>
      </form>
      <RenameForm id={profile.id} name={name} current={profile.username} onDone={onDone} />
      {qr && <QrFullscreen card={qr} onClose={() => setQr(null)} />}
    </section>
  );
}

export function PublishedReview({ card, onDone }: Shared & { card: PublicCard }) {
  const [confirming, setConfirming] = useState(false);
  const [qr, setQr] = useState(false);
  const { busy, error, run } = useMove(onDone);
  const c = card.card;
  const name = c.full_name;

  return (
    <section className="menu-panel" aria-labelledby="review-title">
      <h2 id="review-title" className="m-0 font-display text-h3 font-normal">
        {name} <span className="text-text-secondary">@{card.username} · No.{String(card.no).padStart(3, '0')}</span>
      </h2>
      <p className="m-0 text-caption text-text-secondary">In the hall since {formatWhen(card.published_at)}.</p>
      <div className="review-faces" data-count={1}>
        <FlipBadge card={card} label="Live now" onShowQr={() => setQr(true)} />
      </div>
      <MoveError error={error} />
      <div className="review-actions">
        <button
          type="button"
          className="pixel-btn"
          aria-pressed={card.is_featured}
          disabled={busy !== null}
          onClick={() =>
            void run(
              'feature',
              () => adminService.setFeatured(card.profile_id, !card.is_featured),
              card.is_featured ? `${name} is no longer featured.` : `${name} is featured. Their badge wears a star.`,
            )
          }
        >
          <span aria-hidden="true">{card.is_featured ? '★ ' : '☆ '}</span>
          Featured
        </button>
        <Link to={memberPath(card.username)} className="pixel-btn">
          Open page ▸
        </Link>
        {!confirming && (
          <button type="button" className="pixel-btn" disabled={busy !== null} onClick={() => setConfirming(true)}>
            Unpublish…
          </button>
        )}
      </div>
      {confirming && (
        <div className="notice notice-bad grid gap-space-2" role="group" aria-label="Confirm unpublish">
          <p className="m-0">
            Take {name}’s card out of the hall? Their page stops working until they resubmit and you approve again. Their member number stays theirs.
          </p>
          <div className="review-actions">
            <button
              type="button"
              className="pixel-btn"
              data-variant="primary"
              autoFocus
              disabled={busy !== null}
              onClick={() => void run('unpublish', () => adminService.unpublish(card.profile_id), `Unpublished ${name}.`)}
            >
              {busy === 'unpublish' ? 'Unpublishing…' : 'Yes, unpublish'}
            </button>
            <button type="button" className="pixel-btn" onClick={() => setConfirming(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
      <MemberAffiliations memberId={card.profile_id} name={name} onDone={onDone} />
      <RenameForm id={card.profile_id} name={name} current={card.username} onDone={onDone} />
      {qr && <QrFullscreen card={card} onClose={() => setQr(false)} />}
    </section>
  );
}

/** Usernames lock at approval; only an admin can change one (and the page URL and QR change with it). */
function RenameForm({ id, name, current, onDone }: Shared & { id: string; name: string; current: string }) {
  const [value, setValue] = useState(current);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const { busy, error, run } = useMove(onDone);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = value.trim().toLowerCase();
    const problem = validateUsername(next);
    if (problem) {
      setFieldError(next ? problem : 'Type the new username.');
      return;
    }
    setFieldError(undefined);
    if (next === current) return;
    void run('rename', () => adminService.rename(id, next), `${name} is now @${next}. Their old link and printed QR codes no longer work.`);
  };

  return (
    <details className="grid gap-space-2">
      <summary className="flex min-h-11 cursor-pointer items-center font-display tracking-[0.04em]">Change username</summary>
      <form className="grid gap-space-2 pt-space-2" onSubmit={submit} noValidate>
        <TextField
          field="username"
          label="Username"
          value={value}
          onChange={setValue}
          error={fieldError ?? error ?? undefined}
          hint="Changes the page address and the QR code. Printed QR codes stop working."
          max={LIMITS.username}
          autoComplete="off"
        />
        <button type="submit" className="pixel-btn justify-self-start" disabled={busy !== null || value.trim().toLowerCase() === current}>
          {busy === 'rename' ? 'Renaming…' : 'Rename'}
        </button>
      </form>
    </details>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'recently' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
