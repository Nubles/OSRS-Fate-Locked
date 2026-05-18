
import { ContentRequirement } from '../data/requirements';
import { UnlockState, TableType } from '../types';
import { REGION_GROUPS, MISTHALIN_AREAS } from '../constants';

export interface GoalProgress {
  percentage: number;
  missing: string[];
  totalSteps: number;
  completedSteps: number;
}

export const calculateGoalProgress = (req: ContentRequirement, unlocks: UnlockState): GoalProgress => {
  const missing: string[] = [];
  let total = 0;
  let completed = 0;

  // 1. Check Regions
  req.regions.forEach(r => {
    total++;
    let isUnlocked = false;

    // Direct check or Misthalin check
    if (r === 'Misthalin' || MISTHALIN_AREAS.includes(r) || unlocks.regions.includes(r)) {
      isUnlocked = true;
    } 
    // Region Group check (e.g. Asgarnia is unlocked if Falador is unlocked)
    else if (REGION_GROUPS[r]) {
      const hasSubRegion = REGION_GROUPS[r].some((area: string) => unlocks.regions.includes(area));
      if (hasSubRegion) isUnlocked = true;
    }

    if (isUnlocked) completed++;
    else missing.push(`Region: ${r}`);
  });

  // 2. Check Skills
  Object.entries(req.skills).forEach(([skill, level]) => {
    total++;
    const currentLevel = unlocks.levels[skill] || 1;
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

  // 3. Check Quests (Placeholder: currently we don't track completed quests in state explicitly)
  // We check if the quest ID is in the unlocks.quests list
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
