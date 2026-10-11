// The making-of comic (V2-23, D-136): three short lines a maker writes for a project (the problem,
// what we built, what happened), shown as three pixel panels on the exhibit's plaque.

import type { ProjectStory } from '../types/card';
import type { DraftProject } from '../types/draft';

const line = (s: string | null | undefined) => (s ?? '').trim() || null;

/** A draft project's story the way build_card() publishes it: null when no line is written. */
export function storyOf(p: Pick<DraftProject, 'story_problem' | 'story_built' | 'story_result'>): ProjectStory | null {
  const story = { problem: line(p.story_problem), built: line(p.story_built), result: line(p.story_result) };
  return story.problem || story.built || story.result ? story : null;
}

/** The panels to draw, in order, with what each is called; only the lines that were written. */
export function comicPanels(story: ProjectStory | null | undefined): { key: keyof ProjectStory; heading: string; text: string }[] {
  if (!story) return [];
  const panels = [
    { key: 'problem' as const, heading: 'The problem', text: story.problem },
    { key: 'built' as const, heading: 'What we built', text: story.built },
    { key: 'result' as const, heading: 'What happened', text: story.result },
  ];
  return panels.flatMap((p) => (p.text ? [{ ...p, text: p.text }] : []));
}
