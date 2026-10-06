// /mart — the PIP MART (E2, D-074…D-076): members in the hall spend PIPs on badge frames and wear
// them, or wear an affiliation's free perk frame. Since V2-5 (D-101) it is also where a member picks
// which earned title their badge shows, and the plate it sits on. Every check is in the database.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAppearance } from '../app/appearanceContext';
import { useSession } from '../app/sessionContext';
import { BadgeStage } from '../components/cards/BadgeStage';
import { MemberCard } from '../components/cards/MemberCard';
import { QrFullscreen } from '../components/cards/QrFullscreen';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { Unbox } from '../components/mart/Unbox';
import { MenuPage } from '../components/shell/MenuPage';
import { pipsEnabled } from '../lib/features';
import { formatPips } from '../lib/pips';
import { isPlateStyle, TITLES, type HallTitle, type PlateStyle, type TitleKey } from '../lib/titles';
import { useCards } from '../lib/useCards';
import { martErrorMessage, martNotSetUp, martService, type MyTitles } from '../services/martService';
import type { Appearance, MartItem, MyMart, Perk } from '../types/mart';

type Load = { status: 'loading' } | { status: 'error'; notSetUp: boolean } | { status: 'ready'; mart: MyMart };

const same = (a: Appearance | null, b: Appearance | null) => (a?.frame ?? null) === (b?.frame ?? null) && (a?.label ?? null) === (b?.label ?? null);

