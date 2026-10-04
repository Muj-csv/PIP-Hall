// Where the card stands in review (FR-07), said by Pip with a status emote (brief §10 StatusBadge).

import { DialogueBox } from '../dialogue/DialogueBox';
import type { StatusView } from '../../lib/editorModel';

export function StatusBanner({ view }: { view: StatusView }) {
  return (
    <div className="grid gap-space-2">
      <p className="m-0">
        <span className="status-tag" data-status={view.label}>
          {view.label}
        </span>
      </p>
      <DialogueBox text={view.text} emote={view.emote} />
    </div>
  );
}
