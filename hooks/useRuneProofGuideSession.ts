import { useCallback, useEffect, useState } from 'react';

export const runeProofGuideStorageKey = (runId: string): string => `fate_runeproof_guide_v1:${runId}`;

const readSelectedQuest = (runId: string): string | null => {
  try {
    const value = window.localStorage.getItem(runeProofGuideStorageKey(runId));
    return value && value.length <= 200 ? value : null;
  } catch {
    return null;
  }
};

/** Remembers the article independently of canonical quest progress and hides stale runs immediately. */
export function useRuneProofGuideSession(
  runId: string,
  questIds: ReadonlySet<string>,
  initialQuestId?: string,
) {
  const [selection, setSelection] = useState(() => ({
    runId,
    initialQuestId,
    questId: initialQuestId ?? readSelectedQuest(runId),
  }));

  useEffect(() => {
    setSelection(current => current.runId === runId && current.initialQuestId === initialQuestId
      ? current
      : { runId, initialQuestId, questId: initialQuestId ?? readSelectedQuest(runId) });
  }, [initialQuestId, runId]);

  const isHydrated = selection.runId === runId && selection.initialQuestId === initialQuestId;
  const questId = isHydrated && selection.questId && questIds.has(selection.questId)
    ? selection.questId
    : null;
  useEffect(() => {
    if (!questId) return;
    try {
      window.localStorage.setItem(runeProofGuideStorageKey(runId), questId);
    } catch {
      // Reading a guide must not depend on browser storage permissions.
    }
  }, [questId, runId]);
  const selectQuest = useCallback((nextQuestId: string) => {
    if (!questIds.has(nextQuestId)) return;
    setSelection({ runId, initialQuestId, questId: nextQuestId });
    try {
      window.localStorage.setItem(runeProofGuideStorageKey(runId), nextQuestId);
    } catch {
      // Keep the current reading session usable when browser storage is unavailable.
    }
  }, [initialQuestId, questIds, runId]);

  return { questId, isHydrated, selectQuest };
}
