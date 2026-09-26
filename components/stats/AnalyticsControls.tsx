import React from 'react';
import { AlertTriangle, ChevronDown, ShieldCheck } from 'lucide-react';
import type { AnalyticsCoverage, AnalyticsRange, AnalyticsScope, FateAnalyticsQuery } from '../../utils/fateAnalytics';
import { plural } from './luck';

export interface AnalyticsControlsProps {
  query: FateAnalyticsQuery;
  onChange: (query: FateAnalyticsQuery) => void;
  coverage: AnalyticsCoverage;
  availableSources: string[];
  availableCategories: string[];
  exactOnlyAvailable: boolean;
}

const scopeValue = (scope: AnalyticsScope): string => scope.kind === 'all' ? 'all' : `${scope.kind}:${scope.value}`;
const parseScope = (value: string): AnalyticsScope => {
  if (value === 'all') return { kind: 'all' };
  if (value.startsWith('category:')) return { kind: 'category', value: value.slice('category:'.length) };
  return { kind: 'source', value: value.slice('source:'.length) };
};

const selectClass = 'rounded-lg border border-white/10 bg-[#202020] px-3 py-1.5 text-sm text-gray-200 hover:border-white/20 focus:border-amber-400/60 focus:outline-none';

/** One badge for data quality, with the full count table behind it. */
const DataQuality: React.FC<{ coverage: AnalyticsCoverage }> = ({ coverage }) => {
  const rewardEvents = coverage.exactRewardEvents + coverage.unverifiedRewardEvents;
  const notes = [
    coverage.legacyEstimates > 0 ? `${plural(coverage.legacyEstimates, 'roll')} from older saves ${coverage.legacyEstimates === 1 ? 'uses' : 'use'} estimated odds.` : null,
    coverage.unscoreableProbabilities > 0 ? `${plural(coverage.unscoreableProbabilities, 'roll')} ${coverage.unscoreableProbabilities === 1 ? 'has' : 'have'} unknown odds and ${coverage.unscoreableProbabilities === 1 ? 'is' : 'are'} not judged.` : null,
    coverage.unverifiedRewardEvents > 0 ? `${plural(coverage.unverifiedRewardEvents, 'reward')} can't be verified, so ${coverage.unverifiedRewardEvents === 1 ? 'it is' : 'they are'} not counted as keys.` : null,
    coverage.invalidTimestamps > 0 ? `${plural(coverage.invalidTimestamps, 'roll')} ${coverage.invalidTimestamps === 1 ? 'has' : 'have'} no valid date.` : null,
    coverage.unknownSources > 0 ? `${plural(coverage.unknownSources, 'roll')} ${coverage.unknownSources === 1 ? 'comes' : 'come'} from an unknown source.` : null,
    coverage.inconsistentEntries > 0 ? `${plural(coverage.inconsistentEntries, 'entry', 'entries')} disagree with ${coverage.inconsistentEntries === 1 ? 'itself' : 'themselves'}.` : null,
  ].filter((note): note is string => note !== null);
  const clean = notes.length === 0;
  const rows: Array<[string, string]> = [
    ['Outcomes verified', `${coverage.exactOutcomes}/${coverage.attempts}`],
    ['Exact odds', `${coverage.exactProbabilities}/${coverage.attempts}`],
    ['Estimated odds', String(coverage.legacyEstimates)],
    ['Unknown odds', String(coverage.unscoreableProbabilities)],
    ['Rewards verified', `${coverage.exactRewardEvents}/${rewardEvents}`],
    ['Invalid dates', String(coverage.invalidTimestamps)],
    ['Unknown sources', String(coverage.unknownSources)],
    ['Inconsistent entries', String(coverage.inconsistentEntries)],
  ];
  return (
    <details className="group relative">
      <summary
        aria-live="polite"
        className={`flex cursor-pointer list-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold [&::-webkit-details-marker]:hidden ${clean
          ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
          : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}
      >
        {clean ? <ShieldCheck size={14} aria-hidden="true" /> : <AlertTriangle size={14} aria-hidden="true" />}
        {coverage.attempts === 0 ? 'No rolls selected' : clean ? `All ${plural(coverage.attempts, 'roll')} verified` : plural(notes.length, 'data note')}
        <ChevronDown size={12} aria-hidden="true" className="transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#1c1c1c] p-4 text-xs text-gray-300 shadow-2xl">
        {clean
          ? <p>Every selected roll has a verified outcome and exact odds.</p>
          : <ul className="list-disc space-y-1 pl-4">{notes.map(note => <li key={note}>{note}</li>)}</ul>}
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 border-t border-white/10 pt-3 text-gray-400">
          {rows.map(([label, value]) => (
            <React.Fragment key={label}><dt>{label}</dt><dd className="text-right font-mono text-gray-200">{value}</dd></React.Fragment>
          ))}
        </dl>
      </div>
    </details>
  );
};

export const AnalyticsControls: React.FC<AnalyticsControlsProps> = ({ query, onChange, coverage, availableSources, availableCategories, exactOnlyAvailable }) => {
  const exactOnly = !query.includeLegacyEstimates;
  const filtersActive = query.range !== 'all' || query.scope.kind !== 'all' || exactOnly;
  return (
    <section aria-label="Analytics filters" className="border-b border-white/5 bg-[#151515] px-5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Range
          <select aria-label="Range" className={selectClass} value={query.range} onChange={event => onChange({ ...query, range: event.target.value as AnalyticsRange })}>
            <option value="all">All time</option><option value="last-30-days">Last 30 days</option><option value="last-100">Last 100 rolls</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Show
          <select aria-label="Scope" className={`${selectClass} max-w-56`} value={scopeValue(query.scope)} onChange={event => onChange({ ...query, scope: parseScope(event.target.value) })}>
            <option value="all">Every activity</option>
            {availableCategories.length > 0 && <optgroup label="Categories">{availableCategories.map(category => <option key={`category:${category}`} value={`category:${category}`}>{category}</option>)}</optgroup>}
            {availableSources.length > 0 && <optgroup label="Sources">{availableSources.map(source => <option key={`source:${source}`} value={`source:${source}`}>{source}</option>)}</optgroup>}
          </select>
        </label>
        <label
          title="Leave out rolls from older saves whose odds were estimated"
          className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${exactOnly || exactOnlyAvailable ? 'cursor-pointer border-white/10 text-gray-200 hover:border-white/20' : 'border-white/5 text-gray-600'}`}
        >
          <input type="checkbox" aria-label="Exact odds only" className="accent-amber-400" checked={exactOnly} disabled={!exactOnly && !exactOnlyAvailable} onChange={event => onChange({ ...query, includeLegacyEstimates: !event.target.checked })} />
          Exact odds only
        </label>
        {coverage.attempts === 0 && filtersActive && (
          <button
            type="button"
            aria-label="Reset filters"
            onClick={() => onChange(defaultResetQuery(query))}
            className="rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-200 hover:bg-amber-400/20"
          >
            Reset filters
          </button>
        )}
        <div className="ml-auto"><DataQuality coverage={coverage} /></div>
      </div>
      {query.includeLegacyEstimates && coverage.legacyEstimates > 0 && <p role="status" className="mt-2 text-xs font-semibold text-amber-300">Includes estimated odds from older saves</p>}
    </section>
  );
};

const defaultResetQuery = (query: FateAnalyticsQuery): FateAnalyticsQuery => ({
  ...query,
  range: 'all',
  scope: { kind: 'all' },
  includeLegacyEstimates: true,
});
