// Pip's text window (brief §7, §10): types at ~40 chars/s with a blinking ▼; a tap completes it.
// Screen readers get the whole line once through a polite live region, never letter by letter.

import { useEffect, useState, type ReactNode } from 'react';
import { SPR, WORLD_PALETTE } from '../../lib/sprites';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { SpriteCanvas } from '../pixel/SpriteCanvas';
import { Emote, type EmoteKind } from './Emote';

const CHARS_PER_TICK = 2;
const TICK_MS = 50; // 40 chars per second

interface Props {
  text: string;
  emote?: EmoteKind;
  /** Buttons shown next to the line, e.g. Retry on an error. */
  children?: ReactNode;
}

export function DialogueBox({ text, emote, children }: Props) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState({ text, shown: reduce ? text.length : 0 });

  // A new line restarts the typing (state derived from the prop, reset during render).
  let shown = typed.shown;
  if (typed.text !== text) {
    shown = reduce ? text.length : 0;
    setTyped({ text, shown });
  }

  useEffect(() => {
    if (reduce || shown >= text.length) return;
    const id = window.setTimeout(() => setTyped((t) => ({ ...t, shown: Math.min(t.text.length, t.shown + CHARS_PER_TICK) })), TICK_MS);
    return () => window.clearTimeout(id);
  }, [reduce, shown, text]);

  const done = shown >= text.length;
  return (
    <div className="dialogue" onClick={() => setTyped({ text, shown: text.length })}>
      <div className="dialogue-portrait" aria-hidden="true">
        <SpriteCanvas sprite={SPR.pipIdle} palette={WORLD_PALETTE} />
      </div>
      <div className="dialogue-body">
        {emote && <Emote kind={emote} />}
        <p className="dialogue-say" data-done={done} aria-hidden="true">
          {text.slice(0, shown)}
        </p>
        <p className="sr-only" aria-live="polite">
          {text}
        </p>
        {children}
      </div>
    </div>
  );
}
