// Lets a member choose which part of their photo shows in the badge window.
// Drag (or arrow keys) to move, pinch / scroll / slider (or + and -) to zoom.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { MAX_ZOOM, PHOTO_ASPECT, initialCrop, moveCrop, outputSize, zoomCrop, zoomOf, type Crop } from '../../lib/crop';
import { ImageProblem, cropImage, type DecodedImage } from '../../lib/image';

interface Props {
  /** Object URL of the picked file, for showing it while cropping. */
  url: string;
  decoded: DecodedImage;
  onDone: (image: Blob) => void;
  onCancel: () => void;
}

export function PhotoCropper({ url, decoded, onDone, onCancel }: Props) {
  const id = useId();
  const { width: iw, height: ih } = decoded;
  const [crop, setCrop] = useState<Crop>(() => initialCrop(iw, ih, PHOTO_ASPECT));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const zoom = zoomOf(crop, iw, ih, PHOTO_ASPECT);

  useEffect(() => frame.current?.focus(), []);

  // Scroll to zoom. Added by hand because React's wheel listener can't stop the page scrolling.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setCrop((c) => zoomCrop(c, iw, ih, PHOTO_ASPECT, zoomOf(c, iw, ih, PHOTO_ASPECT) * Math.exp(-e.deltaY * 0.002)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [iw, ih]);

  // Screen pixels to photo pixels, at the current zoom.
  const toSource = (c: Crop) => c.w / (frame.current?.getBoundingClientRect().width || 1);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const others = [...map.entries()].filter(([pid]) => pid !== e.pointerId).map(([, p]) => p);
    map.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (others.length === 0) {
      setCrop((c) => moveCrop(c, iw, ih, -(e.clientX - prev.x) * toSource(c), -(e.clientY - prev.y) * toSource(c)));
    } else {
      // Two fingers: zoom by how much the gap between them changed.
      const o = others[0]!;
      const before = Math.hypot(prev.x - o.x, prev.y - o.y);
      const after = Math.hypot(e.clientX - o.x, e.clientY - o.y);
      if (before > 0) setCrop((c) => zoomCrop(c, iw, ih, PHOTO_ASPECT, zoomOf(c, iw, ih, PHOTO_ASPECT) * (after / before)));
    }
  };

  const onPointerEnd = (e: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(e.pointerId);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = (c: Crop) => c.w * (e.shiftKey ? 0.2 : 0.05);
    const moves: Record<string, (c: Crop) => [number, number]> = {
      ArrowLeft: (c) => [-step(c), 0],
      ArrowRight: (c) => [step(c), 0],
      ArrowUp: (c) => [0, -step(c)],
      ArrowDown: (c) => [0, step(c)],
    };
    const move = moves[e.key];
    if (move) {
      e.preventDefault();
      setCrop((c) => moveCrop(c, iw, ih, ...move(c)));
    } else if (e.key === '+' || e.key === '=' || e.key === '-') {
      e.preventDefault();
      const by = e.key === '-' ? -0.25 : 0.25;
      setCrop((c) => zoomCrop(c, iw, ih, PHOTO_ASPECT, zoomOf(c, iw, ih, PHOTO_ASPECT) + by));
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      onDone(await cropImage(decoded, crop, outputSize(crop, PHOTO_ASPECT)));
    } catch (e) {
      setError(e instanceof ImageProblem ? e.message : 'That photo couldn’t be saved. Try another one.');
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-space-2" role="group" aria-labelledby={`${id}-title`}>
      <p id={`${id}-title`} className="m-0 font-display">
        Choose what shows on your badge
      </p>
      <div
        ref={frame}
        className="crop-frame"
        tabIndex={0}
        role="application"
        aria-roledescription="crop area"
        aria-label="Photo crop. Drag or use the arrow keys to move it, plus and minus to zoom."
        aria-describedby={`${id}-hint`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <img
          src={url}
          alt=""
          draggable={false}
          style={{
            width: `${(iw / crop.w) * 100}%`,
            height: `${(ih / crop.h) * 100}%`,
            left: `${(-crop.x / crop.w) * 100}%`,
            top: `${(-crop.y / crop.h) * 100}%`,
          }}
        />
      </div>
      <p id={`${id}-hint`} className="field-hint m-0">
        Drag to move the photo. Pinch, scroll or use the slider to zoom.
      </p>
      <label className="grid gap-space-1">
        <span className="field-label">Zoom</span>
        <input
          type="range"
          className="crop-zoom"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={zoom}
          aria-valuetext={`${zoom.toFixed(1)} times`}
          onChange={(e) => setCrop((c) => zoomCrop(c, iw, ih, PHOTO_ASPECT, Number(e.target.value)))}
        />
      </label>
      {error && (
        <p className="field-error" role="alert">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-space-2">
        <button type="button" className="pixel-btn" data-variant="primary" onClick={save} disabled={busy} aria-busy={busy}>
          {busy ? 'Saving…' : 'Use this photo'}
        </button>
        <button type="button" className="pixel-btn" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}
