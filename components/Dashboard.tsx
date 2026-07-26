import { lazyWithRetry } from '../utils/lazyRetry';
import React, { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { 
  EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, REGION_GROUPS, MISTHALIN_AREAS, 
  MOBILITY_LIST, ARCANA_LIST, MINIGAMES_LIST, BOSSES_LIST, POH_LIST, 
  MERCHANTS_LIST, STORAGE_LIST, GUILDS_LIST, SLAYER_UNLOCKS_LIST,
  FARMING_PATCH_LIST, FARMING_UNLOCK_DETAILS, EQUIPMENT_TIER_MAX,
  REGION_ICONS, SLOT_CONFIG, SPECIAL_ICONS, wikiUrlFor, UTILITY_ITEM_IDS,
  SKILL_UNLOCK_DATA
} from '../constants';
import { useGame } from '../context/GameContext';
import { useFeatureGates } from '../hooks/useFeatureGates';
import type { FeatureId } from '../utils/featureGates';
import {
  Sparkles, Search, User, Map, Swords, Package,
  ExternalLink, Unlock, Lock, Compass, ChevronDown, ChevronsUp, AlertCircle, BookOpen, ScrollText, Globe, List, Filter, Info, Share2, MapPin, Route, Trophy, Skull
} from 'lucide-react';
import { VoidReveal } from './VoidReveal';
import { TableType } from '../types';
import { wikiService } from '../services/WikiService';
import { NoteTrigger } from './NoteTrigger';
import { COMBAT_POWERS_LABEL } from '../utils/tableDisplay';
import { SkillRollOdds } from './SkillRollOdds';
// RegionMap is the single heaviest component in the app (map surface,
// authoring tool, chunk overlays + their data). It only renders on the World
// tab, so keep it out of the initial bundle.
const RegionMap = lazyWithRetry(() => import('./RegionMap').then(m => ({ default: m.RegionMap })));
import { JournalNextBest } from './JournalNextBest';
import { JournalProgressRings } from './JournalProgressRings';
import { EquipmentLab } from './EquipmentLab';
import { WikiIcon } from './WikiIcon';
import { SectionGuide } from './SectionGuide';
import { completionPercent as runCompletion } from '../utils/completion';
import { rivalCompletion, standing as rivalStanding } from '../utils/rival';
// Heavy tab/modal contents — code-split so their large data dependencies
// (questData, diaryTasks, caTasks, collectionLogData, requirements, etc.)
// stay out of the initial dashboard bundle.
const GoalTracker = lazyWithRetry(() => import('./GoalTracker').then(m => ({ default: m.GoalTracker })));
const QuestLog = lazyWithRetry(() => import('./QuestLog').then(m => ({ default: m.QuestLog })));
const DiaryLog = lazyWithRetry(() => import('./DiaryLog').then(m => ({ default: m.DiaryLog })));
const CALog = lazyWithRetry(() => import('./CALog').then(m => ({ default: m.CALog })));
const QuestDoabilityPanel = lazyWithRetry(() => import('./QuestDoabilityPanel').then(m => ({ default: m.QuestDoabilityPanel })));
const CollectionLog = lazyWithRetry(() => import('./CollectionLog').then(m => ({ default: m.CollectionLog })));
const SkillDetailModal = lazyWithRetry(() => import('./SkillDetailModal').then(m => ({ default: m.SkillDetailModal })));
import { PanelErrorBoundary } from './PanelErrorBoundary';
import { MerchantShopsPanel } from './MerchantShopsPanel';
import { SlayerReachabilityPanel } from './SlayerReachabilityPanel';
import { ShortcutsPanel } from './ShortcutsPanel';
import { ModalFallback } from './LoadingFallback';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useUnlockReveal } from '../hooks/useUnlockReveal';
import { UnlockReveal } from './UnlockReveal';
import { useAchievementReveal } from '../hooks/useAchievementReveal';
import { AchievementReveal } from './AchievementReveal';
import { getGameMode } from '../config/gameModes';
import { getActivityRegion } from '../data/activityRegions';
import { isAreaReachable, bankLocksActive } from '../utils/reachability';
import { BANKS, BANK_IDS, BANK_BY_ID } from '../data/banks';
import { getActivityReq, ActivityReq } from '../data/activityRequirements';
import { evaluateActivityReadiness, type ActivityReadiness } from '../utils/activityReadiness';
import { ActivityReadinessBadge } from './ActivityReadinessBadge';
import { RegionAdvisorPanel } from './RegionAdvisorPanel';
import { FrontierAdvisorPanel } from './FrontierAdvisorPanel';
import { SkillAdvisorPanel } from './SkillAdvisorPanel';

