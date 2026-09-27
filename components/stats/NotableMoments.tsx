import React from 'react';
import { CalendarDays, Clover, Flame, Hourglass, Skull, Star, Trophy } from 'lucide-react';
import type { AnalyticsNotableRoll, FateAnalyticsResult } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';

interface NotableMomentsProps {
  analytics: FateAnalyticsResult;
}

interface Fact {
  label: string;
  icon: React.ReactNode;
  tint: string;
  value: string | null;
  detail: string;
  unavailable: string;
}

const integer = new Intl.NumberFormat('en-GB');
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const rollDetail = (roll: AnalyticsNotableRoll): string => {
  const date = new Date(roll.timestamp);
  const dateLabel = Number.isNaN(date.getTime()) ? 'date unavailable' : longDate.format(date);
  return `${(roll.probability * 100).toFixed(1)}% chance · ${dateLabel}`;
};

const localDay = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  return longDate.format(new Date(year, month - 1, day));
};

export const NotableMoments: React.FC<NotableMomentsProps> = ({ analytics }) => {
  const { notables, summary } = analytics;
  const facts: Fact[] = [{
    label: 'Luckiest roll',
    icon: <Clover size={16} />,
    tint: 'bg-emerald-400/10 text-emerald-300',
    value: notables.luckiestSuccess?.source ?? null,
    detail: notables.luckiestSuccess ? `Won at ${rollDetail(notables.luckiestSuccess)}` : '',
    unavailable: 'No scoreable genuine success in this selection',
  }, {
    label: 'Cruellest miss',
    icon: <Skull size={16} />,
    tint: 'bg-rose-400/10 text-rose-300',
    value: notables.cruelestMiss?.source ?? null,
    detail: notables.cruelestMiss ? `Missed at ${rollDetail(notables.cruelestMiss)}` : '',
    unavailable: 'No scoreable underlying miss in this selection',
  }, {
    label: 'Hottest streak',
    icon: <Flame size={16} />,
    tint: 'bg-amber-400/10 text-amber-300',
    value: summary.longestHotStreak > 0 ? `${integer.format(summary.longestHotStreak)} ${summary.longestHotStreak === 1 ? 'win' : 'wins'} in a row` : null,
    detail: 'Genuine wins, pity not included',
    unavailable: 'No genuine-success streak in this selection',
  }, {
    label: 'Longest drought',
    icon: <Hourglass size={16} />,
    tint: 'bg-sky-400/10 text-sky-300',
    value: summary.longestDrought > 0 ? `${integer.format(summary.longestDrought)} ${summary.longestDrought === 1 ? 'miss' : 'misses'} in a row` : null,
    detail: 'Rolls without a genuine win',
    unavailable: 'No underlying miss streak in this selection',
  }, {
    label: 'Best activity',
    icon: <Trophy size={16} />,
    tint: 'bg-violet-400/10 text-violet-300',
    value: notables.mostProductiveSource,
    detail: 'Won you the most keys',
    unavailable: 'No productive source in this selection',
  }, {
    label: 'Busiest day',
    icon: <CalendarDays size={16} />,
    tint: 'bg-white/[0.06] text-gray-200',
    value: notables.mostActiveDay ? localDay(notables.mostActiveDay.date) : null,
    detail: notables.mostActiveDay ? `${integer.format(notables.mostActiveDay.attempts)} roll ${notables.mostActiveDay.attempts === 1 ? 'attempt' : 'attempts'}` : '',
    unavailable: 'No active day in this selection',
  }];
  const availableFacts = facts.filter(fact => fact.value !== null).length;

  return (
    <section aria-label="Notable analytics">
      <AnalyticsChartCard
        title="Notable moments"
        subtitle="The rolls worth remembering"
        summary={availableFacts === 0 ? 'Nothing notable in this selection yet.' : `${availableFacts} of 6 highlights are ready for this selection.`}
        icon={<Star size={15} />}
      >
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {facts.map(fact => (
            <div key={fact.label} className="flex gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3">
              <span aria-hidden="true" className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${fact.tint}`}>{fact.icon}</span>
              <div className="min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{fact.label}</dt>
                {fact.value === null
                  ? <dd className="mt-1 text-sm italic text-gray-500">{fact.unavailable}</dd>
                  : <dd className="mt-0.5">
                      <span className="block truncate text-sm font-semibold text-gray-100">{fact.value}</span>
                      <span className="block text-[11px] text-gray-500">{fact.detail}</span>
                    </dd>}
              </div>
            </div>
          ))}
        </dl>
      </AnalyticsChartCard>
    </section>
  );
};
