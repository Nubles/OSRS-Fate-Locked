import { describe, it, expect } from 'vitest';
import {
  SKILLS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, REGIONS_LIST, MISTHALIN_AREAS,
  MOBILITY_LIST, ARCANA_LIST, ROLLABLE_POH_ITEMS, MERCHANTS_LIST, MINIGAMES_LIST,
  BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../constants';
import { BANK_IDS } from '../data/banks';
import { QUEST_DATA, QUEST_CAPE_QUEST_IDS } from '../data/questData';
import {
  ACHIEVEMENTS, evaluateAchievements as evaluateRun, earnedIds as earnedRunIds, completionPercent, runStats,
} from './achievements';
import { LogEntry, UnlockState } from '../types';
import { PETS } from '../data/pets';
import { setStartArea } from './freeAreas';

const evaluateAchievements = (unlocks: UnlockState, gameModeId?: string) => evaluateRun({ unlocks, gameModeId });
const earnedIds = (unlocks: UnlockState) => earnedRunIds({ unlocks });

function emptyUnlocks(over: Partial<UnlockState> = {}): UnlockState {
  return {
    equipment: {},
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 0])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 1])),
    regions: [],
    mobility: [], arcana: [], housing: [], merchants: [], minigames: [],
    bosses: [], storage: [], guilds: [], farming: [], slayerUnlocks: [],
    quests: [],
    diaries: [],
    cas: [],
    completedTasks: [],
    collectionLog: {},
    ...over,
  };
}

function maxedUnlocks(): UnlockState {
  return emptyUnlocks({
    equipment: Object.fromEntries(EQUIPMENT_SLOTS.map((s) => [s, EQUIPMENT_TIER_MAX])),
    skills: Object.fromEntries(SKILLS_LIST.map((s) => [s, 10])),
    levels: Object.fromEntries(SKILLS_LIST.map((s) => [s, 99])),
    regions: [...REGIONS_LIST],
    mobility: [...MOBILITY_LIST],
    arcana: [...ARCANA_LIST],
    housing: [...ROLLABLE_POH_ITEMS],
    merchants: [...MERCHANTS_LIST],
    minigames: [...MINIGAMES_LIST],
    bosses: [...BOSSES_LIST],
    storage: [...STORAGE_LIST],
    guilds: [...GUILDS_LIST],
    farming: [...FARMING_PATCH_LIST],
    slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
    banks: [...BANK_IDS],
  });
}

