// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EQUIPMENT_CATALOGUE } from './equipmentCatalogue';
import { EQUIPMENT_REVIEW } from './equipmentReview';
import { requirementTier, reviewedTier } from '../utils/equipmentReviewTiers';

const catalogue = JSON.parse(readFileSync(new URL(`../public/${EQUIPMENT_CATALOGUE.asset}`, import.meta.url), 'utf8'));

async function loadedService() {
  vi.resetModules();
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => structuredClone(catalogue) }));
  const { gearService } = await import('../services/GearService');
  await gearService.init(true);
  return gearService;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const SLOTS = ['Head', 'Cape', 'Neck', 'Ammo', 'Weapon', 'Body', 'Shield', 'Legs', 'Gloves', 'Boots', 'Ring'];
const tierOf = (name: string, slot: string, category?: string) =>
  reviewedTier({ name, slot, category }, EQUIPMENT_REVIEW);

describe('reviewed equipment placements', () => {
  it('leaves no stat-based estimate in the pinned catalogue picker', async () => {
    const service = await loadedService();
    const estimated = SLOTS.flatMap(slot => service.bySlot(slot))
      .filter(item => service.isEstimated(item.id))
      .map(item => `${item.slot}: ${item.name}`);
    // A catalogue update that adds gear fails here: give each new name a
    // wield level or a placement in data/equipmentReview.ts.
    expect(estimated).toEqual([]);
  }, 20_000);

  it('places gear with the Codex material that needs the same wield level', () => {
    expect(requirementTier({ attack: 1 }, 'Weapon')).toBe(1);
    expect(requirementTier({ attack: 20 }, 'Weapon')).toBe(3); // mithril
    expect(requirementTier({ attack: 40 }, 'Weapon')).toBe(5); // rune
    expect(requirementTier({ attack: 50, strength: 50 }, 'Weapon')).toBe(5);
    expect(requirementTier({ attack: 60 }, 'Weapon')).toBe(6); // dragon
    expect(requirementTier({ attack: 70 }, 'Weapon')).toBe(7); // Barrows
    expect(requirementTier({ attack: 80 }, 'Weapon')).toBe(8); // godswords and up
    // Ranged and magic armour follows d'hide and robes: green/mystic 40 is T4.
    expect(requirementTier({ ranged: 40 }, 'Body')).toBe(4);
    expect(requirementTier({ magic: 50, defence: 25 }, 'Body')).toBe(5);
    expect(requirementTier({ magic: 70, defence: 40 }, 'Body')).toBe(7);
    // Crossbows keep their metal: rune crossbows need 61 Ranged.
    expect(requirementTier({ ranged: 50 }, 'Weapon', 'Crossbow')).toBe(4);
  });

  it('keeps each armour set on one tier', () => {
    const sets: [number, string[]][] = [
      [5, ['Infinity hat', 'Infinity top', 'Infinity bottoms', 'Infinity gloves', 'Infinity boots', 'Dark infinity top', 'Light infinity hat']],
      [6, ['Lunar helm', 'Lunar torso', 'Lunar legs', 'Lunar gloves', 'Lunar boots', 'Lunar cape']],
      [6, ['Bloodbark helm', 'Bloodbark body', 'Bloodbark legs', 'Bloodbark gauntlets', 'Bloodbark boots']],
      [5, ['Swampbark helm', 'Swampbark body', 'Swampbark legs', 'Swampbark gauntlets', 'Swampbark boots']],
      [4, ['Splitbark helm', 'Splitbark body', 'Splitbark legs', 'Splitbark gauntlets', 'Splitbark boots']],
      [5, ['Granite helm', 'Granite body', 'Granite legs', 'Granite gloves', 'Granite boots', 'Granite shield']],
      [4, ['Samurai kasa', 'Samurai shirt', 'Samurai greaves', 'Samurai gloves', 'Samurai boots']],
      [3, ['Snakeskin bandana', 'Snakeskin body', 'Snakeskin chaps', 'Snakeskin vambraces', 'Snakeskin boots']],
      [3, ['Shayzien helm (1)', 'Shayzien body (5)', 'Shayzien greaves (3)', 'Shayzien gloves (2)', 'Shayzien boots (4)']],
    ];
    const slotOf = (name: string) => catalogue.find((item: { name: string }) => item.name === name)?.slot;
    const SLOT: Record<string, string> = { head: 'Head', body: 'Body', legs: 'Legs', hands: 'Gloves', feet: 'Boots', shield: 'Shield', cape: 'Cape' };
    for (const [tier, names] of sets) {
      for (const name of names) expect(tierOf(name, SLOT[slotOf(name)]), name).toBe(tier);
    }
  });

  it('never restricts gear an activity hands out and takes back', () => {
    for (const name of ['Crystal bow (perfected)', 'Corrupted helm (basic)', 'Crystal body (attuned)', 'Crystal sceptre', 'Castle wars bolts', 'Dawnbringer']) {
      expect(tierOf(name, 'Weapon'), name).toBe(1);
    }
    // The real crystal armour and bow keep their God Wars-level tier.
    expect(tierOf('Crystal helm', 'Head')).toBe(8);
    expect(tierOf('Crystal bow', 'Weapon')).toBe(8);
  });

  it('places diary rewards with the metal gear they copy', () => {
    expect(tierOf('Varrock armour 1', 'Body')).toBe(2); // steel platebody
    expect(tierOf('Varrock armour 4', 'Body')).toBe(4); // adamant platebody
    expect(tierOf('Morytania legs 3', 'Legs')).toBe(3); // mithril platelegs
    expect(tierOf('Falador shield 4', 'Shield')).toBe(4); // adamant kiteshield
    expect(tierOf('Wilderness sword 4', 'Weapon')).toBe(4); // adamant sword
    expect(tierOf('Ardougne cloak 4', 'Cape')).toBe(1); // +6 bonuses, like a plain cape
  });

  it('fixes names that matched the wrong material', () => {
    expect(tierOf('Frog-leather body', 'Body')).toBe(2); // 25 Defence and Ranged, not leather T1
    expect(tierOf("Morrigan's leather body (bh)", 'Body')).toBe(8); // 78 Defence
    expect(tierOf('Hard leather shield', 'Shield')).toBe(2);
  });

  it('only lists names in one place, in lower case', () => {
    for (const key of [...Object.keys(EQUIPMENT_REVIEW.wieldLevels), ...Object.keys(EQUIPMENT_REVIEW.placed)]) {
      expect(key, key).toBe(key.toLowerCase());
    }
    const both = Object.keys(EQUIPMENT_REVIEW.wieldLevels).filter(key => Object.hasOwn(EQUIPMENT_REVIEW.placed, key));
    expect(both).toEqual([]);
  });
});
