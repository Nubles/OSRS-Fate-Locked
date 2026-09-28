/**
 * Golden bundles: the contract between this app's rules export and the
 * plugin. For a fixed set of runs this writes the bundle exactly as the relay
 * path makes it (buildBundlePayload with requireRulesData) and the app's own
 * answers from its choke points: chunkUnlocked for every land and ocean
 * chunk, isAreaReachable for every named area, isBankReachable for every
 * bank, and normalizeAccountName for account pairs. The plugin copies these
 * files at a pinned commit and checks that its codec and rule engine agree.
 *
 * `npm test` runs this in check mode: it fails when the committed files no
 * longer match what the app produces. After an intended change, run
 * `npm run goldens:write` and review the .expect.json diff: it shows exactly
 * which decisions changed.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync, gzipSync } from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildBundlePayload } from '../utils/runeliteExport';
import { RULES_CAPABILITIES } from '../utils/runeliteRulesManifest';
import { chunkUnlocked } from '../utils/chunkLocations';
import { isAreaReachable, isBankReachable } from '../utils/reachability';
import { ALL_CHUNK_KEYS, chunkKey, getChunkFrontier } from '../utils/chunkAdjacency';
import { freeAreasFor, setStartArea } from '../utils/freeAreas';
import { getGameMode, resolveModeRules, type GameModeRules } from '../config/gameModes';
import { normalizeAccountName } from '../services/fateEventProtocol';
import { chunkContentService, CHUNK_CONTENT_DATA_VERSION } from '../services/ChunkContentService';
import { runReach } from '../utils/chunkEntry';
import { chunkEntries, rulesPlaces } from '../utils/chunkEntries';
import { bankDecisions } from '../utils/bankDecisions';
import { runProgress } from '../utils/runProgress';
import { slayerDecisions, slayerLocate } from '../utils/slayerDecisions';
import { slayerReachability } from '../utils/slayerReach';
import { travelDecisions, type TravelMethodDecision } from '../utils/travelDecisions';
import { TRAVEL_METHODS } from '../data/travelMethods';
import { EQUIPMENT_CATALOGUE } from '../data/equipmentCatalogue';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import { REGION_GROUPS } from '../data/items';
import { BANKS } from '../data/banks';
import { OCEAN_CHUNK_KEYS } from '../utils/oceanAccess';
import { RUNELITE_WORDING } from '../data/runeliteWording';
import { MAX_REQUEST_BYTES } from '../workers/fate-relay/protocol.js';
import type { UnlockState } from '../types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'contracts', 'golden-bundles');
const WRITE = process.env.FATE_GOLDENS === 'write';
const SCHEMA = 2;
const EXPORTED_AT = new Date('2026-09-25T12:00:00.000Z');
const SIZE_BUDGET_BYTES = 3.5 * 1024 * 1024;
/** The travel section's share of a bundle, compressed. */
const TRAVEL_BUDGET_BYTES = 16 * 1024;
/** Headroom under the largest request the relay accepts, for every run. */
const RELAY_BODY_BUDGET_BYTES = MAX_REQUEST_BYTES - 16 * 1024;
/** The relay write token: randomToken's 18 bytes as hex. */
const RELAY_TOKEN = 'f'.repeat(36);
const ACCOUNT = 'Iron Example';

interface Scenario {
  id: string;
  /** What the run exercises, for someone reading a failing diff. */
  covers: string;
  mode: string;
  custom?: GameModeRules;
  account?: string;
  regions?: string[];
  chunks?: string[];
  banks?: string[];
  equipment?: Record<string, number>;
  quests?: string[];
  /** Skill tiers and levels on top of a fresh run's. */
  skills?: Record<string, number>;
  levels?: Record<string, number>;
  /** Sailing unlocked with Pandemonium done, which opens the ocean. */
  sailing?: boolean;
  /** Travel unlocks and diaries, for the travel decisions. */
  mobility?: string[];
  arcana?: string[];
  diaries?: string[];
}

const customRules = (startArea: 'misthalin' | 'lumbridge' | 'none', bankLocks: boolean): GameModeRules =>
  ({ ...getGameMode('vanilla').rules, startArea, bankLocks });

/**
 * Banks by id, which stays fixed when a label is corrected; the names only
 * say which bank each id is.
 */
const AL_KHARID_BANK = '13105';
const ARDOUGNE_SOUTH_BANK = '10547';
const bankIds = (...ids: string[]) =>
  ids.map((id) => {
    if (!BANKS.some((bank) => bank.id === id)) throw new Error(`no bank with id ${id}`);
    return id;
  });

