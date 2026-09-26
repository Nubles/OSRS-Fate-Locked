import React, { useEffect, useMemo, useRef } from 'react';
import { Activity, Flame, PieChart as PieIcon, TrendingUp } from 'lucide-react';
import {
  Area,
  Cell,
  ComposedChart,
  CartesianGrid,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsOutcome, FateAnalyticsResult, StreakSegment } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';
import { downsampleTimeline } from './chartData';
import { BlockSwatch, DiamondSwatch, Legend, LineSwatch, OUTCOME_STYLE } from './Legend';
import { plural, signedFixed } from './luck';
import { useReducedMotion } from './useReducedMotion';

interface PrimaryAnalyticsChartsProps {
  analytics: FateAnalyticsResult;
}

interface TooltipDatum {
  markLabel: string;
  numerator: number;
  denominator: number;
  expectedValue: number | null;
  deltaValue?: number | null;
  coverageNumerator: number;
  coverageDenominator: number;
  selectionCoverageNumerator?: number;
  selectionCoverageDenominator?: number;
  sampleLabel?: string;
}

interface AnalyticsTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: TooltipDatum }>;
}

const integer = new Intl.NumberFormat('en-GB');
const percent = (numerator: number, denominator: number): string => denominator === 0
  ? '0.0%'
  : `${(numerator / denominator * 100).toFixed(1)}%`;
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
const AXIS_TICK = { fontSize: 10, fill: '#8b8b8b' };
const GRID_STROKE = 'rgba(255,255,255,0.06)';

export const AnalyticsTooltip: React.FC<AnalyticsTooltipProps> = ({ active, payload }) => {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="max-w-64 rounded-lg border border-white/15 bg-[#141414]/95 p-3 text-xs text-gray-300 shadow-xl backdrop-blur">
      <p className="font-bold text-white">{datum.markLabel}</p>
      <p className="mt-1">Actual: {integer.format(datum.numerator)}/{integer.format(datum.denominator)}</p>
      <p>Expected: {datum.expectedValue === null ? 'not modelled' : datum.expectedValue.toFixed(2)}</p>
      {datum.deltaValue !== undefined && <p>Delta: {datum.deltaValue === null ? 'not modelled' : signed(datum.deltaValue)}</p>}
      <p className="text-gray-500">Probability coverage: {integer.format(datum.coverageNumerator)}/{integer.format(datum.coverageDenominator)} attempts</p>
      {datum.selectionCoverageNumerator !== undefined && datum.selectionCoverageDenominator !== undefined
        && <p className="text-gray-500">Selection coverage: {integer.format(datum.selectionCoverageNumerator)}/{integer.format(datum.selectionCoverageDenominator)} attempts</p>}
      {datum.sampleLabel && <p className="text-gray-500">Sample: {datum.sampleLabel}</p>}
    </div>
  );
};

const outcomeLabels: Record<AnalyticsOutcome, string> = {
  'normal-win': 'Won a key',
  'omni-win': 'Won an Omni-Key',
  miss: 'No key',
  pity: 'Pity key',
};

const outcomeSwatch: Record<AnalyticsOutcome, React.CSSProperties> = {
  'normal-win': OUTCOME_STYLE.win,
  'omni-win': OUTCOME_STYLE.omni,
  miss: OUTCOME_STYLE.miss,
  pity: OUTCOME_STYLE.pity,
};

const outcomePatterns: Record<AnalyticsOutcome, string> = {
  'normal-win': 'url(#outcome-normal)',
  'omni-win': 'url(#outcome-omni)',
  miss: 'url(#outcome-miss)',
  pity: 'url(#outcome-pity)',
};

// Recharts renders raw SVG children such as <defs> but drops custom components,
// so the patterns are a plain element rather than a component.
const patternDefinitions = (
  <defs>
    <pattern id="outcome-normal" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#34d399" /><path d="M0 6L6 0" stroke="#064e3b" strokeOpacity="0.45" strokeWidth="1.5" /></pattern>
    <pattern id="outcome-omni" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a78bfa" /><circle cx="3" cy="3" r="1.1" fill="#4c1d95" fillOpacity="0.7" /></pattern>
    <pattern id="outcome-miss" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#52525b" /></pattern>
    <pattern id="outcome-pity" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fbbf24" /><path d="M0 3H6" stroke="#78350f" strokeOpacity="0.5" strokeWidth="1.5" /></pattern>
  </defs>
);

