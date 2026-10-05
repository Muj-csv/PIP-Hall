import { describe, expect, it } from 'vitest';
import { isIOS } from './install';

describe('isIOS', () => {
  it('spots iPhones and iPads, including iPadOS posing as a Mac', () => {
    expect(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5)).toBe(true);
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
  });
  it('leaves desktop Macs and Android alone', () => {
    expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIOS('Mozilla/5.0 (Linux; Android 15; Pixel 7)', 5)).toBe(false);
  });
});
