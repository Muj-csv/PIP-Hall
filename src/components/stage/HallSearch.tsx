// Search, filters and Random player above the device (FR-13, D-072): what used to be /explore now
// narrows the badges hanging in the hall, so the swing, flip and OPEN stay the way to meet people.
// The filters live in the address (?q=&dept=&skill=&featured=1&officers=1), so a search can be shared.
// The Officers door (V2-10b, D-123) shows only the current officers, in their team's order.

import { useId, useRef, useState } from 'react';
import { hallUrl } from '../../lib/publicUrl';
import type { Officer } from '../../lib/officers';
import { whyPicked, type Facet, type Filters } from '../../lib/search';
import type { PublicCard } from '../../types/card';
import { Link } from 'react-router';
import { QrSheet } from '../cards/QrFullscreen';
import { FilterChips } from '../explore/FilterChips';

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
  onRandom: () => void;
  options: { departments: Facet[]; skills: Facet[] };
  /** Players shown in the hall now, and in total. */
  shown: number;
  total: number;
  ready: boolean;
  /** Opens the Passport (V2-2), with how many stamps it holds. */
  onPassport: () => void;
  stamps: number;
  /** The matching players, and the one in front of Pip now (for "Why Pip picked"). */
  results: readonly PublicCard[];
  current?: PublicCard;
  /** Walks Pip to a result picked from the list. */
  onPick: (username: string) => void;
  /** The map of the hall is open (V2-8: dense enough, or an admin previewing). */
  mapOpen?: boolean;
  /** The current officers by member id; the Officers door shows when there are any (D-123). */
  officers?: ReadonlyMap<string, Officer>;
}

const NO_OFFICERS: ReadonlyMap<string, Officer> = new Map();

export function HallSearch({ filters, onChange, onClear, onRandom, options, shown, total, ready, onPassport, stamps, results, current, onPick, mapOpen = false, officers = NO_OFFICERS }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const picked = [filters.department, filters.skill, filters.featured || null].filter(Boolean).length;
  const [open, setOpen] = useState(picked > 0);
  const [sharing, setSharing] = useState(false);
  const [listing, setListing] = useState(false);
  const listId = useId();
  const filtered = Boolean(filters.q.trim()) || picked > 0 || Boolean(filters.officers);
  const teams = [...new Set([...officers.values()].map((o) => o.team))];
  const count = filtered ? `${shown} of ${total} ${total === 1 ? 'player' : 'players'} match` : `${total} ${total === 1 ? 'player' : 'players'} in the hall`;

  const clear = () => {
    onClear();
    input.current?.focus();
  };

  return (
    <section className="menu-panel hall-search" aria-label="Find players">
      <form role="search" className="grid gap-space-2" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="hall-q" className="field-label">
          Search players
        </label>
        <div className="flex flex-wrap gap-space-2">
          <input
            ref={input}
            id="hall-q"
            type="search"
            className="pixel-input min-w-0 flex-1 basis-[220px]"
            placeholder="Name, @handle, role, skill or project"
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="button" className="pixel-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
            <span aria-hidden="true">{open ? '▾ ' : '▸ '}</span>
            Filters{picked > 0 ? ` (${picked})` : ''}
          </button>
          <button type="button" className="pixel-btn" data-variant="primary" onClick={onRandom} disabled={!ready || shown === 0}>
            <span aria-hidden="true">? </span>Random player
          </button>
          <button type="button" className="pixel-btn" onClick={onPassport}>
            <span aria-hidden="true">▤ </span>Passport{stamps > 0 ? ` · ${stamps}` : ''}
          </button>
          {mapOpen && (
            <Link to="/network" className="pixel-btn">
              <span aria-hidden="true">✶ </span>Map
            </Link>
          )}
          {(officers.size > 0 || filters.officers) && (
            <button type="button" className="pixel-btn" aria-pressed={Boolean(filters.officers)} onClick={() => onChange({ officers: !filters.officers })}>
              <span aria-hidden="true">{filters.officers ? '✓ ' : '» '}</span>Officers
            </button>
          )}
        </div>
      </form>

      <div id={panelId} hidden={!open} className="grid gap-space-3">
        <FilterChips label="Department" facets={options.departments} value={filters.department} onChange={(department) => onChange({ department })} />
        <FilterChips label="Skill" facets={options.skills} value={filters.skill} onChange={(skill) => onChange({ skill })} />
        <div className="flex flex-wrap items-center gap-space-3">
          <button type="button" className="chip" aria-pressed={filters.featured} onClick={() => onChange({ featured: !filters.featured })}>
            <span aria-hidden="true">{filters.featured ? '✓ ★ ' : '★ '}</span>
            Featured only
          </button>
        </div>
      </div>

      {filters.officers && (
        <p className="m-0 officers-caption">
          {teams.length > 0 ? `The officers of ${teams.join(' and ')}, as named by the hall’s admins.` : 'The officers will appear here once the admins name them.'}
        </p>
      )}
      {filtered && current && (
        <div className="why-picked" aria-live="polite">
          <p className="m-0 font-display tracking-[0.04em]">Why Pip picked {current.card.full_name}</p>
          <ul aria-label={`Why ${current.card.full_name} matches`}>
            {whyPicked(current, filters, officers.get(current.profile_id) ?? null).map((r) => (
              <li key={r}>
                <span aria-hidden="true">✓ </span>
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
      {filtered && listing && shown > 0 && (
        <ol id={listId} className="result-list" aria-label="Matching players">
          {results.map((c) => (
            <li key={c.username}>
              <button type="button" className="result-pick" aria-current={current?.username === c.username || undefined} onClick={() => onPick(c.username)}>
                <b>{c.card.full_name}</b> <span className="font-mono text-caption">@{c.username}</span>
                <span className="text-caption text-text-secondary">{whyPicked(c, filters, officers.get(c.profile_id) ?? null)[0]}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-space-3">
        <p className="m-0 font-display tracking-[0.04em]" role="status" aria-live="polite">
          {ready ? count : 'Loading players…'}
        </p>
        {filtered && (
          <button type="button" className="pixel-btn" onClick={clear}>
            Clear all
          </button>
        )}
        {filtered && shown > 0 && (
          <button type="button" className="pixel-btn" aria-expanded={listing} aria-controls={listId} onClick={() => setListing((o) => !o)}>
            <span aria-hidden="true">{listing ? '▾ ' : '▸ '}</span>
            List results
          </button>
        )}
        {/* For events: show this on a laptop or projector and people scan their way in (D-088). */}
        <button type="button" className="pixel-btn ml-auto" onClick={() => setSharing(true)}>
          <span aria-hidden="true">▣ </span>Share the hall
        </button>
        {sharing && (
          <QrSheet
            url={hallUrl()}
            heading="JOIN THE HALL"
            lead="Scan to meet the members of PIP-Hall."
            codeTitle="QR code for the PIP-Hall website"
            onClose={() => setSharing(false)}
          />
        )}
      </div>
    </section>
  );
}
