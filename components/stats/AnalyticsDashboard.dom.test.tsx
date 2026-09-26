// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogEntry } from '../../types';
import { buildFateAnalytics, defaultFateAnalyticsQuery } from '../../utils/fateAnalytics';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('recharts', () => {
  const Series = ({ children, data, dataKey, isAnimationActive, name, stackId }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span
      aria-label={typeof name === 'string' ? name : undefined}
      data-animation-active={typeof isAnimationActive === 'boolean' ? String(isAnimationActive) : undefined}
      data-series-key={typeof dataKey === 'string' ? dataKey : undefined}
      data-stack-id={typeof stackId === 'string' ? stackId : undefined}
      data-render-point-count={Array.isArray(data) ? String(data.length) : undefined}
    >
      {children}
    </span>
  );
  const Container = ({ children }: React.PropsWithChildren) => <div>{children}</div>;
  const Primitive = ({ children }: React.PropsWithChildren) => <>{children}</>;
  // Recharts renders raw SVG elements and its own components, and silently drops anything else.
  const known = new Set<unknown>([Series, Primitive]);
  const Chart = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const data = Array.isArray(props.data) ? props.data as Array<{
      denominator?: number;
      coverageNumerator?: number;
      coverageDenominator?: number;
      selectionCoverageNumerator?: number;
      selectionCoverageDenominator?: number;
      expectedValue?: number | null;
      deltaValue?: number | null;
      attempts?: number;
      meanPredictedRate?: number;
      actualRate?: number;
    }> : [];
    const coverage = (numerator?: number, denominator?: number) => numerator === undefined || denominator === undefined
      ? undefined
      : `${numerator}/${denominator}`;
    const modelValue = (value?: number | null) => value === undefined ? undefined : value === null ? 'not modelled' : String(value);
    const rendered = React.Children.toArray(children)
      .filter(child => React.isValidElement(child) && (typeof child.type === 'string' || known.has(child.type)));
    return (
      <div
        role="img"
        aria-label={props['aria-label'] as string | undefined}
        data-tooltip-denominators={data.map(row => row.denominator).filter(value => value !== undefined).join(',') || undefined}
        data-prefix-coverages={data.map(row => coverage(row.coverageNumerator, row.coverageDenominator)).filter(Boolean).join(',') || undefined}
        data-selection-coverages={data.map(row => coverage(row.selectionCoverageNumerator, row.selectionCoverageDenominator)).filter(Boolean).join(',') || undefined}
        data-tooltip-expectations={data.map(row => modelValue(row.expectedValue)).filter(value => value !== undefined).join(',') || undefined}
        data-tooltip-deltas={data.map(row => modelValue(row.deltaValue)).filter(value => value !== undefined).join(',') || undefined}
        data-sample-attempts={data.map(row => row.attempts).filter(value => value !== undefined).join(',') || undefined}
        data-predicted-rates={data.map(row => row.meanPredictedRate).filter(value => value !== undefined).join(',') || undefined}
        data-actual-rates={data.map(row => row.actualRate).filter(value => value !== undefined).join(',') || undefined}
      >
        {rendered}
      </div>
    );
  };
  return {
    ResponsiveContainer: Container,
    ComposedChart: Chart,
    PieChart: Chart,
    BarChart: Chart,
    Area: Series,
    Line: Series,
    Scatter: Series,
    Pie: Series,
    Bar: Series,
    Cell: Primitive,
    CartesianGrid: Primitive,
    XAxis: Primitive,
    YAxis: Primitive,
    Tooltip: Primitive,
    ReferenceLine: Primitive,
  };
});

import { AnalyticsTooltip, PrimaryAnalyticsCharts } from './PrimaryAnalyticsCharts';
import StatsChartsView from '../StatsChartsView';
import { CalibrationTooltip, KeyAcquisitionTooltip, SecondaryAnalyticsCharts } from './SecondaryAnalyticsCharts';
import { FairnessCharts } from './FairnessCharts';