const SCENARIOS: Scenario[] = [
  { id: 'vanilla-fresh', covers: 'Misthalin free, nothing rolled', mode: 'vanilla', account: ACCOUNT },
  {
    id: 'vanilla-mid',
    covers: 'rolled sub-areas, an alias, a chunkless interior area, banks and gear tiers',
    mode: 'vanilla',
    account: ACCOUNT,
    regions: ['Falador', 'Port Sarim', 'Catherby', 'Baxtorian Falls', 'Keldagrim', 'Zanaris'],
    banks: bankIds(AL_KHARID_BANK, ARDOUGNE_SOUTH_BANK),
    equipment: { Weapon: 2, Body: 1 },
  },
  {
    id: 'vanilla-asgarnia-complete',
    covers: 'every Asgarnia sub-area rolled, so the continent counts as complete',
    mode: 'vanilla',
    account: ACCOUNT,
    regions: [...REGION_GROUPS.Asgarnia],
  },
  { id: 'vanilla-continent', covers: 'a continent rolled directly', mode: 'vanilla', account: ACCOUNT, regions: ['Kandarin'] },
  { id: 'vanilla-unbound', covers: 'no bound account', mode: 'vanilla', regions: ['Falador'] },
  { id: 'xtreme-varrock', covers: 'Lumbridge-only start plus Varrock', mode: 'xtreme', account: ACCOUNT, regions: ['Varrock'] },
  { id: 'chunked-fresh', covers: 'Chunked with only the free start chunk', mode: 'chunked', account: ACCOUNT, chunks: [] },
  {
    id: 'chunked-walk',
    covers: 'Chunked walk west from Lumbridge into Asgarnia',
    mode: 'chunked',
    account: ACCOUNT,
    chunks: ['49,50', '48,50', '48,51', '47,51', '46,51', '46,52'],
  },
  {
    id: 'custom-lumbridge-banks-off',
    covers: 'Custom Lumbridge-only start with bank locks off',
    mode: 'custom',
    custom: customRules('lumbridge', false),
    account: ACCOUNT,
    regions: ['Draynor Village'],
  },
  {
    id: 'custom-none-banks-on',
    covers: 'Custom with no free areas and bank locks on',
    mode: 'custom',
    custom: customRules('none', true),
    account: ACCOUNT,
    regions: ['Falador'],
    banks: bankIds(AL_KHARID_BANK),
  },
  {
    id: 'chunked-sailing',
    covers: 'Chunked with Sailing, so the frontier reaches land across the sea',
    mode: 'chunked',
    account: ACCOUNT,
    chunks: ['49,50', '49,49'],
    sailing: true,
  },
  {
    id: 'vanilla-sailing',
    covers: 'Sailing with Pandemonium done, so every ocean chunk opens',
    mode: 'vanilla',
    account: ACCOUNT,
    regions: ['Falador', 'Port Sarim', 'Keldagrim'],
    sailing: true,
  },
  {
    id: 'vanilla-interiors',
    covers: 'interiors behind open and locked entrances and areas, with Slayer levels so masters differ, and travel unlocks',
    mode: 'vanilla',
    account: ACCOUNT,
    // Keldagrim with its entrance and quest; Musa Point without the TzHaar city.
    regions: ['Keldagrim', 'Mountain Camp', 'Port Sarim', 'Musa Point', 'Taverley', 'Burthorpe', 'Zanaris'],
    quests: ['The Giant Dwarf', 'Lost City', 'Priest in Peril'],
    skills: { Slayer: 6, Attack: 6, Strength: 6, Defence: 6, Hitpoints: 6, Ranged: 6, Magic: 6, Prayer: 5 },
    levels: { Slayer: 55, Attack: 60, Strength: 60, Defence: 60, Hitpoints: 60, Ranged: 60, Magic: 60, Prayer: 43 },
    mobility: ['Jewelry Teleports', 'Teleport Tablets'],
    arcana: ['Ancient Magicks'],
    diaries: ['Varrock Medium'],
  },
];

/** Bound account, logged-in name, and whether the app treats them as one. */
const ACCOUNT_PAIRS: [string, string][] = [
  [ACCOUNT, ACCOUNT],
  [ACCOUNT, 'iron example'],
  [ACCOUNT, ' Iron Example '],
  [ACCOUNT, 'Iron Example'],
  [ACCOUNT, 'Iron  Example'],
  [ACCOUNT, 'Iron_Example'],
  [ACCOUNT, 'Iron-Example'],
  [ACCOUNT, 'Zezima'],
];

const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Arrays sorted and object keys ordered, so comparisons ignore the order the
 * app happened to produce: some of its lists sort with the machine's locale.
 */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical)
      .map((item) => [JSON.stringify(item), item] as const)
      .sort(([a], [b]) => byCodeUnit(a, b))
      .map(([, item]) => item);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort(byCodeUnit)
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])]));
  }
  return value;
}

const sameContent = (a: unknown, b: unknown) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const textBytes = (value: unknown) => Buffer.from(JSON.stringify(value, null, 1) + '\n', 'utf8');

const coordsOf = (key: string) => {
  const [cx, cy] = key.split(',').map(Number);
  return { cx, cy };
};

function unlocksFor(fresh: UnlockState, scenario: Scenario): UnlockState {
  const sailing = scenario.sailing
    ? { skills: { Sailing: 1 }, levels: { Sailing: 1 }, quests: ['Pandemonium'] }
    : { skills: {}, levels: {}, quests: [] };
  return {
    ...structuredClone(fresh),
    regions: scenario.regions ?? [],
    chunks: scenario.chunks ?? [],
    banks: scenario.banks ?? [],
    equipment: { ...fresh.equipment, ...scenario.equipment },
    quests: [...fresh.quests, ...(scenario.quests ?? []), ...sailing.quests],
    skills: { ...fresh.skills, ...scenario.skills, ...sailing.skills },
    levels: { ...fresh.levels, ...scenario.levels, ...sailing.levels },
    mobility: [...fresh.mobility, ...(scenario.mobility ?? [])],
    arcana: [...fresh.arcana, ...(scenario.arcana ?? [])],
    diaries: [...fresh.diaries, ...(scenario.diaries ?? [])],
  };
}

function allChunkKeys(rulesChunks: Record<string, unknown>): string[] {
  const keys = new Set<string>(Object.keys(rulesChunks));
  for (const list of [...Object.values(REGION_CHUNKS), ...Object.values(SUB_AREA_CHUNKS)]) {
    for (const coord of list) keys.add(chunkKey(coord));
  }
  for (const key of OCEAN_CHUNK_KEYS) keys.add(key);
  return [...keys].sort(byCodeUnit);
}

/** Every named area: those with chunk data plus every continent and sub-area, interiors included. */
const AREA_NAMES = [...new Set([
  ...Object.keys(SUB_AREA_CHUNKS),
  ...Object.keys(REGION_CHUNKS),
  ...Object.keys(REGION_GROUPS),
  ...Object.values(REGION_GROUPS).flat(),
])].sort(byCodeUnit);

/**
 * The travel options each golden pins, as "<method>|<option>", or
 * "<method>|code:<code>" for a fairy ring code: the spells and jewellery the
 * old table got wrong (G6, G7) and a sample of every kind. The bundle sends
 * every option; these few keep the files small.
 */
