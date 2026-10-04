// Feature switches. Public build-time values (not secrets), set per environment in Vercel.

/** PIP Progression (D-058): off unless VITE_FEATURE_PIPS is "on". */
export const pipsEnabled = import.meta.env.VITE_FEATURE_PIPS === 'on';
