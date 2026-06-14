/**
 * Journal progress analysis — the unmet requirements of a quest or diary tier,
 * used for "almost there" highlights, the unified next-best-actions feed, and
 * unlock-path checklists. One definition of "what's blocking this" shared by
 * every journal surface.
 *
 * Region checks use the chunk-refined gate (a quest reachable via unlocked
 * sub-areas isn't counted as region-blocked), matching the quest cards.
 */
import { QuestData, QUEST_DATA } from '../data/questData';
import { DiaryTier } from '../data/diaryData';
import { MISTHALIN_AREAS } from '../constants';
import { UnlockState } from '../types';
import { questLocations, refineQuestRegion } from './questLocations';

export interface Unmet {
  kind: 'region' | 'skill' | 'quest' | 'qp';
  label: string;
}

const regionFree = (r: string) => r === 'Misthalin' || MISTHALIN_AREAS.includes(r);

const skillUnmet = (skills: Record<string, number>, unlocks: UnlockState, qp: number): Unmet[] => {
  const out: Unmet[] = [];
  for (const [skill, lvl] of Object.entries(skills)) {
    if (skill === 'Quest Points') { if (qp < lvl) out.push({ kind: 'qp', label: `${lvl} QP` }); continue; }
    const have = unlocks.levels[skill] ?? 1;
    const unlocked = (unlocks.skills[skill] ?? 0) > 0;
    if (!unlocked || have < lvl) out.push({ kind: 'skill', label: `${skill} ${lvl}` });
  }
  return out;
};

const currentQP = (unlocks: UnlockState) =>
  unlocks.quests.reduce((a, id) => a + (QUEST_DATA[id]?.points ?? 0), 0);

/** Everything blocking a quest right now (empty ⇒ doable). */
export const questUnmet = (q: QuestData, unlocks: UnlockState): Unmet[] => {
  const out: Unmet[] = [];
  const gated = q.regions.filter(r => !regionFree(r) && !unlocks.regions.includes(r));
  const region = refineQuestRegion(gated.length === 0, questLocations(q.name, unlocks));
  if (!region.met) for (const r of gated) out.push({ kind: 'region', label: r });
  out.push(...skillUnmet(q.skills as Record<string, number>, unlocks, currentQP(unlocks)));
  for (const p of q.prereqs) if (!unlocks.quests.includes(p)) out.push({ kind: 'quest', label: p });
  return out;
};

/** Everything blocking a diary tier right now (empty ⇒ doable). */
export const diaryUnmet = (d: DiaryTier, unlocks: UnlockState): Unmet[] => {
  const out: Unmet[] = [];
  const regions = [...new Set([d.region, ...d.requiredRegions])];
  for (const r of regions) if (!regionFree(r) && !unlocks.regions.includes(r)) out.push({ kind: 'region', label: r });
  out.push(...skillUnmet(d.skills, unlocks, currentQP(unlocks)));
  for (const q of d.quests) if (!unlocks.quests.includes(q)) out.push({ kind: 'quest', label: q });
  return out;
};

/** Blocked by exactly one requirement — the quick wins worth surfacing. */
export const isAlmostThere = (unmet: Unmet[]): boolean => unmet.length === 1;
