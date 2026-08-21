import { describe, expect, it } from 'vitest';
import {
  recipesFor,
  resolveRecipeStations,
  routeRecipes,
  transformationCoverageFor,
  validateRouteRecipes,
  type ExactEntityLocationLookup,
  type RouteRecipe,
} from './questRouteRecipes';
import { usablePickaxes } from './questItemRequirements';

const exactLocations: ExactEntityLocationLookup = (name, kind) => {
  if (kind === 'object' && name === 'Sawmill') {
    return {
      name: 'sAwMiLl',
      kind: 'object',
      locations: [{ cx: 1, cy: 2 }, { cx: 1, cy: 2 }, { cx: 3, cy: 4 }],
    };
  }
  return null;
};

const plankRecipe = (): RouteRecipe => ({
  id: 'logs-to-plank',
  kind: 'RECIPE',
  output: { key: 'plank', name: 'Plank' },
  outputQuantity: 1,
  ingredients: [
    { item: { key: 'logs', name: 'Logs' }, quantity: 1 },
    { item: { key: 'coins', name: 'Coins' }, quantity: 100 },
  ],
  tools: [],
  stations: [{ entityKind: 'object', names: ['Sawmill'] }],
  gates: [],
  deterministic: true,
  sourceRevision: '15251261',
});

