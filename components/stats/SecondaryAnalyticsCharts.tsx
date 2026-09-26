import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, KeyRound } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { CalibrationBin, FateAnalyticsResult, KeyAcquisitionPoint } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';
import { buildCalendarGrid } from './chartData';
import { BlockSwatch, Legend, type LegendItem } from './Legend';
import { formatShortDay, parseLocalDay, plural } from './luck';
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
const monthName = new Intl.DateTimeFormat('en-GB', { month: 'short' });
const AXIS_TICK = { fontSize: 10, fill: '#8b8b8b' };
const GRID_STROKE = 'rgba(255,255,255,0.06)';
const TOOLTIP_CLASS = 'rounded-lg border border-white/15 bg-[#141414]/95 p-3 text-xs text-gray-300 shadow-xl backdrop-blur';

const formatLocalDate = (value: string): string => {
  const date = parseLocalDay(value);
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
  const date = parseLocalDay(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return localDateForTimestamp(date.getTime());
};

export const CalibrationTooltip: React.FC<CalibrationTooltipProps> = ({ active, payload }) => {
  const bin = payload?.[0]?.payload;
  if (!active || !bin) return null;
  return (
    <div className={TOOLTIP_CLASS}>
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
    <div className={TOOLTIP_CLASS}>
      <p className="font-bold text-white">{formatLocalDate(point.date)}</p>
      <p className="mt-1">Normal reward: {unit(point.normalStandard, 'Standard Key')}</p>
      <p>Greed reward: {unit(point.greedStandard, 'Standard Key')}</p>
      <p>Pity reward: {unit(point.pityStandard, 'Standard Key')}</p>
      <p>Omni-derived reward: {unit(point.omniStandard, 'Standard Key')}</p>
      <p>Omni-Key awards: {unit(point.omniKeys, 'Omni-Key')}</p>
      <p className="text-gray-500">Unverified legacy reward events: {integer.format(point.unverifiedRewardEvents)} (not Key counts)</p>
    </div>
  );
};

const REWARD_SERIES = [
  { key: 'normalStandard', name: 'Normal reward — Standard Keys', label: 'Normal', color: '#34d399', fill: 'url(#reward-normal)' },
  { key: 'greedStandard', name: 'Greed reward — Standard Keys', label: 'Greed', color: '#fbbf24', fill: 'url(#reward-greed)' },
  { key: 'pityStandard', name: 'Pity reward — Standard Keys', label: 'Pity', color: '#fb923c', fill: 'url(#reward-pity)' },
  { key: 'omniStandard', name: 'Omni-derived reward — Standard Keys', label: 'From Omni-Keys', color: '#a78bfa', fill: 'url(#reward-omni)' },
] as const;

// A plain <defs> element: Recharts drops custom components from chart children.
const rewardPatterns = (
  <defs>
    <pattern id="reward-normal" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#34d399" /><path d="M0 6L6 0" stroke="#064e3b" strokeOpacity="0.45" strokeWidth="1.5" /></pattern>
    <pattern id="reward-greed" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fbbf24" /><path d="M0 1.5H6M0 4.5H6" stroke="#78350f" strokeOpacity="0.45" strokeWidth="1" /></pattern>
    <pattern id="reward-pity" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#fb923c" /><path d="M0 0L6 6M6 0L0 6" stroke="#7c2d12" strokeOpacity="0.45" strokeWidth="1" /></pattern>
    <pattern id="reward-omni" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#a78bfa" /><circle cx="3" cy="3" r="1.1" fill="#4c1d95" fillOpacity="0.7" /></pattern>
  </defs>
);

const HEAT_LEVELS = ['#242424', '#5b3a0b', '#8a5a0c', '#c28a10', '#facc15'];
const heatLevel = (attempts: number, maximum: number): number =>
  attempts === 0 || maximum === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((attempts / maximum) * 4)));
