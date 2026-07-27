
import React, { useEffect, useState, useMemo } from 'react';
import { DropSource } from '../types';
import { DROP_RATES, BOSSES_LIST } from '../constants';
import { bossTier, TIER_SOURCE, TIER_LABEL, TIER_ORDER, BossTier } from '../data/bossKeyTiers';
import { useGame } from '../context/GameContext';
import { BookOpen, ScrollText, Crosshair, Dices } from 'lucide-react';
import { wikiService } from '../services/WikiService';
import { resolveModeRules } from '../config/gameModes';
import { getActiveRegionBonuses } from '../config/regionModifiers';
import { EARN_METHODS, LEVEL_ROLL_MAX } from '../config/economy';
import { BRUTUS_BOSS_NAME, effectiveVanillaClueRate, vanillaBossKeyStage, type KeyRollContext } from '../config/vanillaKeyEconomy';
import { BossKeyProgress, ClueKeyProgress } from './VanillaKeyProgress';
import { VANILLA_BOSS_SEARCH_PLACEHOLDER, vanillaBossSearchEmptyMessage } from './vanillaBossSearchCopy';

// OSRS Wiki Icon URLs
const WIKI_IMG = 'https://oldschool.runescape.wiki/images/';
const OSRS_ICONS = {
  SLAYER: 'https://oldschool.runescape.wiki/images/Slayer_icon.png',
  STATS: 'https://oldschool.runescape.wiki/images/Stats_icon.png',
  COLL_LOG: 'https://oldschool.runescape.wiki/images/Collection_log_icon.png',
  CLUE: 'https://oldschool.runescape.wiki/images/Clue_scroll_%28master%29.png',
  BOSS: 'https://oldschool.runescape.wiki/images/Combat_icon.png',
  ACTIVITY: 'https://oldschool.runescape.wiki/images/Minigames.png',
};

// Live min/max of the journal (one-time) faucets, so the "Other Key Sources"
// chip can't drift from DROP_RATES the way the old hardcoded 10%-100% did.
const JOURNAL_RATES = EARN_METHODS
  .filter(m => ['Quests', 'Achievement Diaries', 'Combat Achievements'].includes(m.category))
  .flatMap(m => m.tiers.map(t => t.rate));
const JOURNAL_MIN = Math.min(...JOURNAL_RATES);
const JOURNAL_MAX = Math.max(...JOURNAL_RATES);

// Component to dynamically fetch wiki image for icons
const WikiIcon = ({ name, fallbackSrc, className }: { name: string, fallbackSrc?: string, className?: string }) => {
  const [src, setSrc] = useState<string | null>(null);
  
  useEffect(() => {
    let mounted = true;
    wikiService.fetchImage(name).then(url => {
        if (mounted && url) setSrc(url);
    });
    return () => { mounted = false; };
  }, [name]);

  const displaySrc = src || fallbackSrc;

  if (!displaySrc) return null;

  return <img src={displaySrc} alt={name} className={className} />;
};

// Unified OSRS Difficulty Tier Styles
const TIER_STYLES = {
  STONE: {
    bg: 'bg-[#2a2620]',
    border: 'border-[#4a453d]',
    hover: 'hover:bg-[#38332a] hover:border-[#6a655d]',
    text: 'text-[#a8a29a]',
    pill: 'bg-[#151310] border-[#3a352e] text-[#888]'
  },
  GREEN: { // Easy / Novice
    bg: 'bg-[#142618]',
    border: 'border-[#2a4c30]',
    hover: 'hover:bg-[#1a3320] hover:border-[#3a6640]',
    text: 'text-[#4ade80]',
    pill: 'bg-[#0a150c] border-[#1f3823] text-[#4ade80]'
  },
  BLUE: { // Medium / Intermediate
    bg: 'bg-[#141e26]',
    border: 'border-[#2a3d4c]',
    hover: 'hover:bg-[#1a2833] hover:border-[#3a5466]',
    text: 'text-[#60a5fa]',
    pill: 'bg-[#0a0f13] border-[#1f2d38] text-[#60a5fa]'
  },
  RED: { // Hard / Experienced
    bg: 'bg-[#2a1414]',
    border: 'border-[#4c2a2a]',
    hover: 'hover:bg-[#331a1a] hover:border-[#663a3a]',
    text: 'text-[#f87171]',
    pill: 'bg-[#150a0a] border-[#2e1515] text-[#f87171]'
  },
  PURPLE: { // Elite / Master (Quest)
    bg: 'bg-[#22142a]',
    border: 'border-[#422a4c]',
    hover: 'hover:bg-[#2d1a33] hover:border-[#573a66]',
    text: 'text-[#c084fc]',
    pill: 'bg-[#110a15] border-[#29152e] text-[#c084fc]'
  },
  AMBER: { // Master (CA/Clue)
    bg: 'bg-[#2a1d14]',
    border: 'border-[#4c352a]',
    hover: 'hover:bg-[#33241a] hover:border-[#66473a]',
    text: 'text-[#fbbf24]',
    pill: 'bg-[#150f0a] border-[#2e2015] text-[#fbbf24]'
  },
  GOLD: { // Grandmaster
    bg: 'bg-[#262314]',
    border: 'border-[#4c462a]',
    hover: 'hover:bg-[#332f1a] hover:border-[#665e3a]',
    text: 'text-[#facc15]',
    pill: 'bg-[#13110a] border-[#2e2a15] text-[#facc15] shadow-[0_0_8px_rgba(250,204,21,0.2)]'
  }
};

