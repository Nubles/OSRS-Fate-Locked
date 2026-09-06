import { describe, expect, it } from 'vitest';
import { GUIDE_PACKS } from './packs';
import { answerQuestion, completeStep, evaluateGuide, freshProgress, setInventory, validatePack } from './engine';
import { REGION_CHUNKS } from '../../data/regionChunks';
import { SUB_AREA_CHUNKS } from '../../data/subAreaChunks';
import { areaId } from '../../data/areaCatalog';
import type { UnlockState } from '../../types';

const unlocks = {
  regions: ['Lumbridge', 'Varrock', "Wizards' Tower"], skills: { Crafting: 1 }, levels: { Crafting: 1 },
  quests: [], chunks: [], mobility: [], arcana: [], guilds: [], equipment: {},
} as unknown as UnlockState;
const pack = (id: string) => GUIDE_PACKS.find(pack => pack.id === id)!;

describe('reviewed RuneProof packs', () => {
  it('contains valid graphs, source identities and canonical surface locations', () => {
    const map = new Set(Object.values(REGION_CHUNKS).flat().map(p => `${p.cx},${p.cy}`));
    expect(new Set(GUIDE_PACKS.map(p => p.id)).size).toBe(GUIDE_PACKS.length);
    for (const p of GUIDE_PACKS) {
      expect(validatePack(p), p.id).toEqual([]);
      expect(p.coverage).toBe('complete');
      for (const source of p.sources) {
        expect(source.revision).toBe('633ab56e2eb3eb363f21da3fd75f6f2bc0fa073a');
        expect(source.path).toMatch(/^src\/main\/java\/com\/questhelper\/helpers\/quests\/\w+\/\w+\.java$/);
      }
      for (const step of p.steps) {
        expect(Boolean(step.location) || step.portable === true, `${p.id}:${step.id}: reviewed destination or inventory action`).toBe(true);
        if (step.portable) { expect(step.location).toBeUndefined(); continue; }
        const location = step.location!;
        expect(map.has(`${location.cx},${location.cy}`)).toBe(true);
        for (const area of location.areas) {
          expect(areaId(area)).toBeTruthy();
          // RumSmugglingStep pins the Musa Point customs officer at (2955,3146).
          // The coarse surface owner is Port Sarim; Standard access is Musa Point.
          if (p.id === "Pirate's Treasure" && step.id === 'return-sarim') {
            expect(location).toMatchObject({ cx: 46, cy: 49, areas: ['Musa Point'] });
            continue;
          }
          expect(SUB_AREA_CHUNKS[area]).toContainEqual({ cx: location.cx, cy: location.cy });
        }
      }
    }
  });

  it.each([
    ["Cook's Assistant", { egg: 1, 'bucket-of-milk': 1, 'pot-of-flour': 1 }, undefined],
    ['Sheep Shearer', { 'ball-of-wool': 20 }, 'prepared'],
    ['Sheep Shearer', { wool: 20 }, 'raw'],
    ['Sheep Shearer', { shears: 1 }, 'shear'],
    ['Rune Mysteries', {}, undefined],
    ['Romeo & Juliet', { 'cadava-berries': 1 }, undefined],
  ] as const)('finishes %s with its chosen supplies and preserves inventory accounting', (id, supplies, branch) => {
    const p = pack(id);
    let progress = freshProgress(p);
    if (branch) progress = answerQuestion(p, progress, 'wool-route', branch);
    for (const [item, quantity] of Object.entries(supplies)) progress = setInventory(p, progress, item, quantity);
    for (let guard = 0; guard < p.steps.length; guard++) {
      const evaluation = evaluateGuide(p, progress, unlocks);
      if (evaluation.complete) break;
      expect(evaluation.next, JSON.stringify(evaluation.steps)).toBeDefined();
      expect(evaluation.next?.state, JSON.stringify(evaluation.steps)).toBe('available');
      progress = completeStep(p, progress, evaluation.next!.step.id, unlocks);
    }
    expect(evaluateGuide(p, progress, unlocks).complete).toBe(true);
    expect(Object.values(progress.inventory).every(quantity => quantity >= 0)).toBe(true);
    if (id === 'Rune Mysteries') {
      expect(progress.inventory['air-talisman']).toBe(1);
      expect(progress.inventory['research-package']).toBe(0);
      expect(progress.inventory['research-notes']).toBe(0);
    }
    if (id === 'Sheep Shearer') {
      expect(progress.inventory['ball-of-wool']).toBe(0);
      expect(progress.inventory.coins).toBe(60);
    }
  });

  it('requires twenty finished balls, and only the spinning branches require a Crafting method', () => {
    const p = pack('Sheep Shearer');
    const locked = { ...unlocks, skills: {}, levels: { Crafting: 99 } } as UnlockState;
    let prepared = answerQuestion(p, freshProgress(p), 'wool-route', 'prepared');
    prepared = setInventory(p, prepared, 'ball-of-wool', 19);
    expect(evaluateGuide(p, prepared, locked).next?.state).toBe('blocked');
    prepared = setInventory(p, prepared, 'ball-of-wool', 20);
    expect(evaluateGuide(p, prepared, locked).next?.step.id).toBe('hand-over-wool');
    let raw = answerQuestion(p, freshProgress(p), 'wool-route', 'raw');
    raw = setInventory(p, raw, 'wool', 20);
    expect(evaluateGuide(p, raw, locked).steps.find(s => s.step.id === 'spin-owned')?.state).toBe('blocked');
    expect(p.steps.find(s => s.id === 'hand-over-wool')?.consume).toEqual({ 'ball-of-wool': 20 });
  });

  it('does not invent Cooking, Herblore, essence mining or merchant purchase gates', () => {
    for (const id of ["Cook's Assistant", 'Rune Mysteries', 'Romeo & Juliet']) {
      expect(pack(id).steps.flatMap(step => step.requires).filter(req => req.kind === 'permission')).toEqual([]);
    }
    expect(pack('Romeo & Juliet').steps.find(step => step.id === 'potion')?.consume).toEqual({ 'cadava-berries': 1 });
    expect(pack('Rune Mysteries').steps.filter(step => step.location?.areas.includes("Wizards' Tower"))
      .every(step => step.location?.cx === 48 && step.location.cy === 49)).toBe(true);
  });
});
