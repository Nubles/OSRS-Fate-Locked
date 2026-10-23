import { describe, expect, it, vi } from 'vitest';
import { memoizeLast } from './memoizeLast';

describe('memoizeLast', () => {
  it('reuses the last result while every argument is the same value', () => {
    const fn = vi.fn((state: { n: number }, mode?: string) => `${state.n}:${mode}`);
    const memo = memoizeLast(fn);
    const state = { n: 1 };
    expect(memo(state, 'vanilla')).toBe('1:vanilla');
    expect(memo(state, 'vanilla')).toBe('1:vanilla');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('works it out again when any argument changes identity, even to equal contents', () => {
    const fn = vi.fn((state: { n: number }, mode?: string) => ({ n: state.n, mode }));
    const memo = memoizeLast(fn);
    const first = memo({ n: 1 }, 'vanilla');
    const second = memo({ n: 1 }, 'vanilla');
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    const state = { n: 2 };
    memo(state, 'vanilla');
    memo(state, 'chunked');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('keeps only the last call', () => {
    const fn = vi.fn((value: object) => value);
    const memo = memoizeLast(fn);
    const a = {};
    const b = {};
    memo(a);
    memo(b);
    memo(a);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('tells a missing argument from an undefined one by count, and NaN equals NaN', () => {
    const fn = vi.fn((...args: unknown[]) => args.length);
    const memo = memoizeLast(fn);
    memo(1);
    memo(1, undefined);
    expect(fn).toHaveBeenCalledTimes(2);
    memo(Number.NaN);
    memo(Number.NaN);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
