import { catalogQuest, completedQuestIds } from '../../data/questCatalog';
import {
  GUILDS_LIST,
  MERCHANTS_LIST,
  MINIGAMES_LIST,
  MOBILITY_LIST,
  SKILLS_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../../data/items';
import { actualSkillLevel, usableMethodLevel } from '../skillLevels';
import { isRouteGateUsable, type SourceKind, type ExactItemSource, type RawRouteRequirement, type RouteGate } from './model';

export interface GateEvaluation {
  blockers: RouteGate[];
  hasDataGap: boolean;
}

export interface RouteGateAccountState {
  readonly skills: Readonly<Record<string, number>>;
  readonly levels: Readonly<Record<string, number>>;
  readonly quests: readonly string[];
  readonly guilds: readonly string[];
  readonly merchants: readonly string[];
  readonly minigames: readonly string[];
  readonly mobility: readonly string[];
  readonly slayerUnlocks: readonly string[];
}

type UnlockCategory = Extract<RouteGate, { type: 'UNLOCK' }>['category'];

const normalise = (value: string): string => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
const skills = new Map(SKILLS_LIST.map((skill) => [normalise(skill), skill]));

const unlockAliases: readonly [UnlockCategory, readonly string[], readonly string[]][] = [
  ['guilds', GUILDS_LIST, ['access the ', 'access ', 'enter the ', 'enter ']],
  ['merchants', MERCHANTS_LIST, ['use the ', 'use ', 'access the ', 'access ']],
  ['minigames', MINIGAMES_LIST, ['play ', 'access the ', 'access ', 'enter the ', 'enter ']],
  ['mobility', MOBILITY_LIST, ['use ', 'access ', 'travel by ']],
  ['slayerUnlocks', SLAYER_UNLOCKS_LIST, ['', 'requires ', 'required: ']],
];

/** Source labels that intentionally differ from the corresponding UnlockState ID. */
const reviewedUnlockAliases = new Map<string, [UnlockCategory, string]>([
  ['use the sawmill operator', ['merchants', 'Sawmill Operators']],
]);

const unresolved = (raw: string): RouteGate => ({ type: 'UNRESOLVED', label: raw, raw });

const questGate = (questId: string): RouteGate => ({ type: 'QUEST', questId, label: questId });

const parseQuest = (requirement: RawRouteRequirement): RouteGate | null => {
  const complete = requirement.raw.match(/^(.+?)\s+complete the quest$/i);
  const candidate = complete?.[1];
  const questId = candidate
    ? catalogQuest(candidate)?.data.id
    : requirement.origin === 'CHUNK_ENTRY' ? catalogQuest(requirement.raw)?.data.id : undefined;
  return questId ? questGate(questId) : null;
};

const parseSkill = (raw: string, semantics?: 'actual' | 'method'): RouteGate | null => {
  const match = raw.match(/^(.+?)\s+level\s+(\d+)$/i);
  if (!match) return null;
  const skill = skills.get(normalise(match[1]));
  const level = Number(match[2]);
  return semantics && skill && Number.isSafeInteger(level) && level > 0 && level <= 99 ? { type: 'SKILL', skill, level, label: `${skill} level ${level}`, semantics } : null;
};

const parseUnlock = (raw: string): RouteGate | null => {
  const value = normalise(raw);
  const reviewed = reviewedUnlockAliases.get(value);
  if (reviewed) {
    const [category, id] = reviewed;
    return { type: 'UNLOCK', category, id, label: id };
  }
  for (const [category, values, prefixes] of unlockAliases) {
    for (const id of values) {
      const idValue = normalise(id);
      for (const prefix of prefixes) {
        if (value === `${prefix}${idValue}` || value === `${idValue} required`) {
          return { type: 'UNLOCK', category, id, label: id };
        }
      }
    }
  }
  return null;
};

/** Converts only reviewed source wording into account gates; all other wording remains evidence. */
export const compileRawRequirements = (rawRequirements: readonly RawRouteRequirement[], sourceKind?: SourceKind): RouteGate[] => rawRequirements.map((evidence) => {
  if (!evidence || typeof evidence.raw !== 'string' || !['ENTITY', 'CHUNK_ENTRY'].includes(evidence.origin)) return unresolved('Invalid source requirement');
  const requirement = evidence.raw.trim();
  const normalisedEvidence = { ...evidence, raw: requirement };
  return parseQuest(normalisedEvidence) ?? parseSkill(requirement, evidence.origin === 'CHUNK_ENTRY' ? 'actual' : sourceKind === 'GATHER' || sourceKind === 'RECIPE' ? 'method' : undefined) ?? parseUnlock(requirement) ?? unresolved(evidence.raw);
});

/** Appends compiled gates while preserving the original structured source evidence. */
export const compileSourceRequirements = (source: ExactItemSource): ExactItemSource => ({
  ...source,
  rawRequirements: source.rawRequirements.map(requirement => ({ ...requirement })),
  gates: [...source.gates, ...compileRawRequirements(source.rawRequirements, source.kind)],
});

export const evaluateRouteGates = (
  gates: readonly RouteGate[],
  unlocks: RouteGateAccountState,
): GateEvaluation => {
  const blockers: RouteGate[] = [];
  let hasDataGap = false;
  const completed = completedQuestIds(unlocks.quests);

  for (const gate of gates) {
    if (!isRouteGateUsable(gate)) {
      hasDataGap = true;
      blockers.push({ type: 'UNRESOLVED', raw: 'Invalid route gate', label: 'Invalid route gate' });
      continue;
    }
    switch (gate.type) {
      case 'QUEST': {
        const quest = catalogQuest(gate.questId);
        if (!quest) hasDataGap = true;
        if (!quest || !completed.has(quest.id)) blockers.push(gate);
        break;
      }
      case 'SKILL':
        if ((gate.semantics === 'actual' ? actualSkillLevel(unlocks, gate.skill) : usableMethodLevel(unlocks, gate.skill)) < gate.level) blockers.push(gate);
        break;
      case 'UNLOCK':
        if (!unlockAliases.find(([category]) => category === gate.category)?.[1].includes(gate.id)) hasDataGap = true;
        if (!unlockAliases.find(([category]) => category === gate.category)?.[1].includes(gate.id) || !Array.isArray(unlocks[gate.category]) || !unlocks[gate.category].includes(gate.id)) blockers.push(gate);
        break;
      default:
      case 'UNRESOLVED':
        hasDataGap = true;
        blockers.push(gate);
        break;
    }
  }

  return { blockers, hasDataGap };
};
