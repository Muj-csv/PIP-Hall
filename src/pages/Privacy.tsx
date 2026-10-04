// /privacy: what we collect and what's public. Google's consent screen links here.
// If what we collect changes, update this page and LAST_UPDATED.

import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage, Panel } from '../components/shell/MenuPage';

const LAST_UPDATED = '5 October 2026';
const CONTACT_URL = 'https://github.com/Muj-csv';
const CONTACT_LABEL = 'github.com/Muj-csv';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Panel label={title}>
      <h2 className="m-0 font-display text-h3 font-normal">{title}</h2>
      {children}
    </Panel>
  );
}

export default function Privacy() {
  return (
    <MenuPage title="Privacy">
      <DialogueBox text="Here’s what the hall keeps about you, and what visitors can see. Short version: only your approved card is public." />

      <Section title="What we collect">
        <ul className="m-0 grid gap-space-2 pl-space-5">
          <li>
            <strong>From Google, when you sign in:</strong> your name, email address and profile picture. PIP-Hall asks Google for nothing
            else.
          </li>
          <li>
            <strong>From GitHub, when you connect it:</strong> your GitHub username and basic public profile. Your repositories are read from
            GitHub’s public API in your browser; PIP-Hall keeps a copy only of the ones you add to your card.
          </li>
          <li>
            <strong>What you put on your card:</strong> username, name, role, position, department, tagline, bio, photo, links, skills,
            projects, and your email settings.
          </li>
        </ul>
      </Section>

      <Section title="What visitors can see">
        <p className="m-0">
          Nothing, until a hall admin approves your card. After that, anyone with the link can see your card and your page at
          /member/your-username, including the photo, links, skills and projects you added and your GitHub username.
        </p>
        <p className="m-0">
          Your email is <strong>never shown</strong> unless you turn on “Show my email on my card”, and then only the address you type
          there. When you edit an approved card, the approved version stays public until the admins approve the new one.
        </p>
        <p className="m-0">Hall admins can see your draft card while they review it.</p>
      </Section>

      <Section title="Emails">
        <p className="m-0">
          PIP-Hall only emails you if you turn on “Email me about my card”, and only about your card and the hall. You can turn it off
          in the card editor at any time.
        </p>
      </Section>

      <Section title="Cookies and tracking">
        <p className="m-0">
          No ads, no analytics, no tracking cookies. Your browser stores your sign-in session and your DAY/NIGHT choice so you don’t have
          to pick them again. To open fast and work offline, your browser also keeps a copy of the site and of the public cards and photos.
        </p>
      </Section>

      <Section title="Who handles your data">
        <p className="m-0">
          PIP-Hall runs on Supabase (database, sign-in and photo storage) and Vercel (hosting the site). Google and GitHub handle signing
          in. Your data isn’t sold or shared with anyone else.
        </p>
      </Section>

      <Section title="Changing or deleting your data">
        <p className="m-0">
          You can change everything on your card from the card editor, and your email choices in Settings. To delete your account, open{' '}
          <Link to="/settings" className="underline decoration-2">
            Settings
          </Link>{' '}
          and choose Delete account: your card, page, photos, projects and sign-in are removed straight away. Questions? Contact the
          maintainer at{' '}
          <a href={CONTACT_URL} className="underline decoration-2" rel="noopener noreferrer" target="_blank">
            {CONTACT_LABEL}
          </a>
          .
        </p>
      </Section>

      <p className="m-0 text-caption text-text-secondary">Last updated {LAST_UPDATED}.</p>
      <Link to="/" className="pixel-btn justify-self-start" data-variant="primary">
        ◀ Back to the hall
      </Link>
    </MenuPage>
  );
}
