// "Made with" on a profile (V2-13, #2): one member's own links, drawn as a small constellation (the
// member in the middle, the people they've made things with around them, a thicker line for more
// shared projects) with the same links as a plain list beneath it, which is what keyboards and
// screen readers use. Always on; the full map of the hall (/network) still waits for density.

import { Link } from 'react-router';
import { memberPath } from '../../lib/publicUrl';
import type { PublicCard } from '../../types/card';

const W = 240;
const H = 150;
const SHOWN = 8;

export function MadeWithMap({ me, links }: { me: PublicCard; links: readonly { card: PublicCard; projects: string[] }[] }) {
  const shown = links.slice(0, SHOWN);
  const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;
  // First names on the map; a handle where two would read the same.
  const firsts = shown.map((l) => first(l.card.card.full_name));
  const label = (i: number) => (firsts.filter((f) => f === firsts[i]).length > 1 ? `@${shown[i]!.card.username}` : firsts[i]!);
  const at = (i: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(shown.length, 1);
    return { x: Math.round(W / 2 + Math.cos(a) * 92), y: Math.round(H / 2 + Math.sin(a) * 50) };
  };
  return (
    <section className="menu-panel" aria-labelledby="profile-made-with">
      <h3 id="profile-made-with" className="panel-title">
        Made with <span className="text-text-secondary">· {links.length}</span>
      </h3>
      <svg className="made-with-map" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
        {shown.map((l, i) => {
          const p = at(i);
          return <line key={l.card.username} className="mw-edge" x1={W / 2} y1={H / 2} x2={p.x} y2={p.y} strokeWidth={Math.min(l.projects.length, 3) * 2} />;
        })}
        {shown.map((l, i) => {
          const p = at(i);
          return (
            <g key={l.card.username}>
              <rect className="mw-node" x={p.x - 5} y={p.y - 5} width={10} height={10} />
              <text className="mw-label" x={p.x} y={p.y + (p.y < H / 2 ? -9 : 17)} textAnchor="middle">
                {label(i).slice(0, 14)}
              </text>
            </g>
          );
        })}
        <rect className="mw-node mw-me" x={W / 2 - 8} y={H / 2 - 8} width={16} height={16} />
      </svg>
      <ul className="made-with-list" aria-label={`People ${first(me.card.full_name)} has made things with`}>
        {links.map((l) => (
          <li key={l.card.username}>
            <Link to={memberPath(l.card.username)} className="underline decoration-2">
              {l.card.card.full_name}
            </Link>{' '}
            <span className="text-caption text-text-secondary">· {l.projects.join(', ')}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
