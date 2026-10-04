import { Link } from 'react-router';
import { CARD_PALETTE, SPR } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';
import { ThemeToggle } from './ThemeToggle';

/** Slim bar outside the device: wordmark, world switch and the member call to action (brief §3). */
export function TopBar() {
  return (
    <header className="flex flex-wrap items-center justify-between gap-space-3 border-b-4 border-text-primary py-space-4">
      <Link to="/" className="flex items-center gap-space-2 no-underline font-display text-[22px] tracking-[0.08em]">
        <SpriteCanvas sprite={SPR.block} palette={CARD_PALETTE} className="h-6 w-6" />
        <span>
          PIXENDO <span aria-hidden="true">·</span> PIP-HALL
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-space-3">
        <ThemeToggle />
        <Link to="/login" className="pixel-btn" data-variant="primary">
          Make your card
        </Link>
      </div>
    </header>
  );
}