/** Draws a diamond only where a roll ended in pity; every other point stays empty. */
const PityDiamond: React.FC<{ cx?: number; cy?: number; value?: number | null }> = ({ cx, cy, value }) => {
  if (value === null || value === undefined || cx === undefined || cy === undefined || Number.isNaN(cy)) return null;
  return <path d={`M${cx} ${cy - 6}L${cx + 6} ${cy}L${cx} ${cy + 6}L${cx - 6} ${cy}Z`} fill="#fbbf24" stroke="#141414" strokeWidth={1.5} />;
};

const streakSegmentStyle: Record<StreakSegment['outcome'], React.CSSProperties> = {
  win: OUTCOME_STYLE.win,
  miss: OUTCOME_STYLE.miss,
  pity: OUTCOME_STYLE.pity,
};
const streakLabel: Record<StreakSegment['outcome'], string> = { win: 'Win', miss: 'Miss', pity: 'Pity' };

/** Expands streak segments into the last `count` single rolls, oldest first. */
const recentRolls = (streaks: StreakSegment[], count: number): Array<StreakSegment['outcome']> => {
  const rolls: Array<StreakSegment['outcome']> = [];
  for (let index = streaks.length - 1; index >= 0 && rolls.length < count; index -= 1) {
    const segment = streaks[index];
    for (let step = 0; step < segment.length && rolls.length < count; step += 1) rolls.push(segment.outcome);
  }
  return rolls.reverse();
};

