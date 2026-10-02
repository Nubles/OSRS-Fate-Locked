import {
  BOSSES_LIST,
  GUILDS_LIST,
  MERCHANTS_LIST,
  MINIGAMES_LIST,
  MOBILITY_LIST,
  SKILLS_LIST,
  SLAYER_UNLOCKS_LIST,
} from '../../data/items';
import { currentQuestPoints, meetsSkillRequirement, skillGateQuests } from '../journalStatus';
import { canonicalQuestId } from '../contentIdentity';
import type { ExactItemSource, RawRouteRequirement, RouteGate } from './model';

export interface GateEvaluation {
  blockers: RouteGate[];
  hasDataGap: boolean;
}

export interface RouteGateAccountState {
  readonly equipment?: Readonly<Record<string, number>>;
  readonly skills: Readonly<Record<string, number>>;
  readonly levels: Readonly<Record<string, number>>;
  readonly quests: readonly string[];
  readonly guilds: readonly string[];
  readonly merchants: readonly string[];
  readonly minigames: readonly string[];
  readonly mobility: readonly string[];
  readonly slayerUnlocks: readonly string[];
  readonly bosses?: readonly string[];
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
  // A reward shop that takes a boss's currency, such as Tempoross's spirit flakes (owner call U1).
  ['bosses', BOSSES_LIST, ['play ']],
];

/** Source labels that intentionally differ from the corresponding UnlockState ID. */
const reviewedUnlockAliases = new Map<string, [UnlockCategory, string]>([
  ['use the sawmill operator', ['merchants', 'Sawmill Operators']],
]);

const unresolved = (raw: string): RouteGate => ({ type: 'UNRESOLVED', label: raw, raw });

const questGate = (questId: string): RouteGate => ({ type: 'QUEST', questId, label: questId });

// Only reviewed milestones are inferred from completion. Arbitrary quest-prefixed
// text may describe a temporary room or post-quest condition instead.
const reviewedQuestProgress = new Map<string, [string, 'satisfies' | 'blocks']>([
  ['Perilous Moons: defeated the sulphur nagua and spoken to Attala', ['Perilous Moons', 'satisfies']],
  ["Ratcatchers: completed Hooknosed Jack's section", ['Ratcatchers', 'satisfies']],
  ['The Depths of Despair: read The Royal Accord of Twill', ['The Depths of Despair', 'satisfies']],
  ['The Depths of Despair: lower chamber before quest completion', ['The Depths of Despair', 'blocks']],
  ["Monkey Madness II: reached Kruk's Dungeon", ['Monkey Madness II', 'satisfies']],
  ['While Guthix Sleeps: reached the Ancient Guthixian Temple', ['While Guthix Sleeps', 'satisfies']],
  ["Mourning's End Part II: obtained the new key", ["Mourning's End Part II", 'satisfies']],
  ["Mourning's End Part II: reached the Death Altar", ["Mourning's End Part II", 'satisfies']],
]);

const parseQuestProgress = (raw: string): RouteGate | null => {
  const reviewed = reviewedQuestProgress.get(raw);
  const partial = raw.match(/^Started (.+)$/i) ?? raw.match(/^(.+?) \d[a-z0-9]*$/i);
  const questId = canonicalQuestId(reviewed?.[0] ?? partial?.[1] ?? '');
  if (!questId) return null;
  const completion = reviewed?.[1] ?? 'satisfies';
  return { type: 'QUEST_PROGRESS', questId, raw, completion, label: raw };
};

const parseQuest = (requirement: RawRouteRequirement): RouteGate | null => {
  const complete = requirement.raw.match(/^(.+?)\s+(?:complete the quest|completed)$/i);
  const candidate = complete?.[1];
  const questId = candidate
    ? canonicalQuestId(candidate)
    : requirement.origin === 'CHUNK_ENTRY' ? canonicalQuestId(requirement.raw) : undefined;
  return questId ? questGate(questId) : null;
};

/**
 * Source wording that means a skill level: the magic axe hut's and the Pirates'
 * Hideout's doors are picked (accuracy audit S-9; wiki "Slayer task" rev 15343835).
 */
const REVIEWED_SKILL_WORDING: ReadonlyMap<string, readonly [string, number]> = new Map([
  ['unlock the door (magic axe hut)', ['Thieving', 23]],
  ["unlock the door (pirates' hideout)", ['Thieving', 39]],
]);

