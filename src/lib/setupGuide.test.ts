import { describe, expect, it } from 'vitest';
import { guideProgress, guideStages, setupSteps, type GuideInput } from './setupGuide';

const blank: GuideInput = { username: '', fullName: '', role: '', bio: '', hasPhoto: false, githubHandle: null, projects: 0, skills: 0, status: null, hasLiveCard: false };

describe('setup guide', () => {
  it('starts at the username, with nothing done', () => {
    const p = guideProgress(setupSteps(blank));
    expect(p.done).toBe(0);
    expect(p.total).toBe(8);
    expect(p.next?.key).toBe('username');
    expect(p.ready).toBe(false);
  });

  it('skips optional steps when choosing what is next, and is ready once the required ones are done', () => {
    const p = guideProgress(setupSteps({ ...blank, username: 'jums', fullName: 'Jums', role: 'Dev', bio: 'Builds things', projects: 1 }));
    expect(p.next?.key).toBe('submit');
    expect(p.ready).toBe(true);
  });

  it('points "say what you do" at whichever of role and bio is missing', () => {
    expect(setupSteps({ ...blank, role: 'Dev' }).find((s) => s.key === 'about')?.field).toBe('bio');
    expect(setupSteps(blank).find((s) => s.key === 'about')?.field).toBe('role');
  });

  it('counts sending for review as done, and says so once approved', () => {
    const pending = setupSteps({ ...blank, status: 'pending_review' }).find((s) => s.key === 'submit')!;
    expect(pending.done).toBe(true);
    expect(pending.hint).toMatch(/Waiting for an admin/);
    const live = setupSteps({ ...blank, status: 'approved', hasLiveCard: true }).find((s) => s.key === 'submit')!;
    expect(live.title).toBe('Your card is in the hall');
  });

  it('a draft or a rejected card still has to be sent', () => {
    for (const status of ['draft', 'rejected', 'unpublished'] as const) expect(setupSteps({ ...blank, status }).at(-1)!.done).toBe(false);
  });

  it('groups the steps into Info, Projects and Send it, each done once its required steps are', () => {
    const blankStages = guideStages(setupSteps(blank));
    expect(blankStages.map((g) => g.key)).toEqual(['info', 'projects', 'submit']);
    expect(blankStages.map((g) => g.done)).toEqual([false, false, false]);
    expect(blankStages[0]!.todo.map((s) => s.short)).toEqual(['a username', 'your name', 'a role and a bio']);
    expect(blankStages[0]!.extra.map((s) => s.short)).toEqual(['a photo', 'a few skills']);
    expect(blankStages[0]!.field).toBe('username');
    expect(blankStages[1]!.field).toBe('repos');
    expect(blankStages[2]!.field).toBeNull();

    const info = guideStages(setupSteps({ ...blank, username: 'jums', fullName: 'Jums', role: 'Dev', bio: 'Builds things' }));
    expect(info.map((g) => g.done)).toEqual([true, false, false]);
    expect(info[0]!.field).toBe('photo'); // only the optional ones are left
  });

  it('says which of role and bio is still missing', () => {
    expect(setupSteps({ ...blank, role: 'Dev' }).find((s) => s.key === 'about')?.short).toBe('a bio');
    expect(setupSteps({ ...blank, bio: 'Hi' }).find((s) => s.key === 'about')?.short).toBe('a role');
  });
});
