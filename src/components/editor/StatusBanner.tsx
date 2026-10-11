// Where the card stands in review (FR-07), said by Pip with a status emote (brief §10 StatusBadge).

import { DialogueBox } from '../dialogue/DialogueBox';
import type { StatusView } from '../../lib/editorModel';

export function StatusBanner({ view, compact = false }: { view: StatusView; compact?: boolean }) {
  return (
    <div className="grid gap-space-2">
      <p className="m-0">
        <span className="status-tag" data-status={view.label}>
          {view.label}
        </span>
      </p>
      {/* Beside the folded badge on phones (D-134) the same words, without Pip's box. */}
      {compact ? <p className="m-0 text-caption">{view.text}</p> : <DialogueBox text={view.text} emote={view.emote} />}
    </div>
  );
}
