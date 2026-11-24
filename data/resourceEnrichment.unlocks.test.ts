import { describe, expect, it } from 'vitest';
import { ENRICHED_SOURCES } from './resourceEnrichment';
import { BOSSES_LIST, MINIGAMES_LIST } from './items';
import { resourceUnlockDependency } from './resourceData';
import { makeUnlockResolver } from '../scripts/sourceEnrichmentRules';

// The generated Wiki rows once tagged the Theatre of Blood's Monumental chest
// as Tombs of Amascut and Wintertodt's extra supply crate as Pest Control
// (scripts/sourceEnrichmentRules.ts maps them now). This fails until
// data/resourceEnrichment.ts is regenerated with the fixed script.
const rows = (name: string) => Object.values(ENRICHED_SOURCES).flat().filter(s => s.name === name);

describe('generated Wiki rows unlock the right activity', () => {
  it.each([
    ['Monumental Chest', 'Theatre of Blood'],
    ['Extra Supply Crate', 'Wintertodt'],
  ])('%s rows unlock with %s', (name, unlockId) => {
    expect(rows(name).length).toBeGreaterThan(0);
    for (const row of rows(name)) expect(row.unlockId).toBe(unlockId);
  });
});

// Fixed in scripts/buildSourceEnrichment.ts and its rules module (each rule
// has a unit test in scripts/sourceEnrichmentRules.test.ts); these check the
// regenerated rows.
const item = (key: string) => ENRICHED_SOURCES[key] ?? [];
const all = Object.values(ENRICHED_SOURCES).flat();

describe('generated Wiki rows', () => {
  it('reward rows name the activity they come from', () => {
    // Every row whose name resolves to an activity carries it, as long as the
    // app can gate that activity (RESOURCE_UNLOCK_TABLES); the generator
    // warns about and leaves out the rest.
    const resolve = makeUnlockResolver([...BOSSES_LIST, ...MINIGAMES_LIST]);
    for (const s of all.filter((x) => x.type === 'DROP')) {
      const activity = resolve(s.name);
      if (!activity) continue;
      expect(s.unlockId, s.name).toBe(resourceUnlockDependency({ unlockId: activity }) ? activity : undefined);
    }
    for (const name of ['Reward Pool', 'Casket (Reward Pool)', 'Reward Token']) {
      expect(all.some((s) => s.name === name && s.type === 'DROP'), name).toBe(true);
    }
    expect(all.some((s) => /^(bronze|steel|black|silver|gold) chest \(/i.test(s.name))).toBe(true);
  });

  it('gates the rows of the newer bosses and of two more minigames on their unlock', () => {
    // RESOURCE_UNLOCK_TABLES types these six; without an entry the generator
    // leaves an activity's rows open to a run that never unlocked it.
    for (const id of ['Amoxliatl', 'Doom of Mokhaiotl', 'Gemstone Crab', 'Yama', 'Mahogany Homes', "Shades of Mort'ton"]) {
      expect(resourceUnlockDependency({ unlockId: id }), id).not.toBeNull();
      expect(all.some((s) => s.type === 'DROP' && s.unlockId === id), id).toBe(true);
    }
  });

  it('only Treasure Trail caskets are clue rows, and no one-time quest casket is listed', () => {
    for (const s of all.filter((x) => x.type === 'CLUE')) expect(s.name).toMatch(/^(Reward Casket|Clue Scroll)/);
    expect(all.some((s) => /pirate's treasure/i.test(s.name))).toBe(false);
  });

  it('keeps the main shops of an item renamed on the Wiki', () => {
    // Wiki 'Steel shortsword': "It can be purchased from the Varrock Swordshop".
    expect(item('Steel Shortsword').some((s) => s.type === 'SHOP' && s.name === 'Varrock Swordshop')).toBe(true);
  });

  it('lists the common drop sources ahead of rare ones', () => {
    // Wiki 'Limpwurt root': Hobgoblin 21/128 and 22/128.
    expect(item('Limpwurt Root').some((s) => s.type === 'DROP' && s.name === 'Hobgoblin')).toBe(true);
    // Wiki 'Tree spirit': steel axe 10/128, a combat drop.
    expect(item('Steel Axe').some((s) => s.type === 'DROP' && s.name === 'Tree Spirit')).toBe(true);
  });

  it("keeps point-based activity rewards (Wiki rarity 'Varies')", () => {
    // Wiki 'Coal' and 'Magic logs': Wintertodt's Reward Cart; Wiki 'Raw shark': Fishing Trawler.
    const wintertodt = (key: string) => item(key).some((s) => s.type === 'DROP' && s.unlockId === 'Wintertodt');
    expect(wintertodt('Coal')).toBe(true);
    expect(wintertodt('Magic Logs')).toBe(true);
    expect(item('Raw Shark').some((s) => s.type === 'DROP' && s.name === 'Fishing Trawler')).toBe(true);
  });

  it('lists at most one row per activity for an item', () => {
    for (const [key, rows] of Object.entries(ENRICHED_SOURCES)) {
      const ids = rows.filter((s) => s.type !== 'SHOP' && s.unlockId).map((s) => s.unlockId);
      expect(new Set(ids).size, key).toBe(ids.length);
    }
  });

  it('places shops by their Wiki location', () => {
    // Wiki infobox_shop: Armour Store at the Blast Furnace in Keldagrim,
    // Scavvo's in the Champions' Guild, Mistrock Mining Supplies in Varlamore.
    const region = (name: string) => [...new Set(all.filter((s) => s.type === 'SHOP' && s.name === name).map((s) => s.regions.join()))];
    expect(region('Armour Store')).toEqual(['Fremennik']);
    expect(region("Scavvo's Rune Store")).toEqual(['Misthalin']);
    for (const r of region('Mistrock Mining Supplies')) expect(r).toBe('Varlamore');
    // Wiki infobox_shop: Gulluck and Sons in the Grand Tree, Oziach (shop) in
    // Edgeville, Leenz's General Supplies in Port Piscarilius.
    expect(region('Gulluck and Sons')).toEqual(['Kandarin']);
    expect(region('Oziach')).toEqual(['Misthalin']);
    expect(region("Leenz's General Supplies")).toEqual(['Kourend & Kebos']);
  });
});
