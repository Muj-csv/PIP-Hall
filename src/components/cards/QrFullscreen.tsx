// "SCAN ME" sheet (FR-12): a QR at full size, for a card or for the whole hall (D-088). A modal
// dialog: Esc or CLOSE dismisses it and focus returns to whatever opened it.

import { useEffect, useRef, useState } from 'react';
import { memberUrl } from '../../lib/publicUrl';
import type { PublicCard } from '../../types/card';
import { QrCode } from './QrCode';

export function QrFullscreen({ card, onClose }: { card: PublicCard; onClose: () => void }) {
  return <QrSheet url={memberUrl(card.username)} heading="SCAN ME" codeTitle={`QR code for ${card.card.full_name}'s page`} onClose={onClose} />;
}

interface SheetProps {
  url: string;
  heading: string;
  /** What the code is, for screen readers. */
  codeTitle: string;
  /** A line under the heading, e.g. what scanning does. */
  lead?: string;
  onClose: () => void;
}

export function QrSheet({ url, heading, codeTitle, lead, onClose }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Who opened the sheet, read once during the first render (before showModal moves focus).
  const [opener] = useState(() => document.activeElement as HTMLElement | null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      // After the dialog's own focus restoration has run.
      window.setTimeout(() => opener?.focus(), 0);
    };
  }, [opener]);

  return (
    <dialog
      ref={ref}
      className="qr-sheet"
      aria-labelledby="qr-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="qr-sheet-panel">
        <h2 id="qr-title">{heading}</h2>
        {lead && <p className="m-0 text-center">{lead}</p>}
        <div className="qr-sheet-code">
          <QrCode value={url} title={codeTitle} />
        </div>
        <p className="m-0 text-center font-mono text-caption break-all">{url}</p>
        <p className="m-0 text-center text-caption">Turn your screen brightness up so the camera reads it.</p>
        <button type="button" className="pixel-btn" data-variant="primary" onClick={onClose} autoFocus>
          CLOSE
        </button>
      </div>
    </dialog>
  );
}
