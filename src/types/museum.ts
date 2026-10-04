// MUSEUM and affiliations (docs/plan/MUSEUM.md).

import type { PublicProject } from './card';

/** An admin-entered label, e.g. an organization or "CS Student" (D-067). */
export interface Affiliation {
  key: string;
  name: string;
  grants_museum: boolean;
  frame_key: string | null;
  sort: number;
}

export interface Exhibit {
  project_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  member_no: number;
  project: PublicProject;
}

export interface MyMuseum {
  access: boolean;
  /** Project ids in the member's approved card. */
  live: string[];
  /** Project ids the member put in the Museum. */
  entries: string[];
}
