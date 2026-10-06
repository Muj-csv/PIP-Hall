// Shapes of the public card. `CardData` mirrors build_card() in
// supabase/migrations/20261004000200_image_paths.sql exactly; add a field there first.

export type ProjectSource = 'github' | 'manual';

export interface PublicProject {
  /** Project row id, in snapshots approved since the Museum (D-069); used to match exhibits. */
  id?: string | null;
  title: string;
  description: string | null;
  cover_path: string | null;
  project_url: string | null;
  github_url: string | null;
  language: string | null;
  stars: number | null;
  tech_stack: string[];
  source: ProjectSource;
  project_date: string | null;
  /** Members who accepted a tag on this project, as of the approval (D-089). */
  collaborators?: Collaborator[];
}

/** A member of the hall credited on someone else's project. */
export interface Collaborator {
  username: string;
  full_name: string;
  member_no: number;
}

export interface CardData {
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
  skills: string[];
  theme: 'classic';
  is_featured: boolean;
  projects: PublicProject[];
}

/** A row of `published_cards`. */
export interface PublishedCardRow {
  profile_id: string;
  username: string;
  card: CardData;
  is_featured: boolean;
  published_at: string;
  /** Stable member number, assigned at first approval and never reused (D-034). */
  member_no: number;
}

/** What the UI renders: a published card plus its badge number. */
export interface PublicCard extends PublishedCardRow {
  /** The number printed on the badge (= member_no). */
  no: number;
}
