// The card's projects in order (the back shows the first 3; the profile page shows all 6).
// Reorder with ↑ ↓, edit the text, remove. GitHub facts (language, stars) come from GitHub.

import { LIMITS } from '../../lib/validate';
import type { DraftProject } from '../../types/draft';
import { CoverField } from './CoverField';
import { TextArea, TextField } from './fields';

interface Props {
  projects: DraftProject[];
  errors: Record<string, string>;
  onChange: (key: string, patch: Partial<DraftProject>) => void;
  onMove: (key: string, by: -1 | 1) => void;
  onRemove: (key: string) => void;
  /** Screen picture to show for each project key (new pick or saved), D-092. */
  coverUrls: Record<string, string | null>;
  onCover: (key: string, image: Blob | null) => void;
}

export function ProjectList({ projects, errors, onChange, onMove, onRemove, coverUrls, onCover }: Props) {
  if (projects.length === 0) {
    return <p className="m-0 text-text-secondary">No projects yet. Pick repos above or add one by hand. A card with none shows “No quests yet”.</p>;
  }
  return (
    <ol className="project-list" aria-label="Projects on your card">
      {projects.map((p, i) => {
        const f = (name: string) => `projects.${p.key}.${name}`;
        return (
          <li key={p.key} className="project-item">
            <div className="flex flex-wrap items-center gap-space-2">
              <span className="quest-n px-space-1" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="font-display text-h3 flex-1 min-w-0 truncate">{p.title || 'Untitled project'}</span>
              <span className="repo-tag">{p.source === 'github' ? 'GitHub' : 'Manual'}</span>
              {i < 3 && <span className="repo-tag">on the back</span>}
              <div className="flex gap-space-1">
                <button type="button" className="pixel-btn icon-btn" onClick={() => onMove(p.key, -1)} disabled={i === 0} aria-label={`Move ${p.title || 'project'} up`}>
                  ↑
                </button>
                <button type="button" className="pixel-btn icon-btn" onClick={() => onMove(p.key, 1)} disabled={i === projects.length - 1} aria-label={`Move ${p.title || 'project'} down`}>
                  ↓
                </button>
                <button type="button" className="pixel-btn icon-btn" onClick={() => onRemove(p.key)} aria-label={`Remove ${p.title || 'project'}`}>
                  ×
                </button>
              </div>
            </div>
            <TextField field={f('title')} label="Title" value={p.title} max={LIMITS.project_title} error={errors[f('title')]} onChange={(v) => onChange(p.key, { title: v })} />
            <TextArea
              field={f('description')}
              label="Description"
              rows={2}
              value={p.description ?? ''}
              max={LIMITS.project_description}
              error={errors[f('description')]}
              onChange={(v) => onChange(p.key, { description: v })}
            />
            <TextField
              field={f('project_url')}
              label="Live link (optional)"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={p.project_url ?? ''}
              error={errors[f('project_url')]}
              onChange={(v) => onChange(p.key, { project_url: v })}
            />
            {p.source === 'manual' ? (
              <TextField field={f('language')} label="Made with (optional)" value={p.language ?? ''} max={LIMITS.project_language} error={errors[f('language')]} onChange={(v) => onChange(p.key, { language: v })} />
            ) : (
              <p className="m-0 text-caption text-text-secondary">
                From GitHub: {[p.language, p.stars !== null ? `★ ${p.stars}` : null].filter(Boolean).join(' · ') || 'no language listed'}
                {p.github_url && (
                  <>
                    {' · '}
                    <a href={p.github_url} target="_blank" rel="noopener noreferrer">
                      repo<span className="sr-only"> (opens in a new tab)</span>
                    </a>
                  </>
                )}
              </p>
            )}
            <CoverField title={p.title} previewUrl={coverUrls[p.key] ?? null} onPicked={(img) => onCover(p.key, img)} onRemove={() => onCover(p.key, null)} />
          </li>
        );
      })}
    </ol>
  );
}
