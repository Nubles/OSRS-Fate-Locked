import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../../../types';
import { REGION_CHUNKS } from '../../../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../../../data/subAreaChunks';
import { answerQuestion, completeStep, evaluateGuide, freshProgress, setInventory, validatePack } from '../engine';
import { validProgress } from '../storage';
import { OPENING_EXPANSION_PACKS } from './opening-expansion';

const unlocks = {
  regions: ["Wizards' Tower", 'Falador', 'Goblin Village', 'Rimmington'],
  chunks: ['48,49', '46,53', '46,54', '46,50'], skills: {}, levels: {},
  quests: [], mobility: [], arcana: [], guilds: [], equipment: {},
} as unknown as UnlockState;
const pack = (id: string) => OPENING_EXPANSION_PACKS.find(pack => pack.id === id)!;
const supplied = (id: string, inventory: Record<string, number>, branch?: string) => {
  const guide = pack(id);
  let progress = freshProgress(guide);
  if (branch) progress = answerQuestion(guide, progress, 'armour-preparation', branch);
  for (const [id, quantity] of Object.entries(inventory)) progress = setInventory(guide, progress, id, quantity);
  return progress;
};

describe('opening quest expansion', () => {
  it('has reviewed sources, valid dependencies and supported exact destinations', () => {
    const chunks = new Set(Object.values(REGION_CHUNKS).flat().map(point => `${point.cx},${point.cy}`));
    expect(new Set(OPENING_EXPANSION_PACKS.map(pack => pack.id)).size).toBe(4);
    for (const guide of OPENING_EXPANSION_PACKS) {
      expect(validatePack(guide), guide.id).toEqual([]);
      expect(guide.coverage).toBe('complete');
      expect(guide.sources[0].revision).toBe('633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a');
      for (const step of guide.steps) {
        if (!step.location) {
          expect(['dye-blue', 'dye-orange']).toContain(step.id);
          continue;
        }
        expect(chunks.has(`${step.location.cx},${step.location.cy}`)).toBe(true);
        for (const area of step.location.areas) expect(SUB_AREA_CHUNKS[area]).toContainEqual({ cx: step.location.cx, cy: step.location.cy });
      }
    }
  });

  const routes: [string, Record<string, number>, string?][] = [
    ['Imp Catcher', { 'black-bead': 1, 'white-bead': 1, 'red-bead': 1, 'yellow-bead': 1 }],
    ["Doric's Quest", { clay: 6, 'copper-ore': 4, 'iron-ore': 2 }],
    ['Goblin Diplomacy', { 'goblin-mail': 1, 'orange-goblin-mail': 1, 'blue-goblin-mail': 1 }, 'prepared'],
    ['Goblin Diplomacy', { 'goblin-mail': 3, 'orange-dye': 1, 'blue-dye': 1 }, 'dye'],
    ["Witch's Potion", { onion: 1, 'burnt-meat': 1, 'eye-of-newt': 1 }],
  ];
  for (const mode of [undefined, 'chunked']) {
    it.each(routes)(`finishes %s with accounted supplies in ${mode ?? 'Standard'}`, (id, inventory, branch) => {
      const guide = pack(id);
      let progress = supplied(id, inventory, branch);
      for (let limit = 0; limit < guide.steps.length; limit++) {
        const next = evaluateGuide(guide, progress, unlocks, mode).next;
        if (!next) break;
        expect(next.state, `${id}: ${next.reasons.join(', ')}`).toBe('available');
        progress = completeStep(guide, progress, next.step.id, unlocks, mode);
        expect(validProgress(progress, guide)).toBe(true);
      }
      expect(evaluateGuide(guide, progress, unlocks, mode).complete).toBe(true);
      expect(Object.values(progress.inventory).every(quantity => quantity === 0)).toBe(true);
      expect(unlocks.quests).toEqual([]);
      if (branch === 'prepared') expect(progress.completed).not.toContain('dye-blue');
      if (id === "Witch's Potion") expect(progress.completed).toEqual(['meet-hetty', 'collect-tail', 'give-ingredients', 'drink-potion']);
    });
  }

  it.each([
    ['Imp Catcher', { 'black-bead': 1, 'white-bead': 1, 'red-bead': 1 }, 'return-beads'],
    ["Doric's Quest", { clay: 6, 'copper-ore': 4, 'iron-ore': 1 }, 'deliver-ore'],
    ["Witch's Potion", { onion: 1, 'burnt-meat': 1 }, 'give-ingredients'],
  ] as [string, Record<string, number>, string][] )('keeps %s blocked when a distinct required ingredient is short', (id, inventory, handover) => {
    const guide = pack(id);
    let progress = supplied(id, inventory);
    for (let limit = 0; limit < guide.steps.length; limit++) {
      const next = evaluateGuide(guide, progress, unlocks).next;
      if (next?.state !== 'available') break;
      progress = completeStep(guide, progress, next.step.id, unlocks);
    }
    expect(evaluateGuide(guide, progress, unlocks).next?.step.id).toBe(handover);
    expect(evaluateGuide(guide, progress, unlocks).next?.state).toBe('blocked');
    expect(completeStep(guide, progress, handover, unlocks)).toBe(progress);
  });

  it('reserves a third brown mail instead of duplicating the two dyed mails', () => {
    const guide = pack('Goblin Diplomacy');
    let progress = supplied(guide.id, { 'goblin-mail': 2, 'blue-dye': 1, 'orange-dye': 1 }, 'dye');
    for (const id of ['dye-blue', 'dye-orange', 'orange-trial', 'blue-trial']) progress = completeStep(guide, progress, id, unlocks);
    expect(progress.inventory['goblin-mail']).toBe(0);
    expect(evaluateGuide(guide, progress, unlocks).next?.state).toBe('blocked');
    expect(completeStep(guide, progress, 'brown-trial', unlocks)).toBe(progress);
  });

  it('does not let prepared ingredients bypass a locked destination', () => {
    const guide = pack("Doric's Quest");
    const progress = supplied(guide.id, { clay: 6, 'copper-ore': 4, 'iron-ore': 2 });
    const locked = { ...unlocks, chunks: [] };
    expect(evaluateGuide(guide, progress, locked, 'chunked').next?.state).toBe('blocked');
    expect(completeStep(guide, progress, 'ask-doric', locked, 'chunked')).toBe(progress);
  });
});
