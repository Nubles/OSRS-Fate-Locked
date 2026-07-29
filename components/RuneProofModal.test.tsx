// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuneProofRunSnapshot } from '../types';
import type { CompiledGoal } from '../utils/runeproof/goalCompiler';
import type { AcquisitionRule, RuneProofReport, RuneProofStatus } from '../utils/runeproof/model';
import type { RuneProofQuery } from '../utils/runeproof/engine';
import { RuneProofModal } from './RuneProofModal';

const snapshot = (runRevision = 4): RuneProofRunSnapshot => ({
  runId: 'modal-run', runRevision, gameModeId: 'chunked', equipmentTiers: {}, skillCaps: {}, currentLevels: {},
  unlockedAreas: [], unlockedChunks: ['50,50'], unlockedMobility: [], unlockedArcana: [], unlockedHousing: [],
  unlockedMerchants: [], unlockedMinigames: [], unlockedBosses: [], unlockedStorage: [], unlockedGuilds: [],
  unlockedFarming: [], unlockedSlayer: [], unlockedBanks: [], completedQuests: [], completedDiaries: [],
  completedCombatAchievements: [], completedTasks: [], collectionLog: {},
});

const goals: readonly CompiledGoal[] = [
  { id: 'item:oak-plank', kind: 'ITEM', label: 'Oak plank', requirement: { op: 'FACT', fact: { id: 'item:oak-plank', kind: 'ITEM', label: 'Oak plank' } }, coverage: 'VERIFIED', provenanceIds: ['item-source'], sourceVersion: 'test' },
  { id: 'quest:dragon-slayer', kind: 'QUEST', label: 'Dragon Slayer', requirement: { op: 'FACT', fact: { id: 'quest:dragon-slayer', kind: 'QUEST', label: 'Dragon Slayer' } }, coverage: 'VERIFIED', provenanceIds: ['quest-source'], sourceVersion: 'test' },
  { id: 'diary:lumbridge-easy', kind: 'DIARY', label: 'Lumbridge Easy Diary', requirement: { op: 'FACT', fact: { id: 'diary:lumbridge-easy', kind: 'CAPABILITY', label: 'Lumbridge Easy Diary' } }, coverage: 'PARTIAL', provenanceIds: ['diary-source'], sourceVersion: 'test' },
  { id: 'activity:wintertodt', kind: 'ACTIVITY', label: 'Wintertodt', requirement: { op: 'FACT', fact: { id: 'activity:wintertodt', kind: 'CAPABILITY', label: 'Wintertodt' } }, coverage: 'VERIFIED', provenanceIds: ['activity-source'], sourceVersion: 'test' },
];

const rules: readonly AcquisitionRule[] = [{
  id: 'rule:oak-plank-shop', output: { id: 'item:oak-plank', kind: 'ITEM', label: 'Oak plank' }, outputQuantity: 1,
  sourceKind: 'SHOP', sourceLabel: 'Sawmill operator', locationId: '50,50 / Varrock Sawmill',
  requirements: { op: 'FACT', fact: { id: 'capability:coins', kind: 'CAPABILITY', label: 'Coins' } },
  repeatability: 'REPEATABLE', probability: null, coverage: 'VERIFIED', provenanceIds: ['osrs-wiki:sawmill'],
}];

const route = (revision = 4, id = 'route:shop') => ({
  id, deterministic: true, prerequisiteCount: 1, recursiveIngredientCount: 0, travelDistance: 2, probability: null,
  witness: {
    rootFactId: 'item:oak-plank', sourceVersion: 'runeproof-source-v1', runId: 'modal-run', runRevision: revision, proofHash: 'proof-secret-123',
    steps: { root: { ruleId: 'rule:oak-plank-shop', proves: { id: 'item:oak-plank', kind: 'ITEM' as const, label: 'Oak plank', quantity: 2 }, chosenTerms: ['capability:coins'], childStepIds: [] } },
  },
});

const report = (status: RuneProofStatus, revision = 4): RuneProofReport => ({
  goalId: 'item:oak-plank', status, coverage: status === 'UNKNOWN' ? 'UNKNOWN' : 'VERIFIED',
  routes: status === 'OBTAINABLE' || status === 'OBTAINABLE_RNG' ? [route(revision), route(revision, 'route:alternate')] : [],
  blockers: status === 'BLOCKED' ? [{ factIds: ['capability:coins', 'quest:dragon-slayer'], labels: ['Coins', 'Dragon Slayer'] }] : [],
  unavoidableBlockerFactIds: status === 'BLOCKED' ? ['capability:coins'] : [], routesComplete: status !== 'UNKNOWN',
  explanation: status === 'UNKNOWN' ? 'Evidence is incomplete.' : undefined,
});

type Service = { evaluate: (query: RuneProofQuery) => Promise<RuneProofReport | null> };
const serviceFor = (value: RuneProofReport): Service => ({ evaluate: async () => value });

function renderModal(service: Service = serviceFor(report('OBTAINABLE')), revision = 4) {
  return render(<RuneProofModal onClose={() => undefined} snapshot={snapshot(revision)} service={service} goals={goals} rules={rules} />);
}

async function choose(label = 'Oak plank') {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
  await act(async () => undefined);
}

afterEach(() => cleanup());

