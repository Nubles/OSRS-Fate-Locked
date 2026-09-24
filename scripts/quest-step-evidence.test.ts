import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { runQuestEvidenceSync, EVIDENCE_PATHS } from './sync-quest-step-evidence.mjs';
import { questWalkthroughFor } from '../data/questWalkthroughs.public';
import review from '../data/sources/quest-step-evidence-review.json';

const load = async () => JSON.parse(gunzipSync(await readFile(EVIDENCE_PATHS.catalogue)).toString('utf8'));

describe('combined quest evidence and reviewed Restless Ghost pilot', () => {
  it('reproduces all generated evidence offline with the recorded source hashes', async () => {
    const summary = await runQuestEvidenceSync();
    expect(summary.counts.chunkPickerTasks).toBe(2218);
    expect(summary.counts.chunkPickerQuests).toBe(211);
    expect(summary.counts.questHelperSourceFiles).toBe(362);
    expect(summary.counts.automaticallyApprovedGuides).toBe(0);
  }, 60000);

  it('pins reviewed step chunks to both independent sources and the existing public guide', async () => {
    const evidence = await load();
    expect(evidence.status).toBe('CANDIDATE_ONLY');
    expect(evidence.sources.questHelper.commit).toBe(review.questHelperCommit);
    expect(evidence.sources.chunkPicker.commit).toBe(review.chunkPickerCommit);
    const helper = evidence.questHelper.find(file => file.sourcePath === review.questHelperPath);
    const chunkQuest = evidence.chunkPicker.quests.find(quest => quest.questId === review.questId);
    const publicQuest = questWalkthroughFor(review.questId)!;
    expect(helper.steps).toHaveLength(10);
    for (const mapping of review.actionMappings) {
      const step = helper.steps.find(step => step.variable === mapping.helperStep);
      expect(step, mapping.helperStep).toBeDefined();
      expect(step.worldPoint).toMatchObject(mapping.worldPoint);
      expect(step.accessCandidates.map(candidate => candidate.chunkKey)).toContain(mapping.accessChunk);
      const task = chunkQuest.tasks.find(task => task.sourceId === mapping.chunkPickerTask);
      expect(task, mapping.chunkPickerTask).toBeDefined();
      expect(task.location.candidates.map(candidate => candidate.chunkKey)).toContain(mapping.accessChunk);
      const action = publicQuest.actions.find(action => action.id === mapping.actionId)!;
      expect(action.location).toEqual({ kind: 'EXPLICIT_CHUNKS', chunks: [mapping.accessChunk] });
      expect(step.travelCoverage).toBe('NOT_EVALUATED');
    }
    const skull = helper.steps.find(step => step.variable === 'searchAltarAndRun');
    expect(skull.physicalChunk.regionId).toBe(12437);
    expect(skull.physicalChunk.chunkKey).toBe('48,149');
    expect(skull.accessCandidates.map(candidate => candidate.chunkKey)).toContain('48,49');
  });

  it('preserves equipped-item evidence and the separation between obtaining and wearing the amulet', async () => {
    const evidence = await load();
    const helper = evidence.questHelper.find(file => file.sourcePath === review.questHelperPath);
    const amulet = helper.itemRequirements.find(item => item.variable === review.equipment.helperRequirement);
    expect(amulet.mustBeEquipped).toBe(true);
    expect(amulet.quantity).toBe(1);
    expect(JSON.stringify(amulet.modifiers)).toContain('isNotConsumed');
    const speak = helper.steps.find(step => step.variable === 'speakToGhost');
    expect(speak.requirementExpressions).toContain('ghostspeakAmulet');
    const publicQuest = questWalkthroughFor(review.questId)!;
    const wear = publicQuest.actions.find(action => action.id === review.equipment.actionId)!;
    expect(wear.gates).toContainEqual(expect.objectContaining(review.equipment.fateGate));
    const obtain = publicQuest.actions.find(action => action.id === review.equipment.acquisitionAction)!;
    expect(obtain.gates.some(gate => gate.type === 'EQUIPMENT')).toBe(false);
    expect(obtain.coach?.fulfils).toContainEqual(expect.objectContaining({ supplyPolicy: 'QUEST_PROVIDED' }));
  });

  it('retains conditional priority and disagreements instead of flattening them into ready actions', async () => {
    const evidence = await load();
    const helper = evidence.questHelper.find(file => file.sourcePath === review.questHelperPath);
    expect(helper.coverage).toBe('STATIC_PARTIAL');
    for (const [name, expected] of Object.entries(review.retainedBranches)) {
      const group = helper.conditionalSteps.find(group => group.variable === name);
      expect(group.branches.map(branch => branch.conditionExpression.replace(/\s+/g, '')))
        .toEqual(expected.map(condition => condition.replace(/\s+/g, '')));
    }
    expect(review.discrepancies.some(entry => entry.kind === 'SOURCE_WORDING_CONFLICT')).toBe(true);
    expect(review.discrepancies.some(entry => entry.kind === 'TRAVEL_COVERAGE_GAP')).toBe(true);
    expect(questWalkthroughFor("Daddy's Home")).toBeUndefined();
  });
});
