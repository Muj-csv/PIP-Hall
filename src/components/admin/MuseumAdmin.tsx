// Admin → Museum (V2-20, D-133): the Museum, curated end to end. Nothing hangs by itself; its tabs
// are what the admins decide: members' suggestions, featured projects, the events' winners, the
// Featured Members room, and the rooms' order, signs and doors. The archive and the wings keep their
// own tabs.

import { useRef, useState, type KeyboardEvent } from 'react';
import type { PublicCard } from '../../types/card';
import { MuseumFeatures } from './MuseumFeatures';
import { MuseumMembers } from './MuseumMembers';
import { MuseumRooms } from './MuseumRooms';
import { MuseumWinners } from './MuseumWinners';

const TABS = ['suggestions', 'projects', 'winners', 'members', 'rooms'] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { suggestions: 'Suggestions', projects: 'Projects', winners: 'Winners', members: 'Members', rooms: 'Rooms' };

export function MuseumAdmin({ cards, onDone }: { cards: readonly PublicCard[]; onDone: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('suggestions');
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const n = TABS.length;
    const next = e.key === 'ArrowRight' ? TABS[(i + 1) % n] : e.key === 'ArrowLeft' ? TABS[(i + n - 1) % n] : e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[n - 1] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    refs.current[next]?.focus();
  };
  return (
    <div className="grid gap-space-3">
      <div role="tablist" aria-label="The Museum" className="tabs" onKeyDown={onKey}>
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              refs.current[t] = el;
            }}
            id={`museum-tab-${t}`}
            type="button"
            role="tab"
            className="pixel-btn tab"
            aria-selected={tab === t}
            aria-controls="museum-panel"
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {LABEL[t]}
          </button>
        ))}
      </div>
      <div id="museum-panel" role="tabpanel" aria-labelledby={`museum-tab-${tab}`}>
        {tab === 'suggestions' && <MuseumFeatures key="offers" offersOnly onDone={onDone} />}
        {tab === 'projects' && <MuseumFeatures key="all" onDone={onDone} />}
        {tab === 'winners' && <MuseumWinners onDone={onDone} />}
        {tab === 'members' && <MuseumMembers cards={cards} onDone={onDone} />}
        {tab === 'rooms' && <MuseumRooms onDone={onDone} />}
      </div>
    </div>
  );
}
