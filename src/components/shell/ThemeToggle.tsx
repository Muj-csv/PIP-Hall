import { useTheme, type ThemeChoice } from '../../app/themeContext';

const OPTIONS: { value: ThemeChoice; label: string }[] = [
  { value: 'light', label: 'DAY' },
  { value: 'dark', label: 'NIGHT' },
  { value: 'system', label: 'AUTO' },
];

/** DAY / NIGHT / AUTO (follows the device), FR-15. */
export function ThemeToggle() {
  const { choice, setChoice } = useTheme();
  return (
    <fieldset className="flex items-center gap-space-1 border-0 p-0 m-0">
      <legend className="sr-only">World</legend>
      {OPTIONS.map((o) => (
        <label key={o.value} className="pixel-btn min-w-[64px] cursor-pointer text-[15px] has-[:checked]:bg-text-primary has-[:checked]:text-bg has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus-ring">
          <input type="radio" name="theme" value={o.value} checked={choice === o.value} onChange={() => setChoice(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}
