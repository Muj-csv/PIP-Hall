// Admin → Rewards (D-087): design badge borders and badges from presets, and give badges to
// members. A badge can pay PIPs and/or give a border. The database checks is_admin() and every
// preset again (supabase/migrations/*_admin_rewards.sql); this screen only offers valid choices.

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { DEFAULT_STYLE, DOODLES, DOODLE_LABEL, GEMS, GEM_TONES, MOTIONS, MOTION_LABEL, TONES, keyFrom, type FrameStyle, type Gem, type GemTone, type Tone } from '../../lib/rewards';
import { GEM_SPRITES, GEM_TONE_PALETTES } from '../../lib/sprites';
import { martErrorMessage, martService } from '../../services/martService';
import { pipService } from '../../services/pipService';
import type { PublicCard } from '../../types/card';
import type { AdminMartItem } from '../../types/mart';
import type { Achievement } from '../../types/pips';
import { MemberCard } from '../cards/MemberCard';
import { DialogueBox } from '../dialogue/DialogueBox';
import { SelectField, TextField, Toggle } from '../editor/fields';
import { SpriteCanvas } from '../pixel/SpriteCanvas';

const TONE_OPTIONS = TONES.map((t) => ({ value: t, label: t.replace('-', ' ') }));
const GEM_TONE_LABEL: Record<GemTone, string> = { gold: 'Gold', green: 'Green', sky: 'Sky', plum: 'Plum', red: 'Rose', silver: 'Silver' };

type Load = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: AdminMartItem[]; badges: Achievement[] };

