
import React, { useMemo, useState, useRef, lazy, Suspense } from 'react';
import { useGame } from '../context/GameContext';
import { SectionGuide } from './SectionGuide';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { X, TrendingUp, TrendingDown, Skull, Key, Shield, Activity, BarChart3, LineChart as LineChartIcon, PieChart, List, ArrowUpDown, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';
import { isRollEntry } from '../utils/logEntry';
import { buildFateReport } from '../utils/fateReport';
import { buildRollDistribution } from '../utils/rollDistribution';
import { LogEntry } from '../types';
// Charts (recharts, ~300 KB) live in their own lazily-loaded chunk so opening
// Stats to see the overview/breakdown/fate tabs doesn't pay the recharts tax.
const StatsChartsView = lazy(() => import('./StatsChartsView'));

interface StatsModalProps {
  onClose: () => void;
}

type Tab = 'overview' | 'charts' | 'breakdown' | 'fate';
type SortKey = 'source' | 'attempts' | 'success' | 'actualRate' | 'expectedRate';

export const buildStats = (history: LogEntry[]) => {
  const rolls = history.filter(isRollEntry).sort((a, b) => a.timestamp - b.timestamp);
  const totalRolls = rolls.length;
  const actualSuccesses = rolls.filter(h => h.result === 'SUCCESS').length;
  const pityKeys = history.filter(h => h.type === 'PITY').length;
  const sourceStats: Record<string, { attempts: number; success: number; expected: number }> = {};

  let cumulativeExpected = 0;
  let cumulativeActual = 0;
  const luckTrend = rolls.map((roll, i) => {
    const prob = (roll.threshold || 0) / 100;
    cumulativeExpected += prob;
    if (roll.result === 'SUCCESS') cumulativeActual += 1;

    const source = roll.source || 'Unknown';
    if (!sourceStats[source]) {
      sourceStats[source] = { attempts: 0, success: 0, expected: 0 };
    }
    sourceStats[source].attempts++;
    sourceStats[source].expected += prob;
    if (roll.result === 'SUCCESS') sourceStats[source].success++;

    return {
      index: i + 1,
      luck: cumulativeActual - cumulativeExpected,
      actual: cumulativeActual,
      expected: cumulativeExpected,
      isSuccess: roll.result === 'SUCCESS',
    };
  });

  const expectedSuccesses = cumulativeExpected;
  const luckScore = actualSuccesses - expectedSuccesses;
  const luckPercent = expectedSuccesses > 0
    ? ((actualSuccesses - expectedSuccesses) / expectedSuccesses) * 100
    : 0;
  const buckets = buildRollDistribution(rolls);

  let maxDry = 0;
  let currentDry = 0;
  rolls.forEach(r => {
    if (r.result === 'FAIL') currentDry++;
    else {
      if (currentDry > maxDry) maxDry = currentDry;
      currentDry = 0;
    }
  });
  if (currentDry > maxDry) maxDry = currentDry;

  let activeDry = 0;
  for (let i = rolls.length - 1; i >= 0; i--) {
    if (rolls[i].result === 'FAIL') activeDry++;
    else break;
  }

  return {
    totalRolls,
    actualSuccesses,
    pityKeys,
    expectedSuccesses,
    luckScore,
    luckPercent,
    maxDry,
    activeDry,
    luckTrend,
    buckets,
    sourceStats,
  };
};

export const StatsModal: React.FC<StatsModalProps> = ({ onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const { history } = useGame();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'attempts', direction: 'desc' });
  const fateReport = useMemo(() => buildFateReport(history), [history]);

  const stats = useMemo(() => buildStats(history), [history]);

  // Sorting Logic for Breakdown Tab
  const sortedBreakdown = useMemo(() => {
    const data = Object.entries(stats.sourceStats).map(([source, val]) => {
        const v = val as { attempts: number; success: number; expected: number };
        return {
            source,
            attempts: v.attempts,
            success: v.success,
            actualRate: (v.success / v.attempts) * 100,
            expectedRate: (v.expected / v.attempts) * 100
        };
    });

    return data.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
  }, [stats.sourceStats, sortConfig]);

  const handleSort = (key: SortKey) => {
      let direction: 'asc' | 'desc' = 'desc';
      // If clicking the same key, toggle direction. Default to desc for numbers.
      if (sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
      if (sortConfig.key !== column) return <ArrowUpDown size={12} className="opacity-30" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={12} className="text-osrs-gold" /> : <ArrowDown size={12} className="text-osrs-gold" />;
  };


  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Fate Analytics" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#161616] border border-osrs-border w-full max-w-5xl rounded-lg shadow-2xl overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#2d2d2d] p-4 border-b border-osrs-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-900/30 rounded border border-blue-500/30">
                <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-100 flex items-center gap-2">Fate Analytics <SectionGuide id="STATS" /></h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-osrs-border bg-[#1a1a1a] shrink-0">
            <button 
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'overview' ? 'border-osrs-gold text-osrs-gold bg-osrs-gold/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <PieChart size={16} /> Overview
            </button>
            <button 
                onClick={() => setActiveTab('charts')}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'charts' ? 'border-osrs-gold text-osrs-gold bg-osrs-gold/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <LineChartIcon size={16} /> Visualizations
            </button>
            <button
                onClick={() => setActiveTab('breakdown')}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'breakdown' ? 'border-osrs-gold text-osrs-gold bg-osrs-gold/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <List size={16} /> Activity Breakdown
            </button>
            <button
                onClick={() => setActiveTab('fate')}
                className={`px-6 py-3 text-sm font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'fate' ? 'border-osrs-gold text-osrs-gold bg-osrs-gold/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
            >
                <Sparkles size={16} /> Fate Report
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#111] p-6">
            
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    {/* Luck Meter */}
                    <div className="bg-gradient-to-r from-gray-900 to-[#1a1a1a] rounded-lg p-6 border border-white/5 relative overflow-hidden text-center shadow-lg">
                        <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Luck Deviation</h3>
                        <div className="flex items-center justify-center gap-4 mb-2 relative z-10">
                            {stats.luckScore >= 0 ? <TrendingUp className="w-12 h-12 text-green-500" /> : <TrendingDown className="w-12 h-12 text-red-500" />}
                            <div className="text-6xl font-black text-white tracking-tighter drop-shadow-lg">
                                {stats.luckScore > 0 ? '+' : ''}{stats.luckScore.toFixed(2)}
                            </div>
                        </div>
                        <p className={`text-sm font-mono ${stats.luckScore >= 0 ? 'text-green-400' : 'text-red-400'} relative z-10`}>
                            {Math.abs(stats.luckScore).toFixed(2)} Keys {stats.luckScore >= 0 ? 'above' : 'below'} rate
                        </p>
                        <div className={`absolute bottom-0 left-0 h-1 transition-all duration-1000 ${stats.luckScore >= 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, Math.abs(stats.luckPercent))}%` }}></div>
                    </div>

                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-[#1f1f1f] p-4 rounded border border-white/5 flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Rolls</span>
                            <span className="text-2xl font-bold text-white">{stats.totalRolls}</span>
                        </div>
                        <div className="bg-[#1f1f1f] p-4 rounded border border-white/5 flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">RNG Keys</span>
                            <span className="text-2xl font-bold text-osrs-gold flex items-center gap-2"><Key size={16} /> {stats.actualSuccesses}</span>
                        </div>
                        <div className="bg-[#1f1f1f] p-4 rounded border border-white/5 flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Pity Keys</span>
                            <span className="text-2xl font-bold text-osrs-pity flex items-center gap-2"><Shield size={16} /> {stats.pityKeys}</span>
                        </div>
                        <div className="bg-[#1f1f1f] p-4 rounded border border-white/5 flex flex-col items-center">
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Max Dry Streak</span>
                            <span className="text-2xl font-bold text-red-400 flex items-center gap-2"><Skull size={16} /> {stats.maxDry}</span>
                        </div>
                    </div>

                    {/* Detailed Stats Text */}
                    <div className="bg-[#1f1f1f] p-5 rounded border border-white/5">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-700 pb-2 mb-4">Statistical Deep Dive</h3>
                        <div className="grid grid-cols-2 gap-y-3 text-sm font-mono">
                            <div className="text-gray-500">Expected Keys:</div>
                            <div className="text-right text-gray-300">{stats.expectedSuccesses.toFixed(3)}</div>
                            
                            <div className="text-gray-500">Luck Percentage:</div>
                            <div className={`text-right ${stats.luckPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {stats.luckPercent > 0 ? '+' : ''}{stats.luckPercent.toFixed(1)}%
                            </div>
                            
                            <div className="text-gray-500">Current Dry Streak:</div>
                            <div className="text-right text-white">{stats.activeDry} rolls</div>
                            
                            <div className="text-gray-500">Average Roll Value:</div>
                            <div className="text-right text-white">
                                {(history.filter(isRollEntry).reduce((a, b) => a + (b.rollValue || 0), 0) / (stats.totalRolls || 1)).toFixed(1)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* CHARTS TAB (recharts, lazy-loaded on demand) */}
            {activeTab === 'charts' && (
                <Suspense fallback={<div className="h-[300px] flex items-center justify-center text-gray-600 text-xs italic">Loading charts…</div>}>
                    <StatsChartsView stats={stats} />
                </Suspense>
            )}

            {/* BREAKDOWN TAB */}
            {activeTab === 'breakdown' && (
                 <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                    <div className="bg-[#1f1f1f] border border-white/5 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-[#252525] text-gray-400 uppercase font-bold">
                                <tr>
                                    <th className="p-3 cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('source')}>
                                        <div className="flex items-center gap-2">Source Activity <SortIcon column="source" /></div>
                                    </th>
                                    <th className="p-3 text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('attempts')}>
                                        <div className="flex items-center justify-end gap-2"><SortIcon column="attempts" /> Attempts</div>
                                    </th>
                                    <th className="p-3 text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('success')}>
                                        <div className="flex items-center justify-end gap-2"><SortIcon column="success" /> Success</div>
                                    </th>
                                    <th className="p-3 text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('actualRate')}>
                                        <div className="flex items-center justify-end gap-2"><SortIcon column="actualRate" /> Rate</div>
                                    </th>
                                    <th className="p-3 text-right cursor-pointer hover:bg-white/5 transition-colors group" onClick={() => handleSort('expectedRate')}>
                                        <div className="flex items-center justify-end gap-2"><SortIcon column="expectedRate" /> Exp. Rate</div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {sortedBreakdown.map((data) => {
                                    const isLucky = data.actualRate >= data.expectedRate;
                                    return (
                                        <tr key={data.source} className="hover:bg-white/5 transition-colors">
                                            <td className="p-3 font-medium truncate max-w-[150px]">{data.source}</td>
                                            <td className="p-3 text-right font-mono text-gray-500">{data.attempts}</td>
                                            <td className="p-3 text-right font-mono text-white font-bold">{data.success}</td>
                                            <td className={`p-3 text-right font-mono font-bold ${isLucky ? 'text-green-400' : 'text-red-400'}`}>
                                                {data.actualRate.toFixed(1)}%
                                            </td>
                                            <td className="p-3 text-right font-mono text-gray-500">
                                                {data.expectedRate.toFixed(1)}%
                                            </td>
                                        </tr>
                                    );
                                })}
                                {sortedBreakdown.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-600 italic">No data recorded yet.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                 </div>
            )}

            {/* FATE REPORT TAB — "how lucky has this run actually been?" */}
            {activeTab === 'fate' && (
                <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
                    {!fateReport ? (
                        <div className="p-10 text-center text-gray-600 italic">No rolls recorded yet — Fate hasn't had a chance to judge you.</div>
                    ) : (
                        <>
                            {/* Verdict headline */}
                            <div className="bg-[#1f1f1f] border border-white/5 rounded-lg p-5 text-center">
                                <div className={`text-2xl font-black tracking-wide ${fateReport.zScore >= 1 ? 'text-emerald-300' : fateReport.zScore <= -1 ? 'text-red-300' : 'text-gray-200'}`}>
                                    {fateReport.verdict}
                                </div>
                                <p className="text-xs text-gray-500 mt-1.5">
                                    {fateReport.actual} successes across {fateReport.rolls} rolls, where the odds predicted {fateReport.expected.toFixed(1)} —{' '}
                                    <span className={fateReport.delta >= 0 ? 'text-emerald-400 font-semibold' : 'text-red-400 font-semibold'}>
                                        {fateReport.delta >= 0 ? '+' : ''}{fateReport.delta.toFixed(1)} keys vs expectation
                                    </span>{' '}
                                    ({fateReport.zScore >= 0 ? '+' : ''}{fateReport.zScore.toFixed(1)}σ)
                                </p>
                            </div>

                            {/* Notable rolls + streaks */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-[#1f1f1f] border border-emerald-500/15 rounded-lg p-3">
                                    <div className="text-[10px] uppercase font-bold text-emerald-400/80 mb-1">Luckiest roll</div>
                                    {fateReport.luckiest
                                        ? <><div className="text-sm text-gray-200 font-semibold truncate">{fateReport.luckiest.source}</div><div className="text-[11px] text-gray-500">hit at {fateReport.luckiest.threshold}% odds</div></>
                                        : <div className="text-[11px] text-gray-600 italic">none yet</div>}
                                </div>
                                <div className="bg-[#1f1f1f] border border-red-500/15 rounded-lg p-3">
                                    <div className="text-[10px] uppercase font-bold text-red-400/80 mb-1">Cruelest miss</div>
                                    {fateReport.cruelest
                                        ? <><div className="text-sm text-gray-200 font-semibold truncate">{fateReport.cruelest.source}</div><div className="text-[11px] text-gray-500">missed at {fateReport.cruelest.threshold}% odds</div></>
                                        : <div className="text-[11px] text-gray-600 italic">none yet</div>}
                                </div>
                                <div className="bg-[#1f1f1f] border border-white/5 rounded-lg p-3">
                                    <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Longest hot streak</div>
                                    <div className="text-xl font-black text-emerald-300">{fateReport.longestHotStreak}</div>
                                    <div className="text-[11px] text-gray-500">successes in a row</div>
                                </div>
                                <div className="bg-[#1f1f1f] border border-white/5 rounded-lg p-3">
                                    <div className="text-[10px] uppercase font-bold text-gray-500 mb-1">Longest drought</div>
                                    <div className="text-xl font-black text-red-300">{fateReport.longestDrought}</div>
                                    <div className="text-[11px] text-gray-500">failures in a row</div>
                                </div>
                            </div>

                            {/* Per-category luck */}
                            <div className="bg-[#1f1f1f] border border-white/5 rounded-lg overflow-hidden">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-[#252525] text-gray-400 uppercase font-bold">
                                        <tr>
                                            <th className="p-3">Category</th>
                                            <th className="p-3 text-right">Rolls</th>
                                            <th className="p-3 text-right">Won</th>
                                            <th className="p-3 text-right">Expected</th>
                                            <th className="p-3 text-right">Luck</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 text-gray-300">
                                        {fateReport.categories.map((c) => (
                                            <tr key={c.category} className="hover:bg-white/5 transition-colors">
                                                <td className="p-3 font-medium">{c.category}</td>
                                                <td className="p-3 text-right font-mono text-gray-500">{c.rolls}</td>
                                                <td className="p-3 text-right font-mono text-white font-bold">{c.actual}</td>
                                                <td className="p-3 text-right font-mono text-gray-500">{c.expected.toFixed(1)}</td>
                                                <td className={`p-3 text-right font-mono font-bold ${c.delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    {c.delta >= 0 ? '+' : ''}{c.delta.toFixed(1)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

        </div>
      </div>
    </div>
  );
};
