// Who made an archive exhibit (D-118): members of the hall link to their badge; other makers are
// named only with their consent (the database leaves them out otherwise), and the rest are counted,
// so "and 2 more" and "a team of 4" stay true. The team name follows when there is one.

import { Fragment } from 'react';
import { Link } from 'react-router';
import { unnamed, type ArchiveExhibit } from '../../lib/archive';
import { memberPath } from '../../lib/publicUrl';

export function ArchiveCredit({ archive: a }: { archive: ArchiveExhibit }) {
  const named = a.makers.filter((m) => m.full_name || m.username);
  const more = unnamed(a);
  const team = a.team_name?.trim() || null;
  if (named.length === 0) {
    const who = team ?? (a.team_size > 1 ? `a team of ${a.team_size}` : a.team_size === 1 ? 'one maker' : null);
    return who ? <>{who}</> : null;
  }
  return (
    <>
      {named.map((m, i) => (
        <Fragment key={`${m.username ?? m.full_name}-${i}`}>
          {i > 0 && (i === named.length - 1 && more === 0 ? ' and ' : ', ')}
          {m.username ? (
            <Link to={memberPath(m.username)} className="underline decoration-2">
              {m.full_name ?? m.username}
            </Link>
          ) : (
            m.full_name
          )}
        </Fragment>
      ))}
      {more > 0 && ` and ${more} more`}
      {team && <span className="text-text-secondary"> · {team}</span>}
    </>
  );
}
