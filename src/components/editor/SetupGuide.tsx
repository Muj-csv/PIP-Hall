// "Make your card" (D-078): a short quest at the top of My card. Each step says what to do, shows
// ✓ when it's done, and GO jumps to the field. First-time members get a welcome; once the card is
// live the guide folds away (and can be hidden or shown any time).

import { useState } from 'react';
import { guideProgress, jumpToField, type GuideStep } from '../../lib/setupGuide';
import { DialogueBox } from '../dialogue/DialogueBox';

const HIDE_KEY = 'piphall-guide-hidden';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

export function SetupGuide({ steps, firstTime }: { steps: GuideStep[]; firstTime: boolean }) {
  const p = guideProgress(steps);
  const complete = p.done === p.total;
  const [hidden, setHidden] = useState(() => readHidden() && !firstTime);
  const toggle = () =>
    setHidden((h) => {
      try {
        localStorage.setItem(HIDE_KEY, h ? '0' : '1');
      } catch {
        // storage blocked: the choice lasts for this visit
      }
      return !h;
    });

  const line = firstTime
    ? 'Welcome to PIP-Hall! Make your badge in a few steps. When you send it, an admin checks it, and then it hangs in the hall for everyone to flip.'
    : complete
      ? 'Your card is complete. Nice work!'
      : p.next
        ? `Next up: ${p.next.title.toLowerCase()}. ${p.next.hint}`
        : '';

  return (
    <section className="menu-panel setup-guide" aria-labelledby="guide-title">
      <div className="flex flex-wrap items-center justify-between gap-space-2">
        <h2 id="guide-title" className="panel-title m-0">
          Make your card
        </h2>
        <button type="button" className="pixel-btn" aria-expanded={!hidden} aria-controls="guide-steps" onClick={toggle}>
          {hidden ? 'Show guide' : 'Hide guide'}
        </button>
      </div>
      <div className="guide-progress" role="progressbar" aria-label="Card setup" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} aria-valuetext={`${p.done} of ${p.total} steps done`}>
        {steps.map((s) => (
          <i key={s.key} data-done={s.done} />
        ))}
      </div>
      <p className="m-0 font-display tracking-[0.04em]">
        {p.done} of {p.total} steps done{p.ready && !complete ? ' · ready to send' : ''}
      </p>
      {!hidden && (
        <div id="guide-steps" className="grid gap-space-3">
          {line && <DialogueBox text={line} emote={complete ? 'approved' : undefined} />}
          <ol className="guide-steps">
            {steps.map((s, i) => (
              <li key={s.key} data-done={s.done} aria-current={p.next?.key === s.key ? 'step' : undefined}>
                <span className="guide-mark" aria-hidden="true">
                  {s.done ? '✓' : i + 1}
                </span>
                <span className="grid gap-[2px]">
                  <b>
                    {s.title}
                    {s.optional && <span className="text-caption text-text-secondary"> (optional)</span>}
                  </b>
                  <span className="text-caption text-text-secondary">{s.hint}</span>
                  <span className="sr-only">{s.done ? 'Done.' : 'Not done yet.'}</span>
                </span>
                {!s.done && (
                  <button type="button" className="pixel-btn guide-go" onClick={() => jumpToField(s.field)}>
                    Go<span className="sr-only"> to {s.title.toLowerCase()}</span>
                  </button>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