const WEEKDAYS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export const SecondaryAnalyticsCharts: React.FC<SecondaryAnalyticsChartsProps> = ({ analytics }) => {
  const reducedMotion = useReducedMotion();
  const animationActive = !reducedMotion;
  const totals = useMemo(() => {
    const sum = (key: keyof Omit<KeyAcquisitionPoint, 'date'>) => analytics.keyAcquisition.reduce((total, point) => total + point[key], 0);
    return {
      normalStandard: sum('normalStandard'),
      greedStandard: sum('greedStandard'),
      pityStandard: sum('pityStandard'),
      omniStandard: sum('omniStandard'),
      omniKeys: sum('omniKeys'),
      unverified: sum('unverifiedRewardEvents'),
    };
  }, [analytics.keyAcquisition]);
  const standardKeys = totals.normalStandard + totals.greedStandard + totals.pityStandard + totals.omniStandard;
  const bestKeyDay = analytics.keyAcquisition.reduce<{ date: string; keys: number } | null>((best, point) => {
    const keys = point.normalStandard + point.greedStandard + point.pityStandard + point.omniStandard;
    return best === null || keys > best.keys ? { date: point.date, keys } : best;
  }, null);
  const rewardLegend: LegendItem[] = [
    ...REWARD_SERIES
      .filter(series => totals[series.key] > 0)
      .map(series => ({ label: series.label, value: integer.format(totals[series.key]), swatch: <BlockSwatch style={{ backgroundColor: series.color }} /> })),
    ...(totals.omniKeys > 0 ? [{ label: 'Omni-Keys (own bar)', value: integer.format(totals.omniKeys), swatch: <BlockSwatch style={{ backgroundColor: '#f5f5f5' }} /> }] : []),
  ];

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
  const activeDaysShown = calendar.filter(day => day.attempts > 0).length;
  const hasPreviousWindow = selectedFirstDate !== null && selectedFirstDate < calendarStart;
  const hasNextWindow = selectedLastDate !== null && selectedLastDate > calendarEnd;
  const maximumAttempts = Math.max(0, ...calendar.map(day => day.attempts));
  const weeks = useMemo(() => {
    const first = calendar[0] ? parseLocalDay(calendar[0].date) : null;
    const pad = first ? (first.getDay() + 6) % 7 : 0;
    const cells: Array<typeof calendar[number] | null> = [...Array<null>(pad).fill(null), ...calendar];
    const columns: Array<Array<typeof calendar[number] | null>> = [];
    for (let index = 0; index < cells.length; index += 7) columns.push(cells.slice(index, index + 7));
    let previousMonth = -1;
    const labelled = columns.map(days => {
      const firstDay = days.find((day): day is typeof calendar[number] => day !== null);
      const date = firstDay ? parseLocalDay(firstDay.date) : null;
      const month = date ? date.getMonth() : previousMonth;
      const label = date && month !== previousMonth ? monthName.format(date) : '';
      previousMonth = month;
      return { days, label };
    });
    // A month label needs about three columns; drop one that would run into the next.
    let nextLabelAt = Number.POSITIVE_INFINITY;
    for (let index = labelled.length - 1; index >= 0; index -= 1) {
      if (!labelled[index].label) continue;
      if (nextLabelAt - index < 3) labelled[index] = { ...labelled[index], label: '' };
      else nextLabelAt = index;
    }
    return labelled;
  }, [calendar]);
  const navButton = 'grid h-7 w-7 place-items-center rounded-lg border border-white/10 text-gray-300 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30';

  return (
    <section data-analytics-grid aria-label="Secondary analytics charts" className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <div className="lg:col-span-2 xl:col-span-2">
        <AnalyticsChartCard
          title="Keys earned"
          subtitle="Verified rewards per day · Omni-Keys are counted on their own bar"
          summary={analytics.keyAcquisition.length === 0
            ? 'No verified rewards yet.'
            : `${plural(standardKeys, 'Standard Key')}${totals.omniKeys > 0 ? ` and ${plural(totals.omniKeys, 'Omni-Key')}` : ''} earned on ${plural(analytics.keyAcquisition.length, 'day')}${bestKeyDay && bestKeyDay.keys > 1 ? `; your best day was ${formatShortDay(bestKeyDay.date)} with ${bestKeyDay.keys}` : ''}.`}
          icon={<KeyRound size={15} />}
          legend={rewardLegend.length > 0 ? <Legend label="Key acquisition series legend" items={rewardLegend} /> : undefined}
          empty={analytics.keyAcquisition.length === 0 ? 'No reward events with valid local dates match these filters.' : undefined}
        >
          {totals.unverified > 0 && <p className="mb-2 text-[11px] text-amber-300">{integer.format(totals.unverified)} unverified legacy reward {totals.unverified === 1 ? 'event' : 'events'} — not Key counts</p>}
          <ul aria-label="Key acquisition data" className="sr-only">
            {analytics.keyAcquisition.map(point => <li key={point.date}>{formatLocalDate(point.date)}: normal {point.normalStandard} Standard Keys; Greed {point.greedStandard} Standard Keys; pity {point.pityStandard} Standard Keys; Omni-derived {point.omniStandard} Standard Keys; {point.omniKeys} Omni-Keys; {point.unverifiedRewardEvents} unverified legacy reward events, not Key counts</li>)}
          </ul>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.keyAcquisition} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barCategoryGap="20%" aria-label="Verified Standard Key and separate Omni-Key acquisition chart">
                {rewardPatterns}
                <CartesianGrid stroke={GRID_STROKE} vertical={false} />
                <XAxis dataKey="date" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: '#333' }} minTickGap={24} tickFormatter={(value: string) => formatShortDay(value)} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} tickLine={false} axisLine={false} width={44} />
                <Tooltip content={<KeyAcquisitionTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                {REWARD_SERIES.map((series, index) => (
                  <Bar key={series.key} name={series.name} dataKey={series.key} stackId="standard-keys" fill={series.fill}
                    radius={index === REWARD_SERIES.length - 1 ? [3, 3, 0, 0] : undefined} isAnimationActive={animationActive} />
                ))}
                <Bar name="Omni-Key awards — separate count" dataKey="omniKeys" fill="#f5f5f5" radius={[3, 3, 0, 0]} isAnimationActive={animationActive} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnalyticsChartCard>
      </div>

      <AnalyticsChartCard
        title="Activity calendar"
        subtitle="Rolls per day, win or lose"
        summary={`${plural(includedAttempts, 'roll')} on ${plural(activeDaysShown, 'day')} between ${formatShortDay(calendarStart)} and ${formatShortDay(calendarEnd)}${includedAttempts < selectedDatedAttempts ? ` (${integer.format(selectedDatedAttempts)} in the whole selection)` : ''}.`}
        icon={<CalendarDays size={15} />}
        action={analytics.activityDays.length > 0 ? (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" aria-label="Previous activity window" disabled={!hasPreviousWindow} onClick={() => setCalendarEnd(shiftLocalDate(calendarStart, -1))} className={navButton}><ChevronLeft size={14} /></button>
            <button
              type="button"
              aria-label="Next activity window"
              disabled={!hasNextWindow}
              onClick={() => {
                const nextEnd = shiftLocalDate(calendarEnd, 91);
                setCalendarEnd(selectedLastDate !== null && nextEnd > selectedLastDate ? selectedLastDate : nextEnd);
              }}
              className={navButton}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        ) : undefined}
        empty={analytics.activityDays.length === 0 ? 'No dated roll attempts match these filters.' : undefined}
      >
        <p aria-live="polite" className="sr-only">{integer.format(includedAttempts)}/{integer.format(selectedDatedAttempts)} selected dated attempts shown</p>
        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-[3px]">
            <div aria-hidden="true" className="mr-1 flex flex-col gap-[3px] pt-[18px] text-[9px] leading-4 text-gray-500">
              {WEEKDAYS.map((day, index) => <span key={index} className="h-4">{day}</span>)}
            </div>
            <div aria-label="Roll attempts by local calendar day" className="flex gap-[3px]">
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px]">
                  <span aria-hidden="true" className="h-[15px] whitespace-nowrap text-[9px] leading-[15px] text-gray-500">{week.label}</span>
                  {week.days.map((day, dayIndex) => day === null
                    ? <span key={`pad-${dayIndex}`} aria-hidden="true" className="h-4 w-4" />
                    : (
                      <span
                        key={day.date}
                        tabIndex={0}
                        role="img"
                        aria-label={`${formatLocalDate(day.date)}: ${integer.format(day.attempts)} roll ${day.attempts === 1 ? 'attempt' : 'attempts'}`}
                        title={`${formatLocalDate(day.date)}: ${plural(day.attempts, 'roll')}`}
                        className="h-4 w-4 rounded-[3px] outline-none ring-inset ring-white/5 focus-visible:ring-2 focus-visible:ring-amber-300 [&:not(:focus-visible)]:ring-1"
                        style={{ backgroundColor: HEAT_LEVELS[heatLevel(day.attempts, maximumAttempts)] }}
                      />
                    ))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div aria-label="Activity intensity legend" className="mt-3 flex items-center gap-1.5 text-[10px] text-gray-500">
          <span>Less</span>
          {HEAT_LEVELS.map(color => <span key={color} aria-hidden="true" className="h-[10px] w-[10px] rounded-[2px]" style={{ backgroundColor: color }} />)}
          <span>More</span>
          <span className="ml-auto">busiest day: {plural(maximumAttempts, 'roll')}</span>
        </div>
      </AnalyticsChartCard>
    </section>
  );
};
