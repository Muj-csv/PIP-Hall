import { useId } from 'react';
import { useTheme, type ThemeChoice } from '../../app/themeContext';

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'DAY' },
  { value: 'dark', label: 'NIGHT' },
  { value: 'system', label: 'AUTO' },
];
const NEXT: Readonly<Record<ThemeChoice, ThemeChoice>> = { light: 'dark', dark: 'system', system: 'light' };
const NAME: Readonly<Record<ThemeChoice, string>> = { light: 'DAY', dark: 'NIGHT', system: 'AUTO' };

/** DAY / NIGHT / AUTO (follows the device), FR-15. Settings shows all three; the top bar shows one
 *  button that steps through them, so the bar stays short (D-126). */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { choice, setChoice } = useTheme();
  // Unique per instance: the top bar and Settings can both show the switch.
  const name = useId();
  if (compact) {
    return (
      <button type="button" className="pixel-btn theme-step" onClick={() => setChoice(NEXT[choice])} aria-label={`World: ${NAME[choice]}. Switch to ${NAME[NEXT[choice]]}`}>
        World: {NAME[choice]}
      </button>
    );
  }
  return (
    <fieldset className="flex items-center gap-space-1 border-0 p-0 m-0">
      <legend className="sr-only">World</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="pixel-btn min-w-[64px] cursor-pointer text-[15px] has-[:checked]:bg-text-primary has-[:checked]:text-bg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus-ring">
          <input type="radio" name={name} value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
