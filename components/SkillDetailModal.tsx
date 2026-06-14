
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { X, BookOpen, Lock, Unlock, Star, MapPin, Navigation, ChevronRight, Search } from 'lucide-react';
import { SKILL_UNLOCK_DATA } from '../data/skillUnlocks';
import { tierBand } from '../utils/skillTiers';
import { skillChunkNodesByTier, skillStations } from '../utils/skillChunkNodes';
import { chunkContentService } from '../services/ChunkContentService';
import { summarisePlaces, showChunkOnMap } from '../utils/chunkLocations';
import { useGame } from '../context/GameContext';
import { useFocusTrap } from '../hooks/useFocusTrap';

interface SkillDetailModalProps {
  skill: string;
  currentTier: number;
  onClose: () => void;
}

type Tab = 'gather' | 'unlocks';

/**
 * Region picker for a gatherable node: lists the places it's found, reachable
 * (unlocked) ones first and clickable to jump the world map there. Deduped to
 * one entry per sub-area/region (e.g. Oak → Lumbridge, Draynor, Varrock) rather
 * than every individual chunk.
 */
const RegionPicker: React.FC<{ node: string; onJump: (cx: number, cy: number) => void }> = ({ node, onJump }) => {
  const { unlocks } = useGame();
  const [expanded, setExpanded] = useState(false);
  const places = useMemo(() => {
    const hit = chunkContentService.entityLocations(node, ['object']);
    return hit ? summarisePlaces(hit.locations, unlocks) : [];
  }, [node, unlocks]);

  if (places.length === 0) return <p className="text-[11px] text-gray-500 px-1 py-1.5">No mapped locations found.</p>;
  const reachable = places.filter(p => p.unlocked);
  const locked = places.filter(p => !p.unlocked);
  const shown = expanded ? places : places.slice(0, 6);

  return (
    <div className="mt-1.5 space-y-1">
      <p className="text-[10px] text-gray-500 px-1">
        {reachable.length > 0
          ? `Go to ${node} — ${reachable.length} unlocked place${reachable.length === 1 ? '' : 's'}:`
          : `${node} isn't in any unlocked area yet. Locations:`}
      </p>
      <div className="grid grid-cols-2 gap-1">
        {shown.map((p) => (
          <button
            key={p.label}
            onClick={() => onJump(p.cx, p.cy)}
            className={`text-left text-[11px] px-2 py-1 rounded border flex items-center gap-1.5 transition-colors ${
              p.unlocked
                ? 'bg-emerald-900/20 text-emerald-200 border-emerald-500/25 hover:bg-emerald-900/40'
                : 'bg-black/30 text-gray-500 border-white/5 hover:bg-white/5'}`}
            title={p.unlocked ? `Jump to ${p.label}` : `${p.label} — area locked (preview)`}
          >
            {p.unlocked ? <Navigation size={10} className="shrink-0" /> : <Lock size={9} className="shrink-0" />}
            <span className="truncate">{p.subArea ?? p.region ?? p.label}</span>
          </button>
        ))}
      </div>
      {places.length > 6 && (
        <button onClick={() => setExpanded(e => !e)} className="text-[10px] text-cyan-400/80 hover:text-cyan-300 px-1">
          {expanded ? 'show fewer' : `+${places.length - 6} more place${places.length - 6 === 1 ? '' : 's'}${locked.length ? ' (incl. locked)' : ''}`}
        </button>
      )}
    </div>
  );
};

