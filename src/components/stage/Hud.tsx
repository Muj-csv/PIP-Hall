import { SPR, WORLD_PALETTE } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

/**
 * Coins, world and player n/N across the top of the level. Decorative: the dialogue announces the
 * count. For members in the hall the coin is their PIP balance (D-064); for everyone else it counts flips.
 */
export function Hud({ coins, index, count, pips = false }: { coins: number; index: number; count: number; pips?: boolean }) {
  return (
    <div className="hud" aria-hidden="true">
      <span>PIP-HALL</span>
      <span className="hud-coins" data-pips={pips || undefined} title={pips ? 'Your PIPs' : undefined}>
        <SpriteCanvas sprite={SPR.coin0} palette={WORLD_PALETTE} />×{String(coins).padStart(2, '0')}
      </span>
      <span>WORLD 1-1</span>
      <span>{count > 0 ? `${index + 1}/${count}` : '0/0'}</span>
    </div>
  );
}
