// Notifications and "Recent in the hall" (V2-4, D-100). Both are read from hall_events by the
// database (my_notifications, recent_hall_events); this file only turns an event into words and a
// place to go. Nothing here invents activity (product rule 7): an event we don't know is dropped.

import { awardLabel, eventRoomPath } from './events';
import { exhibitPath, memberPath } from './publicUrl';

export type NotificationType =
  | 'CARD_APPROVED'
  | 'CARD_REJECTED'
  | 'COLLAB_REQUESTED'
  | 'COLLAB_ACCEPTED'
  | 'COLLAB_PUBLISHED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'MEMBER_FEATURED'
  | 'AWARD_WON';

export interface HallNotification {
  id: number;
  type: NotificationType;
  at: string;
  target_type: string | null;
  target_id: string | null;
  title: string | null;
  note: string | null;
  /** AWARD_WON: the event and what was won (V2-9). */
  event?: string | null;
  place?: 1 | 2 | 3 | null;
  award?: string | null;
  track?: string | null;
  by_username: string | null;
  by_name: string | null;
}

export interface MyNotifications {
  seenAt: string | null;
  items: HallNotification[];
}

export type RecentType =
  | 'CARD_APPROVED'
  | 'PROJECT_PUBLISHED'
  | 'EXHIBIT_ADDED'
  | 'COLLAB_PUBLISHED'
  | 'ACHIEVEMENT_UNLOCKED'
  | 'MEMBER_FEATURED'
  | 'EVENT_SUBMITTED'
  | 'RESULTS_ANNOUNCED';

export interface RecentEvent {
  id: number;
  type: RecentType;
  at: string;
  /** Null for a results announcement (the hall's, not a member's). */
  username: string | null;
  full_name: string | null;
  title: string | null;
  project_id: string | null;
  with_username: string | null;
  with_name: string | null;
  /** EVENT_SUBMITTED and RESULTS_ANNOUNCED: which event (V2-9). */
  event_key?: string | null;
  event?: string | null;
}

export interface Line {
  text: string;
  to: string;
}

/** Where the editor lists collaboration requests. */
export const COLLAB_PATH = '/edit#collaborators';

const quoted = (t: string | null) => (t ? `“${t}”` : 'a project');

/** One notification as a sentence and a link. `me` is the member's own username, when known. */
export function notificationLine(n: HallNotification, me: string | null): Line | null {
  const by = n.by_name ?? n.by_username ?? 'A member';
  const mine = me ? memberPath(me) : '/';
  switch (n.type) {
    case 'CARD_APPROVED':
      return { text: 'Your card is approved and in the hall.', to: n.target_id ? memberPath(n.target_id) : mine };
    case 'CARD_REJECTED':
      return { text: n.note ? `Your card needs changes: ${n.note}` : 'Your card needs changes.', to: '/edit' };
    case 'COLLAB_REQUESTED':
      return { text: `${by} tagged you on ${quoted(n.title)}. Accept or decline it in My card.`, to: COLLAB_PATH };
    case 'COLLAB_ACCEPTED':
      return { text: `${by} accepted your tag on ${quoted(n.title)}. It shows on your card after its next approval.`, to: COLLAB_PATH };
    case 'COLLAB_PUBLISHED':
      return { text: `You’re now credited on ${quoted(n.title)} by ${by}.`, to: n.by_username ? memberPath(n.by_username) : '/' };
    case 'ACHIEVEMENT_UNLOCKED':
      return { text: `Achievement unlocked: ${n.title ?? 'a new one'}!`, to: mine };
    case 'MEMBER_FEATURED':
      return { text: 'You’re featured in the hall!', to: mine };
    case 'AWARD_WON':
      return {
        text: `${quoted(n.title)} won ${awardLabel({ place: n.place ?? null, name: n.award ?? null, track: n.track ?? null })}${n.event ? ` at ${n.event}` : ''}!`,
        to: n.target_id ? exhibitPath(n.target_id) : '/museum',
      };
    default:
      return null;
  }
}

/** The member's own username, from their approval (the bell may know it before the session does). */
export function ownUsername(items: readonly HallNotification[]): string | null {
  return items.find((n) => n.type === 'CARD_APPROVED' && n.target_id)?.target_id ?? null;
}

/** New since the bell was last opened. */
export function unread(data: MyNotifications | null): number {
  if (!data) return 0;
  const seen = data.seenAt ? Date.parse(data.seenAt) : -Infinity;
  return data.items.filter((n) => Date.parse(n.at) > seen).length;
}

/** One public event as a sentence and a link. Every line names a real member and goes to them. */
export function recentLine(e: RecentEvent): Line | null {
  if (e.type === 'RESULTS_ANNOUNCED') return e.event && e.event_key ? { text: `Results are in for ${e.event}!`, to: eventRoomPath(e.event_key) } : null;
  if (!e.username) return null;
  const who = e.full_name || e.username;
  switch (e.type) {
    case 'CARD_APPROVED':
      return { text: `${who} joined the hall.`, to: memberPath(e.username) };
    case 'PROJECT_PUBLISHED':
      return { text: `${who} added ${quoted(e.title)} to their Quest Log.`, to: memberPath(e.username) };
    case 'EXHIBIT_ADDED':
      return { text: `${quoted(e.title)} by ${who} is on show in the Museum.`, to: e.project_id ? exhibitPath(e.project_id) : '/museum' };
    case 'COLLAB_PUBLISHED':
      return { text: `${who} and ${e.with_name || e.with_username || 'a member'} made ${quoted(e.title)} together.`, to: memberPath(e.username) };
    case 'ACHIEVEMENT_UNLOCKED':
      return e.title ? { text: `${who} unlocked ${e.title}.`, to: memberPath(e.username) } : null;
    case 'MEMBER_FEATURED':
      return { text: `${who} is featured in the hall.`, to: memberPath(e.username) };
    case 'EVENT_SUBMITTED':
      return e.event ? { text: `${who} entered ${quoted(e.title)} in ${e.event}.`, to: e.project_id ? exhibitPath(e.project_id) : '/museum' } : null;
    default:
      return null;
  }
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function ago(at: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (Number.isNaN(s)) return '';
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) {
    const d = Math.floor(s / 86400);
    return d === 1 ? 'yesterday' : `${d} days ago`;
  }
  return new Date(at).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
}