export const SkillDetailModal: React.FC<SkillDetailModalProps> = ({ skill, currentTier, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const unlockData = SKILL_UNLOCK_DATA[skill] || {};
  const tiers = Array.from({ length: 10 }, (_, i) => i + 1);

  const [tab, setTab] = useState<Tab>('unlocks');
  const [openNode, setOpenNode] = useState<string | null>(null);

  // Chunk-grounded nodes this skill unlocks, grouped by tier. Loads lazily.
  const [chunksReady, setChunksReady] = useState(chunkContentService.ready);
  useEffect(() => { if (!chunksReady) chunkContentService.init().then(ok => ok && setChunksReady(true)); }, [chunksReady]);
  const nodesByTier = useMemo(
    () => (chunksReady ? skillChunkNodesByTier(skill) : {}),
    [skill, chunksReady],
  );
  const stations = useMemo(
    () => (chunksReady ? skillStations(skill) : []),
    [skill, chunksReady],
  );
  const hasGathering = Object.keys(nodesByTier).length > 0 || stations.length > 0;
  // Default to the Map Gathering tab for skills that have nodes — that's the
  // "where can I actually do this" view the player usually wants.
  useEffect(() => { if (hasGathering) setTab('gather'); }, [hasGathering]);

  const jump = (cx: number, cy: number) => { showChunkOnMap(cx, cy); onClose(); };
  const iconUrl = `https://oldschool.runescape.wiki/images/${skill}_icon.png`;

  // ── Localised filter: a text search + an "unlocked only" toggle, scoped to
  // the active tab. Filtering happens within the tier grouping so the
  // locked/unlocked context is preserved.
  const [query, setQuery] = useState('');
  const [unlockedOnly, setUnlockedOnly] = useState(false);
  const q = query.trim().toLowerCase();
  const nodesFor = (tier: number) =>
    (nodesByTier[tier] ?? []).filter(n => !q || n.name.toLowerCase().includes(q));
  const benefitsFor = (tier: number) =>
    (unlockData[tier] ?? []).filter(b => !q || b.toLowerCase().includes(q));

  const visibleTiers = tiers.filter(t => {
    if (unlockedOnly && currentTier < t) return false;
    if (tab === 'gather') return nodesFor(t).length > 0;
    return q ? benefitsFor(t).length > 0 : true;
  });
  // Stations are usable from level 1, so they show whenever the skill's tier 1
  // is unlocked (i.e. always, unless "unlocked only" and the skill is at tier 0).
  const visibleStations = (tab === 'gather' && (!unlockedOnly || currentTier >= 1))
    ? stations.filter(s => !q || s.name.toLowerCase().includes(q))
    : [];
  const noMatches = (q || unlockedOnly) && visibleTiers.length === 0 &&
    (tab !== 'gather' || visibleStations.length === 0);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={`${skill} skill detail`} tabIndex={-1} className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#1a1a1a] border border-white/10 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="bg-[#222] p-4 border-b border-white/10 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black/40 rounded-lg border border-white/5 flex items-center justify-center">
                <img src={iconUrl} alt={skill} className="w-6 h-6 object-contain" />
            </div>
            <div>
                <h2 className="text-xl font-bold text-white tracking-wide">{skill} Progression</h2>
                <div className="flex items-center gap-2 text-xs text-gray-400 font-mono mt-0.5">
                    <span className={currentTier > 0 ? "text-green-400" : "text-gray-500"}>Current: Tier {currentTier}</span>
                    <span>•</span>
                    <span>Max: Tier 10</span>
                </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors group">
            <X className="w-6 h-6 text-gray-400 group-hover:text-white" />
          </button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex gap-1 px-4 pt-3 bg-[#1a1a1a] border-b border-white/5">
          {([['gather', 'Map Gathering', MapPin], ['unlocks', 'Skill Unlocks', BookOpen]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              disabled={id === 'gather' && !hasGathering}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-t-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                tab === id ? 'bg-[#111] text-white border-x border-t border-white/10' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Icon size={13} /> {label}
              {id === 'gather' && hasGathering && (
                <span className="text-[9px] font-mono text-cyan-400/70">{Object.values(nodesByTier).flat().length + stations.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">

          <div className={`border p-3 rounded-lg flex gap-3 ${tab === 'gather' ? 'bg-cyan-900/15 border-cyan-500/25' : 'bg-blue-900/20 border-blue-500/30'}`}>
            {tab === 'gather' ? <MapPin className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" /> : <BookOpen className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />}
            <p className="text-sm text-blue-200/80 leading-relaxed">
              {tab === 'gather'
                ? 'Everything this skill can gather on the world map, grouped by the tier that unlocks it. Click a resource to pick a region and jump straight there.'
                : 'Unlocking a tier grants access to training methods and equipment within that level range. You may train beyond your unlocked tier, but you can only use unlocked content.'}
            </p>
          </div>

          {/* Localised filter bar */}
          {(tab === 'unlocks' || hasGathering) && (
            <div className="flex items-center gap-2 sticky -top-6 z-10 -mx-6 px-6 py-2 bg-[#1a1a1a]/95 backdrop-blur-sm">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={tab === 'gather' ? 'Filter resources… (e.g. yew, lobster)' : 'Filter unlocks…'}
                  className="w-full bg-black/40 border border-white/10 rounded pl-7 pr-7 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-cyan-400/40"
                  aria-label="Filter skill progression"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white" aria-label="Clear filter">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                onClick={() => setUnlockedOnly(v => !v)}
                className={`shrink-0 text-[11px] font-bold px-2 py-1.5 rounded border flex items-center gap-1 transition-colors ${
                  unlockedOnly ? 'bg-green-900/40 border-green-500/40 text-green-300' : 'bg-black/40 border-white/10 text-gray-400 hover:text-gray-200'}`}
                title="Show only tiers you've unlocked"
              >
                <Unlock size={11} /> Unlocked
              </button>
            </div>
          )}

          {tab === 'gather' && !hasGathering && (
            <p className="text-sm text-gray-500 italic">This skill has no gatherable map resources — see Skill Unlocks for what it offers.</p>
          )}
          {tab === 'gather' && hasGathering && !chunksReady && (
            <p className="text-sm text-gray-500 animate-pulse">Loading map resources…</p>
          )}
          {noMatches && (
            <p className="text-sm text-gray-500 italic">No {tab === 'gather' ? 'resources' : 'unlocks'} match{q && ` “${query}”`}{unlockedOnly && ' in unlocked tiers'}.</p>
          )}

          {/* Stations — usable from level 1, shown separately from level-graded nodes. */}
          {tab === 'gather' && visibleStations.length > 0 && (
            <div className="border border-amber-500/25 bg-amber-900/10 rounded-lg overflow-hidden">
              <div className="px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-amber-900/20 text-amber-300 border-b border-amber-500/10">
                <BookOpen size={14} /> Stations <span className="opacity-60 font-mono">· usable from level 1</span>
              </div>
              <div className="p-4 space-y-1.5">
                {visibleStations.map((n) => {
                  const isOpen = openNode === n.name;
                  return (
                    <div key={n.name} className={`rounded border ${isOpen ? 'border-amber-500/30 bg-black/30' : 'border-white/5'}`}>
                      <button onClick={() => setOpenNode(isOpen ? null : n.name)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5 rounded">
                        <ChevronRight size={12} className={`text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        <span className="text-sm flex-1 truncate text-amber-100/90">{n.name}</span>
                        <span className="text-[9px] uppercase font-bold text-amber-400/70 shrink-0">station</span>
                        <span className="text-[10px] text-gray-600 shrink-0">{n.chunks}🗺</span>
                      </button>
                      {isOpen && <div className="px-2 pb-2"><RegionPicker node={n.name} onJump={jump} /></div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {visibleTiers.map((tier) => {
              const isUnlocked = currentTier >= tier;
              const isNext = currentTier + 1 === tier;
              const benefits = benefitsFor(tier);
              const nodes = nodesFor(tier);
              const range = tierBand(tier).label;

              return (
                <div key={tier} className={`relative border rounded-lg overflow-hidden transition-all ${
                  isUnlocked ? 'bg-[#1f2937] border-green-500/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]'
                    : isNext ? 'bg-[#1a1a1a] border-purple-500/40 ring-1 ring-purple-500/20'
                    : 'bg-[#111] border-white/5 opacity-70'}`}>

                  <div className={`px-4 py-2 flex justify-between items-center text-xs font-bold uppercase tracking-wider ${
                    isUnlocked ? 'bg-green-900/20 text-green-400 border-b border-green-500/10' : isNext ? 'bg-purple-900/20 text-purple-300 border-b border-purple-500/10' : 'bg-black/40 text-gray-500 border-b border-white/5'}`}>
                    <div className="flex items-center gap-2">
                      {isUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
                      <span>Tier {tier}</span><span className="opacity-50">|</span><span>Levels {range}</span>
                    </div>
                    {isUnlocked && <span className="flex items-center gap-1"><Star size={12} fill="currentColor" /> Active</span>}
                    {isNext && <span className="flex items-center gap-1 animate-pulse">Next Unlock</span>}
                  </div>

                  <div className="p-4">
                    {tab === 'unlocks' ? (
                      benefits && benefits.length > 0 ? (
                        <ul className="space-y-2">
                          {benefits.map((benefit, idx) => (
                            <li key={idx} className="text-sm flex items-start gap-2">
                              <span className={`mt-1.5 w-1 h-1 rounded-full shrink-0 ${isUnlocked ? 'bg-green-500' : 'bg-gray-600'}`}></span>
                              <span className={isUnlocked ? 'text-gray-200' : 'text-gray-500'}>{benefit}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-600 italic">No specific unlocks recorded for this tier.</p>
                      )
                    ) : (
                      // Gather tab: clickable node rows, each expanding a region picker.
                      <div className="space-y-1.5">
                        {nodes.map((n) => {
                          const isOpen = openNode === n.name;
                          return (
                            <div key={n.name} className={`rounded border ${isOpen ? 'border-cyan-500/30 bg-black/30' : 'border-white/5'}`}>
                              <button
                                onClick={() => setOpenNode(isOpen ? null : n.name)}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-white/5 rounded"
                              >
                                <ChevronRight size={12} className={`text-gray-500 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                <span className={`text-sm flex-1 truncate ${isUnlocked ? 'text-cyan-100' : 'text-gray-400'}`}>{n.name}</span>
                                <span className="text-[10px] font-mono text-gray-500 shrink-0">L{n.level}</span>
                                <span className="text-[10px] text-gray-600 shrink-0">{n.chunks}🗺</span>
                              </button>
                              {isOpen && <div className="px-2 pb-2"><RegionPicker node={n.name} onJump={jump} /></div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
