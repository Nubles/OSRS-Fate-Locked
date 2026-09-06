import { describe, expect, it } from 'vitest';
import { authoredQuestChunkStatus } from '../utils/questDoability';
import { chunkReachability } from '../utils/chunkReach';
import { chunkUnlocked } from '../utils/chunkLocations';
import { evaluateQuestEligibility } from '../utils/journalStatus';
import { QuestData, QUEST_DATA } from '../data/questData';
import { DropSource, UnlockState } from '../types';
import { QuestChunkStatus } from '../utils/questDoability';
import {
  evaluateQuestDoability,
  questDoabilityHome,
  questDoabilityRequirementLabels,
  questDoabilitySkillBlockerLabel,
} from './QuestDoabilityPanel';

const unlocks = (over: Partial<UnlockState> = {}): UnlockState => ({
  equipment: {},
  skills: { Slayer: 10 },
  levels: { Slayer: 99 },
  regions: [],
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
  ...over,
});

const reachableChunk: QuestChunkStatus = {
  chunkCount: 1,
  reachable: 1,
  access: 'REACHABLE',
  startReachable: true,
  blockers: [],
};

const questIdsWorthAtLeast = (points: number): string[] => {
  const completed: string[] = [];
  let total = 0;
  for (const quest of Object.values(QUEST_DATA)) {
    if (quest.points <= 0) continue;
    completed.push(quest.id);
    total += quest.points;
    if (total >= points) return completed;
  }
  throw new Error(`Not enough Quest Points to reach ${points}`);
};

