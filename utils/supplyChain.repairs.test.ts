import { afterEach, describe, expect, it } from 'vitest';
import { createFreshState } from '../context/GameContext';
import { RESOURCE_MAP, RESOURCE_CATEGORIES } from '../data/resourceData';
import { buildAvailabilityContext, calculateSupplyChain, calculateEngineItemProgress, computeFullBreakdown, flattenMultiBreakdown, flattenRawMaterials, isItemAvailableWithCtx } from './supplyChain';

const fresh = () => { const state = createFreshState(); state.gameModeId = 'vanilla'; return state; };
const fixtureNames: string[] = [];
const fixture = (name: string, sources: typeof RESOURCE_MAP[string]) => { fixtureNames.push(name); RESOURCE_MAP[name] = sources; return name; };
afterEach(() => { for (const name of fixtureNames.splice(0)) delete RESOURCE_MAP[name]; });
const route = (item: string, source: string, state = fresh(), owned: Record<string, number> = {}) => calculateSupplyChain(item, state, owned)!.sources.find(entry => entry.source.name === source)!;
const raw = (item: string, quantity: number) => Object.fromEntries(flattenRawMaterials(computeFullBreakdown(item, quantity)).map(row => [row.item, row.qty]));

describe('resource availability repairs', () => {
  it('applies the unlocked skill cap even with a recorded level of 99', () => {
    const name = fixture('__tier_fixture', [{ type: 'SKILL', name: 'Smithing', regions: ['Any'], skills: { Smithing: 99 } }]);
    const state = fresh(); state.unlocks.skills.Smithing = 1; state.unlocks.levels.Smithing = 99;
    expect(route(name, 'Smithing', state).status.missing).toContain('Smithing 10/99');
    state.unlocks.skills.Smithing = 10;
    expect(route(name, 'Smithing', state).status.isAvailable).toBe(true);
  });

  it('requires obtainable ingredients and keeps goals below 100%', () => {
    const state = fresh(); state.unlocks.skills.Smithing = 10; state.unlocks.levels.Smithing = 99;
    expect(route('Rune Platebody', 'Anvil', state).status.isAvailable).toBe(false);
    expect(calculateEngineItemProgress('Rune Platebody', state)!.percentage).toBeLessThan(100);
    expect(calculateSupplyChain('Armadyl Godsword', state)!.sources.every(row => !row.status.isAvailable)).toBe(true);
  });

  it('allows explicitly owned ingredients, preserves reusable tools, and checks the selected amount', () => {
    const name = fixture('__owned_fixture', [{ type: 'SKILL', name: 'Craft', regions: ['Any'], inputs: { '__scarce': 2, '__tool': 0 } }]);
    expect(route(name, 'Craft', fresh(), { __scarce: 2, __tool: 1 }).status.isAvailable).toBe(true);
    expect(calculateSupplyChain(name, fresh(), { __scarce: 2, __tool: 1 }, 2)!.sources[0].status.isAvailable).toBe(false);
    expect(route(name, 'Craft', fresh(), { __scarce: 2 }).status.missing).toContain('Ingredient: __tool');
  });

  it('does not spend the same owned ingredient twice through two recipe branches', () => {
    fixture('__branch_a', [{ type: 'SKILL', name: 'A', regions: ['Any'], inputs: { '__scarce': 1 } }]);
    fixture('__branch_b', [{ type: 'SKILL', name: 'B', regions: ['Any'], inputs: { '__scarce': 1 } }]);
    const name = fixture('__root', [{ type: 'SKILL', name: 'Root', regions: ['Any'], inputs: { '__branch_a': 1, '__branch_b': 1 } }]);
    expect(route(name, 'Root', fresh(), { __scarce: 1 }).status.isAvailable).toBe(false);
    expect(route(name, 'Root', fresh(), { __scarce: 2 }).status.isAvailable).toBe(true);
  });

  it('combines an owned bronze bar with one craftable bar for a two-bar helmet', () => {
    const state = fresh(); state.unlocks.skills.Smithing = 1; state.unlocks.levels.Smithing = 7;
    const owned = { 'Bronze Bar': 1, 'Copper Ore': 1, 'Tin Ore': 1 };
    expect(route('Bronze Full Helm', 'Anvil', state, owned).status.isAvailable).toBe(true);
    expect(route('Bronze Full Helm', 'Anvil', state, { ...owned, 'Tin Ore': 0 }).status.isAvailable).toBe(false);
    expect(owned).toEqual({ 'Bronze Bar': 1, 'Copper Ore': 1, 'Tin Ore': 1 });
  });

  it('uses an owned intermediate before spending materials needed by sibling inputs', () => {
    const name = fixture('__bar_and_ores', [{ type: 'SKILL', name: 'Combine', regions: ['Any'], inputs: { 'Bronze Bar': 1, 'Copper Ore': 1, 'Tin Ore': 1 } }]);
    const state = fresh(); state.unlocks.skills.Smithing = 1; state.unlocks.levels.Smithing = 7;
    expect(route(name, 'Combine', state, { 'Bronze Bar': 1, 'Copper Ore': 1, 'Tin Ore': 1 }).status.isAvailable).toBe(true);
    expect(route(name, 'Combine', state, { 'Copper Ore': 1, 'Tin Ore': 1 }).status.isAvailable).toBe(false);
  });

  it('rolls back reserved stock and consumed inputs when a source alternative fails', () => {
    fixture('__alternative', [
      { type: 'SKILL', name: 'Unavailable first route', regions: ['Any'], inputs: { '__scarce': 1, '__missing': 1 } },
      { type: 'SKILL', name: 'Second route', regions: ['Any'], inputs: { '__scarce': 1 } },
    ]);
    const name = fixture('__alternative_root', [{ type: 'SKILL', name: 'Combine', regions: ['Any'], inputs: { '__alternative': 2, '__scarce': 1 } }]);
    expect(route(name, 'Combine', fresh(), { '__alternative': 1, '__scarce': 2 }).status.isAvailable).toBe(true);
    expect(route(name, 'Combine', fresh(), { '__alternative': 1, '__scarce': 1 }).status.isAvailable).toBe(false);
  });

  it('terminates cycles but still discovers an independent supply route', () => {
    fixture('__cycle_a', [{ type: 'SKILL', name: 'A', regions: ['Any'], inputs: { '__cycle_b': 1 } }]);
    fixture('__cycle_b', [{ type: 'SKILL', name: 'B', regions: ['Any'], inputs: { '__cycle_a': 1 } }]);
    expect(isItemAvailableWithCtx('__cycle_a', buildAvailabilityContext(fresh()))).toBe(false);
    RESOURCE_MAP.__cycle_b.push({ type: 'SPAWN', name: 'Ground', regions: ['Any'] });
    expect(isItemAvailableWithCtx('__cycle_a', buildAvailabilityContext(fresh()))).toBe(true);
  });

  it('uses the shared shop category and gates tanner services regardless of source type', () => {
    const state = fresh(); state.unlocks.regions.push('Wilderness');
    expect(route('Nature Rune', 'Mage Arena Shop', state).status.missing).toContain('Merchant: Magic Shops');
    expect(route('Leather', 'Tanner', state).status.missing).toContain('Merchant: Tanners');
    state.unlocks.merchants.push('Tanners');
    expect(route('Leather', 'Tanner', state).status.isAvailable).toBe(true);
    const unknown = fixture('__unknown_shop', [{ type: 'SHOP', name: 'Unreviewed odd shop', regions: ['Any'] }]);
    expect(route(unknown, 'Unreviewed odd shop', state).status.missing).toContain('Shop category needs review');
  });

  it('keeps unknown enrichment closed and centralizes the spectre Slayer gate', () => {
    const state = fresh(); state.unlocks.regions.push('Morytania');
    for (const item of ['Kwuarm', 'Ranarr Weed']) expect(route(item, 'Aberrant Spectre', state).status.missing).toContain('Skill Locked: Slayer');
    const name = fixture('__unverified', [{ type: 'DROP', name: 'Unknown', regions: ['Any'], requirementsUnverified: true }]);
    expect(route(name, 'Unknown', state).status.isAvailable).toBe(false);
  });
});

