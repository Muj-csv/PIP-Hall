// Project collaborators (D-089).

export type CollabStatus = 'pending' | 'accepted' | 'declined';

/** A tag on someone else's project that names me. */
export interface IncomingCollab {
  project_id: string;
  title: string;
  owner_username: string;
  owner_name: string;
  status: CollabStatus;
}

/** A tag I put on one of my projects. */
export interface OutgoingCollab {
  project_id: string;
  member_id: string;
  username: string | null;
  full_name: string | null;
  status: CollabStatus;
}

export interface MyCollabs {
  incoming: IncomingCollab[];
  outgoing: OutgoingCollab[];
}