const NOW = Date.UTC(2026, 7, 20, 12);
const analyticsFor = (history: LogEntry[]) => buildFateAnalytics(history, defaultFateAnalyticsQuery(NOW));
const history: LogEntry[] = [{
  id: 'quest-win', timestamp: NOW - 4_000, type: 'ROLL_SUCCESS', result: 'SUCCESS',
  source: 'Quest (Novice)', threshold: 20, rollValue: 10, message: 'Key!',
  meta: { successProbability: 0.2, standardKeysAwarded: 1, rewardKind: 'normal', drawResolution: 1000, luckApplied: false },
}, {
  id: 'boss-omni', timestamp: NOW - 3_000, type: 'ROLL_OMNI', result: 'SUCCESS',
  source: 'Boss (Low)', threshold: 10, rollValue: 5, message: 'Omni!',
  meta: { successProbability: 0.1, standardKeysAwarded: 1, rewardKind: 'omni', drawResolution: 1000, luckApplied: false },
}, {
  id: 'boss-miss', timestamp: NOW - 2_000, type: 'ROLL_FAIL', result: 'FAIL',
  source: 'Boss (Low)', threshold: 30, rollValue: 70, message: 'Miss.',
  meta: { successProbability: 0.3, standardKeysAwarded: 0, rewardKind: 'none', drawResolution: 1000, luckApplied: false },
}, {
  id: 'quest-pity', timestamp: NOW - 1_000, type: 'PITY', result: 'FAIL',
  source: 'Quest (Novice)', threshold: 20, rollValue: 110, message: 'Pity.',
  meta: { successProbability: 0.2, standardKeysAwarded: 1, rewardKind: 'pity', drawResolution: 1000, luckApplied: false },
}];

const mountedRoots: Array<{ host: HTMLDivElement; root: Root }> = [];
const mount = async (node: React.ReactNode) => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  mountedRoots.push({ host, root });
  await act(async () => root.render(node));
  return host;
};

afterEach(async () => {
  for (const { host, root } of mountedRoots.splice(0).reverse()) {
    await act(async () => root.unmount());
    host.remove();
  }
  vi.restoreAllMocks();
});

