// The Journal (V2-24, D-137): the Museum's default view. On the PIXENDO's screen the Museum is a
// flip-book journal: each room a chapter, in the order the admins arranged them (D-133), its exhibits
// the pages (JournalBook). Next and Back turn the pages and run on into the next chapter, so a
// presenter's clicker walks the whole Museum; the chapter buttons jump. OPEN (or a tap on the front
// page, or Enter) opens the page as a spread (JournalSpread), and the address keeps it open, so Back
// closes it and a shared link reopens it. Present takes the journal to the showcase screen (/booth).
// The List view and the walk are one link away. A lazy chunk.

import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { nextChapter, stepPage } from '../../lib/journal';
import { awardLine, planRooms, plaqueBy, type MuseumParts, type RoomKind } from '../../lib/museumWalk';
import { roomStops } from '../../lib/showcase';
import { useReducedMotion } from '../../lib/useReducedMotion';
import { HandheldShell } from '../shell/HandheldShell';
import { JournalBook } from './JournalBook';
import { JournalSpread } from './JournalSpread';

interface Props {
  parts: MuseumParts;
  /** The room (chapter) the address names, and the exhibit (page) to open the book at. */
  room: string | null;
  at: string | null;
  /** The address says the page at `at` is open. */
  open: boolean;
  /** The address follows the chapter. */
  onRoom: (id: string) => void;
  /** Open a page: the address gains it, so Back closes it and a link reopens it. */
  onOpen: (room: string, at: string) => void;
  onClose: () => void;
}

const GLYPH: Readonly<Record<RoomKind, string>> = { winners: '♛', event: '⚑', members: '☺', wing: '▣', all: '✶', archive: '▤' };
const MOVE = { group: 'Turn the pages', prev: 'Previous page', next: 'Next page' };