describe('fact-checked resource and quantity repairs', () => {
  it('requires the raid for all 28 raid resources and labels them local to the raid', () => {
    const items = RESOURCE_CATEGORIES['Chambers of Xeric (raid only)'];
    expect(items).toHaveLength(28);
    for (const item of items) {
      const sources = RESOURCE_MAP[item].filter(source => !source.requirementsUnverified);
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) expect(source).toMatchObject({ unlockId: 'Chambers of Xeric', localOnly: 'Chambers of Xeric', regions: ['Kourend & Kebos'] });
    }
    const state = fresh(); state.unlocks.minigames.push('Mastering Mixology'); state.unlocks.regions.push('Varlamore', 'Morytania'); state.unlocks.skills.Herblore = 10; state.unlocks.levels.Herblore = 99;
    expect(calculateSupplyChain('Elder Potion', state)!.sources[0].status.missing).toContain('Unlock: Chambers of Xeric');
    state.unlocks.bosses.push('Chambers of Xeric'); state.unlocks.regions.push('Kourend & Kebos');
    state.unlocks.skills.Farming = 10; state.unlocks.levels.Farming = 99;
    expect(calculateSupplyChain('Elder Potion', state)!.sources[0].status.isAvailable).toBe(true);
  });

  it('retains real Mixology geography while allowing regular potion mixing anywhere with owned supplies', () => {
    expect(RESOURCE_MAP.Aldarium[0].regions).toEqual(['Varlamore']);
    expect(RESOURCE_MAP.Huasca[0].skills).toEqual({ Farming: 65, Herblore: 58 });
    const state = fresh(); state.unlocks.skills.Herblore = 6; state.unlocks.levels.Herblore = 58;
    expect(route('Prayer Regeneration Potion', 'Herblore', state, { Huasca: 1, Aldarium: 1, 'Vial of Water': 1 }).status.isAvailable).toBe(true);
  });

  it('removes the imaginary Barrows reward and requires MMII dungeon progress for combat monkeys', () => {
    expect(RESOURCE_MAP['Prayer Potion'].some(source => /Barrows/i.test(source.name))).toBe(false);
    const source = RESOURCE_MAP['Prayer Potion'].find(source => source.name === 'Maniacal Monkey')!;
    expect(source.regions).toEqual(['Islands & Others']);
    expect(source.manualRequirements?.join(' ')).toContain('chapter II of Monkey Madness II');
    expect(source.skills).toBeUndefined();
  });

  it('makes enough three-dose mixes for four four-dose stamina and super-combat bottles', () => {
    const stamina = raw('Stamina Potion', 4);
    expect(stamina.Avantoe).toBe(6); expect(stamina['Mort Myre Fungus']).toBe(6); expect(stamina['Amylase Crystal']).toBe(16);
    const combat = raw('Super Combat Potion', 4);
    expect(combat['Irit Leaf']).toBe(6); expect(combat.Kwuarm).toBe(6); expect(combat.Cadantine).toBe(6); expect(combat.Torstol).toBe(4);
    expect(raw('Divine Super Combat Potion', 4)['Crystal Shard']).toBe(2); // 16 dust, 10 per shard
    expect(RESOURCE_MAP['Divine Ranging Potion'][0].inputs?.['Crystal Dust']).toBe(3);
    expect(RESOURCE_MAP['Divine Super Combat Potion'][0].inputs?.['Crystal Dust']).toBe(4);
  });

  it('uses actual zenyte, gloves and sinew recipes', () => {
    expect(RESOURCE_MAP['Ferocious Gloves'][0]).toMatchObject({ regions: ['Islands & Others'], inputs: { 'Hydra Leather': 1, Hammer: 0 } });
    expect(raw('Ferocious Gloves', 1)['Barrows Gloves']).toBeUndefined();
    expect(RESOURCE_MAP['Uncut Zenyte'][0]).toMatchObject({ skills: { Crafting: 70 }, inputs: { 'Zenyte Shard': 1, Onyx: 1 }, regions: ['Islands & Others'] });
    expect(RESOURCE_MAP.Sinew[0].inputs).toEqual({ 'Raw Beef': 1 });
    expect(raw('Sinew', 2)).toEqual({ 'Raw Beef': 2 });
  });

  it('replaces fictional olive, lily and rogue-purse routes', () => {
    expect(RESOURCE_MAP.Olive).toBeUndefined();
    expect(RESOURCE_MAP['Olive Oil'].filter(source => !source.requirementsUnverified).every(source => source.type === 'SHOP' && !source.inputs)).toBe(true);
    expect(RESOURCE_MAP['Lily of the Sands'][0].unlockId).toBe('Tombs of Amascut');
    expect(RESOURCE_MAP["Rogue's Purse"][0]).toMatchObject({ regions: ['Karamja'], skills: { Herblore: 3 } });
  });

  it('retains raw targets in single and mixed plans', () => {
    expect(flattenMultiBreakdown({ 'Ranarr Weed': 10, 'Dragon Bones': 20 })).toEqual([{ item: 'Dragon Bones', qty: 20 }, { item: 'Ranarr Weed', qty: 10 }]);
    const mixed = flattenMultiBreakdown({ 'Ranarr Weed': 10, 'Prayer Potion': 2 });
    expect(mixed.find(row => row.item === 'Ranarr Weed')?.qty).toBe(12);
  });
});
