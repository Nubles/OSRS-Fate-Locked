import { describe, expect, it } from 'vitest';
import { screenForJump } from './osrsNav';

describe('screenForJump', () => {
  const at = (screen: 'home' | 'keys' | 'journal', progressionWide = false) => ({ screen, progressionWide });

  it('brings the home screen into view for Progression tabs, its modals and route planning', () => {
    expect(screenForJump('tab:WORLD', at('journal'))).toBe('home');
    expect(screenForJump('open:goal', at('keys'))).toBe('home');
    expect(screenForJump('plan-goal', at('journal'))).toBe('home');
  });

  it('stays put when the home screen already shows', () => {
    expect(screenForJump('tab:WORLD', at('home'))).toBeNull();
    expect(screenForJump('open:share', at('home', true))).toBeNull();
  });

  it('sends Keys panel jumps to wherever the Keys panel is visible', () => {
    expect(screenForJump('ctrl:SPEND', at('home'))).toBeNull();
    expect(screenForJump('ctrl:SPEND', at('keys'))).toBeNull();
    expect(screenForJump('ctrl:SPEND', at('home', true))).toBe('keys');
    expect(screenForJump('ctrl:FARM', at('journal'))).toBe('keys');
  });

  it('ignores anything else', () => {
    expect(screenForJump('', at('journal'))).toBeNull();
    expect(screenForJump('chunk', at('keys'))).toBeNull();
  });
});
