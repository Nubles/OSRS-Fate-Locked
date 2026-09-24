import { describe, expect, it } from 'vitest';
import { DROP_RATES } from '../config/rules';
import { initialState } from '../context/GameContext';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import type { FateEventEnvelope, FateEventType } from '../services/fateEventProtocol';
import { DropSource, type GameState } from '../types';
import { classifyFateEvent, classifyFateEventCandidate } from './fateEventEligibility';

const state = (overrides: Partial<GameState> = {}): GameState => ({
  ...initialState,
  runId: 'run-1',
  runRevision: 7,
  linkedAccount: 'Nubles',
  ...overrides,
});
const withUnlocks = (unlocks: Partial<GameState['unlocks']>, overrides: Partial<GameState> = {}): GameState =>
  state({ ...overrides, unlocks: { ...initialState.unlocks, ...unlocks } });

const event = (
  eventType: FateEventType,
  canonicalLabel: string | null,
  overrides: Partial<FateEventEnvelope> = {},
): FateEventEnvelope => ({
  protocolVersion: 1,
  eventId: 'evt-1',
  runId: 'run-1',
  account: ' nUbLeS ',
  runRevision: 7,
  eventType,
  canonicalLabel,
  occurredAt: Date.now(),
  sessionSequence: 1,
  bundleVersion: 1,
  rulesVersion: '1',
  contentVersion: 1,
  detectorId: {
    SKILL_LEVEL: 'skill-level-v1',
    QUEST: 'quest-widget-v1',
    COMBAT_ACHIEVEMENT: 'combat-achievement-chat-v1',
    COLLECTION_LOG: 'collection-log-chat-v1',
    CLUE_CASKET: 'clue-casket-loot-v1',
    BOSS_KILL: 'boss-loot-v1',
    RAID_COMPLETION: 'raid-loot-v1',
    SLAYER_TASK: 'slayer-task-v1',
    DIARY_TASK: 'diary-task-v1',
    PET_DROP: 'pet-drop-v1',
    MINIGAME_COMPLETION: 'minigame-completion-v1',
  }[eventType],
  detectorVersion: 1,
  confidence: 'EXACT',
  evidence: {},
  ...overrides,
});

