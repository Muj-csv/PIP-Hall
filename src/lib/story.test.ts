import { describe, expect, it } from 'vitest';
import { comicPanels, storyOf } from './story';

describe('the making-of comic', () => {
  it('is published only when a line is written, trimmed, the rest null', () => {
    expect(storyOf({})).toBeNull();
    expect(storyOf({ story_problem: '  ', story_built: null })).toBeNull();
    expect(storyOf({ story_problem: ' No room to study. ', story_result: 'Used by 40.' })).toEqual({ problem: 'No room to study.', built: null, result: 'Used by 40.' });
  });

  it('draws the written lines as panels, in order', () => {
    expect(comicPanels(null)).toEqual([]);
    expect(comicPanels({ problem: 'P', built: null, result: 'R' }).map((p) => [p.heading, p.text])).toEqual([
      ['The problem', 'P'],
      ['What happened', 'R'],
    ]);
  });
});
