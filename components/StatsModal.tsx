import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Activity, ArrowDown, ArrowUp, ArrowUpDown, List, Sparkles, X } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { completionPercent } from '../utils/completion';
import { buildFateAnalytics, defaultFateAnalyticsQuery, type AnalyticsAggregate } from '../utils/fateAnalytics';
import { fateReportFromAnalytics } from '../utils/fateReport';
import { lazyWithRetry } from '../utils/lazyRetry';
import { isRollEntry } from '../utils/logEntry';
import { AnalyticsControls } from './stats/AnalyticsControls';
import { AnalyticsKpis } from './stats/AnalyticsKpis';
import { KeyEconomyEvidenceExport } from './KeyEconomyEvidenceExport';
import { SectionGuide } from './SectionGuide';

const StatsChartsView = lazyWithRetry(() => import('./StatsChartsView'));

interface StatsModalProps { onClose: () => void; }
type Tab = 'dashboard' | 'breakdown' | 'fate';
type SortDirection = 'asc' | 'desc';

export interface AnalyticsBreakdownRow {
  source: string;
  originalIndex: number;
  attempts: number;
  genuineWins: number;
  expectedWins: number;
  delta: number;
  zScore: number | null;
  actualRate: number | null;
  expectedRate: number | null;
  pityInterventions: number;
  confirmedStandardKeys: number | null;
  probabilityCoverage: number;
  sampleLabel: AnalyticsAggregate['sampleLabel'];
}

export type AnalyticsSortKey = keyof Omit<AnalyticsBreakdownRow, 'originalIndex'>;

const compareValues = (left: string | number | null, right: string | number | null): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return typeof left === 'string' && typeof right === 'string' ? left.localeCompare(right) : Number(left) - Number(right);
};

export const sortAnalyticsRows = (rows: AnalyticsBreakdownRow[], key: AnalyticsSortKey, direction: SortDirection): AnalyticsBreakdownRow[] =>
  [...rows].sort((left, right) => {
    const availabilityOrder = left[key] === null ? (right[key] === null ? 0 : 1) : right[key] === null ? -1 : 0;
    if (availabilityOrder !== 0) return availabilityOrder;
    const comparison = compareValues(left[key], right[key]);
    return (direction === 'asc' ? comparison : -comparison) || left.originalIndex - right.originalIndex;
  });

const toRow = (aggregate: AnalyticsAggregate, originalIndex: number): AnalyticsBreakdownRow => ({
  source: aggregate.label,
  originalIndex,
  attempts: aggregate.attempts,
  genuineWins: aggregate.genuineWins,
  expectedWins: aggregate.expectedWins,
  delta: aggregate.delta,
  zScore: aggregate.zScore,
  actualRate: aggregate.actualRate,
  expectedRate: aggregate.expectedRate,
  pityInterventions: aggregate.pityInterventions,
  confirmedStandardKeys: aggregate.confirmedStandardKeys,
  probabilityCoverage: aggregate.probabilityCoverage,
  sampleLabel: aggregate.sampleLabel,
});

const columns: Array<{ key: AnalyticsSortKey; label: string; numeric?: boolean }> = [
  { key: 'source', label: 'Source' },
  { key: 'attempts', label: 'Attempts', numeric: true },
  { key: 'genuineWins', label: 'Genuine RNG wins', numeric: true },
  { key: 'expectedWins', label: 'Expected wins (scoreable)', numeric: true },
  { key: 'delta', label: 'Delta (scoreable)', numeric: true },
  { key: 'zScore', label: 'Z-score (scoreable)', numeric: true },
  { key: 'actualRate', label: 'Actual rate (scoreable)', numeric: true },
  { key: 'expectedRate', label: 'Expected rate (scoreable)', numeric: true },
  { key: 'pityInterventions', label: 'Pity', numeric: true },
  { key: 'confirmedStandardKeys', label: 'Confirmed Standard Keys', numeric: true },
  { key: 'probabilityCoverage', label: 'Probability coverage', numeric: true },
  { key: 'sampleLabel', label: 'Sample' },
];

