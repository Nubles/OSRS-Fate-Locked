import { describe, expect, it } from 'vitest';
import type { UnlockState } from '../../../types';
import { REGION_CHUNKS } from '../../../data/regionChunks';
import { classifyShop } from '../../../utils/shopClassification';
import { completeStep, evaluateGuide, freshProgress, setInventory, validatePack } from '../engine';
import { validProgress } from '../storage';
import { applyGuideTravel } from '../travel';
import { OPENING_EXPANSION_TWO_PACKS as packs } from './opening-expansion-two';

const unlocks = { regions: ['Lumbridge', 'Draynor Village', "Wizards' Tower", 'Port Sarim', 'Musa Point', 'Varrock', 'Falador'], chunks: [...new Set(packs.flatMap(pack => pack.steps.flatMap(step => step.location ? [`${step.location.cx},${step.location.cy}`] : [])))], skills: {}, levels: {}, quests: [], mobility: [], arcana: [], guilds: [], equipment: { Body: 1, Neck: 1 }, merchants: ['Wine Traders'] } as unknown as UnlockState;
const supplies: Record<string, Record<string, number>> = {
  'X Marks the Spot': { spade: 1 }, 'The Restless Ghost': {}, 'Ernest the Chicken': { spade: 1 }, "Pirate's Treasure": { coins: 60, banana: 10, 'white-apron': 1, spade: 1 },
};
function prepare(pack: typeof packs[number], inventory = supplies[pack.id]) {
  let progress = freshProgress(pack);
  for (const [id, count] of Object.entries(inventory)) progress = setInventory(pack, progress, id, count);
  return progress;
}

