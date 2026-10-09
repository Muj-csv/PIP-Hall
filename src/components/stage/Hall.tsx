// The PIP-Hall level inside the PIXENDO handheld (brief §3, §7, §15). One animation loop steps the
// camera, swings every badge, walks and jumps Pip, and draws the world; React only re-renders when
// the current player, flips, coins or the dialogue line change. Search and filters (HallSearch,
// D-072) narrow which badges hang in the level; they live in the address like /explore did. START
// (D-107, D-126) opens the device's menu: Random player, the Passport, the Officers door, the map,
// the Museum, the Mart, sharing and DAY/NIGHT. Below the device, one tab at a time (HallTabs).

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router';
import { useAppearance } from '../../app/appearanceContext';
import { hallUrl, memberPath } from '../../lib/publicUrl';
import { pipsEnabled } from '../../lib/features';
import { slotLook, slotX } from '../../lib/carousel';
import { cssVarReader } from '../../lib/sprites';
import { stepHeld } from '../../lib/grab';
import { stepSwing, type SwingState } from '../../lib/swing';
import { useCards } from '../../lib/useCards';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { usePassport } from '../../lib/usePassport';
import { usePips } from '../../lib/usePips';
import { discoverLine } from '../../lib/pips';
import { facets, filtersFromParams, filtersToParams, indexCards, isFiltered, NO_FILTERS, randomCard, search, type Filters } from '../../lib/search';
import { useTheme } from '../../app/themeContext';
import type { PublicCard } from '../../types/card';
import { QrFullscreen, QrSheet } from '../cards/QrFullscreen';
import { CardCarousel, SkeletonBadges } from '../carousel/CardCarousel';
import { UNIT_PX, useCarousel } from '../carousel/useCarousel';
import { DialogueBox } from '../dialogue/DialogueBox';
import type { EmoteKind } from '../dialogue/Emote';
import { HandheldShell } from '../shell/HandheldShell';
import {
  CEIL_Y,
  GROUND_Y,
  HEAD_HIT_Y,
  IRIS_FRAMES,
  LEVEL_H,
  buildWorldAssets,
  drawBackground,
  drawBoot,
  drawForeground,
  drawIris,
  shuffledCells,
  type CoinFx,
  type Hero,
  type WorldAssets,
} from '../world/world';
import { HallSearch } from './HallSearch';
import { Hud } from './Hud';
import { density } from '../../lib/network';
import { currentByMember } from '../../lib/officers';
import { useSession } from '../../app/sessionContext';
import { HallTabs } from './HallTabs';
import { PassportScreen } from './PassportScreen';
import { START_MENU_ID, StartMenu } from './StartMenu';
import { MissingScreen, ProfileScreen } from './ProfileScreen';

const BADGE_HALF_W = 28; // units
const BOOT_KEY = 'piphall-booted';
const HINT = 'Drag to browse, tap a card to flip it. START has your Passport, a random player and more.';
const HALL_TITLE = 'PIP-Hall · Where every person has a place';

type Line = { text: string; emote?: EmoteKind };

function titleCase(s: string) {
  return s.replace(/\b\p{L}/gu, (m) => m.toUpperCase());
}

interface HallProps {
  /** Username from /member/:username: that member's profile is open inside the device. */
  profile?: string | null;
  /** /passport: the Passport is open inside the device (V2-2). */
  passport?: boolean;
}