// Repeatable PvM faucets — self-reported (click the exact boss you killed, or
// the activity you finished), mirroring how the Slayer/Clue cards work.
const TIER_STYLE: Record<BossTier, typeof TIER_STYLES.GREEN> = {
  raid: TIER_STYLES.GOLD,
  high: TIER_STYLES.PURPLE,
  mid: TIER_STYLES.BLUE,
  low: TIER_STYLES.GREEN,
};
const ACTIVITY_ROLLS = [
  { name: 'Minigame', subText: 'Pest Control, BA, Castle Wars, Soul Wars…', source: DropSource.ACTIVITY_MINIGAME, image: `${WIKI_IMG}Void_knight_mace.png`, style: TIER_STYLES.STONE },
  { name: 'Any Pet',  subText: 'Guaranteed key on a pet drop!',            source: DropSource.PET,               image: `${WIKI_IMG}Vorki.png`,           style: TIER_STYLES.GOLD },
];

type TierStyle = typeof TIER_STYLES.GREEN;

const getTierStyle = (tier: string): TierStyle => {
  const t = tier.toLowerCase();
  if (t.includes('grandmaster')) return TIER_STYLES.GOLD;
  if (t.includes('master')) return TIER_STYLES.AMBER;
  if (t.includes('elite')) return TIER_STYLES.PURPLE;
  if (t.includes('hard') || t.includes('experienced')) return TIER_STYLES.RED;
  if (t.includes('medium') || t.includes('intermediate')) return TIER_STYLES.BLUE;
  if (t.includes('easy') || t.includes('novice')) return TIER_STYLES.GREEN;
  if (t.includes('beginner')) return TIER_STYLES.STONE;
  return TIER_STYLES.STONE;
};

// --- New Suspense Animation Logic ---
const useRollSuspense = (onClick: (e: any) => void) => {
    const [isRolling, setIsRolling] = useState(false);

    const triggerRoll = async (e: React.MouseEvent) => {
        if (isRolling) return;
        
        // Capture event data since synthetic event is reused
        const eventData = { clientX: e.clientX, clientY: e.clientY };
        
        setIsRolling(true);
        
        // Suspense duration (0.6s to match loading bar animation)
        await new Promise(resolve => setTimeout(resolve, 600));
        
        setIsRolling(false);
        onClick(eventData);
    };

    return { isRolling, triggerRoll };
};

// --- Rolling Overlay Component ---
const RollingOverlay = () => (
    <>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] z-20 flex flex-col items-center justify-center animate-in fade-in duration-200">
            <div className="bg-black/50 p-1.5 rounded-full border border-white/20 mb-0.5 shadow-lg">
                <Dices className="w-4 h-4 text-white animate-spin" />
            </div>
            <span className="text-[9px] font-black text-white uppercase tracking-[0.2em] text-shadow-osrs animate-pulse leading-none">
                FATE
            </span>
        </div>
        <div className="absolute bottom-0 left-0 h-1 bg-white/20 w-full z-30">
            <div className="h-full bg-white shadow-[0_0_10px_white] animate-loading-bar origin-left"></div>
        </div>
        <div className="absolute inset-0 border-2 border-white/50 animate-pulse z-20 pointer-events-none rounded-lg"></div>
    </>
);

