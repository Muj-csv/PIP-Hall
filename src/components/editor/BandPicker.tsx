// My Card → Customize → Band (V2-22, D-134): pick up to 3 things you've earned for the strip at
// the top of your badge, in your order: affiliation pins, admin-made badges, ribbons, an officer
// seat (the rest stay on the profile). Until you choose, the hall picks (your officer seat, newest ribbons, badges); "Let the hall
// pick" goes back to that. The database checks every pick (set_band).

import { useState } from 'react';
import { BAND_KIND, bandInOrder, bandLabel, MAX_BAND, moveBand, toggleBand } from '../../lib/band';
import type { BandItem } from '../../types/mart';
import { BandPin } from '../cards/BandPin';

interface Props {
  /** The band chosen (null: the hall picks) and everything that could go on it. */
  chosen: string[] | null;
  items: BandItem[];
  busy: boolean;
  onSave: (refs: string[] | null) => void;
}

export function BandPicker({ chosen, items, busy, onSave }: Props) {
  // Picks that are no longer earned drop out of the draft (the database would refuse them).
  const [draft, setDraft] = useState<string[] | null>(() => (chosen ? bandInOrder(chosen, items).map((i) => i.ref) : null));
  const picks = draft ?? [];
  const full = picks.length >= MAX_BAND;
  const changed = JSON.stringify(draft) !== JSON.stringify(chosen);
  const onBand = bandInOrder(picks, items);

  return (
    <section className="menu-panel" aria-labelledby="wear-band">
      <h2 id="wear-band" className="panel-title">
        Band
      </h2>
      <p className="m-0 field-hint">
        Pick up to {MAX_BAND} things you’ve earned for the strip at the top of your badge, in your order. Everything you’ve earned stays on your profile, on the band or not.
      </p>
      {items.length === 0 ? (
        <p className="m-0">Nothing to put on your band yet. Affiliation pins, badges, ribbons and officer seats show up here once you have them.</p>
      ) : (
        <>
          <p className="m-0 font-display tracking-[0.04em]" role="status">
            {draft === null ? 'The hall picks your band for now.' : `${picks.length} of ${MAX_BAND} on your band`}
          </p>
          {onBand.length > 0 && (
            <ol className="band-picks" aria-label="On your band, in order">
              {onBand.map((item, i) => (
                <li key={item.ref}>
                  <span className="band-pick-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <BandPin item={item} />
                  <span className="min-w-0 flex-1">{bandLabel(item)}</span>
                  <span className="flex gap-space-1">
                    <button type="button" className="pixel-btn icon-btn" disabled={i === 0} onClick={() => setDraft(moveBand(picks, item.ref, -1))} aria-label={`Move ${bandLabel(item)} earlier`}>
                      ↑
                    </button>
                    <button type="button" className="pixel-btn icon-btn" disabled={i === onBand.length - 1} onClick={() => setDraft(moveBand(picks, item.ref, 1))} aria-label={`Move ${bandLabel(item)} later`}>
                      ↓
                    </button>
                    <button type="button" className="pixel-btn icon-btn" onClick={() => setDraft(toggleBand(picks, item.ref))} aria-label={`Take ${bandLabel(item)} off`}>
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <fieldset className="band-choices">
            <legend className="field-label">What you’ve earned</legend>
            {items.map((item) => {
              const on = picks.includes(item.ref);
              return (
                <label key={item.ref} className="toggle band-choice">
                  <input type="checkbox" checked={on} disabled={!on && full} onChange={() => setDraft(toggleBand(picks, item.ref))} />
                  <BandPin item={item} />
                  <span>
                    {bandLabel(item)} <span className="text-caption text-text-secondary">· {BAND_KIND[item.kind]}</span>
                  </span>
                </label>
              );
            })}
            {full && <p className="m-0 field-hint">Your band is full: take one off to add another.</p>}
          </fieldset>
          <div className="flex flex-wrap gap-space-2">
            <button type="button" className="pixel-btn" data-variant="primary" disabled={busy || !changed} onClick={() => onSave(draft)}>
              Save band
            </button>
            {(chosen !== null || draft !== null) && (
              <button
                type="button"
                className="pixel-btn"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  if (chosen !== null) onSave(null);
                }}
              >
                Let the hall pick
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