const TRAVEL_ANSWERS = [
  'spell:standard:lumbridge-teleport|Cast', 'spell:standard:falador-teleport|Cast', 'spell:standard:varrock-teleport|Cast',
  'spell:ancient:senntisten-teleport|Cast', 'spell:ancient:carrallanger-teleport|Cast',
  'spell:standard:ape-atoll-teleport|Cast', 'spell:arceuus:ape-atoll-teleport|Cast', 'spell:lunar:moonclan-teleport|Cast',
  'tablet:varrock-teleport|Break', 'tablet:varrock-teleport|Grand Exchange', 'tablet:rimmington-teleport|Break',
  'scroll:nardah-teleport|Teleport',
  'item:amulet-of-glory|Rub', 'item:amulet-of-glory|Edgeville', 'item:ring-of-dueling|Castle Wars',
  'item:digsite-pendant|Rub', 'item:digsite-pendant|Fossil Island', 'item:slayer-ring|Teleport',
  "item:xerics-talisman|Xeric's Lookout", "item:drakans-medallion|Ver Sinhaza", "item:necklace-of-passage|Eagles' Eyrie",
  'item:enchanted-lyre|Play', 'item:ardougne-cloak|Kandarin Monastery', 'item:cowbell-amulet|Teleport',
  'item:amulet-of-the-eye|Teleport',
  'network:fairy-ring|Zanaris', 'network:fairy-ring|code:CKS', 'network:fairy-ring|code:BLQ',
  'network:spirit-tree|Travel', 'network:charter-ship|Charter-to Port Sarim',
  'boat:musa-point-ship|Port Sarim', 'boat:neitiznot-ferry|Neitiznot',
];

/** One pinned option's decision, looked up the way the key names it. */
function travelAnswer(decisions: Record<string, TravelMethodDecision>, key: string) {
  const [method, option] = key.split('|');
  const decision = option.startsWith('code:')
    ? decisions[method]?.codes?.[option.slice('code:'.length)]
    : decisions[method]?.options[option];
  if (!decision) throw new Error(`no travel decision for ${key}`);
  return decision;
}

interface Generated {
  bundle: Record<string, unknown>;
  expect: Record<string, unknown>;
  /** The compressed bundle as the app publishes it: "FLGZ:" and base64 gzip. */
  compressed: string;
}

/** The request the app sends the relay to publish a bundle (relaySync's sendPayload). */
const relayBodyBytes = (compressed: string) =>
  Buffer.byteLength(JSON.stringify({ token: RELAY_TOKEN, payload: compressed }), 'utf8');

async function generate(scenario: Scenario, fresh: UnlockState): Promise<Generated> {
  setStartArea(resolveModeRules(scenario.mode, scenario.custom).startArea);
  const unlocks = unlocksFor(fresh, scenario);
  const { json, compressed } = await buildBundlePayload(unlocks, {
    runId: `golden-${scenario.id}`,
    runRevision: 7,
    keys: 3,
    specialKeys: 1,
    chaosKeys: 0,
    fatePoints: 5,
    activeBuff: 'NONE',
    pinnedGoals: [],
    linkedAccount: scenario.account,
    gameModeId: scenario.mode,
    customMode: scenario.custom,
  }, { requireRulesData: true });
  const bundle = JSON.parse(json) as Record<string, unknown> & { rules: { chunks: Record<string, unknown> } };

  const chunks = Object.fromEntries(allChunkKeys(bundle.rules.chunks).map((key) => {
    const { cx, cy } = coordsOf(key);
    return [key, chunkUnlocked(cx, cy, unlocks, scenario.mode)];
  }));
  const areas = Object.fromEntries(AREA_NAMES.map((name) => [name, isAreaReachable(name, unlocks, scenario.mode)]));
  const banks = Object.fromEntries(BANKS.filter((bank) => /^\d+$/.test(bank.id)).map((bank) => {
    const id = Number(bank.id);
    return [bank.id, isBankReachable(Math.floor(id / 256), id % 256, unlocks, scenario.mode, scenario.custom)];
  }));
  const frontier = scenario.mode === 'chunked'
    ? getChunkFrontier(scenario.chunks ?? [], unlocks).map(chunkKey).sort(byCodeUnit)
    : undefined;
  // Land, ocean and interiors, with the run's reach, as the app decides them.
  const reachable = runReach(chunkContentService, unlocks, scenario.mode);
  const entries = chunkEntries(chunkContentService, unlocks, scenario.mode, reachable);
  const bankStatus = Object.fromEntries(Object.entries(bankDecisions(chunkContentService, {
    unlocks, gameModeId: scenario.mode, customMode: scenario.custom, contentService: chunkContentService, reachableChunks: reachable,
  })).map(([id, decision]) => [id, decision.status]));

  return {
    bundle,
    compressed,
    expect: {
      schema: SCHEMA,
      id: scenario.id,
      covers: scenario.covers,
      gameModeId: scenario.mode,
      account: scenario.account ?? null,
      oceanChunkCount: OCEAN_CHUNK_KEYS.size,
      chunks,
      areas,
      banks,
      ...(frontier ? { frontier } : {}),
      entries,
      bankStatus,
      freeAreas: freeAreasFor(scenario.mode, scenario.custom),
      progress: runProgress(unlocks, scenario.mode),
      slayer: Object.fromEntries(Object.entries(slayerDecisions(slayerReachability(chunkContentService.slayerMasters(), unlocks,
        slayerLocate(chunkContentService, unlocks, scenario.mode), scenario.mode))).map(([key, task]) => [key, task.status])),
      travel: Object.fromEntries(TRAVEL_ANSWERS.map((key) =>
        [key, travelAnswer(travelDecisions(TRAVEL_METHODS, { unlocks, entries }), key).status])),
    },
  };
}

const accountCases = () => ({
  schema: SCHEMA,
  pairs: ACCOUNT_PAIRS.map(([bound, player]) => ({
    bound,
    player,
    match: normalizeAccountName(bound) === normalizeAccountName(player),
  })),
});

/** Inflated size of the gzip bomb: past the 8 MiB both readers accept. */
const BOMB_INFLATED_BYTES = 9 * 1024 * 1024;

