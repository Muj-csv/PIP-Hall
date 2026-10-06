// Project collaborators (D-089). Tagging, answering and leaving all happen in the database
// (supabase/migrations/*_project_collaborators.sql), which checks who may do what.

import type { MyCollabs, OutgoingCollab } from '../types/collab';
import { requireSupabase } from './supabase';

export const collabService = {
  async mine(): Promise<MyCollabs> {
    const { data, error } = await requireSupabase().rpc('my_collaborations');
    if (error) throw error;
    return data as MyCollabs;
  },

  async tag(projectId: string, username: string): Promise<OutgoingCollab> {
    const { data, error } = await requireSupabase().rpc('tag_collaborator', { p_project: projectId, p_username: username });
    if (error) throw error;
    return { project_id: projectId, ...(data as Omit<OutgoingCollab, 'project_id'>) };
  },

  async untag(projectId: string, memberId: string): Promise<void> {
    const { error } = await requireSupabase().rpc('untag_collaborator', { p_project: projectId, p_member: memberId });
    if (error) throw error;
  },

  async respond(projectId: string, accept: boolean): Promise<void> {
    const { error } = await requireSupabase().rpc('respond_collaboration', { p_project: projectId, p_accept: accept });
    if (error) throw error;
  },

  async leave(projectId: string): Promise<void> {
    const { error } = await requireSupabase().rpc('leave_collaboration', { p_project: projectId });
    if (error) throw error;
  },
};

/** True when the database doesn't have collaborators yet (the update hasn't been run). */
export function collabNotSetUp(e: unknown): boolean {
  const err = e as { code?: string; message?: string } | null;
  return err?.code === 'PGRST202' || err?.code === '42883' || /Could not find the function/i.test(err?.message ?? '');
}

/** A database refusal in plain words. */
export function collabErrorMessage(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? '';
  if (/NOT_IN_HALL/.test(msg)) return 'That username isn’t in the hall. Only members whose card is approved can be tagged.';
  if (/SELF/.test(msg)) return 'That’s you. Tag the people you made it with.';
  if (/DECLINED/.test(msg)) return 'They declined or left this project, so they can’t be asked again.';
  if (/TOO_MANY/.test(msg)) return 'A project can have up to 8 collaborators.';
  if (/NOT_YOURS/.test(msg)) return 'Only the project’s owner can change its collaborators.';
  if (/NO_REQUEST/.test(msg)) return 'That request isn’t open anymore.';
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Can’t reach the hall right now. Try again.';
  return msg || 'That didn’t work. Try again.';
}
