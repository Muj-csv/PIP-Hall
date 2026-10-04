import { Link, useLocation } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { CARD_PALETTE, SPR } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';
import { ThemeToggle } from './ThemeToggle';

/** Slim bar outside the device: wordmark, world switch and the member call to action (brief §3). */
export function TopBar() {
  const { session } = useSession();
  const signedIn = session.status === 'signed-in';
  const { pathname } = useLocation();
  const inHall = pathname === '/' || pathname.startsWith('/member/');
  return (
    <header className="flex flex-wrap items-center justify-between gap-space-3 border-b-4 border-text-primary py-space-4">
      <Link to="/" className="flex min-h-11 items-center gap-space-2 no-underline font-display text-[22px] tracking-[0.08em]">
        <SpriteCanvas sprite={SPR.block} palette={CARD_PALETTE} className="h-6 w-6" />
        <span>
          PIXENDO <span aria-hidden="true">·</span> PIP-HALL
        </span>
      </Link>
      <nav aria-label="Account" className="flex flex-wrap items-center gap-space-3">
        <ThemeToggle />
        <Link to="/" className="pixel-btn" aria-current={inHall ? 'page' : undefined}>
          <span aria-hidden="true">◂ </span>Hall
        </Link>
        <Link to="/museum" className="pixel-btn">
          Museum
        </Link>
        {signedIn && session.role === 'admin' && (
          <Link to="/admin" className="pixel-btn">
            Admin
          </Link>
        )}
        <Link to={signedIn ? '/edit' : '/login'} className="pixel-btn" data-variant="primary">
          {signedIn ? 'My card' : 'Make your card'}
        </Link>
      </nav>
    </header>
  );
}
