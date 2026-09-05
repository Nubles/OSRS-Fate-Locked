import type { UnlockState } from '../types';
import { SKILLS_LIST } from '../data/items';
import { QUEST_DATA } from '../data/questData';
import { isAreaReachable } from './reachability';
import { actualSkillLevel, unlockedEquipmentTier, unlockedMethodTier } from './skillLevels';

export type RequirementPredicate =
  | { kind: 'all' | 'any'; of: RequirementPredicate[] }
  | { kind: 'skill'; skill: string; level: number }
  | { kind: 'method'; skill: string; tier: number }
  | { kind: 'equipment'; slot: string; tier: number }
  | { kind: 'quest'; id: string }
  | { kind: 'area'; id: string }
  | { kind: 'questPoints'; count: number }
  | { kind: 'item'; id: string; label: string; usage: 'hold' | 'consume' | 'equip' }
  | { kind: 'bossKill'; id: string; count: number; label: string }
  | { kind: 'slayerTask'; id: string; label: string }
  | { kind: 'accountMode'; id: string; label: string }
  | { kind: 'manual' | 'unknown'; key: string; label: string };

export type RequirementCertainty = 'READY' | 'LOCKED' | 'NEEDS_CONFIRMATION' | 'UNKNOWN';
export interface PredicateResult { status: RequirementCertainty; checks: string[] }
export interface PredicateContext {
  unlocks: UnlockState;
  gameModeId?: string;
  /** Only fresh, explicit facts may satisfy external conditions. Missing is not false. */
  confirmations?: Readonly<Record<string, boolean>>;
  accountMode?: string;
}

export function evaluatePredicate(predicate: RequirementPredicate, context: PredicateContext): PredicateResult {
  const result = (status: RequirementCertainty, label: string): PredicateResult => ({ status, checks: status === 'READY' ? [] : [label] });
  const check = (met: boolean, label: string) => result(met ? 'READY' : 'LOCKED', label);
  const external = (key: string, label: string) => {
    const confirmed = context.confirmations?.[key];
    return confirmed === undefined ? result('NEEDS_CONFIRMATION', label) : check(confirmed, label);
  };
  const u = context.unlocks;
  if (!predicate || typeof predicate !== 'object') return result('UNKNOWN', 'Unclassified requirement');
  switch (predicate.kind) {
    case 'all':
    case 'any': {
      if (!Array.isArray(predicate.of)) return result('UNKNOWN', 'Invalid requirement group');
      const results = predicate.of.map(p => evaluatePredicate(p, context));
      if (predicate.kind === 'any' && results.some(r => r.status === 'READY')) return result('READY', '');
      if (!results.length) return result(predicate.kind === 'all' ? 'READY' : 'UNKNOWN', 'No classified alternative');
      const order: RequirementCertainty[] = predicate.kind === 'all'
        ? ['LOCKED', 'UNKNOWN', 'NEEDS_CONFIRMATION', 'READY']
        : ['NEEDS_CONFIRMATION', 'UNKNOWN', 'LOCKED'];
      return { status: order.find(status => results.some(r => r.status === status))!, checks: [...new Set(results.flatMap(r => r.checks))] };
    }
    case 'skill': if (!SKILLS_LIST.includes(predicate.skill)) return result('UNKNOWN', predicate.skill); return check(actualSkillLevel(u, predicate.skill) >= predicate.level, `${predicate.skill} ${predicate.level}`);
    case 'method': return check(unlockedMethodTier(u, predicate.skill) >= predicate.tier, `${predicate.skill} method tier ${predicate.tier}`);
    case 'equipment': return check(unlockedEquipmentTier(u, predicate.slot) >= predicate.tier, `${predicate.slot} equipment tier ${predicate.tier}`);
    case 'quest': return QUEST_DATA[predicate.id] ? check(u.quests.includes(predicate.id), predicate.id) : result('UNKNOWN', predicate.id);
    case 'area': return check(isAreaReachable(predicate.id, u, context.gameModeId), predicate.id);
    case 'questPoints': return check(u.quests.reduce((sum, id) => sum + (QUEST_DATA[id]?.kind === 'quest' ? QUEST_DATA[id].points : 0), 0) >= predicate.count, `${predicate.count} Quest Points`);
    case 'item': return external(`item:${predicate.id}:${predicate.usage}`, `${predicate.label}: available and legal to ${predicate.usage}`);
    case 'bossKill': return external(`bossKill:${predicate.id}:${predicate.count}`, predicate.label);
    case 'slayerTask': return external(`slayerTask:${predicate.id}`, predicate.label);
    case 'accountMode': return context.accountMode === undefined ? result('NEEDS_CONFIRMATION', predicate.label) : check(context.accountMode === predicate.id, predicate.label);
    case 'manual': return external(predicate.key, predicate.label);
    case 'unknown': return result('UNKNOWN', predicate.label);
    default: return result('UNKNOWN', 'Unclassified requirement');
  }
}
