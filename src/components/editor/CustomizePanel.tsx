// My Card → Customize (V2-21, D-134): everything a member can wear, in one place: the frame, the
// title and the plate it sits on. Wearing happens here; buying stays in the PIP MART. It asks the
// Mart's own questions (my_mart, my_titles) when the tab first opens, and every change is checked
// by the database. The badge beside the tabs shows what's worn as soon as the hall's looks refresh.

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAppearance } from '../../app/appearanceContext';
import { pipsEnabled } from '../../lib/features';
import { TITLES, type TitleKey } from '../../lib/titles';
import { martErrorMessage, martNotSetUp, martService, type MyTitles } from '../../services/martService';
import type { MyMart } from '../../types/mart';
import { DialogueBox } from '../dialogue/DialogueBox';
import { Panel } from '../shell/MenuPage';

type Load = { status: 'loading' } | { status: 'error'; notSetUp: boolean } | { status: 'ready'; mart: MyMart; titles: MyTitles | null };

export function CustomizePanel({ live }: { live: boolean }) {
  if (!pipsEnabled || !live) {
    return (
      <Panel label="Customize">
        <h2 className="panel-title">Customize</h2>
        <DialogueBox
          text={
            pipsEnabled
              ? 'Customize opens once your card is approved. Then you can wear frames, titles and plates here, and they show on your badge in the hall.'
              : 'Frames, titles and plates come with the PIP MART, which isn’t open in this hall yet.'
          }
          emote={pipsEnabled ? 'pending' : undefined}
        />
      </Panel>
    );
  }
  return <Wardrobe />;
}

function Wardrobe() {
  const appearance = useAppearance();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);

  useEffect(() => {
    let on = true;
    Promise.all([martService.mine(), martService.myTitles().catch(() => null)])
      .then(([mart, titles]) => on && setLoad({ status: 'ready', mart, titles }))
      .catch((e: unknown) => on && setLoad({ status: 'error', notSetUp: martNotSetUp(e) }));
    return () => {
      on = false;
    };
  }, [attempt]);

  const wear = async (move: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await move();
      setNotice({ text: done });
      setAttempt((a) => a + 1);
      appearance.refresh();
    } catch (e) {
      setNotice({ text: martErrorMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  if (load.status === 'loading') return <DialogueBox text="Opening your wardrobe…" emote="pending" />;
  if (load.status === 'error')
    return (
      <DialogueBox text={load.notSetUp ? 'Customizing needs the PIP MART, which isn’t set up in this hall’s database yet.' : 'Can’t reach the hall right now. Check your connection and try again.'} emote="attention">
        <button
          type="button"
          className="hw-btn"
          data-variant="small"
          onClick={() => {
            setLoad({ status: 'loading' });
            setAttempt((a) => a + 1);
          }}
        >
          RETRY
        </button>
      </DialogueBox>
    );

  const { mart, titles } = load;
  if (!mart.eligible) return <DialogueBox text="Customize opens once your card is in the hall." emote="pending" />;
  const e = mart.equipped;
  const frames = mart.items.filter((i) => i.kind !== 'plate' && i.owned);
  const plates = mart.items.filter((i) => i.kind === 'plate' && i.owned);
  const plate = titles?.plate ?? e.plate ?? null;
  const earned = TITLES.filter((t) => titles?.earned.includes(t.key));

  return (
    <>
      <DialogueBox text="Pick what your badge wears. It changes on your badge here and in the hall. New frames and plates come from the PIP MART." />
      {notice && (
        <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
          {notice.bad && <span aria-hidden="true">! </span>}
          {notice.text}
        </p>
      )}

      <section className="menu-panel" aria-labelledby="wear-frame">
        <h2 id="wear-frame" className="panel-title">
          Frame
        </h2>
        <ul className="mart-list">
          <li>
            <WearRow name="Plain badge" detail="The classic PIP-Hall holder." wearing={!e.frame} busy={busy} onWear={() => void wear(() => martService.equip(null), 'Back to the plain badge.')} />
          </li>
          {frames.map((f) => (
            <li key={f.key}>
              <WearRow name={f.name} detail={f.description} wearing={e.frame === f.key} busy={busy} onWear={() => void wear(() => martService.equip(f.key), `Wearing the ${f.name}.`)} />
            </li>
          ))}
          {mart.perks.map((p) => (
            <li key={p.key}>
              <WearRow
                name={`${p.label} frame`}
                detail={`Free with your ${p.name} affiliation.`}
                wearing={e.frame === 'member' && e.affiliation === p.key}
                busy={busy}
                onWear={() => void wear(() => martService.equip('member', p.key), `Wearing the ${p.label} frame.`)}
              />
            </li>
          ))}
        </ul>
        {frames.length === 0 && mart.perks.length === 0 && <p className="m-0 field-hint">You don’t have other frames yet.</p>}
        <Link to="/mart" className="pixel-btn justify-self-start">
          Get frames in the PIP MART
        </Link>
      </section>

      {titles?.eligible && (
        <section className="menu-panel" aria-labelledby="wear-title">
          <h2 id="wear-title" className="panel-title">
            Title
          </h2>
          <p className="m-0 field-hint">Titles are earned, never bought: each comes from something you did in the hall.</p>
          <ul className="mart-list">
            <li>
              <WearRow name="No title" detail="Your badge shows no title." wearing={!titles.title} busy={busy} onWear={() => void wear(() => martService.equipTitle(null), 'Your badge shows no title now.')} />
            </li>
            {earned.map((t) => (
              <li key={t.key}>
                <WearRow name={t.name} detail={t.rule} wearing={titles.title === t.key} busy={busy} onWear={() => void wear(() => martService.equipTitle(t.key as TitleKey), `Your badge now says ${t.name}.`)} />
              </li>
            ))}
          </ul>
          {earned.length === 0 && <p className="m-0 field-hint">No titles earned yet. The PIP MART lists every title and how to earn it.</p>}
        </section>
      )}

      {titles?.eligible && (
        <section className="menu-panel" aria-labelledby="wear-plate">
          <h2 id="wear-plate" className="panel-title">
            Title plate
          </h2>
          <p className="m-0 field-hint">The plate your title sits on. Cosmetic only: it never changes who sees you.</p>
          <ul className="mart-list">
            <li>
              <WearRow name="Plain plate" detail="Cream with ink, like the badge." wearing={!plates.some((p) => p.key === plate)} busy={busy} onWear={() => void wear(() => martService.equipPlate(null), 'Back to the plain plate.')} />
            </li>
            {plates.map((p) => (
              <li key={p.key}>
                <WearRow name={p.name} detail={p.description} wearing={plate === p.key} busy={busy} onWear={() => void wear(() => martService.equipPlate(p.key), `Your title is on the ${p.name} now.`)} />
              </li>
            ))}
          </ul>
          {plates.length === 0 && (
            <Link to="/mart" className="pixel-btn justify-self-start">
              Get plates in the PIP MART
            </Link>
          )}
        </section>
      )}
    </>
  );
}

function WearRow({ name, detail, wearing, busy, onWear }: { name: string; detail: string; wearing: boolean; busy: boolean; onWear: () => void }) {
  return (
    <div className="mart-row">
      <div className="grid gap-[2px]">
        <b>{name}</b>
        <span className="text-caption text-text-secondary">{detail}</span>
        {wearing && <span className="mart-status">✓ Wearing</span>}
      </div>
      <div className="flex flex-wrap gap-space-2">
        {!wearing && (
          <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={onWear}>
            Wear<span className="sr-only"> {name}</span>
          </button>
        )}
      </div>
    </div>
  );
}
