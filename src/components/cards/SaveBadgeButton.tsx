// "Save badge (PNG)": draws the approved badge in the browser and downloads it (D-104). The drawing
// code loads only on the first press. If it can't be drawn here, the server's copy is offered.

import { useState } from 'react';
import { badgePngUrl } from '../../lib/publicUrl';
import { useCards } from '../../lib/useCards';
import type { PublishedCardRow } from '../../types/card';

interface Props {
  /** The approved card; or a username, looked up among the hall's approved cards. */
  card?: PublishedCardRow;
  username?: string;
  label?: string;
}

export function SaveBadgeButton({ card, username, label = 'Save badge (PNG)' }: Props) {
  const cards = useCards();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  const row = card ?? (cards.status === 'ready' ? cards.cards.find((c) => c.username === username) : undefined);
  const server = row ? badgePngUrl(row.username) : null;
  if (!row || !server) return null; // only where the hall has its backend, and only for approved cards

  const save = async () => {
    setState('busy');
    try {
      const { saveBadge } = await import('../../services/badgeExportService');
      await saveBadge(row);
      setState('done');
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="grid justify-items-center gap-space-1">
      <button type="button" className="pixel-btn" disabled={state === 'busy'} onClick={() => void save()}>
        {state === 'busy' ? 'Drawing your badge…' : label}
      </button>
      {state === 'done' && (
        <p className="m-0 text-caption" role="status">
          ✓ Saved as pip-hall-{row.username}.png
        </p>
      )}
      {state === 'failed' && (
        <p className="notice notice-bad m-0" role="status">
          <span aria-hidden="true">! </span>
          Couldn’t draw it here.{' '}
          <a href={server} download={`pip-hall-${row.username}.png`} className="underline decoration-2">
            Try the server copy
          </a>
        </p>
      )}
    </div>
  );
}
