import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import type { UnlockState } from '../types';
import { evaluateQuestEligibility, getQuestStatus } from '../utils/journalStatus';
import {
  chunkQuestOverviewItem,
  chunkQuestPresentation,
  chunkQuestStatusLabel,
  type ChunkQuestRow,
} from './ChunkActivityPanel';

const pryingTimesUnlocks = (): UnlockState => ({
  equipment: {},
  skills: { Smithing: 3, Sailing: 2 },
  levels: { Smithing: 30, Sailing: 12 },
  regions: ['The Pandemonium', 'Port Sarim', 'Rimmington'],
  mobility: [],
  arcana: [],
  housing: [],
  merchants: [],
  minigames: [],
  bosses: [],
  storage: [],
  guilds: [],
  farming: [],
  slayerUnlocks: [],
  quests: ['Pandemonium', "The Knight's Sword"],
  diaries: [],
  cas: [],
  completedTasks: [],
  collectionLog: {},
});

const rowForPryingTimes = (): ChunkQuestRow => {
  const unlocks = pryingTimesUnlocks();
  const quest = QUEST_DATA['Prying Times'];
  return {
    name: quest.name,
    kind: 'first',
    status: getQuestStatus(quest, unlocks),
    eligibility: evaluateQuestEligibility(quest, unlocks),
  };
};

describe('chunk activity quest row helpers', () => {
  it('puts a machine-available manual-pending quest in Locked with its reason', () => {
    const row = rowForPryingTimes();
    expect(row.status).toBe('AVAILABLE');
    expect(chunkQuestOverviewItem(row, true)).toEqual({
      can: false,
      label: `Prying Times \u2014 Confirm: One open Sailing task slot`,
    });
  });

  it('gives manual-pending catalogue rows a distinct confirmation indicator', () => {
    expect(chunkQuestPresentation(rowForPryingTimes())).toEqual({
      kind: 'confirmation',
      title: 'Confirm: One open Sailing task slot',
    });
  });

  it('preserves automatic, completed, locked, and untracked catalogue semantics', () => {
    const manual = rowForPryingTimes();
    const automatic: ChunkQuestRow = {
      ...manual,
      eligibility: {
        ...(manual.eligibility as NonNullable<ChunkQuestRow['eligibility']>),
        eligible: true,
        machineEligible: true,
        confirmable: true,
        manualChecks: [],
      },
    };
    const completed: ChunkQuestRow = { ...manual, status: 'COMPLETED' };
    const locked: ChunkQuestRow = {
      ...automatic,
      status: 'LOCKED_REGION',
      eligibility: {
        ...automatic.eligibility!,
        eligible: false,
        machineEligible: false,
      },
    };
    const untracked: ChunkQuestRow = {
      name: 'Miniquest',
      kind: 'present',
      status: null,
      eligibility: null,
    };

    expect(chunkQuestOverviewItem(automatic, true)).toEqual({
      can: true,
      label: 'Prying Times',
    });
    expect(chunkQuestOverviewItem(completed, true)).toBeNull();
    expect(chunkQuestOverviewItem(locked, true)).toEqual({
      can: false,
      label: 'Prying Times',
    });
    expect(chunkQuestOverviewItem(untracked, true)).toBeNull();

    expect(chunkQuestPresentation(automatic)).toEqual({
      kind: 'available',
      title: 'requirements met \u2014 can do now',
    });
    expect(chunkQuestPresentation(completed)).toEqual({ kind: 'completed', title: 'Completed' });
    expect(chunkQuestPresentation(locked)).toEqual({
      kind: 'locked',
      title: 'locked: region not unlocked',
    });
    expect(chunkQuestPresentation(untracked)).toEqual({
      kind: 'untracked',
      title: 'miniquest / not tracked',
    });
  });

  it('maps quest presentation and resolved scope to visible status labels', () => {
    expect(chunkQuestStatusLabel('completed', 'completed')).toBe('Completed');
    expect(chunkQuestStatusLabel('confirmation', 'locked')).toBe('Confirm');
    expect(chunkQuestStatusLabel('confirmation', 'mixed')).toBe('Confirm');
    expect(chunkQuestStatusLabel('untracked', 'neutral')).toBe('Untracked');
    expect(chunkQuestStatusLabel('available', 'mixed')).toBe('Varies');
    expect(chunkQuestStatusLabel('locked', 'mixed')).toBe('Varies');
    expect(chunkQuestStatusLabel('available', 'available')).toBe('Ready');
    expect(chunkQuestStatusLabel('locked', 'locked')).toBe('Locked');
  });
});
