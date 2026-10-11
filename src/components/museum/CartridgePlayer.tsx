// Play the exhibit (V2-23, D-136): its cartridge waits beside the console, the screen off. Play slots
// it in (four steps, 240 ms), the screen boots (the PIXENDO wordmark blinks twice, 400 ms), then the
// title screen: the exhibit's picture, its title, "a game by" its makers, PRESS START, and the
// credits rolling. PRESS START opens the live project (else its code); Eject takes the cartridge out.
// Reduced motion: no slide, no blink, no roll. The title screen is drawn with real text; the same
// words are on the plaque, so screen readers get them once, there.

import { useEffect, useRef, useState } from 'react';
import { startLink } from '../../lib/cartridge';
import { useReducedMotion } from '../../lib/useReducedMotion';
import type { ConsoleKind } from '../../lib/sprites';
import type { PublicProject } from '../../types/card';
import { Cartridge } from './Cartridge';
import { ExhibitArt } from './ExhibitArt';

type Stage = 'out' | 'in' | 'boot' | 'title';

interface Props {
  project: PublicProject;
  console: ConsoleKind;
  featured?: boolean;
  /** The maker's member number (null for an archive exhibit). */
  memberNo: number | null;
  /** Everyone credited, owner first. */
  makers: readonly string[];
}

export function CartridgePlayer({ project, console: kind, featured, memberNo, makers }: Props) {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<Stage>('out');
  const timers = useRef<number[]>([]);
  const startRef = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false); // focus follows only what the visitor did, not the first render
  const clear = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  };
  useEffect(() => clear, []);
  useEffect(() => {
    if (!moved.current) return;
    if (stage === 'title') startRef.current?.focus();
    if (stage === 'out') playRef.current?.focus();
  }, [stage]);

  const play = () => {
    clear();
    moved.current = true;
    if (reduce) return setStage('title');
    setStage('in');
    timers.current.push(
      window.setTimeout(() => setStage('boot'), 240),
      window.setTimeout(() => setStage('title'), 640),
    );
  };
  const eject = () => {
    clear();
    moved.current = true;
    setStage('out');
  };

  const start = startLink(project);
  const power = stage === 'boot' ? 'boot' : stage === 'title' ? 'on' : 'off';
  const by = makers.length ? makers.join(' · ') : null;

  return (
    <div className="cart-player" data-stage={stage}>
      <ExhibitArt project={project} console={kind} featured={featured} eager power={power}>
        <div className="title-screen" aria-hidden="true" data-still={reduce || undefined}>
          <span className="ts-title">{project.title}</span>
          {by && <span className="ts-by">A GAME BY {by.toUpperCase()}</span>}
          <span className="ts-start">{start ? 'PRESS START' : 'NO LINK TO START'}</span>
          {makers.length > 0 && (
            <span className="ts-credits">
              <span>
                {['CREDITS', ...makers.map((m) => m.toUpperCase()), 'THANKS FOR PLAYING'].map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </span>
            </span>
          )}
        </div>
      </ExhibitArt>
      <div className="cart-dock">
        {stage === 'out' || stage === 'in' ? (
          <>
            <Cartridge project={project} memberNo={memberNo} inserting={stage === 'in'} onClick={stage === 'out' ? play : undefined} />
            <button ref={playRef} type="button" className="pixel-btn" data-variant="primary" disabled={stage === 'in'} onClick={play}>
              <span aria-hidden="true">▶ </span>Play<span className="sr-only"> {project.title}</span>
            </button>
          </>
        ) : (
          <div className="flex flex-wrap items-center gap-space-2">
            {start ? (
              <a ref={startRef} href={start.href} target="_blank" rel="noopener noreferrer" className="pixel-btn" data-variant="primary">
                PRESS START
                <span className="sr-only">
                   to open {project.title} ({start.what === 'live' ? 'the live project' : 'its code'}, in a new tab)
                </span>
              </a>
            ) : (
              <button ref={startRef} type="button" className="pixel-btn" disabled>
                Nothing to start yet
              </button>
            )}
            <button type="button" className="pixel-btn" onClick={eject}>
              Eject<span className="sr-only"> the cartridge</span>
            </button>
          </div>
        )}
        <p className="sr-only" role="status">
          {stage === 'title' ? `${project.title} is on. ${start ? 'Press START to open it.' : 'It has no link to open yet.'}` : ''}
        </p>
      </div>
    </div>
  );
}
