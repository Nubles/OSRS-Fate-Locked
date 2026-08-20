import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CalibrationBin, FateAnalyticsResult, KeyAcquisitionPoint } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';
import { buildCalendarGrid } from './chartData';
import { useReducedMotion } from './useReducedMotion';

interface SecondaryAnalyticsChartsProps {
  analytics: FateAnalyticsResult;
}

interface CalibrationTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: CalibrationBin }>;
}

interface KeyAcquisitionTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: KeyAcquisitionPoint }>;
}

const integer = new Intl.NumberFormat('en-GB');
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const parseLocalDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatLocalDate = (value: string): string => {
  const date = parseLocalDate(value);
  return date ? longDate.format(date) : value;
};

const localDateForTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return [
    String(date.getFullYear()).padStart(4, '0'),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
};

const shiftLocalDate = (value: string, days: number): string => {
  const date = parseLocalDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return localDateForTimestamp(date.getTime());
};

export const CalibrationTooltip: React.FC<CalibrationTooltipProps> = ({ active, payload }) => {
  const bin = payload?.[0]?.payload;
  if (!active || !bin) return null;
  return (
    <div className="rounded border border-white/20 bg-[#171717] p-3 text-xs text-gray-300 shadow-xl">
      <p className="font-bold text-white">Predicted chance {bin.range}</p>
      <p className="mt-1">Attempts in bin: {integer.format(bin.attempts)}</p>
      <p>Mean predicted rate: {bin.meanPredictedRate.toFixed(1)}%</p>
      <p>Actual genuine-win rate: {bin.actualRate.toFixed(1)}%</p>
    </div>
  );
};

export const KeyAcquisitionTooltip: React.FC<KeyAcquisitionTooltipProps> = ({ active, payload }) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  const unit = (value: number, singular: string, plural = `${singular}s`) => `${integer.format(value)} ${value === 1 ? singular : plural}`;
  return (
    <div className="rounded border border-white/20 bg-[#171717] p-3 text-xs text-gray-300 shadow-xl">
      <p className="font-bold text-white">{formatLocalDate(point.date)}</p>
      <p className="mt-1">Normal reward: {unit(point.normalStandard, 'Standard Key')}</p>
      <p>Greed reward: {unit(point.greedStandard, 'Standard Key')}</p>
      <p>Pity reward: {unit(point.pityStandard, 'Standard Key')}</p>
      <p>Omni-derived reward: {unit(point.omniStandard, 'Standard Key')}</p>
      <p>Omni-Key awards: {unit(point.omniKeys, 'Omni-Key')}</p>
      <p>Unverified legacy reward events: {integer.format(point.unverifiedRewardEvents)} (not Key counts)</p>
    </div>
  );
};

const RewardPatterns = () => (
  <defs>
    <pattern id="reward-normal" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#34d399" /><path d="M0 8L8 0" stroke="#064e3b" strokeWidth="2" /></pattern>
    <pattern id="reward-greed" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#fbbf24" /><path d="M0 2H8M0 6H8" stroke="#78350f" strokeWidth="2" /></pattern>
    <pattern id="reward-pity" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#f87171" /><path d="M0 0L8 8M8 0L0 8" stroke="#7f1d1d" strokeWidth="1.5" /></pattern>
    <pattern id="reward-omni" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#a78bfa" /><circle cx="4" cy="4" r="1.5" fill="#4c1d95" /></pattern>
  </defs>
);

const activityStyle = (attempts: number, maximum: number): React.CSSProperties => {
  if (attempts === 0) return { backgroundColor: '#262626', borderStyle: 'solid' };
  const intensity = maximum === 0 ? 0 : attempts / maximum;
  if (intensity <= 0.33) return { backgroundColor: '#854d0e', borderStyle: 'dotted' };
  if (intensity <= 0.66) return { backgroundColor: '#a16207', borderStyle: 'dashed' };
  return { backgroundColor: '#ca8a04', borderStyle: 'double' };
};

