/* @vitest-environment jsdom */
import React from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UnlockState } from '../types';
import type {
  RuneProofCatalogueSummary,
  RuneProofLoadedPack,
} from '../data/questWalkthroughLoader';
import {
  branchingPack,
  catalogueSummary,
  combatPack,
} from '../utils/questStrategies/testFixtures';
import {
  runeProofProgressIndexStorageKey,
  runeProofProgressStorageKey,
  runeProofProgressTransactionStorageKey,
} from '../utils/questStrategies/progress';
import { RUNE_PROOF_COMBAT_DISCLAIMER } from './questStrategies/RuneProofCombatReadiness';

const featureState = vi.hoisted(() => ({
  availability: 'PUBLIC' as 'OFF' | 'PUBLIC' | 'PREVIEW',
}));

const loaderControl = vi.hoisted(() => ({
  summaries: [] as readonly RuneProofCatalogueSummary[],
  loaded: undefined as RuneProofLoadedPack | undefined,
  loadCatalogue: vi.fn(),
  loadPack: vi.fn(),
}));

const gameMutators = vi.hoisted(() => ({
  retrySave: vi.fn(),
  stageForProfileEviction: vi.fn(),
  takeOverSaveOwnership: vi.fn(),
  reloadLatestSave: vi.fn(),
  rollForKey: vi.fn(),
  acceptDetectedEvent: vi.fn(),
  unlockContent: vi.fn(),
  performRitual: vi.fn(),
  performGambit: vi.fn(),
  performCartographer: vi.fn(),
  levelUpSkill: vi.fn(),
  toggleAnimations: vi.fn(),
  toggleAdvisors: vi.fn(),
  toggleRevealAll: vi.fn(),
  completeOnboarding: vi.fn(),
  resolveFateCompensation: vi.fn(),
  setGameMode: vi.fn(),
  setSeed: vi.fn(),
  nextFloat: vi.fn(),
  importSave: vi.fn(),
  resetGame: vi.fn(),
  createBackup: vi.fn(),
  listBackups: vi.fn(),
  restoreBackup: vi.fn(),
  togglePin: vi.fn(),
  saveNote: vi.fn(),
  completeQuest: vi.fn(),
  completeDiaryTask: vi.fn(),
  completeDiaryTier: vi.fn(),
  completeCATask: vi.fn(),
  completeCATier: vi.fn(),
  logCollectionItem: vi.fn(),
  getExportData: vi.fn(),
  setLoadoutSlot: vi.fn(),
  setLinkedAccount: vi.fn(),
  setRival: vi.fn(),
  clearRival: vi.fn(),
  ackRival: vi.fn(),
}));

const gameControl = vi.hoisted(() => ({
  value: undefined as unknown as Record<string, unknown>,
}));

vi.mock('../context/GameContext', async () => {
  const actual = await vi.importActual<typeof import('../context/GameContext')>('../context/GameContext');
  const stableState = {
    ...actual.initialState,
    runId: 'dashboard-run',
    runRevision: 17,
    keys: 11,
    specialKeys: 3,
    chaosKeys: 5,
    bossStandardKeysAwarded: { 'Giant Mole': 1 },
    clueStandardKeysAwarded: 2,
    fatePoints: 23,
    fateCompensation: {
      releaseId: 'dashboard-fixture-release',
      status: 'pending' as const,
      chaosKeys: 2,
      pityKeys: 1,
      fatePoints: 4,
    },
    activeBuff: 'LUCK' as const,
    unlocks: {
      equipment: { Weapon: 2 }, skills: { Mining: 3 }, levels: { Mining: 30 },
      regions: ['Misthalin'], chunks: ['50,50'], mobility: ['Canoe'],
      arcana: ['Standard spellbook'], housing: ['Garden'], merchants: ['General store'],
      minigames: ['Tempoross'], bosses: ['Giant Mole'], storage: ['Bank'],
      guilds: ['Cooks Guild'], farming: ['Allotments'], slayerUnlocks: ['Bigger and Badder'],
      banks: ['12850'], quests: ['Druidic Ritual'], diaries: ['Lumbridge Easy'],
      cas: ['Easy'], completedTasks: ['lumbridge_easy_1'], collectionLog: { 4151: 1 },
    } satisfies UnlockState,
    history: [{
      id: 'dashboard-history-1',
      timestamp: 1_777_000_000_000,
      type: 'ROLL_SUCCESS' as const,
      source: 'Dashboard fixture',
      result: 'SUCCESS' as const,
      message: 'Stable full-state history fixture.',
      prevHash: 'prev-hash',
      hash: 'current-hash',
    }],
    gameModeId: 'vanilla',
    customMode: undefined,
    gameModeLocked: true,
    rngSeed: 'dashboard-seed',
    loadout: { weapon: 4151 },
    linkedAccount: 'Dashboard Player',
    xtremeMilestoneClaimed: 2,
    chunkedMilestoneClaimed: 3,
    animationsEnabled: false,
    advisorsEnabled: true,
    revealAllFeatures: true,
    hasSeenOnboarding: true,
    pinnedGoals: ['dashboard-goal'],
    userNotes: { 'dashboard-goal': 'Byte-stable note.' },
  };
  gameMutators.nextFloat.mockReturnValue(0.5);
  gameMutators.getExportData.mockReturnValue('{}');
  gameMutators.listBackups.mockReturnValue([]);
  gameControl.value = Object.freeze({
    ...stableState,
    lastEvent: null,
    saveStatus: 'saved',
    saveOwnershipStatus: 'owned',
    saveOwnershipBlockReason: undefined,
    hasPendingChanges: false,
    ...gameMutators,
  });
  return {
    ...actual,
    useGame: () => gameControl.value,
  };
});