interface BundleCase {
  name: string;
  /** The input text, when the case does not start from a scenario's bundle. */
  input?: string;
  /** Repeat the input text this many times. */
  repeat?: number;
  scenario?: string;
  /** Dotted paths from the root, set to these values. */
  set?: Record<string, unknown>;
  /** Dotted paths from the root, removed. */
  remove?: string[];
  /** Keep this fraction of the JSON text. */
  truncate?: number;
  /** Send the text as "FLGZ:" text. */
  compress?: boolean;
}

/**
 * Inputs an import must refuse, and changes it must shrug off with the same
 * answers as the scenario it starts from. Changes are recipes against that
 * scenario's bundle, so the file stays small; the reader applies them. The
 * reader compresses too: gzip output differs between zlib builds, so stored
 * compressed bytes would not match what another machine produces.
 */
/** The Stage 2 fields in a Vanilla run's rules, which installed builds never read. */
const STAGE_2_FIELDS = ['capabilities', 'chunkEntries', 'places', 'banks', 'freeAreas', 'progress', 'slayerTasks', 'travel']
  .map((field) => `rules.${field}`);
const capabilitiesOf = (scenario: string) =>
  (results.get(scenario)!.bundle.rules as { capabilities: string[] }).capabilities;

const bundleCases = (): {
  schema: number; reject: BundleCase[]; sameAnswers: BundleCase[]; stage2SameAnswers: BundleCase[];
} => ({
  schema: SCHEMA,
  reject: [
    { name: 'empty', input: '' },
    { name: 'an empty object', input: '{}' },
    { name: 'null', input: 'null' },
    { name: 'a version 3 stub', input: '{"version":3}' },
    { name: 'a future version 5', scenario: 'vanilla-mid', set: { version: 5 } },
    { name: 'version 4 without chunks', scenario: 'vanilla-mid', remove: ['chunks'] },
    { name: 'version 4 without rules', scenario: 'vanilla-mid', remove: ['rules'] },
    { name: 'version 4 rules without a run', scenario: 'vanilla-mid', remove: ['rules.runId'] },
    { name: 'truncated JSON', scenario: 'vanilla-mid', truncate: 0.5 },
    { name: 'FLGZ that is not base64', input: 'FLGZ:not base64 at all' },
    { name: 'a gzip bomb over 8 MiB', input: ' ', repeat: BOMB_INFLATED_BYTES, compress: true },
  ],
  sameAnswers: [
    { name: 'an unknown root field', scenario: 'vanilla-mid', set: { futureRootField: { added: 'later' } } },
    { name: 'an unknown rules field', scenario: 'vanilla-mid', set: { 'rules.futureRulesField': [1, 2, 3] } },
    {
      name: 'without the optional content fields',
      scenario: 'vanilla-mid',
      remove: ['chunkContent', 'itemTiers', 'slayerChunks'],
    },
    { name: 'without the run state', scenario: 'custom-none-banks-on', remove: ['state'] },
    { name: 'compressed', scenario: 'chunked-walk', compress: true },
    { name: 'without the Stage 2 sections', scenario: 'vanilla-mid', remove: STAGE_2_FIELDS },
    { name: 'Stage 2 sections without their capabilities', scenario: 'vanilla-mid', remove: ['rules.capabilities'] },
    {
      name: 'an unknown capability',
      scenario: 'vanilla-mid',
      set: { 'rules.capabilities': [...capabilitiesOf('vanilla-mid'), 'futureSection'] },
    },
  ],
  // Only a reader of the Stage 2 sections shrugs these off. To installed
  // builds a root unlockedChunks means a Chunked run (R10), and without root
  // freeAreas they free all of Misthalin (R6).
  stage2SameAnswers: [
    { name: 'a stray root unlockedChunks', scenario: 'vanilla-mid', set: { unlockedChunks: [] } },
    { name: 'no root freeAreas', scenario: 'xtreme-varrock', remove: ['freeAreas'] },
  ],
});

const pathParts = (path: string) => path.split('.');
function hasPath(root: Record<string, unknown>, path: string): boolean {
  let node: unknown = root;
  for (const part of pathParts(path)) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return true;
}

/**
 * Written by hand, unlike the files above: what a version 4 bundle promises
 * the readers already installed. Every run is checked against it, and the
 * manifest lists it so the plugin copies it with the rest.
 */
const CONTRACT_FILE = 'bundle-contract.json';

/**
 * The words the plugin and the RuneLite guide share (data/runeliteWording.ts). Its lists are in
 * the order the plugin shows them, so it is compared as written, not canonically.
 */
const WORDING_FILE = 'runelite-wording.json';

/**
 * What RuneLite's detectors must make of real game signals, and what the app must make of those
 * events (Stage 4). Written by hand; utils/detectedEventsContract.test.ts checks the app's side.
 */
const DETECTED_EVENTS_FILE = 'detected-events.json';

interface Condition {
  path: string;
  equals?: unknown;
  notEquals?: unknown;
}

interface BundleContract {
  version: number;
  statuses: string[];
  categories: { names: string[] };
  bankRows: { category: string; targetKind: string };
  /** Contract path to JSON type, such as "string|null" or "status". */
  fields: Record<string, string>;
  required: { paths: string[] };
  always: { paths: string[] };
  presentWhen: { fields: Record<string, Condition> };
  overlay: { paths: string[] };
  unread: { paths: string[] };
}

const readContract = (): BundleContract => JSON.parse(readFileSync(join(OUT, CONTRACT_FILE), 'utf8'));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A contract path as steps: "chunks.*[].cx" is chunks, *, [], cx. */
const steps = (path: string) =>
  path.split('.').flatMap((part) => (part.endsWith('[]') ? [part.slice(0, -2), '[]'] : [part]));

