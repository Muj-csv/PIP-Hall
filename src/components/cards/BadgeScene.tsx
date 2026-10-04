import { useLayoutEffect, useRef } from 'react';
import { cssVarReader } from '../../lib/sprites';

const W = 52;
const H = 24;

/** The tiny level behind the member in the photo window (brief §13). Same in DAY and NIGHT. */
export function BadgeScene() {
  const ref = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const c = ref.current;
    const x = c?.getContext('2d');
    if (!c || !x) return;
    const read = cssVarReader(c);
    x.fillStyle = read('--color-card-sky');
    x.fillRect(0, 0, W, H);
    x.fillStyle = read('--color-card-face');
    for (const [cx, cy, w] of [[4, 3, 8], [6, 2, 4], [36, 5, 10], [38, 4, 5]] as const) x.fillRect(cx, cy, w, 2);
    x.fillStyle = read('--color-card-hill');
    for (let i = -12; i <= 12; i++) {
      const hh = Math.round(Math.sqrt(144 - i * i) * 0.8);
      x.fillRect(40 + i, 21 - hh, 1, hh);
    }
    x.fillStyle = read('--color-card-hill-dark');
    for (const [hx, hy] of [[38, 13], [42, 16], [36, 17]] as const) x.fillRect(hx, hy, 1, 1);
    x.fillStyle = read('--color-card-grass');
    x.fillRect(0, 20, W, 1);
    x.fillStyle = read('--color-card-ground');
    x.fillRect(0, 21, W, 3);
  }, []);

  return <canvas ref={ref} width={W} height={H} className="scene pixelated" aria-hidden="true" />;
}
