import {
  createRuneProofEngine,
  assertRuneProofSourceDocument,
  type RuneProofEngine,
  type RuneProofEngineSources,
  type RuneProofQuery,
} from '../utils/runeproof/engine';
import {
  canonicalDocumentJson,
  sha256HexSync,
} from '../utils/runeproof/acquisitionIndex';
import type { LocationGraph } from '../utils/runeproof/locationGraph';
import type { RuneProofSourceAudit } from '../utils/runeproof/sourceGate';
import type { RuneProofRunSnapshot } from '../types';

type FullInitializeRequest = {
  type: 'INITIALIZE';
  sources: RuneProofEngineSources;
};
type UrlInitializeRequest = {
  type: 'INITIALIZE';
  acquisitionUrl: string;
  sourceVersion: string;
  sourceAudit: RuneProofSourceAudit;
  locationGraph: LocationGraph;
};
type EvaluateRequest = {
  type: 'EVALUATE';
  id: number;
  query: RuneProofQuery;
  snapshot: RuneProofRunSnapshot;
};
type Request = FullInitializeRequest | UrlInitializeRequest | EvaluateRequest;

let enginePromise: Promise<RuneProofEngine> | null = null;

if (typeof self !== 'undefined') {
  self.onmessage = (event: MessageEvent<Request>) => {
    if (event.data.type === 'INITIALIZE') {
      if (!enginePromise) {
        enginePromise = initializeRuneProofWorkerEngine(
          event.data,
          self.location.href,
        );
      }
      return;
    }
    void evaluate(event.data);
  };
}

export async function initializeRuneProofWorkerEngine(
  request: FullInitializeRequest | UrlInitializeRequest,
  baseUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<RuneProofEngine> {
  if ('sources' in request) return createRuneProofEngine(request.sources);
  const acquisitionUrl = new URL(request.acquisitionUrl, baseUrl);
  if (acquisitionUrl.origin !== new URL(baseUrl).origin) {
    throw new Error('RuneProof acquisition URL must be same-origin');
  }
  const response = await fetcher(acquisitionUrl, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`RuneProof acquisition fetch failed: HTTP ${response.status}`);
  }
  const acquisition: unknown = await response.json();
  try {
    assertRuneProofSourceDocument(acquisition);
  } catch {
    throw new Error('RuneProof acquisition response is invalid');
  }
  if (acquisition.sourceVersion !== request.sourceVersion) {
    throw new Error('RuneProof acquisition source version mismatch');
  }
  const { sourceVersion: _sourceVersion, ...contents } = acquisition;
  const computedVersion =
    `sha256-${sha256HexSync(canonicalDocumentJson(contents))}`;
  if (computedVersion !== request.sourceVersion) {
    throw new Error('RuneProof acquisition integrity check failed');
  }
  return createRuneProofEngine({
    sourceVersion: request.sourceVersion,
    sourceAudit: request.sourceAudit,
    acquisition,
    locationGraph: request.locationGraph,
  });
}

async function evaluate(request: EvaluateRequest): Promise<void> {
  try {
    if (!enginePromise) throw new Error('RuneProof worker is not initialized');
    const engine = await enginePromise;
    self.postMessage({
      id: request.id,
      report: await engine.evaluate(request.query, request.snapshot),
    });
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
      fatal: true,
    });
  }
}