/** Every value along the steps: "*" is each value of an object, "[]" each item of an array. */
const valuesAt = (root: unknown, path: string[]): unknown[] =>
  path.reduce<unknown[]>((nodes, step) => nodes.flatMap((node) => {
    if (step === '[]') return Array.isArray(node) ? node : [];
    if (!isRecord(node)) return [];
    if (step === '*') return Object.values(node);
    return step in node ? [node[step]] : [];
  }), [root]);

const jsonType = (value: unknown) => (value === null ? 'null'
  : Array.isArray(value) ? 'array'
  : typeof value === 'number' && Number.isInteger(value) ? 'integer'
  : typeof value);

const hasType = (value: unknown, type: string, contract: BundleContract) =>
  type.split('|').some((one) => (one === 'status'
    ? typeof value === 'string' && contract.statuses.includes(value)
    : jsonType(value) === one));

/** How a bundle breaks the contract, one line per kind of break; empty when it keeps it. */
function contractBreaches(bundle: Record<string, unknown>, contract: BundleContract): string[] {
  const breaches = new Set<string>();
  if (bundle.version !== contract.version) breaches.add(`version is ${JSON.stringify(bundle.version)}`);
  for (const [path, type] of Object.entries(contract.fields)) {
    const wrong = valuesAt(bundle, steps(path)).find((value) => !hasType(value, type, contract));
    if (wrong !== undefined) breaches.add(`${path} holds ${JSON.stringify(wrong)}, not ${type}`);
  }
  for (const path of contract.required.paths) {
    const [value] = valuesAt(bundle, steps(path));
    const empty = value === undefined || value === null
      || (typeof value === 'string' && value.trim() === '')
      || (typeof value === 'object' && Object.keys(value).length === 0);
    if (empty) breaches.add(`${path} is required`);
  }
  for (const path of contract.always.paths) {
    const all = steps(path);
    const key = all[all.length - 1];
    if (valuesAt(bundle, all.slice(0, -1)).some((parent) => !isRecord(parent) || !(key in parent))) {
      breaches.add(`${path} is missing`);
    }
  }
  for (const [path, { path: on, ...when }] of Object.entries(contract.presentWhen.fields)) {
    const [value] = valuesAt(bundle, steps(on));
    const expected = 'equals' in when ? sameContent(value, when.equals) : !sameContent(value, when.notEquals);
    if (hasPath(bundle, path) !== expected) {
      breaches.add(`${path} is ${expected ? 'missing' : 'present'} with ${on} ${JSON.stringify(value)}`);
    }
  }
  for (const categories of valuesAt(bundle, steps('rules.chunks.*.categories')).filter(isRecord)) {
    for (const [category, rows] of Object.entries(categories)) {
      if (!contract.categories.names.includes(category)) breaches.add(`category ${category} is new`);
      for (const row of Array.isArray(rows) ? rows.filter(isRecord) : []) {
        const bankKind = row.targetKind === contract.bankRows.targetKind;
        if (bankKind !== (category === contract.bankRows.category)) {
          breaches.add(`a ${category} row has target kind ${JSON.stringify(row.targetKind)}`);
        }
      }
    }
  }
  return [...breaches];
}

const results = new Map<string, Generated>();
/** What the chunks that aren't land are: the same for every run, so pinned once. */
let placesAnswer: { schema: number; places: Record<string, unknown> };
/** Which bank each chunk a bank's facilities are in belongs to: also the same for every run. */
let banksAnswer: { schema: number; bankAt: Record<string, string> };

beforeAll(async () => {
  const chunkContent = JSON.parse(readFileSync(join(ROOT, 'public', 'chunk-content.json'), 'utf8'));
  const equipment = JSON.parse(readFileSync(join(ROOT, 'public', EQUIPMENT_CATALOGUE.asset), 'utf8'));
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    const path = String(url);
    if (path.includes('chunk-content.json')) return { ok: true, json: async () => structuredClone(chunkContent) };
    if (path.includes(EQUIPMENT_CATALOGUE.asset)) return { ok: true, json: async () => structuredClone(equipment) };
    return { ok: false, status: 404, json: async () => null };
  }));
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(EXPORTED_AT);

  const { createFreshState } = await import('../context/GameContext');
  const fresh = createFreshState().unlocks;
  for (const scenario of SCENARIOS) results.set(scenario.id, await generate(scenario, fresh));
  placesAnswer = { schema: SCHEMA, places: rulesPlaces(chunkContentService) };
  const physical = bankDecisions(chunkContentService, { unlocks: fresh, gameModeId: 'vanilla', contentService: chunkContentService });
  banksAnswer = {
    schema: SCHEMA,
    bankAt: Object.fromEntries(Object.entries(physical).flatMap(([id, decision]) => decision.physical.map((key) => [key, id]))),
  };
}, 300_000);

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setStartArea('misthalin');
});

/** Write only when the content changed, so reruns leave the files as they are. */
function writeIfChanged(file: string, bytes: Buffer, current: (old: Buffer) => unknown, next: unknown) {
  if (existsSync(file) && sameContent(current(readFileSync(file)), next)) return;
  writeFileSync(file, bytes);
}

