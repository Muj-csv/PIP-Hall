import { describe, expect, it } from 'vitest';
import { martErrorMessage, martNotSetUp } from './martService';

describe('martNotSetUp', () => {
  it('spots a database without the Mart', () => {
    expect(martNotSetUp({ code: 'PGRST202', message: 'Could not find the function public.my_mart without parameters in the schema cache' })).toBe(true);
    expect(martNotSetUp({ code: '42P01', message: 'relation "public.pip_ledger" does not exist' })).toBe(true);
  });
  it('leaves network and permission errors alone', () => {
    expect(martNotSetUp({ message: 'Failed to fetch' })).toBe(false);
    expect(martNotSetUp({ code: '42501', message: 'permission denied for function my_mart' })).toBe(false);
    expect(martNotSetUp(null)).toBe(false);
  });
});

describe('martErrorMessage', () => {
  it('says what a refusal means', () => {
    expect(martErrorMessage({ message: 'NOT_ENOUGH_PIPS' })).toMatch(/Not enough PIPs/);
    expect(martErrorMessage({ message: 'ALREADY_OWNED' })).toBe('You already own that.');
  });
});
