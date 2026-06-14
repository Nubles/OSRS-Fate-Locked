import React from 'react';
import { Search, ChevronDown } from 'lucide-react';

/**
 * Status common to every Journal sub-tab. Diaries / CAs previously had no
 * status filter at all; bringing them under the same vocabulary lets the
 * three sub-tabs feel like one tool.
 */
export type JournalStatus = 'ALL' | 'AVAILABLE' | 'LOCKED' | 'COMPLETED';

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

      {/* One tidy row: status as a segmented control, region + tier as compact
          dropdowns (long pill rows were the messy part). */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex bg-black/40 rounded-lg p-0.5 gap-0.5 shrink-0">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => onStatusChange(s.value)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
                status === s.value ? accent : 'text-gray-500 hover:text-gray-200'
              }`}
            >
              {s.label}
              {typeof statusCounts?.[s.value] === 'number' && <span className="ml-1 font-mono opacity-60">{statusCounts[s.value]}</span>}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {regions && regions.length > 1 && onRegionChange && (
            <Dropdown value={activeRegion ?? 'ALL'} onChange={onRegionChange} allLabel="All regions" options={regions} active={activeRegion !== 'ALL'} accent={accent} aria="Filter by region" />
          )}
          {tiers && tiers.length > 0 && onTierChange && (
            <Dropdown value={activeTier ?? 'ALL'} onChange={onTierChange} allLabel="All tiers" options={tiers.map((t) => ({ id: t.id, label: t.label || t.id }))} active={activeTier !== 'ALL'} accent={accent} aria="Filter by tier" />
          )}
        </div>
      </div>
    </div>
  );
};

const STATUSES: { value: JournalStatus; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'LOCKED', label: 'Locked' },
  { value: 'COMPLETED', label: 'Done' },
];

interface DropdownProps {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: (string | { id: string; label: string })[];
  active: boolean;
  accent: string;
  aria: string;
}

const Dropdown: React.FC<DropdownProps> = ({ value, onChange, allLabel, options, active, accent, aria }) => {
  const accentText = accent.split(' ').find((c) => c.startsWith('text-')) || 'text-gray-300';
  return (
    <div className="relative shrink-0">
      <select
        aria-label={aria}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none bg-black/40 border rounded-lg pl-2.5 pr-6 py-1 text-[11px] font-semibold focus:outline-none transition-colors ${
          active ? `border-current ${accentText}` : 'border-white/10 text-gray-400 hover:border-white/30'
        }`}
      >
        <option value="ALL">{allLabel}</option>
        {options.map((o) => {
          const id = typeof o === 'string' ? o : o.id;
          const label = typeof o === 'string' ? o : o.label;
          return <option key={id} value={id}>{label}</option>;
        })}
      </select>
      <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
    </div>
  );
};
