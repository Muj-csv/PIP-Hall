// The PIXENDO handheld (brief §14, D-022): a two-grip slab. MOVE rocker on the left grip; FLIP,
// OPEN and the DAY/NIGHT switch on the right. On phones the grips fold into one row under the screen.

import type { ReactNode } from 'react';
import { useTheme } from '../../app/themeContext';
import { useOnline } from '../../lib/useOnline';

interface Props {
  screen: ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onFlip: () => void;
  onOpen: () => void;
  /** OPEN becomes BACK while a menu screen is showing. */
  openLabel: 'OPEN' | 'BACK';
  /** Disable the level controls (loading, empty or error). */
  controlsDisabled: boolean;
  ledBlink: boolean;
  /** The walkable Museum (V2-11) moves between exhibits and opens its map with the action button. */
  moveLabels?: { group: string; prev: string; next: string };
  flipLabel?: string;
}

const PLAYERS = { group: 'Move between players', prev: 'Previous player', next: 'Next player' };

export function HandheldShell({ screen, onPrev, onNext, onFlip, onOpen, openLabel, controlsDisabled, ledBlink, moveLabels = PLAYERS, flipLabel = 'FLIP' }: Props) {
  const online = useOnline();
  const { theme, toggle } = useTheme();
  const night = theme === 'dark';
  return (
    <div className="device-outer">
      <div className="device step16">
        <i className="screw" data-at="a" aria-hidden="true" />
        <i className="screw" data-at="b" aria-hidden="true" />
        <i className="screw" data-at="c" aria-hidden="true" />
        <i className="screw" data-at="d" aria-hidden="true" />

        <div className="grip" data-side="left">
          <span className="grip-label" aria-hidden="true">
            MOVE
          </span>
          <div className="rocker" role="group" aria-label={moveLabels.group}>
            <button type="button" className="hw-btn" onClick={onPrev} disabled={controlsDisabled} aria-label={moveLabels.prev}>
              ◀
            </button>
            <button type="button" className="hw-btn" onClick={onNext} disabled={controlsDisabled} aria-label={moveLabels.next}>
              ▶
            </button>
          </div>
          <Grille />
        </div>

        <div className="device-mid">
          <div className="bezel step16">
            {screen}
            <div className="bezel-print">
              <span>
                <span className="led" data-online={online} data-blink={ledBlink} role="img" aria-label={online ? 'Online' : 'Offline'} />
                POWER
              </span>
              <span aria-hidden="true">PEOPLE · IDENTITY · PROJECTS</span>
            </div>
          </div>
          <div className="wordmark" aria-hidden="true">
            PIXENDO
          </div>
        </div>

        <div className="grip" data-side="right">
          <span className="grip-label" aria-hidden="true">
            ACTION
          </span>
          <div className="hw-btns">
            <button type="button" className="hw-btn" data-variant="flip" onClick={onFlip} disabled={controlsDisabled || openLabel === 'BACK'}>
              {flipLabel}
            </button>
            <button type="button" className="hw-btn" onClick={onOpen} disabled={controlsDisabled}>
              {openLabel}
            </button>
            <button type="button" className="hw-btn" data-variant="small" onClick={toggle} aria-label={night ? 'Night world. Switch to day' : 'Day world. Switch to night'}>
              {night ? 'NIGHT' : 'DAY'}
            </button>
          </div>
          <Grille />
        </div>
      </div>
    </div>
  );
}

function Grille() {
  return (
    <div className="grille" aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
