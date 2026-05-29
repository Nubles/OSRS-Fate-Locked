import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { 
  EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, REGION_GROUPS, MISTHALIN_AREAS, 
  MOBILITY_LIST, ARCANA_LIST, MINIGAMES_LIST, BOSSES_LIST, POH_LIST, 
  MERCHANTS_LIST, STORAGE_LIST, GUILDS_LIST, 
  FARMING_PATCH_LIST, FARMING_UNLOCK_DETAILS, EQUIPMENT_TIER_MAX, 
  REGION_ICONS, SLOT_CONFIG, SPECIAL_ICONS, wikiUrlFor, UTILITY_ITEM_IDS,
  SKILL_UNLOCK_DATA
} from '../constants';
import { useGame } from '../context/GameContext';
import {
  Sparkles, Search, User, Map, Swords, Package,
  ExternalLink, Unlock, Lock, Compass, ChevronDown, ChevronsUp, AlertCircle, BookOpen, ScrollText, Globe, List, Filter, Info, Share2, MapPin, Route, Trophy
} from 'lucide-react';
import { VoidReveal } from './VoidReveal';
import { TableType } from '../types';
import { wikiService } from '../services/WikiService';
import { NoteTrigger } from './NoteTrigger';
import { RegionMap } from './RegionMap';
// Heavy tab/modal contents — code-split so their large data dependencies
// (questData, diaryTasks, caTasks, collectionLogData, requirements, etc.)
// stay out of the initial dashboard bundle.
const GoalTracker = lazy(() => import('./GoalTracker').then(m => ({ default: m.GoalTracker })));
const QuestLog = lazy(() => import('./QuestLog').then(m => ({ default: m.QuestLog })));
const DiaryLog = lazy(() => import('./DiaryLog').then(m => ({ default: m.DiaryLog })));
const CALog = lazy(() => import('./CALog').then(m => ({ default: m.CALog })));
const CollectionLog = lazy(() => import('./CollectionLog').then(m => ({ default: m.CollectionLog })));
const SkillDetailModal = lazy(() => import('./SkillDetailModal').then(m => ({ default: m.SkillDetailModal })));
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { ModalFallback } from './LoadingFallback';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useUnlockReveal } from '../hooks/useUnlockReveal';
import { UnlockReveal } from './UnlockReveal';
import { useAchievementReveal } from '../hooks/useAchievementReveal';
import { AchievementReveal } from './AchievementReveal';
import { getGameMode } from '../config/gameModes';
import { getActivityRegion } from '../data/activityRegions';
import { RegionAdvisorPanel } from './RegionAdvisorPanel';
import { SkillAdvisorPanel } from './SkillAdvisorPanel';

// Code-split: the run card pulls in html2canvas only when actually opened.
const RunCardModal = lazy(() => import('./RunCard').then(m => ({ default: m.RunCardModal })));
// Goal Planner modal — pulls in the full quest/diary datasets, so load on demand.
const GoalPlannerModal = lazy(() => import('./GoalPlannerModal').then(m => ({ default: m.GoalPlannerModal })));
// Achievements modal — pulls in the quest/diary/CA datasets via the engine.
const AchievementsModal = lazy(() => import('./AchievementsModal').then(m => ({ default: m.AchievementsModal })));

// --- Constants & Helpers ---

const TABS = [
  { id: 'CHARACTER', label: 'Character', icon: User, color: 'text-blue-400', border: 'border-blue-500' },
  { id: 'WORLD', label: 'World', icon: Globe, color: 'text-emerald-400', border: 'border-emerald-500' },
  { id: 'ACTIVITIES', label: 'Activities & Utility', icon: Swords, color: 'text-red-400', border: 'border-red-500' },
  { id: 'JOURNAL', label: 'Journal', icon: ScrollText, color: 'text-cyan-400', border: 'border-cyan-500' },
  { id: 'COLLECTION', label: 'Collection Log', icon: BookOpen, color: 'text-amber-600', border: 'border-amber-600' },
];

// Define the 10-tier progression colors
const TIER_COLORS = [
  'bg-stone-700',       // Tier 1:  Basic (Stone)
  'bg-orange-900',      // Tier 2:  Bronze
  'bg-slate-500',       // Tier 3:  Iron
  'bg-slate-300',       // Tier 4:  Steel
  'bg-emerald-700',     // Tier 5:  Adamant
  'bg-cyan-600',        // Tier 6:  Rune
  'bg-red-700',         // Tier 7:  Dragon
  'bg-purple-600',      // Tier 8:  Ancient/Barrows
  'bg-fuchsia-500',     // Tier 9:  Crystal
  'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]', // Tier 10: Gilded/Max
];

const getWikiUrl = wikiUrlFor;

// Equipment tiers run 1..9 (EQUIPMENT_TIER_MAX). A stone→gold ramp mirrors the
// skill tier palette so the slot badges, breakdown bars, and legend all read
// consistently. Index 0 = Tier 1.
const EQUIP_TIER_COLORS = [
  'bg-stone-600',   // T1
  'bg-orange-900',  // T2
  'bg-slate-500',   // T3
  'bg-slate-300',   // T4
  'bg-emerald-700', // T5
  'bg-cyan-600',    // T6
  'bg-red-700',     // T7
  'bg-purple-600',  // T8
  'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.7)]', // T9 (max)
];
const equipTierColor = (tier: number) =>
  EQUIP_TIER_COLORS[Math.min(Math.max(tier - 1, 0), EQUIP_TIER_COLORS.length - 1)];

const getSkillIcon = (skillName: string) => `https://oldschool.runescape.wiki/images/${skillName}_icon.png`;

// --- Sub-Components ---

interface ProgressBarProps {
  current: number;
  total: number;
  colorClass: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, colorClass }) => {
  const percent = Math.round((current / total) * 100);
  return (
    <div className="w-full bg-black/50 rounded-full h-2 mt-1 border border-white/5 relative overflow-hidden group">
      <div className={`h-full rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${percent}%` }} />
      <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white drop-shadow opacity-0 group-hover:opacity-100 transition-opacity">
        {percent}%
      </div>
    </div>
  );
};

