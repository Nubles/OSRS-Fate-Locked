import { DROP_RATES } from '../config/rules';
import { policyFor } from '../config/detectorPolicies';
import { failureFateForSkillLevel, failureFateForSource } from '../config/economy';
import { BRUTUS_BOSS_NAME, vanillaBossKeyStage, type KeyRollContext } from '../config/vanillaKeyEconomy';
import { ALL_CA_TASKS, type CATask } from '../data/caTasks';
import { BOSS_TIERS, TIER_SOURCE, type BossTier } from '../data/bossKeyTiers';
import { COLLECTION_LOG_DATA, type CollectionLogItem } from '../data/collectionLogData';
import { collectionItemNeedsIdentityReview } from '../services/CollectionLogSyncService';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
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
  RULES_VERSION,
} from './runeliteBundle';
import { caTaskCompletionDecision } from './caProgress';
import {
  diaryTaskCompletionDecision,
  questCompletionDecision,
  type CompletionAttestation,
} from './journalCompletion';
import { skillLevelKeyChance } from './keyRoll';

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

// Brutus is the baseline Lumbridge boss: outside BOSS_TIERS, but on the Farm
// card as a low-tier kill with its own Vanilla key reserve.
const BOSS_INDEX = new Map(
  [...Object.keys(BOSS_TIERS), BRUTUS_BOSS_NAME].map((name) => [normalize(name), name]),
);

const SLAYER_SOURCES = [
  DropSource.SLAYER_BEGINNER,
  DropSource.SLAYER_MAZCHNA,
  DropSource.SLAYER_VANNAKA,
  DropSource.SLAYER_CHAELDAR,
  DropSource.SLAYER_KONAR,
  DropSource.SLAYER_NIEVE,
  DropSource.SLAYER_KRYSTILIA,
  DropSource.SLAYER_DURADEL,
  DropSource.SLAYER_BOSS,
];

const CA_SOURCES: Record<string, DropSource> = {
  Easy: DropSource.CA_EASY,
  Medium: DropSource.CA_MEDIUM,
  Hard: DropSource.CA_HARD,
  Elite: DropSource.CA_ELITE,
  Master: DropSource.CA_MASTER,
  Grandmaster: DropSource.CA_GRANDMASTER,
};

// Each casket's roll source and the tier name the Clues card rolls under.
const CLUE_SOURCES: Record<string, { source: DropSource; tier: string }> = {
  'casket (beginner)': { source: DropSource.CLUE_BEGINNER, tier: 'Beginner' },
  'casket (easy)': { source: DropSource.CLUE_EASY, tier: 'Easy' },
  'casket (medium)': { source: DropSource.CLUE_MEDIUM, tier: 'Medium' },
  'casket (hard)': { source: DropSource.CLUE_HARD, tier: 'Hard' },
  'casket (elite)': { source: DropSource.CLUE_ELITE, tier: 'Elite' },
  'casket (master)': { source: DropSource.CLUE_MASTER, tier: 'Master' },
};

function candidates<T>(
  values: T[],
  label: (value: T) => string,
  target: (value: T) => string,
): EventCandidate[] {
  return values.slice(0, 8).map((value) => ({ label: label(value), target: target(value) }));
}

function confirmationCandidates(event: FateEventEnvelope): EventCandidate[] | undefined {
  if (event.eventType === 'SLAYER_TASK') {
    return SLAYER_SOURCES.map((source) => ({ label: source, target: source }));
  }
  if (event.eventType === 'DIARY_TASK') {
    const tierId = typeof event.evidence.tierId === 'string'
      ? event.evidence.tierId
      : event.canonicalLabel;
    const matches = ALL_DIARY_TASKS.filter((task) => task.tierId === tierId);
    return matches.length
      ? matches.map((task) => ({ label: task.description, target: task.id }))
      : undefined;
  }
  if (event.eventType === 'PET_DROP') {
    const label = event.canonicalLabel ?? 'Pet drop';
    return [{ label, target: label }];
  }
  if (
    event.eventType === 'MINIGAME_COMPLETION'
    || event.eventType === 'BOSS_KILL'
    || event.eventType === 'RAID_COMPLETION'
  ) {
    return event.canonicalLabel
      ? [{ label: event.canonicalLabel, target: event.canonicalLabel }]
      : undefined;
  }
  return undefined;
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
  roll: { threshold?: number; context?: KeyRollContext } = {},
): EventClassification {
  const threshold = roll.threshold ?? DROP_RATES[source];
  if (!Number.isFinite(threshold)) {
    return { state: 'BLOCKED', reason: 'This roll source is not in the current rules.' };
  }
  const intent: RollIntent = {
    source,
    threshold,
    failureFate: failureFateForSource(source as DropSource),
    target,
    ...(roll.context ? { context: roll.context } : {}),
  };
  return { state: 'READY', intent, progress };
}

const blocked = (reason: string): EventClassification => ({ state: 'BLOCKED', reason });

