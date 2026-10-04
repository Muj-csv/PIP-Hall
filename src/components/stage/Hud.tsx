import { SPR, WORLD_PALETTE } from '../../lib/sprites';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

/** Coins, world and player n/N across the top of the level. Decorative: the dialogue announces the count. */
export function Hud({ coins, index, count }: { coins: number; index: number; count: number }) {
  return (
    <div className="hud" aria-hidden="true">
      <span>PIP-HALL</span>
      <span className="hud-coins">
        <SpriteCanvas sprite={SPR.coin0} palette={WORLD_PALETTE} />×{String(coins).padStart(2, '0')}
      </span>
      <span>WORLD 1-1</span>
      <span>{count > 0 ? `${index + 1}/${count}` : '0/0'}</span>
    </div>
  );
}
