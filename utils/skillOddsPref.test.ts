// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SKILL_ODDS_HOVER_KEY, readSkillOddsHover, setSkillOddsHover } from './skillOddsPref';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('skill odds preference', () => {
  it('defaults to the info button', () => {
    expect(readSkillOddsHover()).toBe(false);
  });

  it('keeps the choice in localStorage and tells listeners', () => {
    const heard = vi.fn();
    window.addEventListener('fate:skill-odds-pref', heard);
    setSkillOddsHover(true);
    expect(localStorage.getItem(SKILL_ODDS_HOVER_KEY)).toBe('on');
    expect(readSkillOddsHover()).toBe(true);
    setSkillOddsHover(false);
    expect(readSkillOddsHover()).toBe(false);
    expect(heard).toHaveBeenCalledTimes(2);
    window.removeEventListener('fate:skill-odds-pref', heard);
  });

  it('lasts the page when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    setSkillOddsHover(true);
    expect(readSkillOddsHover()).toBe(true);
    setSkillOddsHover(false);
    expect(readSkillOddsHover()).toBe(false);
  });
});
