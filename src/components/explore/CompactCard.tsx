// The compact badge for the Explore grid (brief §10 MemberCard "compact"): photo window, name,
// handle, role and a few skills. The name is the link; its hit area covers the whole card.

import { Link } from 'react-router';
import { memberPath } from '../../lib/publicUrl';
import type { PublicCard } from '../../types/card';
import { BadgeScene } from '../cards/BadgeScene';
import { PixelAvatar } from '../cards/PixelAvatar';

const SHOWN_SKILLS = 3;

export function CompactCard({ card }: { card: PublicCard }) {
  const c = card.card;
  const more = c.skills.length - SHOWN_SKILLS;
  return (
    <article className="compact-card">
      <div className="compact-band">
        <span>PIP-HALL</span>
        <span>No.{String(card.no).padStart(3, '0')}</span>
      </div>
      <div className="photo-window">
        <BadgeScene />
        <PixelAvatar username={c.username} name={c.full_name} avatarPath={c.avatar_path} />
        {c.department && <span className="dept">{c.department}</span>}
      </div>
      <div className="grid gap-space-1">
        <h2 className="compact-name">
          <Link to={memberPath(c.username)} className="compact-link">
            {c.full_name}
          </Link>
        </h2>
        <p className="compact-meta">@{c.username}</p>
        {c.role && <p className="compact-meta">{c.role}</p>}
      </div>
      {c.skills.length > 0 && (
        <ul className="powerups" aria-label="Skills">
          {c.skills.slice(0, SHOWN_SKILLS).map((s) => (
            <li key={s}>★ {s}</li>
          ))}
          {more > 0 && <li>+{more}</li>}
        </ul>
      )}
      <p className="compact-foot">
        <span>
          {c.projects.length} {c.projects.length === 1 ? 'project' : 'projects'}
        </span>
        {c.is_featured && (
          <span className="compact-featured">
            <span aria-hidden="true">★ </span>FEATURED
          </span>
        )}
      </p>
    </article>
  );
}
