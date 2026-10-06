// Pixel form controls (brief §10 PixelInput / PixelTextarea): label above, hint and error below,
// error linked with aria-describedby and never shown by colour alone.

import { useId, type ReactNode } from 'react';

interface Base {
  /** Key used for errors and for focusing the first invalid field. */
  field: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  max?: number;
}

function Meta({ id, error, hint, length, max }: { id: string; error?: string; hint?: ReactNode; length?: number; max?: number }) {
  return (
    <>
      {error ? (
        <p id={`${id}-err`} className="field-error" role="alert">
          <span aria-hidden="true">! </span>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {max !== undefined && length !== undefined && (
        <span className="field-count" aria-hidden="true" data-over={length > max}>
          {length}/{max}
        </span>
      )}
    </>
  );
}

export function TextField({
  field,
  label,
  error,
  hint,
  max,
  value,
  onChange,
  type = 'text',
  readOnly,
  placeholder,
  autoComplete,
  inputMode,
}: Base & {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'email' | 'url';
  readOnly?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: 'text' | 'email' | 'url';
}) {
  const id = useId();
  return (
    <div className="field" data-field={field}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="pixel-input"
        type={type}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={type === 'text'}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <Meta id={id} error={error} hint={hint} length={max ? value.length : undefined} max={max} />
    </div>
  );
}

export function TextArea({ field, label, error, hint, max, value, onChange, rows = 3 }: Base & { value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId();
  return (
    <div className="field" data-field={field}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea
        id={id}
        className="pixel-input"
        rows={rows}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <Meta id={id} error={error} hint={hint} length={max ? value.length : undefined} max={max} />
    </div>
  );
}

export function Toggle({ field, label, hint, checked, onChange, error }: Omit<Base, 'max'> & { checked: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  return (
    <div className="field" data-field={field}>
      <label htmlFor={id} className="toggle">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={hint ? `${id}-hint` : undefined} />
        <span>{label}</span>
      </label>
      <Meta id={id} error={error} hint={hint} />
    </div>
  );
}

/** A labelled pixel select (Admin → Rewards, D-087). */
export function SelectField<T extends string>({
  field,
  label,
  hint,
  error,
  value,
  options,
  onChange,
}: Omit<Base, 'max'> & { value: T; options: readonly { value: T; label: string }[]; onChange: (v: T) => void }) {
  const id = useId();
  return (
    <div className="field" data-field={field}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        className="pixel-input"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Meta id={id} error={error} hint={hint} />
    </div>
  );
}
