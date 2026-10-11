import { describe, expect, it } from 'vitest';
import { ago, COLLAB_PATH, notificationLine, ownUsername, recentLine, unread, type HallNotification, type RecentEvent } from './notifications';

const n = (over: Partial<HallNotification>): HallNotification => ({
  id: 1,
  type: 'CARD_APPROVED',
  at: '2026-10-06T00:00:00Z',
  target_type: null,
  target_id: null,
  title: null,
  note: null,
  by_username: null,
  by_name: null,
  ...over,
});

const r = (over: Partial<RecentEvent>): RecentEvent => ({
  id: 1,
  type: 'CARD_APPROVED',
  at: '2026-10-06T00:00:00Z',
  username: 'ada',
  full_name: 'Ada L',
  title: null,
  project_id: null,
  with_username: null,
  with_name: null,
  ...over,
});

describe('notificationLine', () => {
  it('sends an approval to the member’s own badge', () => {
    expect(notificationLine(n({ type: 'CARD_APPROVED', target_id: 'ada' }), null)).toEqual({ text: 'Your card is approved and in the hall.', to: '/member/ada' });
  });
  it('carries the admin’s note on a card that needs changes, and goes to the editor', () => {
    expect(notificationLine(n({ type: 'CARD_REJECTED', note: 'Add a photo' }), 'ada')).toEqual({ text: 'Your card needs changes: Add a photo', to: '/edit' });
    expect(notificationLine(n({ type: 'CARD_REJECTED' }), 'ada')?.text).toBe('Your card needs changes.');
  });
  it('names who tagged you and on what, and goes to where you answer', () => {
    const line = notificationLine(n({ type: 'COLLAB_REQUESTED', title: 'TESSERA', by_name: 'Bo', by_username: 'bo' }), 'ada');
    expect(line).toEqual({ text: 'Bo tagged you on “TESSERA”. Accept or decline it in My card.', to: COLLAB_PATH });
  });
  it('says an accepted tag waits for the next approval', () => {
    expect(notificationLine(n({ type: 'COLLAB_ACCEPTED', title: 'X', by_name: 'Bo' }), 'ada')?.text).toMatch(/Bo accepted your tag on “X”.*next approval/);
  });
  it('sends a public credit to the owner’s badge', () => {
    expect(notificationLine(n({ type: 'COLLAB_PUBLISHED', title: 'X', by_name: 'Bo', by_username: 'bo' }), 'ada')).toEqual({ text: 'You’re now credited on “X” by Bo.', to: '/member/bo' });
  });
  it('sends achievements and featuring to your own badge when known', () => {
    expect(notificationLine(n({ type: 'ACHIEVEMENT_UNLOCKED', title: 'Explorer' }), 'ada')).toEqual({ text: 'Achievement unlocked: Explorer!', to: '/member/ada' });
    expect(notificationLine(n({ type: 'MEMBER_FEATURED' }), null)).toEqual({ text: 'You’re featured! Your badge hangs in the Museum’s Featured Members room.', to: '/museum?room=members' });
  });
  it('tells a maker their project now hangs in the Museum (D-133)', () => {
    expect(notificationLine(n({ type: 'EXHIBIT_ADDED', target_id: 'p1', title: 'Kite' }), 'ada')).toEqual({ text: '“Kite” now hangs in the Museum.', to: '/museum/p1' });
  });
  it('tells a winner what their project won, and where, and leads to the exhibit', () => {
    expect(notificationLine(n({ type: 'AWARD_WON', target_id: 'p1', title: 'Kite', event: 'Spring Hackathon', place: 1 }), 'ada')).toEqual({ text: '“Kite” won 1st place at Spring Hackathon!', to: '/museum/p1' });
    expect(notificationLine(n({ type: 'AWARD_WON', target_id: 'p1', title: 'Kite', event: 'Spring Hackathon', award: 'Best UI', track: 'Health' }), null)?.text).toBe('“Kite” won Best UI · Health track at Spring Hackathon!');
  });
  it('drops kinds it doesn’t know', () => {
    expect(notificationLine(n({ type: 'MISSION_COMPLETED' as HallNotification['type'] }), 'ada')).toBeNull();
  });
});

describe('ownUsername and unread', () => {
  it('finds the member’s username from their approval', () => {
    expect(ownUsername([n({ type: 'ACHIEVEMENT_UNLOCKED' }), n({ type: 'CARD_APPROVED', target_id: 'ada' })])).toBe('ada');
    expect(ownUsername([])).toBeNull();
  });
  it('counts only what came after the marker', () => {
    const items = [n({ id: 2, at: '2026-10-06T10:00:00Z' }), n({ id: 1, at: '2026-10-06T08:00:00Z' })];
    expect(unread(null)).toBe(0);
    expect(unread({ seenAt: null, items })).toBe(2);
    expect(unread({ seenAt: '2026-10-06T09:00:00Z', items })).toBe(1);
    expect(unread({ seenAt: '2026-10-06T11:00:00Z', items })).toBe(0);
  });
});