const percentage = (value: number | null): string => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const decimal = (value: number | null): string => value === null ? '—' : value.toFixed(2);
const signed = (value: number): string => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: 'dashboard', label: 'Dashboard', icon: <Activity size={16} /> },
  { id: 'breakdown', label: 'Activity Breakdown', icon: <List size={16} /> },
  { id: 'fate', label: 'Fate Report', icon: <Sparkles size={16} /> },
];

export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ dashboard: null, breakdown: null, fate: null });
  const previouslyFocused = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { history, unlocks, gameModeId } = useGame();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [query, setQuery] = useState(() => defaultFateAnalyticsQuery(Date.now()));
  const [sortConfig, setSortConfig] = useState<{ key: AnalyticsSortKey; direction: SortDirection }>({ key: 'attempts', direction: 'desc' });
  const analytics = useMemo(() => buildFateAnalytics(history, query), [history, query]);
  const fateReport = useMemo(() => fateReportFromAnalytics(analytics), [analytics]);
  const fullHistoryHasAttempts = useMemo(() => history.some(isRollEntry), [history]);
  const rows = useMemo(() => analytics.sources.map(toRow), [analytics.sources]);
  const sortedRows = useMemo(() => sortAnalyticsRows(rows, sortConfig.key, sortConfig.direction), [rows, sortConfig]);
  const handleQueryChange = useCallback((nextQuery: typeof query) => {
    if (nextQuery.scope.kind === 'all' || nextQuery.range === query.range) {
      setQuery(nextQuery);
      return;
    }
    const preScope = buildFateAnalytics(history, { ...nextQuery, scope: { kind: 'all' } });
    const available = nextQuery.scope.kind === 'source' ? preScope.availableSources : preScope.availableCategories;
    setQuery(available.includes(nextQuery.scope.value)
      ? nextQuery
      : { ...nextQuery, scope: { kind: 'all' } });
  }, [history, query.range]);

  useEffect(() => {
    const dialog = dialogRef.current;
    closeRef.current?.focus();
    const focusable = () => dialog
      ? [...dialog.querySelectorAll<HTMLElement>('a[href]:not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.closest('[hidden]'))
      : [];
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) { event.preventDefault(); dialog?.focus(); return; }
      const [first] = items;
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    const handleWindowKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    dialog?.addEventListener('keydown', handleDialogKeyDown);
    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      dialog?.removeEventListener('keydown', handleDialogKeyDown);
      window.removeEventListener('keydown', handleWindowKeyDown);
      previouslyFocused.current?.focus();
    };
  }, []);

  const handleSort = (key: AnalyticsSortKey) => setSortConfig(current => ({ key, direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc' }));
  const ariaSort = (key: AnalyticsSortKey): 'none' | 'ascending' | 'descending' => sortConfig.key !== key ? 'none' : sortConfig.direction === 'asc' ? 'ascending' : 'descending';
  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tab: Tab) => {
    const currentIndex = tabs.findIndex(item => item.id === tab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex].id;
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fate-analytics-title" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-osrs-border bg-[#161616] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between border-b border-osrs-border bg-[#2d2d2d] p-4">
          <div className="flex items-center gap-3">
            <div className="rounded border border-blue-500/30 bg-blue-900/30 p-2"><Activity className="h-5 w-5 text-blue-400" /></div>
            <h2 id="fate-analytics-title" className="flex items-center gap-2 text-xl font-bold text-gray-100">Fate Analytics <SectionGuide id="STATS" /></h2>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close Fate Analytics" className="rounded-full p-1 transition-colors hover:bg-white/10"><X className="h-6 w-6 text-gray-400" /></button>
        </header>

        <div role="tablist" aria-label="Fate Analytics sections" className="flex shrink-0 overflow-x-auto border-b border-osrs-border bg-[#1a1a1a]">
          {tabs.map(tab => (
            <button ref={node => { tabRefs.current[tab.id] = node; }} key={tab.id} id={`fate-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`fate-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} onKeyDown={event => handleTabKeyDown(event, tab.id)} className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-6 py-3 text-sm font-bold uppercase tracking-wider ${activeTab === tab.id ? 'border-osrs-gold bg-osrs-gold/5 text-osrs-gold' : 'border-transparent text-gray-500 hover:text-gray-300'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <AnalyticsControls query={query} onChange={handleQueryChange} coverage={analytics.coverage} availableSources={analytics.availableSources} availableCategories={analytics.availableCategories} exactOnlyAvailable={analytics.exactOnlyAvailable} />

        <main className="custom-scrollbar flex-1 overflow-y-auto bg-[#111] p-5">
          <section id="fate-panel-dashboard" role="tabpanel" aria-labelledby="fate-tab-dashboard" hidden={activeTab !== 'dashboard'} className="space-y-5">
              <AnalyticsKpis analytics={analytics} />
              <Suspense fallback={<div className="flex h-[300px] items-center justify-center text-xs italic text-gray-600">Loading charts…</div>}><StatsChartsView analytics={analytics} /></Suspense>
          </section>

          <section id="fate-panel-breakdown" role="tabpanel" aria-labelledby="fate-tab-breakdown" hidden={activeTab !== 'breakdown'}>
              <div role="region" aria-label="Activity breakdown" tabIndex={0} className="overflow-x-auto rounded-lg border border-white/5 bg-[#1f1f1f]">
                <table className="w-full min-w-[1280px] text-left text-xs">
                  <thead className="bg-[#252525] font-bold uppercase text-gray-400"><tr>
                    {columns.map(column => (
                      <th key={column.key} aria-sort={ariaSort(column.key)} className={`p-0 ${column.key === 'source' ? 'sticky left-0 z-20 bg-[#252525]' : ''}`}>
                        <button type="button" onClick={() => handleSort(column.key)} className={`flex w-full items-center gap-2 p-3 hover:bg-white/5 ${column.numeric ? 'justify-end text-right' : ''}`}>
                          {column.label}
                          {sortConfig.key !== column.key ? <ArrowUpDown aria-hidden="true" size={12} className="opacity-30" /> : sortConfig.direction === 'asc' ? <ArrowUp aria-hidden="true" size={12} className="text-osrs-gold" /> : <ArrowDown aria-hidden="true" size={12} className="text-osrs-gold" />}
                        </button>
                      </th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y divide-white/5 text-gray-300">
                    {sortedRows.map(row => (
                      <tr key={`${row.source}:${row.originalIndex}`} className="hover:bg-white/5">
                        <th scope="row" className="sticky left-0 z-10 max-w-60 bg-[#1f1f1f] p-3 font-medium">{row.source}</th>
                        <td className="p-3 text-right font-mono">{row.attempts}</td><td className="p-3 text-right font-mono font-bold text-white">{row.genuineWins}</td><td className="p-3 text-right font-mono">{row.expectedWins.toFixed(2)}</td><td className="p-3 text-right font-mono">{signed(row.delta)}</td><td className="p-3 text-right font-mono">{decimal(row.zScore)}</td><td className="p-3 text-right font-mono">{percentage(row.actualRate)}</td><td className="p-3 text-right font-mono">{percentage(row.expectedRate)}</td><td className="p-3 text-right font-mono">{row.pityInterventions}</td><td className="p-3 text-right font-mono">{row.confirmedStandardKeys ?? '—'}</td><td className="p-3 text-right font-mono">{percentage(row.probabilityCoverage)}</td><td className="p-3">{row.sampleLabel}</td>
                      </tr>
                    ))}
                    {sortedRows.length === 0 && <tr><td colSpan={columns.length} className="p-8 text-center italic text-gray-600">No attempts match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
          </section>

          <section id="fate-panel-fate" role="tabpanel" aria-labelledby="fate-tab-fate" hidden={activeTab !== 'fate'} className="space-y-5">
              {!fateReport ? <div className="p-10 text-center italic text-gray-600">{fullHistoryHasAttempts ? 'No roll attempts in this selection' : "No rolls recorded yet — Fate hasn't had a chance to judge you."}</div> : <>
                <div className="rounded-lg border border-white/5 bg-[#1f1f1f] p-5 text-center">
                  <div className="text-2xl font-black tracking-wide text-gray-200">{fateReport.verdict ?? '—'}</div>
                  <p className="mt-2 text-sm text-gray-400">Overall: {fateReport.totalAttempts} attempts · {fateReport.genuineWins} genuine RNG wins</p>
                  <p className="mt-1 text-xs text-gray-500">Scoreable cohort: {fateReport.actual}/{fateReport.rolls} wins · {fateReport.expected.toFixed(2)} expected · {signed(fateReport.delta)} delta · {fateReport.zScore === null ? '—' : `${fateReport.zScore >= 0 ? '+' : ''}${fateReport.zScore.toFixed(2)}σ`}</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-emerald-500/15 bg-[#1f1f1f] p-3"><div className="text-[10px] font-bold uppercase text-emerald-400/80">Luckiest roll</div>{fateReport.luckiest ? <><div className="mt-1 truncate font-semibold text-gray-200">{fateReport.luckiest.source}</div><div className="text-[11px] text-gray-500">hit at {fateReport.luckiest.threshold.toFixed(2)}% odds</div></> : <div className="mt-1 text-xs italic text-gray-600">none scoreable</div>}</div>
                  <div className="rounded-lg border border-red-500/15 bg-[#1f1f1f] p-3"><div className="text-[10px] font-bold uppercase text-red-400/80">Cruelest miss</div>{fateReport.cruelest ? <><div className="mt-1 truncate font-semibold text-gray-200">{fateReport.cruelest.source}</div><div className="text-[11px] text-gray-500">missed at {fateReport.cruelest.threshold.toFixed(2)}% odds</div></> : <div className="mt-1 text-xs italic text-gray-600">none scoreable</div>}</div>
                  <div className="rounded-lg border border-white/5 bg-[#1f1f1f] p-3"><div className="text-[10px] font-bold uppercase text-gray-500">Current drought</div><div className="mt-1 text-xl font-black text-red-200">{analytics.summary.currentDrought}</div></div>
                  <div className="rounded-lg border border-white/5 bg-[#1f1f1f] p-3"><div className="text-[10px] font-bold uppercase text-gray-500">Longest hot streak</div><div className="mt-1 text-xl font-black text-emerald-300">{fateReport.longestHotStreak}</div></div>
                  <div className="rounded-lg border border-white/5 bg-[#1f1f1f] p-3"><div className="text-[10px] font-bold uppercase text-gray-500">Longest drought</div><div className="mt-1 text-xl font-black text-red-300">{fateReport.longestDrought}</div></div>
                </div>
                <div className="overflow-x-auto rounded-lg border border-white/5 bg-[#1f1f1f]">
                  <table className="w-full min-w-[900px] text-left text-xs"><thead className="bg-[#252525] font-bold uppercase text-gray-400"><tr><th className="p-3">Category</th><th className="p-3 text-right">Attempts</th><th className="p-3 text-right">Genuine wins</th><th className="p-3 text-right">Scoreable</th><th className="p-3 text-right">Scoreable wins</th><th className="p-3 text-right">Expected (scoreable)</th><th className="p-3 text-right">Delta (scoreable)</th><th className="p-3 text-right">Coverage</th><th className="p-3">Sample</th></tr></thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">{fateReport.categories.map(category => <tr key={category.category}><th scope="row" className="p-3 font-medium">{category.category}</th><td className="p-3 text-right font-mono">{category.totalAttempts}</td><td className="p-3 text-right font-mono">{category.genuineWins}</td><td className="p-3 text-right font-mono">{category.rolls}</td><td className="p-3 text-right font-mono">{category.actual}</td><td className="p-3 text-right font-mono">{category.expected.toFixed(2)}</td><td className="p-3 text-right font-mono">{signed(category.delta)}</td><td className="p-3 text-right font-mono">{percentage(category.probabilityCoverage)}</td><td className="p-3">{category.sampleLabel}</td></tr>)}</tbody>
                  </table>
                </div>
              </>}
              <KeyEconomyEvidenceExport history={history} gameMode={gameModeId ?? 'vanilla'} completionPercent={completionPercent(unlocks)} appVersion={__BUILD_ID__} />
          </section>
        </main>
      </div>
    </div>
  );
};
