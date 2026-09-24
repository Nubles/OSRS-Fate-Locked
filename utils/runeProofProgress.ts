import type { GameState, RuneProofProgress } from '../types';

export const emptyRuneProofProgress = (): RuneProofProgress => ({ version: 1, items: {}, actions: {} });
/** A selected replacement must never consult newer browser-only guide checks. */
export const sealRuneProofReplacement = (state: GameState): GameState => state.runeProofProgress !== undefined
  ? state : { ...state, runeProofProgress: emptyRuneProofProgress() };
export interface CanonicalRuneProofControls {
  progress: RuneProofProgress | undefined;
  update: (expectedRunId: string, change: RuneProofMutation) => boolean;
}
export type RuneProofMutation =
  | { kind: 'ITEM'; questId: string; id: string; confirmed: boolean }
  | { kind: 'ACTION'; questId: string; id: string; revision: string; confirmed: boolean }
  | { kind: 'BIND'; questId: string; revision: string; validIds: readonly string[] };

const safeId = (value: string): boolean => typeof value === 'string' && value.length > 0
  && value.length <= 512 && !['__proto__', 'prototype', 'constructor'].includes(value);

export function updateRuneProofProgress(current: RuneProofProgress, change: RuneProofMutation): RuneProofProgress {
  if (!safeId(change.questId)) return current;
  if (change.kind !== 'ITEM' && !safeId(change.revision)) return current;
  if (change.kind === 'BIND') {
    const prior = current.actions[change.questId];
    if (!prior || prior.revision !== null) return current;
    const ids = prior.ids.filter(id => change.validIds.includes(id));
    return { ...current, actions: { ...current.actions, [change.questId]: { revision: change.revision, ids } } };
  }
  if (!safeId(change.id)) return current;
  const entries = change.kind === 'ITEM' ? current.items : current.actions;
  if (!Object.hasOwn(entries, change.questId) && Object.keys(entries).length >= 250) return current;
  const prior = change.kind === 'ITEM' ? current.items[change.questId] ?? []
    : current.actions[change.questId]?.revision === change.revision || current.actions[change.questId]?.revision === null
      ? current.actions[change.questId]?.ids ?? [] : [];
  const ids = change.confirmed ? [...new Set([...prior, change.id])] : prior.filter(id => id !== change.id);
  if (ids.length > 1000) return current;
  return change.kind === 'ITEM'
    ? { ...current, items: { ...current.items, [change.questId]: ids } }
    : { ...current, actions: { ...current.actions, [change.questId]: { revision: change.revision, ids } } };
}

const legacyChecks = (raw: string | null): Record<string, string[]> => {
  if (!raw || raw.length > 65_536) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).slice(0, 250).flatMap(([questId, ids]) =>
      safeId(questId) && Array.isArray(ids)
        ? [[questId, [...new Set(ids.filter(id => typeof id === 'string' && safeId(id)))].slice(0, 1000)]]
        : []));
  } catch { return {}; }
};

/** Read-only migration at local load, never at import/restore. Originals remain recoverable. */
export function migrateLocalRuneProofProgress(state: GameState, storage: Pick<Storage, 'getItem'>): GameState {
  if (state.runeProofProgress !== undefined) return state;
  try {
    const items = legacyChecks(storage.getItem(`fate_runeproof_preview_checks_v1:${state.runId}`));
    const actions = legacyChecks(storage.getItem(`fate_runeproof_preview_actions_v1:${state.runId}`));
    return { ...state, runeProofProgress: {
      version: 1, items,
      actions: Object.fromEntries(Object.entries(actions).map(([questId, ids]) => [questId, { revision: null, ids }])),
    } };
  } catch {
    // Do not stamp migration complete when the source could not be read.
    return state;
  }
}
