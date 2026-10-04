import { useEffect } from 'react';
import { Link } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { TopBar } from '../components/shell/TopBar';

export default function NotFound() {
  useEffect(() => {
    document.title = 'Not found · PIP-Hall';
  }, []);
  return (
    <div className="mx-auto max-w-[1080px] px-space-4 pb-space-8">
      <TopBar />
      <main className="mx-auto mt-space-6 grid max-w-[640px] gap-space-4">
        <h1 className="m-0 font-display text-h1 font-normal">This room isn’t built yet</h1>
        <div className="step8 overflow-hidden">
          <DialogueBox text="Nothing lives at this address yet. The path back to the hall is right here." emote="attention" />
        </div>
        <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
          ◀ Back to the hall
        </Link>
      </main>
    </div>
  );
}
