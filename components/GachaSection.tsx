
import React, { useState, useMemo } from 'react';
import { TableType } from '../types';
import { useGame } from '../context/GameContext';
import { bankLocksActive } from '../utils/reachability';
import { validateEmptyRandomPoolHandling } from '../data/activityAccess';
import { BANK_IDS, BANK_BY_ID } from '../data/banks';
import { checkUnlockAvailability, describeRandomPoolBlockers, getPoolAndStateKey, isRandomUnlockEligible, pickRandomPoolEntry, UNLOCK_COST } from '../utils/gameEngine';
import { REGION_ICONS, SLOT_CONFIG, SPECIAL_ICONS, EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, MINIGAMES_LIST, BOSSES_LIST, POH_LIST, MERCHANTS_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST, UTILITY_ITEM_IDS } from '../constants';
import { VoidReveal } from './VoidReveal';
import { wikiService } from '../services/WikiService';
import { showToast } from '../utils/toast';
import { Sparkles, Dices, HelpCircle, Dna, Lock, Sprout, TrendingUp, AlertTriangle, Check, Key } from 'lucide-react';
import { COMBAT_POWERS_DESCRIPTION, COMBAT_POWERS_LABEL } from '../utils/tableDisplay';
import { openDashboardPool } from '../utils/dashboardPoolNavigation';
import { ALL_CHUNK_KEYS, chunkLabel } from '../utils/chunkAdjacency';
import { canonicalizeAreaUnlocks } from '../data/areaMapPolicy';

// --- Inner Components ---
interface Accent {
  icon: string;
  bar: string;
  hoverBorder: string;
  hoverShadow: string;
  titleHover: string;
  ctaBorder: string;
  ctaText: string;
  ctaHover: string;
}

