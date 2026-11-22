// What's New 2026-09-29: a quest whose owned place has no route yet ("No
// route to ...") can still be completed by hand. With a confirmation check
// too, the confirm box must still be asked, or the engine refuses with
// "Confirm: ..." and the entry can never be completed.
import { beforeAll, describe, expect, it, vi } from 'vitest';
import fullChunkContent from '../public/chunk-content.json';
import { createFreshState } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import {
  ARCANA_LIST, BOSSES_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, MINIGAMES_LIST, MOBILITY_LIST, SKILLS_LIST, REGIONS_LIST,
  GUILDS_LIST, FARMING_PATCH_LIST, POH_LIST, SLAYER_UNLOCKS_LIST,
} from '../data/items';
import { computeAreaRoutes } from './areaRoutes';
import { loadWalkSections } from './walkSections';
import { evaluateQuestEligibility } from './journalStatus';
import { diaryTaskCompletionDecision, diaryTaskLoggingEligibility, questCompletionDecision } from './journalCompletion';
import { requestDiaryTaskAttestation, requestQuestAttestation } from './manualAttestation';
import type { UnlockState } from '../types';

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => structuredClone(fullChunkContent) })));
  expect(await chunkContentService.init()).toBe(true);
  await loadWalkSections();
});

/** A Vanilla run with every non-area unlock, levels 99 and every other quest done. */
const run = (regions: string[], questsDoneExcept: string[] = [], mobility: string[] = []): UnlockState => ({
  ...createFreshState().unlocks,
  equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(slot => [slot, 9])),
  skills: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 10])),
  levels: Object.fromEntries(SKILLS_LIST.map(skill => [skill, 99])),
  regions, mobility, arcana: [...ARCANA_LIST], housing: [...POH_LIST],
  merchants: [...MERCHANTS_LIST], minigames: [...MINIGAMES_LIST], bosses: [...BOSSES_LIST],
  guilds: [...GUILDS_LIST], farming: [...FARMING_PATCH_LIST], slayerUnlocks: [...SLAYER_UNLOCKS_LIST],
  quests: Object.keys(QUEST_DATA).filter(id => !questsDoneExcept.includes(id)),
} as UnlockState);

const routesOf = (unlocks: UnlockState) => computeAreaRoutes(chunkContentService.connectGraph(), unlocks, 'vanilla');

describe('completing by hand with no route yet', () => {
  it("asks the confirm box for Enakhra's Lament owning only Bandit Camp, then completes", () => {
    const quest = QUEST_DATA["Enakhra's Lament"];
    const unlocks = run(['Bandit Camp'], [quest.id]);
    const shown = evaluateQuestEligibility(quest, unlocks, 'vanilla', routesOf(unlocks));
    expect(shown.blockers.map(b => b.label)).toEqual(["No route to Desert Quarry and Enakhra's Temple"]);
    expect(shown.manualChecks.length).toBeGreaterThan(0);

    const confirm = vi.fn(() => true);
    const attestation = requestQuestAttestation(quest, unlocks, 'vanilla', confirm);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(attestation).toEqual({ manualConfirmed: true });
    expect(questCompletionDecision(quest, unlocks, 'vanilla', attestation!)).toEqual({ ok: true });
    // Saying no still cancels.
    expect(requestQuestAttestation(quest, unlocks, 'vanilla', () => false)).toBeNull();
  }, 120_000);

  it('asks the confirm box for kan_hard_7 owning only its own areas, then logs it', () => {
    const task = ALL_DIARY_TASKS.find(t => t.id === 'kan_hard_7')!;
    const areas = [...new Set([
      ...(task.regions ?? []),
      ...(task.locations ?? []).flatMap(l => l.standardAreas ?? []),
    ])].filter(a => REGIONS_LIST.includes(a));
    const unlocks = run(areas, [], [...MOBILITY_LIST]);
    const shown = diaryTaskLoggingEligibility(task, unlocks, 'vanilla', routesOf(unlocks));
    expect(shown.machineEligible).toBe(false);
    expect(shown.blockers.every(b => b.label.startsWith('No route to'))).toBe(true);

    const confirm = vi.fn(() => true);
    const attestation = requestDiaryTaskAttestation(task, unlocks, 'vanilla', confirm);
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(diaryTaskCompletionDecision(task, unlocks, 'vanilla', attestation!)).toEqual({ ok: true });
  }, 120_000);
});
