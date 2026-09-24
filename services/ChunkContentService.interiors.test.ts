import { afterEach, describe, expect, it, vi } from 'vitest';
import generatedChunkContent from '../public/chunk-content.json';
import { ChunkContentService } from './ChunkContentService';
import { compileRawRequirements } from '../utils/questRoutes/accountRequirements';

// Interim reviews in data/sources/interior-access.json, pending wiki-verified
// requirements: neither interior may read as free to reach.
const BASEMENT = [
  "Access the Warriors' Guild",
  "Warriors' Guild basement: entry to the Cyclops basement needs confirmation",
];
const MANOR = ['Misthalin Manor: reaching the manor through Misthalin Mystery needs confirmation'];

type Interiors = Record<string, { entrances: { chunkId: string; requirements: string[] }[] }>;
const interiors = (generatedChunkContent as unknown as { interiors: Interiors }).interiors;
const entrances = (id: string) => interiors[id].entrances
  .map(({ chunkId, requirements }) => ({ chunkId, requirements }));
const gateKinds = (raws: string[]) => compileRawRequirements(raws.map(raw => ({ raw, origin: 'CHUNK_ENTRY' as const })))
  .map(gate => gate.type === 'UNLOCK' ? `UNLOCK:${gate.id}` : gate.type);

afterEach(() => vi.unstubAllGlobals());

describe('interim interior reviews', () => {
  it("gates the Warriors' Guild basement behind guild entry and a confirmation", () => {
    expect(entrances('11675')).toEqual([{ chunkId: '11319', requirements: BASEMENT }]);
    expect(gateKinds(BASEMENT)).toEqual(["UNLOCK:Warriors' Guild", 'UNRESOLVED']);
  });

  it('gates Misthalin Manor behind a confirmation', () => {
    for (const id of ['6475', 'Misthalin Manor']) {
      expect(entrances(id)).toEqual([{ chunkId: '12849', requirements: MANOR }]);
    }
    expect(gateKinds(MANOR)).toEqual(['UNRESOLVED']);
  });

  it('carries the gates onto the item sources inside them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => generatedChunkContent })));
    const service = new ChunkContentService();
    expect(await service.init()).toBe(true);

    const manorBuckets = service.itemSourceRecords('Bucket').filter(record => record.sourceId === 'Misthalin Manor');
    const basementChainbodies = service.itemSourceRecords('Iron chainbody').filter(record => record.sourceId === '11675');
    expect(manorBuckets.length).toBeGreaterThan(0);
    expect(basementChainbodies.length).toBeGreaterThan(0);
    for (const record of manorBuckets) {
      expect(record.rawRequirements.map(requirement => requirement.raw)).toEqual(expect.arrayContaining(MANOR));
    }
    for (const record of basementChainbodies) {
      expect(record.rawRequirements.map(requirement => requirement.raw)).toEqual(expect.arrayContaining(BASEMENT));
    }
  });
});
