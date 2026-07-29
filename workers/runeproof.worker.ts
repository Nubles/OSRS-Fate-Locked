import { createRuneProofEngine, type RuneProofEngineSources, type RuneProofQuery } from '../utils/runeproof/engine';
import type { RuneProofRunSnapshot } from '../types';

type Request = { id: number; sources: RuneProofEngineSources; query: RuneProofQuery; snapshot: RuneProofRunSnapshot };
self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, sources, query, snapshot } = event.data;
  try { self.postMessage({ id, report: await createRuneProofEngine(sources).evaluate(query, snapshot) }); }
  catch (error) { self.postMessage({ id, error: error instanceof Error ? error.message : String(error) }); }
};