describe('evaluateQuestDoability', () => {
  it('does not report an evidence-free quest as doable', () => {
    const quest: QuestData = {
      id: 'Unknown location quest',
      name: 'Unknown location quest',
      kind: 'quest',
      accessPolicy: 'regions',
      regions: [],
      skills: {},
      prereqs: [],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };
    expect(evaluateQuestDoability(quest, unlocks(), null).bucket).toBe('NO_DATA');
  });

  it('keeps explicit canonical access authoritative without chunk data', () => {
    const quest = QUEST_DATA['A Porcine of Interest'];
    expect(evaluateQuestDoability(
      quest,
      unlocks({ regions: ['Draynor Village'] }),
      null,
    ).bucket).toBe('LOCKED');
  });
  it('locks Enter the Abyss behind its alternative provider requirement', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Enter the Abyss'],
      unlocks({ quests: ['Rune Mysteries'], regions: ['Wilderness'] }),
      reachableChunk,
    );

    expect(row.bucket).toBe('LOCKED');
    expect(row.reqsMet).toBe(false);
    expect(row.lockedAreas).toEqual([
      "One of: East Ardougne or Tree Gnome Stronghold or Wizards' Guild",
    ]);
  });

  it('clears Enter the Abyss geography with one provider but retains operational confirmation', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Enter the Abyss'],
      unlocks({
        quests: ['Rune Mysteries'],
        regions: ['Wilderness', 'East Ardougne'],
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('REQS');
    expect(row.reqsMet).toBe(false);
    expect(row.lockedAreas).toEqual([]);
  });

  it('accepts an attained level despite a lower method tier', () => {
    const quest: QuestData = {
      id: 'Method cap quest',
      name: 'Method cap quest',
      kind: 'quest',
      accessPolicy: 'regions',
      regions: ['Misthalin'],
      skills: { Woodcutting: 15 },
      operationalRequirements: [],
      prereqs: [],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };

    const row = evaluateQuestDoability(
      quest,
      unlocks({
        skills: { Woodcutting: 1 },
        levels: { Woodcutting: 15 },
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('DOABLE');
    expect(row.reqsMet).toBe(true);
    expect(row.missingSkills).toEqual([]);
  });

  it('shows Quest Points requirements as a skill blocker instead of a prerequisite', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Black Knights\' Fortress'],
      unlocks({ regions: ['Asgarnia'] }),
      reachableChunk,
    );

    expect(row.missingSkills).toContainEqual({
      skill: 'Quest Points', lvl: 12, have: 0,
    });
    expect(questDoabilitySkillBlockerLabel(row.missingSkills[0])).toBe(
      'Quest Points 12',
    );
    expect(row.missingPrereqs).not.toContain('Quest Points 12');
  });

  it('does not confuse a missing prerequisite with satisfied Quest Points', () => {
    const quest: QuestData = {
      id: 'Quest Points collision',
      name: 'Quest Points collision',
      kind: 'quest',
      accessPolicy: 'regions',
      regions: ['Asgarnia'],
      skills: { 'Quest Points': 12 },
      prereqs: ['Quest Points 12'],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };

    const row = evaluateQuestDoability(
      quest,
      unlocks({
        regions: ['Asgarnia'],
        quests: questIdsWorthAtLeast(12),
      }),
      reachableChunk,
    );

    expect(row.missingSkills).toEqual([]);
    expect(row.missingPrereqs).toEqual(['Quest Points 12']);
  });

  it('hides unmet requirements for completed quests', () => {
    const quest: QuestData = {
      id: 'Completed Quest Points collision',
      name: 'Completed Quest Points collision',
      kind: 'quest',
      accessPolicy: 'regions',
      regions: ['Asgarnia'],
      skills: { 'Quest Points': 12 },
      prereqs: ['Unmet prerequisite'],
      points: 0,
      difficulty: DropSource.QUEST_NOVICE,
    };

    const row = evaluateQuestDoability(
      quest,
      unlocks({
        regions: ['Asgarnia'],
        quests: [quest.id],
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('DONE');
    expect(row.missingSkills).toEqual([]);
    expect(row.missingPrereqs).toEqual([]);
  });

  it('keeps Prying Times in REQS until its manual Sailing check is confirmed', () => {
    const row = evaluateQuestDoability(
      QUEST_DATA['Prying Times'],
      unlocks({
        regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
        quests: ['Pandemonium', "The Knight's Sword"],
        skills: { Smithing: 3, Sailing: 2 },
        levels: { Smithing: 30, Sailing: 12 },
      }),
      reachableChunk,
    );

    expect(row.bucket).toBe('REQS');
    expect(row.reqsMet).toBe(false);
    expect(row.manualChecks).toContain('One open Sailing task slot');
    expect(row.manualChecks.length).toBeGreaterThan(1);
    expect(row.missingSkills).toEqual([]);
    expect(row.missingPrereqs).toEqual([]);
    expect(questDoabilityRequirementLabels(row)).toEqual([]);
  });
});


describe('reviewed quest destination reachability', () => {
  it('uses the new geography only in Chunked while keeping Standard area permissions', () => {
    const quest: QuestData = {
      id: 'Mode-specific geography', name: 'Mode-specific geography', kind: 'quest',
      accessPolicy: 'regions', regions: ['Lumbridge'], skills: {}, prereqs: [], points: 0,
      operationalRequirements: [], difficulty: DropSource.QUEST_NOVICE,
      chunkedGeography: {
        locations: [{ id: 'island', label: 'Island', chunkOptions: [{ cx: 38, cy: 62 }] }],
        groups: [], unknowns: [],
      },
    };
    const state = unlocks();
    const reachable = new Set([String(50 * 256 + 50)]);
    const standardChunks = authoredQuestChunkStatus(quest, reachable, () => false, 'standard');
    expect(standardChunks.chunkCount).toBe(0);
    expect(evaluateQuestDoability(quest, state, standardChunks, [], 'standard').bucket).toBe('DOABLE');
    const chunkedChunks = authoredQuestChunkStatus(quest, reachable,
      (cx, cy) => chunkUnlocked(cx, cy, state, 'chunked'), 'chunked');
    expect(chunkedChunks.access).toBe('LOCKED');
    expect(evaluateQuestDoability(quest, state, chunkedChunks, [], 'chunked').lockedAreas).toEqual(['Island']);
  });

  it('keeps an unknown teleport alternative unavailable without exposing its source uncertainty in requirement labels', () => {
    const quest: QuestData = {
      id: 'Unverified transport geography', name: 'Unverified transport geography', kind: 'quest',
      accessPolicy: 'regions', regions: ['Lumbridge'], skills: {}, prereqs: [], points: 0,
      operationalRequirements: [], difficulty: DropSource.QUEST_NOVICE,
      chunkedGeography: {
        locations: [{ id: 'start', label: 'Start', chunkOptions: [{ cx: 50, cy: 50 }] }],
        groups: [{ id: 'transport', label: 'Transport', routes: [
          { id: 'boat', label: 'Boat', locations: [{ id: 'dock', label: 'Dock', chunkOptions: [{ cx: 40, cy: 50 }] }] },
          { id: 'teleport', label: 'Teleport', locations: [], unknowns: ['Unreviewed teleport permission'] },
        ] }], unknowns: [],
      },
    };
    const state = unlocks();
    const eligibility = evaluateQuestEligibility(quest, state, 'chunked');
    expect(eligibility.status).toBe('UNKNOWN');
    expect(eligibility.blockers).toContainEqual({ kind: 'requirement', label: 'Unreviewed teleport permission', internalOnly: true });
    const chunks = authoredQuestChunkStatus(quest, new Set([String(50 * 256 + 50)]),
      (cx, cy) => chunkUnlocked(cx, cy, state, 'chunked'), 'chunked');
    const row = evaluateQuestDoability(quest, state, chunks, [], 'chunked');
    expect(row.bucket).toBe('REQS');
    expect(row.reqsMet).toBe(false);
    expect(questDoabilityRequirementLabels(row)).toEqual([]);
  });

  it('uses Standard logical destination permissions despite a locked surface entrance owner', () => {
    const quest = QUEST_DATA['The Giant Dwarf'];
    const state = unlocks({
      regions: [...new Set(quest.locations!.flatMap(location => location.standardAreas))],
      skills: Object.fromEntries(Object.keys(quest.skills).map(skill => [skill, 10])),
      levels: { ...quest.skills },
      quests: [...quest.prereqs],
    });
    expect(state.regions).not.toContain('Rellekka');
    const chunks = authoredQuestChunkStatus(quest, new Set(), (cx, cy) => chunkUnlocked(cx, cy, state));
    expect(chunks.access).toBe('LOCKED');
    const row = evaluateQuestDoability(quest, state, chunks, ['Rellekka']);
    expect(row.bucket).not.toBe('LOCKED');
    expect(row.bucket).not.toBe('STRANDED');
    expect(row.lockedAreas).toEqual([]);
    const missingDestination = evaluateQuestDoability(quest, { ...state, regions: [] }, chunks);
    expect(missingDestination.bucket).toBe('LOCKED');
  });

  it('starts a fresh Chunked route at its free castle chunk and cannot walk across unowned neighbours', () => {
    const state = unlocks({ chunks: ['48,52'] });
    const reach = chunkReachability({}, state, questDoabilityHome('chunked'), undefined, 'chunked');
    expect(reach.reachable.has(String(50 * 256 + 50))).toBe(true);
    expect(reach.reachable.has(String(49 * 256 + 50))).toBe(false);
    expect(reach.reachable.has(String(48 * 256 + 52))).toBe(false);
    const quest: QuestData = {
      ...QUEST_DATA["Cook's Assistant"],
      locations: [{ id: 'manor', label: 'Manor', standardAreas: ['Draynor Village'], chunkOptions: [{ cx: 48, cy: 52 }] }],
    };
    expect(authoredQuestChunkStatus(quest, reach.reachable,
      (cx, cy) => chunkUnlocked(cx, cy, state, 'chunked')).access).toBe('STRANDED');
  });

  it('agrees with Getting Ahead eligibility without the optional clay gathering chunk', () => {
    const quest = QUEST_DATA['Getting Ahead'];
    const state = unlocks({ chunks: ['19,57', '18,56'], skills: { Construction: 3, Crafting: 3 }, levels: { Construction: 26, Crafting: 30 } });
    const reachable = new Set([String(19 * 256 + 57), String(18 * 256 + 56)]);
    const chunks = authoredQuestChunkStatus(quest, reachable, (cx, cy) => state.chunks!.includes(`${cx},${cy}`));
    expect(chunks.access).toBe('REACHABLE');
    expect(chunks.chunkCount).toBe(2);
    expect(evaluateQuestDoability(quest, state, chunks, [], 'chunked').bucket).not.toBe('LOCKED');
  });

  it('accepts one reachable alternative entrance and still detects stranded destinations', () => {
    const quest: QuestData = { ...QUEST_DATA["Cook's Assistant"], locations: [{ id: 'entrance', label: 'Entrance', standardAreas: ['Lumbridge'], chunkOptions: [{ cx: 49, cy: 50 }, { cx: 50, cy: 50 }] }] };
    const available = authoredQuestChunkStatus(quest, new Set([String(50 * 256 + 50)]), () => false);
    expect(available.access).toBe('REACHABLE');
    expect(available.chunkCount).toBe(1);
    expect(authoredQuestChunkStatus(quest, new Set(), () => true).access).toBe('STRANDED');
    expect(authoredQuestChunkStatus(quest, new Set(), () => false).access).toBe('LOCKED');
  });
});

// This suite isolates destination/skill/manual behavior with known legal supplies.
// Acquisition availability itself is covered by itemAcquisition and source tests.
import { beforeEach as beforeSupplyTest, afterEach as afterSupplyTest, vi as supplySpy } from 'vitest';
import { chunkContentService as suppliedItemsFixture } from '../services/ChunkContentService';
let restoreSupplyFixture: (() => void)[] = [];
beforeSupplyTest(() => {
  const ready = supplySpy.spyOn(suppliedItemsFixture, 'ready', 'get').mockReturnValue(true);
  const records = supplySpy.spyOn(suppliedItemsFixture, 'itemSourceRecords').mockImplementation(itemName => [{ itemName, kind: 'spawn', hostName: 'Test prepared supplies', cx: 50, cy: 50, rawRequirements: [] }]);
  restoreSupplyFixture = [() => ready.mockRestore(), () => records.mockRestore()];
});
afterSupplyTest(() => restoreSupplyFixture.forEach(restore => restore()));

it('shows the Restless Ghost necklace permission without internal review notes', () => {
  const row = evaluateQuestDoability(QUEST_DATA['The Restless Ghost'], unlocks({ regions: ['Lumbridge', 'Lumbridge Swamp'] }), null);
  expect(questDoabilityRequirementLabels(row)).toContain('Necklace slot T1: wear the ghostspeak amulet');
  expect(questDoabilityRequirementLabels(row).join(' ')).not.toMatch(/review|classified|confirm/i);
  const permitted = evaluateQuestDoability(QUEST_DATA['The Restless Ghost'], unlocks({ equipment: { Neck: 1 } }), null);
  expect(questDoabilityRequirementLabels(permitted)).not.toContain('Necklace slot T1: wear the ghostspeak amulet');
});
it('keeps equipment alternatives as OR and hides unresolved manual wording', () => {
  const quest = { ...QUEST_DATA['The Restless Ghost'], operationalRequirements: [
    { kind: 'any' as const, of: [{ kind: 'equipment' as const, slot: 'Neck', tier: 1 }, { kind: 'equipment' as const, slot: 'Legs', tier: 1 }] },
    { kind: 'method' as const, skill: 'Woodcutting', tier: 3 },
    { kind: 'manual' as const, key: 'review', label: 'Internal review note' },
  ] };
  const labels = questDoabilityRequirementLabels(evaluateQuestDoability(quest, unlocks(), null));
  expect(labels).toContain('Neck equipment tier 1 or Legs equipment tier 1');
  expect(labels).toContain('Woodcutting method tier 3');
  expect(labels).not.toContain('Internal review note');
  const permitted = questDoabilityRequirementLabels(evaluateQuestDoability(quest, unlocks({ equipment: { Legs: 1 } }), null));
  expect(permitted.join(' ')).not.toContain('Neck equipment');
});
