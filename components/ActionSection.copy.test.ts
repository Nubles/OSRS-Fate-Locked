import { describe, expect, it } from 'vitest';
import {
  VANILLA_BOSS_SEARCH_PLACEHOLDER,
  vanillaBossSearchEmptyMessage,
} from './vanillaBossSearchCopy';

describe('Vanilla boss search copy', () => {
  it('uses ASCII search and empty-state copy without mojibake markers', () => {
    const emptyState = vanillaBossSearchEmptyMessage('Brutus');

    expect(VANILLA_BOSS_SEARCH_PLACEHOLDER).toBe('Search bosses...');
    expect(emptyState).toBe('No bosses match "Brutus".');
    expect(`${VANILLA_BOSS_SEARCH_PLACEHOLDER} ${emptyState}`).not.toContain('Ã');
  });
});