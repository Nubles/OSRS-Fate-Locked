import React from 'react';
import { Dices, Hourglass, Key, KeyRound, LifeBuoy, Sparkles } from 'lucide-react';
import type { FateAnalyticsResult } from '../../utils/fateAnalytics';
import { LuckSummary } from './LuckSummary';
import { plural } from './luck';

interface AnalyticsKpisProps { analytics: FateAnalyticsResult; }

const rate = (value: number | null): string => value === null ? '—' : `${(value * 100).toFixed(1)}%`;

const Tile: React.FC<{ icon: React.ReactNode; tint: string; label: string; value: React.ReactNode; detail?: React.ReactNode }> = ({ icon, tint, label, value, detail }) => (
  <div className="rounded-xl border border-white/[0.06] bg-[#1a1a1a] p-4">
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className={`grid h-7 w-7 place-items-center rounded-lg ${tint}`}>{icon}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
    </div>
    <div className="mt-2 text-3xl font-black tabular-nums text-gray-50">{value}</div>
    {detail && <div className="mt-0.5 text-[11px] leading-4 text-gray-500">{detail}</div>}
  </div>
);

export const AnalyticsKpis: React.FC<AnalyticsKpisProps> = ({ analytics }) => {
  const { summary, coverage, activityDays } = analytics;
  if (summary.attempts === 0) {
    return (
      <section aria-label="Analytics summary">
        <p role="status" className="rounded-xl border border-white/5 bg-[#1a1a1a] p-6 text-center text-sm italic text-gray-500">No roll attempts in this selection</p>
      </section>
    );
  }
  return (
    <section aria-label="Analytics summary" className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <div className="xl:col-span-2"><LuckSummary analytics={analytics} variant="dashboard" /></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:col-span-3">
        <Tile icon={<Dices size={15} />} tint="bg-sky-400/10 text-sky-300" label="Rolls" value={summary.attempts}
          detail={activityDays.length > 0 ? `across ${plural(activityDays.length, 'day')}` : undefined} />
        <Tile icon={<Key size={15} />} tint="bg-emerald-400/10 text-emerald-300" label="Wins" value={summary.genuineWins}
          detail={`${rate(summary.actualRate)} win rate · ${rate(summary.expectedRate)} expected`} />
        <Tile icon={<Sparkles size={15} />} tint="bg-violet-400/10 text-violet-300" label="Omni-Keys" value={summary.omniKeysAwarded}
          detail="the rarest reward" />
        <Tile icon={<LifeBuoy size={15} />} tint="bg-amber-400/10 text-amber-300" label="Pity keys" value={summary.pityInterventions}
          detail={summary.pityInterventions === 0 ? 'Fate never had to step in' : `Fate stepped in ${plural(summary.pityInterventions, 'time')}`} />
        <Tile icon={<KeyRound size={15} />} tint="bg-white/[0.06] text-gray-200" label="Standard Keys" value={summary.confirmedStandardKeys}
          detail={`${coverage.exactRewardEvents}/${summary.rewardEvents} rewards verified`} />
        <Tile icon={<Hourglass size={15} />} tint="bg-rose-400/10 text-rose-300" label="Dry streak" value={summary.currentDrought}
          detail={`misses in a row · longest ${summary.longestDrought}`} />
      </div>
    </section>
  );
};
