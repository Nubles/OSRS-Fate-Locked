import { describe, expect, it } from 'vitest';
import aliases from './contentAliases.json';
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from './activityAccess';
import { ACTIVITY_REGIONS } from './activityRegions';
import { ACTIVITY_REQUIREMENTS } from './activityRequirements';
import { BOSS_KILL_COUNTS } from './bossKillCounts';
import { BOSS_TIERS } from './bossKeyTiers';
import { interiorArea } from './interiorAreas';
import { BOSSES_LIST, RETIRED_BOSSES } from './items';
import { QUEST_DATA } from './questData';
import { createFreshState } from '../context/GameContext';
import { TableType } from '../types';
import { canonicalBossId } from '../utils/contentIdentity';
import { MAX_COUNTER, validateAndMigrateSave } from '../utils/saveSchema';

/**
 * Boss fixes from the accuracy audit (29 September 2026) and the owner's
 * decisions of 2 October.
 */
describe('boss fights tie to their boss unlock', () => {
  it('resolves every monster a boss fight is made of to that boss', () => {
    // Before, the chunk drawer and RuneLite listed these as ordinary monsters you
    // could fight without the boss unlock.
    const FIGHTS: Readonly<Record<string, readonly string[]>> = {
      'Dagannoth Kings': ['Dagannoth Rex', 'Dagannoth Prime', 'Dagannoth Supreme'],
      'Tormented Demons': ['Tormented Demon'],
      'TzHaar Fight Cave': ['TzTok-Jad'],
      Inferno: ['TzKal-Zuk'],
      'The Royal Titans': ['Branda the Fire Queen', 'Eldric the Ice King'],
      'Barrows Brothers': [
        'Ahrim the Blighted', 'Dharok the Wretched', 'Guthan the Infested',
        'Karil the Tainted', 'Torag the Corrupted', 'Verac the Defiled',
      ],
      'Moons of Peril': ['Blood Moon', 'Blue Moon', 'Eclipse Moon'],
      'Fortis Colosseum': ['Sol Heredit'],
      'Chambers of Xeric': ['Great Olm'],
      'Tombs of Amascut': ["Tumeken's Warden", "Elidinis' Warden"],
      'The Hueycoatl': ['Hueycoatl body', 'Hueycoatl tail'],
      Mimic: ['The Mimic'],
    };
    for (const [boss, monsters] of Object.entries(FIGHTS)) {
      for (const monster of monsters) expect(canonicalBossId(monster), monster).toBe(boss);
    }
    for (const [alias, boss] of Object.entries(aliases.bosses)) expect(BOSSES_LIST, alias).toContain(boss);
  });

  it('puts the Fight Caves in the TzHaar city, as the Inferno is', () => {
    expect(interiorArea('Fight Caves')).toBe('Mor Ul Rek (TzHaar City)');
  });
});

describe('boss access', () => {
  it('opens Artio and Spindel as Calvar\'ion opens: the hard Wilderness diary, or the boss task', () => {
    for (const [boss, task] of [['Artio', 'Callisto'], ['Spindel', 'Venenatis']] as const) {
      expect(ACTIVITY_REQUIREMENTS[boss].oneOf).toEqual([
        { diaries: ['Wilderness Hard'] },
        { manualRequirements: [expect.stringContaining(`${task} boss Slayer task`)] },
      ]);
    }
  });

  it('asks for The Blood Moon Rises before the Maggot King', () => {
    expect(ACTIVITY_REQUIREMENTS['Maggot King'].quests).toEqual(['The Blood Moon Rises']);
    expect(QUEST_DATA['The Blood Moon Rises']).toBeDefined();
  });

  it('asks for a fire cape before TzHaar-Ket-Rak\'s Challenges, in inner Mor Ul Rek', () => {
    expect(ACTIVITY_REQUIREMENTS["TzHaar-Ket-Rak's Challenges"].manualRequirements)
      .toEqual(['Show a fire cape to enter inner Mor Ul Rek']);
  });

  it('reaches the Abyssal Sire through fairy ring DIP or the Abyss', () => {
    expect(ACTIVITY_REQUIREMENTS['Abyssal Sire'].oneOf?.map(route => route.manualRequirements)).toEqual([
      ['Reached the Abyssal Nexus through fairy ring DIP'],
      ['Reached the Abyss through the Mage of Zamorak in the Wilderness'],
    ]);
  });

  it('tags the God Wars Dungeon bosses, the Leviathan and the Whisperer with the region their entrance is in', () => {
    for (const boss of ['Nex', 'General Graardor', 'Commander Zilyana', "Kree'arra", "K'ril Tsutsaroth", 'The Whisperer']) {
      expect(ACTIVITY_REGIONS[boss], boss).toBe('Asgarnia');
    }
    expect(ACTIVITY_REGIONS['The Leviathan']).toBe('Misthalin');
  });
});

describe('Galvek leaves the boss table', () => {
  // He is fought once, inside Dragon Slayer II (owner decision B3).
  const migrate = (state: ReturnType<typeof createFreshState>) => {
    const result = validateAndMigrateSave(state, createFreshState());
    if (!result.ok) throw new Error(JSON.stringify(result));
    return result.state;
  };

  it('is gone from every boss table', () => {
    expect(RETIRED_BOSSES).toEqual(['Galvek']);
    expect(BOSSES_LIST).not.toContain('Galvek');
    for (const table of [ACTIVITY_REQUIREMENTS, ACTIVITY_REGIONS, BOSS_TIERS, BOSS_KILL_COUNTS, ACTIVITY_ACCESS_AREAS]) {
      expect(Object.keys(table)).not.toContain('Galvek');
    }
    expect(NO_HARD_LOCATION_GATE.has('Galvek')).toBe(false);
  });

  it.each(['key', 'chaosKey'] as const)('gives a run that owned him back what it paid (%s), once, keeping its history', costType => {
    const state = createFreshState();
    state.unlocks.bosses = ['Obor', 'Galvek'];
    state.history = [{ id: 'paid', timestamp: 100, type: 'UNLOCK', message: 'Unlocked Galvek', hash: 'untouched',
      meta: { item: 'Galvek', category: TableType.BOSSES, cost: 1, costType } }];
    state.pendingUnlock = { id: 'reveal', table: TableType.BOSSES, item: 'Galvek', costType, cost: 1 };
    const counter = costType === 'key' ? 'keys' : 'chaosKeys';
    const next = migrate(state);
    expect(next[counter]).toBe(state[counter] + 1);
    expect(next.unlocks.bosses).toEqual(['Obor']);
    expect(next.pendingUnlock).toBeUndefined();
    expect(next.history).toEqual(state.history);
    expect(migrate(next)).toEqual(next);
  });

  it('keeps him as credit while the Key counter is full', () => {
    const state = createFreshState();
    state.keys = MAX_COUNTER;
    state.unlocks.bosses = ['Galvek'];
    expect(migrate(state).unlocks.bosses).toEqual(['Galvek']);
  });

  it('loads a save that counted his Keys, dropping the counter', () => {
    const state = createFreshState();
    state.bossStandardKeysAwarded = { Galvek: 1, Obor: 1 };
    expect(migrate(state).bossStandardKeysAwarded).toEqual({ Obor: 1 });
  });
});
