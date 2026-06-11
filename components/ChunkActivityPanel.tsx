import React, { useEffect, useMemo, useState } from 'react';
import { X, Lock, Check, Swords, Store, Users, Scroll, Package, BookOpen, MapPin, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { chunkContentService, ChunkContent } from '../services/ChunkContentService';
import { QUEST_DATA } from '../data/questData';
import { getQuestStatus, QuestStatus } from '../utils/journalStatus';
import type { ChunkCoord } from '../utils/mapCoords';
import { WikiLink } from './WikiLink';

/**
 * "What can I play here?" — the OneChunkMan-style content readout for a
 * clicked map chunk, or aggregated across its whole region (since this mode
 * unlocks areas, not single chunks). Every activity is checked against the
 * run's actual unlocks: quests via getQuestStatus (regions + skills + QP +
 * prereqs), monsters via the Slayer requirement vs the player's level.
 * Content data: ChunkContentService (credit: source-chunk/chunk-picker-v2).
 */

interface Props {
  chunk: ChunkCoord;
  region: string | null;
  /** Named sub-area this chunk belongs to (e.g. 'Falador'), when known. */
  subArea?: string | null;
  regionChunks: ChunkCoord[];
  unlocked: boolean;
  onClose: () => void;
}

const QUEST_BADGE: Record<QuestStatus, { cls: string; label: string }> = {
  COMPLETED: { cls: 'text-green-400', label: 'completed' },
  AVAILABLE: { cls: 'text-amber-300', label: 'requirements met — can do now' },
  LOCKED_REGION: { cls: 'text-gray-500', label: 'locked: region not unlocked' },
  LOCKED_SKILL: { cls: 'text-gray-500', label: 'locked: skill requirements not met' },
  LOCKED_QUEST: { cls: 'text-gray-500', label: 'locked: prerequisite quest missing' },
};

const SectionHead: React.FC<{ icon: React.ReactNode; label: string; count?: number }> = ({ icon, label, count }) => (
  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-3 mb-1">
    {icon}{label}{count != null && <span className="text-gray-600 font-mono">({count})</span>}
  </div>
);

/** A capped list with a "+N more" expander. */
const CappedList: React.FC<{ items: React.ReactNode[]; cap: number }> = ({ items, cap }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, cap);
  return (
    <>
      {shown}
      {items.length > cap && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[10px] text-cyan-400/80 hover:text-cyan-300 mt-0.5"
        >
          {expanded ? 'show less' : `+${items.length - cap} more`}
        </button>
      )}
    </>
  );
};