const parseSkill = (raw: string): RouteGate | null => {
  const reviewed = REVIEWED_SKILL_WORDING.get(normalise(raw));
  if (reviewed) return { type: 'SKILL', skill: reviewed[0], level: reviewed[1], label: `${reviewed[0]} level ${reviewed[1]}` };
  // "Mining level 60", or "60 Mining" as the source and the reviewed entrance registry word it
  // (the Mining Guild's door and the Slayer lairs, data/sources/named-task-unlock-locations.json).
  const named = raw.match(/^(.+?)\s+level\s+(\d+)$/i);
  const short = named ? null : raw.match(/^(\d+)\s+(.+)$/);
  const skill = skills.get(normalise((named?.[1] ?? short?.[2]) ?? ''));
  const level = Number(named?.[2] ?? short?.[1]);
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

/**
 * Source wording the place itself meets. The Wilderness Slayer Cave's entrances are
 * Wilderness chunks, so a run that reaches one has entered the Wilderness; asking
 * again kept every Wilderness Slayer location at "needs review" (accuracy audit).
 */
const MET_BY_PLACE = new Set(['enter the wilderness']);

/** Converts only reviewed source wording into account gates; all other wording remains evidence. */
export const compileRawRequirements = (rawRequirements: readonly RawRouteRequirement[]): RouteGate[] => rawRequirements.flatMap((evidence): RouteGate[] => {
  const requirement = evidence.raw.trim();
  if (MET_BY_PLACE.has(normalise(requirement))) return [];
  const normalisedEvidence = { ...evidence, raw: requirement };
  const rfd = requirement.match(/^RFD Chest ([1-8]) Subquests?$/i);
  if (rfd) return [{ type: 'RFD_SUBQUESTS', count: Number(rfd[1]), label: `Complete ${rfd[1]} Recipe for Disaster rescues` }];
  return [parseQuest(normalisedEvidence) ?? parseQuestProgress(requirement) ?? parseSkill(requirement) ?? parseUnlock(requirement) ?? unresolved(evidence.raw)];
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
      case 'RFD_SUBQUESTS': {
        const rescues = ['Dwarf', 'Goblins', 'Pirate Pete', 'Lumbridge Guide', 'Evil Dave', 'Skrach Uglogwee', 'Sir Amik Varze', 'King Awowogei'];
        if (!unlocks.quests.includes('RFD: The Cook') || rescues.filter(name => unlocks.quests.includes(`RFD: ${name}`)).length < gate.count) blockers.push(gate);
        break;
      }
      case 'QUEST':
        if (!unlocks.quests.includes(gate.questId)) blockers.push(gate);
        break;
      case 'QUEST_PROGRESS': {
        const completed = unlocks.quests.includes(gate.questId);
        if (completed && gate.completion === 'satisfies') break;
        // A completion can close a quest-only room. Incomplete does not prove
        // that the player has reached a particular stage of that quest.
        if (!completed) hasDataGap = true;
        blockers.push(gate);
        break;
      }
      case 'SKILL':
        if (gate.skill === 'Quest Points'
          ? currentQuestPoints(unlocks) < gate.level
          : !meetsSkillRequirement(unlocks, gate.skill, gate.level)) blockers.push(gate);
        break;
      case 'EQUIPMENT': {
        const tier = unlocks.equipment?.[gate.slot] ?? 0;
        if (!Number.isFinite(tier) || tier < gate.tier) blockers.push(gate);
        break;
      }
      case 'UNLOCK':
        if (!(unlocks[gate.category] ?? []).includes(gate.id)) blockers.push(gate);
        break;
      case 'UNRESOLVED': {
        hasDataGap = true;
        blockers.push(gate);
        break;
      }
    }
  }

  // A gated skill also needs its unlocking quest, such as Druidic Ritual for a
  // Herblore level, unless the gates already name that quest.
  const skills = gates.flatMap(gate => gate.type === 'SKILL' ? [gate.skill] : []);
  const quests = gates.flatMap(gate => gate.type === 'QUEST' ? [gate.questId] : []);
  for (const questId of skillGateQuests(skills, quests)) {
    if (!unlocks.quests.includes(questId)) blockers.push(questGate(questId));
  }

  return { blockers, hasDataGap };
};
