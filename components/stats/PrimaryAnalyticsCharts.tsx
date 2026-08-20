import React, { useEffect, useMemo, useRef } from 'react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AnalyticsOutcome, FateAnalyticsResult } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';
import { downsampleTimeline } from './chartData';
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

export const AnalyticsTooltip: React.FC<AnalyticsTooltipProps> = ({ active, payload }) => {
  const datum = payload?.[0]?.payload;
  if (!active || !datum) return null;
  return (
    <div className="max-w-64 rounded border border-white/20 bg-[#171717] p-3 text-xs text-gray-300 shadow-xl">
      <p className="font-bold text-white">{datum.markLabel}</p>
      <p className="mt-1">Actual: {integer.format(datum.numerator)}/{integer.format(datum.denominator)}</p>
      <p>Expected: {datum.expectedValue === null ? 'not modelled' : datum.expectedValue.toFixed(2)}</p>
      {datum.deltaValue !== undefined && <p>Delta: {datum.deltaValue === null ? 'not modelled' : signed(datum.deltaValue)}</p>}
      <p>Probability coverage: {integer.format(datum.coverageNumerator)}/{integer.format(datum.coverageDenominator)} attempts</p>
      {datum.selectionCoverageNumerator !== undefined && datum.selectionCoverageDenominator !== undefined
        && <p>Selection coverage: {integer.format(datum.selectionCoverageNumerator)}/{integer.format(datum.selectionCoverageDenominator)} attempts</p>}
      {datum.sampleLabel && <p>Sample: {datum.sampleLabel}</p>}
    </div>
  );
};

const outcomeLabels: Record<AnalyticsOutcome, string> = {
  'normal-win': 'Normal win',
  'omni-win': 'Omni win',
  miss: 'Miss',
  pity: 'Pity',
};

const outcomePatterns: Record<AnalyticsOutcome, string> = {
  'normal-win': 'url(#outcome-normal)',
  'omni-win': 'url(#outcome-omni)',
  miss: 'url(#outcome-miss)',
  pity: 'url(#outcome-pity)',
};

const PatternDefinitions = () => (
  <defs>
    <pattern id="outcome-normal" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#34d399" /><path d="M0 8L8 0" stroke="#064e3b" strokeWidth="2" /></pattern>
    <pattern id="outcome-omni" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#a78bfa" /><circle cx="4" cy="4" r="1.5" fill="#4c1d95" /></pattern>
    <pattern id="outcome-miss" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f87171" /><path d="M0 0L8 8" stroke="#7f1d1d" strokeWidth="2" /></pattern>
    <pattern id="outcome-pity" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fbbf24" /><path d="M0 4H8" stroke="#78350f" strokeWidth="2" /></pattern>
    <pattern id="delta-positive" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#34d399" /><path d="M0 8L8 0" stroke="#064e3b" strokeWidth="2" /></pattern>
    <pattern id="delta-negative" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f87171" /><path d="M0 0L8 8" stroke="#7f1d1d" strokeWidth="2" /></pattern>
  </defs>
);

const StreakLegend = () => (
  <div className="mb-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wide text-gray-400" aria-label="Streak pattern legend">
    <span>W · Win / diagonal</span><span>M · Miss / crosshatch</span><span>P · Pity / stripes</span>
  </div>
);

const streakStyle: Record<'win' | 'miss' | 'pity', React.CSSProperties> = {
  win: { backgroundColor: '#065f46', backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,.28) 5px 7px)' },
  miss: { backgroundColor: '#991b1b', backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 5px, rgba(255,255,255,.2) 5px 7px), repeating-linear-gradient(135deg, transparent 0 5px, rgba(255,255,255,.2) 5px 7px)' },
  pity: { backgroundColor: '#92400e', backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,.28) 5px 7px)' },
};

