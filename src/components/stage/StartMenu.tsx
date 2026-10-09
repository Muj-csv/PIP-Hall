// The device's START menu (V2-15, D-107, D-126): the places and tools that used to crowd the page
// above the device, one press away inside it. Each item is a plain button or link with a line on
// what it does, so the menu reads the same to a screen reader; BACK or Esc returns to the hall.

import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { useTheme } from '../../app/themeContext';
import { SPR, WORLD_OVERRIDES, WORLD_PALETTE } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

export const START_MENU_ID = 'start-menu';

interface Props {
  onBack: () => void;
  onRandom: () => void;
  onPassport: () => void;
  /** Stamps in the Passport so far. */
  stamps: number;
  /** There are current officers (D-123), and whether the hall shows only them. */
  officers: boolean;
  officersOn: boolean;
  onOfficers: () => void;
  /** The map of the hall is open (V2-8). */
  mapOpen: boolean;
  /** A signed-in member, with PIPs switched on: the PIP MART. */
  mart: boolean;
  onShare: () => void;
}

export function StartMenu({ onBack, onRandom, onPassport, stamps, officers, officersOn, onOfficers, mapOpen, mart, onShare }: Props) {
  const back = useRef<HTMLButtonElement>(null);
  const { theme, toggle } = useTheme();
  const night = theme === 'dark';
  useEffect(() => back.current?.focus({ preventScroll: true }), []);
  return (
    <section id={START_MENU_ID} className="menu-screen start-menu" aria-labelledby="start-title">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK<span className="sr-only"> to the hall</span>
      </button>
      <h2 id="start-title">START</h2>
      <ul className="start-items" aria-label="START menu">
        <li>
          <button type="button" className="start-item" onClick={onRandom}>
            <span className="start-glyph" aria-hidden="true">
              ?
            </span>
            <span className="start-name">Random player</span>
            <span className="start-what">Pip walks to someone new.</span>
          </button>
        </li>
        <li>
          <button type="button" className="start-item" onClick={onPassport}>
            <span className="start-glyph" aria-hidden="true">
              ▤
            </span>
            <span className="start-name">Passport{stamps > 0 ? ` · ${stamps}` : ''}</span>
            <span className="start-what">The people and exhibits you’ve found.</span>
          </button>
        </li>
        {officers && (
          <li>
            <button type="button" className="start-item" aria-pressed={officersOn} onClick={onOfficers}>
              <span className="start-glyph" aria-hidden="true">
                »
              </span>
              <span className="start-name">Officers{officersOn ? ' ✓' : ''}</span>
              <span className="start-what">{officersOn ? 'Showing only the current officers. Press again for everyone.' : 'Only the hall’s current officers, in order.'}</span>
            </button>
          </li>
        )}
        <li>
          <Link to="/museum" className="start-item">
            <span className="start-glyph" aria-hidden="true">
              ⌂
            </span>
            <span className="start-name">Museum</span>
            <span className="start-what">Walk through members’ projects.</span>
          </Link>
        </li>
        {mapOpen && (
          <li>
            <Link to="/network" className="start-item">
              <span className="start-glyph" aria-hidden="true">
                ✶
              </span>
              <span className="start-name">Map</span>
              <span className="start-what">Who builds with whom.</span>
            </Link>
          </li>
        )}
        {mart && (
          <li>
            <Link to="/mart" className="start-item">
              <span className="start-glyph" aria-hidden="true">
                ◆
              </span>
              <span className="start-name">PIP MART</span>
              <span className="start-what">Frames and plates for your badge.</span>
            </Link>
          </li>
        )}
        <li>
          {/* For events: show it on a laptop or projector and people scan their way in (D-088). */}
          <button type="button" className="start-item" onClick={onShare}>
            <span className="start-glyph" aria-hidden="true">
              ▣
            </span>
            <span className="start-name">Share the hall</span>
            <span className="start-what">A QR code for a screen or a poster.</span>
          </button>
        </li>
        <li>
          <button type="button" className="start-item" onClick={toggle}>
            <span className="start-glyph" aria-hidden="true">
              <SpriteCanvas sprite={night ? SPR.star0 : SPR.moon} palette={{ ...WORLD_PALETTE, ...WORLD_OVERRIDES[night ? 'star0' : 'moon'] }} />
            </span>
            <span className="start-name">{night ? 'Day world' : 'Night world'}</span>
            <span className="start-what">{night ? 'Switch the world to day.' : 'Switch the world to night.'}</span>
          </button>
        </li>
      </ul>
    </section>
  );
}
