
import React, { useState, useMemo } from 'react';
import { TableType } from '../types';
import { useGame } from '../context/GameContext';
import { checkUnlockAvailability, getPoolAndStateKey, isValidUnlock, UNLOCK_COST } from '../utils/gameEngine';
import { REGION_ICONS, SLOT_CONFIG, SPECIAL_ICONS, EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, MINIGAMES_LIST, BOSSES_LIST, POH_LIST, MERCHANTS_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST, UTILITY_ITEM_IDS } from '../constants';
import { VoidReveal } from './VoidReveal';
import { wikiService } from '../services/WikiService';
import { Sparkles, Dices, HelpCircle, Dna, Lock, Sprout, TrendingUp, AlertTriangle } from 'lucide-react';

// --- Inner Components ---
interface SpendCardProps {
  type: TableType;
  label: string;
  subLabel: string;
  description: string;
  disabled: boolean;
  keysAvailable: boolean;
  complete: boolean;
  icon?: any;
  iconSrc?: string;
  onClick: () => void;
  priceDisplay?: string;
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
};

const SpendCard: React.FC<SpendCardProps> = ({
  label, subLabel, description, disabled, keysAvailable, complete, icon: Icon, iconSrc, onClick, priceDisplay = "1"
}) => {
  const theme = {
      bg: 'bg-[#2a2620]', border: 'border-[#4a453d]', hoverBorder: 'hover:border-[#fbbf24]',
      text: 'text-[#d1d5db]', subText: 'text-[#888]', iconBg: 'text-[#fbbf24]',
      glow: 'shadow-[inset_0_0_15px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_0_10px_rgba(251,191,36,0.1)]'
  };
  const isClickable = !disabled && keysAvailable && !complete;
  const isLocked = !keysAvailable && !complete;

  return (
    <button
      onClick={onClick}
      disabled={!isClickable}
      className={`relative overflow-hidden rounded-md border-2 transition-all duration-150 w-full text-left group flex flex-col p-3 shadow-lg h-full min-h-[110px] ${isClickable ? `${theme.bg} ${theme.border} ${theme.hoverBorder} ${theme.glow} hover:-translate-y-1 hover:shadow-xl` : 'bg-[#111111] border-[#222222] cursor-not-allowed'}`}
    >
      <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>
      <div className={`flex justify-between items-start w-full relative z-10 mb-2 transition-opacity duration-300 ${isLocked ? 'opacity-20' : 'opacity-100'}`}>
        <div className={`p-1.5 rounded bg-[#1a1814] border border-[#3a352e] shadow-inner ${theme.iconBg} flex items-center justify-center w-8 h-8 shrink-0`}>
           {iconSrc ? <img src={iconSrc} alt={label} className="w-5 h-5 object-contain drop-shadow-md" /> : (Icon && <Icon size={20} strokeWidth={1.5} />)}
        </div>
        {complete ? (
           <div className="flex flex-col items-end h-8 justify-center">
             <span className="px-2 py-0.5 bg-green-900/40 text-green-400 text-[9px] font-bold uppercase rounded border border-green-800 tracking-wider">Done</span>
           </div>
        ) : (
           <div className={`flex flex-col items-end h-8 justify-center`}>
              <span className="text-[9px] uppercase tracking-widest text-[#666] font-bold leading-none mb-0.5 font-mono">Price</span>
              <span className="text-osrs-gold font-bold text-lg leading-none text-shadow-osrs">{priceDisplay}</span>
           </div>
        )}
      </div>
      <div className={`relative z-10 flex-1 transition-opacity duration-300 ${isLocked ? 'opacity-20' : 'opacity-100'} w-full`}>
          <h3 className={`text-sm font-bold ${theme.text} text-shadow-osrs group-hover:text-[#fbbf24] transition-colors leading-tight pr-1 break-words`}>{label}</h3>
          <p className={`text-[10px] ${theme.subText} font-mono mt-0.5 text-shadow-osrs uppercase break-words leading-tight`}>{subLabel}</p>
      </div>
      <div className={`mt-3 flex items-center justify-between w-full relative z-10 pt-2 border-t border-white/5 transition-opacity duration-300 ${isLocked ? 'opacity-20' : 'opacity-100'}`}>
         <span className="text-[9px] text-[#666] uppercase tracking-wide font-bold pr-2 flex-1 leading-tight break-words">{description}</span>
         {isClickable && (
           <div className="flex items-center gap-1 text-[10px] text-[#888] group-hover:text-white transition-colors px-1.5 py-0.5 rounded bg-black/30 border border-[#333] shadow-sm whitespace-nowrap shrink-0">
             <span className="font-medium">Roll</span>
             <Dices size={12} className="group-hover:rotate-12 transition-transform duration-300" />
           </div>
         )}
      </div>
      {isLocked && (
           <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/20 backdrop-blur-[1px]">
               <Lock className="w-5 h-5 mb-1 text-[#666] drop-shadow-md" />
               <span className="text-[10px] font-bold uppercase tracking-widest text-[#666] font-mono text-shadow-osrs">Need Keys</span>
           </div>
      )}
    </button>
  );
};