// --- Slayer Card Component ---
// Small "+N" / "-N" badge shown when region passives shift a roll's odds.
const BonusTag: React.FC<{ bonus: number }> = ({ bonus }) => {
  if (!bonus) return null;
  const up = bonus > 0;
  return (
    <span
      title="Region passive modifier active"
      className={`text-[9px] font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}
    >
      {up ? '+' : '−'}{Math.abs(bonus)}
    </span>
  );
};

interface SlayerMasterProps {
  name: string;
  displayRate: number;
  bonus: number;
  image: string;
  style: TierStyle;
  subText: string;
  onClick: (e: React.MouseEvent) => void;
}

const SlayerMasterCard: React.FC<SlayerMasterProps> = ({ name, displayRate, bonus, image, style, subText, onClick }) => {
  const { isRolling, triggerRoll } = useRollSuspense(onClick);

  return (
    <button 
      onClick={triggerRoll}
      className={`
        relative w-full h-20 overflow-hidden rounded-lg border-2 transition-all duration-200 group text-left
        ${style.bg} ${style.border} ${style.hover}
        shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] active:scale-[0.98]
        ${isRolling ? 'border-white/50 scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)]' : ''}
      `}
    >
      {/* Background Texture */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
      
      {/* Character Portrait (Right Aligned) */}
      <img 
        src={image} 
        alt={name}
        className={`absolute -right-2 -bottom-2 w-auto h-[120%] object-contain transition-all duration-300 filter drop-shadow-lg ${isRolling ? 'opacity-20 grayscale blur-sm' : 'opacity-40 grayscale group-hover:opacity-100 group-hover:scale-110 group-hover:-translate-x-2 group-hover:grayscale-0'}`}
      />

      {/* Content (Left Aligned) */}
      <div className={`absolute inset-0 flex flex-col justify-center items-start pl-4 z-10 pointer-events-none transition-opacity duration-200 ${isRolling ? 'opacity-0' : 'opacity-100'}`}>
        <h3 className={`font-black text-base uppercase tracking-wider ${style.text} drop-shadow-md`}>
          {name}
        </h3>
        <p className="text-[10px] text-gray-400 font-mono mb-1.5">{subText}</p>
        
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${style.pill} shadow-sm flex items-center gap-1.5`}>
           <Crosshair size={10} />
           {displayRate}% Chance
           <BonusTag bonus={bonus} />
        </div>
      </div>

      {/* Hover Flash */}
      {!isRolling && (
          <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
      )}

      {/* Rolling State Overlay */}
      {isRolling && <RollingOverlay />}
    </button>
  );
};

// --- Clue Scroll Card Component ---
interface ClueScrollCardProps {
  tier: string;
  displayRate: number;
  bonus: number;
  itemId: number;
  onClick: (e: React.MouseEvent) => void;
}

const ClueScrollCard: React.FC<ClueScrollCardProps> = ({ tier, displayRate, bonus, itemId, onClick }) => {
  const style = getTierStyle(tier);
  const imageUrl = `https://chisel.weirdgloop.org/static/img/osrs-sprite/${itemId}.png`;
  const { isRolling, triggerRoll } = useRollSuspense(onClick);
  
  return (
    <button 
      onClick={triggerRoll}
      className={`
        relative w-full h-16 overflow-hidden rounded-lg border-2 transition-all duration-200 group
        ${style.bg} ${style.border} ${style.hover}
        shadow-[inset_0_0_10px_rgba(0,0,0,0.2)] active:scale-[0.98]
        flex items-center justify-between px-4
        ${isRolling ? 'border-white/50 scale-[0.98] shadow-[0_0_20px_rgba(255,255,255,0.2)]' : ''}
      `}
    >
      {/* Background Texture */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/shatter.png')] opacity-5 mix-blend-overlay"></div>
      
      {/* Text Info */}
      <div className={`flex flex-col items-start z-10 transition-opacity duration-200 ${isRolling ? 'opacity-0' : 'opacity-100'}`}>
        <span className={`font-black text-sm uppercase tracking-wider ${style.text} drop-shadow-md group-hover:translate-x-1 transition-transform`}>
          {tier}
        </span>
        <div className={`mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold border ${style.pill} bg-black/40 flex items-center gap-1.5 shadow-sm backdrop-blur-sm`}>
           <Crosshair size={9} />
           {displayRate}%
           <BonusTag bonus={bonus} />
        </div>
      </div>

      {/* Clue Icon */}
      <div className={`relative z-10 w-9 h-9 transition-all duration-300 filter drop-shadow-lg flex items-center justify-center bg-black/20 rounded-full border border-white/5 p-1 ${isRolling ? 'opacity-0' : 'group-hover:scale-110'}`}>
         <img src={imageUrl} alt={tier} className="w-full h-full object-contain" />
      </div>

      {/* Hover Flash */}
      {!isRolling && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
      )}

      {/* Rolling State Overlay */}
      {isRolling && <RollingOverlay />}
    </button>
  );
};