export const ChunkActivityPanel: React.FC<Props> = ({ chunk, region, subArea, regionChunks, unlocked, onClose }) => {
  const { unlocks } = useGame();
  const [mode, setMode] = useState<'chunk' | 'region'>('chunk');
  const [, setLoadedTick] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    chunkContentService.init().then(ok => (ok ? setLoadedTick(t => t + 1) : setFailed(true)));
  }, []);

  const content: ChunkContent | null = useMemo(() => {
    if (!chunkContentService.ready) return null;
    if (mode === 'region' && region) return chunkContentService.aggregate(regionChunks);
    return chunkContentService.contentFor(chunk.cx, chunk.cy);
  }, [mode, region, regionChunks, chunk, chunkContentService.ready]);

  const slayerLevel = unlocks.levels['Slayer'] ?? 1;
  const slayerUnlocked = (unlocks.skills?.['Slayer'] ?? 0) > 0;

  const questRows = useMemo(() => {
    if (!content) return [];
    return Object.entries(content.quests)
      .map(([name, kind]) => {
        const data = QUEST_DATA[name];
        const status = data ? getQuestStatus(data, unlocks) : null;
        return { name, kind, status };
      })
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'first' ? -1 : 1));
  }, [content, unlocks]);

  const title = mode === 'region' && region
    ? region
    : content?.name ?? `Chunk ${chunk.cx}, ${chunk.cy}`;

  return (
    <div className="absolute top-3 right-3 bottom-3 w-72 z-30 bg-[#161616]/95 border border-white/15 rounded-xl shadow-2xl backdrop-blur-sm flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-white/10 shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-[13px] font-bold text-white leading-tight truncate">{title}</h3>
            <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500">
              <MapPin size={10} />
              {mode === 'region'
                ? `${regionChunks.length} chunks`
                : <>chunk ({chunk.cx}, {chunk.cy}){subArea && <> · <span className="text-cyan-300/90 font-semibold">{subArea}</span></>}{region && <> · {region}</>}</>}
              <span className={`px-1.5 py-px rounded font-bold ${unlocked ? 'bg-green-900/60 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                {unlocked ? 'UNLOCKED' : 'LOCKED'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white shrink-0" aria-label="Close chunk info">
            <X size={15} />
          </button>
        </div>
        {region && (
          <div className="flex mt-2 bg-black/40 rounded-lg p-0.5 gap-0.5">
            {(['chunk', 'region'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${mode === m ? 'bg-cyan-900/70 text-cyan-200' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {m === 'chunk' ? 'This chunk' : 'Whole area'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar px-3 pb-3 text-[11px] ${unlocked ? '' : 'opacity-75'}`}>
        {!unlocked && (
          <div className="mt-2 px-2 py-1.5 rounded bg-amber-950/50 border border-amber-700/40 text-amber-300/90 text-[10px]">
            <Lock size={10} className="inline mr-1 -mt-px" />
            This area is still locked — a preview of what fate could grant.
          </div>
        )}

        {failed && <div className="mt-3 text-gray-500">Chunk content unavailable (failed to load).</div>}
        {!failed && !content && <div className="mt-3 text-gray-500 animate-pulse">Loading chunk content…</div>}
        {content && (
          <>
            {questRows.length > 0 && (
              <>
                <SectionHead icon={<Sparkles size={11} />} label="Quests" count={questRows.length} />
                <CappedList cap={8} items={questRows.map(({ name, kind, status }) => (
                  <div key={name} className="flex items-center gap-1.5 py-px" title={status ? QUEST_BADGE[status].label : 'miniquest / not tracked'}>
                    {status === 'COMPLETED' ? <Check size={11} className="text-green-400 shrink-0" />
                      : status === 'AVAILABLE' ? <span className="w-[11px] text-center text-amber-300 shrink-0">●</span>
                      : status ? <Lock size={10} className="text-gray-600 shrink-0" />
                      : <span className="w-[11px] text-center text-gray-600 shrink-0">·</span>}
                    <WikiLink name={name} className={`truncate hover:underline decoration-dotted underline-offset-2 ${status ? QUEST_BADGE[status].cls : 'text-gray-400'}`} />
                    {kind === 'first' && <span className="text-[9px] px-1 rounded bg-cyan-900/60 text-cyan-300 shrink-0">starts here</span>}
                  </div>
                ))} />
              </>
            )}

            {content.monsters.length > 0 && (
              <>
                <SectionHead icon={<Swords size={11} />} label="Monsters" count={content.monsters.length} />
                <CappedList cap={8} items={content.monsters.map(m => {
                  const met = m.slayer == null || (slayerUnlocked && slayerLevel >= m.slayer);
                  return (
                    <div key={m.name} className="flex items-center justify-between gap-2 py-px">
                      <span className={`truncate ${met ? 'text-gray-300' : 'text-gray-500'}`}>
                        <WikiLink name={m.name} className="hover:underline decoration-dotted underline-offset-2 hover:text-amber-200" /> <span className="text-gray-600">×{m.count}</span>
                      </span>
                      {m.slayer != null && (
                        <span
                          className={`text-[9px] px-1 rounded shrink-0 font-bold ${met ? 'bg-green-900/60 text-green-300' : 'bg-red-950/70 text-red-300'}`}
                          title={met ? 'Slayer requirement met' : `Needs Slayer ${m.slayer} — you have ${slayerUnlocked ? slayerLevel : 'the skill locked'}`}
                        >
                          Slay {m.slayer}
                        </span>
                      )}
                    </div>
                  );
                })} />
              </>
            )}

            {content.objects.length > 0 && (
              <>
                <SectionHead icon={<Package size={11} />} label="Objects & Resources" count={content.objects.length} />
                <CappedList cap={10} items={content.objects.map(([name, count]) => (
                  <div key={name} className="text-gray-300 py-px truncate"><WikiLink name={name} /> <span className="text-gray-600">×{count}</span></div>
                ))} />
              </>
            )}

            {content.shops.length > 0 && (
              <>
                <SectionHead icon={<Store size={11} />} label="Shops" count={content.shops.length} />
                {content.shops.map(s => <div key={s} className="text-gray-300 py-px truncate"><WikiLink name={s} /></div>)}
              </>
            )}

            {Object.keys(content.diaries).length > 0 && (
              <>
                <SectionHead icon={<BookOpen size={11} />} label="Diary tasks here" />
                {Object.entries(content.diaries).map(([area, refs]) => (
                  <div key={area} className="py-px text-gray-300 truncate" title={refs}>
                    <WikiLink name={`${area} Diary`}>{area}</WikiLink> <span className="text-gray-600">({refs})</span>
                  </div>
                ))}
              </>
            )}

            {Object.keys(content.clues).length > 0 && (
              <>
                <SectionHead icon={<Scroll size={11} />} label="Clue steps" />
                <div className="flex flex-wrap gap-1">
                  {Object.entries(content.clues).map(([tier, n]) => (
                    <span key={tier} className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 capitalize">
                      {tier} ×{n}
                    </span>
                  ))}
                </div>
              </>
            )}

            {content.npcs.length > 0 && (
              <>
                <SectionHead icon={<Users size={11} />} label="NPCs" count={content.npcs.length} />
                <CappedList cap={6} items={content.npcs.map(n => (
                  <div key={n} className="text-gray-400 py-px truncate"><WikiLink name={n} /></div>
                ))} />
              </>
            )}

            {content.spawns.length > 0 && (
              <>
                <SectionHead icon={<Package size={11} />} label="Item spawns" count={content.spawns.length} />
                <CappedList cap={6} items={content.spawns.map(s => (
                  <div key={s} className="text-gray-400 py-px truncate"><WikiLink name={s} /></div>
                ))} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
