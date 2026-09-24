import { beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readPinnedChunkSource } from './chunk-source.mjs';
import { buildChunkQuestEvidence, resolveRegionAccess, worldPointToChunk } from './quest-chunk-evidence.mjs';

let raw: any, runtime: any, evidence: ReturnType<typeof buildChunkQuestEvidence>;
beforeAll(async () => {
  [{ data: raw }, runtime] = await Promise.all([
    readPinnedChunkSource(),
    readFile(new URL('../public/chunk-content.json', import.meta.url), 'utf8').then(JSON.parse),
  ]);
  evidence = buildChunkQuestEvidence(raw, runtime);
});
const restlessTask = (suffix: string) => evidence.quests.find(quest => quest.questId === 'The Restless Ghost')!
  .tasks.find(task => task.sourceId === `~|The Restless Ghost|~ ${suffix}`)!;

describe('offline detailed ChunkPicker quest evidence', () => {
  it('retains every pinned task and BaseQuest group, including miniquests and completion records', () => {
    expect(evidence.counts.quests).toBe(211);
    expect(evidence.counts.tasks).toBe(2218);
    expect(evidence.quests.flatMap(quest => quest.tasks.map(task => task.sourceId)).sort())
      .toEqual(Object.keys(raw.challenges.Quest).sort());
    expect(evidence.quests.map(quest => quest.questId))
      .toEqual([...new Set(Object.values(raw.challenges.Quest).map((task: any) => task.BaseQuest))].sort());
    expect(restlessTask('Complete the quest')).toMatchObject({
      description: null,
      dependsOn: ['~|The Restless Ghost|~ 5'],
      rewards: { questPoints: 1, xp: { Prayer: 1125 } },
    });
  });

  it('retains the actual Restless Ghost dependency graph and reward evidence', () => {
    const tasks = evidence.quests.find(quest => quest.questId === 'The Restless Ghost')!.tasks;
    expect(tasks).toHaveLength(6);
    for (const [index, task] of tasks.entries()) {
      expect(task.dependsOn).toEqual(index === 0 ? [] : [`~|The Restless Ghost|~ ${index}`]);
      expect(task.requirements.raw).toEqual(index === 0 ? {} : {
        Tasks: { [`~|The Restless Ghost|~ ${index}`]: 'Quest' },
      });
    }
    expect(restlessTask('2').rewards.items).toEqual(['Ghostspeak amulet']);
    expect(restlessTask('4').location.sourceRefs).toEqual(["Wizards' Tower#Basement"]);
  });

  it('resolves Father Aereck separately from the ghost in the adjacent graveyard', () => {
    expect(restlessTask('1').location.candidates).toMatchObject([
      { chunkKey: '50,50', sourceId: '12850', via: 'ENTITY', evidence: { entity: { kind: 'npc', name: 'Father Aereck' } } },
    ]);
    expect(restlessTask('3').location.candidates).toMatchObject([
      { chunkKey: '50,49', sourceId: '12849', via: 'ENTITY', evidence: { entity: { kind: 'npc', name: 'Restless ghost' } } },
    ]);
    expect(restlessTask('1').location.candidates).toHaveLength(1);
    expect(restlessTask('3').location.candidates).toHaveLength(1);
  });

  it('maps the basement to its recorded surface entrance while preserving physical coordinates', () => {
    const point = { x: 3115, y: 9558, plane: 0 };
    expect(worldPointToChunk(point)).toEqual({ chunkKey: '48,149', cx: 48, cy: 149, regionId: 12437, plane: 0 });
    expect(point).toEqual({ x: 3115, y: 9558, plane: 0 });
    expect(resolveRegionAccess(12437, runtime)).toMatchObject([{
      chunkKey: '48,49', sourceId: '12437', via: 'INTERIOR_ENTRANCE',
      evidence: { interiorId: '12437', regionId: 12437, entrance: { chunkId: '12337', via: ['12437'] } },
    }]);
    expect(new Set(restlessTask('4').location.candidates.map(candidate => candidate.chunkKey))).toEqual(new Set(['48,49']));
    expect(restlessTask('4').location.candidates.map(candidate => candidate.sourceId)).toContain('12437');
    expect(resolveRegionAccess(12437, { chunks: {}, interiors: {} })).toEqual([]);
    expect(resolveRegionAccess(12437, { chunks: {}, interiors: { '12437': { entrances: [] } } })).toEqual([]);
    expect(resolveRegionAccess(12437, { chunks: { '12437': {} }, interiors: { '12437': { entrances: [] } } })).toEqual([]);
  });

  it('treats a numeric suffix as a section identifier without inventing a plane', () => {
    const task = restlessTask('5');
    expect(task.location.sourceRefs).toEqual(['12849-1']);
    expect(task.location.candidates).toMatchObject([{
      chunkKey: '50,49', via: 'EXPLICIT_CHUNK', evidence: { regionId: 12849, sectionId: '1', sourceRef: '12849-1' },
    }]);
    expect(task.location.candidates[0].evidence).not.toHaveProperty('plane');
  });

  it('retains exact source section gates separately from normalized runtime gates', () => {
    const tasks = evidence.quests.flatMap(quest => quest.tasks);
    const crab = tasks.find(task => task.location.sourceRefs.includes('12073-1'))!;
    expect(crab.location.sourceGateEvidence).toContainEqual({
      sourceRef: '12073-1', present: true,
      raw: ['~|Pandemonium|~ Complete the quest'], interpretation: 'EXACT_SOURCE_SECTION_ONLY',
    });
    const moon = tasks.find(task => task.location.sourceRefs.includes('13622-1'))!;
    expect(moon.location.sourceGateEvidence).toContainEqual({
      sourceRef: '13622-1', present: false, raw: null, interpretation: 'EXACT_SOURCE_SECTION_ONLY',
    });
    expect(moon.location.candidates.every(candidate => candidate.requirementProvenance === 'NORMALIZED_RUNTIME_GATES')).toBe(true);
    expect(moon.location.sourceGateEvidence[0].raw).not.toEqual(runtime.questSections['13622']);
  });

  it('keeps alternative entity locations, interior paths, and each entrance condition', () => {
    const data = { challenges: { Quest: { sample: { BaseQuest: 'Sample', NPCs: ['Guide'], Objects: ['Chest'], Monsters: ['Rat'] } } } };
    const content = {
      chunks: { '12850': { p: ['Guide'], o: [['Chest', 1]], m: [['Rat', 1]] }, '12849': { p: ['Guide'] } },
      interiors: { '12437': {
        name: 'Cellar', content: { p: ['Guide'] }, requirements: { npc: { Guide: ['Quest step'] } },
        entrances: [
          { chunkId: '12850', requirements: ['Key'], via: ['12437', 'Tunnel'] },
          { chunkId: '12849', requirements: ['Rope'], via: ['12437'] },
        ],
      } },
      taskUnlocks: { NPCs: { Guide: { '12850': ['Guide unlocked'] } } },
    };
    const task = buildChunkQuestEvidence(data, content).quests[0].tasks[0];
    const guides = task.location.candidates.filter(candidate => candidate.evidence.entity?.name === 'Guide');
    expect(guides).toHaveLength(4);
    expect(new Set(guides.map(candidate => candidate.chunkKey))).toEqual(new Set(['50,49', '50,50']));
    expect(guides.find(candidate => candidate.sourceId === '12437' && candidate.chunkKey === '50,50')).toMatchObject({
      requirements: ['Guide unlocked', 'Key', 'Quest step'],
      evidence: { accessVia: 'INTERIOR_ENTRANCE', entrance: { via: ['12437', 'Tunnel'] } },
    });
    expect(guides.find(candidate => candidate.sourceId === '12437' && candidate.chunkKey === '50,49')?.requirements)
      .toEqual(['Quest step', 'Rope']);
    expect(task.location.entityRefs).toEqual([
      { kind: 'monster', name: 'Rat' }, { kind: 'npc', name: 'Guide' }, { kind: 'object', name: 'Chest' },
    ]);
    expect(task.location.issues).toContainEqual({ code: 'AMBIGUOUS_ENTITY_REF', kind: 'npc', name: 'Guide' });
    expect(task.location).not.toHaveProperty('requiredChunks');
  });

  it('retains unresolved named references alongside candidates and never emits readiness', () => {
    const data = { challenges: { Quest: {
      unknown: { BaseQuest: 'Sample', Chunks: ['Unknown named basement'], NPCs: ['Unknown guide'] },
      partial: { BaseQuest: 'Sample', Chunks: ['12850', 'QuestCondition[+]'], Tasks: { missing: 'Quest' } },
      none: { BaseQuest: 'Sample', Items: ['SpecialItem[+]'] },
    } } };
    const result = buildChunkQuestEvidence(data, { chunks: { '12850': {} }, interiors: {} });
    const task = (id: string) => result.quests[0].tasks.find(item => item.sourceId === id)!;
    expect(task('unknown').location).toMatchObject({ candidates: [], coverage: 'UNRESOLVED' });
    expect(task('unknown').location.issues).toContainEqual({ code: 'UNRESOLVED_SOURCE_REF', sourceRef: 'Unknown named basement' });
    expect(task('unknown').location.issues).toContainEqual({ code: 'UNRESOLVED_ENTITY_REF', kind: 'npc', name: 'Unknown guide' });
    expect(task('partial').location.coverage).toBe('CANDIDATES');
    expect(task('partial').location.issues).toContainEqual({ code: 'UNRESOLVED_SOURCE_REF', sourceRef: 'QuestCondition[+]' });
    expect(task('partial').location.issues).toContainEqual({ code: 'UNRESOLVED_DEPENDENCY', sourceId: 'missing', category: 'Quest' });
    expect(task('none').location.coverage).toBe('NO_LOCATION');
    expect(result.counts).toMatchObject({ tasksWithCandidates: 1, unresolvedTasks: 1, tasksWithoutLocation: 1, unresolvedReferences: 3 });
    expect(JSON.stringify(result)).not.toMatch(/"(?:ready|eligible|verified|completable)"\s*:/i);
  });

  it('preserves unfamiliar source condition fields and produces stable output without mutating inputs', () => {
    const data = { challenges: { Quest: {
      b: { BaseQuest: 'B', Items: ['Item[+]'], Skills: { Mining: 10 }, SkillsBoost: { Mining: false }, 'Not F2P': true, Smithing: { Fishing: 5 }, QuestPointsNeeded: 12, NoBoost: true },
      a: { BaseQuest: 'A', Chunks: ['12849'] },
    } } };
    const content = { chunks: { '12850': {}, '12849': {} }, interiors: {} };
    const before = JSON.stringify({ data, content });
    const result = buildChunkQuestEvidence(data, content);
    expect(result.quests[1].tasks[0].requirements).toEqual({
      items: ['Item[+]'], skills: { Mining: 10 },
      raw: { Items: ['Item[+]'], Skills: { Mining: 10 }, SkillsBoost: { Mining: false }, 'Not F2P': true, Smithing: { Fishing: 5 }, QuestPointsNeeded: 12, NoBoost: true },
    });
    const reordered = { challenges: { Quest: Object.fromEntries(Object.entries(data.challenges.Quest).reverse()) } };
    expect(buildChunkQuestEvidence(reordered, content)).toEqual(result);
    expect(JSON.stringify({ data, content })).toBe(before);
  });
});

describe('literal world point conversion', () => {
  it('retains plane as coordinate metadata and rejects expressions or coercible strings', () => {
    expect(worldPointToChunk({ x: 3200, y: 3200, plane: 2 })).toEqual({ chunkKey: '50,50', cx: 50, cy: 50, regionId: 12850, plane: 2 });
    for (const point of [null, {}, { x: '3200', y: 3200, plane: 0 }, { x: 3200.5, y: 3200, plane: 0 }, { x: 3200, y: 3200, plane: 'plane' }, { x: -1, y: 3200, plane: 0 }]) {
      expect(worldPointToChunk(point)).toBeNull();
    }
  });
});
