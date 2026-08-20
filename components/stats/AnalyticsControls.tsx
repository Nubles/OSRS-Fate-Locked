import React from 'react';
import type { AnalyticsCoverage, AnalyticsRange, AnalyticsScope, FateAnalyticsQuery } from '../../utils/fateAnalytics';

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

export const AnalyticsControls: React.FC<AnalyticsControlsProps> = ({ query, onChange, coverage, availableSources, availableCategories, exactOnlyAvailable }) => {
  const rewardEvents = coverage.exactRewardEvents + coverage.unverifiedRewardEvents;
  const exactOnly = !query.includeLegacyEstimates;
  const filtersActive = query.range !== 'all' || query.scope.kind !== 'all' || exactOnly;
  return (
    <section aria-label="Analytics filters" className="space-y-3 border-b border-white/5 bg-[#171717] px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Range
          <select aria-label="Range" className="rounded border border-white/10 bg-[#232323] px-3 py-2 text-sm normal-case tracking-normal text-gray-200" value={query.range} onChange={event => onChange({ ...query, range: event.target.value as AnalyticsRange })}>
            <option value="all">All time</option><option value="last-30-days">Last 30 days</option><option value="last-100">Last 100</option>
          </select>
        </label>
        <label className="flex min-w-56 flex-col gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Scope
          <select aria-label="Scope" className="rounded border border-white/10 bg-[#232323] px-3 py-2 text-sm normal-case tracking-normal text-gray-200" value={scopeValue(query.scope)} onChange={event => onChange({ ...query, scope: parseScope(event.target.value) })}>
            <option value="all">All sources</option>
            {availableCategories.length > 0 && <optgroup label="Categories">{availableCategories.map(category => <option key={`category:${category}`} value={`category:${category}`}>{category}</option>)}</optgroup>}
            {availableSources.length > 0 && <optgroup label="Sources">{availableSources.map(source => <option key={`source:${source}`} value={`source:${source}`}>{source}</option>)}</optgroup>}
          </select>
        </label>
        <label className={`flex items-center gap-2 rounded border px-3 py-2 text-sm ${exactOnly || exactOnlyAvailable ? 'border-white/10 text-gray-200' : 'border-white/5 text-gray-600'}`}>
          <input type="checkbox" aria-label="Exact only" checked={exactOnly} disabled={!exactOnly && !exactOnlyAvailable} onChange={event => onChange({ ...query, includeLegacyEstimates: !event.target.checked })} />
          Exact only
        </label>
        {coverage.attempts === 0 && filtersActive && (
          <button
            type="button"
            aria-label="Reset filters"
            onClick={() => onChange(defaultResetQuery(query))}
            className="rounded border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-200 hover:bg-amber-400/20"
          >
            Reset filters
          </button>
        )}
      </div>
      <p aria-live="polite" className="text-xs leading-5 text-gray-500">
        Outcomes verified: {coverage.exactOutcomes}/{coverage.attempts} · Probabilities exact: {coverage.exactProbabilities}/{coverage.attempts} · Legacy estimates: {coverage.legacyEstimates} · Unscoreable: {coverage.unscoreableProbabilities} · Rewards exact: {coverage.exactRewardEvents}/{rewardEvents} · Invalid timestamps: {coverage.invalidTimestamps} · Unknown sources: {coverage.unknownSources} · Inconsistent entries: {coverage.inconsistentEntries}
      </p>
      {query.includeLegacyEstimates && coverage.legacyEstimates > 0 && <p role="status" className="text-xs font-semibold text-amber-300">Legacy estimates included</p>}
    </section>
  );
};

const defaultResetQuery = (query: FateAnalyticsQuery): FateAnalyticsQuery => ({
  ...query,
  range: 'all',
  scope: { kind: 'all' },
  includeLegacyEstimates: true,
});