vi.mock('../services/WikiService', () => ({
  wikiService: { fetchImage: vi.fn(async () => null) },
}));

vi.mock('../utils/questRoutes/featureFlag', () => ({
  runeProofAvailability: vi.fn(() => featureState.availability),
}));

vi.mock('../data/questWalkthroughLoader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../data/questWalkthroughLoader')>();
  return {
    ...actual,
    loadRuneProofCatalogue: (availability: 'OFF' | 'PUBLIC' | 'PREVIEW') => {
      loaderControl.loadCatalogue(availability);
      return Promise.resolve(loaderControl.summaries);
    },
    loadRuneProofPackFor: (
      availability: 'OFF' | 'PUBLIC' | 'PREVIEW',
      release: unknown,
    ) => {
      loaderControl.loadPack(availability, release);
      return Promise.resolve(loaderControl.loaded);
    },
  };
});

import { Dashboard } from './Dashboard';

const dashboardPack = (): RuneProofLoadedPack => {
  const pack = structuredClone(branchingPack);
  const combat = combatPack.branches[0].actions[0].combat;
  return {
    pack: {
      ...pack,
      sharedActions: pack.sharedActions.map((action, index) => index === 0 ? {
        ...action,
        instruction: 'Begin the reviewed branching route.',
        combat,
      } : action),
    },
  };
};

beforeEach(() => {
  window.localStorage.clear();
  Object.values(gameMutators).forEach(spy => spy.mockClear());
  loaderControl.loadCatalogue.mockClear();
  loaderControl.loadPack.mockClear();
  loaderControl.loaded = undefined;
  loaderControl.summaries = [];
});

afterEach(() => {
  cleanup();
  featureState.availability = 'PUBLIC';
});

