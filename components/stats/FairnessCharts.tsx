import React from 'react';
import { BarChart3, Target } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { FateAnalyticsResult } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';
import { AnalyticsTooltip } from './PrimaryAnalyticsCharts';
import { CalibrationTooltip } from './SecondaryAnalyticsCharts';
import { BlockSwatch, Legend, LineSwatch } from './Legend';
import { plural } from './luck';
import { useReducedMotion } from './useReducedMotion';

const integer = new Intl.NumberFormat('en-GB');
const AXIS_TICK = { fontSize: 10, fill: '#8b8b8b' };
const GRID_STROKE = 'rgba(255,255,255,0.06)';

/** Checks on the dice themselves; neither chart feeds the luck score. */
export const FairnessCharts: React.FC<{ analytics: FateAnalyticsResult }> = ({ analytics }) => {
  const reducedMotion = useReducedMotion();
  const animationActive = !reducedMotion;
  const { summary } = analytics;
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
  const fairShare = observedRolls / Math.max(1, analytics.histogram.length);

  return (
    <section aria-label="Fairness checks" className="space-y-3">
      <div>
        <div className="flex items-center gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-400">Fairness checks</h3>
          <div aria-hidden="true" className="h-px flex-1 bg-white/10" />
        </div>
        <p className="mt-1 text-xs text-gray-500">Are the dice honest? These look at the rolls themselves and don't change your luck score.</p>
      </div>
      <div data-analytics-grid className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AnalyticsChartCard
          title="Roll spread"
          subtitle="Every roll value, grouped into 20 ranges of 5"
          summary={observedRolls === 0
            ? 'No roll values recorded.'
            : `With fair dice, each range gets about ${fairShare.toFixed(1)} of your ${plural(observedRolls, 'roll')}.`}
          icon={<BarChart3 size={15} />}
          legend={<Legend label="Roll spread legend" items={[
            { label: 'Your rolls', swatch: <BlockSwatch style={{ backgroundColor: '#d6a84b' }} /> },
            ...(histogramCoverage > 0 ? [{ label: 'Fair share', swatch: <LineSwatch color="#93c5fd" dashed /> }] : []),
          ]} />}
          empty={observedRolls === 0 ? 'No recorded roll values match these filters.' : undefined}
        >
          <p className="sr-only">Expected occupancy coverage: {histogramCoverage}/{summary.attempts} attempts. {integer.format(observedRolls)} recorded roll values across {integer.format(summary.attempts)} attempts.</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={histogramData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="12%" aria-label="Observed and expected roll distribution chart">
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="max" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#333' }} interval={1} tickFormatter={(value: number) => String(Math.round(value))} />
                <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
                <Tooltip content={<AnalyticsTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar name="Observed rolls — solid" dataKey="observed" fill="#d6a84b" fillOpacity={0.85} radius={[3, 3, 0, 0]} isAnimationActive={animationActive} />
                {histogramCoverage > 0 && <Line name="Expected occupancy — dashed" type="monotone" dataKey="expected" stroke="#93c5fd" strokeDasharray="6 4" dot={false} strokeWidth={1.5} isAnimationActive={animationActive} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsChartCard>

        <AnalyticsChartCard
          title="Odds check"
          subtitle="When the odds said a chance, how often did you actually win?"
          summary={analytics.calibration.length === 0
            ? 'No rolls with known odds yet.'
            : 'If the odds are honest, the gold line follows the dashed one. Ranges with few rolls wobble more.'}
          icon={<Target size={15} />}
          legend={<Legend label="Odds check legend" items={[
            { label: 'How often you won', swatch: <LineSwatch color="#fbbf24" /> },
            { label: 'What the odds said', swatch: <LineSwatch color="#93c5fd" dashed /> },
          ]} />}
          empty={analytics.calibration.length === 0 ? 'No scoreable probability bins match these filters.' : undefined}
        >
          <ul aria-label="Probability calibration sample counts" className="sr-only">
            {analytics.calibration.map(bin => <li key={bin.range}>{bin.range}: {bin.attempts} {bin.attempts === 1 ? 'attempt' : 'attempts'}; mean predicted {bin.meanPredictedRate.toFixed(1)}%; actual genuine-win rate {bin.actualRate.toFixed(1)}%</li>)}
          </ul>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analytics.calibration} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} aria-label="Predicted and actual probability calibration chart">
                <CartesianGrid stroke={GRID_STROKE} />
                <XAxis dataKey="range" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#333' }} />
                <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} tickLine={false} axisLine={false} width={48} />
                <Tooltip content={<CalibrationTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.2)' }} />
                <Line name="Mean predicted rate (%) — dashed" type="monotone" dataKey="meanPredictedRate" stroke="#93c5fd" strokeDasharray="6 4" strokeWidth={1.5} dot={false} isAnimationActive={animationActive} />
                <Line name="Actual genuine-win rate (%) — solid" type="monotone" dataKey="actualRate" stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3, fill: '#fbbf24', stroke: '#1a1a1a', strokeWidth: 1.5 }} isAnimationActive={animationActive} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsChartCard>
      </div>
    </section>
  );
};
