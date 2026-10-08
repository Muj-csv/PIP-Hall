// Below the device, one thing at a time (D-126): the event while one is on, today's Missions, and
// Recent in the hall, as tabs instead of three panels stacked under each other. The event comes
// first while it runs (the banner leads to it); otherwise the Missions. Every panel stays mounted,
// so switching tabs never reloads or loses what someone was doing. With one panel only (sample
// data: the Missions), there are no tabs at all; an empty hall has no Missions to offer.

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { seasonService } from '../../services/seasonService';
import type { PublicCard } from '../../types/card';
import type { Filters } from '../../lib/search';
import { MissionsPanel } from './MissionsPanel';
import { recentAvailable, RecentStrip } from './RecentStrip';
import { SeasonPanel } from './SeasonPanel';

type Tab = 'event' | 'missions' | 'recent';
const LABEL: Readonly<Record<Tab, string>> = { event: 'Event', missions: 'Missions', recent: 'Recent' };

interface Props {
  cards: PublicCard[];
  onSearch: (patch: Partial<Filters>) => void;
  onRandom: () => void;
  onPips: (balance: number) => void;
}

export function HallTabs({ cards, onSearch, onRandom, onPips }: Props) {
  const [live, setLive] = useState(false);
  const [picked, setPicked] = useState<Tab | null>(null);
  const refs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  useEffect(() => {
    if (!recentAvailable) return;
    let on = true;
    seasonService
      .current()
      .then((s) => on && setLive(Boolean(s.live)))
      .catch(() => undefined); // no event tab; the Missions still work
    return () => {
      on = false;
    };
  }, []);

  const tabs: Tab[] = [...(live ? (['event'] as const) : []), ...(cards.length > 0 ? (['missions'] as const) : []), ...(recentAvailable ? (['recent'] as const) : [])];
  if (tabs.length === 0) return null;
  const tab: Tab = picked && tabs.includes(picked) ? picked : tabs[0]!;

  const panels = (
    <>
      {live && (
        <div id="hall-panel-event" role="tabpanel" aria-labelledby="hall-tab-event" hidden={tab !== 'event'}>
          <SeasonPanel cards={cards} onSearch={onSearch} onRandom={onRandom} onPips={onPips} />
        </div>
      )}
      {cards.length > 0 && (
        <div id="hall-panel-missions" role={tabs.length > 1 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 1 ? 'hall-tab-missions' : undefined} hidden={tab !== 'missions'}>
          <MissionsPanel cards={cards} onSearch={onSearch} onRandom={onRandom} onPips={onPips} />
        </div>
      )}
      {recentAvailable && (
        <div id="hall-panel-recent" role={tabs.length > 1 ? 'tabpanel' : undefined} aria-labelledby={tabs.length > 1 ? 'hall-tab-recent' : undefined} hidden={tab !== 'recent'}>
          <RecentStrip />
        </div>
      )}
    </>
  );
  if (tabs.length === 1) return <div className="hall-tabs">{panels}</div>;

  const onKey = (e: KeyboardEvent) => {
    const i = tabs.indexOf(tab);
    const n = tabs.length;
    const next = e.key === 'ArrowRight' ? tabs[(i + 1) % n] : e.key === 'ArrowLeft' ? tabs[(i + n - 1) % n] : e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[n - 1] : null;
    if (!next) return;
    e.preventDefault();
    setPicked(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="hall-tabs">
      <div role="tablist" aria-label="In the hall" className="tabs" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t}
            ref={(el) => {
              refs.current[t] = el;
            }}
            id={`hall-tab-${t}`}
            type="button"
            role="tab"
            className="pixel-btn tab"
            aria-selected={tab === t}
            aria-controls={`hall-panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setPicked(t)}
          >
            {LABEL[t]}
          </button>
        ))}
      </div>
      {panels}
    </div>
  );
}
