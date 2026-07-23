
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, Map, BookOpen, Skull, Gamepad2, Sprout, Footprints, Zap, Home, Store, Package, Flag, Shield, Lock, Unlock, ExternalLink, ScrollText, Swords, Box, Trophy } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useGame } from '../context/GameContext';
import { SectionGuide } from './SectionGuide';
import { 
  SKILLS_LIST, REGIONS_LIST, BOSSES_LIST, MINIGAMES_LIST, FARMING_PATCH_LIST, 
  MOBILITY_LIST, ARCANA_LIST, POH_LIST, EQUIPMENT_SLOTS, MERCHANTS_LIST, 
  STORAGE_LIST, GUILDS_LIST, SLAYER_UNLOCKS_LIST, MISTHALIN_AREAS, wikiUrlFor
} from '../constants';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { CA_DATA } from '../data/caData';
import { COLLECTION_LOG_DATA } from '../data/collectionLogData';
import { TableType } from '../types';
import { TestSuiteRunner } from './TestSuiteRunner';

import { chunkContentService, EntityHit, EntityKind } from '../services/ChunkContentService';
import { EntityLocations } from './EntityLocations';
import { COMBAT_POWERS_LABEL } from '../utils/tableDisplay';
import { isAreaReachable } from '../utils/reachability';

interface OracleSearchProps {
  onClose: () => void;
}

const ENTITY_KIND_LABEL: Record<EntityKind, string> = {
  monster: 'Monster',
  object: 'Object / Resource',
  npc: 'NPC',
  spawn: 'Item Spawn',
  shop: 'Shop',
  quest: 'Quest Location',
};

type SearchItem = {
  name: string;
  type: string;
  category: TableType | 'COLLECTION_LOG_ITEM';
  icon: any;
  reqText: string;
  id?: string | number; // Optional ID for lookups (like Col Log IDs)
};

// Helper to generate Wiki URLs
const getWikiUrl = wikiUrlFor;

