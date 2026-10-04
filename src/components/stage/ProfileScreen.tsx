// The menu screen OPEN shows inside the device (brief §3): the player's full quest list.
// The shareable page at /member/:username arrives in Phase 4; this is its in-hall preview.

import { useEffect, useRef } from 'react';
import type { PublicCard } from '../../types/card';

export function ProfileScreen({ card, onBack }: { card: PublicCard; onBack: () => void }) {
  const back = useRef<HTMLButtonElement>(null);
  const c = card.card;
  useEffect(() => back.current?.focus(), []);

  return (
    <section className="menu-screen" aria-labelledby="profile-name">
      <button ref={back} type="button" className="hw-btn justify-self-start" data-variant="small" onClick={onBack}>
        ◀ BACK
      </button>
      <h2 id="profile-name">{c.full_name}</h2>
      <div className="meta">
        @{c.username}
        {c.department ? ` · ${c.department}` : ''}
        {c.role ? ` · ${c.role}` : ''}
      </div>
      {c.bio && <p className="m-0">{c.bio}</p>}
      {c.projects.length > 0 ? (
        <ol aria-label="Projects">
          {c.projects.map((p, i) => (
            <li key={`${p.title}-${i}`}>
              <b>
                {String(i + 1).padStart(2, '0')} {p.title}
              </b>
              <br />
              {[p.description, p.language].filter(Boolean).join(' · ')}
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0">No quests yet.</p>
      )}
    </section>
  );
}