export const PrimaryAnalyticsCharts: React.FC<PrimaryAnalyticsChartsProps> = ({ analytics }) => {
  const reducedMotion = useReducedMotion();
  const streakScrollRef = useRef<HTMLDivElement>(null);
  const { summary } = analytics;
  const animationActive = !reducedMotion;
  const partlyScoreable = summary.scoreableAttempts < summary.attempts;
  const sampledTimeline = useMemo(() => downsampleTimeline(analytics.timeline, 400), [analytics.timeline]);
  const timelineData = sampledTimeline.map(point => ({
    ...point,
    corridor: [point.lower, point.upper],
    pityMarker: point.outcome === 'pity' ? point.actual : null,
    markLabel: `Roll ${point.index + 1}${partlyScoreable ? ' with known odds' : ''}`,
    numerator: point.actual,
    denominator: point.index + 1,
    expectedValue: point.expected,
    coverageNumerator: point.index + 1,
    coverageDenominator: point.index + 1,
    selectionCoverageNumerator: summary.scoreableAttempts,
    selectionCoverageDenominator: summary.attempts,
  }));
  const pityDrawn = timelineData.some(point => point.pityMarker !== null);
  const outcomeData = analytics.outcomeComposition.map(item => ({
    ...item,
    name: outcomeLabels[item.outcome],
    markLabel: outcomeLabels[item.outcome],
    numerator: item.count,
    denominator: summary.attempts,
    expectedValue: null,
    coverageNumerator: summary.scoreableAttempts,
    coverageDenominator: summary.attempts,
  }));
  const wins = analytics.outcomeComposition
    .filter(item => item.outcome === 'normal-win' || item.outcome === 'omni-win')
    .reduce((total, item) => total + item.count, 0);
  const categoryRows = useMemo(
    () => [...analytics.categories].sort((left, right) => right.delta - left.delta || right.attempts - left.attempts),
    [analytics.categories],
  );
  const maxDelta = Math.max(0.5, ...categoryRows.map(row => row.scoreableAttempts === 0 ? 0 : Math.abs(row.delta)));
  const ahead = categoryRows.filter(row => row.scoreableAttempts > 0 && row.delta > 0);
  const behind = categoryRows.filter(row => row.scoreableAttempts > 0 && row.delta < 0);
  const luckiest = ahead[0];
  const unluckiest = behind[behind.length - 1];
  const activityParts = [
    luckiest ? `luckiest at ${luckiest.label} (${signedFixed(luckiest.delta, 1)})` : null,
    unluckiest ? `unluckiest at ${unluckiest.label} (${signedFixed(unluckiest.delta, 1)})` : null,
  ].filter((part): part is string => part !== null).join('; ');
  const activitySummary = activityParts
    ? `${activityParts[0].toUpperCase()}${activityParts.slice(1)}.`
    : 'No activity is ahead of or behind the odds yet.';
  const lastRolls = useMemo(() => recentRolls(analytics.streaks, 40), [analytics.streaks]);
  const gap = Math.abs(summary.delta);
  const timelineSummary = summary.scoreableAttempts === 0
    ? 'No rolls with known odds to compare.'
    : gap < 0.05
      ? `After ${plural(summary.scoreableAttempts, 'roll')}, you are right on what Fate expected.`
      : `After ${plural(summary.scoreableAttempts, 'roll')}, you are ${gap.toFixed(1)} ${gap === 1 ? 'win' : 'wins'} ${summary.delta > 0 ? 'ahead of' : 'behind'} what Fate expected.`;

  useEffect(() => {
    const region = streakScrollRef.current;
    if (region) region.scrollLeft = region.scrollWidth;
  }, [analytics.streaks]);

  return (
    <section data-analytics-grid aria-label="Primary analytics charts" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div data-primary-timeline className="lg:col-span-2">
        <AnalyticsChartCard
          title="Luck over time"
          subtitle={`Your wins against what the odds expected, roll by roll${partlyScoreable ? ' (rolls with known odds)' : ''}`}
          summary={timelineSummary}
          icon={<TrendingUp size={15} />}
          legend={<Legend label="Luck over time legend" items={[
            { label: 'Your wins', swatch: <LineSwatch color="#fbbf24" /> },
            { label: 'Expected', swatch: <LineSwatch color="#93c5fd" dashed /> },
            { label: 'Normal range', swatch: <BlockSwatch style={{ backgroundColor: 'rgba(96,165,250,0.25)' }} /> },
            ...(pityDrawn ? [{ label: 'Pity key', swatch: <DiamondSwatch color="#fbbf24" /> }] : []),
          ]} />}
          empty={analytics.timeline.length === 0 ? 'No scoreable attempts match these filters.' : undefined}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={timelineData} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} aria-label="Cumulative observed and expected wins chart">
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="index" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#333' }} minTickGap={32} tickFormatter={(value: number) => String(value + 1)} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                <Tooltip content={<AnalyticsTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Area name="±2σ expected corridor" dataKey="corridor" stroke="none" fill="#60a5fa" fillOpacity={0.12} isAnimationActive={animationActive} />
                <Line name="Expected wins — dashed" type="monotone" dataKey="expected" stroke="#93c5fd" strokeDasharray="6 4" dot={false} strokeWidth={1.5} isAnimationActive={animationActive} />
                <Line name="Actual wins — solid" type="monotone" dataKey="actual" stroke="#fbbf24" dot={false} strokeWidth={2.5} isAnimationActive={animationActive} />
                {pityDrawn && <Line name="Pity marker — diamond" dataKey="pityMarker" stroke="none" dot={<PityDiamond />} activeDot={false} legendType="diamond" isAnimationActive={animationActive} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsChartCard>
      </div>

      <AnalyticsChartCard
        title="How your rolls ended"
        subtitle="Every roll in this selection, by result"
        summary={summary.attempts === 0
          ? 'No rolls yet.'
          : `${percent(wins, summary.attempts)} of your rolls won a key${summary.pityInterventions > 0 ? `, and Fate stepped in ${plural(summary.pityInterventions, 'time')}` : ''}.`}
        icon={<PieIcon size={15} />}
        empty={summary.attempts === 0 ? 'No attempt outcomes match these filters.' : undefined}
      >
        <div className="flex flex-1 flex-col items-center gap-5 sm:flex-row lg:flex-col 2xl:flex-row">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart aria-label="Outcome composition donut chart">
                {patternDefinitions}
                <Tooltip content={<AnalyticsTooltip />} />
                <Pie data={outcomeData.filter(item => item.count > 0)} dataKey="count" nameKey="name" innerRadius="66%" outerRadius="96%" paddingAngle={1.5} stroke="none" startAngle={90} endAngle={-270} isAnimationActive={animationActive}>
                  {outcomeData.filter(item => item.count > 0).map(item => <Cell key={item.outcome} fill={outcomePatterns[item.outcome]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black tabular-nums text-gray-50">{percent(wins, summary.attempts)}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-500">won a key</span>
            </div>
          </div>
          <ul aria-label="Outcome pattern legend" className="w-full flex-1 space-y-2.5">
            {outcomeData.map(item => (
              <li key={item.outcome} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-gray-300"><BlockSwatch style={outcomeSwatch[item.outcome]} />{item.name}</span>
                <span className="font-mono tabular-nums text-gray-100">{integer.format(item.count)}<span className="ml-2 inline-block w-12 text-right text-gray-500">{percent(item.count, summary.attempts)}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Luck by activity"
        subtitle="Wins above or below the odds, per kind of activity"
        summary={activitySummary}
        icon={<Activity size={15} />}
        empty={analytics.categories.length === 0 ? 'No category attempts match these filters.' : undefined}
      >
        <ul aria-label="Source performance data" className="space-y-2.5">
          {categoryRows.map(row => {
            const modelled = row.scoreableAttempts > 0;
            const positive = row.delta >= 0;
            const width = modelled ? (Math.abs(row.delta) / maxDelta) * 50 : 0;
            const limited = row.sampleLabel === 'Limited sample';
            return (
              <li
                key={row.label}
                title={modelled ? `${row.label}: ${row.scoreableWins} wins, ${row.expectedWins.toFixed(2)} expected, from ${row.scoreableAttempts} rolls` : `${row.label}: no rolls with known odds`}
                className="grid grid-cols-[minmax(0,7.5rem)_1fr_3rem] items-center gap-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-200">{row.label}</p>
                  <p className="text-[10px] text-gray-500">{plural(row.attempts, 'roll')}{limited ? ' · small sample' : ''}</p>
                </div>
                <div className={`relative h-3 rounded-full bg-white/[0.04] ${limited ? 'opacity-50' : ''}`}>
                  <div aria-hidden="true" className="absolute -inset-y-1 left-1/2 w-px bg-white/25" />
                  {modelled && width > 0 && (
                    <div
                      aria-hidden="true"
                      className={`absolute inset-y-0 ${positive ? 'left-1/2 rounded-r-full' : 'right-1/2 rounded-l-full'}`}
                      style={{ width: `${width}%`, ...(positive ? OUTCOME_STYLE.win : { backgroundColor: '#fb7185' }) }}
                    />
                  )}
                </div>
                <p className={`text-right font-mono text-xs font-bold ${!modelled ? 'text-gray-500' : positive ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {modelled ? signedFixed(row.delta, 1) : 'n/a'}
                </p>
                <span className="sr-only">
                  {row.label}: actual {row.scoreableWins}/{row.scoreableAttempts}, expected {modelled ? row.expectedWins.toFixed(2) : 'not modelled'}, delta {modelled ? signed(row.delta) : 'not modelled'}, {row.attempts} attempts, probability coverage {row.scoreableAttempts}/{row.attempts}, {row.sampleLabel}
                </span>
              </li>
            );
          })}
        </ul>
        <div aria-hidden="true" className="mt-3 grid grid-cols-[minmax(0,7.5rem)_1fr_3rem] gap-3 text-[10px] text-gray-500">
          <span />
          <span className="flex justify-between"><span>← behind the odds</span><span>ahead →</span></span>
          <span />
        </div>
      </AnalyticsChartCard>

      <div className="lg:col-span-2">
        <AnalyticsChartCard
          title="Streaks"
          subtitle="Wins and dry spells in the order they happened"
          summary={analytics.streaks.length === 0
            ? 'No streaks yet.'
            : `Your hottest streak was ${plural(summary.longestHotStreak, 'win')} in a row; your longest drought was ${plural(summary.longestDrought, 'miss', 'misses')}.`}
          icon={<Flame size={15} />}
          legend={<Legend label="Streak pattern legend" items={[
            { label: 'Win', swatch: <BlockSwatch style={OUTCOME_STYLE.win} /> },
            { label: 'Miss', swatch: <BlockSwatch style={OUTCOME_STYLE.miss} /> },
            { label: 'Pity', swatch: <BlockSwatch style={OUTCOME_STYLE.pity} /> },
          ]} />}
          empty={analytics.streaks.length === 0 ? 'No streak data matches these filters.' : undefined}
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Hottest streak', value: summary.longestHotStreak, unit: 'wins', tone: 'text-emerald-300' },
              { label: 'Longest drought', value: summary.longestDrought, unit: 'misses', tone: 'text-rose-300' },
              { label: 'Current drought', value: summary.currentDrought, unit: 'misses', tone: summary.currentDrought > 0 ? 'text-amber-200' : 'text-gray-200' },
            ].map(stat => (
              <div key={stat.label} className="rounded-lg bg-black/20 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{stat.label}</p>
                <p className={`mt-0.5 text-xl font-black tabular-nums ${stat.tone}`}>{stat.value}<span className="ml-1 text-[11px] font-medium text-gray-500">{stat.unit}</span></p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Last {plural(lastRolls.length, 'roll')}</p>
          <div role="list" aria-label="Most recent rolls, oldest first" className="mt-1.5 grid grid-cols-[repeat(20,minmax(0,1.25rem))] gap-1 sm:grid-cols-[repeat(40,minmax(0,1.25rem))]">
            {lastRolls.map((outcome, index) => (
              <span
                key={index}
                role="listitem"
                aria-label={streakLabel[outcome]}
                title={streakLabel[outcome]}
                className={`aspect-square rounded-[4px] ${index === lastRolls.length - 1 ? 'ring-2 ring-white/80 ring-offset-1 ring-offset-[#1a1a1a]' : ''}`}
                style={streakSegmentStyle[outcome]}
              />
            ))}
          </div>

          <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Whole selection</p>
          <div
            ref={streakScrollRef}
            role="region"
            tabIndex={0}
            aria-label="Chronological streak timeline, horizontally scrollable"
            className="custom-scrollbar mt-1.5 w-full overflow-x-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <div role="list" aria-label="Chronological streak segments" className="flex h-7 min-w-full w-max gap-px">
              {analytics.streaks.map((segment, index) => {
                const current = index === analytics.streaks.length - 1;
                const label = streakLabel[segment.outcome];
                const segmentWidth = Math.min(160, Math.max(6, segment.length * 6));
                return (
                  <div
                    key={`${segment.startIndex}:${segment.outcome}`}
                    role="listitem"
                    aria-current={current ? 'true' : undefined}
                    aria-label={`${label}, ${segment.length} ${segment.length === 1 ? 'attempt' : 'attempts'}, rolls ${segment.startIndex + 1} to ${segment.endIndex + 1}${current ? ', current segment' : ''}`}
                    title={`${label}: ${segment.length} ${segment.length === 1 ? 'roll' : 'rolls'} in a row`}
                    className={`flex flex-none items-center justify-center text-[10px] font-black text-white/90 first:rounded-l-md last:rounded-r-md ${current ? 'relative z-10 ring-2 ring-inset ring-white' : ''}`}
                    style={{ ...streakSegmentStyle[segment.outcome], width: segmentWidth }}
                  >
                    {segmentWidth >= 24 && <span aria-hidden="true">{segment.length}</span>}
                    <span className="sr-only">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div aria-hidden="true" className="mt-1 flex justify-between text-[10px] text-gray-600"><span>oldest</span><span>latest</span></div>
        </AnalyticsChartCard>
      </div>
    </section>
  );
};
