import { describe, expect, it } from 'vitest';
import { authErrorFromUrl, describeAuthError, safeNext } from './authErrors';

describe('describeAuthError', () => {
  it('explains a GitHub account that is linked elsewhere (ARCHITECTURE §6)', () => {
    const p = describeAuthError('identity_already_exists');
    expect(p.code).toBe('identity_already_exists');
    expect(p.message).toMatch(/already connected to another PIP-Hall account/);
    expect(p.message).toMatch(/Sign in with the Google account that owns it/);
  });
  it('treats a closed Google window as a cancel, not a failure', () => {
    expect(describeAuthError('access_denied').message).toMatch(/cancelled/);
  });
  it('falls back to the provider’s description, then to a generic line', () => {
    expect(describeAuthError('weird_code', 'Provider said no').message).toBe('Provider said no');
    expect(describeAuthError(null).message).toMatch(/Something went wrong/);
  });
});

describe('authErrorFromUrl', () => {
  it('reads errors from the query (PKCE)', () => {
    const p = authErrorFromUrl('https://x.test/auth/callback?error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked');
    expect(p?.code).toBe('identity_already_exists');
  });
  it('reads errors from the hash (implicit flow)', () => {
    expect(authErrorFromUrl('https://x.test/auth/callback#error=access_denied&error_description=denied')?.code).toBe('access_denied');
  });
  it('is null on a clean callback', () => {
    expect(authErrorFromUrl('https://x.test/auth/callback?code=abc&next=%2Fedit')).toBeNull();
  });
});

describe('safeNext', () => {
  it('allows same-site paths', () => {
    expect(safeNext('/admin')).toBe('/admin');
    expect(safeNext('/edit?tab=links')).toBe('/edit?tab=links');
  });
  it('blocks open redirects', () => {
    for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:alert(1)', '', null, undefined]) {
      expect(safeNext(bad)).toBe('/edit');
    }
  });
});