/** Per-category accent so the grid is scannable and each table has identity. */
const ACCENTS: Record<string, Accent> = {
  [TableType.EQUIPMENT]: { icon: 'text-amber-300', bar: 'bg-amber-400', hoverBorder: 'hover:border-amber-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(251,191,36,0.6)]', titleHover: 'group-hover:text-amber-200', ctaBorder: 'border-amber-500/25', ctaText: 'text-amber-300/80', ctaHover: 'group-hover:bg-amber-500/15 group-hover:border-amber-400/50 group-hover:text-amber-100' },
  [TableType.SKILLS]: { icon: 'text-sky-300', bar: 'bg-sky-400', hoverBorder: 'hover:border-sky-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(56,189,248,0.6)]', titleHover: 'group-hover:text-sky-200', ctaBorder: 'border-sky-500/25', ctaText: 'text-sky-300/80', ctaHover: 'group-hover:bg-sky-500/15 group-hover:border-sky-400/50 group-hover:text-sky-100' },
  [TableType.REGIONS]: { icon: 'text-emerald-300', bar: 'bg-emerald-400', hoverBorder: 'hover:border-emerald-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(52,211,153,0.6)]', titleHover: 'group-hover:text-emerald-200', ctaBorder: 'border-emerald-500/25', ctaText: 'text-emerald-300/80', ctaHover: 'group-hover:bg-emerald-500/15 group-hover:border-emerald-400/50 group-hover:text-emerald-100' },
  [TableType.CHUNKS]: { icon: 'text-emerald-300', bar: 'bg-emerald-400', hoverBorder: 'hover:border-emerald-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(52,211,153,0.6)]', titleHover: 'group-hover:text-emerald-200', ctaBorder: 'border-emerald-500/25', ctaText: 'text-emerald-300/80', ctaHover: 'group-hover:bg-emerald-500/15 group-hover:border-emerald-400/50 group-hover:text-emerald-100' },
  [TableType.MOBILITY]: { icon: 'text-cyan-300', bar: 'bg-cyan-400', hoverBorder: 'hover:border-cyan-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(34,211,238,0.6)]', titleHover: 'group-hover:text-cyan-200', ctaBorder: 'border-cyan-500/25', ctaText: 'text-cyan-300/80', ctaHover: 'group-hover:bg-cyan-500/15 group-hover:border-cyan-400/50 group-hover:text-cyan-100' },
  [TableType.ARCANA]: { icon: 'text-violet-300', bar: 'bg-violet-400', hoverBorder: 'hover:border-violet-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(167,139,250,0.6)]', titleHover: 'group-hover:text-violet-200', ctaBorder: 'border-violet-500/25', ctaText: 'text-violet-300/80', ctaHover: 'group-hover:bg-violet-500/15 group-hover:border-violet-400/50 group-hover:text-violet-100' },
  [TableType.STORAGE]: { icon: 'text-orange-300', bar: 'bg-orange-400', hoverBorder: 'hover:border-orange-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(251,146,60,0.6)]', titleHover: 'group-hover:text-orange-200', ctaBorder: 'border-orange-500/25', ctaText: 'text-orange-300/80', ctaHover: 'group-hover:bg-orange-500/15 group-hover:border-orange-400/50 group-hover:text-orange-100' },
  [TableType.POH]: { icon: 'text-indigo-300', bar: 'bg-indigo-400', hoverBorder: 'hover:border-indigo-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(129,140,248,0.6)]', titleHover: 'group-hover:text-indigo-200', ctaBorder: 'border-indigo-500/25', ctaText: 'text-indigo-300/80', ctaHover: 'group-hover:bg-indigo-500/15 group-hover:border-indigo-400/50 group-hover:text-indigo-100' },
  [TableType.MERCHANTS]: { icon: 'text-yellow-300', bar: 'bg-yellow-400', hoverBorder: 'hover:border-yellow-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(250,204,21,0.6)]', titleHover: 'group-hover:text-yellow-200', ctaBorder: 'border-yellow-500/25', ctaText: 'text-yellow-300/80', ctaHover: 'group-hover:bg-yellow-500/15 group-hover:border-yellow-400/50 group-hover:text-yellow-100' },
  [TableType.MINIGAMES]: { icon: 'text-pink-300', bar: 'bg-pink-400', hoverBorder: 'hover:border-pink-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(244,114,182,0.6)]', titleHover: 'group-hover:text-pink-200', ctaBorder: 'border-pink-500/25', ctaText: 'text-pink-300/80', ctaHover: 'group-hover:bg-pink-500/15 group-hover:border-pink-400/50 group-hover:text-pink-100' },
  [TableType.BOSSES]: { icon: 'text-red-300', bar: 'bg-red-400', hoverBorder: 'hover:border-red-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(248,113,113,0.6)]', titleHover: 'group-hover:text-red-200', ctaBorder: 'border-red-500/25', ctaText: 'text-red-300/80', ctaHover: 'group-hover:bg-red-500/15 group-hover:border-red-400/50 group-hover:text-red-100' },
  [TableType.GUILDS]: { icon: 'text-teal-300', bar: 'bg-teal-400', hoverBorder: 'hover:border-teal-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(45,212,191,0.6)]', titleHover: 'group-hover:text-teal-200', ctaBorder: 'border-teal-500/25', ctaText: 'text-teal-300/80', ctaHover: 'group-hover:bg-teal-500/15 group-hover:border-teal-400/50 group-hover:text-teal-100' },
  [TableType.FARMING_LAYERS]: { icon: 'text-lime-300', bar: 'bg-lime-400', hoverBorder: 'hover:border-lime-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(163,230,53,0.6)]', titleHover: 'group-hover:text-lime-200', ctaBorder: 'border-lime-500/25', ctaText: 'text-lime-300/80', ctaHover: 'group-hover:bg-lime-500/15 group-hover:border-lime-400/50 group-hover:text-lime-100' },
  [TableType.SLAYER_UNLOCKS]: { icon: 'text-rose-300', bar: 'bg-rose-400', hoverBorder: 'hover:border-rose-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(251,113,133,0.6)]', titleHover: 'group-hover:text-rose-200', ctaBorder: 'border-rose-500/25', ctaText: 'text-rose-300/80', ctaHover: 'group-hover:bg-rose-500/15 group-hover:border-rose-400/50 group-hover:text-rose-100' },
  [TableType.BANKS]: { icon: 'text-amber-300', bar: 'bg-amber-400', hoverBorder: 'hover:border-amber-400/70', hoverShadow: 'hover:shadow-[0_0_22px_-6px_rgba(251,191,36,0.6)]', titleHover: 'group-hover:text-amber-200', ctaBorder: 'border-amber-500/25', ctaText: 'text-amber-300/80', ctaHover: 'group-hover:bg-amber-500/15 group-hover:border-amber-400/50 group-hover:text-amber-100' },
};
const DEFAULT_ACCENT = ACCENTS[TableType.EQUIPMENT];

