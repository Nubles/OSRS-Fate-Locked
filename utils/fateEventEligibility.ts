import { DROP_RATES } from '../config/rules';
import { ALL_CA_TASKS, type CATask } from '../data/caTasks';
import { BOSS_TIERS, TIER_SOURCE } from '../data/bossKeyTiers';
import { COLLECTION_LOG_DATA, type CollectionLogItem } from '../data/collectionLogData';
import { QUEST_DATA, type QuestData } from '../data/questData';
import {
  normalizeAccountName,
  type FateEventEnvelope,
  type FateEventType,
} from '../services/fateEventProtocol';
import {
  DropSource,
  type DetectedProgress,
  type EventCandidate,
  type EventClassification,
  type GameState,
  type RollIntent,
} from '../types';
import {
  CONTENT_VERSION,
  DETECTOR_CONTRACT_VERSION,
  RULES_VERSION,
} from './runeliteBundle';

const normalize = (value: string): string =>
  value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');

function addToIndex<T>(
  index: Map<string, T[]>,
  label: string | undefined,
  value: T,
): void {
  if (!label) return;
  const key = normalize(label);
  const values = index.get(key) ?? [];
  values.push(value);
  index.set(key, values);
}

const QUEST_INDEX = new Map<string, QuestData[]>();
for (const quest of Object.values(QUEST_DATA)) {
  addToIndex(QUEST_INDEX, quest.id, quest);
  if (normalize(quest.name) !== normalize(quest.id)) addToIndex(QUEST_INDEX, quest.name, quest);
}

const CA_INDEX = new Map<string, CATask[]>();
for (const task of ALL_CA_TASKS) {
  addToIndex(CA_INDEX, task.id, task);
  addToIndex(CA_INDEX, task.name, task);
}

interface CollectionMatch {
  item: CollectionLogItem;
  location: string;
}

const COLLECTION_INDEX = new Map<string, CollectionMatch[]>();
for (const tab of Object.values(COLLECTION_LOG_DATA)) {
  for (const page of Object.values(tab.pages)) {
    for (const item of page.items) {
      addToIndex(COLLECTION_INDEX, item.name, {
        item,
        location: `${tab.name} · ${page.name}`,
      });
    }
  }
}

const BOSS_INDEX = new Map(
  Object.keys(BOSS_TIERS).map((name) => [normalize(name), name]),
);

const APPROVED_DETECTORS: Record<FateEventType, string> = {
  SKILL_LEVEL: 'skill-level-v1',
  QUEST: 'quest-widget-v1',
  COMBAT_ACHIEVEMENT: 'combat-achievement-chat-v1',
  COLLECTION_LOG: 'collection-log-chat-v1',
  CLUE_CASKET: 'clue-casket-loot-v1',
  BOSS_KILL: 'boss-loot-v1',
  RAID_COMPLETION: 'raid-loot-v1',
};

const CA_SOURCES: Record<string, DropSource> = {
  Easy: DropSource.CA_EASY,
  Medium: DropSource.CA_MEDIUM,
  Hard: DropSource.CA_HARD,
  Elite: DropSource.CA_ELITE,
  Master: DropSource.CA_MASTER,
  Grandmaster: DropSource.CA_GRANDMASTER,
};

const CLUE_SOURCES: Record<string, DropSource> = {
  'casket (beginner)': DropSource.CLUE_BEGINNER,
  'casket (easy)': DropSource.CLUE_EASY,
  'casket (medium)': DropSource.CLUE_MEDIUM,
  'casket (hard)': DropSource.CLUE_HARD,
  'casket (elite)': DropSource.CLUE_ELITE,
  'casket (master)': DropSource.CLUE_MASTER,
};

function candidates<T>(
  values: T[],
  label: (value: T) => string,
  target: (value: T) => string,
): EventCandidate[] {
  return values.slice(0, 8).map((value) => ({ label: label(value), target: target(value) }));
}

function needsConfirmation(
  reason: string,
  choices?: EventCandidate[],
): EventClassification {
  return choices?.length
    ? { state: 'NEEDS_CONFIRMATION', reason, candidates: choices }
    : { state: 'NEEDS_CONFIRMATION', reason };
}

function ready(
  source: string,
  target: string,
  progress: DetectedProgress,
): EventClassification {
  const threshold = DROP_RATES[source];
  if (!Number.isFinite(threshold)) {
    return { state: 'BLOCKED', reason: 'This roll source is not in the current rules.' };
  }
  const intent: RollIntent = { source, threshold, target };
  return { state: 'READY', intent, progress };
}

function classifySkill(event: FateEventEnvelope): EventClassification {
  const skill = typeof event.evidence.skill === 'string' ? event.evidence.skill.trim() : '';
  const level = event.evidence.level;
  if (!skill || !Number.isSafeInteger(level) || (level as number) < 2 || (level as number) > 99) {
    return needsConfirmation('The skill or level could not be verified.');
  }
  const target = `${skill} Level ${level}`;
  return {
    state: 'READY',
    intent: { source: target, threshold: Math.ceil((level as number) / 5), target },
    progress: { kind: 'SKILL_LEVEL', skill, level: level as number },
  };
}

function classifyQuest(event: FateEventEnvelope): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the completed quest.');
  const matches = QUEST_INDEX.get(normalize(event.canonicalLabel)) ?? [];
  if (matches.length !== 1) {
    return needsConfirmation(
      matches.length ? 'Choose the completed quest.' : 'Quest is not in the current rules.',
      candidates(matches, (quest) => quest.name, (quest) => quest.id),
    );
  }
  const quest = matches[0];
  return ready(quest.difficulty, quest.name, { kind: 'QUEST', questId: quest.id });
}

