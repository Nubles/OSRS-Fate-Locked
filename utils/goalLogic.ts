
import { ContentRequirement } from '../data/requirements';
import { UnlockState, TableType } from '../types';
import { isAreaReachable } from './reachability';
import { actualSkillLevel } from './skillLevels';
import { DIARY_DATA } from '../data/diaryData';
import { evaluateQuestEligibility, evaluateDiaryTierEligibility } from './journalStatus';
import { getActivityReq } from '../data/activityRequirements';
import { evaluateActivityReadiness } from './activityReadiness';
import { canonicalQuestUnlocks, catalogQuest } from '../data/questCatalog';

export interface GoalProgress {
  percentage: number;
  missing: string[];
  totalSteps: number;
  completedSteps: number;
}

export const calculateGoalProgress = (req: ContentRequirement, unlocks: UnlockState, gameModeId?: string): GoalProgress => {
  unlocks = canonicalQuestUnlocks(unlocks);
  const quest = req.category === TableType.QUESTS ? catalogQuest(req.id)?.data : undefined;
  const journal = quest
    ? evaluateQuestEligibility(quest, unlocks, gameModeId)
    : req.category === TableType.DIARIES && DIARY_DATA[req.id]
      ? evaluateDiaryTierEligibility(DIARY_DATA[req.id], unlocks, gameModeId) : undefined;
  if (journal) {
    const missing = [...new Set([...journal.blockers.map(b => b.label), ...journal.manualChecks])];
    const ready = journal.eligible || journal.status === 'COMPLETED';
    if (!ready && missing.length === 0) missing.push('Requirements remain unverified');
    const completed = journal.evidence.length;
    const total = Math.max(1, completed + missing.length);
    return { missing: ready ? [] : missing, totalSteps: total, completedSteps: ready ? total : completed,
      percentage: ready ? 100 : Math.min(99, Math.round(completed / total * 100)) };
  }
  const activity = getActivityReq(req.id);
  // Canonical activity rules already include alternative locations and gates.
  // Legacy strategy summaries must not add outdated mandatory requirements.
  if (activity) req = { id: req.id, category: req.category, regions: [], skills: {} };
  const missing: string[] = [];
  let total = 0;
  let completed = 0;

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
    const currentLevel = actualSkillLevel(unlocks, skill);
    const isUnlocked = (unlocks.skills[skill] || 0) > 0;
    
    if (currentLevel >= level) {
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

  // Activity gates, untracked items and incomplete legacy entries must also
  // remain visible when a goal is pinned outside the strategy guide.
  const checks: string[] = [];
  if (activity) {
    const readiness = evaluateActivityReadiness(true, activity, unlocks, gameModeId);
    if ('checks' in readiness) checks.push(...readiness.checks);
    if (readiness.status === 'NOT_READY') checks.push(...readiness.blockers.map(b => b.label));
  } else if (req.category !== TableType.QUESTS && req.category !== TableType.DIARIES) {
    checks.push('Additional item, method and activity requirements need review');
  }
  if (req.requirementsReviewed === false) checks.push('Additional item, method and activity requirements need review');
  checks.push(...(req.items ?? []).map(item => `Confirm available and legal: ${item}`));
  checks.push(...(req.alternatives ?? []).map(route => `Confirm route: ${route.label}`));
  for (const check of new Set(checks)) {
    if (!missing.includes(check)) { missing.push(check); total++; }
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