// Detected progress follows the same rules as the manual Journal, Farm and
// skill buttons: it rolls only where a manual completion would.
function classifySkill(event: FateEventEnvelope, state: GameState): EventClassification {
  const skill = typeof event.evidence.skill === 'string' ? event.evidence.skill.trim() : '';
  const level = event.evidence.level;
  if (!skill || !Number.isSafeInteger(level) || (level as number) < 2 || (level as number) > 99) {
    return needsConfirmation('The skill or level could not be verified.');
  }
  // A locked skill cannot be levelled, and a level already recorded rolls once.
  if ((state.unlocks.skills[skill] ?? 0) <= 0) return blocked('Unlock this skill before its levels can roll.');
  if ((level as number) <= (state.unlocks.levels[skill] ?? 1)) return blocked('This level is already recorded.');
  const target = `${skill} Level ${level}`;
  return {
    state: 'READY',
    intent: { source: target, threshold: skillLevelKeyChance(level as number), failureFate: failureFateForSkillLevel(level as number), target },
    progress: { kind: 'SKILL_LEVEL', skill, level: level as number },
  };
}

function classifyQuest(
  event: FateEventEnvelope,
  state: GameState,
  attestation: CompletionAttestation,
): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the completed quest.');
  const matches = QUEST_INDEX.get(normalize(event.canonicalLabel)) ?? [];
  if (matches.length !== 1) {
    return needsConfirmation(
      matches.length ? 'Choose the completed quest.' : 'Quest is not in the current rules.',
      candidates(matches, (quest) => quest.name, (quest) => quest.id),
    );
  }
  const quest = matches[0];
  // The Journal's own decision: completed or locked quests do not roll, and
  // manual checks wait for the player's review.
  const decision = questCompletionDecision(quest, state.unlocks, state.gameModeId, attestation);
  if (decision.ok === false) {
    return questCompletionDecision(quest, state.unlocks, state.gameModeId, { manualConfirmed: true }).ok
      ? needsConfirmation(decision.reason, [{ label: quest.name, target: quest.id }])
      : blocked(decision.reason);
  }
  return ready(quest.difficulty, quest.name, { kind: 'QUEST', questId: quest.id });
}

function classifyCombatAchievement(event: FateEventEnvelope, state: GameState): EventClassification {
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
  const decision = caTaskCompletionDecision(task, state.unlocks.completedTasks);
  if (decision.ok === false) return blocked(decision.reason);
  return ready(source, task.name ?? task.description, { kind: 'CA_TASK', taskId: task.id });
}

function collectionItemBlock(state: GameState, itemId: number): EventClassification | null {
  if (collectionItemNeedsIdentityReview(state.unlocks.collectionLog, itemId, state.collectionLogIdentity)) {
    return { state: 'BLOCKED', reason: 'Saved Collection Log entries need identity review before this item can be logged or rewarded.' };
  }
  // Like a manual log, only a newly logged item rolls.
  return (state.unlocks.collectionLog[itemId] ?? 0) >= 1
    ? blocked('This item is already in the Collection Log.')
    : null;
}

function classifyCollectionLog(event: FateEventEnvelope, state: GameState): EventClassification {
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
  return collectionItemBlock(state, item.id) ?? ready(DropSource.COLLECTION_LOG, item.name, {
    kind: 'COLLECTION_ITEM',
    itemId: item.id,
  });
}

function classifyClue(event: FateEventEnvelope, state: GameState): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the clue casket tier.');
  const clue = CLUE_SOURCES[normalize(event.canonicalLabel)];
  if (!clue) return needsConfirmation('Clue casket tier could not be verified.');
  // Vanilla clue keys use the Clues card's onboarding rates.
  return ready(clue.source, event.canonicalLabel.trim(), { kind: 'NONE' }, state.gameModeId === 'vanilla'
    ? { context: { kind: 'clue', clueTier: clue.tier } }
    : {});
}

function classifyBoss(event: FateEventEnvelope, state: GameState): EventClassification {
  if (!event.canonicalLabel) return needsConfirmation('Choose the boss or raid.');
  const bossName = BOSS_INDEX.get(normalize(event.canonicalLabel));
  if (!bossName) return needsConfirmation('Boss or raid is not in the current rules.');
  const isBrutus = bossName === BRUTUS_BOSS_NAME;
  const tier: BossTier = isBrutus ? 'low' : BOSS_TIERS[bossName];
  const expectedType = tier === 'raid' ? 'RAID_COMPLETION' : 'BOSS_KILL';
  if (event.eventType !== expectedType) {
    return needsConfirmation('The detected encounter type does not match this activity.');
  }
  if (state.gameModeId !== 'vanilla') return ready(TIER_SOURCE[tier], bossName, { kind: 'NONE' });
  // Vanilla's Bossing list rolls only unlocked bosses (Brutus is always
  // there), each from its own key reserve.
  if (!isBrutus && !state.unlocks.bosses.includes(bossName)) return blocked('Unlock this boss before its kills can roll.');
  const stage = vanillaBossKeyStage(bossName, state.bossStandardKeysAwarded?.[bossName] ?? 0);
  if (stage.currentRate === null) return blocked('This boss has no Standard Keys left to award.');
  return ready(TIER_SOURCE[tier], bossName, { kind: 'NONE' }, {
    threshold: stage.currentRate,
    context: { kind: 'boss', bossName, bossClass: isBrutus ? 'brutus' : tier },
  });
}