// Using Casket Item IDs for uniform visuals
const CLUE_SCROLLS = [
  { tier: "Beginner", source: DropSource.CLUE_BEGINNER, itemId: 23245 }, // Reward casket (beginner)
  { tier: "Easy", source: DropSource.CLUE_EASY, itemId: 20546 },     // Reward casket (easy)
  { tier: "Medium", source: DropSource.CLUE_MEDIUM, itemId: 20545 },   // Reward casket (medium)
  { tier: "Hard", source: DropSource.CLUE_HARD, itemId: 20544 },     // Reward casket (hard)
  { tier: "Elite", source: DropSource.CLUE_ELITE, itemId: 20543 },    // Reward casket (elite)
  { tier: "Master", source: DropSource.CLUE_MASTER, itemId: 19836 },   // Reward casket (master)
];

// Compact card for the per-boss list — name + its own rate, no per-boss art so
// the long (66-entry) list stays scannable. Click rolls at that boss's rate.
const BossRollCard: React.FC<{ name: string; displayRate: number; bonus: number; style: TierStyle; onClick: (e: React.MouseEvent) => void }>
  = ({ name, displayRate, bonus, style, onClick }) => {
  const { isRolling, triggerRoll } = useRollSuspense(onClick);
  return (
    <button
      onClick={triggerRoll}
      disabled={isRolling}
      className={`w-full text-left rounded-lg border p-2.5 flex items-center justify-between gap-2 transition-all ${style.bg} ${style.border} ${style.hover} ${isRolling ? 'opacity-60 cursor-wait' : ''}`}
    >
      <span className={`text-xs font-semibold truncate ${style.text}`}>{name}</span>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${style.pill}`}>
        {displayRate}%{bonus > 0 ? <span className="text-green-400"> +{bonus}</span> : ''}
      </span>
    </button>
  );
};

const VanillaBossRollCard: React.FC<{
  name: string;
  displayRate: number;
  style: TierStyle;
  stage: ReturnType<typeof vanillaBossKeyStage>;
  onClick: (e: React.MouseEvent) => void;
}> = ({ name, displayRate, style, stage, onClick }) => {
  const { isRolling, triggerRoll } = useRollSuspense(onClick);
  const capped = stage.capped;

  return (
    <button
      onClick={triggerRoll}
      disabled={isRolling || capped}
      className={`w-full text-left rounded-lg border p-2.5 flex items-start justify-between gap-2 transition-all ${style.bg} ${style.border} ${!capped ? style.hover : ''} ${isRolling ? 'opacity-60 cursor-wait' : ''} ${capped ? 'opacity-60 cursor-not-allowed' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <span className={`block text-xs font-semibold truncate ${style.text}`}>{name}</span>
        <BossKeyProgress stage={stage} />
      </div>
      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${style.pill}`}>
        {capped ? 'CAPPED' : `${displayRate}%`}
      </span>
    </button>
  );
};
// --- Info chip (non-interactive navigational hint) ---
const InfoChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  desc: React.ReactNode;
  rate: string;
  accent: string;
  badge: string;
}> = ({ icon, label, desc, rate, accent, badge }) => (
  <div className="flex-1 min-w-0 bg-[#111] border border-dashed border-[#333] rounded px-2.5 py-2.5 flex flex-col items-center text-center gap-1.5 font-mono hover:border-white/20 transition-colors">
    <div className="flex items-center gap-1.5">
      {icon}
      <span className={`text-[10px] font-bold uppercase tracking-wide ${accent}`}>{label}</span>
    </div>
    <span className="text-[9px] text-gray-400 leading-tight">{desc}</span>
    <div className={`mt-auto px-2 py-0.5 rounded text-[9px] font-bold border ${badge}`}>{rate}</div>
  </div>
);

type FarmSubTab = 'SLAYER' | 'CLUES' | 'BOSSING' | 'ACTIVITIES';

export const ActionSection: React.FC = () => {
  const { rollForKey, unlocks, gameModeId, customMode, animationsEnabled, bossStandardKeysAwarded, clueStandardKeysAwarded } = useGame();
  const [subTab, setSubTab] = useState<FarmSubTab>('SLAYER');
  const [bossQuery, setBossQuery] = useState('');

  // When the run's mode enables region passives, rolls are boosted. rollForKey
  // applies the bonus internally, so handleRoll still passes the BASE rate —
  // this is purely for an honest on-card display.
  const mode = resolveModeRules(gameModeId, customMode);
  const regionBonus = mode.regionModifiers
    ? getActiveRegionBonuses(unlocks.regions).successBonus
    : 0;
  const effectiveRate = (source: string) =>
    Math.max(1, Math.min(100, (DROP_RATES[source] ?? 0) + regionBonus));

  const handleRoll = (source: string, chance: number, e: React.MouseEvent, context?: KeyRollContext) => {
    rollForKey(source, chance, e.clientX, e.clientY, context);
  };

  const isVanilla = gameModeId === 'vanilla';
  const vanillaBosses = [
    BRUTUS_BOSS_NAME,
    ...unlocks.bosses.filter(name => BOSSES_LIST.includes(name)),
  ];
  const clueKeysAwarded = clueStandardKeysAwarded ?? 0;

  const slayers = useMemo(() => {
    const isWGSComplete = unlocks.quests.includes('While Guthix Sleeps');
    const isMM2Complete = unlocks.quests.includes('Monkey Madness II');

    return [
      {
        name: isWGSComplete ? "Aya" : "Turael",
        subText: "Burthorpe (Beginner)",
        source: DropSource.SLAYER_BEGINNER,
        image: isWGSComplete ? "https://oldschool.runescape.wiki/images/Aya.png" : "https://oldschool.runescape.wiki/images/Turael.png",
        style: TIER_STYLES.STONE
      },
      {
        name: "Spria",
        subText: "Draynor (Beginner)",
        source: DropSource.SLAYER_BEGINNER,
        image: "https://oldschool.runescape.wiki/images/Spria.png",
        style: TIER_STYLES.STONE
      },
      {
        name: "Mazchna",
        subText: "Canifis (Easy)",
        source: DropSource.SLAYER_MAZCHNA,
        image: "https://oldschool.runescape.wiki/images/Mazchna.png",
        style: TIER_STYLES.GREEN
      },
      {
        name: "Vannaka",
        subText: "Edgeville (Medium)",
        source: DropSource.SLAYER_VANNAKA,
        image: "https://oldschool.runescape.wiki/images/Vannaka.png",
        style: TIER_STYLES.BLUE
      },
      {
        name: "Chaeldar",
        subText: "Zanaris (Medium)",
        source: DropSource.SLAYER_CHAELDAR,
        image: "https://oldschool.runescape.wiki/images/Chaeldar.png",
        style: TIER_STYLES.BLUE
      },
      {
        name: "Konar",
        subText: "Mount Karuulm (Hard)",
        source: DropSource.SLAYER_KONAR,
        image: "https://oldschool.runescape.wiki/images/Konar_quo_Maten.png",
        style: TIER_STYLES.RED
      },
      {
        name: isMM2Complete ? "Steve" : "Nieve",
        subText: "Gnome Stronghold (Hard)",
        source: DropSource.SLAYER_NIEVE,
        image: isMM2Complete ? "https://oldschool.runescape.wiki/images/Steve.png" : "https://oldschool.runescape.wiki/images/Nieve.png",
        style: TIER_STYLES.RED
      },
      {
        name: "Krystilia",
        subText: "Wilderness (Elite)",
        source: DropSource.SLAYER_KRYSTILIA,
        image: "https://oldschool.runescape.wiki/images/Krystilia.png",
        style: TIER_STYLES.PURPLE
      },
      {
        name: isWGSComplete ? "Kuradal" : "Duradel",
        subText: "Shilo Village (Elite)",
        source: DropSource.SLAYER_DURADEL,
        image: isWGSComplete ? "https://oldschool.runescape.wiki/images/Kuradal.png" : "https://oldschool.runescape.wiki/images/Duradel.png",
        style: TIER_STYLES.PURPLE
      },
      {
        name: "Boss Task",
        subText: "Boss Slayer / Special",
        source: DropSource.SLAYER_BOSS,
        image: "https://oldschool.runescape.wiki/images/Purple_slayer_helmet.png",
        style: TIER_STYLES.AMBER
      }
    ];
  }, [unlocks.quests]);

  const tabs: { id: FarmSubTab; label: string; icon: string; count: number }[] = [
    { id: 'SLAYER', label: 'Slayer', icon: OSRS_ICONS.SLAYER, count: slayers.length },
    { id: 'CLUES', label: 'Clues', icon: OSRS_ICONS.CLUE, count: CLUE_SCROLLS.length },
    { id: 'BOSSING', label: 'Bossing', icon: OSRS_ICONS.BOSS, count: isVanilla ? vanillaBosses.length : BOSSES_LIST.length },
    { id: 'ACTIVITIES', label: 'Activities', icon: OSRS_ICONS.ACTIVITY, count: ACTIVITY_ROLLS.length },
  ];

  return (
    <div className="h-full p-4 flex flex-col gap-3">

      {/* Sub-tab toggle */}
      <div className="flex gap-1 bg-[#161616] border border-white/5 rounded-lg p-1 shrink-0">
        {tabs.map(tab => {
          const isActive = subTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all
                ${isActive
                  ? 'bg-[#252525] text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#1d1d1d]'}`}
            >
              <img src={tab.icon} alt="" className={`w-4 h-4 object-contain ${isActive ? 'opacity-100' : 'opacity-50'}`} />
              {tab.label}
              <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-mono text-gray-400">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Active list — full-width 2-column grid */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar -mr-1 pr-1">
        {subTab === 'SLAYER' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {slayers.map((master, i) => (
              <div
                key={master.name}
                className={animationsEnabled ? 'animate-fade-in-up' : ''}
                style={animationsEnabled ? { animationDelay: `${i * 35}ms` } : undefined}
              >
                <SlayerMasterCard
                  name={master.name}
                  subText={master.subText}
                  displayRate={effectiveRate(master.source)}
                  bonus={regionBonus}
                  image={master.image}
                  style={master.style}
                  onClick={(e) => handleRoll(master.source, DROP_RATES[master.source], e)}
                />
              </div>
            ))}
          </div>
        )}
        {subTab === 'CLUES' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {CLUE_SCROLLS.map((clue, i) => {
              const baseRate = DROP_RATES[clue.source];
              const displayRate = isVanilla
                ? effectiveVanillaClueRate(baseRate, clueKeysAwarded)
                : effectiveRate(clue.source);

              return (
                <div
                  key={clue.tier}
                  className={animationsEnabled ? 'animate-fade-in-up' : ''}
                  style={animationsEnabled ? { animationDelay: `${i * 35}ms` } : undefined}
                >
                  <ClueScrollCard
                    tier={clue.tier}
                    displayRate={displayRate}
                    bonus={isVanilla ? 0 : regionBonus}
                    itemId={clue.itemId}
                    onClick={(e) => handleRoll(
                      clue.source,
                      baseRate,
                      e,
                      isVanilla ? { kind: 'clue', clueTier: clue.tier } : undefined,
                    )}
                  />
                  {isVanilla && <ClueKeyProgress awarded={clueKeysAwarded} baseRate={baseRate} />}
                </div>
              );
            })}
          </div>
        )}
        {subTab === 'BOSSING' && isVanilla && (
          <div>
            <input
              value={bossQuery}
              onChange={(e) => setBossQuery(e.target.value)}
              placeholder={VANILLA_BOSS_SEARCH_PLACEHOLDER}
              className="w-full mb-3 bg-[#161616] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/25"
            />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
              {vanillaBosses
                .filter(name => name.toLowerCase().includes(bossQuery.trim().toLowerCase()))
                .map(name => {
                  const bossClass = name === BRUTUS_BOSS_NAME ? 'brutus' : bossTier(name);
                  const source = bossClass === 'brutus' ? TIER_SOURCE.low : TIER_SOURCE[bossClass];
                  const stage = vanillaBossKeyStage(name, bossStandardKeysAwarded?.[name] ?? 0);

                  return (
                    <VanillaBossRollCard
                      key={name}
                      name={name}
                      displayRate={stage.currentRate ?? 0}
                      style={bossClass === 'brutus' ? TIER_STYLE.low : TIER_STYLE[bossClass]}
                      stage={stage}
                      onClick={(e) => handleRoll(source, stage.currentRate ?? 0, e, {
                        kind: 'boss',
                        bossName: name,
                        bossClass,
                      })}
                    />
                  );
                })}
            </div>
            {vanillaBosses.filter(name => name.toLowerCase().includes(bossQuery.trim().toLowerCase())).length === 0 && (
              <div className="text-center text-gray-600 text-xs py-6">{vanillaBossSearchEmptyMessage(bossQuery)}</div>
            )}
          </div>
        )}
        {subTab === 'BOSSING' && !isVanilla && (
          <div>
            <input
              value={bossQuery}
              onChange={(e) => setBossQuery(e.target.value)}
              placeholder="Search bosses…"
              className="w-full mb-3 bg-[#161616] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-white/25"
            />
            {TIER_ORDER.map(tier => {
              const q = bossQuery.trim().toLowerCase();
              const list = BOSSES_LIST.filter(b => bossTier(b) === tier && b.toLowerCase().includes(q));
              if (list.length === 0) return null;
              const source = TIER_SOURCE[tier];
              const style = TIER_STYLE[tier];
              return (
                <div key={tier} className="mb-3">
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${style.text}`}>{TIER_LABEL[tier]}-tier</span>
                    <span className="text-[9px] font-mono text-gray-500">{effectiveRate(source)}% · {list.length}</span>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {list.map(name => (
                      <BossRollCard
                        key={name}
                        name={name}
                        displayRate={effectiveRate(source)}
                        bonus={regionBonus}
                        style={style}
                        onClick={(e) => handleRoll(source, DROP_RATES[source], e)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {BOSSES_LIST.filter(b => b.toLowerCase().includes(bossQuery.trim().toLowerCase())).length === 0 && (
              <div className="text-center text-gray-600 text-xs py-6">No bosses match “{bossQuery}”.</div>
            )}
          </div>
        )}
        {subTab === 'ACTIVITIES' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {ACTIVITY_ROLLS.map((a, i) => (
              <div
                key={a.name}
                className={animationsEnabled ? 'animate-fade-in-up' : ''}
                style={animationsEnabled ? { animationDelay: `${i * 35}ms` } : undefined}
              >
                <SlayerMasterCard
                  name={a.name}
                  subText={a.subText}
                  displayRate={effectiveRate(a.source)}
                  bonus={regionBonus}
                  image={a.image}
                  style={a.style}
                  onClick={(e) => handleRoll(a.source, DROP_RATES[a.source], e)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Other key sources — compact, always-visible navigational hints */}
      <div className="shrink-0">
        <div className="text-[9px] font-bold text-[#666] uppercase tracking-widest mb-1.5">Other Key Sources</div>
        <div className="flex gap-2 items-stretch">
          <InfoChip
            icon={<img src={OSRS_ICONS.STATS} alt="" className="w-3.5 h-3.5" />}
            label="Skill Rolling"
            accent="text-blue-500"
            desc={<>Click unlocked skills in the <span className="text-blue-200">Dashboard</span> to roll.</>}
            rate={`Chance = Level / 5 (Max ${LEVEL_ROLL_MAX}%)`}
            badge="bg-blue-900/20 border-blue-900/30 text-blue-400"
          />
          <InfoChip
            icon={<ScrollText className="w-3.5 h-3.5 text-cyan-600" />}
            label="Journal Activities"
            accent="text-cyan-500"
            desc={<>Complete Quests, Diaries & CAs in the <span className="text-cyan-200">Journal Tab</span>.</>}
            rate={`Variable (${JOURNAL_MIN}% - ${JOURNAL_MAX}%)`}
            badge="bg-cyan-900/20 border-cyan-900/30 text-cyan-400"
          />
          <InfoChip
            icon={<BookOpen className="w-3.5 h-3.5 text-amber-600" />}
            label="Collection Log"
            accent="text-amber-500"
            desc={<>Log new unique items in the <span className="text-amber-200">Collection Log Tab</span> to roll.</>}
            rate={`${DROP_RATES[DropSource.COLLECTION_LOG]}% Drop Chance`}
            badge="bg-amber-900/20 border-amber-900/30 text-amber-400"
          />
        </div>
      </div>

    </div>
  );
};
