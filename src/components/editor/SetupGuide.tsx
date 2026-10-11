// "Make your card" (D-078, D-134): a first card is made in three steps, Info → Projects → Send it.
// Each step says what's still missing, shows ✓ when it's done, and GO opens its tab at the field.
// First-time members get a welcome; once the card is live the guide is gone (and it can be hidden
// or shown any time before).

import { useState } from 'react';
import { guideStages, type GuideStage, type GuideStep } from '../../lib/setupGuide';
import { DialogueBox } from '../dialogue/DialogueBox';

const HIDE_KEY = 'piphall-guide-hidden';

function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDE_KEY) === '1';
  } catch {
    return false;
  }
}

const list = (steps: GuideStep[]) => steps.map((s) => s.short).join(', ');

export function SetupGuide({ steps, firstTime, onGo }: { steps: GuideStep[]; firstTime: boolean; onGo: (stage: GuideStage) => void }) {
  const stages = guideStages(steps);
  const done = stages.filter((g) => g.done).length;
  const next = stages.find((g) => !g.done) ?? null;
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
    ? 'Welcome to PIP-Hall! Make your badge in three steps: Info, Projects, then send it. An admin checks it, and then it hangs in the hall for everyone to flip.'
    : !next
      ? 'Sent! An admin will check your card.'
      : next.key === 'submit'
        ? `Last step: ${next.title.toLowerCase()}. ${next.hint}`
        : `Next up: ${next.title}. Still to add: ${list(next.todo)}.`;

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
      <div className="guide-progress" role="progressbar" aria-label="Card setup" aria-valuemin={0} aria-valuemax={stages.length} aria-valuenow={done} aria-valuetext={`${done} of ${stages.length} steps done`}>
        {stages.map((g) => (
          <i key={g.key} data-done={g.done} />
        ))}
      </div>
      <p className="m-0 font-display tracking-[0.04em]">
        {done} of {stages.length} steps done{next?.key === 'submit' ? ' · ready to send' : ''}
      </p>
      {!hidden && (
        <div id="guide-steps" className="grid gap-space-3">
          <DialogueBox text={line} emote={next ? undefined : 'approved'} />
          <ol className="guide-steps">
            {stages.map((g, i) => (
              <li key={g.key} data-done={g.done} aria-current={next?.key === g.key ? 'step' : undefined}>
                <span className="guide-mark" aria-hidden="true">
                  {g.done ? '✓' : i + 1}
                </span>
                <span className="grid gap-[2px]">
                  <b>{g.title}</b>
                  <span className="text-caption text-text-secondary">
                    {g.key === 'submit' ? g.hint : g.done ? 'Done.' : `Still to add: ${list(g.todo)}.`}
                    {g.key !== 'submit' && g.extra.length > 0 && ` Optional: ${list(g.extra)}.`}
                  </span>
                  <span className="sr-only">{g.done ? 'Done.' : 'Not done yet.'}</span>
                </span>
                {!g.done && (
                  <button type="button" className="pixel-btn guide-go" onClick={() => onGo(g)}>
                    Go<span className="sr-only"> to {g.title.toLowerCase()}</span>
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
