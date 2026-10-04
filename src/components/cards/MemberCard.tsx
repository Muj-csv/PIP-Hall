// The badge (brief §13, D-021): CR80 proportions, 56 × 88u, holder → insert → sleeve glare → stickers.
// One flip button per face covers the badge; links, QR and VIEW PROFILE sit above it as their own
// focus stops. The face turned away is inert, so only visible controls can be reached.

import { useLayoutEffect, useMemo, useRef } from 'react';
import { CARD_PALETTE, DOODLE_PALETTE, SPR } from '../../lib/sprites';
import { placeStickers } from '../../lib/stickers';
import { memberUrl, serialFor } from '../../lib/publicUrl';
import type { PublicCard } from '../../types/card';
import { SpriteCanvas } from '../pixel/SpriteCanvas';
import { BadgeScene } from './BadgeScene';
import { PixelAvatar } from './PixelAvatar';
import { QrCode } from './QrCode';
import { Sticker } from './Sticker';

export const MAX_PROJECTS = 6;

interface Props {
  card: PublicCard;
  flipped: boolean;
  /** Whether this badge's controls are in the tab order (only the current one in the carousel). */
  focusable: boolean;
  /** Flips the badge. Left out where both faces are shown at once (the member page). */
  onActivate?: () => void;
  /** VIEW PROFILE on the back. Left out where the full profile is already on the page. */
  onOpen?: () => void;
  onShowQr: () => void;
  /** Editor preview: a photo picked but not uploaded yet (object URL). */
  photoUrl?: string | null;
}

export function MemberCard({ card, flipped, focusable, onActivate, onOpen, onShowQr, photoUrl }: Props) {
  const name = card.card.full_name;
  const tab = focusable ? 0 : -1;
  return (
    <div className="badge" data-flipped={flipped}>
      <div className="badge-face" data-side="front" inert={flipped}>
        {onActivate && (
          <button type="button" className="badge-hit" tabIndex={tab} aria-pressed={flipped} aria-label={`Card of ${name}. Flip to see their projects.`} onClick={onActivate} />
        )}
        <CardFront card={card} tab={tab} onShowQr={onShowQr} photoUrl={photoUrl} />
      </div>
      <div className="badge-face" data-side="back" inert={!flipped}>
        {onActivate && (
          <button type="button" className="badge-hit" tabIndex={tab} aria-pressed={flipped} aria-label={`Quest Log of ${name}. Flip back to the front.`} onClick={onActivate} />
        )}
        <CardBack card={card} tab={tab} onOpen={onOpen} />
      </div>
    </div>
  );
}

function Holder({ children }: { children: React.ReactNode }) {
  return (
    <div className="holder">
      <span className="hole" />
      <span className="holder-print" aria-hidden="true">PIXENDO</span>
      <SpriteCanvas sprite={SPR.flower} palette={DOODLE_PALETTE} className="doodle" style={{ top: 6, left: 6 }} />
      <SpriteCanvas sprite={SPR.flower} palette={DOODLE_PALETTE} className="doodle" style={{ top: 6, right: 6 }} />
      <SpriteCanvas sprite={SPR.grass} palette={DOODLE_PALETTE} className="doodle" style={{ bottom: 6, left: 8 }} />
      <SpriteCanvas sprite={SPR.flower} palette={DOODLE_PALETTE} className="doodle" style={{ top: '48%', right: 0 }} />
      <div className="insert">
        {children}
        <div className="glare" aria-hidden="true">
          <i />
          <i />
        </div>
      </div>
    </div>
  );
}

function Band({ title, right }: { title: string; right: string }) {
  return (
    <div className="band">
      <SpriteCanvas sprite={SPR.block} palette={CARD_PALETTE} className="band-emblem" />
      <span className="band-title">{title}</span>
      <span className="band-no">{right}</span>
    </div>
  );
}

const NAME_MAX = 20;
const NAME_MIN = 13;

/** Names wrap to two lines, then shrink in 1px steps down to 13px (brief §13). */
function useFittedName() {
  const ref = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      let size = NAME_MAX;
      el.style.setProperty('--name-size', `${size}px`);
      while (size > NAME_MIN && el.scrollHeight > el.clientHeight + 1) {
        size -= 1;
        el.style.setProperty('--name-size', `${size}px`);
      }
    };
    fit();
    void document.fonts?.ready.then(fit);
  });
  return ref;
}

