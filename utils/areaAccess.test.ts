import { describe, expect, it } from 'vitest';
import { AREA_ENTRY_ROUTES, areaEntryDependencies, type AreaEntryRoute } from '../data/areaAccess';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DIARY_DATA } from '../data/diaryData';
import { QUEST_DATA } from '../data/questData';
import { ARCANA_LIST, EQUIPMENT_SLOTS, MOBILITY_LIST, REGION_GROUPS, REGIONS_LIST, SKILLS_LIST } from '../data/items';
import { TableType, type UnlockState } from '../types';
import { chunkUnlocked, placeOf } from './chunkLocations';
import { isValidUnlock, randomUnlockPool } from './gameEngine';
import { planForTarget } from './goalPlanner';
import { diaryTaskCompletionDecision } from './journalCompletion';
import { diaryUnmet } from './journalProgress';
import { countDoableTasks, evaluateDiaryTaskEligibility, getDiaryStatus } from './journalStatus';
import { isAreaReachable } from './reachability';
import { rankLockedRegions } from './regionAdvisor';

const account = (overrides: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [],
  housing: [], merchants: [], minigames: [], bosses: [], storage: [], guilds: [],
  farming: [], slayerUnlocks: [], quests: [], diaries: [], cas: [],
  completedTasks: [], collectionLog: {}, ...overrides,
});
const task = (id: string) => ALL_DIARY_TASKS.find(row => row.id === id)!;
const combat46 = { Attack: 40, Strength: 40, Defence: 40, Hitpoints: 40 };
const tierTasksExcept = (tierId: string, id: string) => ALL_DIARY_TASKS
  .filter(row => row.tierId === tierId && row.id !== id)
  .map(row => row.id);

describe('island access for one account state', () => {
  it('is reused only while nothing a route reads has changed', () => {
    const seaweed = task('kar_easy_8');
    const stranded = account({ regions: ['Ship Yard', 'Al Kharid'], quests: ['The Grand Tree'] });
    expect(evaluateDiaryTaskEligibility(seaweed, stranded, 'vanilla').eligible).toBe(false);

    // A copy sharing the regions list, as each diary tier's copy does.
    const withGlider = { ...stranded, mobility: ['Gnome Gliders'] };
    expect(evaluateDiaryTaskEligibility(seaweed, withGlider, 'vanilla').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(seaweed, stranded, 'vanilla').eligible).toBe(false);

    // A list that grows in place is noticed too.
    stranded.mobility.push('Gnome Gliders');
    expect(evaluateDiaryTaskEligibility(seaweed, stranded, 'vanilla').eligible).toBe(true);
  });
});

