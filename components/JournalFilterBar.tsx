import React from 'react';
import { Search } from 'lucide-react';

/**
 * Status common to every Journal sub-tab. Diaries / CAs previously had no
 * status filter at all; bringing them under the same vocabulary lets the
 * three sub-tabs feel like one tool.
 */
export type JournalStatus = 'ALL' | 'AVAILABLE' | 'LOCKED' | 'COMPLETED';

interface PillProps<T extends string> {
  value: T;
  active: T;
  onClick: (v: T) => void;
  label: string;
  count?: number;
  accent: string;
}

const Pill = <T extends string>({ value, active, onClick, label, count, accent }: PillProps<T>) => (
  <button
    onClick={() => onClick(value)}
    className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
      active === value
        ? `${accent} border-current`
        : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/30'
    }`}
  >
    {label}
    {typeof count === 'number' && <span className="ml-1 font-mono opacity-70">({count})</span>}
  </button>
);

interface JournalFilterBarProps {
  /** Visual title shown on the left (e.g. "Quest Journal", "Diaries", "Combat Achievements"). */
  title: string;
  icon: React.ReactNode;
  /** Tailwind classes for the active-pill accent (e.g. "bg-blue-900/40 text-blue-300"). */
  accent: string;

  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;

  status: JournalStatus;
  onStatusChange: (s: JournalStatus) => void;
  /** Optional per-status counts shown as ` (12)` after each pill. */
  statusCounts?: Partial<Record<JournalStatus, number>>;

  /** Overall completion progress shown as a bar + numeric label. */
  completed: number;
  total: number;

  /** Optional region filter pills. If provided, a row of region chips is rendered. */
  regions?: string[];
  activeRegion?: string; // 'ALL' or one of regions
  onRegionChange?: (r: string) => void;

  /** Optional tier / difficulty filter pills. */
  tiers?: { id: string; label?: string; colorClass?: string }[];
  activeTier?: string; // 'ALL' or one of tiers' ids
  onTierChange?: (t: string) => void;

  /** Right-aligned extra controls (per-tab specifics like "Group by series"). */
  rightExtras?: React.ReactNode;
}

export const JournalFilterBar: React.FC<JournalFilterBarProps> = ({
  title, icon, accent,
  searchValue, onSearchChange, searchPlaceholder,
  status, onStatusChange, statusCounts,
  completed, total,
  regions, activeRegion, onRegionChange,
  tiers, activeTier, onTierChange,
  rightExtras,
}) => {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  return (
    <div className="p-3 border-b border-white/10 bg-[#1a1a1a] shrink-0 space-y-2">
      {/* Top row: title + progress + extras */}
      <div className="flex items-center gap-3">
        <h2 className={`text-sm font-bold flex items-center gap-2 ${accent.split(' ').find((c) => c.startsWith('text-')) || ''}`}>
          {icon} {title}
        </h2>
        <div className="flex-1 min-w-0">
          <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct > 75 ? 'bg-green-600' : pct > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <span className="text-[10px] text-gray-500 font-mono shrink-0">
          {completed}/{total} <span className="opacity-70">({pct}%)</span>
        </span>
        {rightExtras}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
        <input
          type="text"
          placeholder={searchPlaceholder || 'Search...'}
          className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/30 transition-colors"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Status pills + tier pills on the same row when there's room */}
      <div className="flex flex-wrap gap-1.5 items-center">
        <Pill value="ALL"        active={status} onClick={onStatusChange} label="All"        count={statusCounts?.ALL}        accent={accent} />
        <Pill value="AVAILABLE"  active={status} onClick={onStatusChange} label="Available"  count={statusCounts?.AVAILABLE}  accent={accent} />
        <Pill value="LOCKED"     active={status} onClick={onStatusChange} label="Locked"     count={statusCounts?.LOCKED}     accent={accent} />
        <Pill value="COMPLETED"  active={status} onClick={onStatusChange} label="Completed"  count={statusCounts?.COMPLETED}  accent={accent} />

        {tiers && tiers.length > 0 && onTierChange && (
          <>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={() => onTierChange('ALL')}
              className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                activeTier === 'ALL' ? `${accent} border-current` : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/30'
              }`}
            >
              All tiers
            </button>
            {tiers.map((t) => (
              <button
                key={t.id}
                onClick={() => onTierChange(t.id)}
                className={`shrink-0 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                  activeTier === t.id
                    ? `${t.colorClass || accent} border-current`
                    : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/30'
                }`}
              >
                {t.label || t.id}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Region pills (only when provided). Hidden when there are <2 regions. */}
      {regions && regions.length > 1 && onRegionChange && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => onRegionChange('ALL')}
            className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border transition-colors ${
              activeRegion === 'ALL' ? `${accent} border-current` : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/30'
            }`}
          >
            All regions
          </button>
          {regions.map((r) => (
            <button
              key={r}
              onClick={() => onRegionChange(r)}
              className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full border transition-colors ${
                activeRegion === r ? `${accent} border-current` : 'bg-black/30 border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/30'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