describe('PrimaryAnalyticsCharts', () => {
  it('renders the four named chart cards with summaries and non-colour labels', async () => {
    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor(history)} />);

    for (const heading of [
      'Luck over time',
      'How your rolls ended',
      'Luck by activity',
      'Streaks',
    ]) {
      expect(host.textContent).toContain(heading);
      expect(host.querySelector(`article[aria-label="${heading}"]`)).not.toBeNull();
    }
    expect(host.querySelectorAll('[data-chart-summary]')).toHaveLength(4);
    expect(host.textContent).toContain('After 4 rolls, you are');
    expect(host.textContent).toContain('Quest');
    expect(host.textContent).toContain('Boss');
    expect(host.textContent).toContain('Limited sample');
    expect(host.textContent).toContain('small sample');
    expect(host.textContent).toContain('Win');
    expect(host.textContent).toContain('Miss');
    expect(host.textContent).toContain('Pity');
  });

  it('renders specific empty states without chart axes', async () => {
    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor([])} />);

    for (const message of [
      'No scoreable attempts match these filters.',
      'No attempt outcomes match these filters.',
      'No category attempts match these filters.',
      'No streak data matches these filters.',
    ]) expect(host.textContent).toContain(message);
    expect(host.textContent).not.toContain('0.0% of your rolls');
    expect(host.querySelectorAll('[role="img"]')).toHaveLength(0);
  });

  it('disables every chart animation when reduced motion is requested', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor(history)} />);
    const animatedMarks = [...host.querySelectorAll('[data-animation-active]')];

    expect(animatedMarks.length).toBeGreaterThan(0);
    expect(animatedMarks.every(mark => mark.getAttribute('data-animation-active') === 'false')).toBe(true);
  });

  it('discloses numerator, denominator, expectation, and probability coverage in chart tooltips', async () => {
    const host = await mount(<AnalyticsTooltip active payload={[{ payload: {
      markLabel: 'Quest', numerator: 2, denominator: 4, expectedValue: 0.8,
      coverageNumerator: 4, coverageDenominator: 4, sampleLabel: 'Limited sample',
    } }]} />);

    expect(host.textContent).toContain('Actual: 2/4');
    expect(host.textContent).toContain('Expected: 0.80');
    expect(host.textContent).toContain('Probability coverage: 4/4 attempts');
    expect(host.textContent).toContain('Limited sample');
  });

  it('uses all filtered attempts as the histogram tooltip denominator', async () => {
    const host = await mount(<FairnessCharts analytics={analyticsFor(history)} />);
    const histogram = host.querySelector('[aria-label="Observed and expected roll distribution chart"]');

    expect(histogram?.getAttribute('data-tooltip-denominators')?.split(',')).toEqual(Array(20).fill('4'));
    expect(host.textContent).toContain('Expected occupancy coverage: 4/4 attempts');
  });

  it('keeps timeline prefix coverage separate from selection coverage in data and tooltip copy', async () => {
    const unscoreable: LogEntry = {
      id: 'unscoreable', timestamp: NOW, type: 'ROLL_FAIL', result: 'FAIL', source: 'Boss (Low)',
      threshold: Number.NaN, rollValue: 80, message: 'Unknown odds.',
    };
    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor([...history, unscoreable])} />);
    const timeline = host.querySelector('[aria-label="Cumulative observed and expected wins chart"]');

    expect(timeline?.getAttribute('data-prefix-coverages')).toBe('1/1,2/2,3/3,4/4');
    expect(timeline?.getAttribute('data-selection-coverages')).toBe('4/5,4/5,4/5,4/5');
    expect(host.querySelector('article[aria-label="Luck over time"]')?.textContent).toContain('(rolls with known odds)');

    const tooltipPayload = [{ payload: {
      markLabel: 'Roll 1 with known odds', numerator: 1, denominator: 1, expectedValue: 0.2,
      coverageNumerator: 1, coverageDenominator: 1,
      selectionCoverageNumerator: 4, selectionCoverageDenominator: 5,
    } }] as unknown as React.ComponentProps<typeof AnalyticsTooltip>['payload'];
    const tooltipHost = await mount(<AnalyticsTooltip active payload={tooltipPayload} />);
    expect(tooltipHost.textContent).toContain('Probability coverage: 1/1 attempts');
    expect(tooltipHost.textContent).toContain('Selection coverage: 4/5 attempts');
  });

  it('draws pity markers from the capped timeline data rather than a data set of their own', async () => {
    const base = analyticsFor(history);
    const timeline = Array.from({ length: 1000 }, (_, index) => ({
      index,
      timestamp: NOW + index,
      actual: 0,
      expected: (index + 1) * 0.1,
      lower: 0,
      upper: (index + 1) * 0.2,
      delta: -(index + 1) * 0.1,
      outcome: 'pity' as const,
    }));
    const analytics = {
      ...base,
      timeline,
      summary: { ...base.summary, attempts: 1000, scoreableAttempts: 1000 },
    };
    const host = await mount(<PrimaryAnalyticsCharts analytics={analytics} />);
    const chart = host.querySelector('[aria-label="Cumulative observed and expected wins chart"]');
    const marker = host.querySelector('[aria-label="Pity marker — diamond"]');

    expect(chart?.getAttribute('data-prefix-coverages')?.split(',')).toHaveLength(400);
    expect(marker?.getAttribute('data-series-key')).toBe('pityMarker');
    expect(marker?.getAttribute('data-render-point-count')).toBeNull();
  });

  it('leaves the pity marker out when no roll ended in pity', async () => {
    const withoutPity = history.filter(entry => entry.type !== 'PITY');
    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor(withoutPity)} />);

    expect(host.querySelector('[aria-label="Pity marker — diamond"]')).toBeNull();
    expect(host.querySelector('[aria-label="Luck over time legend"]')?.textContent).not.toContain('Pity key');
  });

  it('labels category expectation and delta as not modelled without scoreable attempts', async () => {
    const unscoreable: LogEntry = {
      id: 'unscoreable-category', timestamp: NOW, type: 'ROLL_FAIL', result: 'FAIL', source: 'Quest (Novice)',
      threshold: Number.NaN, rollValue: 80, message: 'Unknown odds.',
    };
    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor([unscoreable])} />);
    const sourceCard = host.querySelector('article[aria-label="Luck by activity"]');

    expect(sourceCard?.textContent).toContain('expected not modelled, delta not modelled');
    expect(sourceCard?.textContent).toContain('n/a');
    expect(sourceCard?.textContent).not.toContain('expected 0.00');

    const tooltipPayload = [{ payload: {
      markLabel: 'Quest', numerator: 0, denominator: 0, expectedValue: null, deltaValue: null,
      coverageNumerator: 0, coverageDenominator: 1, sampleLabel: 'Limited sample',
    } }] as unknown as React.ComponentProps<typeof AnalyticsTooltip>['payload'];
    const tooltipHost = await mount(<AnalyticsTooltip active payload={tooltipPayload} />);
    expect(tooltipHost.textContent).toContain('Expected: not modelled');
    expect(tooltipHost.textContent).toContain('Delta: not modelled');
  });

  it('orders activity luck from furthest ahead to furthest behind', async () => {
    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor([...history, {
      id: 'clue-miss', timestamp: NOW, type: 'ROLL_FAIL', result: 'FAIL',
      source: 'Clue Scroll (Easy)', threshold: 60, rollValue: 90, message: 'Miss.',
      meta: { successProbability: 0.6, standardKeysAwarded: 0, rewardKind: 'none', drawResolution: 1000, luckApplied: false },
    }])} />);
    const rows = [...host.querySelectorAll('[aria-label="Source performance data"] > li')]
      .map(row => row.querySelector('p')?.textContent);

    expect(rows.at(-1)).toBe('Clue Scroll');
    expect(host.querySelector('article[aria-label="Luck by activity"] [data-chart-summary]')?.textContent)
      .toContain('unluckiest at Clue Scroll (−0.6)');
  });

  it('keeps the newest streak segment visible in a keyboard-scrollable region', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(640);
    const alternating = Array.from({ length: 80 }, (_, index): LogEntry => ({
      id: `alternating-${index}`,
      timestamp: NOW + index,
      type: index % 2 === 0 ? 'ROLL_SUCCESS' : 'ROLL_FAIL',
      result: index % 2 === 0 ? 'SUCCESS' : 'FAIL',
      source: 'Long history',
      threshold: 20,
      rollValue: index % 2 === 0 ? 10 : 80,
      message: 'Segment fixture.',
      meta: {
        successProbability: 0.2,
        standardKeysAwarded: index % 2 === 0 ? 1 : 0,
        rewardKind: index % 2 === 0 ? 'normal' : 'none',
        drawResolution: 1000,
        luckApplied: false,
      },
    }));
    const currentDrought = Array.from({ length: 60 }, (_, index): LogEntry => ({
      id: `current-${index}`,
      timestamp: NOW + alternating.length + index,
      type: 'ROLL_FAIL', result: 'FAIL', source: 'Long history', threshold: 20,
      rollValue: 80, message: 'Current drought.',
      meta: { successProbability: 0.2, standardKeysAwarded: 0, rewardKind: 'none', drawResolution: 1000, luckApplied: false },
    }));

    const host = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor([...alternating, ...currentDrought])} />);
    const region = host.querySelector<HTMLElement>('[aria-label="Chronological streak timeline, horizontally scrollable"]');

    expect(region?.getAttribute('tabindex')).toBe('0');
    expect(region?.className).toContain('overflow-x-auto');
    expect(region?.scrollLeft).toBe(640);
    expect(region?.querySelector('[aria-current="true"]')?.getAttribute('aria-label'))
      .toContain('current segment');
    const recent = [...host.querySelectorAll('[aria-label="Most recent rolls, oldest first"] > [role="listitem"]')];
    expect(recent).toHaveLength(40);
    expect(recent.every(roll => roll.getAttribute('aria-label') === 'Miss')).toBe(true);
  });
});

