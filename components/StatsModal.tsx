import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Clover, Flame, Hourglass, LifeBuoy, List, Skull, TimerReset, X } from 'lucide-react';
import { Activity, Sparkles } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { completionPercent } from '../utils/completion';
import { buildFateAnalytics, defaultFateAnalyticsQuery, type AnalyticsAggregate } from '../utils/fateAnalytics';
import { fateReportFromAnalytics } from '../utils/fateReport';
import { lazyWithRetry } from '../utils/lazyRetry';
import { isRollEntry } from '../utils/logEntry';
import { AnalyticsControls } from './stats/AnalyticsControls';
import { AnalyticsKpis } from './stats/AnalyticsKpis';
import { LuckSummary } from './stats/LuckSummary';
import { plural, selectionDateRange, signedFixed } from './stats/luck';
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

interface Column { key: AnalyticsSortKey; label: string; numeric?: boolean; hint?: string }

const mainColumns: Column[] = [
  { key: 'source', label: 'Activity' },
  { key: 'attempts', label: 'Rolls', numeric: true },
  { key: 'genuineWins', label: 'Wins', numeric: true, hint: 'Genuine wins; pity keys are counted separately' },
  { key: 'actualRate', label: 'Win rate vs expected', hint: 'Bar: how often you won. Tick: what the odds expected' },
  { key: 'delta', label: 'Luck', numeric: true, hint: 'Wins minus the wins the odds expected' },
  { key: 'pityInterventions', label: 'Pity', numeric: true },
  { key: 'sampleLabel', label: 'Sample' },
];

const technicalColumns: Column[] = [
  { key: 'expectedWins', label: 'Expected wins', numeric: true },
  { key: 'zScore', label: 'Z-score', numeric: true },
  { key: 'expectedRate', label: 'Expected rate', numeric: true },
  { key: 'confirmedStandardKeys', label: 'Standard Keys', numeric: true },
  { key: 'probabilityCoverage', label: 'Known odds', numeric: true },
];

const sampleStyle: Record<AnalyticsBreakdownRow['sampleLabel'], string> = {
  'Established sample': 'border-white/10 text-gray-300',
  'Developing sample': 'border-sky-400/25 text-sky-300',
  'Limited sample': 'border-amber-400/30 text-amber-300',
};

const SamplePill: React.FC<{ label: AnalyticsBreakdownRow['sampleLabel'] }> = ({ label }) => (
  <span title={label} className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${sampleStyle[label]}`}>{label.replace(' sample', '')}</span>
);

const luckTone = (zScore: number | null, modelled: boolean): string => {
  if (!modelled || zScore === null) return 'bg-white/[0.06] text-gray-300';
  if (zScore >= 1) return 'bg-emerald-400/15 text-emerald-300';
  if (zScore <= -1) return 'bg-rose-400/15 text-rose-300';
  return 'bg-white/[0.06] text-gray-200';
};

const Highlight: React.FC<{ icon: React.ReactNode; tint: string; label: string; value: React.ReactNode; detail?: React.ReactNode }> = ({ icon, tint, label, value, detail }) => (
  <div className="flex gap-3 rounded-xl border border-white/[0.06] bg-[#1a1a1a] p-4">
    <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tint}`}>{icon}</span>
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</div>
      <div className="mt-0.5 truncate text-lg font-bold text-gray-100">{value}</div>
      {detail && <div className="text-[11px] text-gray-500">{detail}</div>}
    </div>
  </div>
);

