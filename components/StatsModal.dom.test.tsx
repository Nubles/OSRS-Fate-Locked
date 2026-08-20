// @vitest-environment jsdom
import React, { act, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../types';
import { buildFateAnalytics, defaultFateAnalyticsQuery, type FateAnalyticsResult } from '../utils/fateAnalytics';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

const mocks = vi.hoisted(() => ({
  game: {
    history: [] as LogEntry[],
    unlocks: {
      equipment: {}, skills: {}, levels: {}, regions: [], mobility: [], arcana: [], housing: [],
      merchants: [], minigames: [], bosses: [], storage: [], guilds: [], farming: [],
      slayerUnlocks: [], quests: [], diaries: [], cas: [], completedTasks: [], collectionLog: {},
    },
    gameModeId: 'vanilla',
  },
}));

vi.mock('../context/GameContext', () => ({ useGame: () => mocks.game }));
vi.mock('./StatsChartsView', () => ({
  default: ({ analytics }: { analytics: FateAnalyticsResult }) => (
    <>
      <div data-testid="dashboard-result">
        {analytics.summary.attempts}/{analytics.summary.genuineWins}/{analytics.summary.pityInterventions}
      </div>
      <div data-testid="dashboard-scoreable">{analytics.summary.scoreableAttempts}</div>
    </>
  ),
}));

import { StatsModal } from './StatsModal';

const baseHistory = (): LogEntry[] => [{
  id: 'legacy-miss', timestamp: NOW - 40 * DAY, type: 'ROLL_FAIL', result: 'FAIL',
  source: 'Boss (Low)', threshold: 20, rollValue: 80, message: 'No key.',
}, {
  id: 'exact-success', timestamp: NOW - DAY, type: 'ROLL_SUCCESS', result: 'SUCCESS',
  source: 'Quest (Novice)', threshold: 10, rollValue: 5, message: 'Key!',
  meta: { successProbability: 0.1, standardKeysAwarded: 1, rewardKind: 'normal' },
}, {
  id: 'exact-pity', timestamp: NOW, type: 'PITY', result: 'FAIL',
  source: 'Quest (Novice)', threshold: 10, rollValue: 90, message: 'Pity key.',
  meta: { successProbability: 0.1, standardKeysAwarded: 1, rewardKind: 'pity' },
}];

const agreementHistory = (): LogEntry[] => [{
  id: 'normal-win', timestamp: NOW - 8_000, type: 'ROLL_SUCCESS', result: 'SUCCESS',
  source: 'Quest (Novice)', threshold: 20, rollValue: 10, message: 'Normal Key.',
  meta: { successProbability: 0.2, standardKeysAwarded: 1, rewardKind: 'normal', drawResolution: 1000, luckApplied: false },
}, {
  id: 'omni-win', timestamp: NOW - 7_000, type: 'ROLL_OMNI', result: 'SUCCESS',
  source: 'Boss (Low)', threshold: 10, rollValue: 5, message: 'Omni-Key.',
  meta: { successProbability: 0.1, standardKeysAwarded: 0, rewardKind: 'omni', drawResolution: 1000, luckApplied: false },
}, {
  id: 'exact-miss', timestamp: NOW - 6_000, type: 'ROLL_FAIL', result: 'FAIL',
  source: 'Boss (Low)', threshold: 30, rollValue: 70, message: 'Miss.',
  meta: { successProbability: 0.3, standardKeysAwarded: 0, rewardKind: 'none', drawResolution: 1000, luckApplied: false },
}, {
  id: 'pity', timestamp: NOW - 5_000, type: 'PITY', result: 'FAIL',
  source: 'Quest (Novice)', threshold: 20, rollValue: 90, message: 'Pity intervention.',
  meta: { successProbability: 0.2, standardKeysAwarded: 1, rewardKind: 'pity', drawResolution: 1000, luckApplied: false },
}, {
  id: 'luck-miss', timestamp: NOW - 4_000, type: 'ROLL_FAIL', result: 'FAIL',
  source: 'Slayer (Beginner)', threshold: 20, rollValue: 99, message: 'Luck miss.',
  meta: { successProbability: 0.36, standardKeysAwarded: 0, rewardKind: 'none', drawResolution: 10000, luckApplied: true },
}, {
  id: 'greed-win', timestamp: NOW - 3_000, type: 'ROLL_SUCCESS', result: 'SUCCESS',
  source: 'Slayer (Beginner)', threshold: 15, rollValue: 3, message: 'Greed reward.',
  meta: { successProbability: 0.15, standardKeysAwarded: 2, rewardKind: 'greed', drawResolution: 1000, luckApplied: false },
}, {
  id: 'unscoreable-win', timestamp: NOW - 2_000, type: 'ROLL_SUCCESS', result: 'SUCCESS',
  source: 'Imported legacy', threshold: undefined, rollValue: 4, message: 'Win with unknown odds.',
  meta: { successProbability: Number.NaN },
}, {
  id: 'legacy-miss', timestamp: NOW - 1_000, type: 'ROLL_FAIL', result: 'FAIL',
  source: 'Clue (Easy)', threshold: 25, rollValue: 80, message: 'Legacy miss.',
}];

const mountedRoots: Array<{ host: HTMLDivElement; root: Root }> = [];

const mount = async (node: React.ReactNode) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push({ host, root });
  await act(async () => root.render(node));
  return { host, root };
};

