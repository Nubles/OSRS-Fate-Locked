import React, { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronRight, Map as MapIcon, Scroll, ListChecks, Navigation, BookOpen, Route, Gift, ExternalLink } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { QUEST_DATA, QuestData } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { DropSource, UnlockState } from '../types';
import { questUnmet, diaryUnmet } from '../utils/journalProgress';
import { questLocations } from '../utils/questLocations';
import { chunkForPlace, showChunkOnMap } from '../utils/chunkLocations';
import { computeUnlockImpact } from '../utils/unlockImpact';
import { useLocalStorage } from '../hooks/useLocalStorage';

type SubTab = 'QUESTS' | 'DIARIES' | 'CA';

export interface JournalNextBestAction {
  kind: 'quest' | 'diary';
  sub: SubTab;
  id: string;
  name: string;
  unmet: number;
  firstBlocker?: string;
  diffRank: number;
}

const diffRank = (d: DropSource): number => {
  const s = String(d);
  if (/Grandmaster|Elite/.test(s)) return 5;
  if (/Master|Hard/.test(s)) return 4;
  if (/Experienced/.test(s)) return 3;
  if (/Intermediate|Medium/.test(s)) return 2;
  return 1;
};

const wikiUrl = (a: JournalNextBestAction): string => {
  if (a.kind === 'quest') return `https://oldschool.runescape.wiki/w/${encodeURIComponent(a.name.replace(/ /g, '_'))}`;
  const area = a.id.replace(/ (Easy|Medium|Hard|Elite)$/, '');
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent((area + ' Diary').replace(/ /g, '_'))}`;
};

/** A representative chunk to jump to for "start on map", or null. */
const placeFor = (a: JournalNextBestAction, unlocks: any): { cx: number; cy: number } | null => {
  if (a.kind === 'quest') {
    const info = questLocations(a.name, unlocks);
    const p = info.startPlaces[0] ?? info.places[0];
    return p ? { cx: p.cx, cy: p.cy } : null;
  }
  const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === a.id);
  const region = tasks.find(t => t.regions?.length)?.regions?.[0]
    ?? tasks.find(t => t.anyOfRegions?.length)?.anyOfRegions?.[0]
    ?? DIARY_DATA[a.id]?.region;
  return region ? chunkForPlace(region) : null;
};

const ActionMenu: React.FC<{ a: JournalNextBestAction; onPick: (s: SubTab) => void; onClose: () => void }> = ({ a, onPick, onClose }) => {
  const { unlocks, gameModeId } = useGame();
  const [showUnlocks, setShowUnlocks] = useState(false);
  const place = placeFor(a, unlocks);

  const unlocks_ = useMemo(() => {
    if (a.kind !== 'quest') return null;
    const imp = computeUnlockImpact(
      unlocks,
      { ...unlocks, quests: [...unlocks.quests, a.id] },
      gameModeId,
      { includeConditional: true },
    );
    return { quests: imp.directQuestNames, diaries: imp.directDiaryIds };
  }, [a, unlocks, gameModeId]);

  const Row: React.FC<{ icon: React.ReactNode; label: string; onClick?: () => void; disabled?: boolean }> = ({ icon, label, onClick, disabled }) => (
    <button
      onClick={() => { if (!disabled) { onClick?.(); onClose(); } }}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] rounded transition-colors ${
        disabled ? 'text-gray-600 cursor-default' : 'text-gray-200 hover:bg-white/10'}`}
    >
      <span className="text-cyan-300/80 shrink-0">{icon}</span>{label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-full mt-1 z-50 w-56 bg-[#161616] border border-white/15 rounded-lg shadow-2xl py-1 overflow-hidden">
        <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500 truncate border-b border-white/5 mb-1">{a.name}</div>
        <Row icon={<ListChecks size={12} />} label="Open in the list" onClick={() => {
          onPick(a.sub);
          [120, 360].forEach(ms => setTimeout(() => window.dispatchEvent(new CustomEvent('fate:journal-focus', { detail: { id: a.id } })), ms));
        }} />
        <Row icon={<Navigation size={12} />} label={place ? 'Start on the map' : 'No map location'} disabled={!place} onClick={() => place && showChunkOnMap(place.cx, place.cy)} />
        <a
          href={wikiUrl(a)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] rounded transition-colors text-gray-200 hover:bg-white/10"
        >
          <span className="text-cyan-300/80 shrink-0"><BookOpen size={12} /></span>Wiki guide
          <ExternalLink size={9} className="ml-auto text-gray-500" />
        </a>
        <Row icon={<Route size={12} />} label="Plan a route" onClick={() => window.dispatchEvent(new CustomEvent('fate:plan-goal', { detail: { kind: a.kind, id: a.id } }))} />
        {a.kind === 'quest' && unlocks_ && (unlocks_.quests.length > 0 || unlocks_.diaries.length > 0) && (
          <div className="border-t border-white/5 mt-1">
            <button onClick={() => setShowUnlocks(s => !s)} className="w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-[11px] text-gray-200 hover:bg-white/10 rounded">
              <Gift size={12} className="text-amber-300/80 shrink-0" /> Potential unlocks (checks still apply)
              <span className="ml-auto text-[9px] text-gray-500">{unlocks_.quests.length}q · {unlocks_.diaries.length}d</span>
            </button>
            {showUnlocks && (
              <div className="px-2.5 pb-2 text-[10px] text-gray-400 leading-relaxed">
                {unlocks_.quests.length > 0 && <div><span className="text-gray-500">Quests:</span> {unlocks_.quests.slice(0, 5).join(', ')}{unlocks_.quests.length > 5 ? '…' : ''}</div>}
                {unlocks_.diaries.length > 0 && <div><span className="text-gray-500">Diary tiers:</span> {unlocks_.diaries.slice(0, 4).join(', ')}{unlocks_.diaries.length > 4 ? '…' : ''}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export const journalNextBestQuestAction = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
): JournalNextBestAction | null => {
  if (unlocks.quests.includes(quest.id)) return null;
  const unmet = questUnmet(quest, unlocks, gameModeId);
  return {
    kind: 'quest',
    sub: 'QUESTS',
    id: quest.id,
    name: quest.name,
    unmet: unmet.length,
    firstBlocker: unmet[0]?.label,
    diffRank: diffRank(quest.difficulty),
  };
};

export const selectJournalNextBestActions = (
  unlocks: any,
  gameModeId?: string,
): JournalNextBestAction[] => {
  const out: JournalNextBestAction[] = [];
  for (const quest of Object.values(QUEST_DATA)) {
    const action = journalNextBestQuestAction(quest, unlocks, gameModeId);
    if (action) out.push(action);
  }
  for (const d of Object.values(DIARY_DATA)) {
    if (unlocks.diaries.includes(d.id)) continue;
    const tasks = ALL_DIARY_TASKS.filter(task => task.tierId === d.id);
    if (tasks.length > 0 && tasks.every(task => unlocks.completedTasks.includes(task.id))) {
      continue;
    }
    const unmet = diaryUnmet(d, unlocks, gameModeId);
    out.push({
      kind: 'diary', sub: 'DIARIES', id: d.id, name: d.id,
      unmet: unmet.length, firstBlocker: unmet[0]?.label,
      diffRank: diffRank(d.difficulty),
    });
  }
  return out
    .filter(action => action.unmet <= 1)
    .sort((a, b) =>
      a.unmet - b.unmet ||
      a.diffRank - b.diffRank ||
      a.name.localeCompare(b.name))
    .slice(0, 8);
};

/**
 * Cross-journal "what should I do next" feed: blends quests + diary tiers,
 * ranked by readiness. Each item opens a small action menu — open in its list,
 * jump to its start on the map, the wiki guide, plan a route, or peek at what
 * it unlocks.
 */
export const JournalNextBest: React.FC<{ onPick: (sub: SubTab) => void }> = ({ onPick }) => {
  const { unlocks, gameModeId } = useGame();
  const [open, setOpen] = useLocalStorage<boolean>('jrnl:nextbest:open', true);
  const [openItem, setOpenItem] = useState<string | null>(null);

  const actions = useMemo(
    () => selectJournalNextBestActions(unlocks, gameModeId),
    [unlocks, gameModeId],
  );

  if (actions.length === 0) return null;
  const ready = actions.filter(a => a.unmet === 0).length;

  return (
    <div className="shrink-0 border-b border-white/5 bg-[#161616]">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left">
        {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
        <Sparkles size={12} className="text-amber-300" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-200/90">Next best actions</span>
        <span className="text-[10px] font-mono text-gray-500">{ready > 0 ? `${ready} ready` : `${actions.length} close`}</span>
      </button>
      {open && (
        <div className="px-2 pb-2 flex flex-wrap gap-1.5">
          {actions.map((a) => {
            const Icon = a.kind === 'quest' ? Scroll : MapIcon;
            const isReady = a.unmet === 0;
            const key = `${a.kind}:${a.id}`;
            return (
              <div key={key} className="relative">
                <button
                  onClick={() => setOpenItem(openItem === key ? null : key)}
                  className={`text-[10px] px-2 py-1 rounded border flex items-center gap-1.5 max-w-[220px] transition-colors ${
                    isReady ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/40'
                            : 'bg-amber-900/15 border-amber-500/30 text-amber-200 hover:bg-amber-900/30'} ${openItem === key ? 'ring-1 ring-white/30' : ''}`}
                >
                  <Icon size={10} className="shrink-0 opacity-70" />
                  <span className="truncate font-semibold">{a.name}</span>
                  <span className={`shrink-0 text-[9px] px-1 rounded ${isReady ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>{isReady ? 'ready' : a.firstBlocker}</span>
                </button>
                {openItem === key && <ActionMenu a={a} onPick={onPick} onClose={() => setOpenItem(null)} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
