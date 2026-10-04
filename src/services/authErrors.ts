// Turns Supabase / OAuth error codes into lines Pip can say (ARCHITECTURE §6 failure cases).

export interface AuthProblem {
  code: string;
  message: string;
}

const MESSAGES: Record<string, string> = {
  identity_already_exists:
    'That GitHub account is already connected to another PIP-Hall account. Sign in with the Google account that owns it, or connect a different GitHub account.',
  identity_already_exists_for_user: 'That GitHub account is already connected to you. Nothing to do!',
  manual_linking_disabled: 'Connecting GitHub is switched off on the server right now. Ask the hall admin to enable manual linking.',
  access_denied: 'Sign-in was cancelled. Try again whenever you are ready.',
  bad_oauth_state: 'That sign-in link expired. Please start again.',
  bad_code_verifier: 'That sign-in link was opened in a different browser. Please start again here.',
  flow_state_expired: 'That sign-in took too long and expired. Please start again.',
  flow_state_not_found: 'That sign-in link expired. Please start again.',
  provider_disabled: 'This sign-in option is switched off on the server.',
  not_configured: 'Sign-in isn’t set up on this copy of PIP-Hall yet.',
};

export function describeAuthError(code: string | null | undefined, fallback?: string | null): AuthProblem {
  const key = (code ?? '').trim();
  if (key && MESSAGES[key]) return { code: key, message: MESSAGES[key] };
  return { code: key || 'unknown', message: fallback?.trim() || 'Something went wrong while signing in. Please try again.' };
}

/** Reads an OAuth error that Supabase put in the callback URL's query or hash. */
export function authErrorFromUrl(href: string): AuthProblem | null {
  const u = new URL(href);
  const params = new URLSearchParams(u.search);
  const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
  const get = (k: string) => params.get(k) ?? hash.get(k);
  const error = get('error');
  const code = get('error_code');
  if (!error && !code) return null;
  return describeAuthError(code ?? error, get('error_description'));
}

/** Only same-site paths are allowed as a post-sign-in destination (no open redirects). */
export function safeNext(next: string | null | undefined, fallback = '/edit'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
