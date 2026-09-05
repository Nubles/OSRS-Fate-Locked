import { QUEST_DATA } from '../../data/questData';
import {
  GUILDS_LIST,
  MERCHANTS_LIST,
  MINIGAMES_LIST,
  MOBILITY_LIST,
  SKILLS_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../../data/items';
import { usableMethodLevel } from '../skillLevels';
import type { ExactItemSource, RawRouteRequirement, RouteGate } from './model';

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
const questIds = new Map(Object.keys(QUEST_DATA).map((id) => [normalise(id), id]));
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
    ? questIds.get(normalise(candidate))
    : requirement.origin === 'CHUNK_ENTRY' ? questIds.get(normalise(requirement.raw)) : undefined;
  return questId ? questGate(questId) : null;
};

const parseSkill = (raw: string): RouteGate | null => {
  const match = raw.match(/^(.+?)\s+level\s+(\d+)$/i);
  if (!match) return null;
  const skill = skills.get(normalise(match[1]));
  const level = Number(match[2]);
  return skill && level > 0 ? { type: 'SKILL', skill, level, label: `${skill} level ${level}` } : null;
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
export const compileRawRequirements = (rawRequirements: readonly RawRouteRequirement[]): RouteGate[] => rawRequirements.map((evidence) => {
  const requirement = evidence.raw.trim();
  const normalisedEvidence = { ...evidence, raw: requirement };
  return parseQuest(normalisedEvidence) ?? parseSkill(requirement) ?? parseUnlock(requirement) ?? unresolved(evidence.raw);
});

/** Appends compiled gates while preserving the original structured source evidence. */
export const compileSourceRequirements = (source: ExactItemSource): ExactItemSource => ({
  ...source,
  rawRequirements: source.rawRequirements.map(requirement => ({ ...requirement })),
  gates: [...source.gates, ...compileRawRequirements(source.rawRequirements)],
});

export const evaluateRouteGates = (
  gates: readonly RouteGate[],
  unlocks: RouteGateAccountState,
): GateEvaluation => {
  const blockers: RouteGate[] = [];
  let hasDataGap = false;

  for (const gate of gates) {
    switch (gate.type) {
      case 'QUEST':
        if (!unlocks.quests.includes(gate.questId)) blockers.push(gate);
        break;
      case 'SKILL':
        if (usableMethodLevel(unlocks, gate.skill) < gate.level) blockers.push(gate);
        break;
      case 'UNLOCK':
        if (!unlocks[gate.category].includes(gate.id)) blockers.push(gate);
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