interface SpendCardProps {
  type: TableType;
  label: string;
  subLabel: string;
  unlocked: number;
  total: number;
  disabled: boolean;
  keysAvailable: boolean;
  complete: boolean;
  icon?: any;
  iconSrc?: string;
  onClick: () => void;
  onViewPool: () => void;
  priceDisplay?: string;
  index?: number;
  animate?: boolean;
}

const OSRS_GACHA_ICONS = {
  EQUIPMENT: 'https://oldschool.runescape.wiki/images/Equipment_Stats.png',
  SKILLS: 'https://oldschool.runescape.wiki/images/Stats_icon.png',
  REGIONS: 'https://oldschool.runescape.wiki/images/World_map_icon.png',
  MOBILITY: 'https://oldschool.runescape.wiki/images/Graceful_boots.png',
  ARCANA: 'https://oldschool.runescape.wiki/images/Spellbook_Swap.png',
  MINIGAMES: 'https://oldschool.runescape.wiki/images/Minigames.png',
  BOSSES: 'https://oldschool.runescape.wiki/images/Culinaromancer.png',
  POH: 'https://oldschool.runescape.wiki/images/Portal_%28Player-owned_house%29.png',
  MERCHANTS: 'https://oldschool.runescape.wiki/images/General_store_icon.png',
  STORAGE: 'https://oldschool.runescape.wiki/images/Looting_bag.png',
  GUILDS: 'https://oldschool.runescape.wiki/images/Achievement_Diaries_icon.png',
  FARMING: 'https://oldschool.runescape.wiki/images/Farming_icon.png',
  SLAYER_UNLOCKS: 'https://oldschool.runescape.wiki/images/Slayer_icon.png',
  BANKS: 'https://oldschool.runescape.wiki/images/Bank_icon.png',
};

