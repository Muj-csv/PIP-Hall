// /network — the map of the hall and project lineage (V2-8, D-105). People, what they made and the
// skills they share, drawn from the published cards. It waits for density (D-096, rule 12): until
// the hall has enough members with projects and enough team-ups, the page says how close it is and
// how to help, honestly. Admins can preview it before then. Every line on the map is also in the
// lists below it, for keyboards and screen readers (rule 8).

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useSession } from '../app/sessionContext';
import { DialogueBox } from '../components/dialogue/DialogueBox';
import { MenuPage } from '../components/shell/MenuPage';
import { buildNetwork, connections, DENSITY, density, layout, lineage, neighbours, type NetNode } from '../lib/network';
import { memberPath } from '../lib/publicUrl';
import { useCards } from '../lib/useCards';

const W = 960;
const H = 640;

export default function Network() {
  const cards = useCards();
  const { session } = useSession();
  const admin = session.status === 'signed-in' && session.role === 'admin';
  const all = useMemo(() => (cards.status === 'ready' ? cards.cards : []), [cards]);
  const d = useMemo(() => density(all), [all]);
  const open = d.ready || admin;
  const net = useMemo(() => (open && all.length ? layout(buildNetwork(all), W, H) : null), [open, all]);
  const list = useMemo(() => (open ? connections(all) : []), [open, all]);
  const lines = useMemo(() => (open ? lineage(all) : []), [open, all]);

  return (
    <MenuPage title="Map of the hall" wide>
      {cards.status === 'loading' && <DialogueBox text="Unrolling the map…" emote="pending" />}
      {cards.status === 'error' && (
        <DialogueBox text="Can’t reach the hall right now. Check your connection and try again." emote="attention">
          <button type="button" className="hw-btn" data-variant="small" onClick={cards.retry}>
            RETRY
          </button>
        </DialogueBox>
      )}
      {cards.status === 'ready' && !open && (
        <DialogueBox
          text={`The map opens when ${DENSITY.members} members have projects and ${DENSITY.teamups} pairs have made something together, so it shows real connections instead of an empty sky. Right now: ${d.members} ${d.members === 1 ? 'member' : 'members'} with projects and ${d.teamups} ${d.teamups === 1 ? 'team-up' : 'team-ups'}.`}
        >
          <Link to="/edit#collaborators" className="hw-btn no-underline" data-variant="small">
            TAG A TEAMMATE
          </Link>
        </DialogueBox>
      )}
      {cards.status === 'ready' && open && (
        <>
          {!d.ready && (
            <p className="notice m-0" role="status">
              Preview for admins: visitors see this once the hall has {DENSITY.members} members with projects and {DENSITY.teamups} team-ups (now {d.members} and {d.teamups}).
            </p>
          )}
          {net && <MapView net={net} />}
          <section className="menu-panel" aria-labelledby="net-people">
            <h2 id="net-people" className="panel-title">
              Who made what together
            </h2>
            <ul className="net-list">
              {list.map(({ card, madeWith, sharedSkills }) => (
                <li key={card.username}>
                  <Link to={memberPath(card.username)} className="underline decoration-2">
                    {card.card.full_name}
                  </Link>
                  {madeWith.length > 0 ? (
                    <span>
                      {' '}
                      made{' '}
                      {madeWith.map((m, i) => (
                        <span key={m.card.username}>
                          {i > 0 && (i === madeWith.length - 1 ? ' and ' : ', ')}
                          {m.projects.map((p) => `“${p}”`).join(', ')} with{' '}
                          <Link to={memberPath(m.card.username)} className="underline decoration-2">
                            {m.card.card.full_name}
                          </Link>
                        </span>
                      ))}
                      .
                    </span>
                  ) : (
                    <span className="text-text-secondary"> hasn’t been credited on a team project yet.</span>
                  )}
                  {sharedSkills.length > 0 && <span className="text-caption text-text-secondary"> Shares {sharedSkills.join(', ')} with others.</span>}
                </li>
              ))}
            </ul>
          </section>
          <section className="menu-panel" aria-labelledby="net-lineage">
            <h2 id="net-lineage" className="panel-title">
              Project lineage
            </h2>
            {lines.length === 0 ? (
              <p className="m-0 field-hint">No two projects share a maker yet.</p>
            ) : (
              <ul className="net-list">
                {lines.map((l) => (
                  <li key={`${l.owner.username}-${l.project.id ?? l.project.title}`}>
                    <b>{l.project.title}</b> <span className="text-caption text-text-secondary">by {l.owner.card.full_name}</span> leads to{' '}
                    {l.related.map((r, i) => (
                      <span key={`${r.owner.username}-${r.project.id ?? r.project.title}`}>
                        {i > 0 && ', '}“{r.project.title}” <span className="text-caption text-text-secondary">(through {r.via.map((v) => v.card.full_name).join(' and ')})</span>
                      </span>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </MenuPage>
  );
}

/** The constellation. People are squares, projects diamonds, shared skills small dots; focusing or
 *  pointing at a person lights up everything they're linked to and dims the rest. */
function MapView({ net }: { net: ReturnType<typeof layout> }) {
  const navigate = useNavigate();
  const [lit, setLit] = useState<string | null>(null);
  const near = useMemo(() => (lit ? neighbours(net, lit) : null), [net, lit]);
  const at = useMemo(() => new Map(net.nodes.map((n) => [n.id, n])), [net]);
  const people = net.nodes.filter((n) => n.kind === 'person').length;
  const projects = net.nodes.filter((n) => n.kind === 'project').length;
  const skills = net.nodes.filter((n) => n.kind === 'skill').length;
  const dim = (id: string) => (near && !near.has(id) ? true : undefined);

  const shape = (n: NetNode) => {
    if (n.kind === 'person') return <rect x={n.x - 8} y={n.y - 8} width={16} height={16} className="net-person" />;
    if (n.kind === 'project') return <rect x={n.x - 6} y={n.y - 6} width={12} height={12} className="net-project" transform={`rotate(45 ${n.x} ${n.y})`} />;
    return <rect x={n.x - 4} y={n.y - 4} width={8} height={8} className="net-skill" />;
  };

  return (
    <figure className="net-map m-0" aria-labelledby="net-caption">
      <figcaption id="net-caption" className="grid gap-space-1">
        <span className="font-display tracking-[0.04em]">
          {people} people · {projects} projects · {skills} shared skills
        </span>
        <span className="text-caption text-text-secondary">
          <span aria-hidden="true">■</span> person <span aria-hidden="true">◆</span> project <span aria-hidden="true">▪</span> shared skill. Point at or tab to a person to light up their links; open them with Enter. The same links are listed below.
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="net-svg" onPointerLeave={() => setLit(null)}>
        <g aria-hidden="true">
          {net.edges.map((e, i) => {
            const a = at.get(e.a)!;
            const b = at.get(e.b)!;
            return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="net-edge" data-kind={e.kind} data-dim={dim(e.a) || dim(e.b)} />;
          })}
        </g>
        {net.nodes.map((n) =>
          n.kind === 'person' ? (
            <a
              key={n.id}
              href={memberPath(n.username!)}
              className="net-node"
              data-dim={dim(n.id)}
              aria-label={`${n.label}, open their profile`}
              onFocus={() => setLit(n.id)}
              onBlur={() => setLit(null)}
              onPointerEnter={() => setLit(n.id)}
              onClick={(e) => {
                e.preventDefault();
                navigate(memberPath(n.username!));
              }}
            >
              {shape(n)}
              <text x={n.x} y={n.y + 22} textAnchor="middle" className="net-label">
                {n.label}
              </text>
            </a>
          ) : (
            <g key={n.id} className="net-node" data-dim={dim(n.id)} aria-hidden="true">
              {shape(n)}
              {near?.has(n.id) && (
                <text x={n.x} y={n.y - 12} textAnchor="middle" className="net-label" data-kind={n.kind}>
                  {n.label}
                </text>
              )}
            </g>
          ),
        )}
      </svg>
    </figure>
  );
}
