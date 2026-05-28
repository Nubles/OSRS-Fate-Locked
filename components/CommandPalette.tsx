import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, X, BookOpen, Award, MapPin, Dumbbell, Swords, Crosshair, CornerDownLeft,
} from 'lucide-react';
import {
  SKILLS_LIST, REGION_GROUPS, REGIONS_LIST, BOSSES_LIST, MINIGAMES_LIST,
  FARMING_PATCH_LIST, MOBILITY_LIST, GUILDS_LIST, ARCANA_LIST, POH_LIST,
  STORAGE_LIST, MERCHANTS_LIST,
} from '../constants';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_CA_TASKS } from '../data/caTasks';
import { useEscapeKey } from '../hooks/useEscapeKey';

/**
 * Global command palette (Ctrl/Cmd-K).
 *
 * One fuzzy search box over everything in the tracker — quests, diary tiers,
 * regions, skills, combat-achievement targets, and every activity unlock —
 * with keyboard navigation to jump straight to the right tab. Selecting an
 * item drives the Dashboard's existing tab + search state via `onNavigate`,
 * so the destination filters itself down to the chosen entry.
 */

export type PaletteTab = 'CHARACTER' | 'WORLD' | 'ACTIVITIES' | 'JOURNAL' | 'COLLECTION';
export type PaletteSubTab = 'QUESTS' | 'DIARIES' | 'CA';

export interface PaletteCommand {
  id: string;
  label: string;
  sublabel: string;
  kind: 'quest' | 'diary' | 'region' | 'skill' | 'ca' | 'activity';
  tab: PaletteTab;
  subTab?: PaletteSubTab;
  worldView?: 'LIST';
  /** What to drop into the global search box (defaults to label). */
  search?: string;
}

interface Props {
  onClose: () => void;
  onNavigate: (cmd: PaletteCommand) => void;
}

const KIND_ICON: Record<PaletteCommand['kind'], React.ReactNode> = {
  quest: <BookOpen size={13} className="text-blue-300" />,
  diary: <Award size={13} className="text-green-300" />,
  region: <MapPin size={13} className="text-emerald-300" />,
  skill: <Dumbbell size={13} className="text-cyan-300" />,
  ca: <Crosshair size={13} className="text-red-300" />,
  activity: <Swords size={13} className="text-amber-300" />,
};