describe('reviewed RuneProof recipe catalogue', () => {
  it('describes one normal plank as logs and coins at an exact sawmill', () => {
    expect(recipesFor('plank')).toContainEqual(plankRecipe());
  });

  it('does not allow higher-tier planks for Daddy\'s Home', () => {
    expect(recipesFor('plank').some((recipe) => recipe.output.key === 'oak plank')).toBe(false);
  });

  it('records the deterministic Sheep Shearer item chain with exact stations and tools', () => {
    expect(recipesFor('wool')).toContainEqual(expect.objectContaining({
      id: 'shear-sheep',
      kind: 'GATHER',
      outputQuantity: 1,
      tools: [expect.objectContaining({
        item: { key: 'shears', name: 'Shears' },
        consumed: false,
      })],
      stations: [{ entityKind: 'npc', names: ['Sheep'] }],
      deterministic: true,
      sourceRevision: '15271780',
    }));
    expect(recipesFor('ball of wool')).toContainEqual(expect.objectContaining({
      id: 'spin-wool',
      kind: 'RECIPE',
      outputQuantity: 1,
      ingredients: [{ item: { key: 'wool', name: 'Wool' }, quantity: 1 }],
      stations: [{ entityKind: 'object', names: ['Spinning wheel'] }],
      deterministic: true,
      sourceRevision: '15271780',
    }));
    expect(transformationCoverageFor('wool')).toBe('COMPLETE');
    expect(transformationCoverageFor('ball of wool')).toBe('COMPLETE');
  });

  it('records only the reviewed pilot acquisition rules with pinned sources', () => {
    expect(routeRecipes.map((recipe) => ({
      id: recipe.id,
      kind: recipe.kind,
      output: recipe.output.key,
      revision: recipe.sourceRevision,
    }))).toEqual([
      { id: 'logs-to-plank', kind: 'RECIPE', output: 'plank', revision: '15251261' },
      { id: 'pick-wheat', kind: 'GATHER', output: 'grain', revision: '15183493' },
      { id: 'grain-to-flour', kind: 'RECIPE', output: 'pot of flour', revision: '15183493' },
      { id: 'milk-cow', kind: 'GATHER', output: 'bucket of milk', revision: '15281482' },
      { id: 'shear-sheep', kind: 'GATHER', output: 'wool', revision: '15271780' },
      { id: 'spin-wool', kind: 'RECIPE', output: 'ball of wool', revision: '15271780' },
      { id: 'mine-clay', kind: 'GATHER', output: 'clay', revision: '15209138' },
      { id: 'mine-copper', kind: 'GATHER', output: 'copper ore', revision: '15209140' },
      { id: 'mine-iron', kind: 'GATHER', output: 'iron ore', revision: '15281625' },
      { id: 'mine-coal', kind: 'GATHER', output: 'coal', revision: '15281599' },
    ]);
  });

  it('restores the reviewed local wheat-to-grain route', () => {
    expect(routeRecipes).toContainEqual({
      id: 'pick-wheat',
      kind: 'GATHER',
      output: { key: 'grain', name: 'Grain' },
      outputQuantity: 1,
      ingredients: [],
      tools: [],
      stations: [{ entityKind: 'object', names: ['Wheat'] }],
      gates: [],
      deterministic: true,
      sourceRevision: '15183493',
    });
    expect(transformationCoverageFor('grain')).toBe('COMPLETE');
  });

  it('marks only explicitly reviewed transformation outputs complete', () => {
    expect(routeRecipes.map(recipe => transformationCoverageFor(recipe.output.key)))
      .toEqual(routeRecipes.map(() => 'COMPLETE'));
    expect(transformationCoverageFor('Egg')).toBe('PARTIAL');
    expect(transformationCoverageFor('Unreviewed output')).toBe('PARTIAL');
  });

  it('keeps pots and buckets consumed while pickaxes remain reusable tools', () => {
    expect(recipesFor('pot of flour')).toContainEqual(expect.objectContaining({
      ingredients: [
        { item: { key: 'grain', name: 'Grain' }, quantity: 1 },
        { item: { key: 'pot', name: 'Pot' }, quantity: 1 },
      ],
      tools: [],
      stations: [{ entityKind: 'object', names: ['Hopper'] }],
    }));
    expect(recipesFor('bucket of milk')).toContainEqual(expect.objectContaining({
      ingredients: [{ item: { key: 'bucket', name: 'Bucket' }, quantity: 1 }],
      tools: [],
      stations: [{ entityKind: 'object', names: ['Dairy cow'] }],
    }));
    expect(recipesFor('iron ore')).toContainEqual(expect.objectContaining({
      ingredients: [],
      tools: [expect.objectContaining({ item: { key: 'pickaxe', name: 'Pickaxe' }, consumed: false })],
      stations: [{ entityKind: 'object', names: ['Iron rocks'] }],
      gates: [{ type: 'SKILL', skill: 'Mining', level: 15, label: 'Mining level 15' }],
    }));
    expect(recipesFor('iron ore')[0].tools[0].alternatives).toBe(usablePickaxes);
  });

  it('resolves exact case-insensitive station hits into deduplicated chunk candidates', () => {
    expect(resolveRecipeStations(plankRecipe(), exactLocations)).toEqual([
      {
        station: { entityKind: 'object', names: ['Sawmill'] },
        status: 'RESOLVED',
        chunks: ['1,2', '3,4'],
      },
    ]);
  });

  it('resolves milk-cow through an exact object Dairy cow hit', () => {
    const dairyCowLocations: ExactEntityLocationLookup = (name, kind) => {
      if (kind === 'object' && name === 'Dairy cow') {
        return { name: 'dAiRy CoW', kind: 'object', locations: [{ cx: 19, cy: 57 }] };
      }
      return null;
    };

    expect(resolveRecipeStations(recipesFor('bucket of milk')[0], dairyCowLocations)).toEqual([
      {
        station: { entityKind: 'object', names: ['Dairy cow'] },
        status: 'RESOLVED',
        chunks: ['19,57'],
      },
    ]);
  });

  it('reports a local data gap when a reviewed station has no exact location', () => {
    expect(resolveRecipeStations(plankRecipe(), () => null)).toEqual([
      {
        station: { entityKind: 'object', names: ['Sawmill'] },
        status: 'DATA_GAP',
        chunks: [],
        dataGap: 'No exact object location for reviewed station: Sawmill',
      },
    ]);
  });

  it('does not treat a substring entity hit as a usable station', () => {
    const substringHit: ExactEntityLocationLookup = () => ({
      name: 'Sawmill operator', kind: 'object', locations: [{ cx: 1, cy: 2 }],
    });

    expect(resolveRecipeStations(plankRecipe(), substringHit)[0]).toMatchObject({
      status: 'DATA_GAP', chunks: [],
    });
  });

  it.each([
    ['non-positive output quantity', (recipe: RouteRecipe) => { recipe.outputQuantity = 0; }],
    ['non-positive ingredient quantity', (recipe: RouteRecipe) => { recipe.ingredients[0].quantity = 0; }],
    ['blank station name', (recipe: RouteRecipe) => { recipe.stations[0].names = ['']; }],
    ['output as direct ingredient', (recipe: RouteRecipe) => { recipe.ingredients = [{ item: recipe.output, quantity: 1 }]; }],
  ])('rejects %s', (_label, change) => {
    const recipe = plankRecipe();
    change(recipe);
    expect(() => validateRouteRecipes([recipe])).toThrow();
  });

  it('rejects duplicate recipe IDs', () => {
    expect(() => validateRouteRecipes([plankRecipe(), plankRecipe()])).toThrow('duplicate recipe id: logs-to-plank');
  });
});
