// Shapes of the public card. `CardData` mirrors build_card() in
// supabase/migrations/20261004000200_image_paths.sql exactly; add a field there first.

export type ProjectSource = 'github' | 'manual';

export interface PublicProject {
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
}

/** What the UI renders: a published card plus its place in the hall. */
export interface PublicCard extends PublishedCardRow {
  /** Member number, 1-based, in approval order. */
  no: number;
}
