/**
 * Quest Impact Advisor
 *
 * For every AVAILABLE quest, simulates completing it and counts how many
 * currently-locked quests + diary tiers would become AVAILABLE as a direct
 * result. The score (questsUnlocked×2 + diaryTiersUnlocked) is used to rank
 * quests so ironmen can see at a glance which quest has the highest pay-off.
 *
 * Pure function — no side-effects, no React, safe to call inside useMemo.
 */

import { QUEST_DATA, QuestData } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { getQuestStatus, getDiaryStatus } from './journalStatus';

export interface RankedQuest {
  id: string;
  name: string;
  points: number;
  /** Quests that go LOCKED → AVAILABLE after this one is complete. */
  newQuestNames: string[];
  /** Diary tier IDs that go LOCKED → AVAILABLE after this one is complete. */
  newDiaryIds: string[];
  /** Composite score: questsUnlocked×2 + diaryTiersUnlocked */
  score: number;
}

/**
 * Returns all AVAILABLE quests ranked by unlock impact (highest score first).
 * Ties are broken alphabetically by quest name.
 *
 * @param unlocks  Current unlocks snapshot (same shape as GameContext unlocks)
 */
export function rankAvailableQuests(unlocks: any): RankedQuest[] {
  const allQuests = Object.values(QUEST_DATA);
  const allDiaries = Object.values(DIARY_DATA);

  // Pre-compute current status for every quest/diary once — O(n) baseline.
  const currentQuestStatus = new Map<string, string>(
    allQuests.map((q) => [q.id, getQuestStatus(q, unlocks)]),
  );
  const currentDiaryStatus = new Map<string, string>(
    allDiaries.map((d) => [d.id, getDiaryStatus(d, unlocks)]),
  );

  const available = allQuests.filter((q) => currentQuestStatus.get(q.id) === 'AVAILABLE');

  return available
    .map((candidate): RankedQuest => {
      // Simulate completing this quest: add its id to unlocks.quests and add
      // its QP to the running total (done automatically by getQuestStatus via
      // unlocks.quests lookup). We also carry its point value forward.
      const simulatedUnlocks = {
        ...unlocks,
        quests: [...unlocks.quests, candidate.id],
      };

      // Which quests that are currently locked become AVAILABLE?
      const newQuestNames = allQuests
        .filter((q) => {
          if (q.id === candidate.id) return false;            // skip self
          if (currentQuestStatus.get(q.id) === 'AVAILABLE') return false; // already open
          if (currentQuestStatus.get(q.id) === 'COMPLETED') return false; // already done
          return getQuestStatus(q, simulatedUnlocks) === 'AVAILABLE';
        })
        .map((q) => q.name);

      // Which diary tiers that are currently locked become AVAILABLE?
      const newDiaryIds = allDiaries
        .filter((d) => {
          if (currentDiaryStatus.get(d.id) === 'AVAILABLE') return false;
          if (currentDiaryStatus.get(d.id) === 'COMPLETED') return false;
          return getDiaryStatus(d, simulatedUnlocks) === 'AVAILABLE';
        })
        .map((d) => d.id);

      const score = newQuestNames.length * 2 + newDiaryIds.length;

      return {
        id: candidate.id,
        name: candidate.name,
        points: candidate.points,
        newQuestNames,
        newDiaryIds,
        score,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}