describe('classifyFateEvent', () => {
  it('blocks events for another account or run', () => {
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I', { account: 'Other' }), state()))
      .toMatchObject({ state: 'BLOCKED', reason: 'Account does not match this run.' });
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I', { runId: 'run-2' }), state()))
      .toMatchObject({ state: 'BLOCKED', reason: 'Event belongs to a different run.' });
  });

  it('requires confirmation for stale run context', () => {
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I', { runRevision: 6 }), state()).state)
      .toBe('NEEDS_CONFIRMATION');
  });

  it('requires confirmation for an unsupported detector or version', () => {
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I', { detectorId: 'mystery' }), state()).state)
      .toBe('NEEDS_CONFIRMATION');
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I', { detectorVersion: 2 }), state()).state)
      .toBe('NEEDS_CONFIRMATION');
  });

  it('recognises an event already recorded in roll history', () => {
    const duplicateState = state({
      history: [{
        id: 'log-1',
        timestamp: Date.now(),
        type: 'ROLL_FAIL',
        message: 'No key',
        meta: { fateEventId: 'evt-1' },
      }],
    });
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I'), duplicateState).state)
      .toBe('DUPLICATE');
  });

  it('maps exact quests to the canonical quest rate', () => {
    expect(classifyFateEvent(event('QUEST', " cook's assistant "), state()))
      .toMatchObject({
        state: 'READY',
        intent: {
          source: DropSource.QUEST_NOVICE,
          threshold: DROP_RATES[DropSource.QUEST_NOVICE],
          failureFate: 1,
          target: "Cook's Assistant",
        },
        progress: { kind: 'QUEST', questId: "Cook's Assistant" },
      });
  });

  it('rolls a quest only where the Journal would complete it', () => {
    expect(classifyFateEvent(event('QUEST', "Cook's Assistant"), withUnlocks({ quests: ["Cook's Assistant"] })))
      .toEqual({ state: 'BLOCKED', reason: 'Already completed' });
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer I'), state()))
      .toEqual({ state: 'BLOCKED', reason: 'Requires: Rimmington, Port Sarim, Crandor, Quest Points 32' });

    // Manual checks wait for the player's review, which then confirms them.
    const sheep = event('QUEST', 'Sheep Shearer');
    expect(classifyFateEvent(sheep, state())).toMatchObject({
      state: 'NEEDS_CONFIRMATION',
      reason: expect.stringMatching(/^Confirm: /),
      candidates: [{ label: 'Sheep Shearer', target: 'Sheep Shearer' }],
    });
    expect(classifyFateEventCandidate(sheep, state(), 'Sheep Shearer')).toMatchObject({
      state: 'READY', progress: { kind: 'QUEST', questId: 'Sheep Shearer' },
    });
  });

  it('does not roll progress the run already recorded', () => {
    const attack = withUnlocks({ skills: { Attack: 8 }, levels: { Attack: 73 } });
    expect(classifyFateEvent(event('SKILL_LEVEL', 'Attack Level 73', {
      evidence: { skill: 'Attack', level: 73 },
    }), attack)).toEqual({ state: 'BLOCKED', reason: 'This level is already recorded.' });
    expect(classifyFateEvent(event('COMBAT_ACHIEVEMENT', 'Noxious Foe'), withUnlocks({ completedTasks: ['ca_0'] })))
      .toEqual({ state: 'BLOCKED', reason: 'Already completed' });

    const logged = classifyFateEvent(event('COLLECTION_LOG', 'Bludgeon claw'), state());
    expect(logged.state).toBe('READY');
    const itemId = logged.state === 'READY' && logged.progress.kind === 'COLLECTION_ITEM' ? logged.progress.itemId : -1;
    expect(classifyFateEvent(event('COLLECTION_LOG', 'Bludgeon claw'), withUnlocks({ collectionLog: { [itemId]: 1 } })))
      .toEqual({ state: 'BLOCKED', reason: 'This item is already in the Collection Log.' });
  });

  it('rolls skill levels only for an unlocked skill, as the level-up button does', () => {
    expect(classifyFateEvent(event('SKILL_LEVEL', 'Attack Level 2', {
      evidence: { skill: 'Attack', level: 2 },
    }), state())).toEqual({ state: 'BLOCKED', reason: 'Unlock this skill before its levels can roll.' });
  });

  it('rolls a reviewed diary task only where the Journal would complete it', () => {
    const diary = event('DIARY_TASK', 'Karamja Elite', { confidence: 'UNCERTAIN', evidence: { tierId: 'Karamja Elite' } });
    const taskId = 'kar_elite_2';
    expect(classifyFateEventCandidate(diary, withUnlocks({ completedTasks: [taskId] }), taskId))
      .toEqual({ state: 'BLOCKED', reason: 'Already completed' });
  });

  it('does not guess an unknown or unlabelled quest', () => {
    expect(classifyFateEvent(event('QUEST', 'Dragon Slayer'), state()).state)
      .toBe('NEEDS_CONFIRMATION');
    expect(classifyFateEvent(event('QUEST', null, { confidence: 'UNCERTAIN' }), state()).state)
      .toBe('NEEDS_CONFIRMATION');
  });

  it('maps only uniquely named Collection Log items', () => {
    const counts = new Map<string, number>();
    for (const tab of Object.values(COLLECTION_LOG_DATA)) {
      for (const page of Object.values(tab.pages)) {
        for (const item of page.items) {
          const key = item.name.trim().toLowerCase();
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }
    const unique = [...counts.entries()].find(([, count]) => count === 1)?.[0];
    const ambiguous = [...counts.entries()].find(([, count]) => count > 1)?.[0];
    expect(unique).toBeTruthy();
    expect(ambiguous).toBeTruthy();

    expect(classifyFateEvent(event('COLLECTION_LOG', unique!), state()))
      .toMatchObject({
        state: 'READY',
        intent: {
          source: DropSource.COLLECTION_LOG,
          threshold: DROP_RATES[DropSource.COLLECTION_LOG],
          failureFate: 1,
        },
        progress: { kind: 'COLLECTION_ITEM' },
      });
    expect(classifyFateEvent(event('COLLECTION_LOG', ambiguous!), state()).state)
      .toBe('NEEDS_CONFIRMATION');
  });

  it.each([
    ['Casket (beginner)', DropSource.CLUE_BEGINNER, 1],
    ['Casket (easy)', DropSource.CLUE_EASY, 1],
    ['Casket (medium)', DropSource.CLUE_MEDIUM, 1],
    ['Casket (hard)', DropSource.CLUE_HARD, 2],
    ['Casket (elite)', DropSource.CLUE_ELITE, 2],
    ['Casket (master)', DropSource.CLUE_MASTER, 3],
  ])('maps %s to its clue rate', (label, source, failureFate) => {
    expect(classifyFateEvent(event('CLUE_CASKET', label), state()))
      .toMatchObject({ state: 'READY', intent: { source, threshold: DROP_RATES[source], failureFate } });
  });

  it('maps a Combat Achievement task to its canonical tier', () => {
    expect(classifyFateEvent(event('COMBAT_ACHIEVEMENT', 'Noxious Foe'), state()))
      .toMatchObject({
        state: 'READY',
        intent: {
          source: DropSource.CA_EASY,
          threshold: DROP_RATES[DropSource.CA_EASY],
          failureFate: 1,
        },
        progress: { kind: 'CA_TASK', taskId: 'ca_0' },
      });
  });

  it.each([
    ['Bryophyta', DropSource.BOSS_LOW, 1],
    ['Vorkath', DropSource.BOSS_MID, 2],
    ['Nex', DropSource.BOSS_HIGH, 2],
    ['Chambers of Xeric', DropSource.RAID, 3],
  ])('maps %s through the canonical boss tiers outside Vanilla', (label, source, failureFate) => {
    const type = source === DropSource.RAID ? 'RAID_COMPLETION' : 'BOSS_KILL';
    const classified = classifyFateEvent(event(type, label), state({ gameModeId: 'chunked' }));
    expect(classified)
      .toMatchObject({ state: 'READY', intent: { source, threshold: DROP_RATES[source], failureFate } });
    expect(classified.state === 'READY' && classified.intent.context).toBeUndefined();
  });

  it('rolls Vanilla bosses only while unlocked, from their own key reserve', () => {
    expect(classifyFateEvent(event('BOSS_KILL', 'Zulrah'), state()))
      .toEqual({ state: 'BLOCKED', reason: 'Unlock this boss before its kills can roll.' });

    const vorkath = (awarded: number) => classifyFateEvent(event('BOSS_KILL', 'Vorkath'), withUnlocks(
      { bosses: ['Vorkath'] },
      { bossStandardKeysAwarded: awarded ? { Vorkath: awarded } : {} },
    ));
    const context = { kind: 'boss', bossName: 'Vorkath', bossClass: 'mid' };
    expect(vorkath(0)).toMatchObject({ state: 'READY', intent: { source: DropSource.BOSS_MID, threshold: 30, context } });
    expect(vorkath(1)).toMatchObject({ state: 'READY', intent: { threshold: 15, context } });
    expect(vorkath(2)).toEqual({ state: 'BLOCKED', reason: 'This boss has no Standard Keys left to award.' });
  });

  it('rolls Vanilla clue caskets at the Clues card rates', () => {
    expect(classifyFateEvent(event('CLUE_CASKET', 'Casket (hard)'), state())).toMatchObject({
      state: 'READY',
      intent: { source: DropSource.CLUE_HARD, context: { kind: 'clue', clueTier: 'Hard' } },
    });
    const chunked = classifyFateEvent(event('CLUE_CASKET', 'Casket (hard)'), state({ gameModeId: 'chunked' }));
    expect(chunked.state === 'READY' && chunked.intent.context).toBeUndefined();
  });

  it('uses the canonical skill-level formula', () => {
    // The level-up button's odds: level / 5, to one decimal place.
    expect(classifyFateEvent(event('SKILL_LEVEL', 'Attack Level 73', {
      evidence: { skill: 'Attack', level: 73, previousLevel: 72 },
    }), withUnlocks({ skills: { Attack: 8 } }))).toMatchObject({
      state: 'READY',
      intent: { source: 'Attack Level 73', threshold: 14.6, failureFate: 2, target: 'Attack Level 73' },
      progress: { kind: 'SKILL_LEVEL', skill: 'Attack', level: 73 },
    });
    expect(classifyFateEvent(event('SKILL_LEVEL', 'Attack Level 2', {
      evidence: { skill: 'Attack', level: 2 },
    }), withUnlocks({ skills: { Attack: 1 } }))).toMatchObject({ intent: { threshold: 0.4 } });
  });

  it('does not trust a confirmation-only detector confidence claim', () => {
    expect(classifyFateEvent(event('PET_DROP', 'Vorki', {
      detectorId: 'pet-drop-v1', detectorVersion: 1, confidence: 'EXACT',
    }), state()).state).toBe('NEEDS_CONFIRMATION');
  });

  it('offers player-review choices for confirmation-only detector events', () => {
    const slayer = classifyFateEvent(event('SLAYER_TASK', 'Abyssal demons', {
      detectorId: 'slayer-task-v1', confidence: 'UNCERTAIN',
    }), state());
    expect(slayer).toMatchObject({
      state: 'NEEDS_CONFIRMATION',
      candidates: expect.arrayContaining([
        expect.objectContaining({ target: 'Slayer (Duradel/Kuradal)' }),
      ]),
    });

    const pet = classifyFateEvent(event('PET_DROP', 'Pet kraken', {
      detectorId: 'pet-drop-v1', confidence: 'UNCERTAIN',
    }), state());
    expect(pet).toMatchObject({
      state: 'NEEDS_CONFIRMATION',
      candidates: [{ label: 'Pet kraken', target: 'Pet kraken' }],
    });
  });

  it('turns an explicit confirmation into a ready intent', () => {
    const slayerEvent = event('SLAYER_TASK', 'Abyssal demons', {
      detectorId: 'slayer-task-v1', confidence: 'UNCERTAIN',
    });
    expect(classifyFateEventCandidate(
      slayerEvent,
      state(),
      'Slayer (Duradel/Kuradal)',
    )).toMatchObject({
      state: 'READY',
      intent: {
        source: 'Slayer (Duradel/Kuradal)',
        target: 'Abyssal demons',
        failureFate: 2,
      },
    });
  });
});
