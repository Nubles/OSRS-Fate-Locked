import { createRollInboxStore, type RollInboxStore } from './rollInboxStore';

const stores = new Map<string, RollInboxStore>();

export function getRollInboxStore(runId: string): RollInboxStore {
  let store = stores.get(runId);
  if (!store) {
    store = createRollInboxStore(localStorage, runId);
    stores.set(runId, store);
  }
  return store;
}

export function clearRollInboxRuntimeForTest(): void {
  stores.clear();
}
