// The member's private draft (profiles + projects rows). Visitors never see these (ADR-002).

import type { ProjectSource } from './card';

export type ProfileStatus = 'draft' | 'pending_review' | 'approved' | 'rejected' | 'unpublished';

export interface DraftProfile {
  id: string;
  username: string;
  full_name: string;
  tagline: string | null;
  bio: string | null;
  role: string | null;
  org_position: string | null;
  department: string | null;
  avatar_path: string | null;
  github_username: string | null;
  linkedin_url: string | null;
  portfolio_url: string | null;
  public_email: string | null;
  show_email: boolean;
  email_updates: boolean;
  skills: string[];
  status: ProfileStatus;
  review_note: string | null;
  is_featured: boolean;
  username_locked: boolean;
  member_no: number | null;
}

export interface DraftProject {
  /** Database id; undefined until the project is first saved. */
  id?: string;
  /** Stable client key for lists and errors. */
  key: string;
  source: ProjectSource;
  github_repo_id: number | null;
  title: string;
  description: string | null;
  cover_path: string | null;
  project_url: string | null;
  github_url: string | null;
  language: string | null;
  stars: number | null;
  tech_stack: string[];
  project_date: string | null;
}

/** What the editor holds while the member types. Strings stay strings until save. */
export interface CardForm {
  username: string;
  full_name: string;
  tagline: string;
  bio: string;
  role: string;
  org_position: string;
  department: string;
  linkedin_url: string;
  portfolio_url: string;
  public_email: string;
  show_email: boolean;
  email_updates: boolean;
  skills: string[];
  avatar_path: string | null;
  projects: DraftProject[];
}

/** Everything /edit loads for the signed-in member. */
export interface MyCard {
  profile: DraftProfile | null;
  projects: DraftProject[];
  /** A published snapshot exists (so edits show "Live version is older"). */
  hasLiveCard: boolean;
}