describe('recentLine', () => {
  it('says a member joined and goes to them', () => {
    expect(recentLine(r({}))).toEqual({ text: 'Ada L joined the hall.', to: '/member/ada' });
  });
  it('puts a new project in the Quest Log', () => {
    expect(recentLine(r({ type: 'PROJECT_PUBLISHED', title: 'Kite' }))?.text).toBe('Ada L added “Kite” to their Quest Log.');
  });
  it('sends an exhibit to the Museum', () => {
    expect(recentLine(r({ type: 'EXHIBIT_ADDED', title: 'Kite', project_id: 'p1' }))).toEqual({ text: '“Kite” by Ada L is on show in the Museum.', to: '/museum/p1' });
  });
  it('names both makers of a team project', () => {
    expect(recentLine(r({ type: 'COLLAB_PUBLISHED', title: 'Kite', with_name: 'Bo', with_username: 'bo' }))?.text).toBe('Ada L and Bo made “Kite” together.');
  });
  it('needs the achievement’s name', () => {
    expect(recentLine(r({ type: 'ACHIEVEMENT_UNLOCKED', title: 'Explorer' }))?.text).toBe('Ada L unlocked Explorer.');
    expect(recentLine(r({ type: 'ACHIEVEMENT_UNLOCKED' }))).toBeNull();
  });
  it('never says anything with a number in it (no counts, rule 5)', () => {
    const all: RecentEvent['type'][] = ['CARD_APPROVED', 'PROJECT_PUBLISHED', 'EXHIBIT_ADDED', 'COLLAB_PUBLISHED', 'ACHIEVEMENT_UNLOCKED', 'MEMBER_FEATURED'];
    for (const type of all) expect(recentLine(r({ type, title: 'Kite', with_name: 'Bo', project_id: 'p' }))?.text).not.toMatch(/\d/);
  });
});

describe('ago', () => {
  const now = Date.parse('2026-10-06T12:00:00Z');
  it('reads like a person would say it', () => {
    expect(ago('2026-10-06T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-10-06T11:55:00Z', now)).toBe('5 min ago');
    expect(ago('2026-10-06T09:00:00Z', now)).toBe('3 h ago');
    expect(ago('2026-10-05T10:00:00Z', now)).toBe('yesterday');
    expect(ago('2026-10-03T12:00:00Z', now)).toBe('3 days ago');
    expect(ago('2026-09-01T12:00:00Z', now)).toMatch(/Sep/);
  });
});

describe('event lines in Recent (V2-9)', () => {
  it('names who entered what in which event', () => {
    expect(recentLine(r({ type: 'EVENT_SUBMITTED', title: 'Kite', project_id: 'p1', event: 'Spring Hackathon', event_key: 'spring-hack' }))).toEqual({ text: 'Ada L entered “Kite” in Spring Hackathon.', to: '/museum/p1' });
  });
  it('announces results with no member attached, and leads to the event room', () => {
    expect(recentLine(r({ type: 'RESULTS_ANNOUNCED', username: null, full_name: null, event: 'Spring Hackathon', event_key: 'spring-hack' }))).toEqual({ text: 'Results are in for Spring Hackathon!', to: '/museum?event=spring-hack' });
    expect(recentLine(r({ type: 'RESULTS_ANNOUNCED', username: null, event: null, event_key: null }))).toBeNull();
  });
});

describe('archive lines (V2-10)', () => {
  it('tells a member they’re credited, or why a claim wasn’t confirmed', () => {
    expect(notificationLine(n({ type: 'ARCHIVE_CREDITED', target_id: 'k1', title: 'Kite' }), null)).toEqual({ text: 'You’re credited on “Kite” in the Museum’s Archive. It links to your badge.', to: '/museum/k1' });
    expect(notificationLine(n({ type: 'ARCHIVE_CLAIM_DECLINED', target_id: 'k1', title: 'Kite', note: 'Not on the team list.' }), null)?.text).toBe('Your claim on “Kite” wasn’t confirmed: Not on the team list.');
  });
  it('announces new archive exhibits and credits in Recent', () => {
    expect(recentLine(r({ type: 'ARCHIVE_ADDED', username: null, full_name: null, title: 'Kite', project_id: 'k1', event: 'Spring Hackathon 2024' }))).toEqual({ text: 'New in the Museum’s Archive: “Kite” from Spring Hackathon 2024.', to: '/museum/k1' });
    expect(recentLine(r({ type: 'ARCHIVE_CREDITED', title: 'Kite', project_id: 'k1' }))?.text).toBe('Ada L is credited on “Kite” in the Museum’s Archive.');
  });
});