describe('Dashboard RuneProof entry', () => {
  it('labels the production entry RuneProof for the public pack', () => {
    featureState.availability = 'PUBLIC';
    render(<Dashboard suspendModals />);

    expect(screen.getByRole('button', { name: 'RuneProof' }).getAttribute('title'))
      .toBe('Get the next reviewed action for your run');
    expect(screen.queryByRole('button', { name: 'Goal Planner' })).toBeNull();
  });

  it('labels the same Dashboard entry RuneProof in private preview', () => {
    featureState.availability = 'PREVIEW';
    render(<Dashboard suspendModals />);

    expect(screen.getByRole('button', { name: 'RuneProof' }).getAttribute('title'))
      .toBe('Get the next reviewed action for your run');
    expect(screen.queryByRole('button', { name: 'Goal Planner' })).toBeNull();
  });

  it('runs the full Dashboard to Goal Planner PACK flow with isolated canonical and storage state', async () => {
    featureState.availability = 'PUBLIC';
    const loaded = dashboardPack();
    const summary = catalogueSummary({
      questId: loaded.pack.questId,
      slug: loaded.pack.catalogue.slug,
      catalogueRevision: loaded.pack.catalogueRevision,
      packRevision: loaded.pack.revision,
      lifecycle: 'PUBLIC_APPROVED',
      reviewStatus: 'PUBLIC_APPROVED',
      packDisposition: 'RELEASED',
      playable: true,
      proofState: 'READY',
    });
    loaderControl.loaded = loaded;
    loaderControl.summaries = [summary];
    window.localStorage.setItem('unrelated:one', 'alpha');
    window.localStorage.setItem('unrelated:two', '{"bytes":"stay exact"}');

    render(<Dashboard />);
    await act(async () => { await Promise.resolve(); });
    const canonicalBefore = JSON.stringify(gameControl.value);
    const storageBefore = new Map(Array.from(
      { length: window.localStorage.length },
      (_, index) => {
        const key = window.localStorage.key(index)!;
        return [key, window.localStorage.getItem(key)!] as const;
      },
    ));

    await userEvent.click(screen.getByRole('button', { name: 'RuneProof' }));
    const dialog = await screen.findByRole('dialog', { name: 'RuneProof' }, { timeout: 5_000 });
    expect(await within(dialog).findByText('Showing 1 of 1 objectives')).toBeTruthy();
    expect(await within(dialog).findByRole('heading', {
      level: 2,
      name: loaded.pack.questId,
    })).toBeTruthy();
    expect(within(dialog).getByText('Reviewed combat readiness')).toBeTruthy();

    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Global root' }));
    await userEvent.click(within(dialog).getByRole('checkbox', {
      name: 'Confirm global preflight',
    }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use Remote route' }));
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Confirm remote' }));
    await userEvent.click(within(dialog).getByRole('checkbox', {
      name: RUNE_PROOF_COMBAT_DISCLAIMER,
    }));
    await userEvent.click(within(dialog).getByRole('checkbox', {
      name: 'Confirm Begin the reviewed branching route.',
    }));

    const runId = gameControl.value.runId as string;
    const recordKey = runeProofProgressStorageKey(runId, loaded.pack.catalogue.slug);
    const indexKey = runeProofProgressIndexStorageKey(runId);
    await waitFor(() => expect(window.localStorage.getItem(recordKey)).not.toBeNull());
    const record = JSON.parse(window.localStorage.getItem(recordKey)!);
    const index = JSON.parse(window.localStorage.getItem(indexKey)!);
    const recordRaw = window.localStorage.getItem(recordKey);
    const indexRaw = window.localStorage.getItem(indexKey);
    expect(record).toMatchObject({
      schemaVersion: 2,
      runId,
      questId: loaded.pack.questId,
      packRevision: loaded.pack.revision,
      selectedBranchId: 'remote',
      confirmedActionIds: ['shared:start'],
      confirmedItemKeys: ['global root'],
    });
    expect(record.manualConfirmationIds).toEqual([
      'global:manual',
      loaded.pack.sharedActions[0].combat!.confirmationId,
      'remote:manual',
    ]);
    expect(index.entries[loaded.pack.catalogue.slug]).toMatchObject({
      questId: loaded.pack.questId,
      packRevision: loaded.pack.revision,
    });

    const transactionKey = runeProofProgressTransactionStorageKey(runId);
    expect(window.localStorage.getItem(transactionKey)).toBeNull();
    expect(window.localStorage.getItem(transactionKey + ':committed')).toBeNull();
    for (const [key, value] of storageBefore) {
      expect(window.localStorage.getItem(key)).toBe(value);
    }
    const allowedNewKeys = new Set([recordKey, indexKey]);
    for (let indexPosition = 0; indexPosition < window.localStorage.length; indexPosition += 1) {
      const key = window.localStorage.key(indexPosition)!;
      if (!storageBefore.has(key)) expect(allowedNewKeys.has(key)).toBe(true);
    }

    expect(JSON.stringify(gameControl.value)).toBe(canonicalBefore);
    expect((gameControl.value.unlocks as UnlockState).quests).toEqual(['Druidic Ritual']);
    Object.values(gameMutators).forEach(spy => expect(spy).not.toHaveBeenCalled());

    await userEvent.click(within(dialog).getByLabelText('Close'));
    expect(screen.queryByRole('dialog', { name: 'RuneProof' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'RuneProof' }));
    const reopened = await screen.findByRole(
      'dialog',
      { name: 'RuneProof' },
      { timeout: 5_000 },
    );
    expect(await within(reopened).findByRole('heading', {
      level: 2,
      name: loaded.pack.questId,
    })).toBeTruthy();
    expect(within(reopened).getByRole('checkbox', { name: 'Global root' }))
      .toHaveProperty('checked', true);
    expect(within(reopened).getByRole('checkbox', { name: 'Confirm global preflight' }))
      .toHaveProperty('checked', true);
    expect(within(reopened).getByRole('checkbox', { name: 'Confirm remote' }))
      .toHaveProperty('checked', true);
    expect(within(reopened).getByRole('group', { name: 'Quest route' })
      .querySelector('[aria-label="Remote route"]')?.getAttribute('aria-current')).toBe('true');
    expect(window.localStorage.getItem(recordKey)).toBe(recordRaw);
    expect(window.localStorage.getItem(indexKey)).toBe(indexRaw);
    expect(window.localStorage.getItem(transactionKey)).toBeNull();
    expect(window.localStorage.getItem(transactionKey + ':committed')).toBeNull();
    for (const [key, value] of storageBefore) {
      expect(window.localStorage.getItem(key)).toBe(value);
    }
    expect(JSON.stringify(gameControl.value)).toBe(canonicalBefore);
    Object.values(gameMutators).forEach(spy => expect(spy).not.toHaveBeenCalled());
    expect(loaderControl.loadCatalogue).toHaveBeenCalledTimes(2);
    expect(loaderControl.loadPack).toHaveBeenCalledTimes(2);
  });
});
