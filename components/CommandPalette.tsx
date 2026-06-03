import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, User, Globe, Swords, BookOpen,
  Library, Coins, ShoppingBag, ScrollText, Route, Trophy, Sparkles, Skull,
  BarChart3, Map, Wand2, Share2, RefreshCw, Settings2, Gauge, Film, Zap, Compass,
  type LucideIcon,
} from 'lucide-react';
import { useGame } from '../context/GameContext';

/**
 * Global ⌘K / Ctrl-K command palette. A single launcher to jump to any tab,
 * tool or action by typing — the antidote to a feature-dense UI. Navigation is
 * dispatched as `fate:nav` window events, which the tab/modal owners listen for
 * (mirrors the existing `open-resource-engine` pattern), so no prop-drilling.
 */

export const navTo = (target: string) =>
  window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target } }));

interface Cmd {
  id: string;
  title: string;
  subtitle: string;
  group: 'Navigate' | 'Earn & Spend' | 'Plan' | 'Track' | 'Account' | 'Action';
  icon: LucideIcon;
  keywords: string;
  run: () => void;
}

export const CommandPalette: React.FC = () => {
  const { toggleAnimations, animationsEnabled } = useGame();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands: Cmd[] = useMemo(() => {
    const go = (target: string) => () => { navTo(target); setOpen(false); };
    return [
      // Navigate — dashboard tabs
      { id: 'tab-char', title: 'Character', subtitle: 'Gear, skills, Equipment Lab & DPS', group: 'Navigate', icon: User, keywords: 'character gear equipment skills dps loadout combat', run: go('tab:CHARACTER') },
      { id: 'tab-world', title: 'World', subtitle: 'Unlocked regions on the map', group: 'Navigate', icon: Globe, keywords: 'world map regions areas travel', run: go('tab:WORLD') },
      { id: 'tab-act', title: 'Activities & Utility', subtitle: 'Bosses, minigames, storage & more', group: 'Navigate', icon: Swords, keywords: 'activities utility bosses minigames guilds storage', run: go('tab:ACTIVITIES') },
      { id: 'tab-journal', title: 'Journal', subtitle: 'Quests, diaries & combat achievements', group: 'Navigate', icon: BookOpen, keywords: 'journal quests diaries combat achievements tasks', run: go('tab:JOURNAL') },
      { id: 'tab-coll', title: 'Collection Log', subtitle: 'Your logged unique drops', group: 'Navigate', icon: Library, keywords: 'collection log uniques drops items', run: go('tab:COLLECTION') },
      // Earn & spend — control panel
      { id: 'ctrl-farm', title: 'Farm Keys', subtitle: 'Roll slayer & clues for keys', group: 'Earn & Spend', icon: Coins, keywords: 'farm earn keys slayer clue roll', run: go('ctrl:FARM') },
      { id: 'ctrl-spend', title: 'Spend Keys', subtitle: 'Gacha — unlock random content', group: 'Earn & Spend', icon: ShoppingBag, keywords: 'spend keys gacha unlock roll', run: go('ctrl:SPEND') },
      { id: 'ctrl-log', title: 'History', subtitle: 'Your full run log', group: 'Earn & Spend', icon: ScrollText, keywords: 'history log timeline events', run: go('ctrl:LOG') },
      // Plan
      { id: 'open-goal', title: 'Goal Planner', subtitle: 'Route to any unlock', group: 'Plan', icon: Route, keywords: 'goal planner plan route target path', run: go('open:goal') },
      { id: 'open-kill', title: 'Boss Kill Planner', subtitle: 'DPS & readiness vs your bosses', group: 'Plan', icon: Skull, keywords: 'boss kill planner dps ttk readiness', run: go('open:killplanner') },
      { id: 'open-forecast', title: 'Fate Forecast', subtitle: 'Odds & time-to-unlock', group: 'Plan', icon: Sparkles, keywords: 'forecast odds probability chance predict', run: go('open:forecast') },
      { id: 'open-supply', title: 'Resource Engine', subtitle: 'Supplies a goal needs', group: 'Plan', icon: Gauge, keywords: 'resource engine supply chain materials cost', run: go('open:supply') },
      { id: 'open-strategy', title: 'Strategy Guide', subtitle: 'How to approach each unlock', group: 'Plan', icon: Map, keywords: 'strategy guide advice tips order', run: go('open:strategy') },
      // Track
      { id: 'open-ach', title: 'Achievements', subtitle: 'Milestones & completion', group: 'Track', icon: Trophy, keywords: 'achievements milestones trophies', run: go('open:achievements') },
      { id: 'open-stats', title: 'Fate Analytics', subtitle: 'Luck, pace & distribution', group: 'Track', icon: BarChart3, keywords: 'analytics stats luck numbers graphs', run: go('open:stats') },
      { id: 'open-rival', title: 'Rival', subtitle: 'Race a rival ghost', group: 'Track', icon: Swords, keywords: 'rival ghost race compare pace', run: go('open:rival') },
      // Account
      { id: 'open-altar', title: 'Void Altar', subtitle: 'Spend Fate Points on rituals', group: 'Account', icon: Wand2, keywords: 'void altar ritual fate points sacrifice', run: go('open:altar') },
      { id: 'open-share', title: 'Share Run', subtitle: 'Generate a shareable card', group: 'Account', icon: Share2, keywords: 'share run card image export', run: go('open:share') },
      { id: 'open-sync', title: 'Sync Code', subtitle: 'Back up / move your run', group: 'Account', icon: RefreshCw, keywords: 'sync code backup export import transfer', run: go('open:sync') },
      { id: 'open-ref', title: 'Reference / Codex', subtitle: 'Rules & equipment tiers', group: 'Account', icon: BookOpen, keywords: 'reference codex rules help tiers how', run: go('open:reference') },
      { id: 'open-mode', title: 'Game Mode', subtitle: 'Vanilla, Hardcore, Custom…', group: 'Account', icon: Settings2, keywords: 'game mode ruleset difficulty hardcore custom', run: go('open:gamemode') },
      { id: 'open-oracle', title: 'Search all content…', subtitle: 'Find any unlockable via the Oracle', group: 'Navigate', icon: Search, keywords: 'oracle search content items find anything lookup', run: go('open:oracle') },
      // Actions
      { id: 'act-tour', title: 'Take the guided tour', subtitle: 'A 60-second walkthrough of the app', group: 'Action', icon: Compass, keywords: 'tour guide walkthrough help onboarding learn how', run: () => { setOpen(false); setTimeout(() => window.dispatchEvent(new CustomEvent('fate:start-tour')), 60); } },
      { id: 'act-anim', title: animationsEnabled ? 'Turn animations off' : 'Turn animations on', subtitle: 'Toggle motion & effects', group: 'Action', icon: Zap, keywords: 'animations motion effects toggle reduce', run: () => { toggleAnimations(); setOpen(false); } },
    ];
  }, [animationsEnabled, toggleAnimations]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    const terms = q.split(/\s+/);
    return commands
      .map((c) => {
        const hay = `${c.title} ${c.subtitle} ${c.keywords}`.toLowerCase();
        const titleL = c.title.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (!hay.includes(t)) return null;
          if (titleL.startsWith(t)) score += 3;
          else if (titleL.includes(t)) score += 2;
          else score += 1;
        }
        return { c, score };
      })
      .filter((x): x is { c: Cmd; score: number } => x !== null)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [query, commands]);

  // ⌘K / Ctrl-K toggles; also listen for an explicit open request from the header.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('fate:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('fate:open-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => { setSel(0); }, [query]);

  // Keep the selected row in view.
  useLayoutEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel, open, results]);

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); results[sel]?.run(); }
  };

  if (!open) return null;

  // Group the results in display order while keeping the flat index for nav.
  let idx = -1;
  const groups: { name: string; items: { c: Cmd; i: number }[] }[] = [];
  for (const c of results) {
    idx += 1;
    const g = groups.find((x) => x.name === c.group);
    const entry = { c, i: idx };
    if (g) g.items.push(entry);
    else groups.push({ name: c.group, items: [entry] });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[400] flex items-start justify-center pt-[12vh] bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onMouseDown={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-xl bg-[#1b1b1b] border border-white/15 rounded-xl shadow-[0_24px_70px_rgba(0,0,0,0.7)] overflow-hidden animate-in zoom-in-95 slide-in-from-top-2 duration-150"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onListKey}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10">
          <Search className="w-5 h-5 text-gray-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a tab, tool or action…"
            className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder-gray-600"
          />
          <kbd className="text-[10px] font-mono text-gray-500 border border-white/10 rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto custom-scrollbar py-2">
          {results.length === 0 && (
            <div className="px-4 py-10 text-center text-gray-600 text-sm font-mono">No matches for “{query}”.</div>
          )}
          {groups.map((g) => (
            <div key={g.name} className="mb-1">
              <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-gray-600">{g.name}</div>
              {g.items.map(({ c, i }) => {
                const Icon = c.icon;
                const active = i === sel;
                return (
                  <button
                    key={c.id}
                    data-idx={i}
                    onMouseEnter={() => setSel(i)}
                    onClick={c.run}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${active ? 'bg-amber-500/15' : 'hover:bg-white/5'}`}
                  >
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${active ? 'border-amber-400/40 text-amber-300 bg-amber-500/10' : 'border-white/10 text-gray-400 bg-black/30'}`}>
                      <Icon size={15} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className={`block text-[13px] font-semibold leading-tight ${active ? 'text-white' : 'text-gray-200'}`}>{c.title}</span>
                      <span className="block text-[11px] text-gray-500 leading-tight truncate">{c.subtitle}</span>
                    </span>
                    {active && <CornerDownLeft className="w-4 h-4 text-amber-300/70 shrink-0" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/10 text-[10px] text-gray-600">
          <span className="flex items-center gap-1"><ArrowUp size={11} /><ArrowDown size={11} /> navigate</span>
          <span className="flex items-center gap-1"><CornerDownLeft size={11} /> open</span>
          <span className="ml-auto font-mono">⌘K / Ctrl K</span>
        </div>
      </div>
    </div>,
    document.body,
  );
};
