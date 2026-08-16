import { describe, expect, it } from 'vitest';
import { SKILLS_LIST } from '../constants';
import { questLogEligibility } from '../components/QuestLog';
import {
  journalNextBestQuestAction, selectJournalNextBestActions,
} from '../components/JournalNextBest';
import { QUEST_DATA } from './questData';
import { DIARY_DATA } from './diaryData';
import { ALL_DIARY_TASKS } from './diaryTasks';
import { ALL_CA_TASKS } from './caTasks';
import { CA_DATA } from './caData';
import { CHANGELOG_RELEASES } from './changelog';
import diarySource from './sources/achievement-diary-tasks.json';
import caSource from './sources/combat-achievement-tasks.json';
import legacyDiaryIds from './sources/achievement-diary-legacy-ids.json';
import chunkSource from './sources/chunk-content-source.json';
import chunkAudit from './sources/chunk-content-transform-audit.json';
import fullChunkContent from '../public/chunk-content.json';
import { AREA_ALIAS_POLICIES, canonicalizeAreaUnlocks } from './areaMapPolicy';
import { SUB_AREA_CHUNKS } from './subAreaChunks';
import { rankAvailableQuests } from '../utils/questAdvisor';
import { planForTarget } from '../utils/goalPlanner';
import { questCompletionDecision } from '../utils/journalCompletion';
import { prepareUnlockImpactContext } from '../utils/unlockImpact';
import { CA_TASK_POINTS, CA_TIER_ORDER } from '../utils/caProgress';
import { DIARY_TASK_ID_MIGRATIONS } from '../utils/taskIdMigrations';

const maxedChunkedUnlocks = (chunks: string[]) => ({
  equipment: {},
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions: [],
  chunks,
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
});

const porcineOnlyUnlocks = (chunks: string[]) => ({
  ...maxedChunkedUnlocks(chunks),
  quests: Object.keys(QUEST_DATA).filter(id => id !== 'A Porcine of Interest'),
  diaries: Object.keys(DIARY_DATA),
});

const maxedQuestUnlocks = (
  targetId: string,
  overrides: Record<string, unknown> = {},
) => ({
  ...maxedChunkedUnlocks([]),
  quests: Object.keys(QUEST_DATA).filter(id => id !== targetId),
  diaries: Object.keys(DIARY_DATA),
  ...overrides,
});

const crossSurfaceReadiness = (
  id: string,
  unlocks: ReturnType<typeof maxedQuestUnlocks>,
  gameModeId?: string,
) => {
  const quest = QUEST_DATA[id];
  const questLog = questLogEligibility(quest, unlocks, gameModeId);
  const impact = prepareUnlockImpactContext(unlocks, gameModeId);
  const advisorAvailable = rankAvailableQuests(unlocks, gameModeId)
    .some(candidate => candidate.id === quest.id);
  const plan = planForTarget('quest', quest.id, unlocks, gameModeId)!;
  const nextBest = journalNextBestQuestAction(quest, unlocks, gameModeId)!;
  const completion = questCompletionDecision(quest, unlocks, gameModeId);
  const label = (ready: boolean) => ready ? 'READY' : 'BLOCKED';

  return {
    machineStatuses: [
      questLog.status,
      impact.questStatusById.get(quest.id),
    ],
    finalReadiness: [
      label(questLog.eligible),
      label(advisorAvailable),
      label(plan.alreadyReachable),
      label(nextBest.unmet === 0),
      label(completion.ok),
      label(impact.baseAvailableIds.has(quest.id)),
    ],
    firstBlocker: nextBest.firstBlocker,
  };
};

const questRequirementFields = (id: string) => {
  const quest = QUEST_DATA[id];
  return {
    regions: quest.regions,
    locations: quest.locations?.map(location => location.id),
    skills: quest.skills,
    combatLevel: quest.combatLevel,
    prereqs: quest.prereqs,
    oneOf: quest.oneOf,
    manualRequirements: quest.manualRequirements,
  };
};

