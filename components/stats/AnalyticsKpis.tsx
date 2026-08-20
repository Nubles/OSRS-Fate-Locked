import React from 'react';
import type { FateAnalyticsResult } from '../../utils/fateAnalytics';

interface AnalyticsKpisProps { analytics: FateAnalyticsResult; }
const signed = (value: number, digits: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
const Kpi: React.FC<{ label: string; value: React.ReactNode; detail?: React.ReactNode }> = ({ label, value, detail }) => (
  <div className="rounded border border-white/5 bg-[#1f1f1f] p-4">
    <div className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
    <div className="mt-1 text-2xl font-black text-gray-100">{value}</div>
    {detail && <div className="mt-1 text-[11px] leading-4 text-gray-500">{detail}</div>}
  </div>
);

export const AnalyticsKpis: React.FC<AnalyticsKpisProps> = ({ analytics }) => {
  const { summary, coverage } = analytics;
  const sampleVerdict = summary.scoreableAttempts < 10 ? 'Building sample' : summary.verdict;
  return (
    <section aria-label="Analytics summary" className="space-y-3">
      {summary.attempts === 0 && <p role="status" className="rounded border border-white/5 bg-[#1f1f1f] p-4 text-center text-sm italic text-gray-500">No roll attempts in this selection</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Roll attempts" value={summary.attempts} />
        <Kpi label="Genuine RNG wins" value={summary.genuineWins} detail="Pity is reported separately" />
        <Kpi label="Expected wins — scoreable cohort" value={summary.expectedWins.toFixed(2)} detail={`${summary.scoreableWins}/${summary.scoreableAttempts} scoreable wins · ${summary.scoreableAttempts}/${summary.attempts} attempts scoreable`} />
        <Kpi label="Luck — scoreable cohort" value={summary.zScore === null ? '—' : `${signed(summary.zScore, 2)}σ`} detail={<>{sampleVerdict ?? 'Variance unavailable'} · Delta {signed(summary.delta, 2)} scoreable wins</>} />
        <Kpi label="Pity interventions" value={summary.pityInterventions} />
        <Kpi label="Omni-Keys awarded" value={summary.omniKeysAwarded} />
        <Kpi label="Confirmed Standard Keys" value={summary.confirmedStandardKeys} detail={`${coverage.exactRewardEvents}/${summary.rewardEvents} reward events exact`} />
        <Kpi label="Dry streak" value={summary.currentDrought} detail={`Current · ${summary.longestDrought} longest`} />
      </div>
    </section>
  );
};
