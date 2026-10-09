import { describe, expect, it } from 'vitest';
import { isPlateStyle, parseHallTitle, plateVars, TITLES, titleOf } from './titles';

describe('titles', () => {
  it('knows every title the database can award, each with its rule', () => {
    expect(TITLES.map((t) => t.key)).toEqual(['card_holder', 'pioneer', 'explorer', 'connector', 'curator', 'pathfinder', 'champion', 'mentor']);
    expect(TITLES.every((t) => t.rule.endsWith('.'))).toBe(true);
    expect(titleOf('explorer')?.name).toBe('Explorer');
    expect(titleOf('legend')).toBeNull();
  });

  it('reads hall_titles() rows safely', () => {
    expect(parseHallTitle({ earned: ['pioneer', 'card_holder', 'legend'], title: 'pioneer', plate_style: { plate: 'gold', ink: 'ink' } })).toEqual({
      earned: ['card_holder', 'pioneer'],
      title: 'pioneer',
      plateStyle: { plate: 'gold', ink: 'ink' },
    });
    // A worn title that isn't earned, or a plate that isn't a plate, is dropped.
    expect(parseHallTitle({ earned: ['card_holder'], title: 'explorer', plate_style: { plate: '#fff', ink: 'ink' } })).toEqual({ earned: ['card_holder'], title: null, plateStyle: null });
    expect(parseHallTitle({})).toEqual({ earned: [], title: null, plateStyle: null });
  });

  it('plates only ever name card tokens', () => {
    expect(isPlateStyle({ plate: 'plum', ink: 'cream' })).toBe(true);
    expect(isPlateStyle({ plate: 'plum', ink: 'cream', extra: 1 })).toBe(false);
    expect(plateVars({ plate: 'plum', ink: 'cream' })).toEqual({ '--plate': 'var(--color-card-plum)', '--plate-ink': 'var(--color-card-cream)' });
    expect(plateVars(null)).toBeUndefined();
  });
});
