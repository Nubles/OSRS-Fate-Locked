import { afterEach, describe, expect, it } from 'vitest';
import { UnlockState } from '../types';
import { setStartArea } from './freeAreas';
import {
  bankChunkKey, chunkEntryQuests, chunkedBankOwned, farmPlaceReachable, getActivityAccess, randomKeyActivityAccess,
} from './activityAccess';
import { CHUNK_ENTRY_QUESTS } from '../data/chunkSkillNodes';
import { ACTIVITY_CHUNKS, FARM_SLAYER_CARD_CHUNKS } from '../data/activityChunks';
import { BOSSES_LIST, GUILDS_LIST, MINIGAMES_LIST } from '../data/items';
import { ACTIVITY_ACCESS_AREAS, CHUNKED_ACTIVITY_RULES } from '../data/activityAccess';
import { GATED_ENTRANCE_CHUNKS, SLAYER_MASTER_CHUNKS } from '../data/activityChunks';
import { enterableChunk, gatedEntrances } from './activityAccess';
import { compileRawRequirements } from './questRoutes/accountRequirements';
import { slayerMasterBlock } from './farmGates';
import { SKILLS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { BANK_IDS } from '../data/banks';
import { ALL_CHUNK_KEYS } from './chunkAdjacency';

const ALL_KEYS = (): string[] => [...ALL_CHUNK_KEYS];

const baseUnlocks: UnlockState = {
  equipment: {},
  skills: {},
  levels: {},
  regions: [],
  chunks: [],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: [],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
};

const makeUnlocks = (overrides: Partial<UnlockState> = {}): UnlockState => ({ ...baseUnlocks, ...overrides });

afterEach(() => {
  setStartArea(undefined);
});

describe('getActivityAccess', () => {
  it('requires the literal named area for Pest Control and Last Man Standing', () => {
    setStartArea('none');

    expect(getActivityAccess('Pest Control', makeUnlocks(), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: ["Void Knights' Outpost"],
      explanation: "Needs Void Knights' Outpost",
    });
    expect(getActivityAccess('Pest Control', makeUnlocks({ regions: ["Void Knights' Outpost"] }), 'vanilla').eligible).toBe(
      true,
    );

    expect(getActivityAccess('Last Man Standing', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Last Man Standing', makeUnlocks({ regions: ['Ferox Enclave'] }), 'vanilla').eligible).toBe(
      true,
    );
  });

  it('uses Falador for Giant Mole and Edgeville for Obor', () => {
    setStartArea('none');

    expect(getActivityAccess('Giant Mole', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Giant Mole', makeUnlocks({ regions: ['Falador'] }), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Obor', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Obor', makeUnlocks({ regions: ['Edgeville'] }), 'vanilla').eligible).toBe(true);
  });

  it("requires Wizards' Tower for Guardians of the Rift rather than Al Kharid", () => {
    setStartArea('none');

    expect(getActivityAccess('Guardians of the Rift', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Guardians of the Rift', makeUnlocks({ regions: ['Al Kharid'] }), 'vanilla').eligible).toBe(
      false,
    );
    expect(
      getActivityAccess('Guardians of the Rift', makeUnlocks({ regions: ["Wizards' Tower"] }), 'vanilla').eligible,
    ).toBe(true);
  });

  it('requires Forgotten Cemetery for Crazy Archaeologist', () => {
    setStartArea('none');

    expect(getActivityAccess('Crazy Archaeologist', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(
      getActivityAccess('Crazy Archaeologist', makeUnlocks({ regions: ['Forgotten Cemetery'] }), 'vanilla').eligible,
    ).toBe(true);
  });

  it('allows any declared geographic gateway', () => {
    setStartArea('none');

    expect(getActivityAccess('Temple Trekking', makeUnlocks(), 'vanilla').eligible).toBe(false);
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Burgh de Rott'] }), 'vanilla').eligible).toBe(
      true,
    );
    // Paterdomus is the start of the reverse route, which needs Darkness of Hallowvale (area-access.d1[2]).
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Paterdomus'] }), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: ['Burgh de Rott', 'Paterdomus'],
      explanation: 'Needs Burgh de Rott, or Paterdomus after Darkness of Hallowvale',
    });
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Paterdomus'], quests: ['Darkness of Hallowvale'] }), 'vanilla').eligible)
      .toBe(true);
    expect(getActivityAccess('Temple Trekking', makeUnlocks({ regions: ['Burgh de Rott'] }), 'vanilla').explanation).toBe('');
  });

  it('keeps explicit non-gates eligible without any area unlocks', () => {
    setStartArea('none');

    for (const activity of ['Mimic', 'Shooting Stars', 'Mahogany Homes', 'Forestry']) {
      expect(getActivityAccess(activity, makeUnlocks(), 'vanilla')).toEqual({
        eligible: true,
        requiredAreas: [],
        explanation: '',
      });
    }
  });

  it('does not consider skills, quests, items, or combat state', () => {
    setStartArea('none');

    const geographicOnly = getActivityAccess(
      'Pest Control',
      makeUnlocks({ regions: ["Void Knights' Outpost"] }),
      'vanilla',
    );
    const withOtherRequirements = getActivityAccess(
      'Pest Control',
      makeUnlocks({
        regions: ["Void Knights' Outpost"],
        equipment: { Bronze: 0 },
        skills: { Combat: 1 },
        levels: { Combat: 3 },
        quests: [],
      }),
      'vanilla',
    );

    expect(withOtherRequirements).toEqual(geographicOnly);
  });

  it('preserves eligibility in modes without Key reserves', () => {
    setStartArea('none');

    expect(getActivityAccess('Pest Control', makeUnlocks(), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Pest Control', makeUnlocks(), 'xtreme')).toEqual({
      eligible: true,
      requiredAreas: [],
      explanation: '',
    });
  });

  it('fails closed for a missing vanilla activity declaration', () => {
    setStartArea('none');

    expect(getActivityAccess('Unknown activity', makeUnlocks(), 'vanilla')).toEqual({
      eligible: false,
      requiredAreas: [],
      explanation: 'Missing location declaration',
    });
  });

  it('fails closed for inherited object property names', () => {
    setStartArea('none');

    for (const activity of ['toString', '__proto__']) {
      expect(getActivityAccess(activity, makeUnlocks(), 'vanilla')).toEqual({
        eligible: false,
        requiredAreas: [],
        explanation: 'Missing location declaration',
      });
    }
  });
});

describe('getActivityAccess in Chunked', () => {
  const chunked = (chunks: string[] = [], over: Partial<UnlockState> = {}) => makeUnlocks({ chunks, ...over });

  it('counts only the exact entrance chunk, not a foothold in the named area (map review 5)', () => {
    // Lumbridge's start chunk used to open Tormented Demons and Tears of Guthix (both entered from 49,49).
    for (const activity of ['Tormented Demons', 'Tears of Guthix']) {
      // The castle cellar way (50,50) is named with what it needs (area-access.d3[0]).
      // The start chunk 50,50 is always held, so a fresh run is told what the cellar way needs.
      expect(getActivityAccess(activity, chunked(), 'chunked')).toEqual({
        eligible: false,
        requiredAreas: ['Lumbridge (49, 49) or Lumbridge (50, 50), after The Lost Tribe started'],
        explanation: 'Needs The Lost Tribe started',
      });
      expect(getActivityAccess(activity, chunked(['49,49']), 'chunked').eligible).toBe(true);
    }
    // Two rolls toward Varrock's south fence used to open Scurrius and Bryophyta.
    expect(getActivityAccess('Scurrius', chunked(['50,51', '50,52']), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Scurrius', chunked(['50,51', '50,52', '50,53', '50,54']), 'chunked').eligible).toBe(true);
    // Any one of several entrances is enough.
    expect(getActivityAccess('Castle Wars', chunked(['38,48']), 'chunked').eligible).toBe(true);
  });

  it('opens nothing located from the start chunk alone', () => {
    const start = chunked();
    const located = [...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST]
      .filter(activity => getActivityAccess(activity, start, 'chunked').eligible);
    // The Mimic waits on a clue casket, which the tracker does not follow, so no chunk holds it back.
    expect([...located].sort()).toEqual(['Forestry', 'Mimic']);
    expect(located.filter(activity => randomKeyActivityAccess(activity, start, 'chunked').eligible)).toEqual(['Forestry']);
  });

  it('follows the stated rule for places with no single chunk', () => {
    expect(getActivityAccess('Forestry', chunked(), 'chunked').eligible).toBe(true);
    // Random Keys skip the Mimic, but once an Omni-Key unlocks it, it can be fought (content audit fix 2).
    // It is fought at the strange casket upstairs in Watson's house; the casket that starts it comes from a clue.
    expect(CHUNKED_ACTIVITY_RULES.Mimic.reason).toContain("Watson's house");
    expect(randomKeyActivityAccess('Mimic', chunked(), 'chunked')).toEqual({
      eligible: false,
      requiredAreas: ['a Mimic casket from an Elite or Master clue'],
      explanation: 'Needs a Mimic casket from an Elite or Master clue',
    });
    expect(getActivityAccess('Mimic', chunked(), 'chunked').eligible).toBe(true);
    expect(randomKeyActivityAccess('Mimic', makeUnlocks(), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Barracuda Trials', chunked(), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Barracuda Trials', chunked([], {
      skills: { Sailing: 1 }, levels: { Sailing: 1 }, quests: ['Pandemonium'],
    }), 'chunked').eligible).toBe(true);
    // Shooting Stars: any crash site the run owns, Abyssal Sire: the Zanaris shed.
    expect(getActivityAccess('Shooting Stars', chunked(), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Shooting Stars', chunked(['50,49']), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Abyssal Sire', chunked(['50,49']), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Unknown activity', chunked(), 'chunked').eligible).toBe(false);
  });

  it('keeps Vanilla on its named areas', () => {
    setStartArea('none');
    expect(getActivityAccess('Tormented Demons', makeUnlocks({ regions: ['Lumbridge'] }), 'vanilla').eligible).toBe(true);
    expect(getActivityAccess('Mimic', makeUnlocks(), 'vanilla').eligible).toBe(true);
  });

  it('boards the Fishing Trawler only at the Port Khazard dock, not the shore a sunk trawler leaves you on (Wiki: Fishing Trawler)', () => {
    expect(getActivityAccess('Fishing Trawler', chunked(['41,50']), 'chunked').eligible).toBe(false);
    expect(getActivityAccess('Fishing Trawler', chunked(['41,49']), 'chunked').eligible).toBe(true);
  });

  it('does not count the Zanaris shed for Impetuous Impulses, since that portal needs Lost City (Wiki: Impetuous Impulses)', () => {
    expect(getActivityAccess('Impetuous Impulses', chunked(['50,49']), 'chunked').eligible).toBe(false);
    // A rotating crop circle needs no quest.
    expect(getActivityAccess('Impetuous Impulses', chunked(['50,52']), 'chunked').eligible).toBe(true);
  });

  it("opens Mahogany Homes at Amy's office, where every first contract is taken, and not at a client's house (Wiki: Mahogany Homes)", () => {
    expect(getActivityAccess('Mahogany Homes', chunked(['46,52']), 'chunked').eligible).toBe(true);
    for (const house of ['40,51', '47,52', '50,52']) {
      expect(getActivityAccess('Mahogany Homes', chunked([house]), 'chunked').eligible, house).toBe(false);
    }
  });
});

describe('Chunked places behind an entry quest (content audit fix 1)', () => {
  const chunked = (chunks: string[], quests: string[] = []) => makeUnlocks({ chunks, quests });

  it('reads the entry quests from the chunk content and the reviewed quest-locked places', () => {
    // The chunk content's four, then ENTRY_QUEST_CHUNKS in utils/chunkSkillNodesBuild.ts (deep audit chunk-sample d1[0], d2[0], d3[0]).
    expect(Object.keys(CHUNK_ENTRY_QUESTS).sort()).toEqual([
      'Bone Voyage', 'Cabin Fever', 'Children of the Sun', 'Darkness of Hallowvale', 'Desert Treasure II', 'Dragon Slayer I',
      'Lunar Diplomacy', 'Making Friends with My Arm', "Mourning's End Part I", 'Priest in Peril', 'Regicide', 'Shilo Village',
      'Sins of the Father', 'The Fremennik Isles', 'The Fremennik Trials',
    ]);
    expect(chunkEntryQuests('55,51')).toEqual(['Priest in Peril']);
    expect(chunkEntryQuests('59,59')).toEqual(['Bone Voyage']);
    expect(chunkEntryQuests('50,50')).toEqual([]);
  });

  it.each([
    ['Barrows Brothers', 'Priest in Peril'],
    ['Theatre of Blood', 'Priest in Peril'],
    ['Hallowed Sepulchre', 'Priest in Peril'],
    ['Hunter Guild', 'Children of the Sun'],
    ['Fortis Colosseum', 'Children of the Sun'],
    ['Volcanic Mine', 'Bone Voyage'],
    ['Trouble Brewing', 'Cabin Fever'],
  ])('%s waits for %s as well as its own chunk', (activity, quest) => {
    const chunks = [...ACTIVITY_CHUNKS[activity]];
    expect(getActivityAccess(activity, chunked([]), 'chunked').eligible).toBe(false);
    const before = getActivityAccess(activity, chunked(chunks), 'chunked');
    expect(before.eligible).toBe(false);
    expect(before.explanation).toBe(`Needs ${quest}`);
    expect(before.requiredAreas[0]).toMatch(new RegExp(`, after ${quest}$`));
    expect(randomKeyActivityAccess(activity, chunked(chunks), 'chunked').eligible).toBe(false);
    expect(getActivityAccess(activity, chunked(chunks, [quest]), 'chunked').eligible).toBe(true);
    // The quest alone opens nothing: the chunk must still be owned.
    expect(getActivityAccess(activity, chunked([], [quest]), 'chunked').eligible).toBe(false);
  });

  it('leaves places outside the gates as they were', () => {
    expect(getActivityAccess('Tormented Demons', chunked(['49,49']), 'chunked').eligible).toBe(true);
    // Vanilla reads named areas, not entry quests.
    setStartArea('none');
    expect(getActivityAccess('Barrows Brothers', makeUnlocks({ regions: ['Barrows'] }), 'vanilla').eligible).toBe(true);
  });

  it("holds Mazchna's Farm card back until Priest in Peril", () => {
    const canifis = FARM_SLAYER_CARD_CHUNKS.Mazchna;
    expect(farmPlaceReachable(canifis, chunked([...canifis]), 'chunked')).toBe(false);
    expect(farmPlaceReachable(canifis, chunked([...canifis], ['Priest in Peril']), 'chunked')).toBe(true);
    expect(farmPlaceReachable(canifis, makeUnlocks(), 'vanilla')).toBe(true);
  });
});

describe('Chunked banks and Farm places', () => {
  it('counts the Bank boat at sea once the run can sail (content audit fix 3)', () => {
    expect(bankChunkKey('8999')).toBe('35,39');
    expect(chunkedBankOwned('8999', makeUnlocks())).toBe(false);
    expect(chunkedBankOwned('8999', makeUnlocks({ quests: ['Pandemonium'] }))).toBe(false);
    expect(chunkedBankOwned('8999', makeUnlocks({
      skills: { Sailing: 1 }, levels: { Sailing: 1 }, quests: ['Pandemonium'],
    }))).toBe(true);
  });

  it('counts a bank only in an owned chunk, and the virtual Forestry entry anywhere', () => {
    expect(bankChunkKey('12850')).toBe('50,50');
    const start = makeUnlocks();
    const owned = BANK_IDS.filter(bank => chunkedBankOwned(bank, start));
    expect(owned.filter(bank => bankChunkKey(bank) !== undefined)).toEqual(['12850']);
    expect(owned.filter(bank => bankChunkKey(bank) === undefined)).toHaveLength(BANK_IDS.length - 124);
  });

  it('offers Brutus and Slayer masters in Chunked only from their own chunk', () => {
    const start = makeUnlocks();
    const brutus = ACTIVITY_CHUNKS.Brutus;
    expect(farmPlaceReachable(brutus, start, 'chunked')).toBe(false);
    expect(farmPlaceReachable(brutus, makeUnlocks({ chunks: ['50,51'] }), 'chunked')).toBe(true);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Turael, start, 'chunked')).toBe(false);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Aya, makeUnlocks({ chunks: ['45,55'] }), 'chunked')).toBe(true);
    // A Boss Task card shows with any master who gives boss tasks. Duradel is inside Shilo Village,
    // which the game opens only after the Shilo Village quest (deep audit chunk-sample d2[0]).
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS['Boss Task'], makeUnlocks({ chunks: ['44,46'], quests: ['Shilo Village'] }), 'chunked')).toBe(true);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS['Boss Task'], makeUnlocks({ chunks: ['44,46'] }), 'chunked')).toBe(false);
    expect(farmPlaceReachable(undefined, start, 'chunked')).toBe(false);
    // Every other mode keeps the full Farm list.
    expect(farmPlaceReachable(brutus, start, 'vanilla')).toBe(true);
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Turael, start, 'vanilla')).toBe(true);
  });
});


