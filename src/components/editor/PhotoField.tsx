// Photo for the badge window (FR-04). The member crops it to the window's shape, then it's saved
// as WebP (JPEG on Safari) in the browser and uploaded on save.
// Without a photo the badge shows the generated pixel avatar.

import { useEffect, useId, useState } from 'react';
import { ImageProblem, decodeImage, type DecodedImage } from '../../lib/image';
import { PhotoCropper } from './PhotoCropper';

interface Props {
  hasPhoto: boolean;
  onPicked: (image: Blob) => void;
  onRemove: () => void;
}

export function PhotoField({ hasPhoto, onPicked, onRemove }: Props) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropping, setCropping] = useState<{ url: string; decoded: DecodedImage } | null>(null);

  // Free the photo when the cropper closes or the editor goes away.
  useEffect(
    () => () => {
      if (!cropping) return;
      cropping.decoded.done();
      URL.revokeObjectURL(cropping.url);
    },
    [cropping],
  );

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const decoded = await decodeImage(file);
      setCropping({ url: URL.createObjectURL(file), decoded });
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
      {cropping ? (
        <PhotoCropper
          url={cropping.url}
          decoded={cropping.decoded}
          onDone={(image) => {
            onPicked(image);
            setCropping(null);
          }}
          onCancel={() => setCropping(null)}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-space-2">
            <label htmlFor={id} className="pixel-btn cursor-pointer" aria-busy={busy}>
              {busy ? 'Opening…' : hasPhoto ? 'Change photo' : 'Upload photo'}
            </label>
            <input
              id={id}
              type="file"
              accept="image/*" // plain image/* makes phones offer the gallery and the camera
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
              From your gallery or camera, up to 20 MB. You’ll choose which part shows on your badge.
            </p>
          )}
        </>
      )}
    </div>
  );
}