// Code-split: the run card pulls in html2canvas only when actually opened.
const ShareModal = lazyWithRetry(() => import('./ShareModal').then(m => ({ default: m.ShareModal })));
// Goal Planner modal — pulls in the full quest/diary datasets, so load on demand.
const GoalPlannerModal = lazyWithRetry(() => import('./GoalPlannerModal').then(m => ({ default: m.GoalPlannerModal })));
// Achievements modal — pulls in the quest/diary/CA datasets via the engine.
const AchievementsModal = lazyWithRetry(() => import('./AchievementsModal').then(m => ({ default: m.AchievementsModal })));
// Fate Forecast modal — projects keys/time to a chosen locked unlock.
const FateForecastModal = lazyWithRetry(() => import('./FateForecastModal').then(m => ({ default: m.FateForecastModal })));
// Rival Ghost modal — race a simulated nemesis or a friend's run.
const RivalModal = lazyWithRetry(() => import('./RivalModal').then(m => ({ default: m.RivalModal })));
// Boss Kill Planner — DPS/TTK/readiness vs your unlocked bosses.
const BossKillPlanner = lazyWithRetry(() => import('./BossKillPlanner').then(m => ({ default: m.BossKillPlanner })));
// Auto-Roll (prototype) — sync a run from a real account via the hiscores API.
const AutoRollPanel = lazyWithRetry(() => import('./AutoRollPanel').then(m => ({ default: m.AutoRollPanel })));

// --- Constants & Helpers ---

const TABS = [
  { id: 'CHARACTER', label: 'Character', icon: User, img: 'Worn_Equipment.png', color: 'text-blue-400', border: 'border-blue-500' },
  { id: 'AUTOROLL', label: 'Sync & Roll', icon: Share2, img: 'Mysterious_emblem.png', color: 'text-fuchsia-400', border: 'border-fuchsia-500' },
  { id: 'WORLD', label: 'World', icon: Globe, img: 'World_map_icon.png', color: 'text-emerald-400', border: 'border-emerald-500' },
  { id: 'ACTIVITIES', label: 'Activities & Utility', icon: Swords, img: 'Combat_icon.png', color: 'text-red-400', border: 'border-red-500' },
  { id: 'JOURNAL', label: 'Journal', icon: ScrollText, img: 'Quest_point_icon.png', color: 'text-cyan-400', border: 'border-cyan-500' },
  { id: 'COLLECTION', label: 'Collection Log', icon: BookOpen, img: 'Collection_log.png', color: 'text-amber-600', border: 'border-amber-600' },
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

const getSkillIcon = (skillName: string) => `https://oldschool.runescape.wiki/images/${skillName}_icon.png`;

// Header control: opens the Rival modal, and when a rival is set shows the live
// standing (▲ you ahead / ▼ behind) — the ambient "pulse" of the race.
const RivalHeaderButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { rival, unlocks } = useGame();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!rival || rival.mode === 'friend') return;
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [rival]);

  if (!rival) {
    return (
      <button onClick={onClick} title="Race a Rival Ghost" className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-fuchsia-500/30 bg-fuchsia-950/30 hover:bg-fuchsia-900/40 text-fuchsia-300 text-[11px] font-medium whitespace-nowrap transition-colors">
        <Swords size={12} /> Rival
      </button>
    );
  }
  const st = rivalStanding(runCompletion(unlocks), rivalCompletion(rival, now));
  const ahead = st.lead > 0, tie = st.lead === 0;
  return (
    <button
      onClick={onClick}
      title={`${rival.name}: ${st.lead > 0 ? `you +${st.lead}%` : st.lead < 0 ? `rival +${-st.lead}%` : 'tied'}`}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-bold whitespace-nowrap transition-colors ${tie ? 'border-white/15 bg-white/5 text-gray-300' : ahead ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300' : 'border-red-500/40 bg-red-950/30 text-red-300'}`}
    >
      <span>{rival.emoji}</span>
      <span>{tie ? 'TIE' : `${ahead ? '▲' : '▼'} ${Math.abs(st.lead)}%`}</span>
    </button>
  );
};

// --- Sub-Components ---

