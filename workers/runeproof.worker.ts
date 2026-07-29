import { createRuneProofEngine, type RuneProofEngineSources, type RuneProofQuery } from '../utils/runeproof/engine';
import type { RuneProofRunSnapshot } from '../types';

type InitializeRequest = {
  type: 'INITIALIZE';
  sources: RuneProofEngineSources;
};
type EvaluateRequest = {
  type: 'EVALUATE';
  id: number;
  query: RuneProofQuery;
  snapshot: RuneProofRunSnapshot;
};
type Request = InitializeRequest | EvaluateRequest;

let engine: ReturnType<typeof createRuneProofEngine> | null = null;
self.onmessage = async (event: MessageEvent<Request>) => {
  if (event.data.type === 'INITIALIZE') {
    engine = createRuneProofEngine(event.data.sources);
    return;
  }
  const { id, query, snapshot } = event.data;
  try {
    if (!engine) throw new Error('RuneProof worker is not initialized');
    self.postMessage({ id, report: await engine.evaluate(query, snapshot) });
  } catch (error) {
    self.postMessage({
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
