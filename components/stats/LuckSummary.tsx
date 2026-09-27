import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Crown, Flame, HelpCircle, Hourglass, Scale, Skull, Snowflake, type LucideIcon } from 'lucide-react';
import type { FateAnalyticsResult } from '../../utils/fateAnalytics';
import { formatSigma, luckSentence, percentileSentence, plural, shareableSummary, verdictTone, type Verdict } from './luck';

const ZONES = [
  { from: -3, to: -2, label: 'Forsaken', fill: 'bg-rose-500/55' },
  { from: -2, to: -1, label: 'Cold', fill: 'bg-sky-500/40' },
  { from: -1, to: 1, label: 'Fair', fill: 'bg-slate-400/20' },
  { from: 1, to: 2, label: 'Hot', fill: 'bg-emerald-500/45' },
  { from: 2, to: 3, label: 'Blessed', fill: 'bg-amber-400/65' },
];
const SPAN = 6;
const zoneWidth = (zone: typeof ZONES[number]) => `${((zone.to - zone.from) / SPAN) * 100}%`;

const VERDICT_ICONS: Record<Exclude<Verdict, null>, LucideIcon> = {
  'Blessed by Fate': Crown,
  'Running hot': Flame,
  'Fate is fair': Scale,
  'Running cold': Snowflake,
  'Forsaken by Fate': Skull,
  'Building sample': Hourglass,
};

/** A five-zone gauge from −3σ to +3σ; a reading past either end pins to that end. */
export const LuckMeter: React.FC<{ zScore: number | null; large?: boolean }> = ({ zScore, large }) => {
  const clamped = zScore === null ? null : Math.max(-3, Math.min(3, zScore));
  const left = clamped === null ? null : ((clamped + 3) / SPAN) * 100;
  return (
    <div>
      <div
        role="img"
        aria-label={zScore === null ? 'Luck meter: no reading yet' : `Luck meter at ${formatSigma(zScore)}; between −1σ and +1σ is fair`}
        className="relative"
      >
        <div className={`flex overflow-hidden rounded-full ring-1 ring-inset ring-white/10 ${large ? 'h-3.5' : 'h-2.5'}`}>
          {ZONES.map(zone => <div key={zone.label} className={`${zone.fill} border-r border-black/40 last:border-r-0`} style={{ width: zoneWidth(zone) }} />)}
        </div>
        {left !== null && (
          <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${left}%` }}>
            <div className={`rounded-full border-[3px] border-[#141414] bg-white shadow-[0_0_14px_rgba(255,255,255,0.55)] ${large ? 'h-6 w-6' : 'h-[18px] w-[18px]'}`} />
          </div>
        )}
      </div>
      <div aria-hidden="true" className={`mt-2 flex font-semibold uppercase tracking-wider text-gray-500 ${large ? 'text-[9px] sm:text-[11px]' : 'text-[9px] sm:text-[10px]'}`}>
        {ZONES.map(zone => <span key={zone.label} className="text-center" style={{ width: zoneWidth(zone) }}>{zone.label}</span>)}
      </div>
    </div>
  );
};

const CopySummaryButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-200 transition-colors hover:bg-white/10">
      {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />}
      <span aria-live="polite">{copied ? 'Copied' : 'Copy summary'}</span>
    </button>
  );
};

interface LuckSummaryProps {
  analytics: FateAnalyticsResult;
  variant: 'dashboard' | 'report';
}

export const LuckSummary: React.FC<LuckSummaryProps> = ({ analytics, variant }) => {
  const { summary } = analytics;
  const tone = verdictTone(summary.verdict);
  const Icon = summary.verdict ? VERDICT_ICONS[summary.verdict] : HelpCircle;
  const judged = summary.zScore !== null && summary.verdict !== 'Building sample';
  const report = variant === 'report';
  const footnote = judged ? percentileSentence(summary.zScore!) : tone.blurb;
  const unjudged = summary.attempts - summary.scoreableAttempts;

  return (
    <section aria-label="Your luck" className={`relative h-full overflow-hidden rounded-xl border ${tone.border} bg-[#181818] ${report ? 'p-6 sm:p-8' : 'p-5'}`}>
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow} via-transparent to-transparent`} />
      <div className={`relative flex h-full flex-col ${report ? 'items-center text-center' : ''}`}>
        <div className={`flex w-full gap-4 ${report ? 'flex-col items-center' : 'items-start justify-between'}`}>
          <div className={`flex items-center gap-3 ${report ? 'flex-col' : ''}`}>
            <span className={`grid shrink-0 place-items-center rounded-xl bg-black/30 ring-1 ring-white/10 ${tone.text} ${report ? 'h-16 w-16' : 'h-11 w-11'}`}>
              <Icon size={report ? 32 : 22} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">{report ? 'Fate’s verdict' : 'Your luck'}</p>
              <p className={`font-black leading-tight ${tone.text} ${report ? 'mt-1 text-4xl' : 'text-2xl'}`}>{tone.title}</p>
            </div>
          </div>
          {!report && (
            <div className="text-right" title="Standard deviations from what the odds expect. Between −1σ and +1σ is normal.">
              <p className={`font-mono text-xl font-bold ${tone.text}`}>{judged ? formatSigma(summary.zScore) : '—'}</p>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">luck score</p>
            </div>
          )}
        </div>

        <p className={`text-gray-300 ${report ? 'mt-4 max-w-xl text-base leading-7' : 'mt-3 text-sm leading-6'}`}>{luckSentence(summary)}</p>

        <div className={`w-full ${report ? 'mt-6 max-w-xl' : 'mt-auto pt-5'}`}>
          <LuckMeter zScore={judged ? summary.zScore : null} large={report} />
        </div>

        {summary.verdict === 'Building sample' && (
          <div className={`w-full ${report ? 'mt-4 max-w-xl' : 'mt-3'}`}>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gray-300" style={{ width: `${Math.min(100, (summary.scoreableAttempts / 10) * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-gray-500">{summary.scoreableAttempts} of 10 rolls with known odds</p>
          </div>
        )}

        <p className={`text-gray-400 ${report ? 'mt-4 text-sm' : 'mt-3 text-xs'}`}>
          {footnote}
          {report && judged && <span className="text-gray-500"> Luck score {formatSigma(summary.zScore)}.</span>}
        </p>
        {unjudged > 0 && <p className="mt-1 text-[11px] text-gray-500">{plural(unjudged, 'roll')} with unknown odds {unjudged === 1 ? 'is' : 'are'} counted but not judged.</p>}
        {report && <div className="mt-5"><CopySummaryButton text={shareableSummary(analytics)} /></div>}
      </div>
    </section>
  );
};