interface ProgressBarProps {
  current: number;
  total: number;
  colorClass: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total, colorClass }) => {
  const { animationsEnabled } = useGame();
  const percent = Math.round((current / total) * 100);
  return (
    <div className="w-full bg-black/50 rounded-full h-2 mt-1 border border-white/5 relative overflow-hidden group">
      <div className={`relative h-full rounded-full overflow-hidden transition-all duration-700 ease-out ${colorClass} ${animationsEnabled && percent > 0 ? 'progress-sheen' : ''}`} style={{ width: `${percent}%` }} />
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
  req?: ActivityReq;
  readiness?: ActivityReadiness;
  suspendModals?: boolean;
}

const UnlockCard: React.FC<UnlockCardProps> = ({
  item,
  isUnlocked,
  canUnlock,
  icon,
  onClick,
  subText,
  region,
  req,
  readiness,
  suspendModals = false,
}) => {
  // Image priority: a hand-picked sprite/icon → the item's real OSRS wiki image
  // (fetched + cached via WikiService) → the globe placeholder. Self-heals: if a
  // source 404s it advances to the next, so a stale curated filename still ends
  // up showing the correct artwork rather than a generic globe.
  const GLOBE = 'https://oldschool.runescape.wiki/images/Globe_icon.png';
  const curated = icon || SPECIAL_ICONS[item];
  const itemId = UTILITY_ITEM_IDS[item];
  const spriteUrl = itemId ? `https://chisel.weirdgloop.org/static/img/osrs-sprite/${itemId}.png` : null;
  const curatedUrl = curated ? `https://oldschool.runescape.wiki/images/${curated}` : null;
  const [wikiUrl, setWikiUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, true>>({});

  const spriteDead = !spriteUrl || failed[spriteUrl];
  const curatedDead = !curatedUrl || failed[curatedUrl];
  const needWiki = spriteDead && curatedDead;
  useEffect(() => {
    if (!needWiki) return;
    let mounted = true;
    wikiService.fetchImage(item).then((url) => { if (mounted) setWikiUrl(url); });
    return () => { mounted = false; };
  }, [item, needWiki]);

  const candidates = [spriteUrl, curatedUrl, wikiUrl, GLOBE].filter(Boolean) as string[];
  const imageUrl = candidates.find((c) => !failed[c]) ?? GLOBE;

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
            <NoteTrigger id={item} title={item} suspendModals={suspendModals} />
        </div>

        <div className={`w-10 h-10 rounded flex items-center justify-center shrink-0 ${isUnlocked ? 'bg-black/30' : 'bg-black/20'}`}>
             <img
                src={imageUrl}
                alt={item}
                className={`w-7 h-7 object-contain ${isUnlocked ? 'drop-shadow-md' : 'grayscale opacity-50'}`}
                onError={() => setFailed((f) => ({ ...f, [imageUrl]: true }))}
             />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center pr-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className={`text-xs font-bold leading-tight break-words ${isUnlocked ? 'text-gray-200' : canUnlock ? 'text-purple-300' : 'text-gray-500'}`}>
                    {item}
                </span>
                {(
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
            {req && (req.skills || req.quests) && (
                <div className="flex flex-wrap items-center gap-1 mt-1">
                    {req.skills && Object.entries(req.skills).map(([sk, lvl]) => (
                        <span key={sk} className="text-[9px] px-1 py-0.5 rounded bg-amber-900/20 border border-amber-500/20 text-amber-300/90 leading-none font-mono" title={`Requires ${lvl} ${sk}`}>{sk} {lvl}</span>
                    ))}
                    {req.quests && req.quests.map(q => (
                        <span key={q} className="text-[9px] px-1 py-0.5 rounded bg-violet-900/20 border border-violet-500/20 text-violet-300/90 leading-none flex items-center gap-0.5" title={`Quest: ${q}`}>
                            <ScrollText size={8} className="shrink-0" />{q}
                        </span>
                    ))}
                </div>
            )}
            {readiness && <ActivityReadinessBadge readiness={readiness} />}
            {req?.note && (
                <div className="text-[9px] text-gray-500 italic leading-tight mt-0.5">{req.note}</div>
            )}
            {(!req || (!req.skills && !req.quests && !req.note)) && (
                <div className="text-[9px] text-gray-600 italic leading-tight mt-0.5">No unlock requirement</div>
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

interface DashboardProps {
  suspendModals?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ suspendModals = false }) => {
  const { unlocks, levelUpSkill, specialKeys, unlockContent, animationsEnabled, advisorsEnabled, gameModeId, customMode } = useGame();
  const activeMode = getGameMode(gameModeId);
  const [activeTab, setActiveTab] = useState('CHARACTER');
  // Progressive disclosure: tabs reveal as the run earns them (Character is
  // always visible; a palette/advisor jump to a still-hidden tab shows it too,
  // since navigation is intent). See utils/featureGates.ts.
  const gates = useFeatureGates();
  const visibleTabs = TABS.filter(
    (t) => t.id === 'CHARACTER' || t.id === activeTab || gates.has(`dash:${t.id}` as FeatureId),
  );
  const [activityCategory, setActivityCategory] = useState('BOSSES');
  const [journalSubTab, setJournalSubTab] = useLocalStorage<'QUESTS' | 'DIARIES' | 'CA' | 'DOABLE'>('jrnl:subtab', 'QUESTS');
  const [worldView, setWorldView] = useState<'LIST' | 'MAP'>('MAP');
  const [showRunCard, setShowRunCard] = useState(false);
  const [showGoalPlanner, setShowGoalPlanner] = useState(false);
  const [goalTarget, setGoalTarget] = useState<{ kind: 'quest' | 'diary' | 'region'; id: string } | null>(null);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showForecast, setShowForecast] = useState(false);
  const [showRival, setShowRival] = useState(false);
  const [showBossPlanner, setShowBossPlanner] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyActionable, setShowOnlyActionable] = useState(false);
  const [levelingSkill, setLevelingSkill] = useState<string | null>(null);
  const [pendingSpecial, setPendingSpecial] = useState<{table: TableType, item: string, image?: string} | null>(null);
  const [confirmOmni, setConfirmOmni] = useState<{table: TableType, item: string} | null>(null);
  const [selectedSkillForDetails, setSelectedSkillForDetails] = useState<{name: string, tier: number} | null>(null);

  const [unlockReveal, dismissReveal] = useUnlockReveal(unlocks, gameModeId);
  const [achievementReveal, dismissAchievementReveal] = useAchievementReveal(unlocks);

  useEscapeKey(() => setShowRunCard(false), showRunCard && !suspendModals);
  useEscapeKey(() => setSelectedSkillForDetails(null), selectedSkillForDetails !== null && !suspendModals);

  // The Journal summary card lives in the persistent left sidebar (App.tsx), so
  // it can't set this component's tab state directly. It dispatches a
  // `navigate-journal` event instead; we open the Journal tab + matching sub-tab.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const tab = (e as CustomEvent<{ tab?: 'QUESTS' | 'DIARIES' | 'CA' | 'DOABLE' }>).detail?.tab;
      if (!tab) return;
      setActiveTab('JOURNAL');
      setJournalSubTab(tab);
    };
    window.addEventListener('navigate-journal', onNavigate);
    return () => window.removeEventListener('navigate-journal', onNavigate);
  }, [setJournalSubTab]);

  // Command-palette navigation: switch dashboard tabs and open the modals this
  // component owns (fired as `fate:nav` window events by the ⌘K palette).
  // An optional `query` seeds the shared search box — e.g. a Collection Log
  // suggestion jump ("tab:COLLECTION" + query: itemName) lands directly on
  // that item, filtered and highlighted via the existing search machinery.
  useEffect(() => {
    const onNav = (e: Event) => {
      const {
        target = '',
        query,
        activityCategory: requestedActivityCategory,
      } = (e as CustomEvent<{
        target?: string;
        query?: string;
        activityCategory?: string;
      }>).detail ?? {};
      if (target.startsWith('tab:')) {
        // "tab:JOURNAL/QUESTS" also selects a Journal sub-tab — without this a
        // quest jump would land on whichever sub-tab the player last had open.
        const [tab, subTab] = target.slice(4).split('/');
        setActiveTab(tab);
        if (requestedActivityCategory && tab === 'ACTIVITIES') {
          setActivityCategory(requestedActivityCategory);
        }
        if (tab === 'WORLD') setWorldView('LIST');
        if (subTab && tab === 'JOURNAL') setJournalSubTab(subTab as 'QUESTS' | 'DIARIES' | 'CA' | 'DOABLE');
        if (query) setSearchQuery(query);
        return;
      }
      const opens: Record<string, (v: boolean) => void> = {
        'open:goal': setShowGoalPlanner,
        'open:achievements': setShowAchievements,
        'open:forecast': setShowForecast,
        'open:rival': setShowRival,
        'open:killplanner': setShowBossPlanner,
        'open:share': setShowRunCard,
      };
      opens[target]?.(true);
    };
    window.addEventListener('fate:nav', onNav);
    return () => window.removeEventListener('fate:nav', onNav);
  }, []);

  // Open the goal planner pre-targeting a quest/diary (journal "Plan route").
  useEffect(() => {
    const onPlanGoal = (e: Event) => {
      const d = (e as CustomEvent<{ kind?: 'quest' | 'diary' | 'region'; id?: string }>).detail;
      if (d?.kind && d.id) { setGoalTarget({ kind: d.kind, id: d.id }); setShowGoalPlanner(true); }
    };
    window.addEventListener('fate:plan-goal', onPlanGoal);
    return () => window.removeEventListener('fate:plan-goal', onPlanGoal);
  }, []);

  // --- Calculations ---
  const totalSkillTiers = useMemo(() => (Object.values(unlocks.skills) as number[]).reduce((a, b) => a + b, 0), [unlocks.skills]);
  const totalEquipTiers = useMemo(() => (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0), [unlocks.equipment]);

  // Shared metric (utils/completion) so the header %, achievements, and the
  // Rival Ghost all measure progress identically.
  const completionPercent = useMemo(() => runCompletion(unlocks), [unlocks]);

  // --- Handlers ---
  const handleLevelUp = (skill: string) => {
    if (animationsEnabled) {
        setLevelingSkill(skill);
        setTimeout(() => setLevelingSkill(null), 500);
    }
    levelUpSkill(skill);
  };

  const handleSpecialUnlock = (table: TableType, name: string) => {
      // Chunked mode has no named-region unlocks (chunks are the only territory
      // currency) — belt-and-braces guard in case a caller misses the UI gate.
      if (table === TableType.REGIONS && gameModeId === 'chunked') return;
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
        {/* Equipment Lab — interactive paper-doll (click a slot for its tier
            ladder + upgrade), a target-loadout planner, and a DPS calculator. */}
        <EquipmentLab onUpgrade={(slot) => handleSpecialUnlock(TableType.EQUIPMENT, slot)} suspendModals={suspendModals} />

        {/* Skills Section */}
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-[#151515] p-2 rounded border border-white/5">
                <h3 className="text-blue-400 font-bold text-sm flex items-center gap-1.5">Skills <SectionGuide id="SKILLS" suspendModals={suspendModals} /></h3>
                <span className="text-xs text-blue-400/60 font-mono">{totalSkillTiers}/{SKILLS_LIST.length * 10} Tiers</span>
            </div>

            {/* Skill Advisor — ranks which skill to train next (and to what
                level) by how much quest + diary content the threshold unlocks.
                Clicking a row flashes the matching skill card below. */}
            {advisorsEnabled && <SkillAdvisorPanel />}

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
                    const oddsDescriptionId = `skill-roll-odds-${skill.toLowerCase().replace(/\s+/g, '-')}`;
                    const tierColorText = isUnlocked ? 'text-gray-200' : 'text-gray-500';

                    if (searchQuery && !skill.toLowerCase().includes(searchQuery.toLowerCase())) return null;

                    return (
                        <div
                           key={skill}
                           data-skill-card={skill}
                           onClick={isMainActionable ? handleMainClick : undefined}
                           className={`
                                flex flex-col p-2 rounded bg-[#1f1f1f] border border-white/5 text-left transition-all duration-150 relative overflow-hidden group min-h-[68px]
                                ${canLevel ? 'hover:bg-[#2a2a2a] cursor-pointer ring-1 ring-green-500/20 hover:ring-green-500/40' : ''}
                                ${canUnlockStart ? 'ring-1 ring-purple-400/40 hover:ring-purple-400/70 hover:bg-purple-900/10 cursor-pointer' : ''}
                                ${levelingSkill === skill ? 'animate-pulse bg-green-900/40' : ''}
                                ${!isMainActionable ? 'opacity-90' : ''}
                           `}
                           role="button"
                           tabIndex={isMainActionable ? 0 : -1}
                           aria-describedby={canLevel ? oddsDescriptionId : undefined}
                        >
                            {/* Note Trigger */}
                            <div className="absolute top-1 right-1 z-30">
                                <NoteTrigger id={skill} title={skill} suspendModals={suspendModals} />
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
                                    <SkillRollOdds currentLevel={level} isUnlocked={isUnlocked} descriptionId={oddsDescriptionId} />
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

  // `nameMap` lets a category key on a stable id (e.g. banks keyed by chunk id)
  // while displaying a friendly name — the card, search, region/req lookups and
  // the omni-unlock all use the id, only the label uses the name.
  const renderGridSection = (items: string[], unlocked: string[], type: TableType, iconMap?: Record<string, string>, detailsMap?: Record<string, string>, nameMap?: Record<string, string>) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map(item => {
            const label = nameMap?.[item] ?? item;
            if (searchQuery && !label.toLowerCase().includes(searchQuery.toLowerCase())) return null;
            const isUnlocked = unlocked.includes(item);
            const canUnlock = !isUnlocked && specialKeys > 0;
            const sub = detailsMap ? detailsMap[item] : undefined;
            const req = getActivityReq(label);
            const readiness = evaluateActivityReadiness(
              isUnlocked,
              req,
              unlocks,
              gameModeId,
            );

            // Filter logic: Show if unlocked OR can unlock (Omni)
            if (showOnlyActionable && !isUnlocked && !canUnlock) return null;

            return (
                <UnlockCard
                    key={item}
                    item={label}
                    isUnlocked={isUnlocked}
                    canUnlock={canUnlock}
                    icon={iconMap ? iconMap[item] : undefined}
                    suspendModals={suspendModals}
                    onClick={() => handleSpecialUnlock(type, item)}
                    subText={sub}
                    region={getActivityRegion(label)}
                    req={req}
                    readiness={readiness}
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
                    <Suspense fallback={<ModalFallback />}>
                      <RegionMap />
                    </Suspense>
                  </PanelErrorBoundary>
              </div>
          ) : (
              <div className="space-y-6 h-full overflow-y-auto pr-2 custom-scrollbar pb-10">
                  {/* Region Advisor — shows which locked regions would unlock the most
                      quests + diary tiers, helping ironmen pick the next unlock target.
                      Chunked mode ranks frontier chunks instead — same idea, chunk-sized. */}
                  {advisorsEnabled && (gameModeId === 'chunked' ? <FrontierAdvisorPanel /> : <RegionAdvisorPanel />)}

                  {/* Misthalin Special Card */}
                  <div className="bg-[#1a1a1a] rounded border border-emerald-500/30 p-3 relative overflow-hidden group">
                      <div className="absolute inset-0 bg-emerald-900/5 pointer-events-none"></div>
                      <div className="absolute top-1 right-1 z-20">
                            <NoteTrigger id="Misthalin" title="Misthalin" suspendModals={suspendModals} />
                      </div>
                      {(() => {
                        const freeCount = MISTHALIN_AREAS.filter(a => isAreaReachable(a, unlocks, gameModeId)).length;
                        const allFree = freeCount === MISTHALIN_AREAS.length;
                        return (
                          <>
                            <div className="flex items-center gap-2 mb-2 relative z-10">
                                <Compass className="w-5 h-5 text-emerald-400" />
                                <span className="font-bold text-sm text-emerald-200">Misthalin (Starter Area)</span>
                                <span className={`ml-auto text-xs font-mono flex items-center gap-1 ${allFree ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    <Unlock size={10} /> {allFree ? 'Unlocked' : `${freeCount}/${MISTHALIN_AREAS.length}`}
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5 relative z-10 pr-6">
                                {MISTHALIN_AREAS.map(area => {
                                    const free = isAreaReachable(area, unlocks, gameModeId);
                                    // Chunked mode: named areas can't be bought — chunks only.
                                    const canUnlock = !free && gameModeId !== 'chunked' && specialKeys > 0;
                                    if (free) return (
                                        <a key={area} href={getWikiUrl(area)} target="_blank" rel="noopener noreferrer"
                                            className="px-2 py-1 bg-emerald-900/20 text-emerald-200 border border-emerald-500/20 rounded text-xs hover:bg-emerald-900/40 hover:text-white transition-colors flex items-center gap-1">
                                            {area} <ExternalLink size={8} className="opacity-50" />
                                        </a>
                                    );
                                    return (
                                        <button key={area} onClick={() => canUnlock && handleSpecialUnlock(TableType.REGIONS, area)} disabled={!canUnlock}
                                            className={`px-2 py-1 rounded text-xs border flex items-center gap-1 ${canUnlock ? 'bg-purple-900/10 text-purple-300 border-purple-500/30 hover:bg-purple-900/20 cursor-pointer' : 'bg-[#222] text-gray-600 border-transparent cursor-default'}`}>
                                            {area} <Lock size={8} />
                                        </button>
                                    );
                                })}
                            </div>
                          </>
                        );
                      })()}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(REGION_GROUPS).map(([group, areas]) => {
                          // Chunked mode: "unlocked" means you hold a chunk foothold in the
                          // area (same rule as the map); named areas can't be bought with
                          // keys there — chunks are the only unlock currency.
                          const unlockedCount = areas.filter(a => isAreaReachable(a, unlocks, gameModeId)).length;

                          // Search filter support for grouped regions
                          const matchesGroup = group.toLowerCase().includes(searchQuery.toLowerCase());
                          const matchesArea = areas.some(a => a.toLowerCase().includes(searchQuery.toLowerCase()));
                          if (searchQuery && !matchesGroup && !matchesArea) return null;

                          // Actionable filter: Hide group if all regions locked and no keys
                          // But regions are grouped. Individual sub-regions are unlockable.
                          const canUnlockAny = gameModeId !== 'chunked' && specialKeys > 0;
                          const hasAnyUnlocked = unlockedCount > 0;
                          
                          if (showOnlyActionable && !hasAnyUnlocked && !canUnlockAny) return null;

                          return (
                              <div key={group} data-region-card={group} className="bg-[#1a1a1a] rounded border border-white/5 p-3 h-full relative transition-shadow duration-300">
                                  <div className="absolute top-1 right-1 z-20">
                                        <NoteTrigger id={group} title={group} suspendModals={suspendModals} />
                                  </div>
                                  <div className="flex items-center gap-2 mb-2 pr-6">
                                      <img src={`https://oldschool.runescape.wiki/images/${REGION_ICONS[group] || 'Globe_icon.png'}`} className="w-5 h-5 object-contain" />
                                      <span className="font-bold text-sm text-gray-200">{group}</span>
                                      <span className="ml-auto text-xs text-gray-500 font-mono">{unlockedCount}/{areas.length}</span>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5">
                                      {areas.map(area => {
                                          const isUnlocked = isAreaReachable(area, unlocks, gameModeId);
                                          const canUnlock = !isUnlocked && gameModeId !== 'chunked' && specialKeys > 0;
                                          
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
        /** id → display name, for categories keyed by id (Banks). */
        nameMap?: Record<string, string>;
      };
      const categories: ActivityCategory[] = [
        { id: 'BOSSES',    label: 'Bosses & Raids',     color: 'text-red-400',    bar: 'bg-red-500',    list: BOSSES_LIST,        unlocked: unlocks.bosses,    type: TableType.BOSSES },
        { id: 'MINIGAMES', label: 'Minigames',          color: 'text-cyan-400',   bar: 'bg-cyan-500',   list: MINIGAMES_LIST,     unlocked: unlocks.minigames, type: TableType.MINIGAMES },
        { id: 'FARMING',   label: 'Farming Patches',    color: 'text-green-400',  bar: 'bg-green-500',  list: FARMING_PATCH_LIST, unlocked: unlocks.farming,   type: TableType.FARMING_LAYERS, details: FARMING_UNLOCK_DETAILS },
        { id: 'MOBILITY',  label: 'Mobility',           color: 'text-amber-400',  bar: 'bg-amber-500',  list: MOBILITY_LIST,      unlocked: unlocks.mobility,  type: TableType.MOBILITY },
        { id: 'GUILDS',    label: 'Guilds',             color: 'text-teal-400',   bar: 'bg-teal-500',   list: GUILDS_LIST,        unlocked: unlocks.guilds,    type: TableType.GUILDS },
        { id: 'ARCANA',    label: COMBAT_POWERS_LABEL,  color: 'text-violet-400', bar: 'bg-violet-500', list: ARCANA_LIST,        unlocked: unlocks.arcana,    type: TableType.ARCANA },
        { id: 'POH',       label: 'Player Owned House', color: 'text-orange-400', bar: 'bg-orange-500', list: POH_LIST,           unlocked: unlocks.housing,   type: TableType.POH },
        { id: 'STORAGE',   label: 'Storage',            color: 'text-amber-600',  bar: 'bg-amber-600',  list: STORAGE_LIST,       unlocked: unlocks.storage,   type: TableType.STORAGE },
        { id: 'MERCHANTS', label: 'Merchants',          color: 'text-yellow-400', bar: 'bg-yellow-500', list: MERCHANTS_LIST,     unlocked: unlocks.merchants, type: TableType.MERCHANTS },
        { id: 'SLAYER',    label: 'Slayer Unlocks',     color: 'text-rose-400',   bar: 'bg-rose-500',   list: SLAYER_UNLOCKS_LIST, unlocked: unlocks.slayerUnlocks,   type: TableType.SLAYER_UNLOCKS },
        // Banks are keyed by chunk id but shown by place name; only present when
        // the run locks banks (see bankLocksActive).
        ...(bankLocksActive(gameModeId, customMode) ? [{ id: 'BANKS', label: 'Banks', color: 'text-amber-300', bar: 'bg-amber-400', list: BANK_IDS, unlocked: (unlocks.banks ?? []), type: TableType.BANKS, nameMap: Object.fromEntries(BANKS.map(b => [b.id, b.name])) as Record<string, string> }] : []),
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
                {renderGridSection(c.list, c.unlocked, c.type, SPECIAL_ICONS, c.details, c.nameMap)}
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
            {/* Slayer only: which assignable monsters you can actually reach now. */}
            {selected.id === 'SLAYER' && <SlayerReachabilityPanel />}
            {/* Mobility only: agility shortcuts with level + real chunk location. */}
            {selected.id === 'MOBILITY' && <ShortcutsPanel />}
            {renderGridSection(selected.list, selected.unlocked, selected.type, SPECIAL_ICONS, selected.details, selected.nameMap)}
            {/* Merchants only: the real shops behind each category, from the
                chunk dataset, with per-location lock state. */}
            {selected.id === 'MERCHANTS' && <MerchantShopsPanel />}
          </div>
        </div>
      );
  };

  const renderJournalTab = () => (
      <div className="h-full flex flex-col">
          <JournalProgressRings />
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
              <button
                  onClick={() => setJournalSubTab('DOABLE')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${journalSubTab === 'DOABLE' ? 'bg-[#222] text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                  Doable
              </button>
          </div>
          {advisorsEnabled && <JournalNextBest onPick={setJournalSubTab} />}
          <div className="flex-1 overflow-hidden p-2">
              <Suspense fallback={<ModalFallback />}>
                  {journalSubTab === 'QUESTS' && <QuestLog searchTerm={searchQuery} suspendModals={suspendModals} />}
                  {journalSubTab === 'DIARIES' && <DiaryLog searchTerm={searchQuery} suspendModals={suspendModals} />}
                  {journalSubTab === 'CA' && <CALog searchTerm={searchQuery} />}
                  {journalSubTab === 'DOABLE' && <QuestDoabilityPanel searchTerm={searchQuery} />}
              </Suspense>
          </div>
      </div>
  );

  return (
    <>
    <div className="bg-osrs-panel border border-osrs-border rounded-lg shadow-lg flex flex-col h-full overflow-hidden relative">
      {!suspendModals && pendingSpecial && (
          <VoidReveal itemName={pendingSpecial.item} itemType={pendingSpecial.table} itemImage={pendingSpecial.image} onComplete={finalizeSpecial} animationsEnabled={animationsEnabled} />
      )}

      {!suspendModals && selectedSkillForDetails && (
          <Suspense fallback={<ModalFallback />}>
              <SkillDetailModal
                  skill={selectedSkillForDetails.name}
                  currentTier={selectedSkillForDetails.tier}
                  onClose={() => setSelectedSkillForDetails(null)}
              />
          </Suspense>
      )}

      {/* Confirmation Modal */}
      {!suspendModals && confirmOmni && (
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
         <div className="flex flex-wrap justify-between items-center gap-y-2 mb-3">
             <h2 className="text-lg font-bold text-osrs-gold flex flex-wrap items-center gap-2 min-w-0">
                 <span className="whitespace-nowrap">Progression Dashboard</span>
                 <span
                   className="text-[10px] font-normal text-amber-200 bg-amber-900/40 px-2 py-0.5 rounded border border-amber-500/30 whitespace-nowrap shrink-0"
                   title={activeMode.description}
                 >
                    {activeMode.name} Mode
                 </span>
                 {specialKeys > 0 && (
                    <span className={`text-[10px] font-normal text-purple-200 bg-purple-900/50 px-2 py-0.5 rounded border border-purple-500/30 flex items-center gap-1 whitespace-nowrap shrink-0 ${animationsEnabled ? 'animate-pulse' : ''}`}>
                        <Sparkles size={10} /> Omni-Key Active
                    </span>
                 )}
             </h2>
             <div className="flex flex-wrap items-center justify-end gap-3">
               <button
                 onClick={() => setShowGoalPlanner(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-[11px] font-medium whitespace-nowrap transition-colors"
                 title="Plan the route to any quest, diary, or region"
               >
                 <Route size={12} />
                 Goal Planner
               </button>
               <button
                 onClick={() => setShowAchievements(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-[11px] font-medium whitespace-nowrap transition-colors"
                 title="View achievements & milestones"
               >
                 <Trophy size={12} />
                 Achievements
               </button>
               <button
                 onClick={() => setShowForecast(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-fuchsia-500/30 bg-fuchsia-950/30 hover:bg-fuchsia-900/40 text-fuchsia-300 text-[11px] font-medium whitespace-nowrap transition-colors"
                 title="Forecast how long Fate will take to unlock something"
               >
                 <Sparkles size={12} />
                 Forecast
               </button>
               <button
                 onClick={() => window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: 'open:fatethread' } }))}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-violet-500/30 bg-violet-950/30 hover:bg-violet-900/40 text-violet-300 text-[11px] font-medium whitespace-nowrap transition-colors"
                 title="View your run as a living tapestry of fate"
               >
                 <Route size={12} />
                 Fate Thread
               </button>
               <RivalHeaderButton onClick={() => setShowRival(true)} />
               <button
                 onClick={() => setShowBossPlanner(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-red-500/30 bg-red-950/30 hover:bg-red-900/40 text-red-300 text-[11px] font-medium whitespace-nowrap transition-colors"
                 title="Plan boss kills: DPS, time-to-kill and readiness"
               >
                 <Skull size={12} />
                 Kill Planner
               </button>
               <button
                 onClick={() => setShowRunCard(true)}
                 className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-amber-500/30 bg-amber-950/30 hover:bg-amber-900/40 text-amber-300 text-[11px] font-medium whitespace-nowrap transition-colors"
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
                       className="transition-all duration-700 ease-out [filter:drop-shadow(0_0_3px_rgba(168,85,247,0.55))]"
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
          <div data-tour="dashtabs" className="flex flex-1 overflow-x-auto no-scrollbar">
              {visibleTabs.map(tab => {
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
                          <WikiIcon file={tab.img} alt={tab.label} Fallback={tab.icon} size={15} className={isActive ? '' : 'opacity-70 grayscale'} /> {tab.label}
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
              <SectionGuide id={activeTab} className="p-1" suspendModals={suspendModals} />
          </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-4 bg-[#111]">
          <Suspense fallback={<ModalFallback />}>
              <GoalTracker />
          </Suspense>
          {/* Keyed by tab so the content gently slides in when you switch. */}
          <div key={activeTab} className={`h-full ${animationsEnabled ? 'animate-fade-in-up' : ''}`}>
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
            {activeTab === 'AUTOROLL' && (
                <Suspense fallback={<ModalFallback />}>
                    <AutoRollPanel />
                </Suspense>
            )}
          </div>
      </div>
    </div>
    {!suspendModals && showRunCard && (
      <Suspense fallback={<ModalFallback label="Building share card…" />}>
        <ShareModal onClose={() => setShowRunCard(false)} />
      </Suspense>
    )}

    {!suspendModals && showGoalPlanner && (
      <Suspense fallback={<ModalFallback label="Loading planner…" />}>
        <GoalPlannerModal onClose={() => { setShowGoalPlanner(false); setGoalTarget(null); }} initialTarget={goalTarget} />
      </Suspense>
    )}

    {!suspendModals && showAchievements && (
      <Suspense fallback={<ModalFallback label="Loading achievements…" />}>
        <AchievementsModal onClose={() => setShowAchievements(false)} />
      </Suspense>
    )}

    {!suspendModals && showForecast && (
      <Suspense fallback={<ModalFallback label="Consulting Fate…" />}>
        <FateForecastModal onClose={() => setShowForecast(false)} />
      </Suspense>
    )}

    {!suspendModals && showRival && (
      <Suspense fallback={<ModalFallback label="Summoning your rival…" />}>
        <RivalModal onClose={() => setShowRival(false)} />
      </Suspense>
    )}

    {!suspendModals && showBossPlanner && (
      <Suspense fallback={<ModalFallback label="Loading kill planner…" />}>
        <BossKillPlanner onClose={() => setShowBossPlanner(false)} />
      </Suspense>
    )}

    {/* Celebratory reveal when a milestone is newly earned. */}
    {!suspendModals && achievementReveal && (
      <AchievementReveal
        data={achievementReveal}
        onDismiss={dismissAchievementReveal}
        onView={() => setShowAchievements(true)}
      />
    )}

    {/* Unlock reveal — slides in from the right when a quest or region
        unlocks and shows what new content just became available. */}
    {!suspendModals && unlockReveal && (
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
