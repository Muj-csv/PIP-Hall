// One row of filter chips (FR-13). Picking a chip again clears it; the state is spoken through
// aria-pressed and shown with a ✓, never by colour alone.

import type { Facet } from '../../lib/search';

interface Props {
  label: string;
  facets: Facet[];
  value: string | null;
  onChange: (v: string | null) => void;
}

export function FilterChips({ label, facets, value, onChange }: Props) {
  if (!facets.length) return null;
  const picked = value?.toLowerCase();
  return (
    <div role="group" aria-label={label} className="grid gap-space-2">
      <span className="font-display text-caption tracking-[0.06em]" aria-hidden="true">
        {label.toUpperCase()}
      </span>
      <div className="chips">
        {facets.map((f) => {
          const on = f.value.toLowerCase() === picked;
          return (
            <button key={f.value} type="button" className="chip" aria-pressed={on} onClick={() => onChange(on ? null : f.value)}>
              {on && <span aria-hidden="true">✓ </span>}
              {f.value} <span className="chip-count">{f.count}</span>
              <span className="sr-only"> {f.count === 1 ? 'player' : 'players'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
