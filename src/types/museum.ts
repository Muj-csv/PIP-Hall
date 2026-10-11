// MUSEUM and affiliations (docs/plan/MUSEUM.md).

import type { ArchiveExhibit } from '../lib/archive';
import type { ConsoleKind } from '../lib/sprites';
import type { PublicCard, PublicProject } from './card';

/** An admin-entered label, e.g. an organization or "CS Student" (D-067). */
export interface Affiliation {
  key: string;
  name: string;
  grants_museum: boolean;
  frame_key: string | null;
  sort: number;
  /** An officers' team for one term (V2-10b, D-123), and the day that term ends. */
  officers?: boolean;
  term_ends?: string | null;
}

export interface Exhibit {
  project_id: string;
  username: string;
  full_name: string;
  avatar_path: string | null;
  member_no: number;
  /** An admin featured this project (D-130; before, its maker): pinned on top (D-083). */
  featured?: boolean;
  /** The console the maker picked; null or missing means picked from the project id (D-091). */
  console?: ConsoleKind | null;
  project: PublicProject;
  /** Set for a past project from the archive (V2-10, D-118): its makers, event and award. */
  archive?: ArchiveExhibit;
  /** Set for a member hung in the Featured Members room (V2-20, D-133): their badge and the curator's
   *  note. Its project_id is `member:<username>`, never a project's. */
  portrait?: { card: PublicCard; note: string };
}

/** How the admins arranged one room (D-133): the sign on its door (null: its own name), and whether it is shut. */
export interface RoomLayout {
  key: string;
  sign: string | null;
  hidden: boolean;
}

/** museum_curation(): the rooms as arranged, the featured members' notes, and the hand-picked wing exhibits. */
export interface MuseumCuration {
  rooms: RoomLayout[];
  portraits: { member_id: string; note: string }[];
  picks: { wing: string; project_id: string }[];
}

/** Admin → Museum → Winners (D-133): one winning project of an announced event. */
export interface AdminWinner {
  project_id: string;
  title: string;
  username: string | null;
  full_name: string | null;
  awards: { place: 1 | 2 | 3 | null; name: string | null; track: string | null }[];
  /** Still on its maker's approved card (only then does it show, even when hung). */
  live: boolean;
  hung: boolean;
}

export interface AdminWinnerEvent {
  season_key: string;
  event: string;
  announced_at: string;
  winners: AdminWinner[];
}

export interface MyMuseum {
  access: boolean;
  /** Project ids in the member's approved card. */
  live: string[];
  /** The member's approved projects, as approved (D-071). */
  projects: { id: string; title: string }[];
  /** Project ids the member put in the Museum. */
  entries: string[];
  /** Consoles the member picked, by project id; the rest are automatic (D-091). */
  consoles?: Record<string, ConsoleKind>;
  /** Which of them an admin featured, so they hang in the Museum (D-130); missing before that update. */
  featured?: string[];
}

/** Admin → Museum (D-130): one project on an approved card, and where it stands. */
export interface AdminMuseumProject {
  project_id: string;
  title: string;
  username: string;
  full_name: string;
  member_no: number;
  /** Its maker offered it (the editor's Museum panel). */
  offered: boolean;
  featured: boolean;
  /** It won at an announced event. */
  won: boolean;
  /** It hangs as a winner (an admin hung it, D-133); missing before that update. */
  hung?: boolean;
}

/** Admin → Affiliations: one member with Museum access. */
export interface MuseumSummaryRow {
  profile_id: string;
  username: string;
  full_name: string;
  projects: number;
  exhibits: number;
}
