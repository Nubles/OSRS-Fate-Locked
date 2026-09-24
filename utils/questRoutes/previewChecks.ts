import {
  reviewedQuestRequirements,
  type ReviewedQuestRequirements,
} from '../../data/questItemRequirements';

export interface RuneProofStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type RuneProofPreviewChecks = Record<string, string[]>;

/** The reviewed item list for a guide; preview guide packs carry their own. */
export type RuneProofRequirementLookup = (questId: string) => ReviewedQuestRequirements | null | undefined;

export const RUNEPROOF_PREVIEW_MAX_CHARS = 65_536;

export const runeProofPreviewStorageKey = (runId: string): string =>
  `fate_runeproof_preview_checks_v1:${runId}`;

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

export function normalizeRuneProofPreviewChecks(
  value: unknown,
  requirementsFor: RuneProofRequirementLookup = reviewedQuestRequirements,
): RuneProofPreviewChecks {
  if (!isRecord(value)) return {};
  const normalized: RuneProofPreviewChecks = {};

  for (const questId of Object.keys(value).sort()) {
    const reviewed = requirementsFor(questId);
    const storedKeys = value[questId];
    if (!reviewed || !Array.isArray(storedKeys)) continue;
    const requested = new Set(storedKeys.filter((key): key is string => typeof key === 'string'));
    const validKeys = reviewed.items
      .filter(requirement => requirement.supplyPolicy === 'PLAYER_OBTAINED')
      .map(requirement => requirement.item.key)
      .filter(key => requested.has(key));
    if (validKeys.length > 0) normalized[questId] = validKeys;
  }

  return normalized;
}

export function readRuneProofPreviewChecks(
  storage: RuneProofStorage,
  runId: string,
  requirementsFor?: RuneProofRequirementLookup,
): RuneProofPreviewChecks {
  try {
    const raw = storage.getItem(runeProofPreviewStorageKey(runId));
    if (raw === null || raw.length > RUNEPROOF_PREVIEW_MAX_CHARS) return {};
    return normalizeRuneProofPreviewChecks(JSON.parse(raw), requirementsFor);
  } catch {
    return {};
  }
}

export function writeRuneProofPreviewChecks(
  storage: RuneProofStorage,
  runId: string,
  checks: RuneProofPreviewChecks,
  requirementsFor?: RuneProofRequirementLookup,
): void {
  const normalized = normalizeRuneProofPreviewChecks(checks, requirementsFor);
  const key = runeProofPreviewStorageKey(runId);
  try {
    if (Object.keys(normalized).length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(normalized));
  } catch {
    // Preview confirmation persistence must never interrupt the Goal Planner.
  }
}
