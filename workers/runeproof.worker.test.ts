import { describe, expect, it, vi } from 'vitest';
import sourceDocumentJson from '../public/runeproof-sources.json';
import chunkDocumentJson from '../public/chunk-content.json';
import type { RuneProofSourceDocument } from '../utils/runeproof/acquisitionIndex';
import type { LocationGraph } from '../utils/runeproof/locationGraph';
import { initializeRuneProofWorkerEngine } from './runeproof.worker';

const document =
  sourceDocumentJson as unknown as RuneProofSourceDocument;
const request = {
  type: 'INITIALIZE' as const,
  acquisitionUrl:
    `/runeproof-sources.json?v=${encodeURIComponent(document.sourceVersion)}`,
  sourceVersion: document.sourceVersion,
  sourceAudit: {
    sourceVersion: 'audit-v1',
    questCoverage: 'VERIFIED' as const,
    chunkCoverage: 'VERIFIED' as const,
    acquisitionCoverage: document.acquisitionCoverage,
  },
  locationGraph: {
    startNodeId: 'surface:50,50',
    nodes: chunkDocumentJson.locationNodes,
    edges: chunkDocumentJson.locationEdges,
  } as LocationGraph,
};

describe('RuneProof worker initialization', () => {
  it('loads the exact versioned acquisition document from the same origin', async () => {
    const fetcher =
      vi.fn(async () => response(document)) as unknown as typeof fetch;
    const engine = await initializeRuneProofWorkerEngine(
      request,
      'https://fatelocked.example/app/',
      fetcher,
    );
    expect(engine.sourceVersion).toBe(document.sourceVersion);
    expect(fetcher).toHaveBeenCalledWith(
      new URL(`https://fatelocked.example${request.acquisitionUrl}`),
      { credentials: 'same-origin' },
    );
  });

  it.each([
    ['fetch', async () => ({ ok: false, status: 503, json: async () => document })],
    ['parse', async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } })],
    ['shape', async () => ({ ok: true, status: 200, json: async () => ({}) })],
    ['version', async () => response({ ...document, sourceVersion: 'sources-v2' })],
  ])('rejects %s failures so the adapter can latch its fallback', async (
    _case,
    makeResponse,
  ) => {
    const fetcher = vi.fn(makeResponse) as unknown as typeof fetch;
    await expect(initializeRuneProofWorkerEngine(
      request,
      'https://fatelocked.example/app/',
      fetcher,
    )).rejects.toBeTruthy();
  });

  it('rejects mutated bytes that retain the trusted sourceVersion field', async () => {
    const mutated = structuredClone(document);
    mutated.rules[0].sourceLabel += ' tampered';
    const fetcher =
      vi.fn(async () => response(mutated)) as unknown as typeof fetch;
    await expect(initializeRuneProofWorkerEngine(
      request,
      'https://fatelocked.example/app/',
      fetcher,
    )).rejects.toThrow('integrity');
  });

  it.each([
    ['node label', (graph: typeof request.locationGraph) => {
      graph.nodes[0].label += ' tampered';
    }],
    ['edge bidirectionality', (graph: typeof request.locationGraph) => {
      graph.edges[0].bidirectional = !graph.edges[0].bidirectional;
    }],
    ['edge provenance', (graph: typeof request.locationGraph) => {
      graph.edges[0].provenanceIds = ['travel-audit:tampered'];
    }],
  ])('rejects runtime %s changes outside the exact production identity', async (
    _case,
    mutate,
  ) => {
    const locationGraph = structuredClone(request.locationGraph);
    mutate(locationGraph);
    const fetcher =
      vi.fn(async () => response(document)) as unknown as typeof fetch;

    await expect(initializeRuneProofWorkerEngine(
      { ...request, locationGraph },
      'https://fatelocked.example/app/',
      fetcher,
    )).rejects.toThrow(/location graph identity/i);
  });

  it.each([
    ['rule', (value: RuneProofSourceDocument) => {
      value.rules[0] = { id: 'malformed' } as never;
    }],
    ['count', (value: RuneProofSourceDocument) => {
      value.counts.rules += 1;
    }],
    ['provenance', (value: RuneProofSourceDocument) => {
      value.provenanceCatalog[0].ruleIds = 'malformed' as never;
    }],
    ['provenance payload', (value: RuneProofSourceDocument) => {
      const entry = value.provenanceCatalog.find(candidate =>
        candidate.kind === 'RESOURCE_MAP' || candidate.kind === 'RECIPE_AUDIT');
      if (!entry?.payload) throw new Error('production fixture lacks provenance payload');
      entry.payload.sourceIds = [];
    }],
  ])('rejects malformed %s structure before engine creation', async (
    _case,
    mutate,
  ) => {
    const malformed = structuredClone(document);
    mutate(malformed);
    const fetcher =
      vi.fn(async () => response(malformed)) as unknown as typeof fetch;
    await expect(initializeRuneProofWorkerEngine(
      request,
      'https://fatelocked.example/app/',
      fetcher,
    )).rejects.toThrow('invalid');
  });

  it('rejects cross-origin acquisition URLs before fetching', async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(initializeRuneProofWorkerEngine(
      { ...request, acquisitionUrl: 'https://other.example/sources.json' },
      'https://fatelocked.example/app/',
      fetcher,
    )).rejects.toThrow('same-origin');
    expect(fetcher).not.toHaveBeenCalled();
  });
});

function response(value: unknown): Pick<Response, 'ok' | 'status' | 'json'> {
  return { ok: true, status: 200, json: async () => value };
}
