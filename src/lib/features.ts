// Feature switches. Public build-time values (not secrets), set per environment in Vercel.

/** "on", forgiving of case and stray spaces or line breaks typed into the Vercel value box. */
export function switchOn(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase() === 'on';
}

/** PIP Progression (D-058): off unless VITE_FEATURE_PIPS is "on". */
export const pipsEnabled = switchOn(import.meta.env.VITE_FEATURE_PIPS);
