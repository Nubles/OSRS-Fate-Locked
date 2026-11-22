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

  it('gives gear with a real wield level its level tier, not the cosmetics T1', () => {
    // Each needs a combat level to equip on the OSRS Wiki (checked 22 November 2026).
    for (const name of ['Amulet of air', 'Amulet of earth', 'Amulet of fire', 'Amulet of water', 'Elemental amulet']) {
      expect(tierOf(name, 'Neck'), name).toBe(5); // 59 Magic
    }
    expect(tierOf('Aquanite hopper', 'Shield')).toBe(6); // 60 Ranged
    expect(tierOf('Bone staff', 'Weapon')).toBe(5); // 50 Magic
    expect(tierOf('Oak blackjack(o)', 'Weapon')).toBe(2); // 10 Attack
    expect(tierOf('Oak blackjack(d)', 'Weapon')).toBe(2); // 10 Defence
    expect(tierOf('Willow blackjack(d)', 'Weapon')).toBe(3); // 20 Defence
    // The plain blackjacks really have no wield level.
    expect(tierOf('Oak blackjack', 'Weapon')).toBe(1);
    expect(tierOf('Willow blackjack', 'Weapon')).toBe(1);
  });

  it('places the wood blowpipes by their Ranged level, not with the toxic blowpipe', () => {
    expect(tierOf('Camphor blowpipe', 'Weapon', 'Blowpipe')).toBe(5); // 45 Ranged
    expect(tierOf('Ironwood blowpipe', 'Weapon', 'Blowpipe')).toBe(5); // 55 Ranged
    expect(tierOf('Rosewood blowpipe', 'Weapon', 'Blowpipe')).toBe(6); // 65 Ranged
    expect(tierOf('Toxic blowpipe', 'Weapon', 'Blowpipe')).toBe(8);
    expect(tierOf('Blazing blowpipe', 'Weapon', 'Blowpipe')).toBe(8);
  });

  it('keeps cosmetic novelty weapons out of the material families', () => {
    expect(tierOf('Mystic cards', 'Weapon')).toBe(1); // purely cosmetic code reward
    expect(tierOf('Mystic robe top', 'Body')).toBe(4);
    expect(tierOf('Mystic fire staff', 'Weapon')).toBe(4);
  });

  it('places the shadow sword with the black 2h sword it copies', () => {
    expect(tierOf('Shadow sword', 'Weapon')).toBe(2);
    expect(tierOf('Black 2h sword', 'Weapon')).toBe(2);
  });

  it('uses the current Deadman Mode wield levels', () => {
    // Lowered to 20 Defence for Deadman: Annihilation (January 2026).
    for (const name of ['Statius\'s full helm (deadman mode)', 'Statius\'s platebody (deadman mode)',
      'Statius\'s platelegs (deadman mode)', 'Vesta\'s chainbody (deadman mode)', 'Vesta\'s plateskirt (deadman mode)']) {
      expect(tierOf(name, 'Body'), name).toBe(3);
    }
    expect(EQUIPMENT_REVIEW.wieldLevels['morrigan\'s coif (deadman mode)']).toEqual({ defence: 20, ranged: 75 });
    expect(EQUIPMENT_REVIEW.wieldLevels['zuriel\'s hood (deadman mode)']).toEqual({ defence: 20, magic: 75 });
    expect(EQUIPMENT_REVIEW.wieldLevels['statius\'s warhammer (deadman mode)']).toEqual({ strength: 78, attack: 20 });
    expect(EQUIPMENT_REVIEW.wieldLevels['zuriel\'s staff (deadman mode)']).toEqual({ magic: 78, attack: 60 });
    expect(EQUIPMENT_REVIEW.wieldLevels['lunar staff']).toEqual({ magic: 65, defence: 40 });
    // The 75-level pieces keep their tier.
    expect(tierOf('Morrigan\'s coif (deadman mode)', 'Head')).toBe(8);
    expect(tierOf('Zuriel\'s robe top (deadman mode)', 'Body')).toBe(8);
    expect(tierOf('Statius\'s warhammer (deadman mode)', 'Weapon')).toBe(8);
    expect(tierOf('Zuriel\'s staff (deadman mode)', 'Weapon')).toBe(8);
    expect(tierOf('Lunar staff', 'Weapon')).toBe(6);
  });

  it('only lists names in one place, in lower case', () => {
    for (const key of [...Object.keys(EQUIPMENT_REVIEW.wieldLevels), ...Object.keys(EQUIPMENT_REVIEW.placed)]) {
      expect(key, key).toBe(key.toLowerCase());
    }
    const both = Object.keys(EQUIPMENT_REVIEW.wieldLevels).filter(key => Object.hasOwn(EQUIPMENT_REVIEW.placed, key));
    expect(both).toEqual([]);
  });
});
