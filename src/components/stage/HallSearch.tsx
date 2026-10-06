// Search, filters and Random player above the device (FR-13, D-072): what used to be /explore now
// narrows the badges hanging in the hall, so the swing, flip and OPEN stay the way to meet people.
// The filters live in the address (?q=&dept=&skill=&featured=1), so a search can be shared.

import { useId, useRef, useState } from 'react';
import { hallUrl } from '../../lib/publicUrl';
import type { Facet, Filters } from '../../lib/search';
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
}

export function HallSearch({ filters, onChange, onClear, onRandom, options, shown, total, ready }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const picked = [filters.department, filters.skill, filters.featured || null].filter(Boolean).length;
  const [open, setOpen] = useState(picked > 0);
  const [sharing, setSharing] = useState(false);
  const filtered = Boolean(filters.q.trim()) || picked > 0;
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

      <div className="flex flex-wrap items-center gap-space-3">
        <p className="m-0 font-display tracking-[0.04em]" role="status" aria-live="polite">
          {ready ? count : 'Loading players…'}
        </p>
        {filtered && (
          <button type="button" className="pixel-btn" onClick={clear}>
            Clear all
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