export function RewardsManager({ members, onDone }: { members: PublicCard[]; onDone: (message: string) => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  useEffect(() => {
    let on = true;
    Promise.all([martService.adminItems(), pipService.catalog()])
      .then(([items, all]) => on && setLoad({ status: 'ready', items, badges: all.filter((a) => a.custom) }))
      .catch(() => on && setLoad({ status: 'error' }));
    return () => {
      on = false;
    };
  }, [attempt]);

  if (load.status === 'loading') return <DialogueBox text="Opening the reward room…" emote="pending" />;
  if (load.status === 'error')
    return (
      <DialogueBox text="Can’t load rewards. If this hall hasn’t run the admin-rewards update yet, an admin needs to run it (see the deploy guide)." emote="attention">
        <button type="button" className="hw-btn" data-variant="small" onClick={() => { setLoad({ status: 'loading' }); reload(); }}>
          RETRY
        </button>
      </DialogueBox>
    );

  const done = (m: string) => {
    onDone(m);
    reload();
  };
  return (
    <div className="grid gap-space-4">
      <BorderBuilder items={load.items} preview={members[0]} onDone={done} />
      <BadgeBuilder badges={load.badges} items={load.items} onDone={done} />
      <GiveBadge badges={load.badges} members={members} onDone={done} />
    </div>
  );
}

// ---------------------------------------------------------------- borders

function BorderBuilder({ items, preview, onDone }: { items: AdminMartItem[]; preview?: PublicCard; onDone: (m: string) => void }) {
  const designed = items.filter((i) => i.style);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('300');
  const [forSale, setForSale] = useState(true);
  const [style, setStyle] = useState<FrameStyle>(DEFAULT_STYLE);
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FrameStyle>(k: K, v: FrameStyle[K]) => setStyle((s) => ({ ...s, [k]: v }));

  const edit = (i: AdminMartItem) => {
    setEditing(i.key);
    setName(i.name);
    setDescription(i.description);
    setPrice(String(i.price));
    setForSale(i.for_sale);
    setStyle(i.style ?? DEFAULT_STYLE);
    setError(undefined);
  };
  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setPrice('300');
    setForSale(true);
    setStyle(DEFAULT_STYLE);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const key = editing ?? keyFrom(name);
    const p = Number(price);
    if (key.length < 2) return setError('Give it a name with at least two letters or numbers.');
    if (!Number.isInteger(p) || p < 1) return setError('Price is a whole number of PIPs, at least 1.');
    setBusy(true);
    setError(undefined);
    try {
      await martService.saveFrame({ key, name: name.trim(), description: description.trim(), price: p, forSale, style });
      onDone(`${editing ? 'Saved' : 'Added'} the ${name.trim()} border.`);
      reset();
    } catch (err) {
      setError(martErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (i: AdminMartItem) => {
    try {
      await martService.setItemActive(i.key, !i.active);
      onDone(i.active ? `${i.name} is off the shelf. Owners keep it.` : `${i.name} is back on offer.`);
    } catch (err) {
      setError(martErrorMessage(err));
    }
  };

  return (
    <section className="menu-panel" aria-labelledby="rw-borders">
      <h2 id="rw-borders" className="panel-title">
        Borders
      </h2>
      <p className="m-0 field-hint">Design a badge border from the hall’s palette. Sell it in the PIP MART, or keep it as a reward that comes with a badge.</p>
      <div className="rewards-builder">
        <form className="grid gap-space-3 content-start" onSubmit={save} noValidate aria-label={editing ? `Edit ${name}` : 'New border'}>
          <TextField field="border-name" label="Name" value={name} onChange={setName} max={40} error={error} />
          <TextField field="border-description" label="Description" value={description} onChange={setDescription} max={120} />
          <div className="rewards-row">
            <SelectField field="border-frame" label="Frame" value={style.frame} options={TONE_OPTIONS} onChange={(v: Tone) => set('frame', v)} />
            <SelectField field="border-hi" label="Highlight" value={style.hi} options={TONE_OPTIONS} onChange={(v: Tone) => set('hi', v)} />
            <SelectField field="border-shade" label="Shade" value={style.shade} options={TONE_OPTIONS} onChange={(v: Tone) => set('shade', v)} />
          </div>
          <div className="rewards-row">
            <SelectField field="border-trim" label="Trim" value={style.trim} options={TONE_OPTIONS} onChange={(v: Tone) => set('trim', v)} />
            <SelectField
              field="border-gap"
              label="Trim spacing"
              value={String(style.gap)}
              options={['2', '3', '4', '5', '6'].map((g) => ({ value: g, label: `${g} pixels` }))}
              onChange={(v) => set('gap', Number(v))}
            />
            <SelectField field="border-motion" label="Motion" value={style.motion} options={MOTIONS.map((m) => ({ value: m, label: MOTION_LABEL[m] }))} onChange={(v) => set('motion', v)} />
          </div>
          <SelectField field="border-doodle" label="Corner doodles" value={style.doodle} options={DOODLES.map((d) => ({ value: d, label: DOODLE_LABEL[d] }))} onChange={(v) => set('doodle', v)} />
          <div className="rewards-row">
            <TextField field="border-price" label="Price (PIPs)" value={price} onChange={setPrice} inputMode="text" />
            <Toggle field="border-sale" label="Sold in the PIP MART" checked={forSale} onChange={setForSale} hint={forSale ? undefined : 'Reward only: given with a badge.'} />
          </div>
          <div className="flex flex-wrap gap-space-2">
            <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy}>
              {editing ? 'Save border' : 'Add border'}
            </button>
            {editing && (
              <button type="button" className="pixel-btn" onClick={reset}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {preview && (
          <div className="rewards-preview" aria-label="Preview">
            <MemberCard card={preview} flipped={false} focusable={false} onShowQr={() => undefined} appearance={{ frame: 'preview', label: null, style }} />
          </div>
        )}
      </div>
      {designed.length > 0 && (
        <ul className="rewards-list" aria-label="Designed borders">
          {designed.map((i) => (
            <li key={i.key}>
              <b>{i.name}</b>
              <span className="text-caption text-text-secondary">
                {i.for_sale ? `${i.price} PIPs` : 'Reward only'} · {i.active ? 'on offer' : 'off the shelf'}
              </span>
              <span className="flex flex-wrap gap-space-2">
                <button type="button" className="pixel-btn" onClick={() => edit(i)}>
                  Edit<span className="sr-only"> {i.name}</span>
                </button>
                <button type="button" className="pixel-btn" onClick={() => void toggleActive(i)}>
                  {i.active ? 'Retire' : 'Offer again'}
                  <span className="sr-only"> {i.name}</span>
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- badges

function GemPreview({ gem, tone, size = 28 }: { gem: Gem; tone: GemTone; size?: number }) {
  return <SpriteCanvas sprite={GEM_SPRITES[gem]!} palette={GEM_TONE_PALETTES[tone]!} className="rewards-gem" style={{ width: size, height: size }} />;
}

function BadgeBuilder({ badges, items, onDone }: { badges: Achievement[]; items: AdminMartItem[]; onDone: (m: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState('100');
  const [gem, setGem] = useState<Gem>('star');
  const [tone, setTone] = useState<GemTone>('gold');
  const [frame, setFrame] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const frameOptions = useMemo(() => [{ value: '', label: 'No border' }, ...items.map((i) => ({ value: i.key, label: i.name }))], [items]);

  const edit = (b: Achievement) => {
    setEditing(b.key);
    setName(b.name);
    setDescription(b.description);
    setReward(String(b.reward));
    setGem(b.gem ?? 'star');
    setTone(b.tone ?? 'gold');
    setFrame(b.reward_frame ?? '');
    setError(undefined);
  };
  const reset = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setReward('100');
    setGem('star');
    setTone('gold');
    setFrame('');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const key = editing ?? keyFrom(name);
    const r = Number(reward);
    if (key.length < 2) return setError('Give it a name with at least two letters or numbers.');
    if (!Number.isInteger(r) || r < 0) return setError('The PIP reward is a whole number, 0 or more.');
    setBusy(true);
    setError(undefined);
    try {
      await martService.saveBadge({ key, name: name.trim(), description: description.trim(), reward: r, gem, tone, frame: frame || null });
      onDone(`${editing ? 'Saved' : 'Added'} the ${name.trim()} badge.`);
      reset();
    } catch (err) {
      setError(martErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="menu-panel" aria-labelledby="rw-badges">
      <h2 id="rw-badges" className="panel-title">
        Badges
      </h2>
      <p className="m-0 field-hint">A badge is an achievement you give by hand. It pins a gem on the member’s card and profile, and can pay PIPs and give a border.</p>
      <form className="grid gap-space-3" onSubmit={save} noValidate aria-label={editing ? `Edit ${name}` : 'New badge'}>
        <div className="rewards-row">
          <TextField field="badge-name" label="Name" value={name} onChange={setName} max={40} error={error} />
          <TextField field="badge-reward" label="PIP reward" value={reward} onChange={setReward} />
        </div>
        <TextField field="badge-description" label="What it’s for" value={description} onChange={setDescription} max={120} />
        <fieldset className="rewards-gems">
          <legend className="field-label">Gem</legend>
          {GEMS.map((g) => (
            <label key={g} className="rewards-gem-pick" data-picked={gem === g || undefined}>
              <input type="radio" name="badge-gem" value={g} checked={gem === g} onChange={() => setGem(g)} className="sr-only" />
              <GemPreview gem={g} tone={tone} />
              <span>{g}</span>
            </label>
          ))}
        </fieldset>
        <div className="rewards-row">
          <SelectField field="badge-tone" label="Colour" value={tone} options={GEM_TONES.map((t) => ({ value: t, label: GEM_TONE_LABEL[t] }))} onChange={setTone} />
          <SelectField field="badge-frame" label="Gives a border" value={frame} options={frameOptions} onChange={setFrame} />
        </div>
        <div className="flex flex-wrap gap-space-2">
          <button type="submit" className="pixel-btn" data-variant="primary" disabled={busy}>
            {editing ? 'Save badge' : 'Add badge'}
          </button>
          {editing && (
            <button type="button" className="pixel-btn" onClick={reset}>
              Cancel
            </button>
          )}
        </div>
      </form>
      {badges.length > 0 && (
        <ul className="rewards-list" aria-label="Badges">
          {badges.map((b) => (
            <li key={b.key}>
              <span className="flex items-center gap-space-2">
                <GemPreview gem={b.gem ?? 'star'} tone={b.tone ?? 'gold'} size={20} />
                <b>{b.name}</b>
              </span>
              <span className="text-caption text-text-secondary">
                {b.reward > 0 ? `${b.reward} PIPs` : 'No PIPs'}
                {b.reward_frame ? ` · ${items.find((i) => i.key === b.reward_frame)?.name ?? b.reward_frame} border` : ''}
              </span>
              <button type="button" className="pixel-btn" onClick={() => edit(b)}>
                Edit<span className="sr-only"> {b.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- giving

function GiveBadge({ badges, members, onDone }: { badges: Achievement[]; members: PublicCard[]; onDone: (m: string) => void }) {
  const [pickedMember, setMember] = useState('');
  const [pickedBadge, setBadge] = useState('');
  // A pick that no longer exists (or none yet, before the first badge) falls back to the first one.
  const member = members.some((m) => m.profile_id === pickedMember) ? pickedMember : (members[0]?.profile_id ?? '');
  const badge = badges.some((b) => b.key === pickedBadge) ? pickedBadge : (badges[0]?.key ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  if (badges.length === 0 || members.length === 0)
    return (
      <section className="menu-panel" aria-labelledby="rw-give">
        <h2 id="rw-give" className="panel-title">
          Give a badge
        </h2>
        <p className="m-0 field-hint">{badges.length === 0 ? 'Add a badge above first.' : 'Badges go to members whose card is in the hall.'}</p>
      </section>
    );
  const who = members.find((m) => m.profile_id === member)?.card.full_name ?? 'them';
  const what = badges.find((b) => b.key === badge)?.name ?? 'the badge';

  const act = async (give: boolean) => {
    setBusy(true);
    setError(undefined);
    try {
      const changed = give ? await martService.grantBadge(member, badge) : await martService.revokeBadge(member, badge);
      onDone(
        give
          ? changed ? `Gave ${what} to ${who}.` : `${who} already has ${what}.`
          : changed ? `Took ${what} back from ${who}. What it gave stays theirs.` : `${who} doesn’t have ${what}.`,
      );
    } catch (err) {
      setError(martErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="menu-panel" aria-labelledby="rw-give">
      <h2 id="rw-give" className="panel-title">
        Give a badge
      </h2>
      <div className="rewards-row">
        <SelectField
          field="give-member"
          label="Member"
          value={member}
          options={members.map((m) => ({ value: m.profile_id, label: `${m.card.full_name} (@${m.username})` }))}
          onChange={setMember}
          error={error}
        />
        <SelectField field="give-badge" label="Badge" value={badge} options={badges.map((b) => ({ value: b.key, label: b.name }))} onChange={setBadge} />
      </div>
      <div className="flex flex-wrap gap-space-2">
        <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void act(true)}>
          Give badge
        </button>
        <button type="button" className="pixel-btn" disabled={busy} onClick={() => void act(false)}>
          Take back
        </button>
      </div>
    </section>
  );
}
