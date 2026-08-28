import { afterEach, describe, expect, it, vi } from 'vitest';
import { DUR_EXIT, DUR_OVERLAY, arrive, prefersReducedMotion, riseFromBottom, sheet } from './motion.js';

function mockMatchMedia(matches: (query: string) => boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: matches(query) }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  it('follows the media query', () => {
    mockMatchMedia((q) => q.includes('reduced-motion'));
    expect(prefersReducedMotion()).toBe(true);
    mockMatchMedia(() => false);
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('sheet', () => {
  it('rises from the bottom on narrow viewports', () => {
    mockMatchMedia((q) => q.includes('max-width'));
    const css = sheet(document.createElement('div')).css!;
    expect(css(0, 1)).toContain('translateY(100%)');
    expect(css(1, 0)).toContain('translateY(0%)');
  });

  it('scales from its centre on wide viewports', () => {
    mockMatchMedia(() => false);
    const css = sheet(document.createElement('div')).css!;
    expect(css(0, 1)).toContain('scale(0.96)');
    expect(css(1, 0)).toContain('scale(1)');
  });

  it('drops spatial movement under reduced motion but keeps the fade', () => {
    mockMatchMedia((q) => q.includes('reduced-motion'));
    const css = sheet(document.createElement('div')).css!;
    expect(css(0.5, 0.5)).toBe('opacity: 0.5');
    expect(css(0.5, 0.5)).not.toContain('transform');
  });
});

describe('riseFromBottom / arrive', () => {
  it('move along their own axis and fade under reduced motion', () => {
    mockMatchMedia(() => false);
    expect(riseFromBottom(document.createElement('div')).css!(0, 1)).toContain('translateY(100%)');
    expect(arrive(document.createElement('div')).css!(0, 1)).toContain('translateY(-8px)');

    mockMatchMedia((q) => q.includes('reduced-motion'));
    expect(arrive(document.createElement('div')).css!(1, 0)).toBe('opacity: 1');
  });
});

describe('durations', () => {
  it('exits faster than overlays enter', () => {
    expect(DUR_EXIT).toBeLessThan(DUR_OVERLAY);
  });
});
