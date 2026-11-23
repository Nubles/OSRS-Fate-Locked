
import type { ContentRequirement } from '../data/requirements';
import type { UnlockState } from '../types';
import { QUEST_DATA } from '../data/questData';
import { evaluateQuestEligibility } from './journalStatus';
import { alternativeRequirementText, analyzeRequirement } from './strategyRequirement';

export interface GoalProgress {
  percentage: number;
  missing: string[];
  totalSteps: number;
  completedSteps: number;
}

export const calculateGoalProgress = (req: ContentRequirement, unlocks: UnlockState, gameModeId?: string): GoalProgress => {
  const quest = QUEST_DATA[req.id];
  if (quest) {
    const eligibility = evaluateQuestEligibility(quest, unlocks, gameModeId);
    const missing = [...eligibility.blockers.map(blocker => blocker.label), ...eligibility.manualChecks.map(check => 'Confirm: ' + check)];
    const completedSteps = eligibility.evidence.length;
    const totalSteps = completedSteps + missing.length;
    return {
      missing, completedSteps, totalSteps,
      percentage: eligibility.eligible ? 100 : Math.min(99, totalSteps === 0 ? 0 : Math.round(100 * completedSteps / totalSteps)),
    };
  }
  // A Strategy Guide entry: judged exactly as its Strategy Guide card is
  // (no Key asked for an id no Key can roll, access routes, manual checks,
  // alternatives), only worded for the tracker card.
  const analysis = analyzeRequirement(req, unlocks, gameModeId);
  const { parts } = analysis;
  const missing = [...new Set([
    ...(parts.questPoints ? [`Quest Points (${parts.questPoints.have}/${parts.questPoints.need})`] : []),
    ...analysis.missingRegions.map(region => `Region: ${region}`),
    ...analysis.missingSkills.map(skill => skill.isUnlocked
      ? `${skill.skill} (Lvl ${skill.currentLevel}/${skill.reqLevel})` : `${skill.skill} (Locked)`),
    ...analysis.missingQuests.map(quest => `Quest: ${quest}`),
    ...parts.missingDiaries.map(diary => `Diary: ${diary}`),
    ...analysis.missingUnlocks.map(unlock => `Unlock: ${unlock}`),
    ...(parts.missingAccessRoute ? [parts.missingAccessRoute] : []),
    ...parts.otherBlockers,
    // The tracker can never tick these, so the card can never claim Ready while they stand.
    ...analysis.missingAlternatives.map(alternative => 'Confirm: ' + alternativeRequirementText(alternative)),
    ...[...parts.manualChecks, ...parts.confirmChecks].map(check => 'Confirm: ' + check),
    ...parts.chunkChecks,
  ])];
  const completedSteps = analysis.metReqs;
  return {
    percentage: analysis.isFullyPlayable && missing.length === 0 ? 100 : Math.min(99, analysis.completionPercent),
    missing,
    totalSteps: completedSteps + missing.length,
    completedSteps,
  };
};