function classifyCombatAchievement(event: FateEventEnvelope): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the completed combat task.');
  const matches = CA_INDEX.get(normalize(event.canonicalLabel)) ?? [];
  if (matches.length !== 1) {
    return needsConfirmation(
      matches.length
        ? 'More than one combat task matches this name.'
        : 'Combat task is not in the current rules.',
      candidates(matches, (task) => task.name ?? task.description, (task) => task.id),
    );
  }
  const task = matches[0];
  const source = CA_SOURCES[task.tierId];
  if (!source) return { state: 'BLOCKED', reason: 'Combat task tier is not supported.' };
  return ready(source, task.name ?? task.description, { kind: 'CA_TASK', taskId: task.id });
}

function classifyCollectionLog(event: FateEventEnvelope): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the Collection Log item.');
  const matches = COLLECTION_INDEX.get(normalize(event.canonicalLabel)) ?? [];
  if (matches.length !== 1) {
    return needsConfirmation(
      matches.length
        ? 'More than one Collection Log item has this name.'
        : 'Collection Log item is not in the current rules.',
      candidates(
        matches,
        (match) => `${match.item.name} · ${match.location}`,
        (match) => String(match.item.id),
      ),
    );
  }
  const { item } = matches[0];
  return ready(DropSource.COLLECTION_LOG, item.name, {
    kind: 'COLLECTION_ITEM',
    itemId: item.id,
  });
}

function classifyClue(event: FateEventEnvelope): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the clue casket tier.');
  const source = CLUE_SOURCES[normalize(event.canonicalLabel)];
  return source
    ? ready(source, event.canonicalLabel.trim(), { kind: 'NONE' })
    : needsConfirmation('Clue casket tier could not be verified.');
}

function classifyBoss(event: FateEventEnvelope): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the boss or raid.');
  const bossName = BOSS_INDEX.get(normalize(event.canonicalLabel));
  if (!bossName) return needsConfirmation('Boss or raid is not in the current rules.');
  const tier = BOSS_TIERS[bossName];
  const expectedType = tier === 'raid' ? 'RAID_COMPLETION' : 'BOSS_KILL';
  if (event.eventType !== expectedType) {
    return needsConfirmation('The detected encounter type does not match this activity.');
  }
  return ready(TIER_SOURCE[tier], bossName, { kind: 'NONE' });
}

export function classifyFateEvent(
  event: FateEventEnvelope,
  state: GameState,
): EventClassification {
  if (event.runId !== state.runId) {
    return { state: 'BLOCKED', reason: 'Event belongs to a different run.' };
  }
  if (
    !state.linkedAccount
    || normalizeAccountName(event.account) !== normalizeAccountName(state.linkedAccount)
  ) {
    return { state: 'BLOCKED', reason: 'Account does not match this run.' };
  }
  if (event.runRevision !== state.runRevision) {
    return needsConfirmation(
      event.runRevision < state.runRevision
        ? 'The run changed after this event was detected.'
        : 'The event was detected against a newer run state.',
    );
  }
  if (event.rulesVersion !== RULES_VERSION || event.contentVersion !== CONTENT_VERSION) {
    return needsConfirmation('The plugin and app rules do not match.');
  }
  if (
    event.detectorVersion !== DETECTOR_CONTRACT_VERSION
    || APPROVED_DETECTORS[event.eventType] !== event.detectorId
  ) {
    return { state: 'BLOCKED', reason: 'Detector is not supported by this app version.' };
  }
  if (state.history.some((entry) => entry.meta?.fateEventId === event.eventId)) {
    return { state: 'DUPLICATE', reason: 'This event has already been rolled.' };
  }
  if (event.confidence !== 'EXACT') {
    return needsConfirmation('The plugin could not identify this event exactly.');
  }

  switch (event.eventType) {
    case 'SKILL_LEVEL':
      return classifySkill(event);
    case 'QUEST':
      return classifyQuest(event);
    case 'COMBAT_ACHIEVEMENT':
      return classifyCombatAchievement(event);
    case 'COLLECTION_LOG':
      return classifyCollectionLog(event);
    case 'CLUE_CASKET':
      return classifyClue(event);
    case 'BOSS_KILL':
    case 'RAID_COMPLETION':
      return classifyBoss(event);
  }
}
export function classifyFateEventCandidate(
  event: FateEventEnvelope,
  state: GameState,
  target: string,
): EventClassification {
  if (event.eventType === 'COLLECTION_LOG') {
    const gate = classifyFateEvent(
      { ...event, confidence: 'EXACT', canonicalLabel: null },
      state,
    );
    if (
      gate.state !== 'NEEDS_CONFIRMATION'
      || gate.reason !== 'Choose the Collection Log item.'
    ) {
      return gate;
    }
    const match = [...COLLECTION_INDEX.values()]
      .flat()
      .find((candidate) => String(candidate.item.id) === target);
    return match
      ? ready(DropSource.COLLECTION_LOG, match.item.name, {
          kind: 'COLLECTION_ITEM',
          itemId: match.item.id,
        })
      : needsConfirmation('The selected Collection Log item is no longer available.');
  }
  if (event.eventType === 'QUEST' || event.eventType === 'COMBAT_ACHIEVEMENT') {
    return classifyFateEvent(
      { ...event, confidence: 'EXACT', canonicalLabel: target },
      state,
    );
  }
  return needsConfirmation('This event does not support candidate review.');
}
