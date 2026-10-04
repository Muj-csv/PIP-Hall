// /explore — every player at once (FR-13): search by name, handle, role, skill or project,
// filter by department, skill and featured, or jump to a random player. Filters live in the URL.

import { useMemo, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { CompactCard } from '../components/explore/CompactCard';
import { FilterChips } from '../components/explore/FilterChips';
import { MenuPage } from '../components/shell/MenuPage';
import { memberPath } from '../lib/publicUrl';
import { facets, filtersFromParams, filtersToParams, indexCards, isFiltered, NO_FILTERS, randomCard, search, type Filters } from '../lib/search';
import { useCards } from '../lib/useCards';

export default function Explore() {
  const cards = useCards();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const filters = filtersFromParams(params);

  const all = useMemo(() => (cards.status === 'ready' ? cards.cards : []), [cards]);
  const index = useMemo(() => indexCards(all), [all]);
  const options = useMemo(() => facets(all), [all]);
  const results = useMemo(() => search(index, filters), [index, filters]);

  const set = (patch: Partial<Filters>) => setParams(filtersToParams({ ...filters, ...patch }), { replace: true });
  const clear = () => {
    setParams(filtersToParams(NO_FILTERS), { replace: true });
    input.current?.focus();
  };
  const random = () => {
    const pick = randomCard(results.length ? results : all);
    if (pick) navigate(memberPath(pick.username));
  };

  const filtered = isFiltered(filters);
  const countText = filtered ? `${results.length} of ${all.length} ${all.length === 1 ? 'player' : 'players'} match` : `${all.length} ${all.length === 1 ? 'player' : 'players'} in the hall`;

  return (
    <MenuPage title="Explore" wide>
      <form role="search" className="explore-bar" onSubmit={(e) => e.preventDefault()}>
        <label htmlFor="explore-q" className="field-label">
          Search players
        </label>
        <div className="flex flex-wrap gap-space-2">
          <input
            ref={input}
            id="explore-q"
            type="search"
            className="pixel-input min-w-0 flex-1 basis-[240px]"
            placeholder="Name, @handle, role, skill or project"
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="button" className="pixel-btn" data-variant="primary" onClick={random} disabled={!all.length}>
            <span aria-hidden="true">? </span>Random player
          </button>
        </div>
      </form>

      {cards.status === 'loading' && <DialogueBox text="Rounding up the players…" emote="pending" />}
      {cards.status === 'error' && (
        <DialogueBox text="Can’t reach the hall right now. Check your connection and try again." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={cards.retry}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {cards.status === 'ready' && all.length === 0 && (
        <DialogueBox text="No players in the hall yet. Make your card and be the first!" emote="attention">
          <Link to="/edit" className="hw-btn no-underline" data-variant="small">
            MAKE CARD
          </Link>
        </DialogueBox>
      )}

      {cards.status === 'ready' && all.length > 0 && (
        <>
          <div className="grid gap-space-3">
            <FilterChips label="Department" facets={options.departments} value={filters.department} onChange={(department) => set({ department })} />
            <FilterChips label="Skill" facets={options.skills} value={filters.skill} onChange={(skill) => set({ skill })} />
            <div className="flex flex-wrap items-center gap-space-3">
              <button type="button" className="chip" aria-pressed={filters.featured} onClick={() => set({ featured: !filters.featured })}>
                <span aria-hidden="true">{filters.featured ? '✓ ★ ' : '★ '}</span>
                Featured only
              </button>
              {filtered && (
                <button type="button" className="pixel-btn" onClick={clear}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          <p className="m-0 font-display tracking-[0.04em]" role="status" aria-live="polite">
            {countText}
          </p>

          {results.length === 0 ? (
            <DialogueBox text="Nobody matches that. Try fewer words, or clear a filter." emote="attention">
              <button type="button" className="hw-btn" data-variant="small" onClick={clear}>
                CLEAR
              </button>
            </DialogueBox>
          ) : (
            <ul className="explore-grid" aria-label="Players">
              {results.map((c) => (
                <li key={c.profile_id}>
                  <CompactCard card={c} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </MenuPage>
  );
}
