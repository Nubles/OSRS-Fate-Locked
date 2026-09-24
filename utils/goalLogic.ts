
import { ContentRequirement } from '../data/requirements';
import { UnlockState, TableType } from '../types';
import { isAreaReachable } from './reachability';
import { effectiveSkillLevel } from './slayerReach';
import { QUEST_DATA } from '../data/questData';
import { currentQuestPoints, evaluateQuestEligibility } from './journalStatus';

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
  const missing: string[] = [];
  let total = 0;
  let completed = 0;

  if (req.questPoints !== undefined) {
    total++;
    const points = currentQuestPoints(unlocks);
    if (points >= req.questPoints) completed++;
    else missing.push(`Quest Points (${points}/${req.questPoints})`);
  }

  // 1. Check Regions
  req.regions.forEach(r => {
    total++;
    const isUnlocked = isAreaReachable(r, unlocks, gameModeId);

    if (isUnlocked) completed++;
    else missing.push(`Region: ${r}`);
  });

  // 2. Check Skills
  Object.entries(req.skills).forEach(([skill, level]) => {
    total++;
    if (skill === 'Quest Points') {
      const points = currentQuestPoints(unlocks);
      if (points >= level) completed++;
      else missing.push(`Quest Points (${points}/${level})`);
      return;
    }
    const currentLevel = effectiveSkillLevel(unlocks, skill);
    const isUnlocked = (unlocks.skills[skill] || 0) > 0;
    
    if (isUnlocked && currentLevel >= level) {
      completed++;
    } else {
      let msg = '';
      if (!isUnlocked) msg = `${skill} (Locked)`;
      else msg = `${skill} (Lvl ${currentLevel}/${level})`;
      missing.push(msg);
    }
  });

  // 3. Check Quests (matched against unlocks.quests, which stores quest IDs)
  if (req.quests) {
    req.quests.forEach(q => {
      total++;
      if (unlocks.quests.includes(q)) {
          completed++;
      } else {
          missing.push(`Quest: ${q}`);
      }
    });
  }

  // 3b. Check Achievement Diary tiers (matched against unlocks.diaries).
  if (req.diaries) {
    req.diaries.forEach(d => {
      total++;
      if (unlocks.diaries.includes(d)) {
          completed++;
      } else {
          missing.push(`Diary: ${d}`);
      }
    });
  }

  // 4. Category Key Check (If the item itself requires a key unlock)
  // Note: Only check this if the item isn't a Quest/Diary itself (those are covered by prereqs)
  if (req.category !== TableType.QUESTS && req.category !== TableType.DIARIES && req.category !== TableType.COMBAT_ACHIEVEMENTS) {
      total++;
      let isCategoryUnlocked = false;
      
      // Determine if unlocked based on type
      switch(req.category) {
          case TableType.BOSSES: isCategoryUnlocked = unlocks.bosses.includes(req.id); break;
          case TableType.MINIGAMES: isCategoryUnlocked = unlocks.minigames.includes(req.id); break;
          case TableType.GUILDS: isCategoryUnlocked = unlocks.guilds.includes(req.id); break;
          case TableType.FARMING_LAYERS: isCategoryUnlocked = unlocks.farming.includes(req.id); break;
          case TableType.MOBILITY: isCategoryUnlocked = unlocks.mobility.includes(req.id); break;
          case TableType.ARCANA: isCategoryUnlocked = unlocks.arcana.includes(req.id); break;
          case TableType.POH: isCategoryUnlocked = unlocks.housing.includes(req.id); break;
          case TableType.STORAGE: isCategoryUnlocked = unlocks.storage.includes(req.id); break;
          case TableType.MERCHANTS: isCategoryUnlocked = unlocks.merchants.includes(req.id); break;
          case TableType.AGILITY_COURSES: isCategoryUnlocked = true; break; // Unlocked by Region usually
          default: isCategoryUnlocked = true; // Assume unlocked if not in a trackable list
      }
      
      if (isCategoryUnlocked) completed++;
      else missing.push(`Unlock: ${req.id}`);
  }

  // Adjust percentage to avoid 100% if missing items (rounding errors)
  let percentage = total === 0 ? 100 : Math.round((completed / total) * 100);
  if (missing.length > 0 && percentage === 100) percentage = 99;

  return {
    percentage,
    missing,
    totalSteps: total,
    completedSteps: completed
  };
};
