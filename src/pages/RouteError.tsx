// Shown when a screen fails to load or crashes (for example, offline before its code was ever
// downloaded). Speaks through the DialogueBox like every other error (CLAUDE.md).

import { useEffect } from 'react';
import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';

export default function RouteError() {
  const error = useRouteError();
  const offline = typeof navigator !== 'undefined' && !navigator.onLine;
  const chunk = error instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(error.message);

  useEffect(() => {
    if (!isRouteErrorResponse(error)) console.error(error);
  }, [error]);

  const text = offline
    ? 'You’re offline, and this part of the hall hasn’t been saved on this device yet. Reconnect and try again.'
    : chunk
      ? 'This part of the hall didn’t load. The site may have just been updated: reloading fixes it.'
      : 'Something broke on this screen. Reloading usually fixes it.';

  return (
    <MenuPage title="Something went wrong">
      <DialogueBox text={text} emote="attention">
        <button type="button" className="hw-btn" data-variant="small" onClick={() => window.location.reload()}>
          RELOAD
        </button>
      </DialogueBox>
      <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
        ◀ Back to the hall
      </Link>
    </MenuPage>
  );
}
