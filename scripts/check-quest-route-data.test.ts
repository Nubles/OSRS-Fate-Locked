import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reviewedQuestRequirements } from '../data/questItemRequirements';
import { routeRecipes } from '../data/questRouteRecipes';
import { classifyShop } from '../utils/shopClassification';
import { checkQuestRouteData, runQuestRouteDataCheck } from './check-quest-route-data.mjs';

const item = (name: string) => ({
  key: name.trim().toLocaleLowerCase('en-GB').replace(/\s+/g, ' '),
  name,
});
const quest = (overrides = {}) => ({
  questId: 'Test Quest', wikiRevision: '12345678', reviewedAt: '2026-08-20',
  items: [{ item: item('Test item'), quantity: 1, supplyPolicy: 'PLAYER_OBTAINED' }],
  ...overrides,
});
const recipe = (overrides = {}) => ({
  id: 'test-recipe', kind: 'RECIPE', output: item('Test item'), outputQuantity: 1,
  ingredients: [], tools: [], stations: [{ entityKind: 'object', names: ['Test station'] }],
  gates: [], deterministic: true, sourceRevision: '12345678', ...overrides,
});
const validInput = (overrides = {}) => ({
  quests: [quest()], recipes: [recipe()],
  generatedStations: [{ name: 'Test station', kind: 'object' }],
  executableSources: [{ id: 'generated', provenance: ['public/chunk-content.json'] }],
  ...overrides,
});

describe('RuneProof route-data verifier', () => {
  it('rejects duplicate IDs with stable diagnostics', () => {
    expect(checkQuestRouteData(validInput({
      quests: [quest(), quest()], recipes: [recipe(), recipe()],
    }))).toEqual([
      'quest:Test Quest: duplicate reviewed quest ID',
      'recipe:test-recipe: duplicate reviewed recipe ID',
    ]);
  });

  it('rejects invalid quantities, revisions, and canonical identities', () => {
    expect(checkQuestRouteData(validInput({
      quests: [quest({
        wikiRevision: 'latest',
        items: [{ item: { key: 'soft clay', name: 'Clay' }, quantity: 0 }],
      })],
      recipes: [recipe({ sourceRevision: '', outputQuantity: -1 })],
    }))).toEqual([
      'quest:Test Quest/item:soft clay: item key is not the canonical identity for Clay',
      'quest:Test Quest/item:soft clay: quantity must be a positive finite number',
      'quest:Test Quest: wiki revision must be a pinned numeric revision',
      'recipe:test-recipe/output:test item: quantity must be a positive finite number',
      'recipe:test-recipe: source revision must be a pinned numeric revision',
    ]);
  });

  it('rejects alternatives outside reviewed families', () => {
    expect(checkQuestRouteData(validInput({
      quests: [quest({
        items: [{ item: item('Clay'), quantity: 6, alternatives: [item('Soft clay')] }],
      })],
    }))).toEqual([
      'quest:Test Quest/item:clay/alternative:soft clay: alternative is not approved for item family clay',
    ]);
  });

  it('rejects missing exact stations and resourceData-only executable evidence', () => {
    expect(checkQuestRouteData(validInput({
      generatedStations: [],
      executableSources: [{ id: 'coarse', provenance: ['data/resourceData.ts'] }],
    }))).toEqual([
      'recipe:test-recipe/station:Test station: exact object is absent from generated chunk content',
      'source:coarse: executable evidence cannot derive only from data/resourceData.ts',
    ]);
  });

  it('returns a non-zero exit and writes every sorted diagnostic', () => {
    const writes: string[] = [];
    expect(runQuestRouteDataCheck(validInput({ quests: [quest({ items: [] })] }), value => writes.push(value)))
      .toBe(1);
    expect(writes).toEqual(['quest:Test Quest: supported quest has no item requirements']);
  });

  it('accepts every reviewed pilot against checked-in exact chunk stations', () => {
    const pilotQuestIds = [
      "Cook's Assistant", "Daddy's Home", "Doric's Quest", 'Elemental Workshop I',
    ];
    const chunkContent = JSON.parse(readFileSync(
      new URL('../public/chunk-content.json', import.meta.url), 'utf8',
    ));
    const generatedStations = Object.values(chunkContent.chunks).flatMap((entry: any) => [
      ...(entry.o ?? []).map(([name]: [string]) => ({ name, kind: 'object' })),
      ...(entry.p ?? []).map((name: string) => ({ name, kind: 'npc' })),
    ]);

    expect(checkQuestRouteData({
      quests: pilotQuestIds.map(id => reviewedQuestRequirements(id)),
      recipes: routeRecipes,
      generatedStations,
      executableSources: [
        { id: 'generated', provenance: ['public/chunk-content.json'] },
        { id: 'recipes', provenance: ['data/questRouteRecipes.ts'] },
      ],
    })).toEqual([]);
  });

  it('classifies every executable shop source reached by reviewed routes', () => {
    const chunkContent = JSON.parse(readFileSync(
      new URL('../public/chunk-content.json', import.meta.url), 'utf8',
    ));
    const reviewedNames = new Set<string>();
    const pending = [
      "Cook's Assistant", "Daddy's Home", "Doric's Quest", 'Elemental Workshop I',
    ].flatMap(id => reviewedQuestRequirements(id)?.items.flatMap(requirement => [
      requirement.item, ...(requirement.alternatives ?? []),
    ]) ?? []);
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (reviewedNames.has(current.name)) continue;
      reviewedNames.add(current.name);
      for (const route of routeRecipes.filter(entry => entry.output.key === current.key)) {
        pending.push(...route.ingredients.flatMap(entry => [entry.item, ...(entry.alternatives ?? [])]));
        pending.push(...route.tools.flatMap(entry => [entry.item, ...(entry.alternatives ?? [])]));
      }
    }
    const unclassified = Object.entries(chunkContent.shopItems)
      .filter(([shop, stock]: [string, any]) => (
        stock.some((name: string) => reviewedNames.has(name)) && classifyShop(shop) === null
      ))
      .map(([shop]) => shop)
      .sort();
    expect(unclassified).toEqual([]);
  });
});
