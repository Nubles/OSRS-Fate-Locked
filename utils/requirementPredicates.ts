import type { UnlockState } from '../types';
import { SKILLS_LIST, EQUIPMENT_SLOTS, ARCANA_LIST, MOBILITY_LIST, POH_LIST, GUILDS_LIST, FARMING_PATCH_LIST, STORAGE_LIST, BOSSES_LIST, MINIGAMES_LIST } from '../data/items';
import { catalogQuest, completedQuestIds } from '../data/questCatalog';
import { areaId } from '../data/areaCatalog';
import { DIARY_DATA } from '../data/diaryData';
import { isAreaReachable } from './reachability';
import { actualSkillLevel, unlockedEquipmentTier, unlockedMethodTier } from './skillLevels';

const unlockCatalog = { arcana: ARCANA_LIST, mobility: MOBILITY_LIST, housing: POH_LIST, guilds: GUILDS_LIST, farming: FARMING_PATCH_LIST, storage: STORAGE_LIST, bosses: BOSSES_LIST, minigames: MINIGAMES_LIST };

export type RequirementPredicate =
  | { kind: 'unlock'; field: keyof typeof unlockCatalog; id: string }
  | { kind: 'all' | 'any'; of: RequirementPredicate[] }
  | { kind: 'skill'; skill: string; level: number }
  | { kind: 'combinedSkills'; skills: string[]; level: number }
  | { kind: 'method'; skill: string; tier: number }
  | { kind: 'equipment'; slot: string; tier: number }
  | { kind: 'quest'; id: string }
  | { kind: 'diary'; id: string }
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
    return confirmed === undefined ? result('NEEDS_CONFIRMATION', label)
      : typeof confirmed === 'boolean' ? check(confirmed, label) : result('UNKNOWN', `Invalid confirmation: ${label}`);
  };
  const u = context.unlocks;
  if (!predicate || typeof predicate !== 'object') return result('UNKNOWN', 'Unclassified requirement');
  const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
  const positiveInt = (value: number, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value > 0 && value <= max;
  const invalid = () => result('UNKNOWN', 'Invalid requirement');
  switch (predicate.kind) {
    case 'unlock': {
      if (!Object.hasOwn(unlockCatalog, predicate.field) || !unlockCatalog[predicate.field].includes(predicate.id)) return invalid();
      return check(u[predicate.field].includes(predicate.id), `Unlock: ${predicate.id}`);
    }
    case 'all':
    case 'any': {
      if (!Array.isArray(predicate.of)) return result('UNKNOWN', 'Invalid requirement group');
      const results = predicate.of.map(p => evaluatePredicate(p, context));
      if (predicate.kind === 'any' && results.some(r => r.status === 'READY')) return result('READY', '');
      if (!results.length) return result(predicate.kind === 'all' ? 'READY' : 'UNKNOWN', 'No classified alternative');
      const order: RequirementCertainty[] = predicate.kind === 'all'
        ? ['LOCKED', 'UNKNOWN', 'NEEDS_CONFIRMATION', 'READY']
        : ['NEEDS_CONFIRMATION', 'UNKNOWN', 'LOCKED'];
      const status = order.find(status => results.some(r => r.status === status))!;
      // Confirm one viable route, without demanding checks from incompatible alternatives.
      if (predicate.kind === 'any') return results.find(r => r.status === status)!;
      return { status, checks: [...new Set(results.flatMap(r => r.checks))] };
    }
    case 'skill': if (!SKILLS_LIST.includes(predicate.skill) || !positiveInt(predicate.level, 99)) return invalid(); return check(actualSkillLevel(u, predicate.skill) >= predicate.level, `${predicate.skill} ${predicate.level}`);
    case 'combinedSkills': {
      if (!Array.isArray(predicate.skills) || !predicate.skills.length || new Set(predicate.skills).size !== predicate.skills.length
        || !predicate.skills.every(skill => SKILLS_LIST.includes(skill)) || !positiveInt(predicate.level, predicate.skills.length * 99)) return invalid();
      return check(predicate.skills.reduce((sum, skill) => sum + actualSkillLevel(u, skill), 0) >= predicate.level, `${predicate.skills.join(' + ')} ${predicate.level}`);
    }
    case 'method': if (!SKILLS_LIST.includes(predicate.skill) || !positiveInt(predicate.tier, 10)) return invalid(); return check(unlockedMethodTier(u, predicate.skill) >= predicate.tier, `${predicate.skill} method tier ${predicate.tier}`);
    case 'equipment': if (!EQUIPMENT_SLOTS.includes(predicate.slot) || !positiveInt(predicate.tier, 10)) return invalid(); return check(unlockedEquipmentTier(u, predicate.slot) >= predicate.tier, `${predicate.slot} equipment tier ${predicate.tier}`);
    case 'quest': {
      if (!text(predicate.id)) return invalid();
      const quest = catalogQuest(predicate.id);
      return quest ? check(completedQuestIds(u.quests).has(quest.id), quest.data.name) : result('UNKNOWN', predicate.id);
    }
    case 'diary': if (!text(predicate.id) || !Object.hasOwn(DIARY_DATA, predicate.id)) return invalid(); return check(u.diaries.includes(predicate.id), predicate.id);
    case 'area': if (!areaId(predicate.id)) return invalid(); return check(isAreaReachable(predicate.id, u, context.gameModeId), predicate.id);
    case 'questPoints': if (!positiveInt(predicate.count)) return invalid(); return check([...completedQuestIds(u.quests)].reduce((sum, id) => { const quest = catalogQuest(id)!.data; return sum + (quest.kind === 'quest' ? quest.points : 0); }, 0) >= predicate.count, `${predicate.count} Quest Points`);
    case 'item': if (!text(predicate.id) || !text(predicate.label) || !['hold', 'consume', 'equip'].includes(predicate.usage)) return invalid(); return external(`item:${predicate.id}:${predicate.usage}`, `${predicate.label}: available and legal to ${predicate.usage}`);
    case 'bossKill': if (!text(predicate.id) || !text(predicate.label) || !positiveInt(predicate.count)) return invalid(); return external(`bossKill:${predicate.id}:${predicate.count}`, predicate.label);
    case 'slayerTask': if (!text(predicate.id) || !text(predicate.label)) return invalid(); return external(`slayerTask:${predicate.id}`, predicate.label);
    case 'accountMode': if (!text(predicate.id) || !text(predicate.label)) return invalid(); return context.accountMode === undefined ? result('NEEDS_CONFIRMATION', predicate.label) : check(context.accountMode === predicate.id, predicate.label);
    case 'manual': if (!text(predicate.key) || !text(predicate.label)) return invalid(); return external(predicate.key, predicate.label);
    case 'unknown': return result('UNKNOWN', text(predicate.label) ? predicate.label : 'Unclassified requirement');
    default: return result('UNKNOWN', 'Unclassified requirement');
  }
}
