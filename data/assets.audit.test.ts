import { describe, expect, it } from 'vitest';
import { UTILITY_ITEM_IDS } from './assets';

// Item ids from the OSRS Wiki item infoboxes (fetched 24 Nov 2026). Each boss
// icon is one of that boss's own drops, never an unrelated item.
describe('reviewed boss icon item ids', () => {
  it('shows a Tormented synapse (id 29580) for Tormented Demons, not the Completed note (29883)', () => {
    expect(UTILITY_ITEM_IDS['Tormented Demons']).toBe(29580);
  });
});
