import { describe, expect, it } from 'vitest';
import { countOf, isValidCount, nextCount, totalActions, withCount } from './counts';

describe('counts', () => {
  it('treats a missing action as never done', () => {
    expect(countOf({}, 'x')).toBe(0);
  });

  it('never goes below zero', () => {
    expect(nextCount(0, -1)).toBe(0);
    expect(nextCount(2, -1)).toBe(1);
    expect(nextCount(2, 1)).toBe(3);
  });

  it('replaces a count without mutating the original', () => {
    const original = { a: 1 };
    expect(withCount(original, 'a', 2)).toEqual({ a: 2 });
    expect(original).toEqual({ a: 1 });
  });

  it('sums every repetition of every action', () => {
    expect(totalActions({ a: 2, b: 3, c: 0 })).toBe(5);
  });

  it('accepts only non-negative integers', () => {
    expect(isValidCount(0)).toBe(true);
    expect(isValidCount(-1)).toBe(false);
    expect(isValidCount(1.5)).toBe(false);
  });
});
