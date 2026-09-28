import { describe, expect, it } from 'vitest';
import { BRUTUS_BOSS_NAME } from '../config/vanillaKeyEconomy';
import { BOSS_KILL_COUNTS, isRaidKey } from './bossKillCounts';
import { BOSS_TIERS } from './bossKeyTiers';

const fold = (name: string) => name.trim().toLowerCase();

describe('boss kill-count names', () => {
  it('names every boss the Farm card lists, and nothing else', () => {
    expect(Object.keys(BOSS_KILL_COUNTS).sort()).toEqual([...Object.keys(BOSS_TIERS), BRUTUS_BOSS_NAME].sort());
    for (const [key, names] of Object.entries(BOSS_KILL_COUNTS)) {
      expect(names.length, key).toBeGreaterThan(0);
      expect(names.every((name) => name.trim() === name && name.length > 0), key).toBe(true);
    }
  });

  it('never gives one kill-count name to two bosses', () => {
    const owners = new Map<string, string>();
    for (const [key, names] of Object.entries(BOSS_KILL_COUNTS)) {
      for (const name of names) {
        expect(owners.get(fold(name)) ?? key, `${name} is ${owners.get(fold(name))}'s`).toBe(key);
        owners.set(fold(name), key);
      }
    }
  });

  it("keeps the names RuneLite's own tests show the game printing", () => {
    // From ChatCommandsPluginTest's real kill-count messages.
    const seen: Record<string, string> = {
      'Corporeal Beast': 'Corporeal Beast',
      'Theatre of Blood': 'Theatre of Blood',
      'Theatre of Blood: Entry Mode': 'Theatre of Blood',
      Wintertodt: 'Wintertodt',
      "Kree'arra": "Kree'arra",
      'Barrows chest': 'Barrows Brothers',
      Gauntlet: 'The Gauntlet',
      'Corrupted Gauntlet': 'The Gauntlet',
      Zulrah: 'Zulrah',
      'TzKal-Zuk': 'Inferno',
      'Grotesque Guardians': 'Grotesque Guardians',
      'Chambers of Xeric': 'Chambers of Xeric',
      'Chambers of Xeric Challenge Mode': 'Chambers of Xeric',
      'TzTok-Jad': 'TzHaar Fight Cave',
      Tempoross: 'Tempoross',
      Nightmare: 'The Nightmare',
      'Tombs of Amascut': 'Tombs of Amascut',
      'Tombs of Amascut: Entry Mode': 'Tombs of Amascut',
      'Tombs of Amascut: Expert Mode': 'Tombs of Amascut',
    };
    for (const [name, key] of Object.entries(seen)) {
      expect(BOSS_KILL_COUNTS[key].map(fold), name).toContain(fold(name));
    }
  });

  it('marks the three raids, which roll as raid completions', () => {
    expect(Object.keys(BOSS_KILL_COUNTS).filter(isRaidKey).sort())
      .toEqual(['Chambers of Xeric', 'Theatre of Blood', 'Tombs of Amascut']);
  });
});
