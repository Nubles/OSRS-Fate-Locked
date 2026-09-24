import { afterEach, describe, expect, it, vi } from 'vitest';
import { rangedDamageTypeForCategory, rangedDefenceFor } from '../utils/rangedDamage';
import { planBoss, type PlayerCombat } from '../utils/bossPlanner';
import { ZERO_BONUSES } from '../utils/gearStats';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('reviewed combat data', () => {
  it('replaces the old zero-defence cache and preserves all three upstream ranged bonuses', async () => {
    const getItem = vi.fn((key: string) => key === 'fate_osrs_monsters_v2'
      ? JSON.stringify({ timestamp: Date.now(), data: [{ id: 2215, def: { ranged: 0 } }] }) : null);
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem, setItem });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [
      { id: 2215, name: 'General Graardor', skills: { hp: 255, def: 250 }, defensive: { light: 90, standard: 90, heavy: 90 } },
      { id: 1, name: 'Mixed defence target', skills: { hp: 100, def: 100 }, defensive: { light: -20, standard: 50, heavy: 150 } },
    ] })));
    const { monsterService } = await import('./MonsterService');
    await monsterService.init();
    expect(getItem).toHaveBeenCalledWith('fate_osrs_monsters_v3');
    expect(monsterService.byId(2215)?.rangedDefence).toEqual({ light: 90, standard: 90, heavy: 90 });
    const mixed = monsterService.byId(1)!;
    expect(['light', 'standard', 'heavy'].map(t => rangedDefenceFor(mixed, t as 'light' | 'standard' | 'heavy'))).toEqual([-20, 50, 150]);
    expect(setItem).toHaveBeenCalledWith('fate_osrs_monsters_v3', expect.any(String));

    const player: PlayerCombat = { levels: { attack: 1, strength: 1, ranged: 99, magic: 1, hitpoints: 99 },
      gear: { bonuses: { ...ZERO_BONUSES, ranged: 100, rangedStr: 100 }, speedTicks: 4, category: 'Thrown', rangedDamageType: 'light' }, boostsOn: false };
    const light = planBoss(player, mixed);
    const heavy = planBoss({ ...player, gear: { ...player.gear, rangedDamageType: 'heavy' } }, mixed);
    expect(light.style).toBe('ranged');
    expect(heavy.style).toBe('ranged');
    expect(light.hitChance).toBeGreaterThan(heavy.hitChance);
    expect(light.dps).toBeGreaterThan(heavy.dps);
  });

  it('uses Wiki weapon classes including the chinchompa heavy-accuracy exception', () => {
    expect(rangedDamageTypeForCategory('Thrown')).toBe('light');
    expect(rangedDamageTypeForCategory('Bow')).toBe('standard');
    expect(rangedDamageTypeForCategory('Salamander')).toBe('standard');
    expect(rangedDamageTypeForCategory('Crossbow')).toBe('heavy');
    expect(rangedDamageTypeForCategory('Chinchompas')).toBe('heavy');
    expect(rangedDamageTypeForCategory('Unknown')).toBeUndefined();
  });

  it('preserves weapon categories when fetching equipment and replaces the old cache', async () => {
    const getItem = vi.fn(() => null);
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [
      { id: 861, name: 'Magic shortbow', slot: 'weapon', category: 'Bow', offensive: { ranged: 69 }, speed: 4 },
      { id: 9185, name: 'Rune crossbow', slot: 'weapon', category: 'Crossbow', offensive: { ranged: 90 }, speed: 6 },
    ] })));
    const { gearService } = await import('./GearService');
    await gearService.init();
    expect(getItem).toHaveBeenCalledWith('fate_osrs_gear_v3');
    expect(gearService.byId(861)?.rangedDamageType).toBe('standard');
    expect(gearService.byId(9185)?.rangedDamageType).toBe('heavy');
  });
});
