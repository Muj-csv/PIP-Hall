import { Link, useParams } from 'react-router';
import { TopBar } from '../components/shell/TopBar';
import { Hall } from '../components/stage/Hall';
import { InstallPrompt } from '../components/install/InstallPrompt';

// `/` and `/member/:username` are the same screen: the hall, with that member's profile open inside
// the device when the address names one (the Hall sets the page title).
export default function Home() {
  const { username = null } = useParams();
  return (
    <div className="mx-auto max-w-[1080px] px-space-4 pb-space-8">
      <TopBar />
      <main>
        <div className="mx-auto my-space-5 max-w-[60ch] text-center">
          <h1 className="m-0 font-display text-h2 font-normal leading-tight">
            <span className="sr-only">PIP-Hall, People, Identity &amp; Projects Hall: </span>
            Where every person has a place.
          </h1>
          <p className="m-0 text-text-secondary">Meet the members of the hall: flip a badge to see what they build.</p>
        </div>
        <Hall profile={username} />
      </main>
      <footer className="mt-space-6 grid justify-items-center gap-space-2 text-center text-caption text-text-secondary">
        <InstallPrompt compact />
        <Link to="/privacy" className="inline-block px-space-2 py-[12px] underline decoration-2">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