describe('reaching an owned island or enclave for a diary task (Vanilla)', () => {
  it('does not count seaweed as doable when the Ship Yard is the only Karamja area owned', () => {
    const seaweed = task('kar_easy_8');
    const shipYardOnly = account({ regions: ['Ship Yard'] });
    const result = evaluateDiaryTaskEligibility(seaweed, shipYardOnly, 'vanilla');

    expect(result).toMatchObject({ eligible: false, machineEligible: false });
    const choice = result.blockers.find(blocker => blocker.kind === 'alternative');
    expect(choice?.label).toBe(seaweed.anyOfRegions!.join(' or '));
    expect(choice?.kind === 'alternative' && choice.routes).toContainEqual(expect.objectContaining({
      label: 'Ship Yard: Gnome glider to Gandius from Ta Quir Priw, Sindarpos or Kar-Hewo',
      travel: 'Ship Yard',
      blockers: expect.arrayContaining([{ kind: 'mobility', label: 'Gnome Gliders' }]),
    }));
    expect(countDoableTasks([seaweed], shipYardOnly, 'vanilla')).toBe(0);
    expect(diaryTaskCompletionDecision(seaweed, shipYardOnly, 'vanilla', { manualConfirmed: true }).ok).toBe(false);

    const byGlider = account({
      regions: ['Ship Yard', 'Al Kharid'], mobility: ['Gnome Gliders'], quests: ['The Grand Tree'],
    });
    expect(evaluateDiaryTaskEligibility(seaweed, byGlider, 'vanilla').eligible).toBe(true);
    expect(diaryTaskCompletionDecision(seaweed, byGlider, 'vanilla').ok).toBe(true);
  });

  it('opens the Ship Yard by glider, charter ship or the DKP fairy ring', () => {
    const glider = task('kar_med_12');
    const noStation = account({ regions: ['Ship Yard'], mobility: ['Gnome Gliders'], quests: ['The Grand Tree'] });
    expect(evaluateDiaryTaskEligibility(glider, noStation, 'vanilla').blockers).toEqual([
      expect.objectContaining({ kind: 'alternative', label: 'Travel to Ship Yard', travel: 'Ship Yard' }),
    ]);
    for (const station of ['Tree Gnome Stronghold', 'Taverley', 'Al Kharid']) {
      const flying = { ...noStation, regions: ['Ship Yard', station] };
      expect(evaluateDiaryTaskEligibility(glider, flying, 'vanilla').eligible, station).toBe(true);
    }

    const charter = account({
      regions: ['Ship Yard', 'Port Khazard'], mobility: ['Charter Ships'], quests: ['The Grand Tree'],
    });
    const midQuest = evaluateDiaryTaskEligibility(task('kar_med_18'), charter, 'vanilla');
    expect(midQuest).toMatchObject({ machineEligible: true, eligible: false });
    expect(midQuest.manualChecks).toContain('Completed the Shipyard part of Monkey Madness I, which opens its charter dock');
    const afterQuest = { ...charter, quests: ['The Grand Tree', 'Monkey Madness I'] };
    expect(evaluateDiaryTaskEligibility(task('kar_med_18'), afterQuest, 'vanilla').eligible).toBe(true);

    // The DKP path crosses jungle that belongs to Karamja as a whole.
    const fairyRing = account({
      regions: [...REGION_GROUPS.Karamja], mobility: ['Fairy Rings', 'Gnome Gliders'],
      quests: ['The Grand Tree', 'Fairytale II - Cure a Queen'], diaries: ['Lumbridge Elite'],
    });
    expect(evaluateDiaryTaskEligibility(glider, fairyRing, 'vanilla').eligible).toBe(true);
    const missingShilo = { ...fairyRing, regions: REGION_GROUPS.Karamja.filter(area => area !== 'Shilo Village') };
    const blocked = evaluateDiaryTaskEligibility(glider, missingShilo, 'vanilla').blockers[0];
    expect(blocked.kind === 'alternative' && blocked.routes.find(route => route.label.startsWith('Fairy ring DKP'))?.blockers)
      .toEqual([{ kind: 'region', label: 'Shilo Village' }]);
  });

  it('needs a way into the Forgotten Cemetery before an Ankou counts as doable', () => {
    const ankou = task('wilderness_med_6');
    const cemeteryOnly = account({ regions: ['Forgotten Cemetery'] });
    const result = evaluateDiaryTaskEligibility(ankou, cemeteryOnly, 'vanilla');

    expect(result).toMatchObject({ eligible: false, machineEligible: false, evidence: [] });
    expect(result.blockers).toEqual([{
      kind: 'alternative',
      label: 'Travel to Forgotten Cemetery',
      travel: 'Forgotten Cemetery',
      blockerKinds: ['arcana', 'skill', 'region'],
      routes: [
        {
          label: 'Cemetery Teleport (Arceuus spell or tablet)',
          travel: 'Forgotten Cemetery',
          blockers: [
            { kind: 'arcana', label: 'Arceuus Spellbook' },
            { kind: 'skill', label: 'Magic 71', requirement: { type: 'single', skill: 'Magic', level: 71 } },
          ],
        },
        { label: 'Walk in from Chaos Altar', travel: 'Forgotten Cemetery', blockers: [{ kind: 'region', label: 'Chaos Altar' }] },
        {
          label: 'Walk in from the Wilderness Bandit Camp',
          travel: 'Forgotten Cemetery',
          blockers: [{ kind: 'region', label: 'Wilderness Bandit Camp' }],
        },
      ],
    }]);
    expect(diaryTaskCompletionDecision(ankou, cemeteryOnly, 'vanilla', { manualConfirmed: true })).toEqual({
      ok: false, reason: 'Requires: Travel to Forgotten Cemetery',
    });

    for (const unlocked of [
      { arcana: ['Arceuus Spellbook'], skills: { Magic: 8 }, levels: { Magic: 71 } },
      { regions: ['Forgotten Cemetery', 'Chaos Altar'] },
      { regions: ['Forgotten Cemetery', 'Wilderness Bandit Camp'] },
    ]) {
      const reachable = { ...cemeteryOnly, ...unlocked };
      expect(evaluateDiaryTaskEligibility(ankou, reachable, 'vanilla').eligible, JSON.stringify(unlocked)).toBe(true);
    }
  });

  it('asks to confirm a Pest control teleport scroll when no other way reaches the Void Knights\' Outpost', () => {
    const pestControl = task('west_easy_2');
    const outpostOnly = account({ regions: ["Void Knights' Outpost"], minigames: ['Pest Control'], levels: combat46 });
    const scroll = "Reach Void Knights' Outpost with a Pest control teleport scroll (a Treasure Trails reward)";

    expect(evaluateDiaryTaskEligibility(pestControl, outpostOnly, 'vanilla')).toMatchObject({
      eligible: false, machineEligible: true, confirmable: true, blockers: [], manualChecks: [scroll],
    });
    expect(countDoableTasks([pestControl], outpostOnly, 'vanilla')).toBe(0);
    expect(diaryTaskCompletionDecision(pestControl, outpostOnly, 'vanilla')).toEqual({ ok: false, reason: `Confirm: ${scroll}` });
    expect(diaryTaskCompletionDecision(pestControl, outpostOnly, 'vanilla', { manualConfirmed: true })).toEqual({ ok: true });

    // The scroll is a clue reward, never a Mobility unlock.
    const scrollRoute = AREA_ENTRY_ROUTES["Void Knights' Outpost"].find(route => route.label === 'Pest control teleport scroll')!;
    expect(scrollRoute).toEqual(expect.objectContaining({ manualRequirements: [scroll] }));
    expect(scrollRoute.mobility).toBeUndefined();

    for (const unlocked of [
      { regions: ["Void Knights' Outpost", 'Port Sarim'] },
      { mobility: ['Minigame Teleports'] },
      { skills: { Sailing: 5 }, levels: { ...combat46, Sailing: 50 }, quests: ['Pandemonium'] },
    ]) {
      const reachable = { ...outpostOnly, ...unlocked };
      expect(evaluateDiaryTaskEligibility(pestControl, reachable, 'vanilla').eligible, JSON.stringify(unlocked)).toBe(true);
    }
    const lowSailing = { ...outpostOnly, skills: { Sailing: 5 }, levels: { ...combat46, Sailing: 49 }, quests: ['Pandemonium'] };
    expect(evaluateDiaryTaskEligibility(pestControl, lowSailing, 'vanilla').eligible).toBe(false);
  });

  it('reaches Harmony Island through a reachable Mos Le\'Harmless', () => {
    const watermelon = task('mor_hard_3');
    const islands = account({
      regions: ['Harmony Island', "Mos Le'Harmless"], quests: ['The Great Brain Robbery'],
      skills: { Farming: 5 }, levels: { Farming: 47 },
    });
    const blocked = evaluateDiaryTaskEligibility(watermelon, islands, 'vanilla').blockers;
    expect(blocked).toEqual([expect.objectContaining({ label: 'Travel to Harmony Island' })]);
    expect(blocked[0].kind === 'alternative' && blocked[0].routes.map(route => route.label)).toContain(
      "Brother Tranquility's boat from Mos Le'Harmless, via Bill Teach's ship from Port Phasmatys",
    );

    // After Cabin Fever a Mos le'harmless teleport scroll will do, once confirmed.
    const afterCabinFever = { ...islands, quests: ['The Great Brain Robbery', 'Cabin Fever'] };
    expect(evaluateDiaryTaskEligibility(watermelon, afterCabinFever, 'vanilla')).toMatchObject({
      eligible: false, machineEligible: true,
      manualChecks: ["Reach Mos Le'Harmless with a Mos le'harmless teleport scroll (a Treasure Trails reward)"],
    });
    const viaPortPhasmatys = { ...afterCabinFever, regions: [...islands.regions, 'Port Phasmatys'] };
    expect(evaluateDiaryTaskEligibility(watermelon, viaPortPhasmatys, 'vanilla').eligible).toBe(true);
  });
});

