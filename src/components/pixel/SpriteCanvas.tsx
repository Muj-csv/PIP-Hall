import { useLayoutEffect, useRef } from 'react';
import { useTheme } from '../../app/themeContext';
import { cssVarReader, drawSprite, resolvePalette, spriteSize, type Palette, type SpriteMap } from '../../lib/sprites';

interface Props {
  sprite: SpriteMap;
  palette: Palette;
  className?: string;
  /** Accessible name. Without one the canvas is decorative. */
  label?: string;
  style?: React.CSSProperties;
}

/** A sprite drawn at 1px per unit and scaled up with CSS. Redraws when DAY/NIGHT changes. */
export function SpriteCanvas({ sprite, palette, className, label, style }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useLayoutEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const { w, h } = spriteSize(sprite);
    c.width = w;
    c.height = h;
    ctx.clearRect(0, 0, w, h);
    drawSprite(ctx, sprite, resolvePalette(palette, cssVarReader(c)), 0, 0);
  }, [sprite, palette, theme]);

  return (
    <canvas
      ref={ref}
      className={`pixelated ${className ?? ''}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
