// The PIP MART unboxing (D-080): a bought frame arrives with a flash and Pip cheering, and the
// choice to wear it now. A native modal dialog, so focus stays inside and Esc closes it.

import { useEffect, useRef } from 'react';
import { FRAME_DOODLES, SPR, WORLD_PALETTE } from '../../lib/sprites';
import type { MartItem } from '../../types/mart';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

interface Props {
  item: MartItem;
  busy: boolean;
  onWear: () => void;
  onClose: () => void;
}

export function Unbox({ item, busy, onWear, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);
  const doodle = FRAME_DOODLES[item.key];
  return (
    <dialog
      ref={ref}
      className="unbox"
      aria-labelledby="unbox-title"
      aria-describedby="unbox-text"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="unbox-flash" aria-hidden="true" />
      <div className="unbox-prize" aria-hidden="true">
        {doodle && <SpriteCanvas sprite={doodle.sprite} palette={doodle.palette} className="unbox-doodle" />}
        <SpriteCanvas sprite={SPR.pipJump} palette={WORLD_PALETTE} className="unbox-pip" />
      </div>
      <h2 id="unbox-title" className="m-0 font-display text-h2 font-normal tracking-[0.06em]">
        NEW FRAME!
      </h2>
      <p id="unbox-text" className="m-0">
        The {item.name} is yours to keep. Wear it now, or any time from the Mart.
      </p>
      <div className="flex flex-wrap justify-center gap-space-2">
        <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={onWear} autoFocus>
          Wear it now
        </button>
        <button type="button" className="pixel-btn" onClick={onClose}>
          Later
        </button>
      </div>
    </dialog>
  );
}
