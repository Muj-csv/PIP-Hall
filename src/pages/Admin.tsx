// /admin — guarded by RequireAdmin. The moderation queue (FR-08) is built in Phase 4.

import { Link } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';

export default function Admin() {
  return (
    <MenuPage title="Admin">
      <DialogueBox text="You’re signed in as a hall admin. The moderation queue opens here: approve, reject with a note, feature and unpublish." emote="approved" />
      <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
        ◀ Back to the hall
      </Link>
    </MenuPage>
  );
}