export default function Mart() {
  const { session } = useSession();
  const userId = session.status === 'signed-in' ? session.user.id : null;
  const cards = useCards();
  const appearance = useAppearance();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [trying, setTrying] = useState<Appearance | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; bad?: boolean } | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [qr, setQr] = useState(false);
  const [unboxed, setUnboxed] = useState<MartItem | null>(null);
  const [titles, setTitles] = useState<MyTitles | null>(null);
  const [tryPlate, setTryPlate] = useState<PlateStyle | null | undefined>(undefined);

  useEffect(() => {
    if (!pipsEnabled || !userId) return;
    let on = true;
    martService
      .mine()
      .then((mart) => on && setLoad({ status: 'ready', mart }))
      .catch((e: unknown) => on && setLoad({ status: 'error', notSetUp: martNotSetUp(e) }));
    return () => {
      on = false;
    };
  }, [userId, attempt]);

  useEffect(() => {
    if (!pipsEnabled || !userId) return;
    let on = true;
    martService
      .myTitles()
      .then((t) => on && setTitles(t))
      .catch(() => on && setTitles(null)); // before the identity update: no titles panel
    return () => {
      on = false;
    };
  }, [userId, attempt]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);

  const run = async (move: () => Promise<unknown>, done: string, then?: () => void) => {
    setBusy(true);
    setNotice(null);
    try {
      await move();
      setNotice({ text: done });
      then?.();
      setConfirm(null);
      reload();
      appearance.refresh();
    } catch (e) {
      setNotice({ text: martErrorMessage(e), bad: true });
    } finally {
      setBusy(false);
    }
  };

  if (!pipsEnabled) {
    return (
      <MenuPage title="PIP MART">
        <DialogueBox text="The PIP MART isn’t open in this hall yet." />
      </MenuPage>
    );
  }

  const mine = cards.status === 'ready' ? cards.cards.find((c) => c.profile_id === userId) : undefined;
  const mart = load.status === 'ready' ? load.mart : null;
  const perkLook = (p: Perk): Appearance => ({ frame: 'member', label: p.label });
  const wearing: Appearance | null = (() => {
    const e = mart?.equipped;
    if (!e?.frame) return null;
    if (e.frame === 'member') {
      const p = mart?.perks.find((x) => x.key === e.affiliation);
      return p ? perkLook(p) : null;
    }
    const item = mart?.items.find((i) => i.key === e.frame && i.owned);
    return item ? { frame: e.frame, label: null, style: isPlateStyle(item.style) ? null : (item.style ?? null) } : null;
  })();
  const shown = trying === undefined ? wearing : trying;
  const frames = mart?.items.filter((i) => i.kind !== 'plate') ?? [];
  const plates = mart?.items.filter((i) => i.kind === 'plate') ?? [];
  const wornPlate = plates.find((p) => p.owned && p.key === (titles?.plate ?? mart?.equipped.plate)) ?? null;
  const plateOf = (i: MartItem | null) => (i && isPlateStyle(i.style) ? i.style : null);
  // The badge preview shows the worn title (or Card Holder, so a plate can be tried on) on the
  // plate being tried, else the one worn.
  const previewTitle: HallTitle | null | undefined = titles
    ? {
        earned: titles.earned,
        title: titles.title ?? (tryPlate !== undefined ? 'card_holder' : null),
        plateStyle: tryPlate === undefined ? plateOf(wornPlate) : tryPlate,
      }
    : undefined;

  return (
    <MenuPage title="PIP MART" wide>
      {/* Loading until the Mart answers; then, for members in the hall, until their badge preview is ready too. */}
      {(load.status === 'loading' || (mart?.eligible && cards.status === 'loading')) && <DialogueBox text="Opening the shutters…" emote="pending" />}
      {load.status === 'error' && (
        <DialogueBox
          text={
            load.notSetUp
              ? 'The PIP MART isn’t set up in this hall’s database yet. An admin needs to run the PIP MART update (see the deploy guide).'
              : 'Can’t reach the PIP MART right now. Check your connection and try again.'
          }
          emote="attention"
        >
          <button
            type="button"
            className="hw-btn"
            data-variant="small"
            onClick={() => {
              setLoad({ status: 'loading' });
              reload();
            }}
          >
            RETRY
          </button>
        </DialogueBox>
      )}
      {mart && !mart.eligible && (
        <DialogueBox text="The PIP MART opens once your card is in the hall. Make your card and send it for review!" emote="attention">
          <Link to="/edit" className="hw-btn no-underline" data-variant="small">
            MY CARD
          </Link>
        </DialogueBox>
      )}

      {mart && mart.eligible && (
        <>
          <DialogueBox text="Welcome to the PIP MART! Try a frame on your badge, then buy it with PIPs. Frames are yours to keep." />
          <p className="m-0 font-display text-h3 tracking-[0.04em]" role="status">
            <span aria-hidden="true">◉ </span>
            {formatPips(mart.balance)} PIPs
          </p>
          {notice && (
            <p className={notice.bad ? 'notice notice-bad m-0' : 'notice m-0'} role="status">
              {notice.bad && <span aria-hidden="true">! </span>}
              {notice.text}
            </p>
          )}

          <div className="mart-layout">
            {mine && (
              <div className="grid gap-space-2 content-start">
                <BadgeStage label={trying === undefined ? 'Your badge' : 'Trying on'}>
                  <MemberCard card={mine} flipped={flipped} focusable onActivate={() => setFlipped((f) => !f)} onShowQr={() => setQr(true)} appearance={shown} title={previewTitle} />
                </BadgeStage>
                {(trying !== undefined || tryPlate !== undefined) && (
                  <button
                    type="button"
                    className="pixel-btn justify-self-center"
                    onClick={() => {
                      setTrying(undefined);
                      setTryPlate(undefined);
                    }}
                  >
                    Stop trying on
                  </button>
                )}
              </div>
            )}

            <div className="grid gap-space-4 content-start">
              <section className="menu-panel" aria-labelledby="mart-frames">
                <h2 id="mart-frames" className="panel-title">
                  Frames
                </h2>
                <ul className="mart-list">
                  <li>
                    <Row name="Plain badge" detail="The classic PIP-Hall holder." status={!wearing ? 'Wearing' : null}>
                      <button type="button" className="pixel-btn" onClick={() => setTrying(null)}>
                        Try on
                      </button>
                      {wearing && (
                        <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => martService.equip(null), 'Back to the plain badge.')}>
                          Wear plain
                        </button>
                      )}
                    </Row>
                  </li>
                  {frames.map((item) => (
                    <li key={item.key}>
                      <ItemRow
                        item={item}
                        balance={mart.balance}
                        wearing={same(wearing, { frame: item.key, label: null })}
                        confirming={confirm === item.key}
                        busy={busy}
                        onTry={() => setTrying({ frame: item.key, label: null, style: isPlateStyle(item.style) ? null : (item.style ?? null) })}
                        onAsk={() => setConfirm(item.key)}
                        onCancel={() => setConfirm(null)}
                        onBuy={() => void run(() => martService.buy(item.key), `${item.name} is yours! Wear it whenever you like.`, () => setUnboxed(item))}
                        onWear={() => void run(() => martService.equip(item.key), `Wearing the ${item.name}.`)}
                      />
                    </li>
                  ))}
                </ul>
              </section>

              {titles?.eligible && (
                <section className="menu-panel" aria-labelledby="mart-titles">
                  <h2 id="mart-titles" className="panel-title">
                    Your title
                  </h2>
                  <p className="m-0 field-hint">Titles are earned, never bought: each comes from something you did in the hall. Pick the one your badge shows.</p>
                  <ul className="title-list">
                    <li>
                      <Row name="No title" detail="Your badge shows no title." status={!titles.title ? 'Wearing' : null}>
                        {titles.title && (
                          <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => martService.equipTitle(null), 'Your badge shows no title now.')}>
                            Wear none
                          </button>
                        )}
                      </Row>
                    </li>
                    {TITLES.map((t) => {
                      const earned = titles.earned.includes(t.key);
                      return (
                        <li key={t.key}>
                          <TitleRow
                            name={t.name}
                            rule={t.rule}
                            earned={earned}
                            wearing={titles.title === t.key}
                            busy={busy}
                            onWear={() => void run(() => martService.equipTitle(t.key as TitleKey), `Your badge now says ${t.name}.`)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}

              {titles?.eligible && plates.length > 0 && (
                <section className="menu-panel" aria-labelledby="mart-plates">
                  <h2 id="mart-plates" className="panel-title">
                    Title plates
                  </h2>
                  <p className="m-0 field-hint">The plate your title sits on. Cosmetic only: it never changes who sees you.</p>
                  <ul className="mart-list">
                    <li>
                      <Row name="Plain plate" detail="Cream with ink, like the badge." status={!wornPlate ? 'Wearing' : null}>
                        <button type="button" className="pixel-btn" onClick={() => setTryPlate(null)}>
                          Try on
                        </button>
                        {wornPlate && (
                          <button type="button" className="pixel-btn" disabled={busy} onClick={() => void run(() => martService.equipPlate(null), 'Back to the plain plate.')}>
                            Wear plain
                          </button>
                        )}
                      </Row>
                    </li>
                    {plates.map((item) => (
                      <li key={item.key}>
                        <ItemRow
                          item={item}
                          balance={mart.balance}
                          wearing={wornPlate?.key === item.key}
                          confirming={confirm === item.key}
                          busy={busy}
                          onTry={() => setTryPlate(plateOf(item))}
                          onAsk={() => setConfirm(item.key)}
                          onCancel={() => setConfirm(null)}
                          onBuy={() => void run(() => martService.buy(item.key), `${item.name} is yours! Wear it whenever you like.`, () => setUnboxed(item))}
                          onWear={() => void run(() => martService.equipPlate(item.key), `Your title is on the ${item.name} now.`)}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {mart.perks.length > 0 && (
                <section className="menu-panel" aria-labelledby="mart-perks">
                  <h2 id="mart-perks" className="panel-title">
                    Perk frames
                  </h2>
                  <p className="m-0 field-hint">Free with your affiliations. They print your affiliation on the badge.</p>
                  <ul className="mart-list">
                    {mart.perks.map((p) => (
                      <li key={p.key}>
                        <Row name={`${p.label} frame`} detail={`Free with your ${p.name} affiliation.`} status={same(wearing, perkLook(p)) ? 'Wearing' : 'Free'}>
                          <button type="button" className="pixel-btn" onClick={() => setTrying(perkLook(p))}>
                            Try on
                          </button>
                          {!same(wearing, perkLook(p)) && (
                            <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={() => void run(() => martService.equip('member', p.key), `Wearing the ${p.label} frame.`)}>
                              Wear
                            </button>
                          )}
                        </Row>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        </>
      )}
      {qr && mine && <QrFullscreen card={mine} onClose={() => setQr(false)} />}
      {unboxed && (
        <Unbox
          item={unboxed}
          busy={busy}
          onClose={() => setUnboxed(null)}
          onWear={() => {
            // Close first, so a failure shows on the page rather than behind the dialog.
            const item = unboxed;
            setUnboxed(null);
            setTrying(undefined);
            setTryPlate(undefined);
            if (item.kind === 'plate') void run(() => martService.equipPlate(item.key), `Your title is on the ${item.name} now.`);
            else void run(() => martService.equip(item.key), `Wearing the ${item.name}.`);
          }}
        />
      )}
    </MenuPage>
  );
}

function Row({ name, detail, status, children }: { name: string; detail: string; status: string | null; children: React.ReactNode }) {
  return (
    <div className="mart-row">
      <div className="grid gap-[2px]">
        <b>{name}</b>
        <span className="text-caption text-text-secondary">{detail}</span>
        {status && <span className="mart-status">{status === 'Wearing' ? '✓ Wearing' : status}</span>}
      </div>
      <div className="flex flex-wrap gap-space-2">{children}</div>
    </div>
  );
}

interface ItemProps {
  item: MartItem;
  balance: number;
  wearing: boolean;
  confirming: boolean;
  busy: boolean;
  onTry: () => void;
  onAsk: () => void;
  onCancel: () => void;
  onBuy: () => void;
  onWear: () => void;
}

function ItemRow({ item, balance, wearing, confirming, busy, onTry, onAsk, onCancel, onBuy, onWear }: ItemProps) {
  const short = item.price - balance;
  const status = wearing ? 'Wearing' : item.owned ? (item.for_sale === false ? 'Reward' : 'Owned') : `${formatPips(item.price)} PIPs`;
  return (
    <Row name={item.name} detail={item.description} status={status}>
      <button type="button" className="pixel-btn" onClick={onTry}>
        Try on
      </button>
      {item.owned ? (
        !wearing && (
          <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={onWear}>
            Wear
          </button>
        )
      ) : confirming ? (
        <>
          <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={onBuy}>
            Yes, spend {formatPips(item.price)} PIPs
          </button>
          <button type="button" className="pixel-btn" onClick={onCancel}>
            Keep my PIPs
          </button>
        </>
      ) : short > 0 ? (
        <span className="field-hint self-center">Need {formatPips(short)} more PIPs</span>
      ) : (
        <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={onAsk}>
          Buy for {formatPips(item.price)}
        </button>
      )}
    </Row>
  );
}

function TitleRow({ name, rule, earned, wearing, busy, onWear }: { name: string; rule: string; earned: boolean; wearing: boolean; busy: boolean; onWear: () => void }) {
  return (
    <div className="mart-row" data-locked={earned ? undefined : true}>
      <div className="grid gap-[2px]">
        <b>{name}</b>
        <span className="text-caption text-text-secondary">{rule}</span>
        <span className="mart-status">{wearing ? '✓ Wearing' : earned ? 'Earned' : '○ Not earned yet'}</span>
      </div>
      <div className="flex flex-wrap gap-space-2">
        {earned && !wearing && (
          <button type="button" className="pixel-btn" data-variant="primary" disabled={busy} onClick={onWear}>
            Wear<span className="sr-only"> {name}</span>
          </button>
        )}
      </div>
    </div>
  );
}
