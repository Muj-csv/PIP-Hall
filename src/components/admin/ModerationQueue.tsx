// The admin's queue (FR-08): Pending / Published / Featured tabs. Each tab is a list of cards
// on the left and the selected card's ReviewPanel on the right. The Affiliations tab manages the
// labels admins give members (D-067).

import { useRef, useState, type KeyboardEvent } from 'react';
import type { Queue } from '../../services/adminService';
import { DialogueBox } from '../dialogue/DialogueBox';
import { AffiliationsManager } from './AffiliationsManager';
import { PendingReview, PublishedReview } from './ReviewPanel';

type Tab = 'pending' | 'published' | 'featured' | 'affiliations';
const TABS: Tab[] = ['pending', 'published', 'featured', 'affiliations'];
const LABEL: Record<Tab, string> = { pending: 'Pending', published: 'Published', featured: 'Featured', affiliations: 'Affiliations' };
const EMPTY: Record<Tab, string> = {
  affiliations: '',
  pending: 'Nobody’s waiting for review. New cards show up here when members submit them.',
  published: 'The hall is empty. Approve a card and it hangs here.',
  featured: 'No featured cards yet. Feature one from the Published tab and it wears a star.',
};

interface Row {
  id: string;
  name: string;
  detail: string;
}

export function ModerationQueue({ queue, onDone }: { queue: Queue; onDone: (message: string) => void }) {
  const [tab, setTab] = useState<Tab>('pending');
  const [picked, setPicked] = useState<Partial<Record<Tab, string>>>({});
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ pending: null, published: null, featured: null, affiliations: null });

  const featured = queue.published.filter((c) => c.is_featured);
  const rows: Record<Tab, Row[]> = {
    pending: queue.pending.map((i) => ({ id: i.profile.id, name: i.profile.full_name, detail: `@${i.profile.username}${i.live ? ' · update to a live card' : ' · new card'}` })),
    published: queue.published.map((c) => ({ id: c.profile_id, name: c.card.full_name, detail: `@${c.username} · No.${String(c.no).padStart(3, '0')}${c.is_featured ? ' · ★ featured' : ''}` })),
    featured: featured.map((c) => ({ id: c.profile_id, name: c.card.full_name, detail: `@${c.username} · No.${String(c.no).padStart(3, '0')}` })),
    affiliations: [],
  };
  const list = rows[tab];
  // The picked card, or the first one if it left this tab (approved, unpublished…).
  const selectedId = list.find((r) => r.id === picked[tab])?.id ?? list[0]?.id ?? null;

  const onTabKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const n = TABS.length;
    const next = e.key === 'ArrowRight' ? TABS[(i + 1) % n] : e.key === 'ArrowLeft' ? TABS[(i + n - 1) % n] : e.key === 'Home' ? TABS[0] : e.key === 'End' ? TABS[n - 1] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  };

  const pendingItem = tab === 'pending' ? queue.pending.find((i) => i.profile.id === selectedId) : undefined;
  const liveCard = tab === 'published' || tab === 'featured' ? queue.published.find((c) => c.profile_id === selectedId) : undefined;

  return (
    <div className="grid gap-space-4">
      <div role="tablist" aria-label="Moderation queue" className="tabs" onKeyDown={onTabKey}>
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[t] = el;
            }}
            id={`tab-${t}`}
            type="button"
            role="tab"
            className="pixel-btn tab"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => setTab(t)}
          >
            {t === 'affiliations' ? LABEL[t] : `${LABEL[t]} (${rows[t].length})`}
          </button>
        ))}
      </div>
      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'affiliations' ? (
          <AffiliationsManager onDone={onDone} />
        ) : list.length === 0 ? (
          <DialogueBox text={EMPTY[tab]} emote={tab === 'pending' ? 'approved' : undefined} />
        ) : (
          <div className="queue">
            <ul className="queue-list" aria-label={`${LABEL[tab]} cards`}>
              {list.map((r) => (
                <li key={r.id}>
                  <button type="button" className="queue-row" aria-current={r.id === selectedId} onClick={() => setPicked((p) => ({ ...p, [tab]: r.id }))}>
                    <b>{r.name}</b>
                    <small>{r.detail}</small>
                  </button>
                </li>
              ))}
            </ul>
            {pendingItem && <PendingReview key={pendingItem.profile.id} item={pendingItem} onDone={onDone} />}
            {liveCard && <PublishedReview key={liveCard.profile_id} card={liveCard} onDone={onDone} />}
          </div>
        )}
      </div>
    </div>
  );
}