export function Hall({ profile = null, passport = false }: HallProps) {
  const cardsState = useCards();
  const all = useMemo(() => (cardsState.status === 'ready' ? cardsState.cards : []), [cardsState]);
  // The map (V2-8) opens once the hall is dense enough; admins can preview it before (D-105).
  const { session: mapSession } = useSession();
  const dense = useMemo(() => density(all).ready, [all]);
  const mapOpen = dense || (mapSession.status === 'signed-in' && mapSession.role === 'admin');

  // ---- search and filters (D-072)
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const query = params.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(query)), [query]);
  const searchIndex = useMemo(() => indexCards(all), [all]);
  // The Officers door (V2-10b, D-123): the current officers, in their seats.
  const { officers: officerList } = useAppearance();
  const seats = useMemo(() => currentByMember(officerList), [officerList]);
  const options = useMemo(() => facets(all), [all]);
  const cards = useMemo(() => {
    if (!isFiltered(filters)) return all;
    const hits = search(searchIndex, filters, seats);
    // A shared /member link with filters that leave that member out still shows them.
    const want = profile?.toLowerCase();
    if (want && !hits.some((c) => c.username === want) && all.some((c) => c.username === want)) return all;
    return hits;
  }, [all, searchIndex, filters, profile, seats]);
  const count = cards.length;
  const setFilters = useCallback((patch: Partial<Filters>) => setParams(filtersToParams({ ...filters, ...patch }), { replace: true }), [filters, setParams]);
  const clearFilters = useCallback(() => setParams(filtersToParams(NO_FILTERS), { replace: true }), [setParams]);
  const reduce = useReducedMotion();
  const { theme } = useTheme();

  const [line, setLine] = useState<Line>({ text: HINT });
  const [flipped, setFlipped] = useState<ReadonlySet<string>>(() => new Set());
  const [coins, setCoins] = useState(0);
  const pips = usePips();
  const stamps = usePassport();
  /** Pip's line on the profile screen after a discovery reward (E1). */
  const [reward, setReward] = useState<{ for: string; text: string } | null>(null);
  const [mode, setMode] = useState<'level' | 'profile' | 'missing' | 'passport'>('level');
  const navigate = useNavigate();
  /** Opened from inside the hall (so BACK can step back in history) rather than from a link. */
  const openedHere = useRef(false);
  /** The hall has been on screen: later profile changes play the iris; a cold /member link doesn't. */
  const shownOnce = useRef(false);
  const startedOnProfile = useRef(Boolean(profile) || passport);
  const [qrCard, setQrCard] = useState<PublicCard | null>(null);
  /** The START menu is open over the screen (D-126), and the hall's QR sheet is showing. */
  const [menuOpen, setMenuOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [ledBlink, setLedBlink] = useState(false);

  /** The player at the current index, so a new search can keep them in front if they still match. */
  const currentUser = useRef<string | null>(null);
  const onIndexChange = useCallback(
    (i: number, n: number) => {
      const c = cards[i];
      if (!c) return;
      currentUser.current = c.username;
      if (i === n - 1 && n > 1) setLine({ text: 'Last player in this world. The flag means you met everyone.' });
      else setLine({ text: `Player ${i + 1}: ${titleCase(c.card.full_name)}. Tap to flip.` });
    },
    [cards],
  );
  // Grab and fling (D-082): only the current badge, and never from its links or QR button.
  const canGrab = useCallback((target: EventTarget | null) => {
    const el = target instanceof Element ? target : null;
    return Boolean(el?.closest('.slot:not([aria-hidden])') && !el.closest('a, .qr-button'));
  }, []);
  const onGrab = useCallback(() => setLine({ text: 'Wheee! Swing it, then let go.' }), []);
  const car = useCarousel({ count, reduce, onIndexChange, canGrab, onGrab });
  const { go, step, cam: camRef, indexRef, moved, grab } = car;

  // ---- refs the animation loop reads
  const screenRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLCanvasElement>(null);
  const fgRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const slots = useRef(new Map<number, HTMLDivElement>());
  const swings = useRef(new Map<number, SwingState>());
  const bumps = useRef(new Map<number, number>());
  const coinFx = useRef<CoinFx[]>([]);
  const hero = useRef<Hero>({ x: 0, y: 0, vy: 0, face: 1, t: 0, air: false, hit: true, walking: false });
  const fx = useRef<{ boot: { t: number; order: number[] } | null; iris: { t: number; mid: () => void; done: boolean } | null }>({ boot: null, iris: null });
  const assets = useRef<WorldAssets | null>(null);
  const flipQueued = useRef(false);
  const live = useRef({ cards, flipped, reduce, mode, count });
  useEffect(() => {
    live.current = { cards, flipped, reduce, mode, count };
  });

  // Rebuild sprite colours when DAY/NIGHT changes (the world follows the theme; badges don't).
  useLayoutEffect(() => {
    assets.current = buildWorldAssets(cssVarReader());
  }, [theme]);

  // ---- actions
  const toggleFlip = useCallback((i: number) => {
    const c = live.current.cards[i];
    if (!c) return;
    const nowFlipped = !live.current.flipped.has(c.username);
    setFlipped((prev) => {
      const next = new Set(prev);
      if (nowFlipped) next.add(c.username);
      else next.delete(c.username);
      return next;
    });
    setLine({ text: nowFlipped ? 'Quest Log: the first three projects. OPEN shows everything.' : 'Front side. The QR opens this player’s page.' });
    setCoins((n) => n + 1);
    if (!live.current.reduce) {
      bumps.current.set(i, 6);
      coinFx.current.push({ x: slotX(i), y: CEIL_Y - 2, vy: -2.6, t: 0 });
      const s = swings.current.get(i) ?? { angle: 0, vel: 0 };
      swings.current.set(i, { ...s, vel: s.vel + (Math.random() < 0.5 ? -1.5 : 1.5) });
    }
  }, []);

  /** Jump-to-flip (D-023): Pip jumps and headbutts the badge; the flip happens on contact. */
  const requestFlip = useCallback(() => {
    const l = live.current;
    if (l.count === 0 || l.mode !== 'level') return;
    const h = hero.current;
    if (l.reduce) {
      toggleFlip(indexRef.current);
      return;
    }
    if (h.air) {
      flipQueued.current = true; // pressed again mid-jump: jump again on landing
      return;
    }
    h.vy = -3.1;
    h.air = true;
    h.hit = false;
  }, [indexRef, toggleFlip]);

  const runIris = useCallback((mid: () => void) => {
    if (live.current.reduce) {
      mid();
      return;
    }
    fx.current.iris = { t: 0, mid, done: false };
  }, []);

  // The address decides what the screen shows: OPEN goes to /member/:username and BACK leaves it,
  // and the effect below plays the iris either way (browser Back and Forward too).
  const openProfile = useCallback(() => {
    const l = live.current;
    const c = l.cards[indexRef.current];
    if (!c || l.mode !== 'level') return;
    openedHere.current = true;
    navigate({ pathname: memberPath(c.username), search: location.search });
  }, [indexRef, navigate, location.search]);

  // "Walk there" from a profile (V2-13): back to the hall, then Pip walks to that member's badge.
  // Someone a search hides gets their profile instead.
  const pendingWalk = useRef<{ i: number; name: string } | null>(null);
  const closeProfile = useCallback(() => {
    if (live.current.mode === 'level') return;
    if (openedHere.current) {
      openedHere.current = false;
      navigate(-1);
    } else navigate({ pathname: '/', search: location.search });
  }, [navigate, location.search]);

  const walkTo = useCallback(
    (username: string) => {
      const i = live.current.cards.findIndex((c) => c.username === username);
      if (i < 0) {
        navigate(memberPath(username));
        return;
      }
      pendingWalk.current = { i, name: live.current.cards[i]!.card.full_name };
      closeProfile();
    },
    [closeProfile, navigate],
  );

  // A new search changes which badges hang: stay on the same player if they still match,
  // otherwise start at the first match. The camera cuts there instead of walking the level.
  // A layout effect, so it runs before the carousel trims its index to the shorter list.
  useLayoutEffect(() => {
    if (!cards.length) return;
    if (currentUser.current === null) {
      currentUser.current = cards[indexRef.current]?.username ?? null; // first load: nothing to keep
      return;
    }
    const i = Math.max(0, cards.findIndex((c) => c.username === currentUser.current));
    if (i !== indexRef.current || cards[i]?.username !== currentUser.current) {
      go(i);
      camRef.current.x = slotX(i);
      camRef.current.v = 0;
    }
    // go() reports through the carousel's options, which still hold the old list at this point.
    const c = cards[i];
    if (c) {
      currentUser.current = c.username;
      setLine({ text: `Player ${i + 1} of ${cards.length}: ${titleCase(c.card.full_name)}. Tap to flip.` });
    }
  }, [cards, go, indexRef, camRef]);

  // The Passport opens inside the device like a profile (V2-2).
  const openPassport = useCallback(() => {
    if (live.current.mode === 'passport') return;
    openedHere.current = true;
    navigate({ pathname: '/passport', search: location.search });
  }, [navigate, location.search]);

  // A search result picked from the list: Pip walks there and the block above the badge bumps,
  // so the hall itself shows where the result is (V2-2, product rule 8).
  const pickResult = useCallback(
    (username: string) => {
      const l = live.current;
      const i = l.cards.findIndex((c) => c.username === username);
      const c = l.cards[i];
      if (!c) return;
      if (l.mode !== 'level') navigate({ pathname: '/', search: location.search });
      go(i);
      if (!l.reduce) bumps.current.set(i, 6);
      setLine({ text: `Pip found ${titleCase(c.card.full_name)}! Tap to flip, or OPEN for the profile.` });
      screenRef.current?.focus({ preventScroll: true });
    },
    [go, navigate, location.search],
  );

  const randomPlayer = useCallback(() => {
    const l = live.current;
    if (l.mode !== 'level' || l.cards.length === 0) return;
    const others = l.cards.length > 1 ? l.cards.filter((_, i) => i !== indexRef.current) : l.cards;
    const pick = randomCard(others);
    if (!pick) return;
    go(l.cards.indexOf(pick));
    setLine({ text: `Random player: ${titleCase(pick.card.full_name)}! Tap to flip, or OPEN for the profile.` });
    screenRef.current?.focus({ preventScroll: true });
  }, [go, indexRef]);

  // Syncs the screen to the address (an external system): state set here is the response to a
  // navigation, not derived data, so the effect is the right place for it.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (cardsState.status !== 'ready') return;
    const want = profile?.toLowerCase() ?? null;
    const cold = !shownOnce.current;
    shownOnce.current = true;
    const now = live.current.mode;
    if (passport) {
      if (now !== 'passport') {
        if (cold) setMode('passport');
        else runIris(() => setMode('passport'));
      }
      setLine({ text: 'Your Passport. BACK or Esc returns to the hall.' });
      return;
    }
    if (want) {
      const i = cards.findIndex((c) => c.username === want);
      const next = i < 0 ? 'missing' : 'profile';
      if (i >= 0 && i !== indexRef.current) {
        go(i);
        if (cold || now !== 'level') camRef.current.x = slotX(i); // already behind the screen: no walk
      }
      if (now !== next) {
        if (cold) setMode(next);
        else runIris(() => setMode(next));
      }
      setLine({ text: next === 'profile' ? 'Profile screen. BACK or Esc returns to the hall.' : 'No card at that address.' });
    } else if (now !== 'level') {
      openedHere.current = false;
      const walk = pendingWalk.current;
      pendingWalk.current = null;
      runIris(() => {
        setMode('level');
        screenRef.current?.focus();
        if (walk) go(walk.i);
      });
      setLine({ text: walk ? `Pip walks to ${titleCase(walk.name)}. Tap to flip, or OPEN for the profile.` : 'Back in the hall.' });
    }
  }, [profile, passport, cardsState.status, cards, go, runIris, indexRef, camRef]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const onActivate = (i: number) => {
    if (moved.current) return; // a drag never flips
    if (i !== indexRef.current) go(i);
    else requestFlip();
  };

  // ---- slot positioning (also used the moment a slot mounts, so it never flashes at x = 0)
  const placeSlot = useCallback((n: number, el: HTMLDivElement) => {
    const play = playRef.current;
    if (!play) return;
    const look = slotLook(n, camRef.current.x);
    const angle = swings.current.get(n)?.angle ?? 0;
    const x = look.dx * UNIT_PX + play.clientWidth / 2 - BADGE_HALF_W * UNIT_PX;
    el.style.transform = `translate3d(${x.toFixed(1)}px,0,0) rotate(${angle.toFixed(2)}deg) scale(${look.scale.toFixed(3)})`;
    el.style.zIndex = String(look.zIndex);
    el.style.opacity = String(look.opacity);
    el.style.setProperty('--gx', `${(angle * 3).toFixed(1)}px`);
  }, [camRef]);

  const slotRefs = useRef(new Map<number, (el: HTMLDivElement | null) => void>());
  const slotRef = useCallback(
    (i: number) => {
      let fn = slotRefs.current.get(i);
      if (!fn) {
        fn = (el) => {
          if (el) {
            slots.current.set(i, el);
            placeSlot(i, el);
          } else slots.current.delete(i);
        };
        slotRefs.current.set(i, fn);
      }
      return fn;
    },
    [placeSlot],
  );

  // ---- boot, once per session (brief §15)
  useEffect(() => {
    if (reduce) return;
    try {
      // A QR or shared link lands on a profile: skip the power-on show.
      if (sessionStorage.getItem(BOOT_KEY) || startedOnProfile.current) return;
      sessionStorage.setItem(BOOT_KEY, '1');
    } catch {
      // storage blocked: boot every visit
    }
    const screen = screenRef.current;
    if (!screen) return;
    fx.current.boot = { t: 0, order: shuffledCells(Math.round(screen.clientWidth / UNIT_PX), Math.round(screen.clientHeight / UNIT_PX)) };
    hero.current = { ...hero.current, y: -60, vy: 0, air: true, hit: true };
    setLedBlink(true);
    const id = window.setTimeout(() => setLedBlink(false), 1100);
    return () => window.clearTimeout(id);
    // Runs once on mount; reduce is read at that moment on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- the animation loop
  useEffect(() => {
    let raf = 0;
    let last = 0;
    let t = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = last ? Math.min(2.5, (now - last) / 16.67) : 1;
      last = now;
      t += dt;
      const l = live.current;
      const a = assets.current;
      const play = playRef.current;
      const bg = bgRef.current?.getContext('2d');
      const fg = fgRef.current?.getContext('2d');
      if (!a || !play || !bg || !fg || !bgRef.current || !fgRef.current) return;

      const w = Math.max(60, Math.round(play.clientWidth / UNIT_PX));
      for (const c of [bgRef.current, fgRef.current]) {
        if (c.width !== w) c.width = w;
        if (c.height !== LEVEL_H) c.height = LEVEL_H;
      }

      const camAcc = step(dt);
      const cam = camRef.current.x;
      const idx = indexRef.current;

      // swing + place mounted badges
      for (const [n, el] of slots.current) {
        const s = swings.current.get(n) ?? { angle: 0, vel: 0 };
        const held = grab.current.active && n === idx;
        swings.current.set(n, l.reduce ? { angle: 0, vel: 0 } : held ? stepHeld(s, grab.current.dx, dt) : stepSwing(s, camAcc, dt));
        placeSlot(n, el);
      }
      for (const [n, b] of bumps.current) {
        if (b <= 0) bumps.current.delete(n);
        else bumps.current.set(n, b - dt);
      }

      // Pip walks to the current badge and jumps to flip it
      const h = hero.current;
      const dx = slotX(idx) - h.x;
      h.walking = Math.abs(dx) > 0.6 && !l.reduce;
      if (l.reduce) h.x = slotX(idx);
      else h.x += Math.max(-2.2, Math.min(2.2, dx * 0.18)) * dt;
      if (h.walking) h.face = dx > 0 ? 1 : -1;
      if (h.air) {
        h.vy += 0.22 * dt;
        h.y += h.vy * dt;
        if (!h.hit && GROUND_Y - 12 + h.y <= HEAD_HIT_Y && h.vy < 0) {
          h.hit = true;
          h.vy = Math.abs(h.vy) * 0.4;
          toggleFlip(idx);
        }
        if (h.y >= 0) {
          h.y = 0;
          h.vy = 0;
          h.air = false;
          if (flipQueued.current) {
            flipQueued.current = false;
            h.vy = -3.1;
            h.air = true;
            h.hit = false;
          }
        }
      }
      h.t += dt;
      for (let i = coinFx.current.length - 1; i >= 0; i--) {
        const c = coinFx.current[i]!;
        c.t += dt;
        c.vy += 0.16 * dt;
        c.y += c.vy * dt;
        if (c.t > 34) coinFx.current.splice(i, 1);
      }

      const world = {
        w,
        cam,
        t,
        night: document.documentElement.getAttribute('data-theme') === 'dark',
        still: l.reduce,
        count: l.count,
        flipped: (i: number) => {
          const c = l.cards[i];
          return !!c && l.flipped.has(c.username);
        },
        bump: (i: number) => bumps.current.get(i) ?? 0,
      };
      drawBackground(bg, world, a);
      drawForeground(fg, world, a, h, coinFx.current);

      // boot dissolve and iris share the overlay canvas
      const ov = overlayRef.current;
      const octx = ov?.getContext('2d');
      const boot = fx.current.boot;
      const iris = fx.current.iris;
      if (ov && octx && (boot || iris)) {
        const ow = Math.round(ov.clientWidth / UNIT_PX);
        const oh = Math.round(ov.clientHeight / UNIT_PX);
        if (ov.width !== ow) ov.width = ow;
        if (ov.height !== oh) ov.height = oh;
        ov.hidden = false;
        if (boot) {
          boot.t += dt;
          if (drawBoot(octx, ow, oh, boot.t, boot.order, a.colors.void)) fx.current.boot = null;
        } else if (iris) {
          iris.t += dt;
          drawIris(octx, ow, oh, iris.t, a.colors.void);
          if (iris.t >= IRIS_FRAMES / 2 && !iris.done) {
            iris.done = true;
            iris.mid();
          }
          if (iris.t >= IRIS_FRAMES) fx.current.iris = null;
        }
      } else if (ov && !ov.hidden) {
        ov.hidden = true;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [step, camRef, indexRef, grab, placeSlot, toggleFlip]);

  // ---- keyboard: ←/→ move, Enter/Space flip, O opens, Esc goes back (README, ADR-001)
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    screenRef.current?.focus({ preventScroll: true });
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (menuOpen) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
      return;
    }
    if ((e.key === 's' || e.key === 'S') && e.target === e.currentTarget) {
      e.preventDefault();
      setMenuOpen(true);
      return;
    }
    if (mode !== 'level') {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeProfile();
      }
      return;
    }
    if (count === 0) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(indexRef.current + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(indexRef.current - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      requestFlip();
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      openProfile();
    }
  };

  // ---- dialogue for each state (empty and error speak through the DialogueBox, CLAUDE.md)
  let shown: Line = line;
  let action: React.ReactNode = null;
  if (cardsState.status === 'loading') shown = { text: 'Loading players…', emote: 'pending' };
  else if (cardsState.status === 'error') {
    shown = { text: 'Can’t reach the hall right now. Check your connection and try again.', emote: 'attention' };
    action = (
      <button type="button" className="hw-btn" data-variant="small" onClick={cardsState.retry}>
        RETRY
      </button>
    );
  } else if (all.length === 0) shown = { text: 'No players in the hall yet. Make your card and be the first!' };
  else if (count === 0) {
    shown = { text: 'Nobody matches that. Try fewer words, or clear a filter.', emote: 'attention' };
    action = (
      <button type="button" className="hw-btn" data-variant="small" onClick={clearFilters}>
        CLEAR
      </button>
    );
  }

  const current = cards[car.index];
  // Opening someone's profile is a discovery (E1, FR-E1-02). Pays once; Pip says so on the screen.
  const profileId = mode === 'profile' ? current?.profile_id : undefined;
  const { discover, achievements: catalog } = pips;
  const { stampPerson } = stamps;
  useEffect(() => {
    if (!profileId) return;
    stampPerson(profileId); // the Passport (V2-2); members' accounts record it through the discovery below
    let on = true;
    void discover(profileId).then((r) => {
      const text = r && discoverLine(r, catalog);
      if (!on || !text) return;
      setReward({ for: profileId, text });
      if (r.amount > 0 && !live.current.reduce) coinFx.current.push({ x: slotX(indexRef.current), y: CEIL_Y - 2, vy: -2.6, t: 0 });
    });
    return () => {
      on = false;
    };
  }, [profileId, discover, catalog, indexRef, stampPerson]);
  const profileName = mode === 'profile' ? current?.card.full_name : null;
  useEffect(() => {
    document.title = profileName ? `${profileName} · PIP-Hall` : mode === 'missing' ? 'No card here · PIP-Hall' : mode === 'passport' ? 'Passport · PIP-Hall' : HALL_TITLE;
  }, [profileName, mode]);
  const screen = (
    <div
      ref={screenRef}
      className="screen"
      tabIndex={0}
      role="region"
      aria-roledescription="carousel"
      aria-label="PIP-Hall players. Left and right arrow keys move, Enter flips, O opens the profile, S opens START."
      onKeyDown={onKeyDown}
      onPointerDown={mode === 'level' ? car.onPointerDown : undefined}
      // A long press would open the phone's context menu; while a badge is held, it swings instead.
      onContextMenu={(e) => {
        if (grab.current.active) e.preventDefault();
      }}
    >
      <div ref={playRef} className="play">
        <canvas ref={bgRef} data-layer="bg" aria-hidden="true" />
        {cardsState.status === 'loading' ? (
          <SkeletonBadges />
        ) : (
          <CardCarousel
            cards={cards}
            index={car.index}
            near={car.near}
            isFlipped={(u) => flipped.has(u)}
            slotRef={slotRef}
            onActivate={onActivate}
            onOpen={openProfile}
            onShowQr={setQrCard}
          />
        )}
        <canvas ref={fgRef} data-layer="fg" aria-hidden="true" />
        <Hud coins={pips.summary?.eligible ? pips.summary.balance : coins} pips={Boolean(pips.summary?.eligible)} index={car.index} count={count} />
      </div>
      <DialogueBox text={shown.text} emote={shown.emote}>
        {action}
      </DialogueBox>
      {mode === 'profile' && current && (
        <ProfileScreen
          key={current.username}
          card={current}
          hall={all}
          onBack={closeProfile}
          onWalkTo={walkTo}
          onShowQr={() => setQrCard(current)}
          reward={reward?.for === current.profile_id ? reward.text : null}
        />
      )}
      {mode === 'missing' && <MissingScreen username={profile ?? ''} onBack={closeProfile} />}
      {mode === 'passport' && <PassportScreen hall={all} onBack={closeProfile} />}
      {menuOpen && (
        <StartMenu
          onBack={closeMenu}
          onRandom={() => {
            setMenuOpen(false);
            randomPlayer();
          }}
          onPassport={() => {
            setMenuOpen(false);
            openPassport();
          }}
          stamps={stamps.data.people.length + stamps.data.exhibits.length}
          officers={seats.size > 0}
          officersOn={Boolean(filters.officers)}
          onOfficers={() => {
            setMenuOpen(false);
            setFilters({ officers: !filters.officers });
            screenRef.current?.focus({ preventScroll: true });
          }}
          mapOpen={mapOpen}
          mart={pipsEnabled && mapSession.status === 'signed-in'}
          onShare={() => {
            setMenuOpen(false);
            setSharing(true);
          }}
        />
      )}
      <canvas ref={overlayRef} className="overlay-canvas pixelated" hidden aria-hidden="true" />
    </div>
  );

  return (
    <>
      <HallSearch
        filters={filters}
        onChange={setFilters}
        onClear={clearFilters}
        results={cards}
        current={mode === 'level' ? current : undefined}
        onPick={pickResult}
        officers={seats}
        options={options}
        shown={count}
        total={all.length}
        ready={cardsState.status === 'ready'}
      />
      <HandheldShell
        screen={screen}
        onPrev={() => go(indexRef.current - 1)}
        onNext={() => go(indexRef.current + 1)}
        onFlip={requestFlip}
        onOpen={menuOpen ? closeMenu : mode === 'level' ? openProfile : closeProfile}
        openLabel={menuOpen || mode !== 'level' ? 'BACK' : 'OPEN'}
        controlsDisabled={count === 0}
        ledBlink={ledBlink}
        start={{ onClick: () => (menuOpen ? closeMenu() : setMenuOpen(true)), open: menuOpen, controls: START_MENU_ID }}
      />
      {cardsState.status === 'ready' && (
        <HallTabs
          cards={all}
          onSearch={(patch) => {
            const next = filtersToParams({ ...NO_FILTERS, q: patch.q ?? '', skill: patch.skill ?? null, department: patch.department ?? null });
            if (mode !== 'level') navigate({ pathname: '/', search: next.toString() });
            else setParams(next, { replace: true });
            screenRef.current?.focus({ preventScroll: true });
          }}
          onRandom={randomPlayer}
          onPips={pips.setBalance}
        />
      )}
      {sharing && (
        <QrSheet
          url={hallUrl()}
          heading="JOIN THE HALL"
          lead="Scan to meet the members of PIP-Hall."
          codeTitle="QR code for the PIP-Hall website"
          onClose={() => setSharing(false)}
          returnTo={() => screenRef.current} // the START item that opened it is gone
        />
      )}
      {qrCard && <QrFullscreen card={qrCard} onClose={() => setQrCard(null)} />}
    </>
  );
}
