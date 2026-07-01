import { useState, useEffect, useRef } from 'react';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { getQuestStatus, getDiaryStatus } from '../utils/journalStatus';

export interface UnlockRevealData {
  /** Display names of quests just marked complete. */
  completedQuests: string[];
  /** Region IDs that just appeared in unlocks.regions. */
  newRegions: string[];
  /** Boss IDs that just appeared in unlocks.bosses. */
  newBosses: string[];
  /** Quests that just transitioned from LOCKED_* → AVAILABLE. */
  newQuestsAvailable: Array<{ id: string; name: string }>;
  /** Diary tier IDs that just transitioned to AVAILABLE. */
  newDiaryTiersAvailable: string[];
}

/**
 * Watches `unlocks` and fires a reveal whenever a meaningful change happens
 * (quest complete, region / boss unlock). Returns [revealData, dismiss].
 *
 * Only triggers on quests / regions / bosses — diary task ticks and CA
 * task ticks do not produce a reveal.
 */
export function useUnlockReveal(
  unlocks: any,
  gameModeId?: string,
): [UnlockRevealData | null, () => void] {
  const prevRef = useRef<any | null>(null);
  const [reveal, setReveal] = useState<UnlockRevealData | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = unlocks;

    // First mount — establish baseline, no reveal.
    if (!prev) return;

    const completedQuests = (unlocks.quests as string[]).filter(
      (q) => !(prev.quests as string[]).includes(q),
    );
    const newRegions = (unlocks.regions as string[]).filter(
      (r) => !(prev.regions as string[]).includes(r),
    );
    const newBosses = (unlocks.bosses as string[]).filter(
      (b) => !(prev.bosses as string[]).includes(b),
    );

    // Diary task / CA task ticks don't change quests / regions / bosses —
    // bail out early so we don't run O(n) comparisons on every tick.
    if (completedQuests.length === 0 && newRegions.length === 0 && newBosses.length === 0) return;

    // Quests that just became AVAILABLE (locked before → available now).
    const newQuestsAvailable = Object.values(QUEST_DATA)
      .filter((q) => !unlocks.quests.includes(q.id))
      .filter(
        (q) =>
          getQuestStatus(q, prev, gameModeId) !== 'AVAILABLE' &&
          getQuestStatus(q, unlocks, gameModeId) === 'AVAILABLE',
      )
      .map((q) => ({ id: q.id, name: q.name }));

    // Diary tiers that just became AVAILABLE.
    const newDiaryTiersAvailable = Object.values(DIARY_DATA)
      .filter((d) => !unlocks.diaries.includes(d.id))
      .filter(
        (d) =>
          getDiaryStatus(d, prev, gameModeId) !== 'AVAILABLE' &&
          getDiaryStatus(d, unlocks, gameModeId) === 'AVAILABLE',
      )
      .map((d) => d.id);

    setReveal({
      completedQuests: completedQuests.map(
        (qid) => QUEST_DATA[qid]?.name ?? qid,
      ),
      newRegions,
      newBosses,
      newQuestsAvailable,
      newDiaryTiersAvailable,
    });
  }, [unlocks]);

  const dismiss = () => setReveal(null);
  return [reveal, dismiss];
}
