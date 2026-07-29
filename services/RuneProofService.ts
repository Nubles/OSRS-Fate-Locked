import type { RuneProofRunSnapshot } from '../types';
import type { RuneProofReport } from '../utils/runeproof/model';
import type { RuneProofEngine, RuneProofQuery } from '../utils/runeproof/engine';

/** App-facing, latest-request-wins facade around the pure engine or worker adapter. */
export class RuneProofService {
  private readonly cache = new Map<string, RuneProofReport>();
  private active: AbortController | null = null;
  private serial = 0;
  private disposed = false;

  constructor(private readonly engine: RuneProofEngine, private readonly currentSnapshot: () => RuneProofRunSnapshot) {}

  async evaluate(query: RuneProofQuery): Promise<RuneProofReport | null> {
    if (this.disposed) return null;
    const snapshot = this.currentSnapshot();
    const sourceVersion = this.engine.sourceVersion;
    const key = `${sourceVersion}|${snapshot.runId}|${snapshot.runRevision}|${query.goal.id}|${flags(query)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;
    this.active?.abort();
    const controller = new AbortController();
    this.active = controller;
    const serial = ++this.serial;
    try {
      const result = await this.engine.evaluate(query, snapshot, controller.signal);
      const current = this.currentSnapshot();
      if (this.disposed || serial !== this.serial || controller.signal.aborted
        || this.engine.sourceVersion !== sourceVersion || current.runId !== snapshot.runId
        || current.runRevision !== snapshot.runRevision) return null;
      this.cache.set(key, result);
      return result;
    } catch (error) {
      if (controller.signal.aborted || this.disposed) return null;
      throw error;
    } finally {
      if (this.active === controller) this.active = null;
    }
  }

  dispose(): void { this.disposed = true; this.serial += 1; this.active?.abort(); this.active = null; this.cache.clear(); }
}

function flags(query: RuneProofQuery): string { return `alternatives=${query.includeAlternatives !== false};blockers=${query.includeBlockers !== false}`; }