interface UnlockCardProps {
  item: string;
  isUnlocked: boolean;
  canUnlock: boolean;
  icon?: string;
  onClick: () => void;
  subText?: string;
  region?: string;
}

const UnlockCard: React.FC<UnlockCardProps> = ({
  item,
  isUnlocked,
  canUnlock,
  icon,
  onClick,
  subText,
  region
}) => {
  const wikiIcon = icon || SPECIAL_ICONS[item] || 'Globe_icon.png';
  const itemId = UTILITY_ITEM_IDS[item];
  const imageUrl = itemId 
    ? `https://chisel.weirdgloop.org/static/img/osrs-sprite/${itemId}.png`
    : `https://oldschool.runescape.wiki/images/${wikiIcon}`;
  
  return (
    <div 
        onClick={!isUnlocked && canUnlock ? onClick : undefined}
        className={`
            relative flex items-center gap-3 p-2 rounded-lg border transition-all duration-200 group min-h-[60px]
            ${isUnlocked 
                ? 'bg-[#252525] border-white/10 hover:border-white/20' 
                : canUnlock 
                    ? 'bg-purple-900/10 border-purple-500/30 cursor-pointer hover:bg-purple-900/20 hover:scale-[1.01]' 
                    : 'bg-[#151515] border-transparent opacity-60'}
        `}
    >
        <div className="absolute top-1 right-1 z-10">
            <NoteTrigger id={item} title={item} />
        </div>

        <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${isUnlocked ? 'bg-black/30' : 'bg-black/20'}`}>
             <img 
                src={imageUrl} 
                alt={item} 
                className={`w-7 h-7 object-contain ${isUnlocked ? 'drop-shadow-md' : 'grayscale opacity-50'}`} 
                onError={(e) => { 
                   const target = e.target as HTMLImageElement;
                   if (itemId && !target.src.includes('wiki')) {
                       // Fallback to wiki if ID fails
                       target.src = `https://oldschool.runescape.wiki/images/${wikiIcon}`;
                   } else {
                       target.src = 'https://oldschool.runescape.wiki/images/Globe_icon.png';
                   }
                }} 
             />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center pr-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`text-xs font-bold leading-tight break-words ${isUnlocked ? 'text-gray-200' : canUnlock ? 'text-purple-300' : 'text-gray-500'}`}>
                    {item}
                </span>
                {isUnlocked && (
                    <a href={getWikiUrl(item)} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-white transition-colors p-0.5 shrink-0" onClick={e => e.stopPropagation()} title="Open Wiki">
                        <ExternalLink size={12} />
                    </a>
                )}
            </div>
            {subText && <div className="text-[10px] text-gray-500 leading-tight mt-0.5">{subText}</div>}
            {region && (
                <div className="flex items-center gap-1 text-[10px] text-emerald-400/80 leading-tight mt-0.5">
                    <MapPin size={9} className="shrink-0" />
                    <span className="truncate">{region}</span>
                </div>
            )}
        </div>
        
        <div className="absolute bottom-1 right-1.5 flex items-center justify-center pointer-events-none">
            {isUnlocked ? <Unlock size={12} className="text-green-500/50" /> : <Lock size={12} className={canUnlock ? "text-purple-400 animate-pulse" : "text-gray-700"} />}
        </div>
    </div>
  );
};

interface CollapsibleSectionProps {
  title: string;
  children: React.ReactNode;
  colorClass: string;
  defaultOpen?: boolean;
  forceOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ 
  title, 
  children, 
  colorClass,
  defaultOpen = false,
  forceOpen = false
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const show = isOpen || forceOpen;

  return (
    <div className="space-y-1 mb-2 h-max">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center justify-between w-full text-left group py-2 border-b border-white/10 hover:bg-white/5 transition-colors rounded px-2 -mx-2"
      >
        <h3 className={`${colorClass} font-bold text-sm uppercase tracking-wide`}>{title}</h3>
        <ChevronDown size={14} className={`${colorClass} opacity-70 group-hover:opacity-100 transition-all duration-200 ${show ? 'rotate-180' : ''}`} />
      </button>
      
      {show && (
        <div className="animate-in slide-in-from-top-1 fade-in duration-200 pt-2">
          {children}
        </div>
      )}
    </div>
  );
};

// --- Main Dashboard Component ---