export const GachaSection: React.FC = () => {
  const { keys, chaosKeys, unlocks, unlockContent, animationsEnabled } = useGame();
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
    return SPECIAL_ICONS[item] ? `${baseUrl}${SPECIAL_ICONS[item]}` : undefined;
  };
  
  const WIKI_FETCH_TYPES = [
      'region', 'boss', 'minigame', 'storage', 'guild', 
      'mobility', 'housing', 'arcana', 'merchants'
  ];

  // Calculate Total Level for Display
  const totalLevel = useMemo(() => {
      return Object.values(unlocks.levels).reduce((a, b) => (a as number) + (b as number), 0) as number;
  }, [unlocks.levels]);

  const handleUnlock = async (table: TableType) => {
    if (pendingReveal) return; // Guard: Do not allow another roll while reveal is pending
    if (keys <= 0) return;
    const { pool, stateKey } = getPoolAndStateKey(table);
    const validPool = pool.filter(item => isValidUnlock(table, item, unlocks));
    
    if (validPool.length === 0) {
        alert("Nothing left to unlock in this category!");
        return;
    }

    const item = validPool[Math.floor(Math.random() * validPool.length)];
    const cost = UNLOCK_COST;
    let imageUrl = getUnlockImage(stateKey, item);

    // Fetch dynamic image if applicable using WikiService and NO ID override was found
    if (!UTILITY_ITEM_IDS[item] && WIKI_FETCH_TYPES.some(t => stateKey.toLowerCase().includes(t))) {
         const wikiUrl = await wikiService.fetchImage(item);
         if (wikiUrl) imageUrl = wikiUrl;
    }

    setPendingReveal({ item, tableType: table, image: imageUrl, isChaos: false, costType: 'key', cost });
  };

  const handleChaosUnlock = () => {
      if (pendingReveal) return; // Guard: Do not allow another roll while reveal is pending
      if (chaosKeys <= 0) return;

      // Build a global pool of all valid unlocks across all tables
      const allTables = [
          TableType.EQUIPMENT, TableType.SKILLS, TableType.REGIONS, TableType.MOBILITY,
          TableType.ARCANA, TableType.POH, TableType.MERCHANTS, TableType.MINIGAMES,
          TableType.BOSSES, TableType.STORAGE, TableType.GUILDS,
          TableType.FARMING_LAYERS
      ];

      const globalPool: { item: string, tableType: TableType, stateKey: string }[] = [];

      allTables.forEach(table => {
          const { pool, stateKey } = getPoolAndStateKey(table);
          // Pass Infinity for keys because Chaos Key bypasses key cost
          const validItems = pool.filter(item => isValidUnlock(table, item, unlocks));
          validItems.forEach(item => {
              globalPool.push({ item, tableType: table, stateKey });
          });
      });

      if (globalPool.length === 0) {
          alert("Fate has nothing left to offer you. (All content unlocked!)");
          return;
      }

      // Pick a random item from the global pool
      const selection = globalPool[Math.floor(Math.random() * globalPool.length)];
      
      let imageUrl = getUnlockImage(selection.stateKey, selection.item);

      // Async fetch for chaos unlock if no ID found
      if (!UTILITY_ITEM_IDS[selection.item] && WIKI_FETCH_TYPES.some(t => selection.stateKey.toLowerCase().includes(t))) {
          wikiService.fetchImage(selection.item).then(url => {
              if (url) setPendingReveal(prev => prev ? { ...prev, image: url } : prev);
          });
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

  return (
    <div className="h-full flex flex-col relative p-4">
      {pendingReveal && (
          <VoidReveal 
             itemName={pendingReveal.item} 
             itemType={pendingReveal.tableType} 
             itemImage={pendingReveal.image} 
             onComplete={finalizeReveal} 
             isChaos={pendingReveal.isChaos} 
             animationsEnabled={animationsEnabled} 
          />
      )}

      {/* Chaos Key Section */}
      <div className="pb-4">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 custom-scrollbar content-start">
         <SpendCard type={TableType.EQUIPMENT} label="Equipment" subLabel="Upgrade Gear" description={`${EQUIPMENT_SLOTS.length} Slots available`} disabled={!canUnlock.equipment} keysAvailable={keys > 0} complete={!canUnlock.equipment} iconSrc={OSRS_GACHA_ICONS.EQUIPMENT} onClick={() => handleUnlock(TableType.EQUIPMENT)} />
         <SpendCard type={TableType.SKILLS} label="Skills" subLabel="+10 Level Cap" description={`1 of ${SKILLS_LIST.length} Skills`} disabled={!canUnlock.skills} keysAvailable={keys > 0} complete={!canUnlock.skills} iconSrc={OSRS_GACHA_ICONS.SKILLS} onClick={() => handleUnlock(TableType.SKILLS)} />
         <SpendCard type={TableType.REGIONS} label="Areas" subLabel="New Territory" description={`1 of ${REGIONS_LIST.length} Areas`} disabled={!canUnlock.regions} keysAvailable={keys > 0} complete={!canUnlock.regions} iconSrc={OSRS_GACHA_ICONS.REGIONS} onClick={() => handleUnlock(TableType.REGIONS)} />
         <SpendCard type={TableType.MOBILITY} label="Mobility" subLabel="Travel Networks" description={`1 of ${MOBILITY_LIST.length} Types`} disabled={!canUnlock.mobility} keysAvailable={keys > 0} complete={!canUnlock.mobility} iconSrc={OSRS_GACHA_ICONS.MOBILITY} onClick={() => handleUnlock(TableType.MOBILITY)} />
         <SpendCard type={TableType.ARCANA} label="Arcana" subLabel="Spells & Prayers" description={`1 of ${ARCANA_LIST.length} Upgrades`} disabled={!canUnlock.arcana} keysAvailable={keys > 0} complete={!canUnlock.arcana} iconSrc={OSRS_GACHA_ICONS.ARCANA} onClick={() => handleUnlock(TableType.ARCANA)} />
         <SpendCard type={TableType.STORAGE} label="Storage" subLabel="Inventory Space" description={`1 of ${STORAGE_LIST.length} Items`} disabled={!canUnlock.storage} keysAvailable={keys > 0} complete={!canUnlock.storage} iconSrc={OSRS_GACHA_ICONS.STORAGE} onClick={() => handleUnlock(TableType.STORAGE)} />
         <SpendCard type={TableType.POH} label="Housing" subLabel="POH Facilities" description={`1 of ${POH_LIST.length} Upgrades`} disabled={!canUnlock.poh} keysAvailable={keys > 0} complete={!canUnlock.poh} iconSrc={OSRS_GACHA_ICONS.POH} onClick={() => handleUnlock(TableType.POH)} />
         <SpendCard type={TableType.MERCHANTS} label="Merchants" subLabel="Shops & Wares" description={`1 of ${MERCHANTS_LIST.length} Types`} disabled={!canUnlock.merchants} keysAvailable={keys > 0} complete={!canUnlock.merchants} iconSrc={OSRS_GACHA_ICONS.MERCHANTS} onClick={() => handleUnlock(TableType.MERCHANTS)} />
         <SpendCard type={TableType.MINIGAMES} label="Minigames" subLabel="Activities & Fun" description={`1 of ${MINIGAMES_LIST.length} Activities`} disabled={!canUnlock.minigames} keysAvailable={keys > 0} complete={!canUnlock.minigames} iconSrc={OSRS_GACHA_ICONS.MINIGAMES} onClick={() => handleUnlock(TableType.MINIGAMES)} />
         <SpendCard type={TableType.BOSSES} label="Bosses" subLabel="Major Encounters" description={`1 of ${BOSSES_LIST.length} Bosses`} disabled={!canUnlock.bosses} keysAvailable={keys > 0} complete={!canUnlock.bosses} iconSrc={OSRS_GACHA_ICONS.BOSSES} onClick={() => handleUnlock(TableType.BOSSES)} />
         <SpendCard type={TableType.GUILDS} label="Guilds" subLabel="Professional Societies" description={`1 of ${GUILDS_LIST.length} Guilds`} disabled={!canUnlock.guilds} keysAvailable={keys > 0} complete={!canUnlock.guilds} iconSrc={OSRS_GACHA_ICONS.GUILDS} onClick={() => handleUnlock(TableType.GUILDS)} />
         <SpendCard type={TableType.FARMING_LAYERS} label="Farming" subLabel="Patches" description={`1 of ${FARMING_PATCH_LIST.length} Types`} disabled={!canUnlock.farming} keysAvailable={keys > 0} complete={!canUnlock.farming} icon={Sprout} onClick={() => handleUnlock(TableType.FARMING_LAYERS)} />
      </div>
    </div>
  );
};