export const SpendCard: React.FC<SpendCardProps> = ({
  type, label, subLabel, unlocked, total, disabled, keysAvailable, complete, icon: Icon, iconSrc, onClick, onViewPool, priceDisplay = "1", index = 0, animate = false,
}) => {
  const a = ACCENTS[type] ?? DEFAULT_ACCENT;
  const isClickable = !disabled && keysAvailable && !complete;
  const isLocked = !keysAvailable && !complete;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;
  const dim = isLocked ? 'opacity-30' : 'opacity-100';

  return (
    <div
      style={animate ? { animationDelay: `${index * 30}ms` } : undefined}
      className={`h-full ${animate ? 'animate-fade-in-up' : ''}`}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!isClickable}
        aria-label={`Roll ${label}`}
        className={`relative overflow-hidden rounded-lg border-2 w-full text-left group flex flex-col p-2.5 min-h-[104px] transition-all duration-200 active:scale-[0.98]
        ${isClickable
          ? `bg-[#1f1c17] border-[#3a352c] ${a.hoverBorder} ${a.hoverShadow} hover:-translate-y-1`
          : complete
            ? 'bg-[#14180f] border-[#26331a]'
            : 'bg-[#121212] border-[#222] cursor-not-allowed'}`}
    >
      {/* Hover sheen sweep */}
      {isClickable && (
        <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/[0.07] to-transparent pointer-events-none z-10" />
      )}

      {/* Top: icon + price / done */}
      <div className={`flex justify-between items-start w-full relative z-10 transition-opacity duration-300 ${dim}`}>
        <div className={`w-8 h-8 rounded-lg bg-black/40 border border-white/10 shadow-inner flex items-center justify-center shrink-0 ${a.icon} group-hover:scale-110 transition-transform duration-300`}>
           {iconSrc ? <img src={iconSrc} alt={label} className="w-[18px] h-[18px] object-contain drop-shadow-md" /> : (Icon && <Icon size={18} strokeWidth={1.6} />)}
        </div>
        {complete ? (
           <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-900/40 text-emerald-300 text-[9px] font-bold uppercase rounded border border-emerald-700/50 tracking-wider"><Check size={10} strokeWidth={3} />Done</span>
        ) : (
           <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/40 border border-white/10 shadow-sm">
              <Key size={10} className="text-osrs-gold" />
              <span className="text-osrs-gold font-bold text-sm leading-none text-shadow-osrs">{priceDisplay}</span>
           </div>
        )}
      </div>

      {/* Title */}
      <div className={`relative z-10 mt-1.5 flex-1 transition-opacity duration-300 ${dim}`}>
          <h3 className={`text-sm font-bold text-gray-100 ${a.titleHover} transition-colors leading-tight break-words`}>{label}</h3>
          <p className="text-[9px] text-gray-500 font-mono mt-0.5 uppercase break-words leading-tight">{subLabel}</p>
      </div>

      {/* Progress + Roll affordance (one compact row) */}
      <div className={`relative z-10 mt-1.5 flex items-center gap-2 transition-opacity duration-300 ${dim}`}>
        <div className="flex-1 min-w-0">
          <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
            <div className={`h-full ${complete ? 'bg-emerald-400' : a.bar} rounded-full transition-all duration-700 ease-out`} style={{ width: `${complete ? 100 : pct}%` }} />
          </div>
        </div>
        <span className="text-[9px] font-mono text-gray-400 font-bold shrink-0 leading-none">{unlocked}<span className="text-gray-600">/{total}</span></span>
        {isClickable && (
          <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider shrink-0 ${a.ctaText} ${a.titleHover} transition-colors`}>
            Roll <Dices size={11} className="group-hover:rotate-[24deg] transition-transform duration-300" />
          </span>
        )}
      </div>

      {isLocked && (
           <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/40 backdrop-blur-[1px]">
               <Lock className="w-5 h-5 mb-1 text-gray-600 drop-shadow-md" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600 font-mono">Need Keys</span>
           </div>
      )}
      </button>
      <button
        type="button"
        onClick={onViewPool}
        className="mt-1.5 w-full text-[9px] font-bold uppercase tracking-wider text-gray-400 hover:text-white"
      >
        View pool
      </button>
    </div>
  );
};

