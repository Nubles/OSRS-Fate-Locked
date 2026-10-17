import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generateActivityChunksSource, resolveAnchor } from './gen-activity-chunks.mjs';
import { generatedTextMatches } from './generated-text.mjs';
import { ACTIVITY_CHUNKS, FARM_SLAYER_CARD_CHUNKS, SLAYER_MASTER_CHUNKS } from '../data/activityChunks';
import { CHUNKED_ACTIVITY_RULES, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { SLAYER_MASTER_REQUIREMENTS } from '../data/slayerMasterRequirements';
import { BOSSES_LIST, GUILDS_LIST, MINIGAMES_LIST } from '../data/items';
import { BRUTUS_BOSS_NAME } from '../config/vanillaKeyEconomy';
import { ALL_CHUNK_KEYS } from '../utils/chunkAdjacency';

const ROOT = resolve(__dirname, '..');
const doc = JSON.parse(readFileSync(resolve(ROOT, 'public', 'chunk-content.json'), 'utf8'));
const source = JSON.parse(readFileSync(resolve(ROOT, 'data', 'sources', 'activity-entrances.json'), 'utf8'));
const LAND = new Set(ALL_CHUNK_KEYS);

describe('data/activityChunks.ts', () => {
  it('is up to date with its generator', () => {
    const actual = readFileSync(resolve(ROOT, 'data', 'activityChunks.ts'), 'utf8');
    expect(generatedTextMatches(actual, generateActivityChunksSource(doc, source))).toBe(true);
  });

  it('places every boss, minigame and guild, and Brutus, or gives it a Chunked rule', () => {
    const missing = [...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST, BRUTUS_BOSS_NAME]
      .filter(name => !(ACTIVITY_CHUNKS[name]?.length > 0) && !Object.hasOwn(CHUNKED_ACTIVITY_RULES, name));
    expect(missing).toEqual([]);
  });

  it('gives each entry without a Vanilla location gate a real chunk or a stated rule', () => {
    for (const name of NO_HARD_LOCATION_GATE) {
      expect(ACTIVITY_CHUNKS[name]?.length > 0 || Object.hasOwn(CHUNKED_ACTIVITY_RULES, name), name).toBe(true);
    }
    expect(Object.keys(CHUNKED_ACTIVITY_RULES).sort()).toEqual(['Barracuda Trials', 'Forestry', 'Mimic']);
    for (const name of Object.keys(CHUNKED_ACTIVITY_RULES)) expect(ACTIVITY_CHUNKS[name], name).toBeUndefined();
  });

  it('names only places the app knows, on land chunks the run can own', () => {
    const known = new Set<string>([...BOSSES_LIST, ...MINIGAMES_LIST, ...GUILDS_LIST, BRUTUS_BOSS_NAME]);
    expect(Object.keys(ACTIVITY_CHUNKS).filter(name => !known.has(name))).toEqual([]);
    const offLand = Object.entries({ ...ACTIVITY_CHUNKS, ...SLAYER_MASTER_CHUNKS })
      .flatMap(([name, chunks]) => chunks.filter(key => !LAND.has(key)).map(key => `${name} ${key}`));
    expect(offLand).toEqual([]);
  });

  it('places every Slayer master the app knows', () => {
    const masters = new Set([...Object.keys(doc.slayerMasters), ...Object.keys(SLAYER_MASTER_REQUIREMENTS)]);
    expect([...masters].filter(master => !(SLAYER_MASTER_CHUNKS[master]?.length > 0))).toEqual([]);
  });

  it("places every Slayer card the Farm screen can show, by the name it shows", () => {
    const cards = ['Turael', 'Aya', 'Spria', 'Mazchna', 'Vannaka', 'Chaeldar', 'Konar', 'Nieve', 'Steve', 'Krystilia', 'Duradel', 'Kuradal', 'Boss Task'];
    expect(Object.keys(FARM_SLAYER_CARD_CHUNKS).sort()).toEqual([...cards].sort());
    expect(FARM_SLAYER_CARD_CHUNKS.Aya).toEqual(SLAYER_MASTER_CHUNKS.Turael);
    expect(FARM_SLAYER_CARD_CHUNKS.Konar).toEqual(SLAYER_MASTER_CHUNKS['Konar quo Maten']);
    // A Boss Task comes from any master whose table has boss tasks.
    const bossMasters = Object.entries(doc.slayerMasters as Record<string, Record<string, { bosses?: unknown }>>)
      .filter(([, tasks]) => Object.values(tasks).some(task => task.bosses)).map(([master]) => master);
    expect(FARM_SLAYER_CARD_CHUNKS['Boss Task']).toEqual([...new Set(bossMasters.flatMap(m => SLAYER_MASTER_CHUNKS[m]))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  });

  it('uses the entrance chunks the reviews found, not the named area', () => {
    expect(ACTIVITY_CHUNKS['Tormented Demons']).toEqual(['49,49']);
    expect(ACTIVITY_CHUNKS['Tears of Guthix']).toEqual(['49,49']);
    expect(ACTIVITY_CHUNKS['Giant Mole']).toEqual(['46,51']);
    expect(ACTIVITY_CHUNKS.Cerberus).toEqual(['45,53']);
    expect(ACTIVITY_CHUNKS.Nex).toEqual(['45,58']);
    expect(ACTIVITY_CHUNKS.Vorkath).toEqual(['35,63']);
    expect(ACTIVITY_CHUNKS.Scurrius).toEqual(['50,54']);
    expect(ACTIVITY_CHUNKS['Abyssal Sire']).toEqual(['50,49']);
    expect(ACTIVITY_CHUNKS[BRUTUS_BOSS_NAME]).toEqual(['50,51']);
    // The brass-key door alone does not get a player in.
    expect(ACTIVITY_CHUNKS.Obor).toEqual(['48,54']);
    expect(SLAYER_MASTER_CHUNKS.Vannaka).toEqual(['48,54']);
    expect(SLAYER_MASTER_CHUNKS.Krystilia).toEqual(['48,54']);
    expect(SLAYER_MASTER_CHUNKS.Turael).toEqual(['45,55']);
  });

  it('fails on an anchor that matches nothing', () => {
    expect(resolveAnchor(doc, { monster: 'No such monster' }).size).toBe(0);
    expect(() => generateActivityChunksSource(doc, { activities: { X: [{ monster: 'No such monster' }] }, slayerMasters: {} }))
      .toThrow(/matches nothing/);
    expect(() => resolveAnchor(doc, { monster: 'Obor', except: ['48,53'] })).toThrow(/reason/);
  });
});
