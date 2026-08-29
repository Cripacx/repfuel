import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from './debounce.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('debounce', () => {
  it('only calls the wrapped function once after the delay, with the latest arguments', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    debounced('b');
    debounced('c');
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
  });

  it('cancel() prevents a pending call from firing', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('a');
    debounced.cancel();
    vi.advanceTimersByTime(1000);

    expect(fn).not.toHaveBeenCalled();
  });

  it('allows independent calls once the delay has elapsed', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced('a');
    vi.advanceTimersByTime(100);
    debounced('b');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
  });
});
