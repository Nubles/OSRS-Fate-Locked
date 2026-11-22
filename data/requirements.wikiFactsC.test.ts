import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { TableType } from '../types';
import * as items from './items';

const S = STRATEGY_DATABASE;

describe('Strategy Guide entries for things that are not shops', () => {
  it('drops the Sandwich Lady, a random event (Wiki: Sandwich lady, location Random)', () => {
    expect(S['Sandwich Lady']).toBeUndefined();
  });

  it('sends Gnome Glider Clothing to the Gnome Restaurant (Wiki: Gnome goggles, Gnome scarf)', () => {
    expect(S['Gnome Glider Clothing']).toMatchObject({
      id: 'Gnome Restaurant', category: TableType.MINIGAMES, regions: ['Tree Gnome Stronghold'], skills: { Cooking: 29 },
    });
    expect(S['Gnome Glider Clothing'].description).toMatch(/Gnome Restaurant/);
    expect(S['Gnome Glider Clothing'].description).toMatch(/1\/17/);
  });

  it('were guide entries only, in no list a Key rolls on', () => {
    for (const list of Object.values(items).filter(Array.isArray)) {
      expect(list).not.toContain('Sandwich Lady');
      expect(list).not.toContain('Gnome Glider Clothing');
    }
  });

  it('a save that pinned the removed Sandwich Lady keeps the id and shows no card', async () => {
    const { goalNeedsResourceEngine } = await import('../components/GoalTracker');
    expect(goalNeedsResourceEngine('Sandwich Lady')).toBe(true);
    expect(goalNeedsResourceEngine('Gnome Glider Clothing')).toBe(false);
  });
});