export const PrimaryAnalyticsCharts: React.FC<PrimaryAnalyticsChartsProps> = ({ analytics }) => {
  const reducedMotion = useReducedMotion();
  const streakScrollRef = useRef<HTMLDivElement>(null);
  const { summary } = analytics;
  const animationActive = !reducedMotion;
  const coverage = `${summary.scoreableAttempts}/${summary.attempts}`;
  const sampledTimeline = useMemo(() => downsampleTimeline(analytics.timeline, 400), [analytics.timeline]);
  const timelineData = sampledTimeline.map(point => ({
    ...point,
    corridor: [point.lower, point.upper],
    markLabel: `Scoreable attempt ${point.index + 1}`,
    numerator: point.actual,
    denominator: point.index + 1,
    expectedValue: point.expected,
    coverageNumerator: point.index + 1,
    coverageDenominator: point.index + 1,
    selectionCoverageNumerator: summary.scoreableAttempts,
    selectionCoverageDenominator: summary.attempts,
  }));
  const pityPoints = timelineData.filter(point => point.outcome === 'pity');
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
  const histogramCoverage = Math.max(0, ...analytics.histogram.map(bucket => bucket.expectedCoverage));
  const observedRolls = analytics.histogram.reduce((total, bucket) => total + bucket.observed, 0);
  const histogramData = analytics.histogram.map(bucket => ({
    ...bucket,
    markLabel: `Rolls ${bucket.range}`,
    numerator: bucket.observed,
    denominator: summary.attempts,
    expectedValue: bucket.expected,
    coverageNumerator: bucket.expectedCoverage,
    coverageDenominator: summary.attempts,
  }));
  const categoryData = analytics.categories.map(category => ({
    ...category,
    markLabel: category.label,
    numerator: category.scoreableWins,
    denominator: category.scoreableAttempts,
    expectedValue: category.scoreableAttempts === 0 ? null : category.expectedWins,
    deltaValue: category.scoreableAttempts === 0 ? null : category.delta,
    coverageNumerator: category.scoreableAttempts,
    coverageDenominator: category.attempts,
  }));
  const outcomeSummary = outcomeData.map(item => `${item.name} ${item.count}`).join(' · ');

  useEffect(() => {
    const region = streakScrollRef.current;
    if (region) region.scrollLeft = region.scrollWidth;
  }, [analytics.streaks]);

  return (
    <section data-analytics-grid aria-label="Primary analytics charts" className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <div data-primary-timeline className="lg:col-span-2">
        <AnalyticsChartCard
          title="Observed vs expected"
          subtitle="Cumulative genuine RNG wins · scoreable cohort · ±2σ corridor"
          summary={`${summary.scoreableWins}/${summary.scoreableAttempts} scoreable wins versus ${summary.expectedWins.toFixed(2)} expected (${signed(summary.delta)} delta). Probability coverage: ${coverage} attempts. ${analytics.timeline.length} analytics points; ${timelineData.length} drawn.`}
          empty={analytics.timeline.length === 0 ? 'No scoreable attempts match these filters.' : undefined}
        >
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
            <ComposedChart data={timelineData} aria-label="Cumulative observed and expected wins chart">
              <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="index" stroke="#777" tick={{ fontSize: 10 }} tickFormatter={(value: number) => String(value + 1)} />
              <YAxis stroke="#777" tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip content={<AnalyticsTooltip />} />
              <Area name="±2σ expected corridor" dataKey="corridor" stroke="none" fill="#60a5fa" fillOpacity={0.12} isAnimationActive={animationActive} />
              <Line name="Expected wins — dashed" type="monotone" dataKey="expected" stroke="#93c5fd" strokeDasharray="7 4" dot={false} strokeWidth={2} isAnimationActive={animationActive} />
              <Line name="Actual wins — solid" type="monotone" dataKey="actual" stroke="#f8fafc" dot={false} strokeWidth={2} isAnimationActive={animationActive} />
              <Scatter name="Pity marker — diamond" data={pityPoints} dataKey="expected" fill="#fbbf24" shape="diamond" isAnimationActive={animationActive} />
            </ComposedChart>
          </ResponsiveContainer>
        </AnalyticsChartCard>
      </div>

      <AnalyticsChartCard
        title="Outcome composition"
        subtitle="Mutually exclusive outcomes · labels and patterns identify every slice"
        summary={`${outcomeSummary}. Actual outcomes: ${summary.attempts}/${summary.attempts} attempts; expected composition is not modelled. Probability coverage: ${coverage} attempts.`}
        empty={summary.attempts === 0 ? 'No attempt outcomes match these filters.' : undefined}
      >
        <div className="flex h-full flex-col">
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-wide text-gray-400" aria-label="Outcome pattern legend">
            {outcomeData.map(item => <span key={item.outcome}>{item.name}: {item.count}</span>)}
          </div>
          <div className="min-h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
              <PieChart aria-label="Outcome composition donut chart">
                <PatternDefinitions />
                <Tooltip content={<AnalyticsTooltip />} />
                <Pie data={outcomeData} dataKey="count" nameKey="name" innerRadius="48%" outerRadius="76%" paddingAngle={2} label isAnimationActive={animationActive}>
                  {outcomeData.map(item => <Cell key={item.outcome} fill={outcomePatterns[item.outcome]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Roll distribution"
        subtitle="Observed roll values in exact five-point buckets"
        summary={`${integer.format(observedRolls)} recorded roll values across ${integer.format(summary.attempts)} attempts. Expected occupancy coverage: ${integer.format(histogramCoverage)}/${integer.format(summary.attempts)} attempts.`}
        empty={observedRolls === 0 ? 'No recorded roll values match these filters.' : undefined}
      >
        <div className="flex h-full flex-col">
          <div className="mb-2 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <span>Observed · solid bars</span>
            <span>Expected occupancy · dashed line</span>
            <span>Expected occupancy coverage: {histogramCoverage}/{summary.attempts} attempts</span>
          </div>
          <div className="min-h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={210}>
              <ComposedChart data={histogramData} aria-label="Observed and expected roll distribution chart">
                <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="range" stroke="#777" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={64} interval={1} />
                <YAxis stroke="#777" tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip content={<AnalyticsTooltip />} />
                <Bar name="Observed rolls — solid" dataKey="observed" fill="#d6a84b" radius={[2, 2, 0, 0]} isAnimationActive={animationActive} />
                {histogramCoverage > 0 && <Line name="Expected occupancy — dashed" type="monotone" dataKey="expected" stroke="#93c5fd" strokeDasharray="6 4" dot={false} strokeWidth={2} isAnimationActive={animationActive} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Source performance"
        subtitle="Category delta from expectation · scoreable cohort"
        summary={`${analytics.categories.length} categories compare actual scoreable wins with expectation. Each category retains its attempt count, probability coverage, and sample label.`}
        empty={analytics.categories.length === 0 ? 'No category attempts match these filters.' : undefined}
      >
        <div className="flex h-full flex-col">
          <div className="mb-2 flex gap-4 text-[10px] font-bold uppercase tracking-wide text-gray-400"><span>+ Diagonal · above expected</span><span>− Crosshatch · below expected</span></div>
          <ul aria-label="Source performance data" className="sr-only">
            {categoryData.map(category => <li key={category.label}>{category.label}: actual {category.scoreableWins}/{category.scoreableAttempts}, expected {category.expectedValue === null ? 'not modelled' : category.expectedValue.toFixed(2)}, delta {category.deltaValue === null ? 'not modelled' : signed(category.deltaValue)}, {category.attempts} attempts, probability coverage {category.scoreableAttempts}/{category.attempts}, {category.sampleLabel}</li>)}
          </ul>
          <div className="min-h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={Math.max(220, categoryData.length * 34)}>
              <BarChart data={categoryData} layout="vertical" aria-label="Category performance diverging bar chart" margin={{ left: 16, right: 20 }}>
                <PatternDefinitions />
                <CartesianGrid stroke="#333" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" stroke="#777" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="label" width={112} stroke="#777" tick={{ fontSize: 10 }} />
                <ReferenceLine x={0} stroke="#cbd5e1" strokeWidth={1} />
                <Tooltip content={<AnalyticsTooltip />} />
                <Bar name="Delta from expected — patterned" dataKey="delta" radius={[0, 2, 2, 0]} isAnimationActive={animationActive}>
                  {categoryData.map(category => <Cell key={category.label} fill={category.delta >= 0 ? 'url(#delta-positive)' : 'url(#delta-negative)'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </AnalyticsChartCard>

      <div>
        <AnalyticsChartCard
          title="Streak timeline"
          subtitle="Chronological outcomes · pattern and letter identify every segment"
          summary={`${summary.attempts} attempts form ${analytics.streaks.length} streak segments. Current drought: ${summary.currentDrought}; longest drought: ${summary.longestDrought}; longest hot streak: ${summary.longestHotStreak}.`}
          empty={analytics.streaks.length === 0 ? 'No streak data matches these filters.' : undefined}
        >
          <StreakLegend />
          <div
            ref={streakScrollRef}
            role="region"
            tabIndex={0}
            aria-label="Chronological streak timeline, horizontally scrollable"
            className="w-full overflow-x-auto rounded border border-white/10 outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <div role="list" aria-label="Chronological streak segments" className="flex min-h-20 min-w-full w-max">
              {analytics.streaks.map((segment, index) => {
                const current = index === analytics.streaks.length - 1;
                const label = segment.outcome === 'win' ? 'Win' : segment.outcome === 'miss' ? 'Miss' : 'Pity';
                const segmentWidth = Math.min(320, Math.max(32, segment.length * 16));
                return (
                  <div
                    key={`${segment.startIndex}:${segment.outcome}`}
                    role="listitem"
                    aria-current={current ? 'true' : undefined}
                    aria-label={`${label}, ${segment.length} ${segment.length === 1 ? 'attempt' : 'attempts'}, rolls ${segment.startIndex + 1} to ${segment.endIndex + 1}${current ? ', current segment' : ''}`}
                    title={`${label}: ${segment.length} ${segment.length === 1 ? 'attempt' : 'attempts'}`}
                    className={`flex flex-none items-center justify-center border-r border-black/30 px-2 text-xs font-black text-white last:border-r-0 ${current ? 'relative z-10 ring-2 ring-inset ring-white' : ''}`}
                    style={{ ...streakStyle[segment.outcome], width: segmentWidth }}
                  >
                    <span aria-hidden="true">{label[0]}</span><span className="sr-only">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </AnalyticsChartCard>
      </div>
    </section>
  );
};