export const OracleSearch: React.FC<OracleSearchProps> = ({ onClose }) => {
  const { unlocks, gameModeId } = useGame();
  const [query, setQuery] = useState('');
  const [isRunningTest, setIsRunningTest] = useState(false);
  // World-entity search (monsters / objects / NPCs / spawns / shops / quest
  // locations from the chunk dataset) — loaded lazily on first open.
  const [worldReady, setWorldReady] = useState(chunkContentService.ready);
  useEffect(() => {
    if (!chunkContentService.ready) chunkContentService.init().then(ok => ok && setWorldReady(true));
  }, []);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRunningTest) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, isRunningTest]);

  // Handle Enter Key for Tests
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.toLowerCase().trim() === 'test') {
      setIsRunningTest(true);
    }
  };

  // Aggregate Data
  const searchIndex = useMemo<SearchItem[]>(() => {
    const items: SearchItem[] = [];

    const addGroup = (list: string[], type: string, category: TableType, icon: any, req: string) => {
      list.forEach(name => items.push({ name, type, category, icon, reqText: req }));
    };

    // Core Unlocks
    addGroup(SKILLS_LIST, 'Skill', TableType.SKILLS, BookOpen, 'Requires Key in Skills Table');
    addGroup(REGIONS_LIST, 'Region', TableType.REGIONS, Map, 'Requires Key in Regions Table');
    addGroup(MISTHALIN_AREAS, 'Region', TableType.REGIONS, Map, 'Starting Area (Unlocked)');
    addGroup(BOSSES_LIST, 'Boss', TableType.BOSSES, Skull, 'Requires Key in Bosses Table');
    addGroup(MINIGAMES_LIST, 'Minigame', TableType.MINIGAMES, Gamepad2, 'Requires Key in Minigames Table');
    addGroup(FARMING_PATCH_LIST, 'Farming Patch', TableType.FARMING_LAYERS, Sprout, 'Requires Key in Farming Table');
    addGroup(MOBILITY_LIST, 'Mobility', TableType.MOBILITY, Footprints, 'Requires Key in Mobility Table');
    addGroup(ARCANA_LIST, COMBAT_POWERS_LABEL, TableType.ARCANA, Zap, 'Requires a Key in the Combat Powers table');
    addGroup(POH_LIST, 'Housing', TableType.POH, Home, 'Requires Key in Housing Table');
    addGroup(MERCHANTS_LIST, 'Merchant', TableType.MERCHANTS, Store, 'Requires Key in Merchants Table');
    addGroup(STORAGE_LIST, 'Storage', TableType.STORAGE, Package, 'Requires Key in Storage Table');
    addGroup(GUILDS_LIST, 'Guild', TableType.GUILDS, Flag, 'Requires Key in Guilds Table');
    addGroup(SLAYER_UNLOCKS_LIST, 'Slayer Unlock', TableType.SLAYER_UNLOCKS, Skull, 'Requires Key in Slayer Table');
    addGroup(EQUIPMENT_SLOTS, 'Equipment Slot', TableType.EQUIPMENT, Shield, 'Requires Key in Equipment Table');

    // Quests
    Object.values(QUEST_DATA).forEach(q => {
        items.push({ name: q.name, type: 'Quest', category: TableType.QUESTS, icon: ScrollText, reqText: 'Quest Journal', id: q.id });
    });

    // Diaries
    Object.values(DIARY_DATA).forEach(d => {
        items.push({ name: d.id, type: 'Diary', category: TableType.DIARIES, icon: BookOpen, reqText: 'Diary Journal', id: d.id });
    });

    // Combat Achievements
    Object.values(CA_DATA).forEach(ca => {
        items.push({ name: `${ca.id} Tier`, type: 'Combat Achievement', category: TableType.COMBAT_ACHIEVEMENTS, icon: Swords, reqText: 'CA Journal', id: ca.id });
    });

    // Collection Log (Flattened)
    Object.entries(COLLECTION_LOG_DATA).forEach(([tabName, tabData]) => {
        Object.entries(tabData.pages).forEach(([pageName, pageData]) => {
            pageData.items.forEach(item => {
                items.push({
                    name: item.name,
                    type: 'Collection Log',
                    category: 'COLLECTION_LOG_ITEM',
                    icon: Box,
                    reqText: `Page: ${pageName}`,
                    id: item.id
                });
            });
        });
    });

    return items;
  }, []);

  // Filter + rank results. Without ranking, an alphabetical slice of "rune"
  // would surface "Ancient Mace" before "Rune Platebody" purely on title
  // order. Rank by relevance: exact > prefix > word-start > substring.
  const results = useMemo(() => {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();

    const score = (name: string): number => {
      const lower = name.toLowerCase();
      if (lower === lowerQuery) return 0;
      if (lower.startsWith(lowerQuery)) return 1;
      if (lower.includes(' ' + lowerQuery)) return 2;
      if (lower.includes(lowerQuery)) return 3;
      return Infinity;
    };

    const scored: { item: SearchItem; rank: number }[] = [];
    for (const item of searchIndex) {
      const r = score(item.name);
      if (r !== Infinity) scored.push({ item, rank: r });
    }
    scored.sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name));
    return scored.slice(0, 50).map((s) => s.item);
  }, [query, searchIndex]);

  const worldHits = useMemo<EntityHit[]>(
    () => (worldReady && query.length >= 2 ? chunkContentService.searchEntities(query, 6) : []),
    [query, worldReady],
  );

  // Check Unlock Status
  const getStatus = (item: SearchItem) => {
    let isUnlocked = false;
    let detail = "Locked";

    switch (item.category) {
      case TableType.SKILLS:
        const tier = unlocks.skills[item.name] || 0;
        isUnlocked = tier > 0;
        detail = isUnlocked ? `Unlocked (Tier ${tier})` : "Level 1 Cap";
        break;
      case TableType.EQUIPMENT:
        const eqTier = unlocks.equipment[item.name] || 0;
        isUnlocked = eqTier > 0;
        detail = isUnlocked ? `Unlocked (Tier ${eqTier})` : "Unequippable";
        break;
      case TableType.REGIONS:
        if (gameModeId !== 'chunked' && MISTHALIN_AREAS.includes(item.name)) {
            isUnlocked = true;
            detail = "Starting Area";
        } else {
            isUnlocked = isAreaReachable(item.name, unlocks, gameModeId);
        }
        break;
      case TableType.MOBILITY:
        isUnlocked = unlocks.mobility.includes(item.name);
        break;
      case TableType.ARCANA:
        isUnlocked = unlocks.arcana.includes(item.name);
        break;
      case TableType.POH:
        isUnlocked = unlocks.housing.includes(item.name);
        break;
      case TableType.MERCHANTS:
        isUnlocked = unlocks.merchants.includes(item.name);
        break;
      case TableType.MINIGAMES:
        isUnlocked = unlocks.minigames.includes(item.name);
        break;
      case TableType.BOSSES:
        isUnlocked = unlocks.bosses.includes(item.name);
        break;
      case TableType.STORAGE:
        isUnlocked = unlocks.storage.includes(item.name);
        break;
      case TableType.GUILDS:
        isUnlocked = unlocks.guilds.includes(item.name);
        break;
      case TableType.FARMING_LAYERS:
        isUnlocked = unlocks.farming.includes(item.name);
        break;
      case TableType.SLAYER_UNLOCKS:
        isUnlocked = unlocks.slayerUnlocks.includes(item.name);
        break;
      case TableType.QUESTS:
        isUnlocked = unlocks.quests.includes(item.id as string);
        detail = isUnlocked ? "Completed" : "Not Started";
        break;
      case TableType.DIARIES:
        isUnlocked = unlocks.diaries.includes(item.id as string);
        detail = isUnlocked ? "Completed" : "Incomplete";
        break;
      case TableType.COMBAT_ACHIEVEMENTS:
        isUnlocked = unlocks.cas.includes(item.id as string);
        detail = isUnlocked ? "Completed" : "Incomplete";
        break;
      case 'COLLECTION_LOG_ITEM':
        const count = unlocks.collectionLog[item.id as number] || 0;
        isUnlocked = count > 0;
        detail = isUnlocked ? `Obtained (x${count})` : "Not Obtained";
        break;
    }

    return { isUnlocked, detail: isUnlocked ? detail : "Locked" }; // Fallback detail if locked
  };

  if (isRunningTest) {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
        <div className="w-full max-w-2xl h-[500px] bg-black border border-green-900 rounded-xl overflow-hidden shadow-2xl relative">
          <TestSuiteRunner onComplete={() => {
             setIsRunningTest(false);
             setQuery('');
          }} />
          <button 
            onClick={() => setIsRunningTest(false)} 
            className="absolute top-2 right-2 p-1 text-green-700 hover:text-green-500 transition-colors z-50"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Oracle search" tabIndex={-1} className="fixed inset-0 z-[300] flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]">
        
        {/* Input Header */}
        <div className="flex items-center px-4 py-4 border-b border-[#333] gap-3">
          <Search className="text-gray-500 w-5 h-5" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask the Oracle... (Search Content)"
            className="bg-transparent border-none outline-none text-lg text-white placeholder-gray-600 flex-1 font-medium"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <SectionGuide id="ORACLE" />
          <button onClick={onClose} className="p-1 hover:bg-[#333] rounded text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto custom-scrollbar p-2 space-y-1">
          {results.length === 0 && worldHits.length === 0 && query && (
            <div className="text-center py-12 text-gray-600">
              <p className="text-sm font-mono">No fate found matching "{query}"...</p>
              {query.toLowerCase() === 'test' && <p className="text-xs text-green-800 mt-2 animate-pulse">[Press Enter to run Diagnostics]</p>}
            </div>
          )}

          {/* World locations — entities from the chunk dataset. Clicking a
              location chip jumps to that chunk on the map; close on the way. */}
          {worldHits.length > 0 && (
            <div className="pb-1">
              <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-cyan-400/80">
                World locations
              </div>
              {worldHits.map(hit => (
                <div
                  key={`${hit.kind}|${hit.name}`}
                  onClickCapture={() => window.setTimeout(onClose, 60)}
                  className="flex items-start gap-3 px-3 py-2 hover:bg-[#252525] rounded-lg transition-colors"
                >
                  <div className="p-2 rounded-lg shrink-0 bg-cyan-950/40 text-cyan-300">
                    <Map size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-white truncate">{hit.name}</h3>
                      <span className="text-[9px] px-1.5 rounded bg-white/5 text-gray-500 uppercase shrink-0">
                        {ENTITY_KIND_LABEL[hit.kind]}
                      </span>
                    </div>
                    <EntityLocations name={hit.name} kinds={[hit.kind]} cap={5} className="mt-1" />
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {results.length === 0 && !query && (
             <div className="text-center py-12 text-gray-700">
               <div className="inline-flex items-center justify-center p-4 bg-[#222] rounded-full mb-3">
                  <Search className="w-6 h-6 opacity-50" />
               </div>
               <p className="text-xs font-mono uppercase tracking-widest">Type to reveal destiny</p>
             </div>
          )}

          {results.map((item, idx) => {
            const { isUnlocked, detail } = getStatus(item);
            const Icon = item.icon;
            
            return (
              <div 
                key={`${item.type}-${item.name}-${idx}`}
                className="group flex items-center justify-between p-3 hover:bg-[#252525] rounded-lg transition-colors border border-transparent hover:border-[#333]"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className={`p-2 rounded-lg shrink-0 ${isUnlocked ? 'bg-green-900/20 text-green-400' : 'bg-[#222] text-gray-500'}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className={`font-bold text-sm truncate ${isUnlocked ? 'text-white' : 'text-gray-400'}`}>{item.name}</h3>
                        <a 
                            href={getWikiUrl(item.name)} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-gray-600 hover:text-osrs-gold transition-colors p-0.5 rounded hover:bg-white/5 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                            title="Open OSRS Wiki"
                        >
                            <ExternalLink size={12} />
                        </a>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-gray-600 font-mono uppercase tracking-wide shrink-0">{item.type}</span>
                       <span className="text-[10px] text-gray-700 hidden group-hover:inline-block transition-opacity truncate">• {item.reqText}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                   <div className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${isUnlocked ? 'bg-green-900/10 border-green-500/30 text-green-400' : 'bg-red-900/10 border-red-500/30 text-red-400'}`}>
                      {isUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                      {detail}
                   </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-[#111] px-4 py-2 border-t border-[#333] flex justify-between items-center text-[10px] text-gray-600 font-mono uppercase">
           <span>Global Search</span>
           <div className="flex gap-4">
              <span className="flex items-center gap-1"><kbd className="bg-[#333] px-1 rounded text-gray-400">Esc</kbd> to close</span>
              <span className="flex items-center gap-1"><kbd className="bg-[#333] px-1 rounded text-gray-400">Ctrl+K</kbd> to open</span>
           </div>
        </div>

      </div>
    </div>
  );
};