function CardFront({ card, tab, onShowQr, photoUrl }: { card: PublicCard; tab: number; onShowQr: () => void; photoUrl?: string | null }) {
  const c = card.card;
  const stickers = useMemo(() => placeStickers(c), [c]);
  const nameRef = useFittedName();
  const year = card.published_at.slice(2, 4);
  const links = [
    { key: 'gh', label: 'GitHub', href: c.github_username ? `https://github.com/${c.github_username}` : null, icon: SPR.iconCode },
    { key: 'li', label: 'LinkedIn', href: c.linkedin_url, icon: SPR.iconCase },
    { key: 'web', label: 'Website', href: c.portfolio_url, icon: SPR.iconGlobe },
  ];
  return (
    <>
      <Holder>
        <Band title="PIP-HALL" right={`No.${String(card.no).padStart(3, '0')}`} />
        <div className="badge-inner">
          <div className="photo-window">
            <BadgeScene />
            <PixelAvatar username={c.username} name={c.full_name} avatarPath={c.avatar_path} photoUrl={photoUrl} />
            <i className="corner" data-at="tl" />
            <i className="corner" data-at="tr" />
            <i className="corner" data-at="bl" />
            <i className="corner" data-at="br" />
            {c.department && <span className="dept">{c.department}</span>}
            {c.is_featured && <SpriteCanvas sprite={SPR.star0} palette={CARD_PALETTE} className="star-badge" label="Featured" />}
          </div>
          <div>
            <h2 ref={nameRef} className="badge-name">
              {c.full_name}
            </h2>
            <div className="badge-handle">@{c.username}</div>
            {c.role && <div className="badge-role">{c.role}</div>}
          </div>
          <div className="stats">
            <div className="stat" aria-label={`${c.projects.length} projects`}>
              PRJ<span>{c.projects.length}</span>
            </div>
            <div className="stat" aria-label={`${c.skills.length} skills`}>
              SKL<span>{c.skills.length}</span>
            </div>
            <div className="stat" aria-label={`Joined 20${year}`}>
              YR<span>’{year}</span>
            </div>
          </div>
          <div className="coinline" aria-hidden="true" />
          <div className="badge-foot">
            <div className="item-slots">
              {links.map((l) =>
                l.href ? (
                  <a key={l.key} className="item-slot" href={l.href} target="_blank" rel="noopener noreferrer" tabIndex={tab} aria-label={`${l.label} (opens in a new tab)`}>
                    <SpriteCanvas sprite={l.icon} palette={CARD_PALETTE} />
                  </a>
                ) : (
                  <span key={l.key} className="item-slot" data-empty="true" title={`${l.label} not added`}>
                    <SpriteCanvas sprite={l.icon} palette={CARD_PALETTE} />
                    <span className="sr-only">{l.label} not added</span>
                  </span>
                ),
              )}
            </div>
            <div className="qr-box">
              <button type="button" className="qr-button" tabIndex={tab} aria-label={`Show QR code for ${c.full_name}'s page full screen`} onClick={onShowQr}>
                <QrCode value={memberUrl(c.username)} />
              </button>
              <span className="serial">{serialFor(card.no, c.username)}</span>
            </div>
          </div>
        </div>
      </Holder>
      {stickers.length > 0 && <span className="sr-only">Stickers: {stickers.map((s) => s.label).join(', ')}</span>}
      {stickers.map((s) => (
        <Sticker key={s.label} sticker={s} />
      ))}
    </>
  );
}

function CardBack({ card, tab, onOpen }: { card: PublicCard; tab: number; onOpen?: () => void }) {
  const c = card.card;
  return (
    <Holder>
      <Band title="QUEST LOG" right={`${c.projects.length}/${MAX_PROJECTS}`} />
      <div className="badge-inner">
        {c.bio && <p className="badge-bio">{c.bio}</p>}
        <ol className="quests">
          {c.projects.length === 0 && (
            <li className="quest" data-empty="true">
              No quests yet
            </li>
          )}
          {c.projects.slice(0, 3).map((p, i) => (
            <li key={`${p.title}-${i}`} className="quest">
              <span className="quest-n" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <b>{p.title}</b>
                <small>{[p.description, p.language].filter(Boolean).join(' · ')}</small>
              </span>
            </li>
          ))}
        </ol>
        {c.skills.length > 0 && (
          <ul className="powerups" aria-label="Skills">
            {c.skills.map((s) => (
              <li key={s}>★ {s}</li>
            ))}
          </ul>
        )}
        {onOpen && (
          <button type="button" className="badge-cta" tabIndex={tab} onClick={onOpen}>
            VIEW PROFILE ▸
          </button>
        )}
      </div>
    </Holder>
  );
}