export function classifyFateEvent(
  event: FateEventEnvelope,
  state: GameState,
  // Given when the player reviewed this event, as the Journal's confirm prompt.
  attestation: CompletionAttestation = {},
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
  const policy = policyFor(event.detectorId);
  if (
    !policy
    || event.detectorVersion > policy.maxApprovedVersion
    || !policy.eventTypes.includes(event.eventType)
  ) {
    return needsConfirmation('Detector version is not approved for exact handling.');
  }  if (state.history.some((entry) => entry.meta?.fateEventId === event.eventId)) {
    return { state: 'DUPLICATE', reason: 'This event has already been rolled.' };
  }
  if (policy.handling !== 'EXACT' || event.confidence !== 'EXACT') {
    return needsConfirmation(
      'Detector version is not approved for exact handling.',
      confirmationCandidates(event),
    );
  }

  switch (event.eventType) {
    case 'SKILL_LEVEL':
      return classifySkill(event, state);
    case 'QUEST':
      return classifyQuest(event, state, attestation);
    case 'COMBAT_ACHIEVEMENT':
      return classifyCombatAchievement(event, state);
    case 'COLLECTION_LOG':
      return classifyCollectionLog(event, state);
    case 'CLUE_CASKET':
      return classifyClue(event, state);
    case 'BOSS_KILL':
    case 'RAID_COMPLETION':
      return classifyBoss(event, state);
    default:
      return needsConfirmation('Review this detected event.');
  }
}
export function classifyFateEventCandidate(
  event: FateEventEnvelope,
  state: GameState,
  target: string,
): EventClassification {
  const gate = classifyFateEvent(event, state);
  if (gate.state === 'BLOCKED' || gate.state === 'DUPLICATE') return gate;
  if (
    gate.state !== 'NEEDS_CONFIRMATION'
    || gate.reason !== 'Detector version is not approved for exact handling.'
  ) {
    if (
      event.eventType !== 'COLLECTION_LOG'
      && event.eventType !== 'QUEST'
      && event.eventType !== 'COMBAT_ACHIEVEMENT'
    ) return gate;
  }

  if (event.eventType === 'SLAYER_TASK') {
    if (!SLAYER_SOURCES.includes(target as DropSource)) {
      return needsConfirmation('Choose the Slayer master used for this assignment.');
    }
    return ready(target, event.canonicalLabel ?? 'Slayer task', { kind: 'NONE' });
  }
  if (event.eventType === 'DIARY_TASK') {
    const task = ALL_DIARY_TASKS.find((candidate) => candidate.id === target);
    if (!task) return needsConfirmation('Choose a diary task from the detected tier.');
    const tier = task.tierId.split(' ').at(-1);
    const source = {
      Easy: DropSource.DIARY_EASY,
      Medium: DropSource.DIARY_MEDIUM,
      Hard: DropSource.DIARY_HARD,
      Elite: DropSource.DIARY_ELITE,
    }[tier ?? ''];
    if (!source) return needsConfirmation('Diary tier is not in the current rules.');
    // The player's review stands in for the Journal's confirm prompt; every
    // other manual rule (already done, locked requirements) still applies.
    const decision = diaryTaskCompletionDecision(task, state.unlocks, state.gameModeId, { manualConfirmed: true });
    if (decision.ok === false) return blocked(decision.reason);
    return ready(source, task.description, { kind: 'DIARY_TASK', taskId: task.id });
  }
  if (event.eventType === 'PET_DROP') {
    const label = event.canonicalLabel ?? 'Pet drop';
    return target === label
      ? ready(DropSource.PET, label, { kind: 'NONE' })
      : needsConfirmation('Confirm the detected pet.');
  }
  if (event.eventType === 'MINIGAME_COMPLETION') {
    return event.canonicalLabel && target === event.canonicalLabel
      ? ready(DropSource.ACTIVITY_MINIGAME, target, { kind: 'NONE' })
      : needsConfirmation('Confirm the completed minigame.');
  }
  if (event.eventType === 'BOSS_KILL' || event.eventType === 'RAID_COMPLETION') {
    return target === event.canonicalLabel
      ? classifyBoss({ ...event, canonicalLabel: target }, state)
      : needsConfirmation('Confirm the detected boss or raid.');
  }
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
      ? collectionItemBlock(state, match.item.id) ?? ready(DropSource.COLLECTION_LOG, match.item.name, {
          kind: 'COLLECTION_ITEM',
          itemId: match.item.id,
        })
      : needsConfirmation('The selected Collection Log item is no longer available.');
  }
  if (event.eventType === 'QUEST' || event.eventType === 'COMBAT_ACHIEVEMENT') {
    // Reviewing the candidate confirms its manual checks, as the Journal's prompt does.
    return classifyFateEvent(
      { ...event, confidence: 'EXACT', canonicalLabel: target },
      state,
      { manualConfirmed: true },
    );
  }
  return needsConfirmation('This event does not support candidate review.');
}