describe('diary surfaces for a travel block', () => {
  const cemeteryLeft = account({
    regions: ['Forgotten Cemetery'],
    completedTasks: tierTasksExcept('Wilderness Medium', 'wilderness_med_6'),
  });

  it('reports the tier as area-locked rather than quest-locked', () => {
    expect(getDiaryStatus(DIARY_DATA['Wilderness Medium'], cemeteryLeft, 'vanilla')).toBe('LOCKED_REGION');
    const withChaosAltar = { ...cemeteryLeft, regions: ['Forgotten Cemetery', 'Chaos Altar'] };
    expect(getDiaryStatus(DIARY_DATA['Wilderness Medium'], withChaosAltar, 'vanilla')).toBe('AVAILABLE');
  });

  it('names the trip in Next Best', () => {
    expect(diaryUnmet(DIARY_DATA['Wilderness Medium'], cemeteryLeft, 'vanilla')).toEqual([
      { kind: 'alternative', label: 'Travel to Forgotten Cemetery' },
    ]);
  });

  it('plans the transport unlocks that reach the island', () => {
    const cemeteryPlan = planForTarget('diary', 'Wilderness Medium', cemeteryLeft, 'vanilla')!;
    expect(cemeteryPlan.alternativeSteps).toEqual([expect.objectContaining({
      label: 'One of: Travel to Forgotten Cemetery',
      routes: expect.arrayContaining([
        expect.objectContaining({
          label: 'Cemetery Teleport (Arceuus spell or tablet)',
          blockers: expect.arrayContaining([
            expect.objectContaining({ kind: 'arcana', id: 'Arceuus Spellbook', unlockTable: TableType.ARCANA }),
          ]),
        }),
        { label: 'Walk in from Chaos Altar', blockers: [expect.objectContaining({ id: 'Chaos Altar', unlockTable: TableType.REGIONS })] },
      ]),
    })]);

    const shipYardLeft = account({
      regions: ['Ship Yard'],
      completedTasks: tierTasksExcept('Karamja Medium', 'kar_med_12'),
    });
    const glider = planForTarget('diary', 'Karamja Medium', shipYardLeft, 'vanilla')!.alternativeSteps
      .find(step => step.label === 'One of: Travel to Ship Yard')!
      .routes.find(route => route.label === 'Gnome glider to Gandius from Ta Quir Priw, Sindarpos or Kar-Hewo')!;
    expect(glider.blockers).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'mobility', id: 'Gnome Gliders', unlockTable: TableType.MOBILITY }),
      expect.objectContaining({
        kind: 'region', label: 'Any of: Tree Gnome Stronghold, Taverley, Al Kharid',
        unlockTable: TableType.REGIONS, relatedIds: ['Tree Gnome Stronghold', 'Taverley', 'Al Kharid'],
      }),
    ]));
  });

  it('lets the Areas advisor credit a departure area', () => {
    // Chaos Altar opens nothing else here, so only its role as the
    // cemetery's walking approach can put it forward.
    const chaosAltar = rankLockedRegions(cemeteryLeft, 'vanilla').find(area => area.id === 'Chaos Altar');
    expect(chaosAltar?.newDiaryIds).toEqual(['Wilderness Medium']);
    expect(areaEntryDependencies("Void Knights' Outpost").areas).toContain('Port Sarim');
    expect(areaEntryDependencies('Harmony Island').areas).toEqual(expect.arrayContaining(["Mos Le'Harmless", 'Port Phasmatys']));
    expect(areaEntryDependencies('Gandius').chunks).toEqual([{ cx: 45, cy: 47 }]);
  });
});