export const SecondaryAnalyticsCharts: React.FC<SecondaryAnalyticsChartsProps> = ({ analytics }) => {
  const reducedMotion = useReducedMotion();
  const animationActive = !reducedMotion;
  const standardKeys = analytics.keyAcquisition.reduce((total, point) => total
    + point.normalStandard + point.greedStandard + point.pityStandard + point.omniStandard, 0);
  const omniKeys = analytics.keyAcquisition.reduce((total, point) => total + point.omniKeys, 0);
  const unverifiedEvents = analytics.keyAcquisition.reduce((total, point) => total + point.unverifiedRewardEvents, 0);
  const queryCalendarEnd = localDateForTimestamp(analytics.query.now);
  const { selectedFirstDate, selectedLastDate } = useMemo(() => {
    let first: string | null = null;
    let last: string | null = null;
    for (const day of analytics.activityDays) {
      if (first === null || day.date < first) first = day.date;
      if (last === null || day.date > last) last = day.date;
    }
    return { selectedFirstDate: first, selectedLastDate: last };
  }, [analytics.activityDays]);
  const [calendarEnd, setCalendarEnd] = useState(selectedLastDate ?? queryCalendarEnd);
  useEffect(() => {
    setCalendarEnd(selectedLastDate ?? queryCalendarEnd);
  }, [queryCalendarEnd, selectedFirstDate, selectedLastDate]);
  const calendar = useMemo(
    () => buildCalendarGrid(analytics.activityDays, calendarEnd, 91),
    [analytics.activityDays, calendarEnd],
  );
  const calendarStart = calendar[0]?.date ?? calendarEnd;
  const selectedDatedAttempts = analytics.activityDays.reduce((total, day) => total + day.attempts, 0);
  const includedAttempts = calendar.reduce((total, day) => total + day.attempts, 0);
  const hasPreviousWindow = selectedFirstDate !== null && selectedFirstDate < calendarStart;
  const hasNextWindow = selectedLastDate !== null && selectedLastDate > calendarEnd;
  const maximumAttempts = Math.max(0, ...calendar.map(day => day.attempts));
  const legendStops = [...new Set([
    0,
    Math.max(1, Math.ceil(maximumAttempts / 3)),
    Math.max(1, Math.ceil(maximumAttempts * 2 / 3)),
    maximumAttempts,
  ])].sort((a, b) => a - b);

  return (
    <section data-analytics-grid aria-label="Secondary analytics charts" className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <AnalyticsChartCard
        title="Probability calibration"
        subtitle="Predicted chance against actual genuine-win rate · shared 0–100% scale"
        summary={`${integer.format(analytics.summary.scoreableAttempts)} scoreable attempts form ${integer.format(analytics.calibration.length)} non-empty probability bins. Each bin retains its attempt count.`}
        empty={analytics.calibration.length === 0 ? 'No scoreable probability bins match these filters.' : undefined}
      >
        <div className="flex h-full flex-col">
          <div className="mb-2 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            <span>Mean predicted rate (%) — dashed</span><span>Actual genuine-win rate (%) — solid</span>
          </div>
          <ul aria-label="Probability calibration sample counts" className="sr-only">
            {analytics.calibration.map(bin => <li key={bin.range}>{bin.range}: {bin.attempts} {bin.attempts === 1 ? 'attempt' : 'attempts'}; mean predicted {bin.meanPredictedRate.toFixed(1)}%; actual genuine-win rate {bin.actualRate.toFixed(1)}%</li>)}
          </ul>
          <div className="min-h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <ComposedChart data={analytics.calibration} aria-label="Predicted and actual probability calibration chart">
                <CartesianGrid stroke="#333" strokeDasharray="3 3" />
                <XAxis dataKey="range" stroke="#777" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} unit="%" stroke="#777" tick={{ fontSize: 10 }} />
                <Tooltip content={<CalibrationTooltip />} />
                <Line name="Mean predicted rate (%) — dashed" type="monotone" dataKey="meanPredictedRate" stroke="#93c5fd" strokeDasharray="7 4" strokeWidth={2} isAnimationActive={animationActive} />
                <Line name="Actual genuine-win rate (%) — solid" type="monotone" dataKey="actualRate" stroke="#f8fafc" strokeWidth={2} isAnimationActive={animationActive} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Key acquisition"
        subtitle="Verified rewards by local day · Standard Keys and Omni-Keys use separate units"
        summary={`${integer.format(standardKeys)} confirmed Standard Keys and ${integer.format(omniKeys)} Omni-Keys across ${integer.format(analytics.keyAcquisition.length)} dated reward points. ${integer.format(unverifiedEvents)} legacy reward events remain unverified.`}
        empty={analytics.keyAcquisition.length === 0 ? 'No reward events with valid local dates match these filters.' : undefined}
      >
        <div className="flex h-full flex-col">
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-wide text-gray-400" aria-label="Key acquisition series legend">
            <span>Normal / diagonal · Standard Keys</span><span>Greed / stripes · Standard Keys</span>
            <span>Pity / crosshatch · Standard Keys</span><span>Omni-derived / dots · Standard Keys</span>
            <span>Omni-Key awards / adjacent solid bar · separate count</span>
          </div>
          <p className="mb-2 text-[11px] text-amber-300">{integer.format(unverifiedEvents)} unverified legacy reward {unverifiedEvents === 1 ? 'event' : 'events'} — not Key counts</p>
          <ul aria-label="Key acquisition data" className="sr-only">
            {analytics.keyAcquisition.map(point => <li key={point.date}>{formatLocalDate(point.date)}: normal {point.normalStandard} Standard Keys; Greed {point.greedStandard} Standard Keys; pity {point.pityStandard} Standard Keys; Omni-derived {point.omniStandard} Standard Keys; {point.omniKeys} Omni-Keys; {point.unverifiedRewardEvents} unverified legacy reward events, not Key counts</li>)}
          </ul>
          <div className="min-h-48 flex-1">
            <ResponsiveContainer width="100%" height="100%" minHeight={220}>
              <BarChart data={analytics.keyAcquisition} aria-label="Verified Standard Key and separate Omni-Key acquisition chart">
                <RewardPatterns />
                <CartesianGrid stroke="#333" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#777" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} stroke="#777" tick={{ fontSize: 10 }} />
                <Tooltip content={<KeyAcquisitionTooltip />} />
                <Bar name="Normal reward — Standard Keys" dataKey="normalStandard" stackId="standard-keys" fill="url(#reward-normal)" isAnimationActive={animationActive} />
                <Bar name="Greed reward — Standard Keys" dataKey="greedStandard" stackId="standard-keys" fill="url(#reward-greed)" isAnimationActive={animationActive} />
                <Bar name="Pity reward — Standard Keys" dataKey="pityStandard" stackId="standard-keys" fill="url(#reward-pity)" isAnimationActive={animationActive} />
                <Bar name="Omni-derived reward — Standard Keys" dataKey="omniStandard" stackId="standard-keys" fill="url(#reward-omni)" isAnimationActive={animationActive} />
                <Bar name="Omni-Key awards — separate count" dataKey="omniKeys" fill="#f8fafc" radius={[2, 2, 0, 0]} isAnimationActive={animationActive} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </AnalyticsChartCard>

      <AnalyticsChartCard
        title="Activity calendar"
        subtitle="Roll attempts per local calendar day · outcome-independent · 91-day windows"
        summary={`${integer.format(includedAttempts)}/${integer.format(selectedDatedAttempts)} selected dated attempts shown across ${formatLocalDate(calendarStart)}–${formatLocalDate(calendarEnd)}. The full selection has ${integer.format(analytics.activityDays.length)} active local days.`}
        empty={analytics.activityDays.length === 0 ? 'No dated roll attempts match these filters.' : undefined}
      >
        <div className="flex h-full flex-col">
          <div className="mb-3 flex items-center justify-between gap-3">
            <button
              type="button"
              aria-label="Previous activity window"
              disabled={!hasPreviousWindow}
              onClick={() => setCalendarEnd(shiftLocalDate(calendarStart, -1))}
              className="rounded border border-white/15 px-3 py-1.5 text-xs font-bold text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <p aria-live="polite" className="text-center text-[11px] text-gray-400">
              {integer.format(includedAttempts)}/{integer.format(selectedDatedAttempts)} selected dated attempts shown
            </p>
            <button
              type="button"
              aria-label="Next activity window"
              disabled={!hasNextWindow}
              onClick={() => {
                const nextEnd = shiftLocalDate(calendarEnd, 91);
                setCalendarEnd(selectedLastDate !== null && nextEnd > selectedLastDate ? selectedLastDate : nextEnd);
              }}
              className="rounded border border-white/15 px-3 py-1.5 text-xs font-bold text-gray-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
          <div aria-label="Activity intensity legend" className="mb-3 flex flex-wrap gap-3 text-[10px] font-bold uppercase tracking-wide text-gray-400">
            {legendStops.map(value => <span key={value}>{value} {value === 1 ? 'attempt' : 'attempts'}</span>)}
          </div>
          <div className="overflow-x-auto pb-2">
            <div aria-label="Roll attempts by local calendar day" className="grid min-w-max grid-flow-col grid-rows-7 gap-1">
              {calendar.map(day => (
                <span
                  key={day.date}
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatLocalDate(day.date)}: ${integer.format(day.attempts)} roll ${day.attempts === 1 ? 'attempt' : 'attempts'}`}
                  title={`${formatLocalDate(day.date)}: ${day.attempts} ${day.attempts === 1 ? 'attempt' : 'attempts'}`}
                  className="flex h-7 w-7 items-center justify-center rounded border border-white/20 text-[9px] font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  style={activityStyle(day.attempts, maximumAttempts)}
                >
                  {integer.format(day.attempts)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </AnalyticsChartCard>
    </section>
  );
};