describe('achievements engine', () => {
  it('every achievement has a unique id and a positive target', () => {
    const ids = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(ids.has(a.id)).toBe(false);
      ids.add(a.id);
    }
    for (const a of evaluateAchievements(emptyUnlocks())) expect(a.target).toBeGreaterThan(0);
  });

  it('a fresh run earns nothing', () => {
    const evaluated = evaluateAchievements(emptyUnlocks());
    expect(evaluated.every((a) => !a.earned)).toBe(true);
    expect(earnedIds(emptyUnlocks()).size).toBe(0);
  });

  it('pct is clamped to 0..100 and earned matches current>=target', () => {
    for (const a of evaluateAchievements(maxedUnlocks())) {
      expect(a.pct).toBeGreaterThanOrEqual(0);
      expect(a.pct).toBeLessThanOrEqual(100);
      expect(a.earned).toBe(a.current >= a.target);
    }
  });

  it('completing one quest earns the First Steps milestone', () => {
    const firstQuestId = Object.keys(QUEST_DATA)[0];
    const evaluated = evaluateAchievements(emptyUnlocks({ quests: [firstQuestId] }));
    const firstSteps = evaluated.find((a) => a.id === 'quests-1');
    expect(firstSteps?.earned).toBe(true);
  });

  it('a maxed account reaches 100% completion and earns Fate Conqueror', () => {
    const maxed = maxedUnlocks();
    expect(completionPercent(maxed)).toBe(100);
    const evaluated = evaluateAchievements(maxed);
    const conqueror = evaluated.find((a) => a.id === 'mastery-100');
    expect(conqueror?.earned).toBe(true);
  });

  it('earnedIds grows monotonically as progress is added', () => {
    const base = earnedIds(emptyUnlocks());
    const firstQuestId = Object.keys(QUEST_DATA)[0];
    const after = earnedIds(emptyUnlocks({ quests: [firstQuestId] }));
    expect(after.size).toBeGreaterThan(base.size);
    for (const id of base) expect(after.has(id)).toBe(true);
  });

  it('counts pending overlap refund markers as their two canonical regions', () => {
    const regions = evaluateAchievements(emptyUnlocks({
      regions: ['Baxtorian Falls', "Otto's Grotto", 'Taverley', "Heroes' Guild"],
    })).find((achievement) => achievement.id === 'regions-5');

    expect(regions?.current).toBe(2);
  });

  it('awards the quest cape after every canonical quest without optional miniquests', () => {
    const evaluated = evaluateAchievements(emptyUnlocks({ quests: [...QUEST_CAPE_QUEST_IDS] }), 'vanilla');
    const questCape = evaluated.find(achievement => achievement.title === 'Quest Cape');

    expect(questCape?.current).toBe(QUEST_CAPE_QUEST_IDS.length);
    expect(questCape?.target).toBe(QUEST_CAPE_QUEST_IDS.length);
    expect(questCape?.earned).toBe(true);
  });

  it('does not substitute miniquests or duplicate records for canonical quest milestones', () => {
    const miniquests = Object.values(QUEST_DATA).filter(quest => quest.kind === 'miniquest').map(quest => quest.id);
    expect(miniquests.length).toBeGreaterThan(0);
    const firstSteps = evaluateAchievements(emptyUnlocks({ quests: miniquests }), 'vanilla')
      .find(achievement => achievement.id === 'quests-1');
    expect(firstSteps?.earned).toBe(false);

    const first = QUEST_CAPE_QUEST_IDS[0];
    const withDuplicate = evaluateAchievements(emptyUnlocks({ quests: [first, first, 'Unknown legacy quest', ...miniquests] }), 'vanilla')
      .find(achievement => achievement.id === 'quests-10');
    expect(withDuplicate?.current).toBe(1);
    expect(withDuplicate?.earned).toBe(false);
  });

  it('does not let a retired Aquarium replace a still-missing active unlock', () => {
    const almost = maxedUnlocks();
    almost.banks = almost.banks!.slice(1);
    almost.housing.push('Aquarium');

    expect(completionPercent(almost, 'vanilla')).toBe(99);
    expect(evaluateAchievements(almost, 'vanilla').find(achievement => achievement.id === 'mastery-100')?.earned).toBe(false);
    expect(almost.housing).toContain('Aquarium');
  });
});

describe('area achievements by mode', () => {
  const regionAchievement = (unlocks: UnlockState, mode: string, id: string) =>
    evaluateAchievements(unlocks, mode).find((a) => a.id === id);

  it("counts the areas a Chunked run's chunks reach", () => {
    // One chunk each in Falador, Port Sarim, Rimmington, Taverley and Burthorpe.
    const unlocks = emptyUnlocks({ chunks: ['46,51', '46,49', '45,50', '45,53', '45,55'] });

    expect(regionAchievement(unlocks, 'chunked', 'regions-1')?.earned).toBe(true);
    expect(regionAchievement(unlocks, 'chunked', 'regions-5')?.earned).toBe(true);
    expect(regionAchievement(unlocks, 'chunked', 'regions-178')?.earned).toBe(false);
  });

  it('gives a fresh Chunked run no area achievement for its free start chunk', () => {
    expect(regionAchievement(emptyUnlocks({ chunks: [] }), 'chunked', 'regions-1')?.current).toBe(0);
  });

  it("holds legacy Xtreme's World Tour to its locked Misthalin areas as well", () => {
    setStartArea('lumbridge');
    try {
      const lockedMisthalin = MISTHALIN_AREAS.filter((area) => area !== 'Lumbridge');
      expect(regionAchievement(emptyUnlocks({ regions: [...REGIONS_LIST] }), 'xtreme', 'regions-178'))
        .toMatchObject({ current: REGIONS_LIST.length, target: REGIONS_LIST.length + 8, earned: false });
      expect(regionAchievement(emptyUnlocks({ regions: [...REGIONS_LIST, ...lockedMisthalin] }), 'xtreme', 'regions-178'))
        .toMatchObject({ current: REGIONS_LIST.length + 8, earned: true });
    } finally {
      setStartArea(undefined);
    }
  });
});