describe('what travel checks leave alone', () => {
  it('keeps ownership, map tint and the Areas roll pool as they were', () => {
    const shipYardOnly = account({ regions: ['Ship Yard'] });
    expect(isAreaReachable('Ship Yard', shipYardOnly, 'vanilla')).toBe(true);
    expect(chunkUnlocked(46, 47, shipYardOnly, 'vanilla')).toBe(true);
    expect(isValidUnlock(TableType.REGIONS, 'Ship Yard', shipYardOnly)).toBe(false);

    const fresh = account();
    const pool = randomUnlockPool(fresh, 'vanilla', 'key', TableType.REGIONS).map(candidate => candidate.item);
    for (const area of Object.keys(AREA_ENTRY_ROUTES)) {
      expect(isValidUnlock(TableType.REGIONS, area, fresh), area).toBe(true);
      expect(pool, area).toContain(area);
    }
  });

  it('leaves Chunked mode to its own chunk reach', () => {
    const cemeteryChunk = account({ chunks: ['46,58'] } as Partial<UnlockState>);
    expect(evaluateDiaryTaskEligibility(task('wilderness_med_6'), cemeteryChunk, 'chunked').eligible).toBe(true);
    expect(evaluateDiaryTaskEligibility(task('wilderness_med_6'), account({ regions: ['Forgotten Cemetery'] }), 'vanilla').eligible)
      .toBe(false);
  });
});