export const Dashboard: React.FC = () => {
  const { unlocks, levelUpSkill, specialKeys, unlockContent, animationsEnabled, gameModeId } = useGame();
  const activeMode = getGameMode(gameModeId);
  const [activeTab, setActiveTab] = useState('CHARACTER');
  const [activityCategory, setActivityCategory] = useState('BOSSES');
  const [journalSubTab, setJournalSubTab] = useLocalStorage<'QUESTS' | 'DIARIES' | 'CA'>('jrnl:subtab', 'QUESTS');
  const [worldView, setWorldView] = useState<'LIST' | 'MAP'>('MAP');
  const [showRunCard, setShowRunCard] = useState(false);
  const [showGoalPlanner, setShowGoalPlanner] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);
  const [levelingSkill, setLevelingSkill] = useState<string | null>(null);
  const [pendingSpecial, setPendingSpecial] = useState<{table: TableType, item: string, image?: string} | null>(null);
  const [confirmOmni, setConfirmOmni] = useState<{table: TableType, item: string} | null>(null);
  const [selectedSkillForDetails, setSelectedSkillForDetails] = useState<{name: string, tier: number} | null>(null);

  const [unlockReveal, dismissReveal] = useUnlockReveal(unlocks);
  const [achievementReveal, dismissAchievementReveal] = useAchievementReveal(unlocks);

  useEscapeKey(() => setShowRunCard(false), showRunCard);
  useEscapeKey(() => setSelectedSkillForDetails(null), selectedSkillForDetails !== null);

  // The Journal summary card lives in the persistent left sidebar (App.tsx), so
  // it can't set this component's tab state directly. It dispatches a
  // `navigate-journal` event instead; we open the Journal tab + matching sub-tab.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: 'QUESTS' | 'DIARIES' | 'CA' }>).detail?.tab;
      if (!tab) return;
      setActiveTab('JOURNAL');
      setJournalSubTab(tab);
    };
    window.addEventListener('navigate-journal', onNavigate);
    return () => window.removeEventListener('navigate-journal', onNavigate);
  }, [setJournalSubTab]);

  // --- Calculations ---
  const totalSkillTiers = useMemo(() => (Object.values(unlocks.skills) as number[]).reduce((a, b) => a + b, 0), [unlocks.skills]);
  const totalEquipTiers = useMemo(() => (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0), [unlocks.equipment]);

  // Aggregate stats for the equipment overview panel (summary + per-slot bars).
  const equipStats = useMemo(() => {
    const entries = EQUIPMENT_SLOTS.map((slot) => ({ slot, tier: unlocks.equipment[slot] || 0 }));
    const maxPossible = EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX;
    const maxed = entries.filter((e) => e.tier >= EQUIPMENT_TIER_MAX).length;
    const unlocked = entries.filter((e) => e.tier > 0).length;
    // Weakest = lowest-tier slot (first one wins on ties) — your upgrade priority.
    const weakest = entries.reduce((lo, e) => (e.tier < lo.tier ? e : lo), entries[0]);
    return {
      entries,
      maxed,
      unlocked,
      weakest,
      avg: totalEquipTiers / EQUIPMENT_SLOTS.length,
      pct: Math.round((totalEquipTiers / maxPossible) * 100),
    };
  }, [unlocks.equipment, totalEquipTiers]);
  
  const completionPercent = useMemo(() => {
    const totalUnlocked = totalSkillTiers + unlocks.regions.length + totalEquipTiers + unlocks.mobility.length + unlocks.arcana.length + unlocks.housing.length + unlocks.merchants.length + unlocks.minigames.length + unlocks.bosses.length + unlocks.storage.length + unlocks.guilds.length + unlocks.farming.length;
    const totalAvailable = (SKILLS_LIST.length * 10) + REGIONS_LIST.length + (EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX) + MOBILITY_LIST.length + ARCANA_LIST.length + POH_LIST.length + MERCHANTS_LIST.length + MINIGAMES_LIST.length + BOSSES_LIST.length + STORAGE_LIST.length + GUILDS_LIST.length + FARMING_PATCH_LIST.length;
    return Math.round((totalUnlocked / totalAvailable) * 100);
  }, [totalSkillTiers, totalEquipTiers, unlocks]);

  // --- Handlers ---
  const handleLevelUp = (skill: string) => {
    if (animationsEnabled) {
        setLevelingSkill(skill);
        setTimeout(() => setLevelingSkill(null), 500);
    }
    levelUpSkill(skill);
  };

  const handleSpecialUnlock = (table: TableType, name: string) => {
      setConfirmOmni({ table, item: name });
  };

  const proceedWithSpecialUnlock = async () => {
      if (!confirmOmni) return;
      const { table, item } = confirmOmni;
      setConfirmOmni(null);

      let imageUrl = undefined;
      
      // Prefer ID based image
      if (UTILITY_ITEM_IDS[item]) {
         imageUrl = `https://chisel.weirdgloop.org/static/img/osrs-sprite/${UTILITY_ITEM_IDS[item]}.png`;
      } 
      // Fetch image from wiki for specific tables if no ID or as fallback.
      // Keep this list in sync with GachaSection.tsx's WIKI_FETCH_TYPES.
      else if (['region', 'boss', 'minigame', 'storage', 'guild', 'mobility', 'arcana', 'housing', 'merchants', 'farming'].some(s => table.toLowerCase().includes(s))) {
         const wikiUrl = await wikiService.fetchImage(item);
         if (wikiUrl) imageUrl = wikiUrl;
      } else {
         if (table === TableType.SKILLS) imageUrl = `https://oldschool.runescape.wiki/images/${item}_icon.png`;
         else if (table === TableType.EQUIPMENT) imageUrl = SLOT_CONFIG[item] ? `https://oldschool.runescape.wiki/images/${SLOT_CONFIG[item].file}` : undefined;
         else imageUrl = SPECIAL_ICONS[item] ? `https://oldschool.runescape.wiki/images/${SPECIAL_ICONS[item]}` : undefined;
      }
      setPendingSpecial({ table, item, image: imageUrl });
  };

  const finalizeSpecial = () => {
      if (pendingSpecial) unlockContent(pendingSpecial.table, pendingSpecial.item, 'specialKey', 1);
      setPendingSpecial(null);
  };

  // --- Render Sections ---

  const renderCharacterTab = () => (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
        {/* Equipment Section */}
        <div className="flex flex-col h-full">
             <div className="flex justify-between items-center bg-[#151515] p-2 rounded border border-white/5 mb-4 shrink-0">
                <h3 className="text-gray-300 font-bold text-sm">Equipment Slots</h3>
                <span className="text-xs text-gray-500 font-mono">{totalEquipTiers}/{EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX} Tiers</span>
             </div>
             
             {/* Visual Equipment Layout */}
             <div className="shrink-0 flex items-center justify-center bg-[#1a1814] rounded-lg border border-[#3a352e] shadow-inner relative min-h-[420px] py-6 overflow-hidden">
                {/* Soft radial glow for depth behind the paper-doll. */}
                <div
                  className="absolute inset-0 pointer-events-none z-0"
                  style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 45%, rgba(133,112,72,0.16), transparent 70%)' }}
                />
                <div className="grid grid-cols-3 gap-6 w-max relative z-10">
                    {EQUIPMENT_SLOTS.map(slot => {
                        const tier = unlocks.equipment[slot] || 0;
                        const isUnlocked = tier > 0;
                        const canUnlock = tier < EQUIPMENT_TIER_MAX && specialKeys > 0;
                        
                        // Filter logic: Show if unlocked OR if can be unlocked
                        if (showOnlyActionable && !isUnlocked && !canUnlock) return null;

                        const config = SLOT_CONFIG[slot];
                        if (!config) return null;

                        return (
                            <div key={slot} className={`${config.gridArea} relative group`}>
                                <button 
                                    onClick={() => canUnlock && handleSpecialUnlock(TableType.EQUIPMENT, slot)} 
                                    disabled={!canUnlock} 
                                    className={`
                                        w-20 h-20 relative flex items-center justify-center rounded-lg bg-[#28241d] border-2 border-[#453f36] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] transition-all duration-150
                                        ${canUnlock ? 'ring-1 ring-purple-400/50 hover:ring-2 hover:ring-purple-400/80 hover:scale-105 z-20 cursor-pointer hover:border-purple-400/70 hover:bg-[#322d25]' : 'cursor-default'}
                                        ${isUnlocked ? 'border-[#857048] bg-[#322a1e]' : ''}
                                    `}
                                    title={`${slot}: Tier ${tier}`}
                                >
                                    <img src={`https://oldschool.runescape.wiki/images/${config.file}`} className={`w-10 h-10 object-contain drop-shadow-md transition-all duration-300 ${isUnlocked ? 'opacity-100 brightness-110 scale-110' : 'opacity-20 grayscale scale-90 group-hover:opacity-40'}`} />
                                    <div className={`absolute -bottom-3 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border shadow-md transition-colors ${isUnlocked ? 'bg-[#3d3322] text-[#fbbf24] border-[#fbbf24]/30' : 'bg-[#151515] text-gray-600 border-gray-700'}`}>
                                        T{tier}
                                    </div>
                                </button>
                                <div className="absolute top-0 right-0 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <NoteTrigger id={`Equip_${slot}`} title={slot} />
                                </div>
                            </div>
                        );
                    })}
                </div>
             </div>

             {/* Equipment Overview — summary stats, tier legend, and a per-slot
                 tier breakdown. Fills the space under the paper-doll and gives a
                 quick read on overall gear progress + the weakest slot. */}
             <div className="mt-4 bg-[#151515] border border-white/10 rounded-xl p-4 space-y-4">
                {/* Summary stat tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                   <div className="bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover-lift">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Tiers</div>
                      <div className="text-sm font-bold text-amber-300">{equipStats.pct}%</div>
                      <div className="text-[9px] text-gray-600 font-mono">{totalEquipTiers}/{EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX}</div>
                   </div>
                   <div className="bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover-lift">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Avg Tier</div>
                      <div className="text-sm font-bold text-gray-200">{equipStats.avg.toFixed(1)}</div>
                      <div className="text-[9px] text-gray-600 font-mono">{equipStats.unlocked}/{EQUIPMENT_SLOTS.length} used</div>
                   </div>
                   <div className="bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover-lift">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Maxed</div>
                      <div className="text-sm font-bold text-yellow-400">{equipStats.maxed}</div>
                      <div className="text-[9px] text-gray-600 font-mono">at T{EQUIPMENT_TIER_MAX}</div>
                   </div>
                   <div className="bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2 hover-lift">
                      <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-0.5">Weakest</div>
                      <div className="text-sm font-bold text-red-300 truncate" title={equipStats.weakest.slot}>{equipStats.weakest.slot}</div>
                      <div className="text-[9px] text-gray-600 font-mono">T{equipStats.weakest.tier}</div>
                   </div>
                </div>

                {/* Tier legend */}
                <div className="flex items-center gap-1.5 flex-wrap">
                   <span className="text-[9px] uppercase tracking-widest text-gray-500 mr-1">Low</span>
                   {EQUIP_TIER_COLORS.map((c, i) => (
                      <div key={i} className="flex flex-col items-center gap-0.5" title={`Tier ${i + 1}`}>
                         <div className={`w-4 h-2.5 rounded-sm ${c}`} />
                         <span className="text-[8px] text-gray-600 font-mono leading-none">{i + 1}</span>
                      </div>
                   ))}
                   <span className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">Max</span>
                </div>

                {/* Per-slot breakdown */}
                <div className="space-y-1.5">
                   {equipStats.entries.map(({ slot, tier }) => {
                      const config = SLOT_CONFIG[slot];
                      return (
                         <div key={slot} className="flex items-center gap-2.5">
                            <img
                               src={`https://oldschool.runescape.wiki/images/${config?.file ?? 'Globe_icon.png'}`}
                               alt=""
                               className={`w-4 h-4 object-contain shrink-0 ${tier > 0 ? '' : 'grayscale opacity-40'}`}
                            />
                            <span className={`text-[10px] font-semibold w-14 shrink-0 ${tier > 0 ? 'text-gray-300' : 'text-gray-600'}`}>{slot}</span>
                            <div className="flex gap-px flex-1 h-1.5 bg-black/50 rounded-sm overflow-hidden border border-white/5">
                               {Array.from({ length: EQUIPMENT_TIER_MAX }).map((_, i) => (
                                  <div key={i} className={`flex-1 transition-all duration-500 ${tier > i ? equipTierColor(tier) : 'bg-[#1a1a1a]'}`} />
                               ))}
                            </div>
                            <span className={`text-[9px] font-mono font-bold w-7 text-right shrink-0 ${tier >= EQUIPMENT_TIER_MAX ? 'text-yellow-400' : tier > 0 ? 'text-amber-300/80' : 'text-gray-600'}`}>T{tier}</span>
                         </div>
                      );
                   })}
                </div>
             </div>
        </div>

        {/* Skills Section */}
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#151515] p-2 rounded border border-white/5">
                <h3 className="text-blue-400 font-bold text-sm">Skills</h3>
                <span className="text-xs text-blue-400/60 font-mono">{totalSkillTiers}/{SKILLS_LIST.length * 10} Tiers</span>
            </div>

            {/* Skill Advisor — ranks which skill to train next (and to what
                level) by how much quest + diary content the threshold unlocks.
                Clicking a row flashes the matching skill card below. */}
            <SkillAdvisorPanel />

            <div className="grid grid-cols-3 gap-2">
                {SKILLS_LIST.map(skill => {
                    const tier = unlocks.skills[skill] || 0;
                    const level = unlocks.levels[skill] || 1;
                    const isUnlocked = tier > 0;
                    const methodRange = tier === 0 ? 'None' : (tier === 10 ? '1-99' : `1-${tier * 10}`);
                    
                    const canLevel = isUnlocked && level < 99;
                    const canOmniUpgrade = specialKeys > 0 && tier < 10;
                    const canUnlockStart = !isUnlocked && specialKeys > 0;

                    // Filter Logic
                    if (showOnlyActionable && !isUnlocked && !canUnlockStart) return null;

                    const handleMainClick = () => {
                        if (canUnlockStart) {
                             handleSpecialUnlock(TableType.SKILLS, skill);
                        } else if (canLevel) {
                             handleLevelUp(skill);
                        }
                    };
                    
                    const isMainActionable = canUnlockStart || canLevel;
                    const tierColorText = isUnlocked ? 'text-gray-200' : 'text-gray-500';

                    if (searchQuery && !skill.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                    return (
                        <div
                           key={skill}
                           data-skill-card={skill}
                           onClick={isMainActionable ? handleMainClick : undefined}
                           className={`
                                flex flex-col p-2 rounded bg-[#1f1f1f] border border-white/5 text-left transition-all duration-150 relative overflow-hidden group min-h-[60px]
                                ${canLevel ? 'hover:bg-[#2a2a2a] cursor-pointer ring-1 ring-green-500/20 hover:ring-green-500/40' : ''}
                                ${canUnlockStart ? 'ring-1 ring-purple-400/40 hover:ring-purple-400/70 hover:bg-purple-900/10 cursor-pointer' : ''}
                                ${levelingSkill === skill ? 'animate-pulse bg-green-900/40' : ''}
                                ${!isMainActionable ? 'opacity-90' : ''}
                           `}
                           role="button"
                           tabIndex={isMainActionable ? 0 : -1}
                        >
                            {/* Note Trigger */}
                            <div className="absolute top-1 right-1 z-30">
                                <NoteTrigger id={skill} title={skill} />
                            </div>

                            {/* Omni Upgrade Button */}
                            {isUnlocked && canOmniUpgrade && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleSpecialUnlock(TableType.SKILLS, skill);
                                    }}
                                    className={`
                                        absolute top-1 right-8 w-5 h-5 flex items-center justify-center rounded border transition-all z-20
                                        bg-purple-900/20 text-purple-400 border-purple-500/30 hover:bg-purple-600 hover:text-white hover:border-purple-400
                                    `}
                                    title={`Unlock Tier ${tier + 1} (1 Omni-Key)`}
                                >
                                    <ChevronsUp size={12} strokeWidth={3} />
                                </button>
                            )}

                            <div className="flex items-center gap-2 mb-2 w-full">
                                {/* Skill Icon as Details Button */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedSkillForDetails({ name: skill, tier });
                                    }}
                                    className="shrink-0 transition-transform hover:scale-110 z-20 cursor-pointer p-0.5 rounded hover:bg-white/5"
                                    title="View Skill Details"
                                >
                                    <img src={getSkillIcon(skill)} className={`w-5 h-5 ${isUnlocked ? '' : 'grayscale opacity-40'}`} />
                                </button>
                                
                                <div className="min-w-0 flex-1 pointer-events-none">
                                    <div className={`text-[10px] font-bold truncate ${tierColorText}`}>{skill}</div>
                                    <div className="text-[9px] text-gray-400 font-mono leading-none mt-0.5">
                                        {isUnlocked ? `Lvl ${level}/99` : 'Locked'}
                                    </div>
                                    <div className="text-[8px] text-gray-500 mt-0.5 leading-none">
                                        Methods: <span className="text-gray-400">{methodRange}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Segmented Progress Bar */}
                            <div className="flex gap-px w-full h-1.5 mt-auto bg-black/50 rounded-sm overflow-hidden border border-white/5 pointer-events-none">
                                {Array.from({ length: 10 }).map((_, i) => {
                                    const isActive = tier > i;
                                    const colorClass = isActive ? TIER_COLORS[Math.min(tier - 1, 9)] : 'bg-[#1a1a1a]';
                                    return (
                                        <div 
                                            key={i} 
                                            className={`flex-1 transition-all duration-500 ${colorClass}`} 
                                        />
                                    );
                                })}
                            </div>
                            
                            {/* Hover Overlay for Main Action */}
                            {isMainActionable && (
                                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2 pointer-events-none z-10">
                                    <span className="text-[9px] font-bold bg-black/80 px-2 py-0.5 rounded text-white border border-white/20 shadow-lg">
                                        {canUnlockStart ? 'UNLOCK' : (canLevel ? 'LEVEL UP' : '')}
                                    </span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );

  const renderGridSection = (items: string[], unlocked: string[], type: TableType, iconMap?: Record<string, string>, detailsMap?: Record<string, string>) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map(item => {
            if (searchQuery && !item.toLowerCase().includes(searchQuery.toLowerCase())) return null;
            const isUnlocked = unlocked.includes(item);
            const canUnlock = !isUnlocked && specialKeys > 0;
            const sub = detailsMap ? detailsMap[item] : undefined;
            
            // Filter logic: Show if unlocked OR can unlock (Omni)
            if (showOnlyActionable && !isUnlocked && !canUnlock) return null;

            return (
                <UnlockCard
                    key={item}
                    item={item}
                    isUnlocked={isUnlocked}
                    canUnlock={canUnlock}
                    icon={iconMap ? iconMap[item] : undefined}
                    onClick={() => handleSpecialUnlock(type, item)}
                    subText={sub}
                    region={getActivityRegion(item)}
                />
            );
        })}
    </div>
  );

  const renderWorldTab = () => (
      <div className="flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-4 px-2 pt-2 shrink-0">
               <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wide">Regions</h3>
               <div className="flex bg-[#1a1a1a] p-1 rounded-lg border border-white/10">
                   <button 
                     onClick={() => setWorldView('MAP')}
                     className={`p-1.5 rounded transition-colors ${worldView === 'MAP' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-white'}`}
                     title="Map View"
                   >
                       <Map size={16} />
                   </button>
                   <button 
                     onClick={() => setWorldView('LIST')}
                     className={`p-1.5 rounded transition-colors ${worldView === 'LIST' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-white'}`}
                     title="List View"
                   >
                       <List size={16} />
                   </button>
               </div>
          </div>

          {worldView === 'MAP' ? (
              <div className="flex-1 bg-[#050505] rounded-lg border border-white/10 overflow-hidden relative">
                  <PanelErrorBoundary name="Region map">
                    <RegionMap />
                  </PanelErrorBoundary>
              </div>
          ) : (
              <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
                  {/* Region Advisor — shows which locked regions would unlock the most
                      quests + diary tiers, helping ironmen pick the next unlock target. */}
                  <RegionAdvisorPanel />

                  {/* Misthalin Special Card */}
                  <div className="bg-[#1a1a1a] rounded border border-emerald-500/30 p-3 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-emerald-900/5 pointer-events-none"></div>
                      <div className="absolute top-1 right-1 z-20">
                            <NoteTrigger id="Misthalin" title="Misthalin" />
                      </div>
                      <div className="flex items-center gap-2 mb-2 relative z-10">
                          <Compass className="w-5 h-5 text-emerald-400" />
                          <span className="font-bold text-sm text-emerald-200">Misthalin (Starter Area)</span>
                          <span className="ml-auto text-xs text-emerald-400 font-mono flex items-center gap-1">
                              <Unlock size={10} /> Unlocked
                          </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 relative z-10 pr-6">
                          {MISTHALIN_AREAS.map(area => (
                              <a 
                                  key={area}
                                  href={getWikiUrl(area)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2 py-1 bg-emerald-900/20 text-emerald-200 border border-emerald-500/20 rounded text-xs hover:bg-emerald-900/40 hover:text-white transition-colors flex items-center gap-1"
                              >
                                  {area} <ExternalLink size={8} className="opacity-50" />
                              </a>
                          ))}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(REGION_GROUPS).map(([group, areas]) => {
                          const unlockedCount = areas.filter(a => unlocks.regions.includes(a)).length;
                          
                          // Search filter support for grouped regions
                          const matchesGroup = group.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesArea = areas.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
                          if (searchQuery && !matchesGroup && !matchesArea) return null;

                          // Actionable filter: Hide group if all regions locked and no keys
                          // But regions are grouped. Individual sub-regions are unlockable.
                          const canUnlockAny = specialKeys > 0;
                          const hasAnyUnlocked = unlockedCount > 0;
                          
                          if (showOnlyActionable && !hasAnyUnlocked && !canUnlockAny) return null;

                          return (
                              <div key={group} data-region-card={group} className="bg-[#1a1a1a] rounded border border-white/5 p-3 h-full relative transition-shadow duration-300">
                                  <div className="absolute top-1 right-1 z-20">
                                        <NoteTrigger id={group} title={group} />
                                  </div>
                                  <div className="flex items-center gap-2 mb-2 pr-6">
                                      <img src={`https://oldschool.runescape.wiki/images/${REGION_ICONS[group] || 'Globe_icon.png'}`} className="w-5 h-5 object-contain" />
                                      <span className="font-bold text-sm text-gray-200">{group}</span>
                                      <span className="ml-auto text-xs text-gray-500 font-mono">{unlockedCount}/{areas.length}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                      {areas.map(area => {
                                          const isUnlocked = unlocks.regions.includes(area);
                                          const canUnlock = !isUnlocked && specialKeys > 0;
                                          
                                          // If searching, highlight matching specific areas, or show all if group matches
                                          if (searchQuery && !matchesGroup && !area.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                                          // Filter logic inside group
                                          if (showOnlyActionable && !isUnlocked && !canUnlock) return null;

                                          if (isUnlocked) {
                                              return (
                                                  <a 
                                                        key={area}
                                                        href={getWikiUrl(area)}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2 py-1 bg-emerald-900/10 text-emerald-200 border border-emerald-500/10 rounded text-xs hover:bg-emerald-900/30 hover:text-white transition-colors flex items-center gap-1"
                                                  >
                                                      {area}
                                                  </a>
                                              )
                                          }
                                          return (
                                              <button 
                                                key={area} 
                                                onClick={() => canUnlock && handleSpecialUnlock(TableType.REGIONS, area)}
                                                disabled={!canUnlock}
                                                className={`
                                                    px-2 py-1 rounded text-xs border flex items-center gap-1
                                                    ${canUnlock ? 'bg-purple-900/10 text-purple-300 border-purple-500/30 hover:bg-purple-900/20 cursor-pointer' : 'bg-[#222] text-gray-600 border-transparent cursor-default'}
                                                `}
                                              >
                                                  {area} {canUnlock && <Lock size={8} />}
                                              </button>
                                          )
                                      })}
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>
          )}
      </div>
  );

  const renderActivitiesTab = () => {
      type ActivityCategory = {
        id: string; label: string; color: string; bar: string;
        list: string[]; unlocked: string[]; type: TableType;
        details?: Record<string, string>;
      };
      const categories: ActivityCategory[] = [
        { id: 'BOSSES',    label: 'Bosses & Raids',     color: 'text-red-400',    bar: 'bg-red-500',    list: BOSSES_LIST,        unlocked: unlocks.bosses,    type: TableType.BOSSES },
        { id: 'MINIGAMES', label: 'Minigames',          color: 'text-cyan-400',   bar: 'bg-cyan-500',   list: MINIGAMES_LIST,     unlocked: unlocks.minigames, type: TableType.MINIGAMES },
        { id: 'FARMING',   label: 'Farming Patches',    color: 'text-green-400',  bar: 'bg-green-500',  list: FARMING_PATCH_LIST, unlocked: unlocks.farming,   type: TableType.FARMING_LAYERS, details: FARMING_UNLOCK_DETAILS },
        { id: 'MOBILITY',  label: 'Mobility',           color: 'text-amber-400',  bar: 'bg-amber-500',  list: MOBILITY_LIST,      unlocked: unlocks.mobility,  type: TableType.MOBILITY },
        { id: 'GUILDS',    label: 'Guilds',             color: 'text-teal-400',   bar: 'bg-teal-500',   list: GUILDS_LIST,        unlocked: unlocks.guilds,    type: TableType.GUILDS },
        { id: 'ARCANA',    label: 'Arcana',             color: 'text-violet-400', bar: 'bg-violet-500', list: ARCANA_LIST,        unlocked: unlocks.arcana,    type: TableType.ARCANA },
        { id: 'POH',       label: 'Player Owned House', color: 'text-orange-400', bar: 'bg-orange-500', list: POH_LIST,           unlocked: unlocks.housing,   type: TableType.POH },
        { id: 'STORAGE',   label: 'Storage',            color: 'text-amber-600',  bar: 'bg-amber-600',  list: STORAGE_LIST,       unlocked: unlocks.storage,   type: TableType.STORAGE },
        { id: 'MERCHANTS', label: 'Merchants',          color: 'text-yellow-400', bar: 'bg-yellow-500', list: MERCHANTS_LIST,     unlocked: unlocks.merchants, type: TableType.MERCHANTS },
      ];

      // Search mode: span every category so a search isn't trapped in one tab.
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matching = categories.filter(c => c.list.some(i => i.toLowerCase().includes(q)));
        return (
          <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
            {matching.length === 0 && (
              <div className="text-center text-gray-600 text-sm py-10">No activities match "{searchQuery}".</div>
            )}
            {matching.map(c => (
              <div key={c.id}>
                <h3 className={`${c.color} font-bold text-sm uppercase tracking-wide border-b border-white/10 pb-2 mb-2`}>{c.label}</h3>
                {renderGridSection(c.list, c.unlocked, c.type, SPECIAL_ICONS, c.details)}
              </div>
            ))}
          </div>
        );
      }

      const selected = categories.find(c => c.id === activityCategory) ?? categories[0];

      return (
        <div className="h-full flex flex-col">
          {/* Category selector with live progress */}
          <div className="flex flex-wrap gap-1.5 pb-3 shrink-0">
            {categories.map(c => {
              const isActive = c.id === selected.id;
              const total = c.list.length;
              const got = c.unlocked.length;
              const pct = total ? Math.round((got / total) * 100) : 0;
              return (
                <button
                  key={c.id}
                  onClick={() => setActivityCategory(c.id)}
                  className={`px-2.5 py-1.5 rounded-lg border text-left transition-all w-[130px]
                    ${isActive ? 'bg-[#252525] border-white/20 shadow-sm' : 'bg-[#161616] border-white/5 hover:border-white/15'}`}
                >
                  <div className={`text-[11px] font-bold truncate ${isActive ? c.color : 'text-gray-400'}`}>{c.label}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 bg-black/50 rounded-full overflow-hidden">
                      <div className={`h-full ${c.bar} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[9px] font-mono text-gray-500 shrink-0">{got}/{total}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected category grid */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar pb-10">
            <h3 className={`${selected.color} font-bold text-sm uppercase tracking-wide border-b border-white/10 pb-2 mb-3 flex items-center justify-between`}>
              {selected.label}
              <span className="text-[10px] font-mono text-gray-500">
                {selected.unlocked.length} / {selected.list.length} unlocked
              </span>
            </h3>
            {renderGridSection(selected.list, selected.unlocked, selected.type, SPECIAL_ICONS, selected.details)}
          </div>
        </div>
      );
  };

  const renderJournalTab = () => (
      <div className="h-full flex flex-col">
          <div className="flex bg-[#1a1a1a] border-b border-white/10 shrink-0">
              <button 
                  onClick={() => setJournalSubTab('QUESTS')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${journalSubTab === 'QUESTS' ? 'bg-[#222] text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                  Quests
              </button>
              <button 
                  onClick={() => setJournalSubTab('DIARIES')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${journalSubTab === 'DIARIES' ? 'bg-[#222] text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                  Diaries
              </button>
              <button 
                  onClick={() => setJournalSubTab('CA')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${journalSubTab === 'CA' ? 'bg-[#222] text-red-400 border-b-2 border-red-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                  Combat Achievements
              </button>
          </div>
          <div className="flex-1 overflow-hidden p-2">
              <Suspense fallback={<ModalFallback />}>
                  {journalSubTab === 'QUESTS' && <QuestLog searchTerm={searchQuery} />}
                  {journalSubTab === 'DIARIES' && <DiaryLog searchTerm={searchQuery} />}
                  {journalSubTab === 'CA' && <CALog searchTerm={searchQuery} />}
              </Suspense>
          </div>
      </div>
  );

  return (
    <>
    <div className="bg-osrs-panel border border-osrs-border rounded-lg shadow-lg flex flex-col h-full overflow-hidden relative">
      {pendingSpecial && (
          <VoidReveal itemName={pendingSpecial.item} itemType={pendingSpecial.table} itemImage={pendingSpecial.image} onComplete={finalizeSpecial} animationsEnabled={animationsEnabled} />
      )}

      {selectedSkillForDetails && (
          <Suspense fallback={<ModalFallback />}>
              <SkillDetailModal
                  skill={selectedSkillForDetails.name}
                  currentTier={selectedSkillForDetails.tier}
                  onClose={() => setSelectedSkillForDetails(null)}
              />
          </Suspense>
      )}

      {/* Confirmation Modal */}
      {confirmOmni && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
              <div className="bg-[#1a1a1a] border border-purple-500/50 rounded-xl shadow-2xl p-6 max-w-sm w-full relative">
                  <div className="flex items-center gap-3 mb-4">
                      <div className="p-3 bg-purple-900/20 rounded-full border border-purple-500/30 text-purple-400">
                          <Sparkles size={24} />
                      </div>
                      <div>
                          <h3 className="text-lg font-bold text-white leading-none">Confirm Unlock</h3>
                          <p className="text-xs text-purple-400 mt-1 font-mono uppercase tracking-wider">Omni-Key Required</p>
                      </div>
                  </div>
                  
                  <p className="text-gray-300 text-sm leading-relaxed mb-6">
                      Are you sure you want to use <b>1 Omni-Key</b> to explicitly unlock <span className="text-white font-bold">{confirmOmni.item}</span>?
                  </p>

                  <div className="flex gap-3">
                      <button 
                          onClick={() => setConfirmOmni(null)}
                          className="flex-1 py-2 rounded border border-white/10 hover:bg-white/5 text-gray-400 text-sm font-bold transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={proceedWithSpecialUnlock}
                          className="flex-1 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                      >
                          <Unlock size={14} /> Confirm
                      </button>
                  </div>
              </div>
          </div>
      )}
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-[#1b1b1b] shrink-0">
         <div className="flex justify-between items-center mb-3">
             <h2 className="text-lg font-bold text-osrs-gold flex items-center gap-2">
                 Progression Dashboard
                 <span
                   className="text-[10px] font-normal text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/30"
                   title={activeMode.description}
                 >
                    {activeMode.name} Mode
                 </span>
                 {specialKeys > 0 && (
                    <span className={`text-[10px] font-normal text-purple-200 bg-purple-900/50 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1 ${animationsEnabled ? 'animate-pulse' : ''}`}>
                        <Sparkles size={10} /> Omni-Key Active
                    </span>
                 )}
             </h2>
             <div className="flex items-center gap-3">
               <button
                 onClick={() => setShowGoalPlanner(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-[11px] font-medium transition-colors"
                 title="Plan the route to any quest, diary, or region"
               >
                 <Route size={12} />
                 Goal Planner
               </button>
               <button
                 onClick={() => setShowAchievements(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-[11px] font-medium transition-colors"
                 title="View achievements & milestones"
               >
                 <Trophy size={12} />
                 Achievements
               </button>
               <button
                 onClick={() => setShowRunCard(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-[11px] font-medium transition-colors"
                 title="Generate shareable run card"
               >
                 <Share2 size={12} />
                 Share Run
               </button>
               <div className="flex items-center gap-2 pl-1" title={`${completionPercent}% complete`}>
                 <div className="relative w-9 h-9 shrink-0">
                   <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                     <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                     <circle
                       cx="18" cy="18" r="15" fill="none" stroke="url(#compGrad)" strokeWidth="3" strokeLinecap="round"
                       strokeDasharray={2 * Math.PI * 15}
                       strokeDashoffset={(1 - completionPercent / 100) * 2 * Math.PI * 15}
                       className="transition-all duration-700 ease-out"
                     />
                     <defs>
                       <linearGradient id="compGrad" x1="0" y1="0" x2="1" y2="1">
                         <stop offset="0%" stopColor="#3b82f6" />
                         <stop offset="50%" stopColor="#a855f7" />
                         <stop offset="100%" stopColor="#f59e0b" />
                       </linearGradient>
                     </defs>
                   </svg>
                   <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-100">{completionPercent}%</span>
                 </div>
                 <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500 hidden lg:block">Complete</span>
               </div>
             </div>
         </div>
         <ProgressBar current={completionPercent} total={100} colorClass="bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500" />
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row border-b border-white/5 bg-[#161616] shrink-0">
          <div className="flex flex-1 overflow-x-auto no-scrollbar">
              {TABS.map(tab => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap
                            ${isActive ? `${tab.color} ${tab.border} bg-white/5` : 'text-gray-500 border-transparent hover:text-gray-300 hover:text-gray-300 hover:bg-white/5'}
                        `}
                      >
                          <Icon size={14} /> {tab.label}
                      </button>
                  )
              })}
          </div>
          <div className="p-2 border-l border-white/5 relative bg-[#161616] flex items-center gap-2">
              <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                  <input 
                    type="text" 
                    placeholder="Filter unlocks..." 
                    className="bg-black/30 border border-white/10 rounded-full py-1 pl-8 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/20 w-full transition-all focus:w-48"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
              </div>
              <button 
                onClick={() => setShowOnlyActionable(!showOnlyActionable)}
                className={`p-1.5 rounded-full transition-all ${showOnlyActionable ? 'bg-green-600 text-white shadow-lg' : 'bg-black/30 text-gray-500 border border-white/10 hover:text-white'}`}
                title={showOnlyActionable ? "Showing Actionable Only" : "Show Actionable Content"}
              >
                  <Filter size={14} />
              </button>
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-4 bg-[#111]">
          <Suspense fallback={<ModalFallback />}>
              <GoalTracker />
          </Suspense>
          {activeTab === 'CHARACTER' && renderCharacterTab()}
          {activeTab === 'WORLD' && renderWorldTab()}
          {activeTab === 'ACTIVITIES' && renderActivitiesTab()}
          {activeTab === 'JOURNAL' && renderJournalTab()}
          {activeTab === 'COLLECTION' && (
              <div className="h-full p-2">
                  <Suspense fallback={<ModalFallback />}>
                      <CollectionLog searchTerm={searchQuery} />
                  </Suspense>
              </div>
          )}
      </div>
    </div>
    {showRunCard && (
      <Suspense fallback={<ModalFallback label="Building run card…" />}>
        <RunCardModal onClose={() => setShowRunCard(false)} />
      </Suspense>
    )}

    {showGoalPlanner && (
      <Suspense fallback={<ModalFallback label="Loading planner…" />}>
        <GoalPlannerModal onClose={() => setShowGoalPlanner(false)} />
      </Suspense>
    )}

    {showAchievements && (
      <Suspense fallback={<ModalFallback label="Loading achievements…" />}>
        <AchievementsModal onClose={() => setShowAchievements(false)} />
      </Suspense>
    )}

    {/* Celebratory reveal when a milestone is newly earned. */}
    {achievementReveal && (
      <AchievementReveal
        data={achievementReveal}
        onDismiss={dismissAchievementReveal}
        onView={() => setShowAchievements(true)}
      />
    )}

    {/* Unlock reveal — slides in from the right when a quest or region
        unlocks and shows what new content just became available. */}
    {unlockReveal && (
      <UnlockReveal
        data={unlockReveal}
        onDismiss={dismissReveal}
        onViewJournal={(tab) => {
          setActiveTab('JOURNAL');
          setJournalSubTab(tab);
        }}
      />
    )}
    </>
  );
};