describe('RuneProofModal', () => {
  it('searches items, quests, diaries, and activities in an accessible responsive dialog', () => {
    renderModal();
    expect(screen.getByRole('dialog', { name: 'RuneProof' })).not.toBeNull();
    expect(screen.getByRole('complementary', { name: 'Goal search' })).not.toBeNull();
    expect(screen.getByRole('main', { name: 'Proof result' })).not.toBeNull();
    const search = screen.getByRole('searchbox', { name: 'Search goals' });
    for (const [query, expected] of [['plank', 'Oak plank'], ['dragon', 'Dragon Slayer'], ['lumbridge', 'Lumbridge Easy Diary'], ['winter', 'Wintertodt']] as const) {
      fireEvent.change(search, { target: { value: query } });
      expect(screen.getByRole('button', { name: new RegExp(expected, 'i') })).not.toBeNull();
    }
  });

  it.each([
    ['OBTAINABLE', 'Obtainable now'],
    ['OBTAINABLE_RNG', 'Obtainable now — random drop'],
    ['BLOCKED', 'Missing requirements'],
    ['IMPOSSIBLE', 'No valid route in your current chunks'],
    ['UNKNOWN', 'Not enough verified data'],
  ] as const)('uses the player-facing %s status label', async (status, label) => {
    renderModal(serviceFor(report(status)));
    await choose();
    expect(screen.getByRole('heading', { name: label })).not.toBeNull();
  });

  it('shows an evidence-rich preferred route while keeping alternatives and verification details collapsed', async () => {
    renderModal();
    await choose();
    expect(screen.getByRole('heading', { name: 'Best route' })).not.toBeNull();
    expect(screen.getByText('Sawmill operator')).not.toBeNull();
    expect(screen.getByText(/50,50 \/ Varrock Sawmill/)).not.toBeNull();
    expect(screen.getByText(/Requires: Coins/)).not.toBeNull();
    expect(screen.getByText(/2× Oak plank/)).not.toBeNull();
    expect(screen.getByText(/Provenance/)).not.toBeNull();
    const alternatives = screen.getByRole('button', { name: /Other valid routes/i });
    expect(alternatives.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(alternatives);
    expect(alternatives.getAttribute('aria-expanded')).toBe('true');
    const verification = screen.getByText('Verification details').closest('details');
    expect(verification?.open).toBe(false);
    expect(screen.getByText('Proof checked for this run.')).not.toBeNull();
  });

  it('marks requirements shared by every blocked route as unavoidable', async () => {
    renderModal(serviceFor(report('BLOCKED')));
    await choose();
    expect(screen.getByText(/Unavoidable\. Coins/)).not.toBeNull();
    expect(screen.queryByText(/Key advice/i)).toBeNull();
    expect(screen.queryByText(/future unlock/i)).toBeNull();
  });

  it('keeps unknown evidence distinct from an impossible route', async () => {
    renderModal(serviceFor(report('UNKNOWN')));
    await choose();
    expect(screen.getByText(/does not say the goal is impossible/i)).not.toBeNull();
    expect(screen.queryByText('No valid route in your current chunks')).toBeNull();
  });

  it('shows loading and lets the latest run revision win over stale results', async () => {
    const pending: Array<(value: RuneProofReport | null) => void> = [];
    const service: Service = { evaluate: () => new Promise<RuneProofReport | null>(resolve => pending.push(resolve)) };
    const view = renderModal(service, 4);
    await choose();
    expect(screen.getByText('Checking current routes…')).not.toBeNull();
    view.rerender(<RuneProofModal onClose={() => undefined} snapshot={snapshot(5)} service={service} goals={goals} rules={rules} />);
    await act(async () => undefined);
    await act(async () => { pending[0](report('OBTAINABLE', 4)); });
    expect(screen.queryByText('Obtainable now')).toBeNull();
    await act(async () => { pending[1](report('UNKNOWN', 5)); });
    expect(screen.getByRole('heading', { name: 'Not enough verified data' })).not.toBeNull();
  });

  it('does not dispose a caller-owned injected service on unmount', () => {
    const service = Object.assign(serviceFor(report('OBTAINABLE')), { dispose: vi.fn() });
    const view = renderModal(service);
    view.unmount();
    expect(service.dispose).not.toHaveBeenCalled();
  });

  it('disposes every factory-owned service across modal reopen cycles', async () => {
    const disposals = [vi.fn(), vi.fn()];
    let created = 0;
    const createService = async () => Object.assign(
      serviceFor(report('OBTAINABLE')),
      { dispose: disposals[created++] },
    );
    const first = render(<RuneProofModal onClose={() => undefined} snapshot={snapshot()} goals={goals} rules={rules} createService={createService} />);
    await act(async () => undefined);
    first.unmount();
    const reopened = render(<RuneProofModal onClose={() => undefined} snapshot={snapshot()} goals={goals} rules={rules} createService={createService} />);
    await act(async () => undefined);
    reopened.unmount();
    expect(disposals[0]).toHaveBeenCalledTimes(1);
    expect(disposals[1]).toHaveBeenCalledTimes(1);
    expect(created).toBe(2);
  });

  it('focuses search and closes via Escape, close control, and backdrop', () => {
    const escape = vi.fn();
    const view = render(<RuneProofModal onClose={escape} snapshot={snapshot()} service={serviceFor(report('OBTAINABLE'))} goals={goals} rules={rules} />);
    expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Search goals' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Close RuneProof' }));
    fireEvent.mouseDown(view.container.firstElementChild!);
    expect(escape).toHaveBeenCalledTimes(3);
  });
});