describe('achievements read from the run', () => {
  const entry = (type: LogEntry['type'], over: Partial<LogEntry> = {}): LogEntry =>
    ({ id: `${type}-${Math.random()}`, timestamp: 0, type, message: '', ...over });
  const win = (meta: Record<string, unknown> = {}) => entry('ROLL_SUCCESS', { meta: { standardKeysAwarded: 1, ...meta } });
  const miss = () => entry('ROLL_FAIL');
  const find = (run: Parameters<typeof evaluateRun>[0], id: string) => evaluateRun(run).find((a) => a.id === id);

  it('does not give Apprentice for the Hitpoints every run starts with', () => {
    const start = emptyUnlocks({ skills: { ...emptyUnlocks().skills, Hitpoints: 1 } });
    expect(earnedIds(start).has('skills-start-1')).toBe(false);
    expect(earnedIds(emptyUnlocks({ skills: { ...start.skills, Attack: 1 } })).has('skills-start-1')).toBe(true);
  });

  it('counts rolls, Keys won, streaks and the luckiest win from the history', () => {
    const history = [miss(), win({ successProbability: 0.008 }), win({ rewardKind: 'greed', standardKeysAwarded: 2 }), miss(), miss(),
      entry('ROLL_OMNI', { meta: { standardKeysAwarded: 1 } }), entry('PITY')];
    const stats = runStats(history);
    expect(stats).toMatchObject({
      rolls: 7, keysWon: 4, longestWinStreak: 2, longestMissStreak: 2, luckiestWin: 0.008,
      omniRolls: 1, pityKeys: 1, greedDoubled: true,
    });
    const run = { unlocks: emptyUnlocks(), history };
    expect(find(run, 'roll-1pct')?.earned).toBe(true);
    expect(find(run, 'win-streak-2')?.earned).toBe(true);
    expect(find(run, 'win-streak-3')?.earned).toBe(false);
    expect(find(run, 'ritual-greed')?.earned).toBe(true);
  });

  it('reads rituals from old Altar entries that only have a message', () => {
    const history = [
      entry('ALTAR', { message: 'Void Gambit WON — 1 Key!' }),
      ...Array.from({ length: 8 }, () => entry('ALTAR', { message: 'Void Gambit lost.' })),
      entry('ALTAR', { message: 'Ritual of Chaos', meta: { ritual: 'CHAOS', chaosKeysAwarded: 1 } }),
      entry('ALTAR', { message: 'Void Gambit WON: 3 Keys!', meta: { ritual: 'GAMBIT', keysAwarded: 3 } }),
    ];
    const stats = runStats(history);
    expect([...stats.rituals].sort()).toEqual(['CHAOS', 'GAMBIT']);
    expect(stats).toMatchObject({ gambitWins: 2, biggestGambitWin: 3, longestGambitLosingRun: 8, chaosKeys: 1 });
    const run = { unlocks: emptyUnlocks(), history };
    expect(find(run, 'ritual-gambit-3')?.earned).toBe(true);
    expect(find(run, 'gambit-losses-8')?.earned).toBe(true);
    expect(find(run, 'gambit-losses-8')?.hidden).toBe(true);
  });

  it('reads the god rituals, the Barrows Chest, the Invocations and the Pact debt', () => {
    const altar = (ritual: string, meta: Record<string, unknown> = {}) => entry('ALTAR', { message: ritual, meta: { ritual, ...meta } });
    const brothers = ['AHRIM', 'DHAROK', 'GUTHAN', 'KARIL', 'TORAG'];
    const history = [
      altar('TEARS'),
      altar('PACT'),
      ...Array.from({ length: 20 }, () => entry('ROLL_FAIL', { meta: { debtPaid: 2 } })),
      altar('INVOCATIONS', { invocations: ['WALK_THE_PATH', 'OVERLY_DRAINING', 'BLOOD_PRICE'] }),
      ...brothers.map((brother) => altar('BARROWS', { brother })),
      entry('UNLOCK', { message: 'Unlocked Castle Wars', meta: { ward: true } }),
    ];
    const run = { unlocks: emptyUnlocks(), history };
    expect(runStats(history)).toMatchObject({ wardKeys: 1, pactDebtPaid: 40, allInvocations: false });
    expect(find(run, 'ritual-ward')?.earned).toBe(true);
    expect(find(run, 'ritual-tears')?.earned).toBe(true);
    expect(find(run, 'ritual-pact')?.earned).toBe(true);
    expect(find(run, 'ritual-invocations')?.earned).toBe(false);
    expect(find(run, 'ritual-barrows')).toMatchObject({ earned: false, current: 5, target: 6 });

    const more = [...history, altar('BARROWS', { brother: 'VERAC' }),
      altar('INVOCATIONS', { invocations: ['WALK_THE_PATH', 'OVERLY_DRAINING', 'BLOOD_PRICE', 'HARDCORE'] })];
    expect(find({ ...run, history: more }, 'ritual-barrows')?.earned).toBe(true);
    expect(find({ ...run, history: more }, 'ritual-invocations')?.earned).toBe(true);
  });

  it("doesn't count a win Verac hit through as a lucky one", () => {
    const history = [win({ roll: 60, threshold: 1, successProbability: 0.01 })];
    expect(runStats(history).luckiestWin).toBe(1);
    expect(find({ unlocks: emptyUnlocks(), history }, 'roll-1pct')?.earned).toBe(false);
  });

  it('keeps a settled achievement earned after the run drops below it', () => {
    const run = { unlocks: emptyUnlocks(), claimed: ['skills-start-1'] };
    expect(find(run, 'skills-start-1')).toMatchObject({ earned: true, pct: 100 });
    expect(find({ unlocks: emptyUnlocks() }, 'skills-start-1')?.earned).toBe(false);
  });

  it('leaves Sacrifice out of Void Priest', () => {
    const offered = ['LUCK', 'GREED', 'CHAOS', 'GAMBIT', 'TRANSMUTE', 'WARD', 'TEARS', 'PACT', 'INVOCATIONS', 'BARROWS'];
    const history = offered.map((ritual) => entry('ALTAR', { message: ritual, meta: { ritual } }));
    expect(find({ unlocks: emptyUnlocks(), gameModeId: 'vanilla', history }, 'ritual-every'))
      .toMatchObject({ earned: true, target: offered.length });
  });

  it('offers the Cartographer only in Chunked, and Void Priest asks for each ritual the mode offers', () => {
    const vanilla = evaluateRun({ unlocks: emptyUnlocks(), gameModeId: 'vanilla' });
    const chunked = evaluateRun({ unlocks: emptyUnlocks(), gameModeId: 'chunked' });
    expect(vanilla.some((a) => a.id === 'ritual-cartographer')).toBe(false);
    expect(chunked.some((a) => a.id === 'ritual-cartographer')).toBe(true);
    expect(chunked.find((a) => a.id === 'ritual-every')!.target)
      .toBe(vanilla.find((a) => a.id === 'ritual-every')!.target + 1);
  });

  it('counts each unlock table against what the mode can roll', () => {
    const maxed = maxedUnlocks();
    const evaluated = evaluateAchievements(maxed, 'vanilla');
    for (const key of ['mobility', 'arcana', 'housing', 'merchants', 'storage', 'guilds', 'farming', 'slayer-unlocks', 'banks']) {
      expect(evaluated.find((a) => a.id === `${key}-first`)?.earned).toBe(true);
      expect(evaluated.find((a) => a.id === `${key}-all`)?.earned).toBe(true);
    }
    const one = evaluateAchievements(emptyUnlocks({ mobility: [MOBILITY_LIST[0]] }), 'vanilla');
    expect(one.find((a) => a.id === 'mobility-first')?.earned).toBe(true);
    expect(one.find((a) => a.id === 'mobility-all')).toMatchObject({ current: 1, target: MOBILITY_LIST.length, earned: false });
  });

  it('counts pets once each', () => {
    const run = { unlocks: emptyUnlocks(), petsClaimed: [PETS[0].id, PETS[0].id, PETS[1].id] };
    expect(find(run, 'pets-1')?.current).toBe(2);
    expect(find(run, 'pets-all')?.target).toBe(PETS.length);
  });

  it('gives every achievement a title, and Fate only in steps of 5, 10 or 25', () => {
    const titles = new Set<string>();
    for (const a of ACHIEVEMENTS) {
      expect(titles.has(a.title)).toBe(false);
      titles.add(a.title);
      expect([0, 5, 10, 25]).toContain(a.fate);
      if (a.clarity > 0) expect(a.fate).toBe(25);
    }
  });
});
