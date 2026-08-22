import { describe, expect, it } from 'vitest';
import { questStrategyFor } from '../../data/questWalkthroughs.preview-boundary';
import {
  questStrategyProgress,
  rankRuneProofObjectives,
  type RuneProofObjectiveCandidate,
} from './objectives';

const strategyFor = (questId: string) => {
  const strategy = questStrategyFor(questId);
  if (!strategy) throw new Error(`Missing ${questId} strategy fixture.`);
  return strategy;
};

const candidate = (
  questId: string,
  readiness: RuneProofObjectiveCandidate['readiness'],
  overrides: Partial<RuneProofObjectiveCandidate> = {},
): RuneProofObjectiveCandidate => ({
  strategy: strategyFor(questId),
  readiness,
  completed: false,
  progress: { completed: 0, total: 9 },
  ...overrides,
});

describe('rankRuneProofObjectives', () => {
  it('excludes completed routes and orders readiness before progression priority', () => {
    const recommendations = rankRuneProofObjectives([
      candidate('Imp Catcher', 'BLOCKED'),
      candidate('The Restless Ghost', 'CONFIRM'),
      candidate('Sheep Shearer', 'READY'),
      candidate("Cook's Assistant", 'READY'),
      candidate('Rune Mysteries', 'READY', { completed: true }),
    ], 10);

    expect(recommendations).toEqual([
      {
        questId: "Cook's Assistant",
        reason: 'Ready with your current unlocks.',
        progress: { completed: 0, total: 9 },
        readiness: 'READY',
      },
      {
        questId: 'Sheep Shearer',
        reason: 'Ready with your current unlocks.',
        progress: { completed: 0, total: 9 },
        readiness: 'READY',
      },
      {
        questId: 'The Restless Ghost',
        reason: 'Continue its reviewed route after confirming the current step.',
        progress: { completed: 0, total: 9 },
        readiness: 'CONFIRM',
      },
      {
        questId: 'Imp Catcher',
        reason: 'Has a reviewed route with an actionable blocker.',
        progress: { completed: 0, total: 9 },
        readiness: 'BLOCKED',
      },
    ]);
  });

  it('uses quest ID as the stable final tie-breaker', () => {
    const sheep = strategyFor('Sheep Shearer');
    const cook = strategyFor("Cook's Assistant");

    const recommendations = rankRuneProofObjectives([
      {
        strategy: { ...cook, questId: 'Zebra quest', progressionPriority: 10 },
        readiness: 'READY',
        completed: false,
        progress: { completed: 0, total: 1 },
      },
      {
        strategy: { ...sheep, questId: 'Aardvark quest', progressionPriority: 10 },
        readiness: 'READY',
        completed: false,
        progress: { completed: 0, total: 1 },
      },
    ]);

    expect(recommendations.map(recommendation => recommendation.questId)).toEqual([
      'Aardvark quest',
      'Zebra quest',
    ]);
  });

  it('limits the default recommendation list to three routes', () => {
    const recommendations = rankRuneProofObjectives([
      candidate("Cook's Assistant", 'READY'),
      candidate('Sheep Shearer', 'READY'),
      candidate('The Restless Ghost', 'READY'),
      candidate('Rune Mysteries', 'READY'),
      candidate('Imp Catcher', 'READY'),
    ]);

    expect(recommendations.map(recommendation => recommendation.questId)).toEqual([
      "Cook's Assistant",
      'Sheep Shearer',
      'The Restless Ghost',
    ]);
  });
});

describe('questStrategyProgress', () => {
  it('counts direct manual confirmations', () => {
    const strategy = strategyFor("Cook's Assistant");

    expect(questStrategyProgress(
      strategy,
      new Set(['cooks-assistant:start-quest']),
      new Set(),
      new Set(),
    )).toEqual({ completed: 1, total: 9 });
  });

  it('closes transitive dependencies for item confirmations', () => {
    const strategy = strategyFor("Cook's Assistant");

    expect(questStrategyProgress(
      strategy,
      new Set(),
      new Set(['pot of flour']),
      new Set(),
    )).toEqual({ completed: 7, total: 9 });
  });

  it('counts a preview-confirmed final quest action as completion', () => {
    const strategy = strategyFor("Cook's Assistant");

    expect(questStrategyProgress(
      strategy,
      new Set(['cooks-assistant:complete']),
      new Set(),
      new Set(),
    )).toEqual({ completed: 9, total: 9 });
  });
});
