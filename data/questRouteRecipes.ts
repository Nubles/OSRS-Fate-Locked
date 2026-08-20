import {
  canonicalItemKey,
  chunkKey,
  type ChunkKey,
  type Coverage,
  type ItemRef,
  type RouteGate,
} from '../utils/questRoutes/model';
import { usablePickaxes } from './questItemRequirements';

export interface RouteStation {
  entityKind: 'object' | 'npc';
  names: string[];
}

export interface RouteRecipe {
  id: string;
  kind: 'RECIPE' | 'GATHER';
  output: ItemRef;
  outputQuantity: number;
  ingredients: { item: ItemRef; quantity: number; alternatives?: ItemRef[] }[];
  tools: { item: ItemRef; consumed: boolean; alternatives?: ItemRef[] }[];
  stations: RouteStation[];
  gates: RouteGate[];
  deterministic: boolean;
  sourceRevision: string;
}

/** The small, exact shape supplied by ChunkContentService.entityLocations. */
export interface ExactEntityLocation {
  cx: number;
  cy: number;
}

export interface ExactEntityHit {
  name: string;
  kind: RouteStation['entityKind'];
  locations: readonly ExactEntityLocation[];
}

/**
 * Inject ChunkContentService.entityLocations here rather than importing the
 * service or any broad location map. Callers retain control of data loading.
 */
export type ExactEntityLocationLookup = (
  name: string,
  kind: RouteStation['entityKind'],
) => ExactEntityHit | null;

export type StationResolution =
  | {
    station: RouteStation;
    status: 'RESOLVED';
    chunks: ChunkKey[];
  }
  | {
    station: RouteStation;
    status: 'DATA_GAP';
    chunks: [];
    dataGap: string;
  };

const item = (name: string): ItemRef => ({ key: canonicalItemKey(name), name });

const miningGate = (level: number): RouteGate => ({
  type: 'SKILL', skill: 'Mining', level, label: `Mining level ${level}`,
});

const pickaxe = { item: item('Pickaxe'), consumed: false, alternatives: usablePickaxes };

const assertNonBlank = (value: string, label: string): void => {
  if (!value.trim()) throw new Error(`${label} must not be blank`);
};