/** The unlocks that meet a route's machine-checked requirements. */
const satisfying = (area: string, route: AreaEntryRoute): Partial<UnlockState> => {
  const regions = new Set<string>([area, ...(route.regions ?? []), ...(route.anyOfRegions ?? []).slice(0, 1)]);
  const quests = new Set<string>([...(route.quests ?? []), ...(route.questProgress ?? []).map(step => step.quest)]);
  const mobility = new Set(route.mobility ?? []);
  const arcana = new Set(route.arcana ?? []);
  const diaries = new Set<string>();
  const skills: Record<string, number> = {};
  const levels: Record<string, number> = { Attack: 99, Strength: 99, Defence: 99, Hitpoints: 99 };
  const equipment: Record<string, number> = {};
  for (const [skill, level] of Object.entries(route.skills ?? {})) {
    skills[skill] = 10;
    levels[skill] = level;
  }
  for (const item of route.equipmentRequirements ?? []) {
    equipment[item.slot] = item.tier;
    if (item.unlessDiary) diaries.add(item.unlessDiary);
  }
  for (const location of route.locations ?? []) {
    const { region } = placeOf(location.chunkOptions[0].cx, location.chunkOptions[0].cy);
    for (const child of REGION_GROUPS[region!] ?? [region!]) regions.add(child);
  }
  // A departure island needs its own first route too.
  for (const departure of route.regions ?? []) {
    const onward = AREA_ENTRY_ROUTES[departure]?.[0];
    if (!onward) continue;
    const more = satisfying(departure, onward);
    for (const value of more.regions ?? []) regions.add(value);
    for (const value of more.quests ?? []) quests.add(value);
    for (const value of more.mobility ?? []) mobility.add(value);
    for (const value of more.arcana ?? []) arcana.add(value);
    Object.assign(skills, more.skills);
    Object.assign(levels, more.levels);
  }
  return {
    regions: [...regions], quests: [...quests], mobility: [...mobility], arcana: [...arcana],
    diaries: [...diaries], skills, levels, equipment,
  };
};

