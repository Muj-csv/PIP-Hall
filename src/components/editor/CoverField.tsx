// A project's screen picture (D-092): a screenshot of the app, shown on its console's screen in the
// Museum. It's scaled down in the browser and uploaded on save, like the badge photo; it goes public
// with the card's next approval. Without one, the screen shows GitHub's preview of the repo, or a
// drawn pixel cover.

import { useId, useState } from 'react';
import { COVER_MAX_PX, ImageProblem, checkImageFile, shrinkImage } from '../../lib/image';

interface Props {
  title: string;
  /** What shows now: the new pick, else the saved picture, else null. */
  previewUrl: string | null;
  onPicked: (image: Blob) => void;
  onRemove: () => void;
  /** Overrides the member-facing hint (Admin → Archive uses its own). */
  hint?: string;
}

export function CoverField({ title, previewUrl, onPicked, onRemove, hint }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      checkImageFile(file);
      onPicked(await shrinkImage(file, COVER_MAX_PX));
    } catch (e) {
      setError(e instanceof ImageProblem ? e.message : 'That picture couldn’t be used. Try another one.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field cover-field">
      <span className="field-label" id={`${id}-label`}>
        Screen picture (optional)
      </span>
      <div className="flex flex-wrap items-center gap-space-2">
        {previewUrl ? (
          <img src={previewUrl} alt={`Screen picture for ${title || 'this project'}`} className="cover-thumb" />
        ) : (
          <span className="cover-thumb cover-thumb-empty" aria-hidden="true" />
        )}
        <label className="pixel-btn cursor-pointer" htmlFor={`${id}-file`} aria-busy={busy}>
          {previewUrl ? 'Change picture' : 'Upload a screenshot'}
          <span className="sr-only"> for {title || 'this project'}</span>
        </label>
        <input
          id={`${id}-file`}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          aria-describedby={`${id}-hint`}
          onChange={(e) => {
            void pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        {previewUrl && (
          <button type="button" className="pixel-btn" onClick={onRemove}>
            Remove<span className="sr-only"> screen picture for {title || 'this project'}</span>
          </button>
        )}
      </div>
      <p id={`${id}-hint`} className="m-0 field-hint">
        {hint ?? 'Upload a screenshot to show your app on the console screen in the Museum. Without one, a GitHub repo shows GitHub’s preview of it.'}
      </p>
      {busy && <p className="m-0 field-hint" role="status">Getting the picture ready…</p>}
      {error && (
        <p className="m-0 field-error" role="alert">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </div>
  );
}