const assertPositive = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`);
};

const validateItem = (value: ItemRef): void => {
  assertNonBlank(value.key, 'item key');
  assertNonBlank(value.name, 'item name');
  if (value.key !== canonicalItemKey(value.name)) {
    throw new Error(`item key must be canonical for ${value.name}`);
  }
};

const validateGate = (gate: RouteGate): void => {
  assertNonBlank(gate.label, 'gate label');
  switch (gate.type) {
    case 'QUEST':
      assertNonBlank(gate.questId, 'quest id');
      return;
    case 'SKILL':
      assertNonBlank(gate.skill, 'skill');
      assertPositive(gate.level, 'skill level');
      return;
    case 'UNLOCK':
      assertNonBlank(gate.id, 'unlock id');
      return;
    case 'UNRESOLVED':
      assertNonBlank(gate.raw, 'raw requirement');
      return;
  }
};

export const validateRouteRecipes = (recipes: readonly RouteRecipe[]): RouteRecipe[] => {
  const ids = new Set<string>();
  for (const recipe of recipes) {
    assertNonBlank(recipe.id, 'recipe id');
    if (ids.has(recipe.id)) throw new Error(`duplicate recipe id: ${recipe.id}`);
    ids.add(recipe.id);

    if (recipe.kind !== 'RECIPE' && recipe.kind !== 'GATHER') throw new Error('recipe kind must be RECIPE or GATHER');
    validateItem(recipe.output);
    assertPositive(recipe.outputQuantity, 'output quantity');
    assertNonBlank(recipe.sourceRevision, 'source revision');
    if (typeof recipe.deterministic !== 'boolean') throw new Error('deterministic must be boolean');

    recipe.ingredients.forEach(({ item: ingredient, quantity, alternatives }) => {
      validateItem(ingredient);
      assertPositive(quantity, 'ingredient quantity');
      if (ingredient.key === recipe.output.key) {
        throw new Error(`recipe ${recipe.id} cannot use its output as a direct ingredient`);
      }
      alternatives?.forEach(validateItem);
    });
    recipe.tools.forEach(({ item: tool, consumed, alternatives }) => {
      validateItem(tool);
      if (typeof consumed !== 'boolean') throw new Error('tool consumed must be boolean');
      alternatives?.forEach(validateItem);
    });
    recipe.stations.forEach((station) => {
      if (station.entityKind !== 'object' && station.entityKind !== 'npc') {
        throw new Error('station entity kind must be object or npc');
      }
      if (station.names.length === 0) throw new Error('station names must not be empty');
      station.names.forEach((name) => assertNonBlank(name, 'station name'));
    });
    recipe.gates.forEach(validateGate);
  }
  return [...recipes];
};

export const routeRecipes: readonly RouteRecipe[] = validateRouteRecipes([
  {
    id: 'logs-to-plank',
    kind: 'RECIPE',
    output: item('Plank'),
    outputQuantity: 1,
    ingredients: [
      { item: item('Logs'), quantity: 1 },
      { item: item('Coins'), quantity: 100 },
    ],
    tools: [],
    stations: [{ entityKind: 'object', names: ['Sawmill'] }],
    gates: [],
    deterministic: true,
    sourceRevision: '15251261',
  },
  {
    id: 'pick-wheat',
    kind: 'GATHER',
    output: item('Grain'),
    outputQuantity: 1,
    ingredients: [],
    tools: [],
    stations: [{ entityKind: 'object', names: ['Wheat'] }],
    gates: [],
    deterministic: true,
    sourceRevision: '15183493',
  },
  {
    id: 'grain-to-flour',
    kind: 'RECIPE',
    output: item('Pot of flour'),
    outputQuantity: 1,
    ingredients: [
      { item: item('Grain'), quantity: 1 },
      { item: item('Pot'), quantity: 1 },
    ],
    tools: [],
    stations: [{ entityKind: 'object', names: ['Hopper'] }],
    gates: [],
    deterministic: true,
    sourceRevision: '15183493',
  },
  {
    id: 'milk-cow',
    kind: 'GATHER',
    output: item('Bucket of milk'),
    outputQuantity: 1,
    ingredients: [{ item: item('Bucket'), quantity: 1 }],
    tools: [],
    stations: [{ entityKind: 'object', names: ['Dairy cow'] }],
    gates: [],
    deterministic: true,
    sourceRevision: '15281482',
  },
  {
    id: 'mine-clay',
    kind: 'GATHER',
    output: item('Clay'),
    outputQuantity: 1,
    ingredients: [],
    tools: [pickaxe],
    stations: [{ entityKind: 'object', names: ['Clay rocks'] }],
    gates: [miningGate(1)],
    deterministic: true,
    sourceRevision: '15209138',
  },
  {
    id: 'mine-copper',
    kind: 'GATHER',
    output: item('Copper ore'),
    outputQuantity: 1,
    ingredients: [],
    tools: [pickaxe],
    stations: [{ entityKind: 'object', names: ['Copper rocks'] }],
    gates: [miningGate(1)],
    deterministic: true,
    sourceRevision: '15209140',
  },
  {
    id: 'mine-iron',
    kind: 'GATHER',
    output: item('Iron ore'),
    outputQuantity: 1,
    ingredients: [],
    tools: [pickaxe],
    stations: [{ entityKind: 'object', names: ['Iron rocks'] }],
    gates: [miningGate(15)],
    deterministic: true,
    sourceRevision: '15281625',
  },
  {
    id: 'mine-coal',
    kind: 'GATHER',
    output: item('Coal'),
    outputQuantity: 1,
    ingredients: [],
    tools: [pickaxe],
    stations: [{ entityKind: 'object', names: ['Coal rocks'] }],
    gates: [miningGate(30)],
    deterministic: true,
    sourceRevision: '15281599',
  },
]);

/** Outputs whose reviewed RECIPE/GATHER family is explicitly complete. */
const COMPLETE_TRANSFORMATION_OUTPUTS = new Set([
  'plank',
  'grain',
  'pot of flour',
  'bucket of milk',
  'clay',
  'copper ore',
  'iron ore',
  'coal',
]);

export const transformationCoverageFor = (itemKey: string): Coverage => (
  COMPLETE_TRANSFORMATION_OUTPUTS.has(canonicalItemKey(itemKey)) ? 'COMPLETE' : 'PARTIAL'
);

export const recipesFor = (itemKey: string): RouteRecipe[] => {
  const key = canonicalItemKey(itemKey);
  return routeRecipes.filter((recipe) => recipe.output.key === key);
};

const foldedStationName = (name: string): string => name.toLocaleLowerCase('en-GB');

const exactChunksFor = (
  station: RouteStation,
  lookup: ExactEntityLocationLookup,
): ChunkKey[] => {
  const chunks = new Set<ChunkKey>();
  for (const name of station.names) {
    const hit = lookup(name, station.entityKind);
    if (
      hit === null
      || hit.kind !== station.entityKind
      || foldedStationName(hit.name) !== foldedStationName(name)
    ) continue;

    for (const location of hit.locations) {
      if (!Number.isInteger(location.cx) || !Number.isInteger(location.cy)) continue;
      chunks.add(chunkKey(location.cx, location.cy));
    }
  }
  return [...chunks].sort();
};

/**
 * Resolves only reviewed names through the injected exact entity index. This
 * function intentionally does not decide whether a candidate chunk is unlocked.
 */
export const resolveRecipeStations = (
  recipe: RouteRecipe,
  lookup: ExactEntityLocationLookup,
): StationResolution[] => recipe.stations.map((station) => {
  const chunks = exactChunksFor(station, lookup);
  if (chunks.length > 0) return { station, status: 'RESOLVED', chunks };
  return {
    station,
    status: 'DATA_GAP',
    chunks: [],
    dataGap: `No exact ${station.entityKind} location for reviewed station: ${station.names.join(', ')}`,
  };
});