/** Subsequence fuzzy score; null when the query isn't a subsequence of text. */
export function fuzzyScore(q: string, text: string): number | null {
  if (!q) return 0;
  const t = text.toLowerCase();
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) {
      score += 1 + streak; // reward consecutive runs
      if (i === 0) score += 4; // strong start-of-string bonus
      else if (/[\s'_\-]/.test(t[i - 1])) score += 2; // word-boundary bonus
      streak += 1;
      qi += 1;
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : null;
}

export function buildIndex(): PaletteCommand[] {
  const cmds: PaletteCommand[] = [];

  for (const q of Object.values(QUEST_DATA)) {
    cmds.push({
      id: `quest:${q.id}`, label: q.name, sublabel: q.series ?? 'Quest',
      kind: 'quest', tab: 'JOURNAL', subTab: 'QUESTS',
    });
  }
  for (const d of Object.values(DIARY_DATA)) {
    cmds.push({
      id: `diary:${d.id}`, label: d.id, sublabel: `${d.region} · ${d.tier} Diary`,
      kind: 'diary', tab: 'JOURNAL', subTab: 'DIARIES',
    });
  }
  for (const group of Object.keys(REGION_GROUPS)) {
    cmds.push({
      id: `region:${group}`, label: group, sublabel: 'Region',
      kind: 'region', tab: 'WORLD', worldView: 'LIST',
    });
  }
  // Sub-areas — the WORLD list filters areas within their group too.
  const groupOf = (area: string) =>
    Object.entries(REGION_GROUPS).find(([, areas]) => areas.includes(area))?.[0] ?? 'Region';
  for (const area of REGIONS_LIST) {
    cmds.push({
      id: `area:${area}`, label: area, sublabel: `Area · ${groupOf(area)}`,
      kind: 'region', tab: 'WORLD', worldView: 'LIST',
    });
  }
  for (const s of SKILLS_LIST) {
    cmds.push({
      id: `skill:${s}`, label: s, sublabel: 'Skill',
      kind: 'skill', tab: 'CHARACTER',
    });
  }
  // CA targets — one entry per unique monster.
  const monsters = Array.from(new Set(ALL_CA_TASKS.map((t) => t.monster)));
  for (const m of monsters) {
    cmds.push({
      id: `ca:${m}`, label: m, sublabel: 'Combat Achievements',
      kind: 'ca', tab: 'JOURNAL', subTab: 'CA',
    });
  }
  // Activity unlocks.
  const activitySources: Array<[string[], string]> = [
    [BOSSES_LIST, 'Boss'],
    [MINIGAMES_LIST, 'Minigame'],
    [FARMING_PATCH_LIST, 'Farming'],
    [MOBILITY_LIST, 'Mobility'],
    [GUILDS_LIST, 'Guild'],
    [ARCANA_LIST, 'Arcana'],
    [POH_LIST, 'Player Owned House'],
    [STORAGE_LIST, 'Storage'],
    [MERCHANTS_LIST, 'Merchant'],
  ];
  for (const [list, label] of activitySources) {
    for (const item of list) {
      cmds.push({
        id: `act:${label}:${item}`, label: item, sublabel: label,
        kind: 'activity', tab: 'ACTIVITIES',
      });
    }
  }
  return cmds;
}

export const CommandPalette: React.FC<Props> = ({ onClose, onNavigate }) => {
  useEscapeKey(onClose, true);
  const index = useMemo(buildIndex, []);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // No query — show a small starter sampler across kinds.
      return index.slice(0, 0);
    }
    return index
      .map((c) => ({ c, score: fuzzyScore(q, c.label) }))
      .filter((r): r is { c: PaletteCommand; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score || a.c.label.length - b.c.label.length)
      .slice(0, 50)
      .map((r) => r.c);
  }, [index, query]);

  // Keep selection in-bounds and scrolled into view.
  useEffect(() => { setSel(0); }, [query]);
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const choose = (cmd?: PaletteCommand) => {
    if (!cmd) return;
    onNavigate(cmd);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[sel]);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 backdrop-blur-sm p-4 pt-[12vh] animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search box */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10">
          <Search size={16} className="text-gray-500 shrink-0" aria-hidden />
          <input
            autoFocus
            type="text"
            placeholder="Jump to a quest, diary, region, skill, boss…"
            className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 focus:outline-none"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto custom-scrollbar p-1.5">
          {query.trim() === '' ? (
            <p className="text-[11px] text-gray-600 text-center py-6">
              Type to search across the whole tracker.
            </p>
          ) : results.length === 0 ? (
            <p className="text-[11px] text-gray-600 italic text-center py-6">
              No matches for “{query}”.
            </p>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                data-idx={i}
                onMouseMove={() => setSel(i)}
                onClick={() => choose(c)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition-colors ${
                  i === sel ? 'bg-cyan-900/25 border border-cyan-500/30' : 'border border-transparent'
                }`}
              >
                <span className="shrink-0" aria-hidden>{KIND_ICON[c.kind]}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold text-gray-200 truncate">{c.label}</span>
                  <span className="block text-[9px] text-gray-600 truncate">{c.sublabel}</span>
                </span>
                {i === sel && (
                  <CornerDownLeft size={12} className="text-cyan-400 shrink-0" aria-hidden />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-3 py-1.5 border-t border-white/5 text-[9px] text-gray-600">
          <span><kbd className="font-mono text-gray-500">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono text-gray-500">↵</kbd> open</span>
          <span><kbd className="font-mono text-gray-500">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};