describe('complete analytics dashboard', () => {
  it('keeps legacy-only probability charts useful', async () => {
    const legacy: LogEntry[] = [{
      id: 'legacy-win', timestamp: NOW - 1_000, type: 'ROLL_SUCCESS', result: 'SUCCESS',
      source: 'Legacy quest', threshold: 25, rollValue: 4, message: 'Legacy win.',
    }, {
      id: 'legacy-miss', timestamp: NOW, type: 'ROLL_FAIL', result: 'FAIL',
      source: 'Legacy boss', threshold: 50, rollValue: 80, message: 'Legacy miss.',
    }];
    const host = await mount(<StatsChartsView analytics={analyticsFor(legacy)} />);

    expect(host.querySelector('[aria-label="Cumulative observed and expected wins chart"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Predicted and actual probability calibration chart"]')).not.toBeNull();
    expect(host.querySelector('article[aria-label="Luck over time"]')?.textContent).toContain('After 2 rolls');
    expect(host.textContent).not.toContain('No scoreable attempts match these filters.');
  });

  it('renders all nine accessible named sections with neighbouring summaries', async () => {
    const host = await mount(<StatsChartsView analytics={analyticsFor(history)} />);

    for (const heading of [
      'Luck over time',
      'How your rolls ended',
      'Luck by activity',
      'Streaks',
      'Keys earned',
      'Activity calendar',
      'Notable moments',
      'Roll spread',
      'Odds check',
    ]) expect(host.querySelector(`article[aria-label="${heading}"]`)).not.toBeNull();

    expect(host.querySelectorAll('[data-chart-summary]')).toHaveLength(9);
    expect(host.querySelector('section[aria-label="Fairness checks"]')?.textContent).toContain("don't change your luck score");
  });

  it('labels calibration samples and keeps predicted and actual values on a percentage scale', async () => {
    const host = await mount(<FairnessCharts analytics={analyticsFor(history)} />);
    const chart = host.querySelector('[aria-label="Predicted and actual probability calibration chart"]');

    expect(chart?.getAttribute('data-sample-attempts')).toBe('1,2,1');
    expect(chart?.getAttribute('data-predicted-rates')).toBe('10,20,30');
    expect(chart?.getAttribute('data-actual-rates')).toBe('100,50,0');
    expect(host.textContent).toContain('How often you won');
    expect(host.textContent).toContain('What the odds said');
    expect(host.textContent).toContain('1 attempt');
  });

  it('stacks four exact Standard-Key series and labels Omni-Keys separately from unverified legacy events', async () => {
    const analytics = analyticsFor(history);
    analytics.keyAcquisition[0].unverifiedRewardEvents = 2;
    const host = await mount(<SecondaryAnalyticsCharts analytics={analytics} />);

    for (const label of [
      'Normal reward — Standard Keys',
      'Greed reward — Standard Keys',
      'Pity reward — Standard Keys',
      'Omni-derived reward — Standard Keys',
    ]) {
      const series = host.querySelector(`[aria-label="${label}"]`);
      expect(series?.getAttribute('data-stack-id')).toBe('standard-keys');
    }
    expect(host.querySelector('[aria-label="Omni-Key awards — separate count"]')?.getAttribute('data-stack-id')).toBeNull();
    expect(host.textContent).toContain('2 unverified legacy reward events — not Key counts');
    expect(host.textContent).not.toContain('2 unverified Keys');
  });

  it('keeps chart patterns as raw SVG defs, the only custom children Recharts renders', async () => {
    const primary = await mount(<PrimaryAnalyticsCharts analytics={analyticsFor(history)} />);
    expect(primary.querySelector('[aria-label="Outcome composition donut chart"] pattern#outcome-normal')).not.toBeNull();
    const secondary = await mount(<SecondaryAnalyticsCharts analytics={analyticsFor(history)} />);
    expect(secondary.querySelector('[aria-label="Verified Standard Key and separate Omni-Key acquisition chart"] pattern#reward-normal')).not.toBeNull();
  });

  it('provides unit-explicit calibration and reward tooltip copy', async () => {
    const calibration = await mount(<CalibrationTooltip active payload={[{ payload: {
      range: '20–30%', attempts: 4, meanPredictedRate: 25, actualRate: 50,
    } }]} />);
    expect(calibration.textContent).toContain('Attempts in bin: 4');
    expect(calibration.textContent).toContain('Mean predicted rate: 25.0%');
    expect(calibration.textContent).toContain('Actual genuine-win rate: 50.0%');

    const rewards = await mount(<KeyAcquisitionTooltip active payload={[{ payload: {
      date: '2026-08-20', normalStandard: 1, greedStandard: 2, pityStandard: 1,
      omniStandard: 1, omniKeys: 1, unverifiedRewardEvents: 3,
    } }]} />);
    expect(rewards.textContent).toContain('Normal reward: 1 Standard Key');
    expect(rewards.textContent).toContain('Greed reward: 2 Standard Keys');
    expect(rewards.textContent).toContain('Omni-Key awards: 1 Omni-Key');
    expect(rewards.textContent).toContain('Unverified legacy reward events: 3 (not Key counts)');
  });

  it('renders focusable week columns that start on Monday, with a numeric busiest-day legend', async () => {
    const base = analyticsFor(history);
    const analytics = {
      ...base,
      query: { ...base.query, now: new Date(2026, 7, 20, 12).getTime() },
      activityDays: [
        { date: '2026-08-18', attempts: 2 },
        { date: '2026-08-20', attempts: 3 },
      ],
    };
    const host = await mount(<SecondaryAnalyticsCharts analytics={analytics} />);
    const grid = host.querySelector('[aria-label="Roll attempts by local calendar day"]');
    const zero = host.querySelector('[aria-label="19 August 2026: 0 roll attempts"]');
    const active = host.querySelector('[aria-label="20 August 2026: 3 roll attempts"]');
    const monday = host.querySelector('[aria-label="17 August 2026: 0 roll attempts"]');

    // Each week column is a month label plus seven day cells, Monday first; the newest week may be partial.
    const columns = [...grid!.children];
    expect(columns.slice(0, -1).every(column => column.children.length === 8)).toBe(true);
    expect(columns.at(-1)!.children.length).toBeLessThanOrEqual(8);
    expect(monday?.parentElement?.children[1]).toBe(monday);
    expect(zero?.getAttribute('tabindex')).toBe('0');
    expect(zero?.getAttribute('role')).toBe('img');
    expect(zero?.getAttribute('aria-label')).not.toMatch(/success|failure/i);
    expect(active?.getAttribute('tabindex')).toBe('0');
    expect(active?.getAttribute('title')).toBe('20 August 2026: 3 rolls');
    expect(host.querySelector('[aria-label="Activity intensity legend"]')?.textContent).toContain('busiest day: 3 rolls');
  });

  it('anchors an old selection to its latest activity and navigates the full dated extent', async () => {
    const base = analyticsFor(history);
    const analytics = {
      ...base,
      query: { ...base.query, now: new Date(2026, 7, 20, 12).getTime() },
      summary: { ...base.summary, attempts: 5 },
      activityDays: [
        { date: '2024-01-01', attempts: 2 },
        { date: '2024-05-01', attempts: 3 },
      ],
    };
    const host = await mount(<SecondaryAnalyticsCharts analytics={analytics} />);
    const previous = host.querySelector<HTMLButtonElement>('[aria-label="Previous activity window"]')!;
    const next = host.querySelector<HTMLButtonElement>('[aria-label="Next activity window"]')!;

    expect(host.querySelector('[aria-label="1 May 2024: 3 roll attempts"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="1 January 2024: 2 roll attempts"]')).toBeNull();
    expect(host.textContent).toContain('3/5 selected dated attempts shown');
    expect(previous.disabled).toBe(false);
    expect(next.disabled).toBe(true);

    await act(async () => previous.click());

    expect(host.querySelector('[aria-label="1 January 2024: 2 roll attempts"]')).not.toBeNull();
    expect(host.textContent).toContain('2/5 selected dated attempts shown');
    expect(next.disabled).toBe(false);
  });

  it('renders all six notable facts with precise unavailable copy', async () => {
    const populated = await mount(<StatsChartsView analytics={analyticsFor(history)} />);
    const notableCard = populated.querySelector('article[aria-label="Notable moments"]');
    for (const label of [
      'Luckiest roll', 'Cruellest miss', 'Longest drought',
      'Hottest streak', 'Best activity', 'Busiest day',
    ]) expect(notableCard?.textContent).toContain(label);
    expect(notableCard?.textContent).toContain('Boss (Low)Won at 10.0% chance · 20 August 2026');
    expect(notableCard?.textContent).toContain('Quest (Novice)');
    expect(notableCard?.textContent).toContain('20 August 20264 roll attempts');

    const empty = await mount(<StatsChartsView analytics={analyticsFor([])} />);
    expect(empty.textContent).toContain('No scoreable genuine success in this selection');
    expect(empty.textContent).toContain('No scoreable underlying miss in this selection');
    expect(empty.textContent).toContain('No productive source in this selection');
    expect(empty.textContent).toContain('No active day in this selection');
    expect(empty.querySelector('article[aria-label="Notable moments"]')?.textContent).not.toContain('0%');
  });

  it('keeps a scoreable notable visible when its timestamp is invalid', async () => {
    const base = analyticsFor(history);
    const analytics = {
      ...base,
      notables: {
        ...base.notables,
        luckiestSuccess: { source: 'Imported roll', probability: 0.05, timestamp: Number.NaN, historyIndex: 12 },
      },
    };
    const host = await mount(<StatsChartsView analytics={analytics} />);

    expect(host.querySelector('article[aria-label="Notable moments"]')?.textContent)
      .toContain('Imported rollWon at 5.0% chance · date unavailable');
  });

  it('renders specific empty copy for every secondary visualization', async () => {
    const host = await mount(<StatsChartsView analytics={analyticsFor([])} />);

    expect(host.textContent).toContain('No recorded roll values match these filters.');
    expect(host.textContent).toContain('No scoreable probability bins match these filters.');
    expect(host.textContent).toContain('No reward events with valid local dates match these filters.');
    expect(host.textContent).toContain('No dated roll attempts match these filters.');
  });

  it('stays one column on small screens and only spans columns from the large breakpoint', async () => {
    const host = await mount(<StatsChartsView analytics={analyticsFor(history)} />);
    for (const grid of host.querySelectorAll('section[data-analytics-grid]')) {
      expect(grid.className).toContain('grid-cols-1');
      expect(grid.className).toContain('lg:grid-cols-2');
      expect(grid.className).toContain('xl:grid-cols-3');
    }
    const spanClasses = [...host.querySelectorAll('[class*="col-span"]')]
      .flatMap(element => element.className.split(/\s+/).filter(token => token.includes('col-span')));
    expect(spanClasses.length).toBeGreaterThan(0);
    expect(spanClasses.every(token => /^(lg|xl):col-span-/.test(token))).toBe(true);
    expect(host.querySelector('[data-primary-timeline]')?.className).toContain('lg:col-span-2');
  });

  it('disables every secondary chart animation when reduced motion is requested', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)', media: query, onchange: null,
        addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(),
        removeListener: vi.fn(), dispatchEvent: vi.fn(),
      })),
    });
    const host = await mount(<>
      <SecondaryAnalyticsCharts analytics={analyticsFor(history)} />
      <FairnessCharts analytics={analyticsFor(history)} />
    </>);
    const animatedMarks = [...host.querySelectorAll('[data-animation-active]')];

    expect(animatedMarks.length).toBeGreaterThan(0);
    expect(animatedMarks.every(mark => mark.getAttribute('data-animation-active') === 'false')).toBe(true);
  });
});
