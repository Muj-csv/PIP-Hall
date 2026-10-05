import { Link, useLocation } from 'react-router';
import { useSession } from '../../app/sessionContext';
import { pipsEnabled } from '../../lib/features';
import { navSection } from '../../lib/nav';
import { CARD_PALETTE, SPR } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';
import { ThemeToggle } from './ThemeToggle';

/** Slim bar outside the device: wordmark, world switch and the places to go (brief §3, D-079).
 *  Phones get two tidy rows: wordmark + switch, then the places; wider screens get one. */
export function TopBar() {
  const { session } = useSession();
  const signedIn = session.status === 'signed-in';
  const here = navSection(useLocation().pathname);
  const current = (s: ReturnType<typeof navSection>) => (here === s ? ('page' as const) : undefined);
  return (
    <header className="topbar">
      <Link to="/" className="topbar-brand">
        <SpriteCanvas sprite={SPR.block} palette={CARD_PALETTE} className="h-6 w-6" />
        <span>
          <span className="topbar-maker">
            PIXENDO <span aria-hidden="true">·</span>{' '}
          </span>
          PIP-HALL
        </span>
      </Link>
      <div className="topbar-world">
        <ThemeToggle />
      </div>
      <nav aria-label="Account" className="topbar-nav">
        <Link to="/" className="pixel-btn nav-btn" aria-current={current('hall')}>
          Hall
        </Link>
        <Link to="/museum" className="pixel-btn nav-btn" aria-current={current('museum')}>
          Museum
        </Link>
        {pipsEnabled && signedIn && (
          <Link to="/mart" className="pixel-btn nav-btn" aria-current={current('mart')}>
            PIP MART
          </Link>
        )}
        {signedIn && session.role === 'admin' && (
          <Link to="/admin" className="pixel-btn nav-btn" aria-current={current('admin')}>
            Admin
          </Link>
        )}
        <Link to={signedIn ? '/edit' : '/login'} className="pixel-btn nav-btn" data-variant="primary" aria-current={current('card')}>
          {signedIn ? 'My card' : 'Make your card'}
        </Link>
      </nav>
    </header>
  );
}