describe('ways in that carry their own requirement (area-access.d3[0], d3[1], d1[2])', () => {
  const run = (chunks: string[], over: Partial<UnlockState> = {}) => makeUnlocks({ chunks, ...over });

  it('opens the Lumbridge castle cellar way to Juna only once The Lost Tribe is done', () => {
    for (const activity of ['Tears of Guthix', 'The Fractured Archive', 'Tormented Demons']) {
      // A fresh run on the start chunk: the cellar way stays shut and is named.
      expect(getActivityAccess(activity, run(['50,50']), 'chunked')).toEqual({
        eligible: false,
        requiredAreas: ['Lumbridge (49, 49) or Lumbridge (50, 50), after The Lost Tribe started'],
        explanation: 'Needs The Lost Tribe started',
      });
      // Finished proves started; a quest only begun is something the save cannot know, so it stays shut.
      expect(getActivityAccess(activity, run(['50,50'], { quests: ['The Lost Tribe'] }), 'chunked').eligible).toBe(true);
      expect(getActivityAccess(activity, run(['49,49']), 'chunked').eligible).toBe(true);
    }
  });

  it('opens the 51 Agility pipe from the Varrock Sewers to Vannaka and Obor', () => {
    const agility = (level: number) => ({ skills: { Agility: 6, Slayer: 1 }, levels: { Agility: level } });
    expect(getActivityAccess('Obor', run(['50,54'], agility(51)), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Obor', run([]), 'chunked').requiredAreas).toEqual(['Edgeville (48, 54)', 'Varrock (50, 54) with Agility level 51']);
    expect(getActivityAccess('Obor', run(['50,54'], agility(50)), 'chunked')).toMatchObject({ eligible: false, explanation: 'Needs Agility level 51' });
    for (const [unlocks, open] of [[run(['50,54'], agility(51)), true], [run(['50,54'], agility(50)), false], [run(['50,54'], { skills: { Slayer: 1 } }), false]] as const) {
      expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Vannaka, unlocks, 'chunked', 'Vannaka')).toBe(open);
      expect(farmPlaceReachable(SLAYER_MASTER_CHUNKS.Vannaka, unlocks, 'chunked', 'Vannaka')).toBe(open);
      expect(slayerMasterBlock('Vannaka', unlocks, 'chunked') === 'Needs Edgeville (48, 54) or Varrock (50, 54) with Agility level 51').toBe(!open);
    }
    // Without the name the pipe is never counted.
    expect(farmPlaceReachable(FARM_SLAYER_CARD_CHUNKS.Vannaka, run(['50,54'], agility(99)), 'chunked')).toBe(false);
  });

  it('opens Temple Trekking from the Paterdomus only after Darkness of Hallowvale', () => {
    const pip = ['Priest in Peril'];
    expect(getActivityAccess('Temple Trekking', run(['53,54'], { quests: [...pip, 'Darkness of Hallowvale'] }), 'chunked').eligible).toBe(true);
    expect(getActivityAccess('Temple Trekking', run(['53,54'], { quests: pip }), 'chunked'))
      .toMatchObject({ eligible: false, explanation: 'Needs Darkness of Hallowvale' });
    // The chunk's own entry quest still applies to the gated way.
    expect(getActivityAccess('Temple Trekking', run(['53,54'], { quests: ['Darkness of Hallowvale'] }), 'chunked').eligible).toBe(false);
  });

  it('reads every gated requirement as a gate the app checks', () => {
    for (const ways of Object.values(GATED_ENTRANCE_CHUNKS)) {
      for (const way of ways) {
        const gates = compileRawRequirements(way.needs.map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const })));
        expect(gates.map(gate => gate.type), way.needs.join()).not.toContain('UNRESOLVED');
      }
    }
  });

  it('gives every place with no gated way the answer of its plain chunks, for a fresh run and one that owns everything', () => {
    const everything = run(ALL_KEYS(), {
      quests: Object.keys(QUEST_DATA),
      skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
      levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
    });
    const names = new Set([...Object.keys(ACTIVITY_CHUNKS), ...Object.keys(SLAYER_MASTER_CHUNKS), ...Object.keys(FARM_SLAYER_CARD_CHUNKS)]);
    let checked = 0;
    for (const name of names) {
      if (gatedEntrances(name).length) continue;
      for (const unlocks of [run(['50,50']), everything]) {
        const chunks = ACTIVITY_CHUNKS[name] ?? SLAYER_MASTER_CHUNKS[name] ?? FARM_SLAYER_CARD_CHUNKS[name];
        expect(enterableChunk(chunks, unlocks, name)).toEqual(enterableChunk(chunks, unlocks));
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(Object.keys(ACTIVITY_ACCESS_AREAS)).toContain('Temple Trekking');
  });
});