export const GachaSection: React.FC = () => {
  const { keys, specialKeys, chaosKeys, unlocks, unlockContent, animationsEnabled, gameModeId, customMode, nextFloat } = useGame();
  const isChunked = gameModeId === 'chunked';
  const bankLocks = bankLocksActive(gameModeId, customMode);
  const [pendingReveal, setPendingReveal] = useState<{ 
      item: string, 
      tableType: TableType, 
      image?: string, 
      isChaos: boolean, 
      costType: 'key'|'chaosKey', 
      cost: number 
  } | null>(null);

  const canUnlock = checkUnlockAvailability(unlocks);

  // Helper to get image (mirrored from App.tsx/gameEngine logic)
  const getUnlockImage = (table: string, item: string) => {
    const baseUrl = 'https://oldschool.runescape.wiki/images/';
    if (UTILITY_ITEM_IDS[item]) return `https://chisel.weirdgloop.org/static/img/osrs-sprite/${UTILITY_ITEM_IDS[item]}.png`;
    
    if (table === 'skill') return `${baseUrl}${item}_icon.png`;
    if (table === 'equipment') return SLOT_CONFIG[item] ? `${baseUrl}${SLOT_CONFIG[item].file}` : undefined;
    if (table === 'region') return REGION_ICONS[item] ? `${baseUrl}${REGION_ICONS[item]}` : `${baseUrl}Globe_icon.png`;
    if (table === 'chunks') return `${baseUrl}World_map_icon.png`;
    if (table === 'banks') return `${baseUrl}Bank_icon.png`;
    return SPECIAL_ICONS[item] ? `${baseUrl}${SPECIAL_ICONS[item]}` : undefined;
  };
  
  // Categories whose unlock items have wiki pages with images we can fetch.
  // Keep this list in sync with the equivalent list in Dashboard.tsx.
  const WIKI_FETCH_TYPES = [
      'region', 'boss', 'minigame', 'storage', 'guild',
      'mobility', 'housing', 'arcana', 'merchants', 'farming',
  ];

  // Calculate Total Level for Display
  const totalLevel = useMemo(() => {
      return Object.values(unlocks.levels).reduce((a, b) => (a as number) + (b as number), 0) as number;
  }, [unlocks.levels]);

  const handleUnlock = async (table: TableType) => {
    if (pendingReveal) return; // Guard: Do not allow another roll while reveal is pending
    if (keys <= 0) return;
    const { pool, stateKey } = getPoolAndStateKey(table);
    const candidates = pool.map(item => ({ table, item }));
    const validPool = pool.filter(item => isRandomUnlockEligible(table, item, unlocks, gameModeId, 'key'));
    
    if (validPool.length === 0) {
        validateEmptyRandomPoolHandling(gameModeId, 'key');
        const blockers = describeRandomPoolBlockers(candidates, unlocks, gameModeId, 'key');
        if (blockers.sample.length > 0) {
            const suffix = blockers.remaining === 1 ? '' : 's';
            showToast(`No accessible unlocks remain in this category. ${blockers.sample.join('; ')}. ${blockers.remaining} more location-locked unlock${suffix} remain.`);
        } else {
            showToast('Nothing left to unlock in this category!');
        }
        return;
    }

    // Seeded-run choke point: table picks must draw through nextFloat.
    const item = pickRandomPoolEntry(validPool, () => nextFloat('gacha'));
    if (item === undefined) return;
    const cost = UNLOCK_COST;
    let imageUrl = getUnlockImage(stateKey, item);

    // Fetch dynamic image if applicable using WikiService and NO ID override was found
    if (!UTILITY_ITEM_IDS[item] && WIKI_FETCH_TYPES.some(t => stateKey.toLowerCase().includes(t))) {
         const wikiUrl = await wikiService.fetchImage(item);
         if (wikiUrl) imageUrl = wikiUrl;
    }

    setPendingReveal({ item, tableType: table, image: imageUrl, isChaos: false, costType: 'key', cost });
  };

  const handleChaosUnlock = async () => {
      if (pendingReveal) return; // Guard: Do not allow another roll while reveal is pending
      if (chaosKeys <= 0) return;

      // Build a global pool of all valid unlocks across all tables
      const allTables = [
          TableType.EQUIPMENT, TableType.SKILLS,
          ...(isChunked ? [TableType.CHUNKS] : [TableType.REGIONS]),
          TableType.MOBILITY, TableType.ARCANA, TableType.POH, TableType.MERCHANTS,
          TableType.MINIGAMES, TableType.BOSSES, TableType.STORAGE, TableType.GUILDS,
          TableType.FARMING_LAYERS, TableType.SLAYER_UNLOCKS,
          ...(bankLocks ? [TableType.BANKS] : []),
      ];

      const globalPool: { item: string, tableType: TableType, stateKey: string }[] = [];
      const candidates: { item: string, table: TableType }[] = [];

      allTables.forEach(table => {
          const { pool, stateKey } = getPoolAndStateKey(table);
          pool.forEach(item => {
              candidates.push({ item, table });
              if (isRandomUnlockEligible(table, item, unlocks, gameModeId, 'chaosKey')) {
                  globalPool.push({ item, tableType: table, stateKey });
              }
          });
      });

      if (globalPool.length === 0) {
        validateEmptyRandomPoolHandling(gameModeId, 'chaosKey');
          const blockers = describeRandomPoolBlockers(candidates, unlocks, gameModeId, 'chaosKey');
          if (blockers.sample.length > 0) {
              const suffix = blockers.remaining === 1 ? '' : 's';
              showToast(`Fate has no accessible unlocks to offer. ${blockers.sample.join('; ')}. ${blockers.remaining} more location-locked unlock${suffix} remain.`);
          } else {
              showToast('Fate has nothing left to offer you — all content unlocked!');
          }
          return;
      }

      // Pick a random item from the global pool (seeded-run choke point).
      const selection = pickRandomPoolEntry(globalPool, () => nextFloat('chaos'));
      if (!selection) return;
      
      let imageUrl = getUnlockImage(selection.stateKey, selection.item);

      // Resolve the wiki image BEFORE opening the reveal (same as handleUnlock)
      // so the modal doesn't flash a missing icon and then pop in.
      if (!UTILITY_ITEM_IDS[selection.item] && WIKI_FETCH_TYPES.some(t => selection.stateKey.toLowerCase().includes(t))) {
          const url = await wikiService.fetchImage(selection.item);
          if (url) imageUrl = url;
      }

      setPendingReveal({
          item: selection.item, 
          tableType: selection.tableType, 
          image: imageUrl, 
          isChaos: true, 
          costType: 'chaosKey', 
          cost: 1 
      });
  };

  const finalizeReveal = () => {
      if (!pendingReveal) return;
      unlockContent(pendingReveal.tableType, pendingReveal.item, pendingReveal.costType, pendingReveal.cost);
      setPendingReveal(null);
  };

  // How many distinct entries the player has unlocked per category, for the
  // per-card progress bars. Equipment/Skills count slots/skills started (tier>0).
  const tierCount = (rec: Record<string, number> | undefined) =>
    Object.values(rec ?? {}).filter((v) => (v as number) > 0).length;
  const SPEND_CATEGORIES: { type: TableType; label: string; subLabel: string; iconSrc?: string; icon?: any; unlocked: number; total: number; can: boolean }[] = [
    { type: TableType.EQUIPMENT, label: 'Equipment', subLabel: 'Upgrade Gear', iconSrc: OSRS_GACHA_ICONS.EQUIPMENT, unlocked: tierCount(unlocks.equipment), total: EQUIPMENT_SLOTS.length, can: canUnlock.equipment },
    { type: TableType.SKILLS, label: 'Skills', subLabel: '+10 Method Levels', iconSrc: OSRS_GACHA_ICONS.SKILLS, unlocked: tierCount(unlocks.skills), total: SKILLS_LIST.length, can: canUnlock.skills },
    isChunked
      ? { type: TableType.CHUNKS, label: 'Chunks', subLabel: 'Adjacent Territory', iconSrc: OSRS_GACHA_ICONS.REGIONS, unlocked: (unlocks.chunks ?? []).length, total: ALL_CHUNK_KEYS.length, can: canUnlock.chunks }
      : { type: TableType.REGIONS, label: 'Areas', subLabel: 'New Territory', iconSrc: OSRS_GACHA_ICONS.REGIONS, unlocked: canonicalizeAreaUnlocks(unlocks.regions ?? []).regions.length, total: REGIONS_LIST.length, can: canUnlock.regions },
    { type: TableType.MOBILITY, label: 'Mobility', subLabel: 'Travel Networks', iconSrc: OSRS_GACHA_ICONS.MOBILITY, unlocked: (unlocks.mobility ?? []).length, total: MOBILITY_LIST.length, can: canUnlock.mobility },
    { type: TableType.ARCANA, label: COMBAT_POWERS_LABEL, subLabel: COMBAT_POWERS_DESCRIPTION, iconSrc: OSRS_GACHA_ICONS.ARCANA, unlocked: (unlocks.arcana ?? []).length, total: ARCANA_LIST.length, can: canUnlock.arcana },
    { type: TableType.STORAGE, label: 'Storage', subLabel: 'Inventory Space', iconSrc: OSRS_GACHA_ICONS.STORAGE, unlocked: (unlocks.storage ?? []).length, total: STORAGE_LIST.length, can: canUnlock.storage },
    { type: TableType.POH, label: 'Housing', subLabel: 'POH Facilities', iconSrc: OSRS_GACHA_ICONS.POH, unlocked: (unlocks.housing ?? []).length, total: POH_LIST.length, can: canUnlock.poh },
    { type: TableType.MERCHANTS, label: 'Merchants', subLabel: 'Shops & Wares', iconSrc: OSRS_GACHA_ICONS.MERCHANTS, unlocked: (unlocks.merchants ?? []).length, total: MERCHANTS_LIST.length, can: canUnlock.merchants },
    { type: TableType.MINIGAMES, label: 'Minigames', subLabel: 'Activities & Fun', iconSrc: OSRS_GACHA_ICONS.MINIGAMES, unlocked: (unlocks.minigames ?? []).length, total: MINIGAMES_LIST.length, can: canUnlock.minigames },
    { type: TableType.BOSSES, label: 'Bosses', subLabel: 'Major Encounters', iconSrc: OSRS_GACHA_ICONS.BOSSES, unlocked: (unlocks.bosses ?? []).length, total: BOSSES_LIST.length, can: canUnlock.bosses },
    { type: TableType.GUILDS, label: 'Guilds', subLabel: 'Professional Societies', iconSrc: OSRS_GACHA_ICONS.GUILDS, unlocked: (unlocks.guilds ?? []).length, total: GUILDS_LIST.length, can: canUnlock.guilds },
    { type: TableType.FARMING_LAYERS, label: 'Farming', subLabel: 'Patches', iconSrc: OSRS_GACHA_ICONS.FARMING, unlocked: (unlocks.farming ?? []).length, total: FARMING_PATCH_LIST.length, can: canUnlock.farming },
    { type: TableType.SLAYER_UNLOCKS, label: 'Slayer', subLabel: 'Reward Unlocks', iconSrc: OSRS_GACHA_ICONS.SLAYER_UNLOCKS, unlocked: (unlocks.slayerUnlocks ?? []).length, total: SLAYER_UNLOCKS_LIST.length, can: canUnlock.slayerUnlocks },
    ...(bankLocks ? [{ type: TableType.BANKS, label: 'Banks', subLabel: 'Bank Access', iconSrc: OSRS_GACHA_ICONS.BANKS, unlocked: (unlocks.banks ?? []).length, total: BANK_IDS.length, can: (canUnlock as any).banks as boolean }] : []),
  ];

  return (
    <div className="h-full flex flex-col relative p-4">
      {pendingReveal && (
          <VoidReveal
             itemName={pendingReveal.tableType === TableType.CHUNKS ? chunkLabel(pendingReveal.item) : pendingReveal.tableType === TableType.BANKS ? (BANK_BY_ID[pendingReveal.item]?.name ?? pendingReveal.item) : pendingReveal.item}
             itemType={pendingReveal.tableType} 
             itemImage={pendingReveal.image} 
             onComplete={finalizeReveal} 
             isChaos={pendingReveal.isChaos} 
             animationsEnabled={animationsEnabled} 
          />
      )}

      {/* Omni-Key hint — these aren't rolled here; they're spent by clicking a
          locked item directly in the Progression Dashboard. */}
      {specialKeys > 0 && (
        <div className="mb-3 w-full p-3 rounded-lg border border-purple-500/50 bg-gradient-to-r from-purple-900/25 to-fuchsia-900/15 flex items-center gap-3 shadow-[0_0_15px_rgba(168,85,247,0.12)]">
          <div className="p-2 bg-purple-500/20 rounded-full border border-purple-500/50 shrink-0">
            <Sparkles className={`text-purple-300 w-5 h-5 ${animationsEnabled ? 'animate-pulse' : ''}`} />
          </div>
          <div className="min-w-0">
            <h3 className="text-purple-300 font-bold uppercase tracking-widest text-sm">
              {specialKeys} Omni-Key{specialKeys > 1 ? 's' : ''} Ready
            </h3>
            <p className="text-[11px] text-purple-300/70 font-mono leading-snug">
              Omni-Keys aren't rolled here — click any locked skill, gear slot, region or boss in the <span className="text-purple-200">Progression Dashboard</span> to pick exactly what to unlock.
            </p>
          </div>
        </div>
      )}

      {/* Chaos Key Section */}
      <div className="pb-3">
        {chaosKeys > 0 ? (
            <button
                onClick={handleChaosUnlock}
                className="w-full p-4 rounded-lg border border-red-500/50 bg-gradient-to-r from-red-900/20 via-purple-900/20 to-red-900/20 flex items-center justify-between group hover:border-red-400 transition-all shadow-[0_0_15px_rgba(220,38,38,0.15)] relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-10"></div>
                <div className="flex items-center gap-3 relative z-10">
                    <div className="p-2 bg-red-500/20 rounded-full border border-red-500/50 animate-pulse"><Dna className="text-red-400 w-6 h-6" /></div>
                    <div className="text-left">
                        <h3 className="text-red-400 font-bold uppercase tracking-widest text-sm flex items-center gap-2">
                            Chaos Key Available
                            <span className="text-[10px] bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/30 text-red-300 animate-pulse">WILDCARD</span>
                        </h3>
                        <p className="text-xs text-red-300/60 font-mono">Unlocks a random item from ANY category.</p>
                    </div>
                </div>
                <div className="text-2xl font-bold text-red-500 group-hover:scale-110 transition-transform relative z-10 text-shadow-osrs">{chaosKeys}</div>
            </button>
        ) : (
            <div className="w-full p-3 rounded-lg border border-white/5 bg-[#1a1a1a] flex items-center justify-between relative overflow-hidden">
                {/* Info */}
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-black/40 rounded-full border border-white/10 grayscale opacity-50"><Dna className="text-gray-500 w-5 h-5" /></div>
                    <div>
                        <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">Chaos Entropy</h3>
                        <p className="text-[10px] text-gray-600 font-mono flex items-center gap-1">
                           <AlertTriangle size={10} /> 2% Chance on Level Up
                        </p>
                    </div>
                </div>
                {/* Total Level Stat */}
                <div className="text-right">
                    <span className="text-xs font-bold text-gray-500 block">{totalLevel}</span>
                    <span className="text-[9px] text-gray-700 uppercase tracking-wide">Total Level</span>
                </div>
            </div>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-2.5 custom-scrollbar content-start">
        {SPEND_CATEGORIES.map((c, i) => (
          <SpendCard
            key={c.label}
            type={c.type}
            label={c.label}
            subLabel={c.subLabel}
            unlocked={c.unlocked}
            total={c.total}
            disabled={!c.can}
            keysAvailable={keys > 0}
            complete={!c.can}
            onViewPool={() => openDashboardPool(c.type)}
            iconSrc={c.iconSrc}
            icon={c.icon}
            onClick={() => handleUnlock(c.type)}
            index={i}
            animate={animationsEnabled}
          />
        ))}
      </div>
    </div>
  );
};
