// Skills become ★ power-ups on the back of the badge and the first ones become stickers.

import { useId, useState } from 'react';
import { LIMITS, cleanSkill } from '../../lib/validate';

export function SkillsInput({ skills, onChange, error }: { skills: string[]; onChange: (s: string[]) => void; error?: string }) {
  const id = useId();
  const [text, setText] = useState('');
  const full = skills.length >= LIMITS.skills;

  const add = () => {
    const s = cleanSkill(text);
    if (!s || full) return;
    if (!skills.some((k) => k.toLowerCase() === s.toLowerCase())) onChange([...skills, s.slice(0, LIMITS.skill)]);
    setText('');
  };

  return (
    <div className="field" data-field="skills">
      <label htmlFor={id} className="field-label">
        Skills <span className="field-hint-inline">({skills.length}/{LIMITS.skills})</span>
      </label>
      {skills.length > 0 && (
        <ul className="chips" aria-label="Your skills">
          {skills.map((s) => (
            <li key={s} className="chip">
              ★ {s}
              <button type="button" className="chip-x" aria-label={`Remove ${s}`} onClick={() => onChange(skills.filter((k) => k !== s))}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-space-2">
        <input
          id={id}
          className="pixel-input flex-1"
          value={text}
          disabled={full}
          maxLength={LIMITS.skill}
          placeholder={full ? 'That’s the maximum of 8' : 'Type a skill and press Enter'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="pixel-btn" onClick={add} disabled={full || !cleanSkill(text)}>
          Add
        </button>
      </div>
      {error && (
        <p id={`${id}-err`} className="field-error" role="alert">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      )}
    </div>
  );
}