describe('second opening quest expansion', () => {
  it('does not present owned Musa Point as reachable merely because the ferry step was recorded', () => {
    const pack = packs.find(pack => pack.id === "Pirate's Treasure")!;
    let progress = prepare(pack);
    progress = completeStep(pack, progress, 'meet-frank', unlocks, 'chunked');
    progress = completeStep(pack, progress, 'sail-karamja', unlocks, 'chunked');
    const base = evaluateGuide(pack, progress, unlocks, 'chunked');
    expect(base.next?.step.id).toBe('buy-rum');
    expect(base.next?.state).toBe('available');
    const mainlandOnly = new Set([String(47 * 256 + 50)]);
    const live = applyGuideTravel(base, 'chunked', mainlandOnly);
    expect(live.next?.state).toBe('unsupported');
    expect(live.complete).toBe(false);
    expect(live.next?.reasons[0]).toContain('has not been established');
  });
  it('uses the existing category for Karamja Wines, Spirits and Beers', () => {
    expect(classifyShop('Karamja Wines, Spirits and Beers')).toBe('Wine Traders');
  });
  it.each([
    ['The Restless Ghost', 'speak-ghost', { ...unlocks, equipment: { Body: 1 } }],
    ["Pirate's Treasure", 'recover-rum', { ...unlocks, equipment: { Neck: 1 } }],
    ["Pirate's Treasure", 'buy-rum', { ...unlocks, merchants: [] }],
  ] as [string, string, UnlockState][])('requires real equipment or merchant permission for %s at %s', (id, stop, restricted) => {
    const pack = packs.find(pack => pack.id === id)!;
    let progress = prepare(pack);
    for (const step of pack.steps) {
      if (step.id === stop) break;
      progress = completeStep(pack, progress, step.id, unlocks);
    }
    expect(evaluateGuide(pack, progress, restricted).next?.state).toBe('blocked');
    expect(completeStep(pack, progress, stop, restricted)).toBe(progress);
  });
  it('has complete source-backed sequences and canonical map pins', () => {
    const canonical = new Set(Object.values(REGION_CHUNKS).flat().map(p => `${p.cx},${p.cy}`));
    for (const pack of packs) {
      expect(validatePack(pack), pack.id).toEqual([]);
      expect(pack.coverage).toBe('complete');
      expect(pack.sources.every(source => source.revision === '633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a')).toBe(true);
      for (const step of pack.steps) if (step.location) expect(canonical.has(`${step.location.cx},${step.location.cy}`), `${pack.id}: ${step.id}`).toBe(true);
    }
  });
  for (const mode of [undefined, 'chunked']) it.each(packs)(`completes $id from fresh supplies in ${mode ?? 'Standard'}`, pack => {
    let progress = prepare(pack);
    for (let count = 0; count < pack.steps.length; count++) {
      const next = evaluateGuide(pack, progress, unlocks, mode).next!;
      expect(next.state, `${pack.id}: ${next.reasons.join(', ')}`).toBe('available');
      progress = completeStep(pack, progress, next.step.id, unlocks, mode);
      expect(validProgress(progress, pack)).toBe(true);
    }
    expect(evaluateGuide(pack, progress, unlocks, mode).complete).toBe(true);
    if (pack.id === "Pirate's Treasure") {
      expect(progress.inventory.coins).toBe(0);
      expect(progress.inventory.banana).toBe(0);
      expect(progress.inventory['karamjan-rum']).toBe(0);
      expect(progress.inventory['white-apron']).toBe(1);
      expect(progress.inventory['chest-key']).toBe(1);
    }
    if (pack.id === 'Ernest the Chicken') expect(progress.inventory['closet-key']).toBe(1);
    if (supplies[pack.id].spade) expect(progress.inventory.spade).toBe(1);
    expect(unlocks.quests).toEqual([]);
  });
  it.each([
    ['X Marks the Spot', {}, 'dig-bob'], ['Ernest the Chicken', {}, 'find-key'],
    ["Pirate's Treasure", { coins: 59, banana: 10, 'white-apron': 1, spade: 1 }, 'sail-karamja'],
    ["Pirate's Treasure", { coins: 60, banana: 9, 'white-apron': 1, spade: 1 }, 'pack-crate'],
  ] as [string, Record<string, number>, string][])('blocks %s at its missing supply', (id, inventory, expectedStep) => {
    const pack = packs.find(pack => pack.id === id)!;
    let progress = prepare(pack, inventory);
    for (let count = 0; count < pack.steps.length; count++) {
      const next = evaluateGuide(pack, progress, unlocks).next!;
      if (next.state !== 'available') break;
      progress = completeStep(pack, progress, next.step.id, unlocks);
    }
    const result = evaluateGuide(pack, progress, unlocks);
    expect(result.next?.step.id).toBe(expectedStep);
    expect(result.next?.state).toBe('blocked');
    expect(completeStep(pack, progress, expectedStep, unlocks)).toBe(progress);
    expect(result.complete).toBe(false);
  });
  it.each(packs)('does not advance $id into a locked destination', pack => {
    // Lumbridge starter chunks are intentionally available without an explicit unlock.
    const lockedStep = pack.steps.find(step => step.location && !step.location.areas.includes('Lumbridge'))!;
    const chunk = `${lockedStep.location!.cx},${lockedStep.location!.cy}`;
    const locked = { ...unlocks, chunks: unlocks.chunks!.filter(id => id !== chunk) };
    let progress = prepare(pack);
    for (const step of pack.steps) {
      if (step.id === lockedStep.id) break;
      progress = completeStep(pack, progress, step.id, unlocks, 'chunked');
    }
    expect(evaluateGuide(pack, progress, locked, 'chunked').next?.state).toBe('blocked');
    expect(completeStep(pack, progress, lockedStep.id, locked, 'chunked')).toBe(progress);
  });
  it('uses explicit surface ladder anchors for both basement routes', () => {
    const ghost = packs.find(pack => pack.id === 'The Restless Ghost')!;
    expect(ghost.steps.find(step => step.id === 'recover-skull')?.location).toMatchObject({ cx: 48, cy: 49 });
    const ernest = packs.find(pack => pack.id === 'Ernest the Chicken')!;
    for (const id of ['enter-basement', 'levers-ab', 'lever-d', 'levers-ef', 'lever-c', 'raise-e']) expect(ernest.steps.find(step => step.id === id)?.location).toMatchObject({ cx: 48, cy: 52 });
  });
});