const change = async (control: HTMLSelectElement | HTMLInputElement, value?: string) => {
  await act(async () => {
    if (control instanceof HTMLInputElement) control.click();
    else {
      control.value = value!;
      control.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
};

const click = async (element: Element) => act(async () => {
  (element as HTMLElement).click();
});

afterEach(async () => {
  for (const { host, root } of mountedRoots.splice(0).reverse()) {
    await act(async () => root.unmount());
    host.remove();
  }
  mocks.game.history = [];
  vi.restoreAllMocks();
});

describe('StatsModal shared analytics shell', () => {
  it('keeps dashboard and Fate Report figures in agreement without scoring an unknown-odds win', async () => {
    const fixture = agreementHistory();
    mocks.game.history = fixture;
    const expected = buildFateAnalytics(fixture, defaultFateAnalyticsQuery(NOW));
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const dashboard = host.querySelector('#fate-panel-dashboard')!;

    expect(dashboard.textContent).toContain(`Roll attempts${expected.summary.attempts}`);
    expect(dashboard.textContent).toContain(`Genuine RNG wins${expected.summary.genuineWins}`);
    expect(dashboard.textContent).toContain(`Expected wins — scoreable cohort${expected.summary.expectedWins.toFixed(2)}`);
    expect(dashboard.textContent).toContain(`${expected.summary.scoreableWins}/${expected.summary.scoreableAttempts} scoreable wins`);
    expect(dashboard.textContent).toContain(`Delta ${expected.summary.delta >= 0 ? '+' : ''}${expected.summary.delta.toFixed(2)} scoreable wins`);
    expect(dashboard.textContent).toContain(`Dry streak${expected.summary.currentDrought}Current · ${expected.summary.longestDrought} longest`);

    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-fate"]')!);
    const report = host.querySelector('#fate-panel-fate')!;
    expect(report.textContent).toContain(`Overall: ${expected.summary.attempts} attempts · ${expected.summary.genuineWins} genuine RNG wins`);
    expect(report.textContent).toContain(`Scoreable cohort: ${expected.summary.scoreableWins}/${expected.summary.scoreableAttempts} wins · ${expected.summary.expectedWins.toFixed(2)} expected · ${expected.summary.delta >= 0 ? '+' : ''}${expected.summary.delta.toFixed(2)} delta`);
    expect(report.textContent).toContain(`Current drought${expected.summary.currentDrought}`);
    expect(report.textContent).toContain(`Longest drought${expected.summary.longestDrought}`);
    expect(expected.summary.genuineWins).toBe(expected.summary.scoreableWins + 1);
    expect(expected.summary.delta).toBeCloseTo(expected.summary.scoreableWins - expected.summary.expectedWins);
  });

  it('renders sparse, legacy, malformed, and unverified selections honestly', async () => {
    mocks.game.history = [];
    const empty = await mount(<StatsModal onClose={() => undefined} />);
    expect(empty.host.textContent).toContain('No roll attempts in this selection');
    await click(empty.host.querySelector('[role="tab"][aria-controls="fate-panel-fate"]')!);
    expect(empty.host.querySelector('#fate-panel-fate')?.textContent)
      .toContain("No rolls recorded yet — Fate hasn't had a chance to judge you.");

    mocks.game.history = [{
      id: 'legacy-win', timestamp: NOW - 2, type: 'ROLL_SUCCESS', result: 'SUCCESS',
      source: 'Legacy source', threshold: 100, rollValue: 1, message: 'Legacy win.',
    }, {
      id: 'malformed', timestamp: Number.NaN, type: 'ROLL_FAIL', result: 'FAIL',
      source: 'Malformed source', threshold: 20, rollValue: 80, message: 'Malformed.',
      meta: { successProbability: Number.NaN },
    }, {
      id: 'unverified-reward', timestamp: NOW, type: 'ROLL_SUCCESS', result: 'SUCCESS',
      source: 'Imported reward', threshold: 20, rollValue: 2, message: 'Unverified reward.',
    }];
    const populated = await mount(<StatsModal onClose={() => undefined} />);
    expect(populated.host.textContent).toContain('Legacy estimates included');
    expect(populated.host.textContent).toContain('Invalid timestamps: 1');
    expect(populated.host.textContent).toContain('Unscoreable: 1');
    expect(populated.host.textContent).toContain('Roll attempts3');
    expect(populated.host.textContent).toContain('Confirmed Standard Keys0');
    expect(populated.host.textContent).toContain('0/2 reward events exact');
    expect(populated.host.textContent).not.toContain('3 Standard Keys');

    mocks.game.history = [{
      id: 'certain-win', timestamp: NOW, type: 'ROLL_SUCCESS', result: 'SUCCESS',
      source: 'Certain source', threshold: 100, rollValue: 1, message: 'Certain win.',
      meta: { successProbability: 1, standardKeysAwarded: 1, rewardKind: 'normal', drawResolution: 1000, luckApplied: false },
    }];
    const zeroVariance = await mount(<StatsModal onClose={() => undefined} />);
    expect(zeroVariance.host.textContent).toContain('Luck — scoreable cohort—');
    expect(zeroVariance.host.textContent).not.toMatch(/Blessed|Forsaken/);
    expect(zeroVariance.host.querySelector<HTMLInputElement>('input[aria-label="Exact only"]')?.disabled).toBe(false);
  });

  it('opens on Dashboard and separates RNG wins from pity', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);

    expect(host.querySelector('[aria-selected="true"]')?.textContent).toContain('Dashboard');
    expect(host.textContent).toContain('Genuine RNG wins');
    expect(host.textContent).toContain('Pity interventions');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('3/1/1');
  });

  it('applies Last 30 days to the dashboard and breakdown from one result', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const range = host.querySelector<HTMLSelectElement>('select[aria-label="Range"]');
    if (!range) throw new Error('Missing range control');

    await change(range, 'last-30-days');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('2/1/1');

    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-breakdown"]')!);
    const table = host.querySelector('[aria-label="Activity breakdown"]');
    expect(table?.textContent).toContain('Quest (Novice)');
    expect(table?.textContent).not.toContain('Boss (Low)');
  });

  it('applies Last 100 after chronological ordering', async () => {
    const misses = Array.from({ length: 101 }, (_, index): LogEntry => ({
      id: `miss-${index}`,
      timestamp: NOW - (103 - index) * DAY,
      type: 'ROLL_FAIL', result: 'FAIL', source: 'Boss (Low)', threshold: 20,
      rollValue: 80, message: 'No key.',
    }));
    mocks.game.history = [...misses, ...baseHistory().slice(1)];
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const range = host.querySelector<HTMLSelectElement>('select[aria-label="Range"]')!;

    await change(range, 'last-100');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('100/1/1');
  });

  it('keeps pre-scope options available while category and source scopes update every surface', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const scope = host.querySelector<HTMLSelectElement>('select[aria-label="Scope"]')!;

    await change(scope, 'category:Quest');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('2/1/1');
    expect([...scope.options].some(option => option.value === 'source:Boss (Low)')).toBe(true);

    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-breakdown"]')!);
    expect(host.querySelector('[aria-label="Activity breakdown"]')?.textContent).toContain('Quest (Novice)');

    await change(scope, 'source:Boss (Low)');
    expect(host.querySelector('[aria-label="Activity breakdown"]')?.textContent).toContain('Boss (Low)');
    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-dashboard"]')!);
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('1/0/0');
  });

  it('clears a scope that becomes unavailable when the range changes', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const scope = host.querySelector<HTMLSelectElement>('select[aria-label="Scope"]')!;
    const range = host.querySelector<HTMLSelectElement>('select[aria-label="Range"]')!;

    await change(scope, 'source:Boss (Low)');
    await change(range, 'last-30-days');

    expect(scope.value).toBe('all');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('2/1/1');
    expect(host.querySelector('[aria-label="Reset filters"]')).toBeNull();
  });

  it('offers a reset for an empty filtered selection and uses selection-specific Fate Report copy', async () => {
    mocks.game.history = [baseHistory()[0]];
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const range = host.querySelector<HTMLSelectElement>('select[aria-label="Range"]')!;

    await change(range, 'last-30-days');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('0/0/0');
    const reset = host.querySelector<HTMLButtonElement>('[aria-label="Reset filters"]');
    expect(reset).not.toBeNull();

    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-fate"]')!);
    expect(host.querySelector('#fate-panel-fate')?.textContent).toContain('No roll attempts in this selection');
    expect(host.querySelector('#fate-panel-fate')?.textContent)
      .not.toContain("No rolls recorded yet — Fate hasn't had a chance to judge you.");
    expect(host.textContent).toContain('Export aggregate evidence');

    await click(reset!);
    expect(range.value).toBe('all');
    expect(host.querySelector('[data-testid="dashboard-result"]')?.textContent).toBe('1/0/0');
    expect(host.querySelector('[aria-label="Reset filters"]')).toBeNull();
  });

  it('maps Exact only inversely and leaves a checked control enabled', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const exactOnly = host.querySelector<HTMLInputElement>('input[aria-label="Exact only"]')!;

    expect(host.querySelector('[data-testid="dashboard-scoreable"]')?.textContent).toBe('3');
    await change(exactOnly);
    expect(exactOnly.checked).toBe(true);
    expect(exactOnly.disabled).toBe(false);
    expect(host.querySelector('[data-testid="dashboard-scoreable"]')?.textContent).toBe('2');
    await change(exactOnly);
    expect(host.querySelector('[data-testid="dashboard-scoreable"]')?.textContent).toBe('3');
  });

  it('uses button headers and exposes the current sort direction', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-breakdown"]')!);
    const expectedHeader = [...host.querySelectorAll('th')]
      .find(header => header.textContent?.includes('Expected wins'))!;
    const button = expectedHeader.querySelector('button')!;

    expect(expectedHeader.getAttribute('aria-sort')).toBe('none');
    await click(button);
    expect(expectedHeader.getAttribute('aria-sort')).toBe('descending');
    await click(button);
    expect(expectedHeader.getAttribute('aria-sort')).toBe('ascending');
  });

  it('keeps every tabpanel relationship mounted and moves roving-tab focus with arrow keys', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      const panelId = tab.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      const panel = host.querySelector(`#${panelId}`);
      expect(panel).toBeTruthy();
      expect(panel?.getAttribute('aria-labelledby')).toBe(tab.id);
    }

    for (const control of host.querySelectorAll('select, input[type="checkbox"]')) {
      expect(control.closest('label')).not.toBeNull();
    }

    tabs[0].focus();
    await act(async () => tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(tabs[1]);
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('#fate-panel-breakdown')?.hasAttribute('hidden')).toBe(false);

    await act(async () => tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })));
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs[2].getAttribute('aria-selected')).toBe('true');

    await act(async () => tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('labels scoreable-only source and Fate category statistics explicitly', async () => {
    mocks.game.history = baseHistory();
    const { host } = await mount(<StatsModal onClose={() => undefined} />);

    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-breakdown"]')!);
    const breakdown = host.querySelector('#fate-panel-breakdown')!;
    expect(breakdown.textContent).toContain('Z-score (scoreable)');
    expect(breakdown.textContent).toContain('Actual rate (scoreable)');
    expect(breakdown.textContent).toContain('Expected rate (scoreable)');

    await click(host.querySelector('[role="tab"][aria-controls="fate-panel-fate"]')!);
    const fate = host.querySelector('#fate-panel-fate')!;
    expect(fate.textContent).toContain('Expected (scoreable)');
    expect(fate.textContent).toContain('Delta (scoreable)');
  });

  it('focuses inside, traps focus, closes on Escape, and restores the opener', async () => {
    mocks.game.history = baseHistory();
    const Harness = () => {
      const [open, setOpen] = useState(false);
      const opener = useRef<HTMLButtonElement>(null);
      return <>
        <button ref={opener} onClick={() => setOpen(true)}>Open analytics</button>
        {open && <StatsModal onClose={() => setOpen(false)} />}
      </>;
    };
    const { host } = await mount(<Harness />);
    const opener = host.querySelector<HTMLButtonElement>('button')!;
    opener.focus();
    await click(opener);
    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = host.querySelector<HTMLButtonElement>('[aria-label="Close Fate Analytics"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(close.type).toBe('button');
    expect(document.activeElement === close || dialog.contains(document.activeElement)).toBe(true);

    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')]
      .filter(element => !element.closest('[hidden]') && element.tabIndex >= 0);
    focusable.at(-1)!.focus();
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(focusable[0]);

    focusable[0].focus();
    await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })));
    expect(document.activeElement).toBe(focusable.at(-1));

    await act(async () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
