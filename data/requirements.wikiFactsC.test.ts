import { describe, expect, it } from 'vitest';
import { STRATEGY_DATABASE } from './requirements';
import { TableType } from '../types';
import { analyzeRequirement } from '../utils/strategyRequirement';
import { calculateGoalProgress } from '../utils/goalLogic';
import { buildGoalRoute } from '../utils/goalRoute';
import { createFreshState } from '../context/GameContext';
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
    expect(S['Gnome Glider Clothing'].description).toMatch(/Daerkin|Ninto/);
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

describe("Warriors' Guild entries use the guild's real rule (Wiki: 130 combined, or 99 in either)", () => {
  const GUILD_ENTRIES = ["Warriors' Guild (Cyclopes)", 'Rune Defender', 'Warrior Guild Potions', 'Warrior Guild Food'];
  const RULE = '99 Attack or Strength, or 130 combined';
  const at = (attack: number, strength: number) => {
    const u = createFreshState().unlocks;
    u.regions = [...items.REGIONS_LIST];
    u.skills = Object.fromEntries(items.SKILLS_LIST.map(s => [s, 10]));
    u.levels = { ...Object.fromEntries(items.SKILLS_LIST.map(s => [s, 99])), Attack: attack, Strength: strength };
    u.merchants = [...items.MERCHANTS_LIST];
    u.guilds = [...items.GUILDS_LIST];
    u.minigames = [...items.MINIGAMES_LIST];
    return u;
  };

  it.each([[70, 60, true], [99, 1, true], [1, 99, true], [64, 65, false]])(
    'Attack %i and Strength %i: ready %s, on the card and the pinned goal alike',
    (attack, strength, ready) => {
      for (const key of GUILD_ENTRIES) {
        const req = S[key];
        expect(req.skills, key).toEqual({});
        const card = analyzeRequirement(req, at(attack, strength), 'vanilla');
        const goal = calculateGoalProgress(req, at(attack, strength), 'vanilla');
        expect(card.isFullyPlayable, key).toBe(ready);
        expect(card.missingChecks.includes(RULE), key).toBe(!ready);
        expect(goal.percentage === 100, key).toBe(ready);
        expect(goal.missing.includes(RULE), key).toBe(!ready);
      }
    },
  );

  it('shows the rule as a step in the goal route', () => {
    const state = createFreshState();
    state.unlocks = at(64, 65);
    const route = buildGoalRoute('Warrior Guild Potions', state)!;
    expect(route.skills).toEqual([]);
    expect(route.alternatives).toEqual([expect.objectContaining({ name: RULE, met: false })]);
    state.unlocks = at(70, 60);
    expect(buildGoalRoute('Warrior Guild Potions', state)!.alternatives)
      .toEqual([expect.objectContaining({ name: RULE, met: true })]);
  });
});
