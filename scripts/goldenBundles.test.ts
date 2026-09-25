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
import { chunkUnlocked } from '../utils/chunkLocations';
import { isAreaReachable, isBankReachable } from '../utils/reachability';
import { chunkKey, getChunkFrontier } from '../utils/chunkAdjacency';
import { setStartArea } from '../utils/freeAreas';
import { getGameMode, resolveModeRules, type GameModeRules } from '../config/gameModes';
import { normalizeAccountName } from '../services/fateEventProtocol';
import { CHUNK_CONTENT_DATA_VERSION } from '../services/ChunkContentService';
import { EQUIPMENT_CATALOGUE } from '../data/equipmentCatalogue';
import { SUB_AREA_CHUNKS } from '../data/subAreaChunks';
import { REGION_CHUNKS } from '../data/regionChunks';
import { REGION_GROUPS } from '../data/items';
import { BANKS } from '../data/banks';
import { OCEAN_CHUNK_KEYS } from '../utils/oceanAccess';
import type { UnlockState } from '../types';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'contracts', 'golden-bundles');
const WRITE = process.env.FATE_GOLDENS === 'write';
const SCHEMA = 1;
const EXPORTED_AT = new Date('2026-09-25T12:00:00.000Z');
const SIZE_BUDGET_BYTES = 3.5 * 1024 * 1024;
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
  return {
    ...structuredClone(fresh),
    regions: scenario.regions ?? [],
    chunks: scenario.chunks ?? [],
    banks: scenario.banks ?? [],
    equipment: { ...fresh.equipment, ...scenario.equipment },
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

interface Generated {
  bundle: Record<string, unknown>;
  expect: Record<string, unknown>;
}

async function generate(scenario: Scenario, fresh: UnlockState): Promise<Generated> {
  setStartArea(resolveModeRules(scenario.mode, scenario.custom).startArea);
  const unlocks = unlocksFor(fresh, scenario);
  const { json } = await buildBundlePayload(unlocks, {
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
    ? getChunkFrontier(scenario.chunks ?? []).map(chunkKey).sort(byCodeUnit)
    : undefined;

  return {
    bundle,
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
const flgz = (text: string) => `FLGZ:${gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).toString('base64')}`;

interface BundleCase {
  name: string;
  /** The input text, when the case does not start from a scenario's bundle. */
  input?: string;
  scenario?: string;
  /** Dotted paths from the root, set to these values. */
  set?: Record<string, unknown>;
  /** Dotted paths from the root, removed. */
  remove?: string[];
  /** Keep this fraction of the JSON text. */
  truncate?: number;
  /** Send the bundle as "FLGZ:" text. */
  compress?: boolean;
}

/**
 * Inputs an import must refuse, and changes it must shrug off with the same
 * answers as the scenario it starts from. Changes are recipes against that
 * scenario's bundle, so the file stays small; the reader applies them.
 */
const bundleCases = (): { schema: number; reject: BundleCase[]; sameAnswers: BundleCase[] } => ({
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
    { name: 'a gzip bomb over 8 MiB', input: flgz(' '.repeat(BOMB_INFLATED_BYTES)) },
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

const results = new Map<string, Generated>();

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

    const manifest = {
      schema: SCHEMA,
      exportedAt: EXPORTED_AT.toISOString(),
      chunkContentDataVersion: CHUNK_CONTENT_DATA_VERSION,
      equipmentCatalogue: EQUIPMENT_CATALOGUE.asset,
      scenarios: SCENARIOS.map(({ id, covers }) => ({ id, covers })),
      files: Object.fromEntries(Object.keys(files).sort(byCodeUnit)
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
    const { reject, sameAnswers } = bundleCases();
    for (const bundleCase of [...reject, ...sameAnswers]) {
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
    const inflated = gunzipSync(Buffer.from(bomb.input!.slice('FLGZ:'.length), 'base64'));
    expect(inflated.length).toBeGreaterThan(8 * 1024 * 1024);
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
});
