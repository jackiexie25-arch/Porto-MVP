import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONTEXTS, placeLine, readContext, saveContext } from './place';

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('place', () => {
  it('remembers the chosen place for this tab, and forgets it when cleared', () => {
    saveContext('school');
    expect(readContext()).toBe('school');
    saveContext(null);
    expect(readContext()).toBeNull();
  });

  it('ignores anything stored that isn’t one of the worker’s places', () => {
    sessionStorage.setItem('porto.context', 'transport');
    expect(readContext()).toBeNull();
    expect(CONTEXTS).not.toContain('transport');
  });

  it('still works when the browser won’t store anything', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => saveContext('camp')).not.toThrow();
    expect(readContext()).toBeNull();
  });

  it('reads the place as the start of a line', () => {
    expect(placeLine('school')).toBe('At school');
    expect(placeLine('community')).toBe('Out and about');
    expect(placeLine('mealtime')).toBe('At mealtimes');
  });
});
