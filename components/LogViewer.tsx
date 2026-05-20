
import React, { useRef, useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { useGame } from '../context/GameContext';
import { Scroll, Search, Filter, Dices, Lock, Unlock, Zap, TrendingUp, AlertCircle, CheckCircle2, XCircle, Sparkles, Skull, ArrowUp, ArrowDown, Film } from 'lucide-react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { LogEntry } from '../types';
import { isRollEntry } from '../utils/logEntry';
import { ModalFallback } from './LoadingFallback';
import { useEscapeKey } from '../hooks/useEscapeKey';

const TimelapseModal = lazy(() => import('./TimelapseModal').then(m => ({ default: m.TimelapseModal })));

type FilterType = 'ALL' | 'ROLLS' | 'UNLOCKS' | 'RITUALS' | 'PROGRESS';
type SortOrder = 'ASC' | 'DESC';

// --- Helper: Get Style Config based on Log Type ---
const getLogStyle = (entry: LogEntry) => {
  switch (entry.type) {
    case 'ROLL_SUCCESS':
    case 'PITY':
      return {
        icon: CheckCircle2,
        color: 'text-emerald-400',
        border: 'border-l-emerald-500',
        bg: 'bg-emerald-900/10',
        glow: 'group-hover:shadow-[inset_0_0_20px_rgba(16,185,129,0.1)]'
      };
    case 'ROLL_FAIL':
      return {
        icon: XCircle,
        color: 'text-red-400',
        border: 'border-l-red-500',
        bg: 'bg-red-900/10',
        glow: 'group-hover:shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]'
      };
    case 'ROLL_OMNI':
      return {
        icon: Sparkles,
        color: 'text-purple-400',
        border: 'border-l-purple-500',
        bg: 'bg-purple-900/10',
        glow: 'group-hover:shadow-[inset_0_0_20px_rgba(168,85,247,0.1)]'
      };
    case 'UNLOCK':
      return {
        icon: Unlock,
        color: 'text-amber-400',
        border: 'border-l-amber-500',
        bg: 'bg-amber-900/10',
        glow: 'group-hover:shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]'
      };
    case 'ALTAR':
      return {
        icon: Zap,
        color: 'text-blue-400',
        border: 'border-l-blue-500',
        bg: 'bg-blue-900/10',
        glow: 'group-hover:shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]'
      };
    case 'LEVEL_UP':
      return {
        icon: TrendingUp,
        color: 'text-cyan-400',
        border: 'border-l-cyan-500',
        bg: 'bg-cyan-900/10',
        glow: 'group-hover:shadow-[inset_0_0_20px_rgba(34,211,238,0.1)]'
      };
    default:
      return {
        icon: AlertCircle,
        color: 'text-gray-400',
        border: 'border-l-gray-500',
        bg: 'bg-gray-800/10',
        glow: ''
      };
  }
};

// --- Row Component ---
const LogRow = ({ index, style, data }: ListChildComponentProps<{ entries: LogEntry[] }>) => {
  const entry = data.entries[index];
  const styles = getLogStyle(entry);
  const Icon = styles.icon;
  const date = new Date(entry.timestamp);
  
  // Format specific data for rolls (includes PITY — it's a roll outcome too).
  const isRoll = isRollEntry(entry);
  const rollVal = entry.rollValue;
  const threshold = entry.threshold;

  return (
    <div style={style} className="px-2 py-1">
      <div className={`
        relative h-full rounded border-l-[3px] ${styles.border} ${styles.bg} ${styles.glow}
        transition-all duration-200 hover:bg-white/5 group border-y border-r border-white/5
        flex flex-col justify-center px-3
      `}>
        
        {/* Top Row: Icon, Time, Title */}
        <div className="flex items-center gap-2 mb-1">
          <Icon size={14} className={styles.color} />
          <span className="text-[10px] text-gray-500 font-mono">
            {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className={`text-xs font-bold truncate ${styles.color}`}>
            {entry.message}
          </span>
        </div>

        {/* Bottom Row: Details & Metadata */}
        <div className="flex justify-between items-end">
          <div className="text-[10px] text-gray-400 truncate pr-2 flex-1">
            {entry.source ? <span className="text-gray-500 mr-1">[{entry.source}]</span> : null}
            {entry.details}
          </div>

          {/* Roll Visualizer */}
          {isRoll && rollVal !== undefined && threshold !== undefined && (
            <div className="flex items-center gap-2 bg-black/40 px-2 py-0.5 rounded border border-white/5 shrink-0">
               <span className={`text-[10px] font-mono font-bold ${rollVal <= threshold ? 'text-green-400' : 'text-red-400'}`}>
                 {rollVal}
               </span>
               <span className="text-[8px] text-gray-600">vs</span>
               <span className="text-[10px] font-mono text-gray-400">
                 {threshold}
               </span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export const LogViewer: React.FC = () => {
  const { history } = useGame();
  const listRef = useRef<List>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [showTimelapse, setShowTimelapse] = useState(false);

  useEscapeKey(() => setShowTimelapse(false), showTimelapse);

  // Filtering Logic
  const filteredHistory = useMemo(() => {
    let filtered = [...history]; // Copy to avoid mutation during sort

    // 1. Category Filter
    if (filterType !== 'ALL') {
      filtered = filtered.filter(entry => {
        if (filterType === 'ROLLS') return isRollEntry(entry);
        if (filterType === 'UNLOCKS') return entry.type === 'UNLOCK';
        if (filterType === 'RITUALS') return entry.type === 'ALTAR';
        if (filterType === 'PROGRESS') return entry.type === 'LEVEL_UP';
        return true;
      });
    }

    // 2. Search Filter
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.message.toLowerCase().includes(lowerTerm) || 
        (entry.details && entry.details.toLowerCase().includes(lowerTerm)) ||
        (entry.source && entry.source.toLowerCase().includes(lowerTerm))
      );
    }

    // 3. Sorting
    filtered.sort((a, b) => {
        return sortOrder === 'ASC' 
            ? a.timestamp - b.timestamp 
            : b.timestamp - a.timestamp;
    });

    return filtered; 
  }, [history, filterType, searchTerm, sortOrder]);

  // Auto-scroll logic
  useEffect(() => {
    if (listRef.current && !searchTerm && filterType === 'ALL') {
      // If ASC (Chronological), scroll to bottom to see newest
      if (sortOrder === 'ASC') {
          listRef.current.scrollToItem(filteredHistory.length - 1, 'end');
      } else {
          // If DESC (Reverse Chronological), scroll to top to see newest
          listRef.current.scrollToItem(0, 'start');
      }
    }
  }, [filteredHistory.length, searchTerm, filterType, sortOrder]);

  const FilterButton = ({ type, label, icon: Icon }: { type: FilterType, label: string, icon: any }) => (
    <button
      onClick={() => setFilterType(type)}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border transition-all shrink-0
        ${filterType === type 
          ? 'bg-white text-black border-white shadow-[0_0_10px_rgba(255,255,255,0.2)]' 
          : 'bg-black/30 text-gray-500 border-white/10 hover:border-white/30 hover:text-gray-300'}
      `}
    >
      <Icon size={12} /> {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col relative bg-[#121212] rounded-lg overflow-hidden border border-white/5">
      
      {/* Header Toolbar */}
      <div className="p-3 border-b border-white/10 bg-[#1a1a1a] flex flex-col gap-3 shrink-0">
        
        <div className="flex justify-between items-center">
          <h3 className="text-gray-200 text-sm font-bold flex items-center gap-2">
            <Scroll size={16} className="text-amber-500" />
            Fate Timeline
            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-500 font-mono">
              {filteredHistory.length}
            </span>
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTimelapse(true)}
              className="text-[10px] flex items-center gap-1.5 text-amber-300 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-900/50 px-2 py-1.5 rounded border border-amber-500/40 transition-all"
              title="Play back history as a verified timelapse"
            >
              <Film size={12} />
              Timelapse
            </button>
            <button
              onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
              className="text-[10px] flex items-center gap-1.5 text-gray-400 hover:text-white bg-black/40 hover:bg-black/60 px-2 py-1.5 rounded border border-white/10 transition-all"
              title={sortOrder === 'ASC' ? "Sort: Oldest First" : "Sort: Newest First"}
            >
              {sortOrder === 'ASC' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
              {sortOrder === 'ASC' ? 'Old -> New' : 'New -> Old'}
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
            <input 
              type="text" 
              placeholder="Search history..." 
              className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/50 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
             <FilterButton type="ALL" label="All" icon={Filter} />
             <FilterButton type="ROLLS" label="Rolls" icon={Dices} />
             <FilterButton type="UNLOCKS" label="Unlocks" icon={Unlock} />
             <FilterButton type="RITUALS" label="Rituals" icon={Zap} />
             <FilterButton type="PROGRESS" label="Level" icon={TrendingUp} />
          </div>
        </div>
      </div>
      
      {/* Log List */}
      <div className="flex-1 min-h-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {filteredHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 gap-2">
             <Search size={32} className="opacity-20" />
             <p className="text-xs">No records found matching criteria.</p>
          </div>
        ) : (
          <AutoSizer>
            {({ height, width }) => (
              <List
                ref={listRef}
                height={height}
                itemCount={filteredHistory.length}
                itemSize={64} 
                width={width}
                className="custom-scrollbar"
                itemData={{ entries: filteredHistory }}
              >
                {LogRow}
              </List>
            )}
          </AutoSizer>
        )}
      </div>
      {showTimelapse && (
        <Suspense fallback={<ModalFallback label="Loading timelapse…" />}>
          <TimelapseModal history={history} onClose={() => setShowTimelapse(false)} />
        </Suspense>
      )}
    </div>
  );
};