export default function MuseumJournal({ parts, room, at, open, onRoom, onOpen, onClose }: Props) {
  const reduce = useReducedMotion();
  // Chapters are rooms with something on show.
  const chapters = useMemo(() => planRooms(parts).map((r) => ({ room: r, stops: roomStops(r) })).filter((c) => c.stops.length > 0), [parts]);
  const sizes = useMemo(() => chapters.map((c) => c.stops.length), [chapters]);
  const start = Math.max(0, chapters.findIndex((c) => c.room.id === room));
  const [place, setPlace] = useState(() => ({ chapter: start, page: Math.max(0, chapters[start]?.stops.findIndex((s) => s.exhibit.project_id === at) ?? 0) }));
  const ch = Math.min(place.chapter, Math.max(0, chapters.length - 1));
  const here = chapters[ch];
  const stops = useMemo(() => here?.stops ?? [], [here]);
  const i = Math.min(place.page, Math.max(0, stops.length - 1));
  const stop = stops[i];

  // Back and Forward move `at`: the book follows it.
  useEffect(() => {
    if (!at) return;
    const k = stops.findIndex((s) => s.exhibit.project_id === at);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the address moved, like the hall's sync
    if (k >= 0) setPlace((p) => (p.page === k ? p : { ...p, page: k }));
  }, [at, stops]);

  const goTo = useCallback(
    (next: { chapter: number; page: number }) => {
      setPlace(next);
      if (next.chapter !== ch && chapters[next.chapter]) onRoom(chapters[next.chapter]!.room.id);
    },
    [ch, chapters, onRoom],
  );
  const step = useCallback((d: 1 | -1) => goTo(stepPage(ch, i, d, sizes)), [goTo, ch, i, sizes]);
  const chapterBy = useCallback((d: 1 | -1) => chapters.length > 1 && goTo({ chapter: nextChapter(ch, d, chapters.length), page: 0 }), [goTo, ch, chapters.length]);
  const openFront = useCallback(() => {
    if (here && stop) onOpen(here.room.id, stop.exhibit.project_id);
  }, [here, stop, onOpen]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') chapterBy(e.key === 'ArrowDown' ? 1 : -1);
    else return;
    e.preventDefault();
  };

  const n = stops.length;
  const members = here?.room.kind === 'members';
  const by = stop && !stop.exhibit.portrait ? plaqueBy(stop.exhibit) : null;
  const title = stop ? (stop.exhibit.portrait ? stop.exhibit.full_name : stop.exhibit.project.title) : '';
  const nextName = chapters.length > 1 ? chapters[nextChapter(ch, 1, chapters.length)]!.room.name : null;
  const prevName = chapters.length > 1 ? chapters[nextChapter(ch, -1, chapters.length)]!.room.name : null;
  const spreadOpen = open && stop && stop.exhibit.project_id === at;
  const present = here?.room.event ? `/booth?event=${encodeURIComponent(here.room.event.key)}` : '/booth';

  const screenEl = (
    <div className="screen museum-journal">
      <div className="play journal-room" data-style={here?.room.style}>
        {here && (
          <header className="journal-head">
            <button type="button" className="pixel-btn journal-chapter-btn" disabled={!prevName} onClick={() => chapterBy(-1)}>
              <span aria-hidden="true">⏮</span>
              <span className="sr-only">Previous chapter{prevName ? `: ${prevName}` : ''}</span>
            </button>
            <div className="journal-heading">
              <h2 className="journal-chapter m-0">
                <span className="journal-glyph" aria-hidden="true">
                  {GLYPH[here.room.kind]}
                </span>
                <span className="journal-chapter-name">{here.room.name}</span>
              </h2>
              <p className="journal-sub m-0">
                Chapter {ch + 1} of {chapters.length} · {n} {members ? (n === 1 ? 'member' : 'members') : n === 1 ? 'page' : 'pages'}
              </p>
            </div>
            <button type="button" className="pixel-btn journal-chapter-btn" disabled={!nextName} onClick={() => chapterBy(1)}>
              <span aria-hidden="true">⏭</span>
              <span className="sr-only">Next chapter{nextName ? `: ${nextName}` : ''}</span>
            </button>
          </header>
        )}
        {here && (
          <JournalBook
            stops={stops}
            index={i}
            scene={here.room.id}
            reduce={reduce}
            id="journal"
            label={`${here.room.name}, chapter ${ch + 1} of ${chapters.length}. Left and right arrow keys (or Page Up and Page Down) turn the pages, Enter opens the page in front, up and down change chapter.`}
            onTurn={(k) => setPlace({ chapter: ch, page: k })}
            onStep={step}
            onOpen={openFront}
            onKey={onKey}
          />
        )}
        {stop && (
          <nav className="journal-controls" aria-label="The journal">
            <button type="button" className="pixel-btn journal-round" onClick={() => step(-1)}>
              <span aria-hidden="true">◀</span>
              <span className="sr-only">Turn back a page</span>
            </button>
            <button type="button" className="pixel-btn journal-open" data-variant="primary" onClick={openFront}>
              <span aria-hidden="true">▶ </span>OPEN<span className="sr-only"> {title}</span>
            </button>
            <button type="button" className="pixel-btn journal-round" onClick={() => step(1)}>
              <span aria-hidden="true">▶</span>
              <span className="sr-only">Turn the page</span>
            </button>
            <Link to={present} className="pixel-btn journal-present">
              <span aria-hidden="true">⛶</span>
              <span className="journal-present-label"> Present</span>
              <span className="sr-only"> the journal on the showcase screen</span>
            </Link>
          </nav>
        )}
        <p className="sr-only" role="status">
          {stop ? `Page ${i + 1} of ${n} in chapter ${ch + 1}, ${here!.room.name}: ${title}${by ? `, by ${by}` : ''}${stop.awards.length ? `, ${awardLine(stop.awards[0]!)}` : ''}.` : ''}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <HandheldShell
        screen={screenEl}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
        onFlip={() => chapterBy(1)}
        onOpen={openFront}
        openLabel="OPEN"
        controlsDisabled={chapters.length === 0}
        ledBlink={false}
        moveLabels={MOVE}
        flipLabel="CHAPTER"
      />
      {spreadOpen && here && <JournalSpread stop={stop} kicker={`Page ${i + 1} of ${n} · Chapter ${ch + 1}, ${here.room.name}`} reduce={reduce} onClose={onClose} />}
    </>
  );
}
