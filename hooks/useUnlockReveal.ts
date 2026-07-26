import { useState, useEffect, useRef } from 'react';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import type { UnlockState } from '../types';
import {
  evaluateDiaryTaskEligibility,
  evaluateQuestEligibility,
} from '../utils/journalStatus';

export interface UnlockRevealData {
  /** Display names of quests just marked complete. */
  completedQuests: string[];
  /** Region IDs that just appeared in unlocks.regions. */
  newRegions: string[];
  /** Boss IDs that just appeared in unlocks.bosses. */
  newBosses: string[];
  /** Quests that just transitioned to automatic eligibility. */
  newQuestsAvailable: Array<{ id: string; name: string }>;
  /** Diary tier IDs that just transitioned to automatic eligibility. */
  newDiaryTiersAvailable: string[];
}

const diaryTierIsAutomaticallyEligible = (
  tierId: string,
  unlocks: UnlockState,
  gameModeId?: string,
): boolean => ALL_DIARY_TASKS
  .filter(task => (
    task.tierId === tierId && !unlocks.completedTasks.includes(task.id)
  ))
  .every(task => evaluateDiaryTaskEligibility(task, unlocks, gameModeId).eligible);

export function getUnlockRevealTransition(
  previous: UnlockState,
  current: UnlockState,
  gameModeId?: string,
): UnlockRevealData | null {
  const completedQuests = current.quests.filter(
    questId => !previous.quests.includes(questId),
  );
  const newRegions = current.regions.filter(
    region => !previous.regions.includes(region),
  );
  const newBosses = current.bosses.filter(
    boss => !previous.bosses.includes(boss),
  );

  // Diary task / CA task ticks do not initiate a reveal by themselves.
  if (completedQuests.length === 0 && newRegions.length === 0 && newBosses.length === 0) {
    return null;
  }

  const newQuestsAvailable = Object.values(QUEST_DATA)
    .filter(quest => !current.quests.includes(quest.id))
    .filter(quest => (
      !evaluateQuestEligibility(quest, previous, gameModeId).eligible
      && evaluateQuestEligibility(quest, current, gameModeId).eligible
    ))
    .map(quest => ({ id: quest.id, name: quest.name }));

  const newDiaryTiersAvailable = Object.values(DIARY_DATA)
    .filter(diary => !current.diaries.includes(diary.id))
    .filter(diary => (
      !diaryTierIsAutomaticallyEligible(diary.id, previous, gameModeId)
      && diaryTierIsAutomaticallyEligible(diary.id, current, gameModeId)
    ))
    .map(diary => diary.id);

  return {
    completedQuests: completedQuests.map(
      questId => QUEST_DATA[questId]?.name ?? questId,
    ),
    newRegions,
    newBosses,
    newQuestsAvailable,
    newDiaryTiersAvailable,
  };
}

/**
 * Watches `unlocks` and fires a reveal whenever a meaningful change happens
 * (quest complete, region / boss unlock). Returns [revealData, dismiss].
 *
 * Only triggers on quests / regions / bosses — diary task ticks and CA
 * task ticks do not produce a reveal.
 */
export function useUnlockReveal(
  unlocks: UnlockState,
  gameModeId?: string,
): [UnlockRevealData | null, () => void] {
  const prevRef = useRef<UnlockState | null>(null);
  const [reveal, setReveal] = useState<UnlockRevealData | null>(null);

  useEffect(() => {
    const previous = prevRef.current;
    prevRef.current = unlocks;

    // First mount — establish baseline, no reveal.
    if (!previous) return;

    const nextReveal = getUnlockRevealTransition(previous, unlocks, gameModeId);
    if (nextReveal) setReveal(nextReveal);
  }, [unlocks, gameModeId]);

  const dismiss = () => setReveal(null);
  return [reveal, dismiss];
}