describe('golden bundles', () => {
  it(WRITE ? 'writes the golden files' : 'match what the app produces', () => {
    if (WRITE) mkdirSync(OUT, { recursive: true });
    const files: Record<string, unknown> = {};
    for (const scenario of SCENARIOS) {
      const { bundle, expect: answers } = results.get(scenario.id)!;
      files[`${scenario.id}.bundle.json.gz`] = bundle;
      files[`${scenario.id}.expect.json`] = answers;
    }
    files['accounts.json'] = accountCases();
    files['cases.json'] = bundleCases();
    files['places.json'] = placesAnswer;
    files['banks.json'] = banksAnswer;

    for (const [name, content] of Object.entries(files)) {
      const file = join(OUT, name);
      const isGzip = name.endsWith('.gz');
      const read = (bytes: Buffer) => JSON.parse((isGzip ? gunzipSync(bytes) : bytes).toString('utf8'));
      if (WRITE) {
        const bytes = isGzip
          ? gzipSync(Buffer.from(JSON.stringify(content), 'utf8'), { level: 9 })
          : textBytes(content);
        writeIfChanged(file, bytes, read, content);
      } else {
        expect(existsSync(file), `${name} is missing; run npm run goldens:write`).toBe(true);
        expect(sameContent(read(readFileSync(file)), content),
          `${name} no longer matches the app; run npm run goldens:write and review the diff`).toBe(true);
      }
    }

    const wordingFile = join(OUT, WORDING_FILE);
    const wording = textBytes(RUNELITE_WORDING);
    if (WRITE) {
      if (!existsSync(wordingFile) || !readFileSync(wordingFile).equals(wording)) writeFileSync(wordingFile, wording);
    } else {
      expect(existsSync(wordingFile), `${WORDING_FILE} is missing; run npm run goldens:write`).toBe(true);
      expect(readFileSync(wordingFile).equals(wording),
        `${WORDING_FILE} no longer matches data/runeliteWording.ts; run npm run goldens:write`).toBe(true);
    }

    const manifest = {
      schema: SCHEMA,
      exportedAt: EXPORTED_AT.toISOString(),
      chunkContentDataVersion: CHUNK_CONTENT_DATA_VERSION,
      equipmentCatalogue: EQUIPMENT_CATALOGUE.asset,
      scenarios: SCENARIOS.map(({ id, covers }) => ({ id, covers })),
      files: Object.fromEntries([...Object.keys(files), CONTRACT_FILE, WORDING_FILE, DETECTED_EVENTS_FILE].sort(byCodeUnit)
        .map((name) => [name, existsSync(join(OUT, name)) ? sha256(readFileSync(join(OUT, name))) : null])),
    };
    const manifestFile = join(OUT, 'manifest.json');
    if (WRITE) {
      writeIfChanged(manifestFile, textBytes(manifest), (bytes) => JSON.parse(bytes.toString('utf8')), manifest);
    } else {
      expect(existsSync(manifestFile), 'manifest.json is missing; run npm run goldens:write').toBe(true);
      expect(JSON.parse(readFileSync(manifestFile, 'utf8')),
        'manifest.json does not match the files; run npm run goldens:write').toEqual(manifest);
    }

    const total = readdirSync(OUT).reduce((sum, name) => sum + readFileSync(join(OUT, name)).length, 0);
    expect(total, 'golden files exceed their size budget').toBeLessThanOrEqual(SIZE_BUDGET_BYTES);
  });

  it('name bundle cases that apply to the bundles they start from', () => {
    // A recipe that points at nothing would pass in the plugin for the wrong reason.
    const { reject, sameAnswers, stage2SameAnswers } = bundleCases();
    for (const bundleCase of [...reject, ...sameAnswers, ...stage2SameAnswers]) {
      expect(bundleCase.input !== undefined || bundleCase.scenario !== undefined, bundleCase.name).toBe(true);
      if (bundleCase.scenario === undefined) continue;
      const generated = results.get(bundleCase.scenario);
      expect(generated, `${bundleCase.name}: no scenario ${bundleCase.scenario}`).toBeDefined();
      for (const path of bundleCase.remove ?? []) {
        expect(hasPath(generated!.bundle, path), `${bundleCase.name}: nothing at ${path}`).toBe(true);
      }
      for (const path of Object.keys(bundleCase.set ?? {})) {
        const parent = pathParts(path).slice(0, -1).join('.');
        expect(parent === '' || hasPath(generated!.bundle, parent), `${bundleCase.name}: no ${parent}`).toBe(true);
      }
    }
    const bomb = reject.find((bundleCase) => bundleCase.name.includes('gzip bomb'))!;
    expect(bomb.compress).toBe(true);
    expect(bomb.input!.length * (bomb.repeat ?? 1)).toBeGreaterThan(8 * 1024 * 1024);
  });

  it('each fit in one relay request with headroom', () => {
    // Stage 2 adds fields to every run, and Chunked, Custom and bank-locked
    // runs differ, so one run's size says little about the others.
    for (const scenario of SCENARIOS) {
      const { compressed } = results.get(scenario.id)!;
      expect(compressed.startsWith('FLGZ:'), `${scenario.id} is compressed`).toBe(true);
      expect(relayBodyBytes(compressed), `${scenario.id}'s relay body in bytes`).toBeLessThan(RELAY_BODY_BUDGET_BYTES);
    }
  });

  it('keep the promises of the bundle contract', () => {
    const contract = readContract();
    for (const scenario of SCENARIOS) {
      expect(contractBreaches(results.get(scenario.id)!.bundle, contract).slice(0, 10),
        `${scenario.id} breaks ${CONTRACT_FILE}`).toEqual([]);
    }
  });

  it('keep a bundle contract whose paths name real fields', () => {
    const contract = readContract();
    const when = Object.entries(contract.presentWhen.fields);
    const named = [
      ...contract.required.paths, ...contract.always.paths, ...contract.overlay.paths, ...contract.unread.paths,
      ...when.flatMap(([path, condition]) => [path, condition.path]),
    ];
    expect(named.filter((path) => !(path in contract.fields)), 'paths without a type').toEqual([]);
    expect(contract.required.paths.filter((path) => !contract.always.paths.includes(path)),
      'required fields the export may leave out').toEqual([]);
    const read = new Set([...contract.always.paths, ...contract.overlay.paths, ...when.map(([path]) => path)]);
    expect(contract.unread.paths.filter((path) => read.has(path)), 'unread fields that are read').toEqual([]);
    expect(when.filter(([path]) => contract.always.paths.includes(path)).map(([path]) => path),
      'fields both always present and present only sometimes').toEqual([]);

    // A path that meets nothing in any run would pass for the wrong reason.
    // An empty list or map still shows its own path is right, and the export
    // leaves out the unread fields.
    const bundles = [...results.values()].map(({ bundle }) => bundle);
    const underUnread = (path: string) => contract.unread.paths.some((field) =>
      path === field || path.startsWith(`${field}.`) || path.startsWith(`${field}[]`));
    const unmet = Object.keys(contract.fields).filter((path) => {
      if (underUnread(path)) return false;
      const all = steps(path);
      const last = all[all.length - 1];
      const probe = last === '*' || last === '[]' ? all.slice(0, -1) : all;
      return !bundles.some((bundle) => valuesAt(bundle, probe).length > 0);
    });
    expect(unmet, 'contract fields no golden run has').toEqual([]);
    const kinds = bundles.flatMap((bundle) => valuesAt(bundle, steps('rules.chunks.*.categories.*[].targetKind')));
    expect(kinds.includes(contract.bankRows.targetKind), 'no bank rows to check').toBe(true);
  });

  it("carry the same answers in the bundle as they pin", () => {
    // A bundle field must not drift from the answer the golden pins for it.
    for (const scenario of SCENARIOS) {
      const { bundle, expect: answers } = results.get(scenario.id)!;
      const pinned = answers as { chunks: Record<string, boolean>; banks: Record<string, boolean> };
      const rules = bundle.rules as { chunks: Record<string, { entry: string; categories: Record<string, { name: string; status: string }[]> }> };
      const entries = Object.entries(rules.chunks)
        .filter(([key, snapshot]) => key in pinned.chunks && (snapshot.entry !== 'LOCKED') !== pinned.chunks[key])
        .map(([key, snapshot]) => `${key} entry ${snapshot.entry}, pinned ${pinned.chunks[key] ? 'unlocked' : 'locked'}`);
      expect(entries.slice(0, 10), `${scenario.id}: chunk entries`).toEqual([]);
      // A bank the run hasn't unlocked can't be used, whatever else holds.
      const banks = Object.entries(pinned.banks).filter(([id, unlocked]) => {
        const at = `${Math.floor(Number(id) / 256)},${Number(id) % 256}`;
        const row = rules.chunks[at]?.categories.BANKS?.find((one) => one.name === BANKS.find((bank) => bank.id === id)?.name);
        return !unlocked && row !== undefined && row.status !== 'LOCKED';
      }).map(([id]) => id);
      expect(banks, `${scenario.id}: banks`).toEqual([]);

      const stage2 = bundle.rules as { chunkEntries: Record<string, string>; places: Record<string, unknown> };
      expect(sameContent(stage2.chunkEntries, (answers as { entries: unknown }).entries), `${scenario.id}: chunkEntries`)
        .toBe(true);
      const snapshots = Object.entries(stage2.chunkEntries)
        .filter(([key, entry]) => key in rules.chunks && rules.chunks[key].entry !== entry)
        .map(([key, entry]) => `${key} ${entry}, snapshot ${rules.chunks[key].entry}`);
      expect(snapshots.slice(0, 10), `${scenario.id}: chunkEntries against rules.chunks`).toEqual([]);
      expect(sameContent(stage2.places, placesAnswer.places), `${scenario.id}: places`).toBe(true);
      // Chunked runs only.
      expect(sameContent((bundle.rules as { frontier?: string[] }).frontier, (answers as { frontier?: string[] }).frontier),
        `${scenario.id}: frontier`).toBe(true);

      // Capabilities name exactly the Stage 2 sections the bundle has.
      const sections = bundle.rules as Record<string, unknown>;
      const has = RULES_CAPABILITIES.filter((capability) => (capability === 'chunkDetails'
        ? Object.values(rules.chunks).some((snapshot) => 'kind' in snapshot)
        : sections[capability] !== undefined));
      expect(sections.capabilities, `${scenario.id}: capabilities`).toEqual(has);

      // Each snapshot says what it is, and why its entry isn't ALLOWED exactly when it isn't.
      const described = rules.chunks as Record<string, { entry: string; kind?: string; entryReason?: string }>;
      const misdescribed = Object.entries(described).filter(([key, snapshot]) =>
        snapshot.kind !== (OCEAN_CHUNK_KEYS.has(key) ? 'ocean' : 'land')
        || (snapshot.entry === 'ALLOWED') !== (snapshot.entryReason === undefined)).map(([key]) => key);
      expect(misdescribed.slice(0, 10), `${scenario.id}: snapshot kinds and reasons`).toEqual([]);

      // Each bank: the pinned status, its chunk's BANKS row, and the pinned chunks it is in.
      const decided = (bundle.rules as { banks: Record<string, { name: string; status: string; at: string; physical: string[] }> }).banks;
      const pinnedStatus = (answers as { bankStatus: Record<string, string> }).bankStatus;
      expect(sameContent(Object.fromEntries(Object.entries(decided).map(([id, bank]) => [id, bank.status])), pinnedStatus),
        `${scenario.id}: bank statuses`).toBe(true);
      const unlike = Object.entries(decided).filter(([, bank]) =>
        rules.chunks[bank.at]?.categories.BANKS?.find((row) => row.name === bank.name)?.status !== bank.status)
        .map(([id]) => id);
      expect(unlike, `${scenario.id}: banks against their rows`).toEqual([]);
      const at = Object.fromEntries(Object.entries(decided).flatMap(([id, bank]) => bank.physical.map((key) => [key, id])));
      expect(sameContent(at, banksAnswer.bankAt), `${scenario.id}: bankAt`).toBe(true);

      // The rules' free areas and the root's for older builds are both the mode's.
      const free = (answers as { freeAreas: string[] }).freeAreas;
      expect([(bundle.rules as { freeAreas: string[] }).freeAreas, bundle.freeAreas], `${scenario.id}: free areas`)
        .toEqual([free, free]);
      expect((bundle.rules as { progress: unknown }).progress, `${scenario.id}: progress`)
        .toEqual((answers as { progress: unknown }).progress);

      // Every task slayerChunks knows, with the pinned status.
      const tasks = (bundle.rules as { slayerTasks: Record<string, { status: string }> }).slayerTasks;
      expect(Object.keys(tasks).sort(), `${scenario.id}: Slayer keys`).toEqual(Object.keys(bundle.slayerChunks as object).sort());
      expect(sameContent(Object.fromEntries(Object.entries(tasks).map(([key, task]) => [key, task.status])),
        (answers as { slayer: unknown }).slayer), `${scenario.id}: Slayer statuses`).toBe(true);

      // Every travel method, with the pinned options' statuses.
      const travel = (bundle.rules as { travel: Record<string, TravelMethodDecision> }).travel;
      expect(Object.keys(travel).sort(byCodeUnit), `${scenario.id}: travel methods`)
        .toEqual(TRAVEL_METHODS.map((method) => method.id).sort(byCodeUnit));
      expect(Object.fromEntries(TRAVEL_ANSWERS.map((key) => [key, travelAnswer(travel, key).status])),
        `${scenario.id}: travel statuses`).toEqual((answers as { travel: unknown }).travel);
    }
  });

  it('keep the travel section small in every run', () => {
    for (const scenario of SCENARIOS) {
      const travel = (results.get(scenario.id)!.bundle.rules as { travel: unknown }).travel;
      expect(gzipSync(JSON.stringify(travel)).length, `${scenario.id}'s travel section, compressed`)
        .toBeLessThan(TRAVEL_BUDGET_BYTES);
    }
  });

  it('cover the travel decisions the plugin depends on', () => {
    const decided = (id: string) => (results.get(id)!.bundle.rules as { travel: Record<string, TravelMethodDecision> }).travel;
    const fresh = decided('vanilla-fresh');
    // Misthalin is free and Falador isn't; an unlock the run lacks locks the option wherever it goes.
    expect(travelAnswer(fresh, 'spell:standard:lumbridge-teleport|Cast').status).toBe('ALLOWED');
    expect(travelAnswer(fresh, 'spell:standard:falador-teleport|Cast').status).toBe('LOCKED');
    expect(travelAnswer(fresh, 'item:amulet-of-glory|Edgeville')).toMatchObject({ status: 'LOCKED', reason: 'Needs Jewelry Teleports' });
    expect(travelAnswer(fresh, "item:necklace-of-passage|Eagles' Eyrie").reason).toBe('Needs Jewelry Teleports');
    // With the unlock, its destination decides; a rub or a diary's switch leaves the choice open.
    const travelling = decided('vanilla-interiors');
    expect(travelAnswer(travelling, 'item:amulet-of-glory|Edgeville').status).toBe('ALLOWED');
    expect(travelAnswer(travelling, 'item:amulet-of-glory|Rub').status).toBe('UNKNOWN');
    expect(travelAnswer(travelling, 'tablet:varrock-teleport|Break')).toMatchObject({ to: ['50,53', '49,54'], status: 'UNKNOWN' });
    // The networks and boats are tag-only.
    expect(Object.entries(fresh).filter(([id, method]) => !!method.advisory !== /^(network|boat):/.test(id))).toEqual([]);
  });

  it('cover the land rules the plugin depends on', () => {
    // Guards against a generator bug that would quietly pin nothing.
    const fresh = results.get('vanilla-fresh')!.expect as { chunks: Record<string, boolean>; areas: Record<string, boolean> };
    expect(fresh.chunks['50,50']).toBe(true);
    expect(fresh.areas.Lumbridge).toBe(true);
    expect(fresh.areas.Falador).toBe(false);
    const walk = results.get('chunked-walk')!.expect as { chunks: Record<string, boolean>; frontier: string[] };
    expect(walk.chunks['46,52']).toBe(true);
    expect(walk.chunks['45,52']).toBe(false);
    expect(walk.frontier.length).toBeGreaterThan(0);
  });

  it('cover what their new runs say they do', () => {
    type Answers = { chunks: Record<string, boolean>; areas: Record<string, boolean>; frontier?: string[] };
    const answers = (id: string) => results.get(id)!.expect as Answers;
    // Sailing opens every ocean chunk.
    expect([...OCEAN_CHUNK_KEYS].filter((key) => !answers('vanilla-sailing').chunks[key])).toEqual([]);
    expect([...OCEAN_CHUNK_KEYS].some((key) => answers('vanilla-mid').chunks[key])).toBe(false);
    // Land across the sea from the coast joins the Chunked frontier.
    expect(answers('chunked-sailing').frontier).toEqual(expect.arrayContaining(['49,47', '50,48']));
    // Keldagrim with its entrance; Mor Ul Rek's entrance open but the city not rolled.
    const interiors = answers('vanilla-interiors');
    expect([interiors.areas.Keldagrim, interiors.areas['Mountain Camp'], interiors.areas['Musa Point']]).toEqual([true, true, true]);
    expect(interiors.areas['Mor Ul Rek (TzHaar City)']).toBe(false);
  });

  it('give an entry to every land, ocean and interior chunk, and a place to every one not on land', () => {
    const entries = (id: string) => (results.get(id)!.expect as { entries: Record<string, string> }).entries;
    const interiors = chunkContentService.interiorRecords().map((record) => record.key);
    const kinds = [ALL_CHUNK_KEYS, [...OCEAN_CHUNK_KEYS], interiors];
    expect(new Set(kinds.flat()).size, 'land, ocean and interiors share no chunk').toBe(kinds.flat().length);
    for (const scenario of SCENARIOS) {
      expect(Object.keys(entries(scenario.id)).sort(), scenario.id).toEqual(kinds.flat().sort());
    }
    expect(Object.keys(placesAnswer.places).sort()).toEqual([...OCEAN_CHUNK_KEYS, ...interiors].sort());
    // Keldagrim: behind its locked entrance, then open; Mor Ul Rek: its area not rolled.
    expect(entries('vanilla-mid')['44,159']).toBe('LOCKED');
    expect(entries('vanilla-interiors')['44,159']).toBe('ALLOWED');
    expect(entries('vanilla-interiors')['39,80']).toBe('LOCKED');
    expect(new Set(interiors.map((key) => entries('vanilla-interiors')[key])))
      .toEqual(new Set(['ALLOWED', 'NOT_READY', 'UNKNOWN', 'LOCKED']));
  });
});