describe('the reviewed entry routes', () => {
  const areas = Object.keys(AREA_ENTRY_ROUTES);

  it.each(areas)('%s is out of reach on ownership alone and each route reaches it', area => {
    const probe = { id: `access:${area}`, regions: [area] };
    const ownedOnly = evaluateDiaryTaskEligibility(probe, account({ regions: [area] }), 'vanilla');
    expect(ownedOnly.eligible).toBe(false);

    for (const route of AREA_ENTRY_ROUTES[area]) {
      const result = evaluateDiaryTaskEligibility(probe, account(satisfying(area, route)), 'vanilla');
      expect(result.machineEligible, route.label).toBe(true);
      const allowedChecks = [
        ...(route.manualRequirements ?? []),
        ...(route.equipmentRequirements ?? []).flatMap(item => item.manualCheck && !item.unlessDiary ? [item.manualCheck] : []),
      ];
      expect(result.manualChecks.every(check => allowedChecks.includes(check)), route.label).toBe(true);
      if (allowedChecks.length === 0) expect(result.eligible, route.label).toBe(true);
    }
  });

  it('names only real areas, unlocks, quests and skills, and cites a pinned wiki revision', () => {
    for (const [area, routes] of Object.entries(AREA_ENTRY_ROUTES)) {
      expect(REGIONS_LIST, area).toContain(area);
      expect(canonicalAreaName(area), area).toBe(area);
      expect(routes.length, area).toBeGreaterThan(0);
      expect(new Set(routes.map(route => route.label)).size, area).toBe(routes.length);
      for (const route of routes) {
        const where = `${area}: ${route.label}`;
        expect(route.source, where).toMatch(/^https:\/\/oldschool\.runescape\.wiki\/w\/[^?#\s]+\?oldid=\d+$/);
        for (const name of [...(route.regions ?? []), ...(route.anyOfRegions ?? [])]) {
          expect(REGIONS_LIST, where).toContain(name);
          expect(canonicalAreaName(name), where).toBe(name);
        }
        for (const name of route.mobility ?? []) expect(MOBILITY_LIST, where).toContain(name);
        for (const name of route.arcana ?? []) expect(ARCANA_LIST, where).toContain(name);
        for (const quest of [...(route.quests ?? []), ...(route.questProgress ?? []).map(step => step.quest)]) {
          expect(QUEST_DATA[quest], `${where}: ${quest}`).toBeDefined();
        }
        for (const skill of Object.keys(route.skills ?? {})) expect(SKILLS_LIST, where).toContain(skill);
        for (const item of route.equipmentRequirements ?? []) expect(EQUIPMENT_SLOTS, where).toContain(item.slot);
        for (const location of route.locations ?? []) {
          for (const { cx, cy } of location.chunkOptions) expect(placeOf(cx, cy).region, where).not.toBeNull();
        }
      }
    }
  });

  it('never loops: departure choices have no routes of their own and no island depends on itself', () => {
    const dependsOn = (area: string): string[] => AREA_ENTRY_ROUTES[area].flatMap(route => route.regions ?? [])
      .filter(name => AREA_ENTRY_ROUTES[name]);
    for (const [area, routes] of Object.entries(AREA_ENTRY_ROUTES)) {
      for (const route of routes) {
        for (const departure of route.anyOfRegions ?? []) {
          expect(AREA_ENTRY_ROUTES[departure], `${area}: ${route.label} sets off from ${departure}`).toBeUndefined();
        }
      }
    }
    const finished = new Set<string>();
    const visit = (area: string, path: string[]) => {
      expect(path, `cycle through ${[...path, area].join(' -> ')}`).not.toContain(area);
      if (finished.has(area)) return;
      for (const next of dependsOn(area)) visit(next, [...path, area]);
      finished.add(area);
    };
    for (const area of areas) visit(area, []);
  });

  it('covers only areas diary tasks need, and never an area a diary location chunk lies in', () => {
    const named = new Set(ALL_DIARY_TASKS.flatMap(row => [
      ...(row.regions ?? []), ...(row.anyOfRegions ?? []),
      ...(row.oneOf ?? []).flatMap(option => option.regions ?? []),
    ]).map(canonicalAreaName));
    for (const area of areas) expect(named, area).toContain(area);

    // Travel checks read named areas; a location chunk would bypass them.
    for (const row of ALL_DIARY_TASKS) {
      for (const option of [row, ...(row.oneOf ?? [])]) {
        for (const location of option.locations ?? []) {
          for (const { cx, cy } of location.chunkOptions) {
            expect(areas, `${row.id} ${location.label}`).not.toContain(placeOf(cx, cy).subArea);
          }
        }
      }
    }
  });
});
