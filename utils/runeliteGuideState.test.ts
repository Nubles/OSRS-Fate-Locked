import { describe, expect, it } from 'vitest';
import {
  hasRuneliteGuideQuery,
  removeRuneliteGuideQuery,
} from './runeliteGuideState';

describe('RuneLite guide query state', () => {
  it('matches only the exact guide request', () => {
    expect(hasRuneliteGuideQuery('?open=runelite-guide')).toBe(true);
    expect(hasRuneliteGuideQuery('?open=other')).toBe(false);
    expect(hasRuneliteGuideQuery('?open=runelite-guide-extra')).toBe(false);
  });

  it('removes only the guide parameter and preserves the rest', () => {
    expect(removeRuneliteGuideQuery('?open=runelite-guide&foo=bar')).toBe('?foo=bar');
    expect(removeRuneliteGuideQuery('?open=runelite-guide')).toBe('');
    expect(removeRuneliteGuideQuery('?foo=bar&open=other')).toBe('?foo=bar&open=other');
  });
});
