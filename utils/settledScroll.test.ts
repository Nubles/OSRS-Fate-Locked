// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTLE_FALLBACK_MS, scrollIntoViewSettled } from './settledScroll';

// Two frames, then the realign; two more, then the last one.
const FRAME = 16;
const settleFrames = () => vi.advanceTimersByTime(FRAME * 4);

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), FRAME));
});

const card = () => {
  const el = document.createElement('div');
  el.scrollIntoView = vi.fn();
  document.body.appendChild(el);
  return el;
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('scrollIntoViewSettled', () => {
  it('realigns once its scroll ends, then leaves later scrolling alone', () => {
    const el = card();
    scrollIntoViewSettled(el, { block: 'start', behavior: 'smooth' });
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    // Another scroller finishing doesn't count.
    const other = document.createElement('div');
    document.body.appendChild(other);
    other.dispatchEvent(new Event('scrollend'));
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    // Its own scroll container finishing does (the event doesn't bubble),
    // once the cards around it have had two frames to draw.
    el.parentElement!.dispatchEvent(new Event('scrollend'));
    vi.advanceTimersByTime(FRAME);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(FRAME);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(2);
    expect(el.scrollIntoView).toHaveBeenLastCalledWith({ block: 'start', behavior: 'instant' });
    vi.advanceTimersByTime(FRAME * 2);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(3);
    // Later scrolls by the player, and the fallback timer, leave it alone.
    document.dispatchEvent(new Event('scrollend'));
    vi.advanceTimersByTime(SETTLE_FALLBACK_MS);
    settleFrames();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(3);
  });

  it('falls back to a timer when no scrollend arrives', () => {
    const el = card();
    scrollIntoViewSettled(el, { block: 'center' });
    vi.advanceTimersByTime(SETTLE_FALLBACK_MS - 1);
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    settleFrames();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(3);
  });

  it('skips the second scroll when the card has left the page', () => {
    const el = card();
    scrollIntoViewSettled(el, { block: 'start' });
    el.remove();
    vi.advanceTimersByTime(SETTLE_FALLBACK_MS);
    settleFrames();
    expect(el.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
