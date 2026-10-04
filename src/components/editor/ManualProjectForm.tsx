// Projects that aren't public GitHub repos: Devpost, design work, private or school work (D-007).

import { useState } from 'react';
import { LIMITS, validateProject, type FieldErrors } from '../../lib/validate';
import type { DraftProject } from '../../types/draft';
import { TextArea, TextField } from './fields';

const blank = (key: string): DraftProject => ({
  key,
  source: 'manual',
  github_repo_id: null,
  title: '',
  description: null,
  cover_path: null,
  project_url: null,
  github_url: null,
  language: null,
  stars: null,
  tech_stack: [],
  project_date: null,
});

export function ManualProjectForm({ disabled, onAdd }: { disabled: boolean; onAdd: (p: DraftProject) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftProject>(() => blank(crypto.randomUUID()));
  const [errors, setErrors] = useState<FieldErrors>({});
  const f = (name: string) => `manual.${name}`;

  if (!open) {
    return (
      <button type="button" className="pixel-btn justify-self-start" onClick={() => setOpen(true)} disabled={disabled}>
        + Add a project by hand
      </button>
    );
  }

  const add = () => {
    const e: FieldErrors = {};
    validateProject(draft, 'manual', e);
    setErrors(e);
    if (Object.keys(e).length) return;
    onAdd({ ...draft, title: draft.title.trim() });
    setDraft(blank(crypto.randomUUID()));
    setOpen(false);
  };

  return (
    <fieldset className="manual-form">
      <legend className="font-display text-h3">New project</legend>
      <TextField field={f('title')} label="Title" value={draft.title} max={LIMITS.project_title} error={errors[f('title')]} onChange={(v) => setDraft({ ...draft, title: v })} />
      <TextArea
        field={f('description')}
        label="What is it?"
        rows={2}
        value={draft.description ?? ''}
        max={LIMITS.project_description}
        error={errors[f('description')]}
        onChange={(v) => setDraft({ ...draft, description: v })}
      />
      <TextField
        field={f('project_url')}
        label="Link (optional)"
        type="url"
        inputMode="url"
        placeholder="https://"
        value={draft.project_url ?? ''}
        error={errors[f('project_url')]}
        onChange={(v) => setDraft({ ...draft, project_url: v })}
      />
      <TextField field={f('language')} label="Made with (optional)" value={draft.language ?? ''} max={LIMITS.project_language} onChange={(v) => setDraft({ ...draft, language: v })} />
      <div className="flex gap-space-2">
        <button type="button" className="pixel-btn" data-variant="primary" onClick={add}>
          Add project
        </button>
        <button type="button" className="pixel-btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </fieldset>
  );
}
