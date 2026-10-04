// Photo for the badge window (FR-04). Resized to 512px WebP in the browser; uploaded on save.
// Without a photo the badge shows the generated pixel avatar.

import { useId, useState } from 'react';
import { AVATAR_MAX_PX, ImageProblem, toWebp } from '../../lib/image';

interface Props {
  hasPhoto: boolean;
  onPicked: (image: Blob) => void;
  onRemove: () => void;
}

export function PhotoField({ hasPhoto, onPicked, onRemove }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onPicked(await toWebp(file, AVATAR_MAX_PX));
    } catch (e) {
      setError(e instanceof ImageProblem ? e.message : 'That photo couldn’t be used. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field" data-field="photo">
      <span className="field-label" id={`${id}-label`}>
        Photo
      </span>
      <div className="flex flex-wrap items-center gap-space-2">
        <label htmlFor={id} className="pixel-btn cursor-pointer" aria-busy={busy}>
          {busy ? 'Resizing…' : hasPhoto ? 'Change photo' : 'Upload photo'}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-describedby={error ? `${id}-err` : `${id}-hint`}
          disabled={busy}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {hasPhoto && (
          <button type="button" className="pixel-btn" onClick={onRemove} disabled={busy}>
            Use pixel avatar instead
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      ) : (
        <p id={`${id}-hint`} className="field-hint">
          JPG, PNG or WebP up to 8 MB. It’s shrunk on your device before upload.
        </p>
      )}
    </div>
  );
}