describe('cross-surface quest eligibility contract', () => {
  it.each([
    {
      label: "Witch's Potion before Rimmington",
      id: "Witch's Potion",
      gameModeId: 'chunked',
      unlocks: maxedQuestUnlocks("Witch's Potion", { chunks: [] }),
      expectedStatus: 'LOCKED_REGION',
      expectedReadiness: 'BLOCKED',
      firstBlocker: 'Rimmington',
    },
    {
      label: "Witch's Potion after Rimmington",
      id: "Witch's Potion",
      gameModeId: 'chunked',
      unlocks: maxedQuestUnlocks("Witch's Potion", { chunks: ['46,50'] }),
      expectedStatus: 'AVAILABLE',
      expectedReadiness: 'READY',
      firstBlocker: undefined,
    },
    {
      label: 'Murder Mystery before Sinclair Mansion',
      id: 'Murder Mystery',
      gameModeId: 'chunked',
      unlocks: maxedQuestUnlocks('Murder Mystery', { chunks: [] }),
      expectedStatus: 'LOCKED_REGION',
      expectedReadiness: 'BLOCKED',
      firstBlocker: 'Sinclair Mansion',
    },
    {
      label: "Murder Mystery after Sinclair Mansion but before Seers' Village",
      id: 'Murder Mystery',
      gameModeId: 'chunked',
      unlocks: maxedQuestUnlocks('Murder Mystery', { chunks: ['42,55'] }),
      expectedStatus: 'LOCKED_REGION',
      expectedReadiness: 'BLOCKED',
      firstBlocker: "Seers' Village",
    },
    {
      label: "Murder Mystery after Sinclair Mansion and Seers' Village",
      id: 'Murder Mystery',
      gameModeId: 'chunked',
      unlocks: maxedQuestUnlocks('Murder Mystery', { chunks: ['42,55', '42,54'] }),
      expectedStatus: 'AVAILABLE',
      expectedReadiness: 'READY',
      firstBlocker: undefined,
    },
    {
      label: 'A Porcine of Interest before South Falador Farm',
      id: 'A Porcine of Interest',
      gameModeId: 'chunked',
      unlocks: porcineOnlyUnlocks(['48,50']),
      expectedStatus: 'LOCKED_REGION',
      expectedReadiness: 'BLOCKED',
      firstBlocker: 'South Falador Farm',
    },
    {
      label: 'A Porcine of Interest after both audited locations',
      id: 'A Porcine of Interest',
      gameModeId: 'chunked',
      unlocks: porcineOnlyUnlocks(['48,50', '47,51']),
      expectedStatus: 'AVAILABLE',
      expectedReadiness: 'READY',
      firstBlocker: undefined,
    },
    {
      label: 'Mountain Daughter before either alternative route',
      id: 'Mountain Daughter',
      gameModeId: undefined,
      unlocks: maxedQuestUnlocks('Mountain Daughter', { regions: ['Fremennik'] }),
      expectedStatus: 'LOCKED_REGION',
      expectedReadiness: 'BLOCKED',
      firstBlocker: 'Asgarnia or Kandarin',
    },
    {
      label: 'Mountain Daughter after the Asgarnia alternative route',
      id: 'Mountain Daughter',
      gameModeId: undefined,
      unlocks: maxedQuestUnlocks('Mountain Daughter', {
        regions: ['Fremennik', 'Asgarnia'],
      }),
      expectedStatus: 'AVAILABLE',
      expectedReadiness: 'READY',
      firstBlocker: undefined,
    },
    {
      label: 'The Frozen Door before its prerequisite',
      id: 'The Frozen Door',
      gameModeId: undefined,
      unlocks: maxedQuestUnlocks('The Frozen Door', {
        regions: ['Asgarnia'],
        quests: Object.keys(QUEST_DATA).filter(
          id => id !== 'The Frozen Door' && id !== 'Desert Treasure I',
        ),
      }),
      expectedStatus: 'LOCKED_QUEST',
      expectedReadiness: 'BLOCKED',
      firstBlocker: 'Desert Treasure I',
    },
    {
      label: 'The Frozen Door after its prerequisite',
      id: 'The Frozen Door',
      gameModeId: undefined,
      unlocks: maxedQuestUnlocks('The Frozen Door', { regions: ['Asgarnia'] }),
      expectedStatus: 'AVAILABLE',
      expectedReadiness: 'READY',
      firstBlocker: undefined,
    },
  ] as const)(
    'keeps $label consistent across every quest consumer',
    ({
      id, unlocks, gameModeId, expectedStatus, expectedReadiness, firstBlocker,
    }) => {
      const actual = crossSurfaceReadiness(id, unlocks, gameModeId);

      expect(actual.machineStatuses).toEqual(
        Array(2).fill(expectedStatus),
      );
      expect(actual.finalReadiness).toEqual(
        Array(6).fill(expectedReadiness),
      );
      expect(actual.firstBlocker).toBe(firstBlocker);
    },
  );

  it('keeps a machine-ready manual quest pending on every completion surface', () => {
    const unlocks = maxedQuestUnlocks('The Slug Menace', {
      regions: ['Kandarin', 'Asgarnia'],
    });
    const actual = crossSurfaceReadiness('The Slug Menace', unlocks);

    expect(actual.machineStatuses).toEqual(['AVAILABLE', 'AVAILABLE']);
    expect(actual.finalReadiness).toEqual(Array(6).fill('BLOCKED'));
    expect(actual.firstBlocker).toMatch(/^Confirm: Access to all required elemental altars/);
  });

  it.each([
    porcineOnlyUnlocks(['48,50']),
    porcineOnlyUnlocks(['48,50', '47,51']),
  ])('keeps the actual Next Best selector focused on the only incomplete quest', unlocks => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    const selected = selectJournalNextBestActions(unlocks, 'chunked');

    expect(selected).toEqual([
      journalNextBestQuestAction(quest, unlocks, 'chunked'),
    ]);
  });
});
describe('deterministic current content baseline', () => {
  it('pins the reviewed Chunk Picker source and complete transform totals', () => {
    expect(chunkSource).toMatchObject({
      schemaVersion: 1,
      repository: 'source-chunk/chunk-picker-v2',
      branch: 'gh-pages',
      commit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
      blobSha: 'ffdcc10139dde0e11be29047c6c730fd762a33c8',
      rawSha256: '2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59',
      rawBytes: 7518778,
      policyVersion: 2,
      reviewedAt: '2026-08-16',
    });
    const generatedChunkContent = fullChunkContent as typeof fullChunkContent & {
      entrances?: Record<string, Array<{ location: string; label: string }>>;
    };
    expect(generatedChunkContent.sourceMeta).toEqual({
      repository: 'source-chunk/chunk-picker-v2',
      commit: 'a9a5c74760eb76dbe39f90d2b04f023fc1de3746',
      blobSha: 'ffdcc10139dde0e11be29047c6c730fd762a33c8',
      rawSha256: '2D75BF70C9E6540CECC1631783A0293D8F28B440D429F6081B2CD4EE4C21CA59',
      policyVersion: 2,
      namedLocationPolicyVersion: 1,
      namedLocationReviewedAt: '2026-08-03',
    });
    const events = (chunkAudit as { events: Array<{ category: string; disposition: string }> }).events;
    const taskUnlockTotals = (chunkAudit as {
      categoryTotals: {
        taskUnlocks: {
          source: number;
          imported: number;
          normalized: number;
          excluded: number;
          unresolved: number;
        };
      };
    }).categoryTotals.taskUnlocks;
    expect({
      contentChunks: Object.keys(fullChunkContent.chunks).length,
      connections: Object.keys(fullChunkContent.connect).length,
      slayerMasters: Object.keys(fullChunkContent.slayerMasters).length,
      shortcuts: fullChunkContent.shortcuts.length,
      shops: Object.keys(fullChunkContent.shopItems).length,
      dropTables: Object.keys(fullChunkContent.drops).length,
      questSections: Object.keys(fullChunkContent.questSections).length,
      banks: fullChunkContent.banks.length,
      tags: Object.keys(fullChunkContent.tags).length,
      auditEvents: events.length,
      unresolvedTaskUnlocks: events.filter(
        (event) => event.category === 'taskUnlocks' && event.disposition === 'unresolved',
      ).length,
    }).toEqual({
      contentChunks: 938,
      connections: 1110,
      slayerMasters: 10,
      shortcuts: 219,
      shops: 435,
      dropTables: 800,
      questSections: 134,
      banks: 126,
      tags: 27,
      auditEvents: 27110,
      unresolvedTaskUnlocks: 0,
    });
    expect(taskUnlockTotals.source).toBe(1675);
    expect(taskUnlockTotals.unresolved).toBe(0);
    expect(taskUnlockTotals.imported + taskUnlockTotals.normalized + taskUnlockTotals.excluded)
      .toBe(1675);
    expect(taskUnlockTotals).toEqual({
      source: 1675,
      imported: 1014,
      normalized: 657,
      excluded: 4,
      unresolved: 0,
    });
    const reviewedBankIds = [
      '5678', '6454', '6458', '6711', '6712', '6961', '7225', '8499',
      '8508', '8751', '8756', '8757', '8999', '9274', '10553', '11047',
      '11056', '11062', '11572', '11578', '12082', '12337', '12838',
      '12849', '14132',
    ];
    expect(fullChunkContent.banks).toEqual(expect.arrayContaining(reviewedBankIds));
    expect(fullChunkContent.version).toBe(9);
    expect(Object.keys(generatedChunkContent.entrances ?? {})).toHaveLength(44);
    expect(Object.values(generatedChunkContent.entrances ?? {}).flat()).toHaveLength(54);
    expect((chunkAudit as { unclassified?: unknown[] }).unclassified ?? []).toEqual([]);
  });

  it('keeps generated entrances unique and Otto\'s Grotto in Baxtorian Falls\' single physical unlock', () => {
    const entranceIndex: Record<string, Array<{ location: string; label: string }>> =
      (fullChunkContent as typeof fullChunkContent & {
        entrances?: Record<string, Array<{ location: string; label: string }>>;
      }).entrances ?? {};
    for (const [chunkId, entrances] of Object.entries(entranceIndex)) {
      const pairs = entrances.map(({ location, label }) => JSON.stringify([location, label]));
      expect(new Set(pairs).size, chunkId).toBe(pairs.length);
    }

    const ottoPolicy = AREA_ALIAS_POLICIES["Otto's Grotto"];
    expect(ottoPolicy).toEqual({
      kind: 'surface-overlap',
      canonical: 'Baxtorian Falls',
      chunks: [{ cx: 39, cy: 54 }],
    });
    const ottoChunkIds = ottoPolicy.chunks.map(({ cx, cy }) => String(cx * 256 + cy));
    expect(ottoChunkIds).toEqual(['10038']);
    expect(SUB_AREA_CHUNKS[ottoPolicy.canonical]
      .filter(({ cx, cy }) => ottoChunkIds.includes(String(cx * 256 + cy))))
      .toEqual(ottoPolicy.chunks);
    expect(Object.keys(fullChunkContent.chunks)
      .filter(chunkId => ottoChunkIds.includes(chunkId))).toEqual(ottoChunkIds);
    expect(canonicalizeAreaUnlocks(["Otto's Grotto", 'Baxtorian Falls'])).toEqual({
      regions: ['Baxtorian Falls'],
      duplicateAliasRefunds: 1,
      migrated: true,
    });
  });

  it('contains the refreshed reviewed Sailing-era data', () => {
    expect(fullChunkContent.drops['Maggot King']).toContain('Adamantite ore');
    expect(fullChunkContent.drops['Maggot King']).toContain('Brimstone key');
    expect(fullChunkContent.skillItems.Crafting['Tarnished 2h sword loot'])
      .toEqual([
        ['Adamant 2h sword', '4/10'],
        ['Mithril 2h sword', '1/10'],
        ['Rune 2h sword', '5/10'],
      ]);
    expect(fullChunkContent.skillItems.Slayer['Shellbane gryphon']
      .some(([, rate]) => rate === '1/75')).toBe(true);
  });

  it('pins reviewed August Chunk Picker content sentinels', () => {
    expect(Object.keys(fullChunkContent.chunks)).toHaveLength(938);
    expect(fullChunkContent.shortcuts).toHaveLength(219);
    expect(Object.keys(fullChunkContent.drops)).toHaveLength(800);
    expect(fullChunkContent.chunks['7482']).toBeDefined();
    expect(fullChunkContent.drops['Vampyre Snail']).toBeDefined();
    expect(fullChunkContent.drops['Mad Angel']).toEqual(expect.arrayContaining([
      'Granite dust',
      'Hallowfell',
      'Ardeaglais teleport',
    ]));
  });

  it('pins first-class Quest Point and manual Diary requirements', () => {
    const varMediumGuild = ALL_DIARY_TASKS.find(({ id }) => id === 'var_med_2')!;
    const varHardKudos = ALL_DIARY_TASKS.find(({ id }) => id === 'var_hard_2')!;
    expect(varMediumGuild).toMatchObject({ questPoints: 32 });
    expect(varHardKudos).toMatchObject({
      manualRequirements: ['153 Varrock Museum Kudos'],
    });
    expect(varHardKudos.quests ?? []).not.toContain('Bone Voyage');
  });

  it('pins audited quest requirement fields with exact equality', () => {
    expect(questRequirementFields('A Porcine of Interest')).toEqual({
      regions: ['Misthalin', 'Asgarnia'],
      locations: ['draynor-village', 'south-falador-farm'],
      skills: {},
      combatLevel: undefined,
      prereqs: [],
      oneOf: undefined,
      manualRequirements: undefined,
    });
    expect(questRequirementFields('Dream Mentor')).toEqual({
      regions: ['Fremennik'], locations: undefined, skills: {}, combatLevel: 85,
      prereqs: ['Lunar Diplomacy', "Eadgar's Ruse"], oneOf: undefined,
      manualRequirements: undefined,
    });
    expect(questRequirementFields('Ethically Acquired Antiquities')).toEqual({
      regions: ['Varlamore', 'Asgarnia', 'Misthalin'],
      locations: ['grand-museum', 'fortis-cothon', 'port-sarim-jail', 'port-sarim-betty', 'varrock-museum'],
      skills: { Thieving: 25 }, combatLevel: undefined,
      prereqs: ['Children of the Sun', 'Shield of Arrav'], oneOf: undefined,
      manualRequirements: undefined,
    });
    expect(questRequirementFields('The Curse of Arrav')).toEqual({
      regions: ['Misthalin', 'Kharidian Desert', 'Fremennik'], locations: undefined,
      skills: {
        Agility: 61, Ranged: 62, Strength: 58, Thieving: 62, Mining: 64,
        Slayer: 37,
      },
      combatLevel: undefined, prereqs: ['Defender of Varrock', 'Troll Romance'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('The Final Dawn')).toEqual({
      regions: ['Varlamore'], locations: undefined,
      skills: { Thieving: 66, Fletching: 52, Runecraft: 52 },
      combatLevel: undefined, prereqs: ['The Heart of Darkness', 'Perilous Moons'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Shadows of Custodia')).toEqual({
      regions: ['Varlamore'], locations: undefined,
      skills: { Slayer: 54, Fishing: 45, Construction: 41, Hunter: 36 },
      combatLevel: undefined, prereqs: ['Children of the Sun'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Scrambled!')).toEqual({
      regions: ['Varlamore'], locations: ['tal-teklan-dock', 'tal-teok', 'tlati-rainforest'],
      skills: { Construction: 38, Cooking: 36, Smithing: 35 },
      combatLevel: undefined, prereqs: ['Children of the Sun'],
      oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Pandemonium')).toEqual({
      regions: [], locations: ['port-sarim'], skills: {}, combatLevel: undefined,
      prereqs: [], oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Prying Times')).toEqual({
      regions: ['The Open Seas'], locations: ['the-pandemonium', 'port-sarim-docks', 'thurgos-hut'],
      skills: { Smithing: 30, Sailing: 12 }, combatLevel: undefined,
      prereqs: ['Pandemonium', "The Knight's Sword"], oneOf: undefined,
      manualRequirements: ['One open Sailing task slot'],
    });
    expect(questRequirementFields('Current Affairs')).toEqual({
      regions: ['The Open Seas', 'Kandarin'], locations: undefined,
      skills: { Sailing: 22, Fishing: 10 }, combatLevel: undefined,
      prereqs: ['Pandemonium'], oneOf: undefined, manualRequirements: undefined,
    });
    expect(questRequirementFields('Troubled Tortugans')).toEqual({
      regions: ['The Open Seas'], locations: undefined,
      skills: {
        Slayer: 51, Construction: 48, Sailing: 45, Hunter: 45,
        Woodcutting: 40, Crafting: 34,
      },
      combatLevel: undefined, prereqs: ['Pandemonium'], oneOf: undefined,
      manualRequirements: undefined,
    });
  });

  it('pins 492 Diaries to the reviewed official source revision', () => {
    expect(ALL_DIARY_TASKS).toHaveLength(492);
    expect(new Set(ALL_DIARY_TASKS.map(task => task.id)).size).toBe(492);
    expect(diarySource).toMatchObject({
      verifiedAt: '2026-07-23',
      source: {
        url: 'https://oldschool.runescape.wiki/w/Achievement_Diary/All_achievements',
        revision: 15263582,
        revisionTimestamp: '2026-07-14T22:14:59Z',
        officialRows: 492,
      },
    });
    expect(diarySource.source.supportingPages).toHaveLength(12);
    expect(diarySource.source.supportingPages.every(page =>
      page.url.startsWith('https://oldschool.runescape.wiki/w/') &&
      page.revision > 0 &&
      /^2026-/.test(page.revisionTimestamp),
    )).toBe(true);
    expect(diarySource.tasks).toHaveLength(492);
  });

  it('describes only the game-data and save-integrity work that has landed', () => {
    const trackerRelease = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-23-tracker-accuracy',
    );
    expect(trackerRelease).toBeDefined();

    const wording = Object.values(trackerRelease!.sections)
      .flatMap(lines => lines ?? [])
      .join(' ');

    expect(wording).toContain('Draynor Village and South Falador Farm');
    expect(wording).toContain('Recent quest skill, combat, prerequisite, and access requirements were refreshed');
    expect(wording).toContain('492 current tasks');
    expect(wording).toContain('646 current tasks, including the Maggot King');
    expect(wording).toContain('cumulative points');
    expect(wording).toContain('Exports now capture the run currently visible on screen.');
    expect(wording).toContain('Malformed or oversized imports and backups are now rejected without overwriting progress.');
    expect(wording).toContain('File imports, sync-code imports, and backup restores now report their real outcomes.');
    expect(wording).toContain('Deleting a profile now also clears its local backups and profile-specific settings.');
    expect(wording).not.toMatch(/plugin|relay|balance/i);
  });

  it('publishes the reviewed quest and chunk audit without overstating its scope', () => {
    const auditRelease = CHANGELOG_RELEASES.find(
      release => release.id === '2026-07-28-quest-chunk-audit',
    );
    expect(auditRelease).toBeDefined();
    if (!auditRelease) return;
    const wording = Object.values(auditRelease.sections)
      .flatMap(lines => lines ?? [])
      .map(note => typeof note === 'string' ? note : note.text)
      .join(' ');

    expect(auditRelease.id).toBe('2026-07-28-quest-chunk-audit');
    expect(wording).toMatch(/Witch's Potion[^.]*Rimmington/i);
    expect(wording).toMatch(/Murder Mystery[^.]*Sinclair Mansion[^.]*Seers' Village/i);
    expect(wording).toMatch(/190 quests and 19 miniquests[^.]*reviewed requirement evidence/i);
    expect(wording).toMatch(/three[^.]*source discrepancies[^.]*documented[^.]*conservatively/i);
    expect(wording).toMatch(/Chunk Picker[^.]*pinned[^.]*deterministic/i);
    expect(wording).toMatch(/unmet machine requirements[^.]*manual confirmation/i);
    expect(wording).toMatch(/rejected and repeated completions[^.]*extra rolls/i);
    expect(wording).toMatch(/Learning the Ropes/i);
    expect(wording).toMatch(/The Blood Moon Rises/i);
    expect(wording).not.toMatch(/inventory tracking|completion override|key rates?|Fate Points?|pity|balance changes?/i);
  });

  it('pins 646 Combat Achievements, tier counts, thresholds, and provenance', () => {
    const tiers = ['Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster'] as const;
    expect(ALL_CA_TASKS).toHaveLength(646);
    expect(Object.fromEntries(tiers.map(tier => [
      tier,
      ALL_CA_TASKS.filter(task => task.tierId === tier).length,
    ]))).toEqual({
      Easy: 41,
      Medium: 60,
      Hard: 86,
      Elite: 164,
      Master: 173,
      Grandmaster: 122,
    });
    expect(tiers.map(tier => CA_DATA[tier].pointsRequired))
      .toEqual([41, 161, 419, 1075, 1940, 2672]);
    expect(caSource).toMatchObject({
      verifiedAt: '2026-08-16',
      source: {
        url: 'https://oldschool.runescape.wiki/w/Combat_Achievements',
        revision: 15296909,
        revisionTimestamp: '2026-08-13T09:19:38Z',
        officialRows: 646,
        authoritativeGlobals: {
          counts: {
            Easy: 41,
            Medium: 60,
            Hard: 86,
            Elite: 164,
            Master: 173,
            Grandmaster: 122,
          },
          thresholds: [41, 161, 419, 1075, 1940, 2672],
        },
      },
    });
    expect(caSource.source.tierSources).toHaveLength(6);
    expect(caSource.source.tierSources.reduce(
      (total, source) => total + source.officialRows,
      0,
    )).toBe(646);
    expect(caSource.source.tierSources.every(source =>
      source.url.startsWith('https://oldschool.runescape.wiki/w/') &&
      source.revision > 0 &&
      /^202[5-6]-/.test(source.revisionTimestamp),
    )).toBe(true);
    expect(caSource.tasks).toHaveLength(646);
  });
});

describe('independent generated-content contract', () => {
  it('classifies every historical Diary id exactly once', () => {
    const historicalIds = [
      ...diarySource.tasks
        .filter(task => task.classification === 'preserved-exact'
          || task.classification === 'preserved-semantic')
        .map(task => task.id),
      ...diarySource.tasks
        .filter(task => task.classification === 'renamed-or-replaced')
        .flatMap(task => task.aliases),
      ...diarySource.retired.map(task => task.id),
    ];

    expect(diarySource.classification).toEqual({
      existingRows: 485,
      preservedIds: 471,
      renamedOrReplacedAliases: 0,
      retiredExistingIds: 14,
      newCanonicalIds: 21,
      unresolvedExistingRows: 0,
      unresolvedDuplicateIds: 0,
      unknownReferences: 0,
      combatLevelRequirementsStructured: 9,
      allQuestsRequirementsStructured: 2,
    });
    expect(historicalIds).toHaveLength(485);
    expect(new Set(historicalIds).size).toBe(485);
    expect([...historicalIds].sort()).toEqual([...legacyDiaryIds.ids].sort());
    expect(legacyDiaryIds.source).toEqual({
      description: 'Exact Achievement Diary task IDs before the 492-task refresh.',
      commit: 'fe4654ffef34700422480c4e41c9a50a4dc92b55',
      file: 'data/diaryTasks.ts',
      rowCount: 485,
    });
  });

  it('keeps every reviewed Diary id and tier ordinal aligned with generated data', () => {
    const sourceIds = diarySource.tasks.map(task => task.id);
    const generatedIds = ALL_DIARY_TASKS.map(task => task.id);
    const tierOrdinals = diarySource.tasks.map(task => task.tierId + '|' + task.ordinal);

    expect(sourceIds).toHaveLength(492);
    expect(new Set(sourceIds).size).toBe(492);
    expect(new Set(tierOrdinals).size).toBe(492);
    expect([...generatedIds].sort()).toEqual([...sourceIds].sort());
    expect(diarySource.tasks.every(task => Object.hasOwn(DIARY_DATA, task.tierId))).toBe(true);
  });

  it('keeps every Diary migration source-supported with a current target', () => {
    const expectedMigrations = diarySource.tasks.flatMap(task =>
      task.aliases.map(alias => [alias, task.id] as const));
    const currentIds = new Set(ALL_DIARY_TASKS.map(task => task.id));
    const actualMigrations = Object.entries(DIARY_TASK_ID_MIGRATIONS);

    expect(actualMigrations.sort()).toEqual(expectedMigrations.sort());
    expect(actualMigrations.filter(([, target]) => !currentIds.has(target))).toEqual([]);
    expect(actualMigrations.filter(([source]) => currentIds.has(source))).toEqual([]);
  });

  it('pins official CA point values and the cumulative maximum independently', () => {
    expect(CA_TIER_ORDER).toEqual([
      'Easy', 'Medium', 'Hard', 'Elite', 'Master', 'Grandmaster',
    ]);
    expect(CA_TASK_POINTS).toEqual({
      Easy: 1, Medium: 2, Hard: 3, Elite: 4, Master: 5, Grandmaster: 6,
    });
    expect(CA_TIER_ORDER.map(tier => CA_DATA[tier].pointsRequired)).toEqual([
      41, 161, 419, 1075, 1940, 2672,
    ]);
    expect(ALL_CA_TASKS.reduce(
      (total, task) => total + CA_TASK_POINTS[task.tierId as keyof typeof CA_TASK_POINTS],
      0,
    )).toBe(2672);
  });

  it('keeps all 646 reviewed CA rows field-for-field aligned with generated data', () => {
    const generatedById = new Map(ALL_CA_TASKS.map(task => [task.id, task]));
    const mismatches = caSource.tasks.flatMap(sourceTask => {
      const generated = generatedById.get(sourceTask.id);
      return generated && JSON.stringify(generated) === JSON.stringify(sourceTask)
        ? []
        : [sourceTask.id];
    });

    expect(caSource.tasks).toHaveLength(646);
    expect(new Set(caSource.tasks.map(task => task.id)).size).toBe(646);
    expect(caSource.tasks.every(task => /^ca_\d+$/.test(task.id))).toBe(true);
    expect(generatedById.size).toBe(646);
    expect(mismatches, 'CA rows whose generated form differs from the snapshot').toEqual([]);
  });

  it('pins the nine Maggot King additions by stable official id', () => {
    const byId = new Map(ALL_CA_TASKS.map(task => [task.id, task]));

    expect(Array.from({ length: 9 }, (_, index) => {
      const task = byId.get('ca_' + (637 + index));
      return [task?.id, task?.tierId, task?.monster, task?.name];
    })).toEqual([
      ['ca_637', 'Hard', 'Maggot King', 'Maggot Squasher'],
      ['ca_638', 'Elite', 'Maggot King', 'Maggot Exterminator'],
      ['ca_639', 'Master', 'Maggot King', 'Camping the King'],
      ['ca_640', 'Grandmaster', 'Maggot King', 'Maggot King Speed Chaser'],
      ['ca_641', 'Elite', 'Maggot King', 'Trying to fit in'],
      ['ca_642', 'Master', 'Maggot King', 'King-sized clobbering'],
      ['ca_643', 'Master', 'Maggot King', 'Digging in'],
      ['ca_644', 'Master', 'Maggot King', 'Cordoned Off'],
      ['ca_645', 'Master', 'Maggot King', 'Perfect Maggot King'],
    ]);
  });

  it('pins every reviewed Diary supporting revision', () => {
    expect(diarySource.source.supportingPages.map(page => [
      page.title, page.revision, page.revisionTimestamp,
    ])).toEqual([
      ['Ardougne Diary', 15262389, '2026-07-13T10:58:32Z'],
      ['Desert Diary', 15212994, '2026-05-19T02:22:36Z'],
      ['Falador Diary', 15167531, '2026-04-07T04:42:10Z'],
      ['Fremennik Diary', 15267932, '2026-07-20T02:35:57Z'],
      ['Kandarin Diary', 15261093, '2026-07-11T16:12:48Z'],
      ['Karamja Diary', 15265693, '2026-07-16T23:30:13Z'],
      ['Kourend & Kebos Diary', 15203434, '2026-04-29T08:08:12Z'],
      ['Lumbridge & Draynor Diary', 15233767, '2026-06-15T03:19:28Z'],
      ['Morytania Diary', 15250417, '2026-07-03T17:00:45Z'],
      ['Varrock Diary', 15270202, '2026-07-20T15:17:53Z'],
      ['Western Provinces Diary', 15263014, '2026-07-14T11:17:53Z'],
      ['Wilderness Diary', 15270788, '2026-07-20T23:23:09Z'],
    ]);
  });

  it('pins the authoritative CA query and all six reviewed tier revisions', () => {
    expect(caSource.source).toMatchObject({
      endpoint: 'https://oldschool.runescape.wiki/api.php',
      taskTableQuery: {
        action: 'parse', page: 'Combat Achievements/<tier>', prop: 'text', format: 'json',
      },
      globalsQuery: {
        action: 'parse',
        text: '{{Globals|ca <tier> tasks}} and {{Globals|ca <tier> points}}',
        contentmodel: 'wikitext', prop: 'text', format: 'json',
      },
      retrievedAt: '2026-08-16T15:14:32.746Z',
      overviewDeclaredRows: 646,
    });
    expect(caSource.source.discrepancy).toBe(
      'The overview, authoritative Globals, and six tier task tables reconcile at 646 tasks; Maggot King Speed Chaser is Grandmaster.',
    );
    expect(caSource.source.tierSources.map(source => [
      source.tier, source.revision, source.revisionTimestamp, source.officialRows,
    ])).toEqual([
      ['Easy', 15272565, '2026-07-22T19:56:56Z', 41],
      ['Medium', 15135540, '2026-02-25T18:48:27Z', 60],
      ['Hard', 15272569, '2026-07-22T19:58:23Z', 86],
      ['Elite', 15272563, '2026-07-22T19:55:28Z', 164],
      ['Master', 15272564, '2026-07-22T19:55:46Z', 173],
      ['Grandmaster', 15025941, '2025-11-13T02:26:22Z', 122],
    ]);
  });
});
