import React from 'react';
import type { AnalyticsNotableRoll, FateAnalyticsResult } from '../../utils/fateAnalytics';
import { AnalyticsChartCard } from './AnalyticsChartCard';

interface NotableMomentsProps {
  analytics: FateAnalyticsResult;
}

const integer = new Intl.NumberFormat('en-GB');
const longDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const notableRoll = (roll: AnalyticsNotableRoll | null, unavailable: string): string => {
  if (!roll) return unavailable;
  const date = new Date(roll.timestamp);
  const dateLabel = Number.isNaN(date.getTime()) ? 'date unavailable' : longDate.format(date);
  return `${roll.source} · ${(roll.probability * 100).toFixed(1)}% predicted chance · ${dateLabel}`;
};

const localDay = (value: string): string => {
  const [year, month, day] = value.split('-').map(Number);
  return longDate.format(new Date(year, month - 1, day));
};

export const NotableMoments: React.FC<NotableMomentsProps> = ({ analytics }) => {
  const { notables, summary } = analytics;
  const facts = [{
    label: 'Luckiest genuine success',
    value: notableRoll(notables.luckiestSuccess, 'No scoreable genuine success in this selection'),
  }, {
    label: 'Cruellest underlying miss',
    value: notableRoll(notables.cruelestMiss, 'No scoreable underlying miss in this selection'),
  }, {
    label: 'Longest drought',
    value: summary.longestDrought > 0
      ? `${integer.format(summary.longestDrought)} consecutive underlying ${summary.longestDrought === 1 ? 'miss' : 'misses'}`
      : 'No underlying miss streak in this selection',
  }, {
    label: 'Hottest streak',
    value: summary.longestHotStreak > 0
      ? `${integer.format(summary.longestHotStreak)} consecutive genuine RNG ${summary.longestHotStreak === 1 ? 'success' : 'successes'}`
      : 'No genuine-success streak in this selection',
  }, {
    label: 'Most productive source',
    value: notables.mostProductiveSource ?? 'No productive source in this selection',
  }, {
    label: 'Most active day',
    value: notables.mostActiveDay
      ? `${localDay(notables.mostActiveDay.date)} · ${integer.format(notables.mostActiveDay.attempts)} roll ${notables.mostActiveDay.attempts === 1 ? 'attempt' : 'attempts'}`
      : 'No active day in this selection',
  }];
  const availableFacts = facts.filter(fact => !fact.value.startsWith('No ')).length;

  return (
    <section data-analytics-grid aria-label="Notable analytics" className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
      <div className="xl:col-span-3">
        <AnalyticsChartCard
          title="Notable moments"
          subtitle="Deterministic highlights · ties retain chronological history order"
          summary={`${availableFacts}/6 notable facts are available for this selection. Probability highlights use the same scoreable cohort as the luck analysis.`}
        >
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {facts.map(fact => (
              <div key={fact.label} className="rounded border border-white/10 bg-black/15 p-3">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-amber-300">{fact.label}</dt>
                <dd className="mt-2 text-sm leading-5 text-gray-200">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </AnalyticsChartCard>
      </div>
    </section>
  );
};
