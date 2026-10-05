import { describe, expect, it } from 'vitest';
import { switchOn } from './features';

describe('switchOn', () => {
  it('accepts "on" however it was typed', () => {
    for (const v of ['on', 'ON', ' on', 'on\n', 'On \r\n']) expect(switchOn(v)).toBe(true);
  });
  it('treats anything else as off', () => {
    for (const v of [undefined, '', 'off', 'true', '1', 'onn', 'o n']) expect(switchOn(v)).toBe(false);
  });
});