const percentage = (value: number | null): string => value === null ? '—' : `${(value * 100).toFixed(1)}%`;
const decimal = (value: number | null): string => value === null ? '—' : value.toFixed(2);
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
  const { history, unlocks, gameModeId , customMode} = useGame();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [query, setQuery] = useState(() => defaultFateAnalyticsQuery(Date.now()));
  const [sortConfig, setSortConfig] = useState<{ key: AnalyticsSortKey; direction: SortDirection }>({ key: 'attempts', direction: 'desc' });
  const [showTechnical, setShowTechnical] = useState(false);
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
  const visibleColumns = showTechnical ? [...mainColumns, ...technicalColumns] : mainColumns;
  const rateScale = Math.max(0.05, ...rows.flatMap(row => [row.actualRate ?? 0, row.expectedRate ?? 0]));
  const dateRange = selectionDateRange(analytics);
  const maxCategoryDelta = Math.max(0.5, ...(fateReport?.categories ?? []).map(category => category.rolls === 0 ? 0 : Math.abs(category.delta)));
  const renderSortHeader = (column: Column) => (
    <th key={column.key} aria-sort={ariaSort(column.key)} className={`p-0 ${column.key === 'source' ? 'sticky left-0 z-20 bg-[#1f1f1f]' : ''}`}>
      <button type="button" title={column.hint} onClick={() => handleSort(column.key)} className={`flex w-full items-center gap-1.5 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider hover:bg-white/5 hover:text-gray-200 ${column.numeric ? 'justify-end text-right' : ''} ${sortConfig.key === column.key ? 'text-amber-300' : ''}`}>
        {column.label}
        {sortConfig.key !== column.key ? <ArrowUpDown aria-hidden="true" size={11} className="opacity-30" /> : sortConfig.direction === 'asc' ? <ArrowUp aria-hidden="true" size={11} /> : <ArrowDown aria-hidden="true" size={11} />}
      </button>
    </th>
  );
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fate-analytics-title" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4">
      <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#121212] shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-gradient-to-r from-[#1e1e1e] to-[#161616] px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-2"><Activity className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 id="fate-analytics-title" className="flex items-center gap-2 text-lg font-bold text-gray-100">Fate Analytics <SectionGuide id="STATS" /></h2>
              <p className="truncate text-xs text-gray-500">
                {analytics.summary.attempts === 0 ? 'No rolls in this selection' : `${plural(analytics.summary.attempts, 'roll')}${dateRange ? ` · ${dateRange}` : ''}`}
              </p>
            </div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close Fate Analytics" className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        </header>

        <div role="tablist" aria-label="Fate Analytics sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/[0.06] bg-[#151515] px-3">
          {tabs.map(tab => (
            <button ref={node => { tabRefs.current[tab.id] = node; }} key={tab.id} id={`fate-tab-${tab.id}`} type="button" role="tab" aria-selected={activeTab === tab.id} aria-controls={`fate-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1} onClick={() => setActiveTab(tab.id)} onKeyDown={event => handleTabKeyDown(event, tab.id)} className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab.id ? 'border-amber-400 text-amber-300' : 'border-transparent text-gray-500 hover:text-gray-200'}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <AnalyticsControls query={query} onChange={handleQueryChange} coverage={analytics.coverage} availableSources={analytics.availableSources} availableCategories={analytics.availableCategories} exactOnlyAvailable={analytics.exactOnlyAvailable} />

        <main className="custom-scrollbar flex-1 overflow-y-auto bg-[#111] p-4 sm:p-5">
          <section id="fate-panel-dashboard" role="tabpanel" aria-labelledby="fate-tab-dashboard" hidden={activeTab !== 'dashboard'} className="space-y-4">
              <AnalyticsKpis analytics={analytics} />
              <Suspense fallback={<div className="flex h-[300px] items-center justify-center text-xs italic text-gray-600">Loading charts…</div>}><StatsChartsView analytics={analytics} /></Suspense>
          </section>

          <section id="fate-panel-breakdown" role="tabpanel" aria-labelledby="fate-tab-breakdown" hidden={activeTab !== 'breakdown'} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-400"><span className="font-semibold text-gray-200">Luck</span> is wins minus what the odds expected, counting rolls with known odds. Green is ahead, red is behind. Click a heading to sort.</p>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-300 hover:border-white/20">
                  <input type="checkbox" className="accent-amber-400" checked={showTechnical} onChange={event => setShowTechnical(event.target.checked)} />
                  Show technical columns
                </label>
              </div>
              <div role="region" aria-label="Activity breakdown" tabIndex={0} className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#1a1a1a]">
                <table className={`w-full text-left text-xs ${showTechnical ? 'min-w-[1180px]' : 'min-w-[820px]'}`}>
                  <thead className="border-b border-white/[0.06] bg-[#1f1f1f] text-gray-400"><tr>
                    {visibleColumns.map(renderSortHeader)}
                  </tr></thead>
                  <tbody className="divide-y divide-white/[0.04] text-gray-300">
                    {sortedRows.map(row => {
                      const modelled = row.expectedRate !== null;
                      return (
                        <tr key={`${row.source}:${row.originalIndex}`} className="hover:bg-white/[0.03]">
                          <th scope="row" className="sticky left-0 z-10 max-w-60 bg-[#1a1a1a] px-3 py-2.5 text-sm font-semibold text-gray-100">{row.source}</th>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.attempts}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-sm font-bold tabular-nums text-white">{row.genuineWins}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div aria-hidden="true" className="relative h-2 w-28 shrink-0 rounded-full bg-white/[0.06]">
                                {row.actualRate !== null && <div className="absolute inset-y-0 left-0 rounded-full bg-amber-400/80" style={{ width: `${Math.min(100, (row.actualRate / rateScale) * 100)}%` }} />}
                                {row.expectedRate !== null && <div className="absolute -inset-y-1 w-0.5 rounded bg-sky-300" style={{ left: `${Math.min(100, (row.expectedRate / rateScale) * 100)}%` }} />}
                              </div>
                              <span className="whitespace-nowrap font-mono tabular-nums">{percentage(row.actualRate)}<span className="text-gray-500"> / {percentage(row.expectedRate)}</span></span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`inline-block min-w-14 rounded-md px-2 py-0.5 text-center font-mono font-bold tabular-nums ${luckTone(row.zScore, modelled)}`}>{modelled ? signedFixed(row.delta, 2) : '—'}</span>
                          </td>
                          <td className={`px-3 py-2.5 text-right font-mono tabular-nums ${row.pityInterventions === 0 ? 'text-gray-600' : 'text-amber-300'}`}>{row.pityInterventions}</td>
                          <td className="px-3 py-2.5"><SamplePill label={row.sampleLabel} /></td>
                          {showTechnical && <>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.expectedWins.toFixed(2)}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{decimal(row.zScore)}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{percentage(row.expectedRate)}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{row.confirmedStandardKeys ?? '—'}</td>
                            <td className="px-3 py-2.5 text-right font-mono tabular-nums">{percentage(row.probabilityCoverage)}</td>
                          </>}
                        </tr>
                      );
                    })}
                    {sortedRows.length === 0 && <tr><td colSpan={visibleColumns.length} className="p-8 text-center italic text-gray-600">No attempts match these filters.</td></tr>}
                  </tbody>
                </table>
              </div>
          </section>

          <section id="fate-panel-fate" role="tabpanel" aria-labelledby="fate-tab-fate" hidden={activeTab !== 'fate'} className="space-y-4">
              {!fateReport ? <div className="p-10 text-center italic text-gray-600">{fullHistoryHasAttempts ? 'No roll attempts in this selection' : "No rolls recorded yet — Fate hasn't had a chance to judge you."}</div> : <>
                <LuckSummary analytics={analytics} variant="report" />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Highlight icon={<Clover size={18} />} tint="bg-emerald-400/10 text-emerald-300" label="Luckiest roll"
                    value={fateReport.luckiest ? fateReport.luckiest.source : <span className="text-sm italic text-gray-500">none with known odds</span>}
                    detail={fateReport.luckiest ? `won at ${fateReport.luckiest.threshold.toFixed(2)}% odds` : undefined} />
                  <Highlight icon={<Skull size={18} />} tint="bg-rose-400/10 text-rose-300" label="Cruellest miss"
                    value={fateReport.cruelest ? fateReport.cruelest.source : <span className="text-sm italic text-gray-500">none with known odds</span>}
                    detail={fateReport.cruelest ? `missed at ${fateReport.cruelest.threshold.toFixed(2)}% odds` : undefined} />
                  <Highlight icon={<Flame size={18} />} tint="bg-amber-400/10 text-amber-300" label="Longest hot streak"
                    value={plural(fateReport.longestHotStreak, 'win')} detail="in a row" />
                  <Highlight icon={<Hourglass size={18} />} tint="bg-sky-400/10 text-sky-300" label="Longest drought"
                    value={plural(fateReport.longestDrought, 'miss', 'misses')} detail="in a row" />
                  <Highlight icon={<TimerReset size={18} />} tint="bg-white/[0.06] text-gray-200" label="Current drought"
                    value={plural(analytics.summary.currentDrought, 'miss', 'misses')} detail={analytics.summary.currentDrought === 0 ? 'your last roll won' : 'and counting'} />
                  <Highlight icon={<LifeBuoy size={18} />} tint="bg-amber-400/10 text-amber-200" label="Pity keys"
                    value={analytics.summary.pityInterventions} detail={analytics.summary.pityInterventions === 1 ? 'time Fate stepped in' : 'times Fate stepped in'} />
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-[#1a1a1a]">
                  <div className="flex items-center justify-between gap-3 px-4 pt-4">
                    <h3 className="text-sm font-bold text-gray-100">Luck by category</h3>
                    <p className="text-[11px] text-gray-500">Expected and luck use rolls with known odds</p>
                  </div>
                  <table className="mt-2 w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/[0.06] text-[11px] uppercase tracking-wider text-gray-500"><tr><th className="px-4 py-2 font-semibold">Category</th><th className="px-3 py-2 text-right font-semibold">Rolls</th><th className="px-3 py-2 text-right font-semibold">Wins</th><th className="px-3 py-2 text-right font-semibold">Expected</th><th className="px-3 py-2 font-semibold">Luck</th><th className="px-3 py-2 font-semibold">Sample</th></tr></thead>
                    <tbody className="divide-y divide-white/[0.04] text-gray-300">{fateReport.categories.map(category => {
                      const modelled = category.rolls > 0;
                      const width = modelled ? (Math.abs(category.delta) / maxCategoryDelta) * 50 : 0;
                      return (
                        <tr key={category.category} className="hover:bg-white/[0.03]">
                          <th scope="row" className="px-4 py-2.5 text-sm font-semibold text-gray-100">{category.category}</th>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums">{category.totalAttempts}</td>
                          <td className="px-3 py-2.5 text-right font-mono font-bold tabular-nums text-white">{category.genuineWins}</td>
                          <td className="px-3 py-2.5 text-right font-mono tabular-nums text-gray-400">{modelled ? category.expected.toFixed(1) : '—'}{modelled && category.rolls < category.totalAttempts && <span className="block text-[10px] text-gray-600">from {category.rolls} rolls</span>}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-3">
                              <div aria-hidden="true" className="relative h-2.5 w-40 shrink-0 rounded-full bg-white/[0.04]">
                                <div className="absolute -inset-y-1 left-1/2 w-px bg-white/25" />
                                {modelled && width > 0 && <div className={`absolute inset-y-0 ${category.delta >= 0 ? 'left-1/2 rounded-r-full bg-emerald-400/80' : 'right-1/2 rounded-l-full bg-rose-400/80'}`} style={{ width: `${width}%` }} />}
                              </div>
                              <span className={`w-12 text-right font-mono font-bold tabular-nums ${!modelled ? 'text-gray-500' : category.delta >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{modelled ? signedFixed(category.delta, 1) : '—'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5"><SamplePill label={category.sampleLabel} /></td>
                        </tr>
                      );
                    })}</tbody>
                  </table>
                </div>
              </>}
              <KeyEconomyEvidenceExport history={history} gameMode={gameModeId ?? 'vanilla'} completionPercent={completionPercent(unlocks, gameModeId, customMode)} appVersion={__BUILD_ID__} />
          </section>
        </main>
      </div>
    </div>
  );
};
