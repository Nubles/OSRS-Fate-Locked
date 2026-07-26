import type { FateEventEnvelope } from './fateEventProtocol';

export type RollInboxState =
  | 'RECEIVED'
  | 'READY'
  | 'NEEDS_CONFIRMATION'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'DUPLICATE';

export type RollInboxReviewOutcome = 'CONFIRMED_UNCHANGED' | 'CORRECTED';

export interface RollInboxRow {
  event: FateEventEnvelope;
  state: RollInboxState;
  reason?: string;
  reviewOutcome?: RollInboxReviewOutcome;
  updatedAt: number;
}

export interface RollInboxStore {
  ingest(events: FateEventEnvelope[]): void;
  list(): RollInboxRow[];
  transition(
    eventId: string,
    state: RollInboxState,
    reason?: string,
    reviewOutcome?: RollInboxReviewOutcome,
  ): boolean;
  subscribe(listener: () => void): () => void;
}

const MAX_ACTIVE = 250;
const TERMINAL_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const TERMINAL = new Set<RollInboxState>(['COMPLETED', 'DISMISSED', 'DUPLICATE']);

export function createRollInboxStore(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  runId: string,
): RollInboxStore {
  const key = `fate_roll_inbox_v1:${runId}`;
  const listeners = new Set<() => void>();
  let rows = loadRows();

  function loadRows(): RollInboxRow[] {
    try {
      const parsed = JSON.parse(storage.getItem(key) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      const cutoff = Date.now() - TERMINAL_RETENTION_MS;
      return parsed.filter((row): row is RollInboxRow =>
        row && typeof row === 'object'
        && row.event && typeof row.event.eventId === 'string'
        && typeof row.state === 'string'
        && (!TERMINAL.has(row.state) || row.updatedAt >= cutoff));
    } catch {
      return [];
    }
  }

  function sorted(input: RollInboxRow[]): RollInboxRow[] {
    return [...input].sort((left, right) =>
      left.event.occurredAt - right.event.occurredAt
      || left.event.sessionSequence - right.event.sessionSequence
      || left.event.eventId.localeCompare(right.event.eventId));
  }

  function save(): void {
    storage.setItem(key, JSON.stringify(rows));
    for (const listener of listeners) listener();
  }

  return {
    ingest(events) {
      const byId = new Map(rows.map(row => [row.event.eventId, row]));
      let changed = false;
      for (const event of events) {
        if (byId.has(event.eventId)) continue;
        const row: RollInboxRow = {
          event,
          state: 'RECEIVED',
          updatedAt: Date.now(),
        };
        byId.set(event.eventId, row);
        changed = true;
      }
      if (!changed) return;
      const all = sorted([...byId.values()]);
      const terminal = all.filter(row => TERMINAL.has(row.state));
      const active = all.filter(row => !TERMINAL.has(row.state)).slice(-MAX_ACTIVE);
      rows = sorted([...terminal, ...active]);
      save();
    },

    list() {
      return sorted(rows).map(row => ({ ...row, event: { ...row.event } }));
    },

    transition(eventId, state, reason, reviewOutcome) {
      const index = rows.findIndex(row => row.event.eventId === eventId);
      if (index < 0 || rows[index].state === state && rows[index].reason === reason) {
        return false;
      }
      rows = rows.map((row, rowIndex) => rowIndex === index
        ? {
            ...row,
            state,
            reason,
            reviewOutcome: reviewOutcome ?? row.reviewOutcome,
            updatedAt: Date.now(),
          }
        : row);
      save();
      return true;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
