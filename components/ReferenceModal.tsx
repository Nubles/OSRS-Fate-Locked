
import React, { useState, useRef } from 'react';
import { X, ArrowUp, Lock, HelpCircle, SlidersHorizontal } from 'lucide-react';
import { Shield, Package, BookOpen, Dices, Sparkles, Map, Zap, Scroll, Skull, Activity, Key, Dna, Coins, GraduationCap, Compass } from './OsrsIcon';
import { WikiIcon } from './WikiIcon';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useGame } from '../context/GameContext';
import { GAME_MODES, getGameMode, resolveModeRules } from '../config/gameModes';
import { andList, CHUNKED_MILESTONE_INTERVAL, CLUE_ONBOARDING_MINIMUMS, EARN_METHODS, getRitual, omniFloor, KEY_TYPES, LEVEL_CHAOS_CHANCE, RITUALS, ritualFateCost, SKILL_CHAOS_MILESTONES, SPEND_TABLES, STARTING_KEYS, UNLOCK_KEY_COST, VANILLA_BOSS_KEY_RATES, VANILLA_BOSS_STANDARD_KEY_TOTAL, ritualEffect, type Ritual } from '../config/economy';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';
import { DropSource, TableType } from '../types';
import { DROP_RATES } from '../config/rules';
import { ALL_CHUNK_KEYS } from '../utils/chunkAdjacency';
import { unlockableAreas } from '../utils/freeAreas';

interface ReferenceModalProps {
  onClose: () => void;
  initialTab?: TabId;
}

type TabId = 'core' | 'economy' | 'modes' | 'drops' | 'altar' | 'unlocks' | 'equipment' | 'storage';

// The values every mode a player can pick shares (gameModes.test.ts checks they do).
const SHARED_MODE_RULES = GAME_MODES[0].rules;

// Colour a roll rate along the OSRS difficulty gradient (rare → guaranteed).
const rateColor = (rate: number): string =>
  rate >= 100 ? 'text-yellow-400'
  : rate >= 75 ? 'text-purple-400'
  : rate >= 50 ? 'text-red-400'
  : rate >= 25 ? 'text-blue-400'
  : rate >= 11 ? 'text-green-400'
  : 'text-[#a8a29a]';

// Visual identity for each Void Altar ritual (data comes from economy.RITUALS).
const ALTAR_UI: Record<string, { icon: any; color: string; border: string }> = {
  LUCK:      { icon: Dices,    color: 'text-blue-400',   border: 'border-blue-500/30' },
  GREED:     { icon: Coins,    color: 'text-yellow-400', border: 'border-yellow-500/30' },
  CHAOS:     { icon: Dna,      color: 'text-red-400',    border: 'border-red-500/30' },
  GAMBIT:       { icon: Skull,    color: 'text-fuchsia-400', border: 'border-fuchsia-500/30' },
  CARTOGRAPHER: { icon: Map,      color: 'text-emerald-400', border: 'border-emerald-500/30' },
  TRANSMUTE: { icon: Sparkles, color: 'text-purple-400', border: 'border-purple-500/30' },
};

export const formatVanillaBossSchedule = (bossClass: string, rates: readonly number[]): string => {
  const label = `${bossClass.slice(0, 1).toUpperCase()}${bossClass.slice(1)}`;
  return `${label}: ${rates.map(rate => `${rate}%`).join(' → ')} (${rates.length} ${rates.length === 1 ? 'key' : 'keys'})`;
};

export const describeVanillaRandomAccessPolicy = (
  policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): string => {
  const costs = policy.randomCosts.includes('chaosKey') ? 'Standard and Chaos' : 'Standard';
  const tableScope = policy.filteredTables.join(' and ');
  const hasLocationFilter = policy.requiresTrackedHardGeography && tableScope.length > 0;
  const randomAccess = hasLocationFilter
    ? `${costs} random unlocks respect hard location access for ${tableScope}.`
    : '';
  const emptyPool = policy.emptyEligiblePool.noUnlock
    ? [
        'An empty eligible pool means no unlock occurs',
        policy.emptyEligiblePool.retainsKey ? 'no key is spent' : '',
        policy.emptyEligiblePool.preservesRngProgression ? 'no RNG progression is consumed' : '',
      ].filter(Boolean).join('; ') + '.'
    : '';
  const omni = policy.omniDirect.allowsLocationIneligible
    ? hasLocationFilter
      ? `Omni-Key direct unlocks bypass that filter${policy.omniDirect.warnsPlayer ? ' with a warning' : ''}.`
      : 'Omni-Key direct unlocks can be selected even without location access.'
    : hasLocationFilter
      ? 'Omni-Key direct unlocks respect that filter.'
      : 'Omni-Key direct unlocks remain subject to their ordinary availability rules.';

  return [randomAccess, emptyPool, omni].filter(Boolean).join(' ');
};

export const ReferenceModal: React.FC<ReferenceModalProps> = ({ onClose, initialTab = 'core' }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);

  // Live rules for the current run — the codex shows the player's actual
  // numbers, not generic defaults.
  const { gameModeId, customMode } = useGame();
  const activeMode = getGameMode(gameModeId);
  const rules = resolveModeRules(gameModeId, customMode);
  const ritualCost = (id: Ritual['id']) => ritualFateCost(id, rules.ritualCostMultiplier);
  const ritualText = (id: Ritual['id']) => ritualEffect(id, rules.ritualCostMultiplier);
  const vanillaPolicyLabel = gameModeId === 'vanilla'
    ? 'Vanilla-only rules'
    : 'Vanilla-only (not active for this run)';

  // Chunked mode unlocks individual map chunks, not named regions — swap the
  // "Areas" entry for the real table/count/blurb so the Codex matches what
  // Spend Keys actually shows (see components/GachaSection.tsx). Other modes
  // count the run's own Areas list, which includes any Misthalin areas the
  // mode leaves locked.
  const spendTables = gameModeId === 'chunked'
    ? SPEND_TABLES.map(t => t.type === TableType.REGIONS
        ? { ...t, type: TableType.CHUNKS, label: 'Chunks', count: ALL_CHUNK_KEYS.length - 1, blurb: 'Unlock a random frontier chunk: land next to your territory, plus coast reached by sea after Pandemonium and Sailing.' }
        : t)
    : SPEND_TABLES.map(t => t.type === TableType.REGIONS
        ? { ...t, count: unlockableAreas(gameModeId, customMode).length }
        : t);

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'core', label: 'Core Rules', icon: BookOpen },
    { id: 'economy', label: 'Key Economy', icon: Coins },
    { id: 'modes', label: 'Game Modes', icon: SlidersHorizontal },
    { id: 'drops', label: 'RNG & Drop Rates', icon: Dices },
    { id: 'altar', label: 'The Void Altar', icon: Zap },
    { id: 'unlocks', label: 'Unlock Systems', icon: Lock },
    { id: 'equipment', label: 'Equipment Tiers', icon: Shield },
    { id: 'storage', label: 'Storage', icon: Package },
  ];

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Game reference" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-osrs-border w-full max-w-5xl rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="bg-[#1a1a1a] p-4 border-b border-osrs-border flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
             <div className="bg-osrs-gold/10 p-2 rounded-lg border border-osrs-gold/20">
                <HelpCircle className="w-5 h-5 text-osrs-gold" />
             </div>
            <h2 className="text-xl font-bold text-gray-100 tracking-wide">Fate Locked Ironman: Codex</h2>
            <span
              className="text-[10px] font-bold uppercase tracking-wider text-amber-200 bg-amber-900/40 px-2 py-1 rounded border border-amber-500/30"
              title={activeMode.description}
            >
              {activeMode.name} Mode
            </span>
          </div>
          <button 
            onClick={onClose}
            aria-label="Close the Codex"
            className="p-2 hover:bg-white/10 rounded-full transition-colors group"
          >
            <X className="w-6 h-6 text-gray-400 group-hover:text-white" />
          </button>
        </div>

        {/* Main Content Layout */}
        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-64 bg-[#161616] border-r border-osrs-border flex flex-col overflow-y-auto custom-scrollbar shrink-0">
                <div className="p-3 space-y-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold transition-all duration-200
                                    ${isActive 
                                        ? 'bg-[#252525] text-osrs-gold border border-osrs-gold/20 shadow-md translate-x-1' 
                                        : 'text-gray-400 hover:bg-[#202020] hover:text-gray-200 border border-transparent'}
                                `}
                            >
                                <Icon size={18} className={isActive ? 'text-osrs-gold' : 'text-gray-500'} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
                
                {/* Flavor Text at bottom of sidebar */}
                <div className="mt-auto p-6 text-center opacity-30">
                    <img src="https://oldschool.runescape.wiki/images/Ironman_chat_badge.png" alt="Ironman" className="w-8 h-8 mx-auto mb-2 grayscale" />
                    <p className="text-[10px] font-mono text-gray-500">Fate is absolute.</p>
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a] relative">
                <div className="p-8 max-w-4xl mx-auto">
                    
                    {activeTab === 'core' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Core Rules</h1>
                                <p className="text-gray-400 text-lg">How rolls, Keys and unlocks work.</p>
                            </div>

                            {/* The Concept */}
                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                 <h3 className="text-osrs-gold font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Skull size={18} /> The Concept
                                </h3>
                                <p className="text-gray-300 leading-relaxed text-sm">
                                    A challenge for Old School RuneScape ironman accounts. You start with {STARTING_KEYS} Keys and
                                    almost everything else locked: you can't equip armour, train any skill but Hitpoints, leave
                                    your start area, or use transport, banks or shops. What you unlock, and when, is down to the
                                    rolls.
                                </p>
                            </div>

                            {/* The Core Loop */}
                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                <h3 className="text-green-400 font-bold uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Activity size={18} /> The Core Loop
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center font-bold border border-green-500/20">1</div>
                                        <div>
                                            <h4 className="font-bold text-gray-200">The Grind</h4>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Complete an in-game task (e.g., finish a Quest, complete a Diary step, or gain a Level).
                                            </p>
                                        </div>
                                    </div>
                                     <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-900/50 text-blue-400 flex items-center justify-center font-bold border border-blue-500/20">2</div>
                                        <div>
                                            <h4 className="font-bold text-gray-200">The Roll</h4>
                                            <p className="text-sm text-gray-400 mt-1">
                                                The app draws to 0.1% precision, from 0.1 to 100.0 (Vanilla boss and clue rolls use 0.01%).
                                                <br/>
                                                <span className="text-green-400">Success:</span> Roll at or under the threshold to get a Key.
                                                <br/>
                                                <span className="text-red-400">Fail:</span> Gain Fate Points.
                                            </p>
                                        </div>
                                    </div>
                                     <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-osrs-gold/20 text-osrs-gold flex items-center justify-center font-bold border border-osrs-gold/20">3</div>
                                        <div>
                                            <h4 className="font-bold text-gray-200">The Unlock</h4>
                                            <p className="text-sm text-gray-400 mt-1">
                                                 Spend Keys to randomly unlock content (Skills, Gear Slots, Regions).
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* The Progression */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#222] p-4 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Shield size={16} className="text-osrs-pity"/> Fate Points</h4>
                                    <p className="text-xs text-gray-400">
                                        Bad luck protection. Failed rolls award +1 to +3 Fate by difficulty.
                                        <br/><br/>
                                        {rules.pityEnabled ? (
                                          <span className="text-white font-bold">{rules.pityThreshold} Points = 1 Guaranteed (Pity) Key.</span>
                                        ) : (
                                          <span className="text-red-400 font-bold">Pity is DISABLED in {activeMode.name} mode — Fate Points only fuel the Void Altar.</span>
                                        )}
                                    </p>
                                </div>
                                 <div className="bg-[#222] p-4 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Sparkles size={16} className="text-purple-400"/> Omni-Keys</h4>
                                    <p className="text-xs text-gray-400">
                                        A successful roll has a <span className="text-white font-bold">{rules.omniChanceBase}% chance</span> in your mode to give a bonus Omni-Key as well as the Key.
                                        <br/><br/>
                                        Spend one to <span className="text-white font-bold">pick exactly what you unlock</span>, instead of a random entry.
                                        {gameModeId === 'chunked' && ' In Chunked, land only comes from Chunk unlocks and the Ritual of the Cartographer.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- KEY ECONOMY --- */}
                    {activeTab === 'economy' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">The Key Economy</h1>
                                <p className="text-gray-400 text-lg">Every action feeds one loop: earn Keys, spend Keys, unlock more ways to earn.</p>
                                <p className="text-xs text-amber-300 mt-2 font-bold">{vanillaPolicyLabel}</p>
                            </div>

                            <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-500/30 text-sm text-gray-300">
                                <b className="text-amber-300">{VANILLA_BOSS_STANDARD_KEY_TOTAL} finite boss safety-reserve Standard Keys.</b> Vanilla boss encounters pay from this capped reserve, so repeated farming cannot create unlimited Standard Keys.
                            </div>

                            {/* The loop */}
                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-wider">
                                    <span className="px-3 py-2 rounded-lg bg-green-900/30 text-green-300 border border-green-500/20">Do a task</span>
                                    <ArrowUp className="rotate-90 text-gray-600 shrink-0" size={14} />
                                    <span className="px-3 py-2 rounded-lg bg-blue-900/30 text-blue-300 border border-blue-500/20">Roll for a Key</span>
                                    <ArrowUp className="rotate-90 text-gray-600 shrink-0" size={14} />
                                    <span className="px-3 py-2 rounded-lg bg-osrs-gold/15 text-osrs-gold border border-osrs-gold/20">Spend on a table</span>
                                    <ArrowUp className="rotate-90 text-gray-600 shrink-0" size={14} />
                                    <span className="px-3 py-2 rounded-lg bg-purple-900/30 text-purple-300 border border-purple-500/20">Unlock content</span>
                                    <ArrowUp className="rotate-90 text-gray-600 shrink-0" size={14} />
                                    <span className="px-3 py-2 rounded-lg bg-emerald-900/30 text-emerald-300 border border-emerald-500/20">New tasks open</span>
                                </div>
                                <p className="text-center text-xs text-gray-500 mt-4">Each unlock opens more tasks to roll on: more skills, places and bosses mean more ways to earn the next Key.</p>
                            </div>

                            {/* The three keys */}
                            <div>
                                <h3 className="text-osrs-gold font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><Key size={18}/> The Three Keys</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {KEY_TYPES.map(k => (
                                        <div key={k.id} className="bg-[#222] rounded-xl border border-white/5 p-5 flex flex-col">
                                            <div className="flex items-center gap-2 mb-1">
                                                <img src={k.icon} alt="" className="w-6 h-6 object-contain" />
                                                <h4 className={`font-bold text-lg ${k.accent}`}>{k.name}</h4>
                                            </div>
                                            <p className="text-[11px] text-gray-500 italic mb-3">{k.tagline}</p>
                                            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">How you earn it</div>
                                            <ul className="space-y-1 mb-3">
                                                {k.earn.map((e, i) => (
                                                    <li key={i} className="text-xs text-gray-400 flex gap-1.5"><span className={`${k.accent} font-bold`}>+</span><span>{e}</span></li>
                                                ))}
                                            </ul>
                                            <div className="mt-auto pt-2 border-t border-white/5">
                                                <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1">What it spends on</div>
                                                <p className="text-xs text-gray-300">{k.spend}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Worked example */}
                            <div className="bg-gradient-to-br from-[#1d2230] to-[#222] p-6 rounded-xl border border-blue-500/20">
                                <h3 className="text-blue-300 font-bold uppercase tracking-widest mb-4 flex items-center gap-2"><Dices size={18}/> A single roll, start to finish</h3>
                                <ol className="space-y-3 text-sm text-gray-300">
                                    <li><b className="text-white">1.</b> You finish <b>Desert Treasure I</b> — a <b className="text-purple-400">Master</b> quest — and tick it off in the Journal.</li>
                                    <li><b className="text-white">2.</b> The app draws to <span className="font-mono">0.1%</span> precision against its <b className="text-purple-400">95.0%</b> threshold. You roll <span className="font-mono text-green-400">42.0</span> → a Key!</li>
                                    <li><b className="text-white">3.</b> Every success also has a chance at a bonus <b className="text-purple-400">Omni-Key</b>: <b className="text-purple-400">{rules.omniChanceBase}%</b> in {activeMode.name} mode, or {omniFloor(DropSource.QUEST_GRANDMASTER)}% for a Grandmaster quest. Either way, you keep the Key.</li>
                                    <li><b className="text-white">4.</b> Take the Key to <b className="text-osrs-gold">Spend Keys</b>, choose the <b>Skills</b> table, and unlock a random skill tier — say Slayer. Those new Slayer levels open fresh tasks to roll on.</li>
                                    <li className="text-gray-500 text-xs pt-1">Roll <span className="font-mono">95.1–100.0</span> instead and you'd get no Key — but you would gain +3 Fate{rules.pityEnabled ? <>, inching toward a guaranteed Key at <b>{rules.pityThreshold}</b></> : ''}.</li>
                                </ol>
                            </div>

                            {/* Fate + altar quick ref */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#222] p-5 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Shield size={16} className="text-osrs-pity"/> Fate Points</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Earned <b>+1 to +3 Fate per failed roll</b>, with awards based on difficulty.
                                        {rules.pityEnabled
                                            ? <> At <b className="text-white">{rules.pityThreshold}</b> they grant a guaranteed <b>Pity Key</b>. Pity conversions keep any Fate overflow.</>
                                            : <> Pity is <b className="text-red-400">off</b> in {activeMode.name} mode.</>}
                                        {' '}Any successful roll resets them to 0, so spend them at the Void Altar before that.
                                    </p>
                                </div>
                                <div className="bg-[#222] p-5 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Zap size={16} className="text-purple-400"/> Spend Fate at the Altar</h4>
                                    <ul className="space-y-1.5 text-xs text-gray-400">
                                        {RITUALS.map(r => (
                                            <li key={r.id} className="flex justify-between gap-2">
                                                <span>{r.name}{r.chunkedOnly ? ' (Chunked only)' : ''}</span>
                                                <span className="font-mono text-gray-300 shrink-0">{r.keyCost ? `${r.keyCost} Keys` : r.stakesAllFate ? `All Fate (min ${ritualCost(r.id)})` : `${ritualCost(r.id)} Fate`}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-[10px] text-gray-600 mt-2 italic">Full effects on the Void Altar tab.</p>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500">
                                Standard Keys cash in across <b className="text-gray-300">{spendTables.length} tables</b> — {spendTables.map(t => t.label).join(', ')} — at a flat <b className="text-osrs-gold">{UNLOCK_KEY_COST} Key</b> each. The Unlock Systems tab breaks down what every table does.
                            </p>

                            {/* Smart play */}
                            <div className="bg-gradient-to-br from-emerald-950/40 to-[#222] p-6 rounded-xl border border-emerald-500/20">
                                <h3 className="text-emerald-300 font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Compass size={18}/> Smart Play</h3>
                                <ul className="space-y-2 text-sm text-gray-300">
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Slayer never runs out.</b> Every task you finish rolls, and higher masters roll better (Konar {DROP_RATES[DropSource.SLAYER_KONAR]}%, Duradel {DROP_RATES[DropSource.SLAYER_DURADEL]}%, boss tasks {DROP_RATES[DropSource.SLAYER_BOSS]}%). Move up as soon as you can survive their tasks.</span></li>
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Save Omni-Keys for what you need most.</b> Pick a must-have, such as a boss, a gear slot or a skill, rather than something from a small table that a Key will soon give you anyway.</span></li>
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Spend Fate before your next success.</b> Failed rolls give Fate, but any successful roll resets it to 0, so spend it first: {ritualCost('LUCK')} on Clarity before a big roll, or {ritualCost('CHAOS')} on a Chaos Key.</span></li>
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Grandmaster quests are the best Journal roll:</b> a guaranteed Key and a {omniFloor(DropSource.QUEST_GRANDMASTER)}% Omni-Key chance. Only pet drops ({omniFloor(DropSource.PET)}%) have a better Omni-Key chance. Raids give {omniFloor(DropSource.RAID)}%, Elite diaries {omniFloor(DropSource.DIARY_ELITE)}% and high-tier bosses {omniFloor(DropSource.BOSS_HIGH)}%.</span></li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* --- GAME MODES --- */}
                    {activeTab === 'modes' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Game Modes</h1>
                                <p className="text-gray-400">Every run is played under one fixed mode.</p>
                            </div>

                            <div className="bg-[#222] p-6 rounded-xl border border-amber-500/20">
                                <h3 className="text-amber-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Lock size={16} /> Your Mode Is Fixed
                                </h3>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    Your mode is fixed as soon as you apply it. If you never choose one, the run is
                                    Vanilla, and that is fixed once anything appears in your History. To play a
                                    different mode, start a new profile.
                                </p>
                            </div>

                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                <h3 className="text-gray-200 font-bold uppercase tracking-widest mb-4">What Differs Between the Modes</h3>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li><b className="text-amber-300">Vanilla:</b> you unlock named areas, and all of Misthalin is free from the start. Each boss pays a few Keys and then stops, your first three clue Keys roll at no less than {andList(CLUE_ONBOARDING_MINIMUMS.map(rate => `${rate}%`))}, and Keys only unlock bosses and minigames you can reach.</li>
                                    <li><b className="text-emerald-300">Chunked:</b> you start in one chunk of Lumbridge and unlock one chunk at a time, next to land you hold. Every boss kill rolls, with no limit. While you hold only your start chunk, every {CHUNKED_MILESTONE_INTERVAL} total levels gives a guaranteed Key.</li>
                                    <li><b className="text-gray-200">Both:</b> a Pity Key at {SHARED_MODE_RULES.pityThreshold} Fate Points, a {SHARED_MODE_RULES.omniChanceBase}% base Omni-Key chance, the same ritual prices, and every bank locked until you unlock it.</li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {GAME_MODES.map(mode => {
                                    const isActive = mode.id === activeMode.id;
                                    return (
                                        <div key={mode.id} className={`bg-[#222] p-5 rounded-xl border ${isActive ? 'border-amber-500/60' : 'border-white/5'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-bold text-white text-lg">{mode.name}</h4>
                                                {isActive && <span className="text-[9px] uppercase tracking-wider bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded">Your run</span>}
                                            </div>
                                            <p className="text-xs text-amber-300/70 mb-2">{mode.tagline}</p>
                                            <p className="text-xs text-gray-400 leading-relaxed">{mode.description}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- DROPS & RNG --- */}
                    {activeTab === 'drops' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                             <div>
                                <h1 className="text-3xl font-black text-white mb-2">RNG & Drop Rates</h1>
                                <p className="text-gray-400">How to obtain the Keys of Fate.</p>
                                <p className="text-xs text-amber-300 mt-2 font-bold">{vanillaPolicyLabel}</p>
                             </div>

                            <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-500/30">
                                <h3 className="font-bold text-amber-300 mb-2">Vanilla boss reserve schedules</h3>
                                <ul className="text-sm text-gray-300 space-y-1">
                                    {Object.entries(VANILLA_BOSS_KEY_RATES).map(([bossClass, rates]) => <li key={bossClass}>{formatVanillaBossSchedule(bossClass, rates)}</li>)}
                                </ul>
                                <p className="text-xs text-gray-400 mt-3">All clue tiers share onboarding minimums of <b>{CLUE_ONBOARDING_MINIMUMS.map(rate => `${rate}%`).join(' → ')}</b> for the first three Standard Keys, then use their normal tier rate.</p>
                            </div>

                            <div className="bg-[#222] rounded-xl border border-white/5 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#111] text-gray-400 uppercase text-xs">
                                        <tr>
                                            <th className="p-4">Activity Source</th>
                                            <th className="p-4">Drop Rate</th>
                                            <th className="p-4">Fate on failure</th>
                                            <th className="p-4">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800 text-gray-300">
                                        {EARN_METHODS.map(method => (
                                            <tr key={method.category}>
                                                <td className="p-4 align-top">
                                                    <div className="flex items-center gap-2">
                                                        <img src={method.icon} alt="" className="w-5 h-5 object-contain shrink-0" />
                                                        <span className="font-bold text-white">{method.category}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top">
                                                    <div className="flex flex-col gap-1 text-xs">
                                                        {method.tiers.map(t => (
                                                            <span key={t.tier} className={rateColor(t.rate)}>
                                                                {t.tier}: <span className="font-mono">{t.rateLabel ?? `${t.rate}%`}</span>
                                                                {t.omni ? <span className="text-purple-400/70"> · Omni {t.omni}%</span> : null}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-4 align-top text-xs text-amber-300/80">
                                                    {method.dynamic ? (
                                                        <div className="space-y-1">
                                                            <span className="block">Levels 2-19: +1 Fate</span>
                                                            <span className="block">Levels 20-79: +2 Fate</span>
                                                            <span className="block">Levels 80-99: +3 Fate</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {method.tiers.map(t => <span key={t.tier}>{t.tier}: {t.rate === 100 ? 'Guaranteed' : `+${t.fateOnFailure} Fate`}</span>)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-4 align-top text-gray-500 text-xs">
                                                    {method.blurb}
                                                    {method.tiers.some(t => t.bonus) && (
                                                        <span className="block mt-1.5 text-amber-300/60">
                                                            {method.tiers.filter(t => t.bonus).map(t => t.bonus).join(' ')}
                                                        </span>
                                                    )}
                                                    <span className="block mt-1.5 text-gray-600 italic">{method.where}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-black/20 p-4 rounded-lg border border-purple-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="text-purple-400" size={20} />
                                        <h4 className="font-bold text-purple-400">Omni-Key Chance</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Any successful roll has a <b>{rules.omniChanceBase}% chance</b> in <b>{activeMode.name}</b> mode to give a bonus Omni-Key as well as the Key.
                                        <br/><br/>
                                        Some sources have a higher chance: pet drops <b>{omniFloor(DropSource.PET)}%</b>, Grandmaster quests <b>{omniFloor(DropSource.QUEST_GRANDMASTER)}%</b>, raids <b>{omniFloor(DropSource.RAID)}%</b>, Elite diaries <b>{omniFloor(DropSource.DIARY_ELITE)}%</b> and high-tier bosses <b>{omniFloor(DropSource.BOSS_HIGH)}%</b>.
                                        {rules.regionModifiers && <><br/><br/><span className="text-emerald-400">Your run's region bonuses add to this.</span></>}
                                    </p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-lg border border-red-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Dna className="text-red-400" size={20} />
                                        <h4 className="font-bold text-red-400">Chaos Keys</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Every skill gives a guaranteed Chaos Key at levels {andList(SKILL_CHAOS_MILESTONES)}. Each level-up also has a separate {LEVEL_CHAOS_CHANCE}% chance of one, milestones included.
                                        <br/><br/>
                                        The Ritual of Chaos also makes one for {ritualCost('CHAOS')} Fate Points.
                                    </p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-lg border border-amber-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="text-amber-400" size={20} />
                                        <h4 className="font-bold text-amber-400">Pity Timer</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {rules.pityEnabled ? (
                                          <>{rules.pityThreshold} Fate grants 1 Guaranteed Key; overflow carries forward.<br/><br/>Any successful roll resets your Fate. Combat Achievements: Easy / Medium: +1 Fate; Hard / Elite: +2 Fate; Master / GM: +3 Fate.</>
                                        ) : (
                                          <span className="text-red-400">Disabled in {activeMode.name} mode — there is no safety net. Failed rolls only build Fate for the Altar.</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- VOID ALTAR --- */}
                    {activeTab === 'altar' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">The Void Altar</h1>
                                <p className="text-gray-400">Spend your Fate Points to influence destiny.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {RITUALS.map(r => {
                                    const ui = ALTAR_UI[r.id];
                                    const Icon = ui.icon;
                                    return (
                                        <div key={r.id} className={`bg-[#222] p-6 rounded-xl border ${ui.border} relative overflow-hidden`}>
                                            <div className="absolute top-0 right-0 p-4 opacity-10"><Icon size={64} /></div>
                                            <h3 className={`${ui.color} font-bold text-lg mb-2`}>{r.name}</h3>
                                            <p className="text-sm text-gray-300 mb-4">{r.tagline}{r.chunkedOnly ? ' (Chunked mode only)' : ''}</p>
                                            <div className="text-xs font-mono bg-black/40 p-3 rounded border border-white/5 text-gray-400">
                                                Cost: <span className="text-white font-bold">{r.fateCost ? `${ritualCost(r.id)} Fate Points` : `${r.keyCost} Keys`}</span>
                                                <br/>
                                                Effect: {ritualText(r.id)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- UNLOCK SYSTEMS --- */}
                    {activeTab === 'unlocks' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Unlock Systems</h1>
                                <p className="text-gray-400">What do Keys actually do?</p>
                                <p className="text-xs text-amber-300 mt-2 font-bold">{vanillaPolicyLabel}</p>
                            </div>

                            <div className="bg-amber-950/20 p-4 rounded-xl border border-amber-500/30 text-sm text-gray-300">
                                {describeVanillaRandomAccessPolicy()}
                            </div>

                            {/* Key types */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-[#222] p-4 rounded-xl border border-amber-500/30">
                                    <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-2"><Key size={16}/> Standard Key</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Spend on a chosen table (Skills, Regions, Equipment…) to unlock a
                                        <b> random</b> entry from it. Your bread-and-butter currency.
                                    </p>
                                </div>
                                <div className="bg-[#222] p-4 rounded-xl border border-purple-500/30">
                                    <h4 className="font-bold text-purple-400 mb-1 flex items-center gap-2"><Sparkles size={16}/> Omni-Key</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Click a locked entry on the Dashboard to <b>pick exactly</b> what you unlock. You get them as a
                                        bonus on successful rolls, or for {getRitual('TRANSMUTE').keyCost} Keys at the Void Altar.
                                        {gameModeId === 'chunked' && ' In Chunked, land only comes from Chunk unlocks and the Ritual of the Cartographer.'}
                                    </p>
                                </div>
                                <div className="bg-[#222] p-4 rounded-xl border border-red-500/30">
                                    <h4 className="font-bold text-red-400 mb-1 flex items-center gap-2"><Dna size={16}/> Chaos Key</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Unlocks a <b>random entry from all the tables at once</b>. Every eligible entry is
                                        equally likely, so big tables such as {gameModeId === 'chunked' ? 'Banks' : 'Areas and Banks'} come up most.
                                        Guaranteed at skill levels {andList(SKILL_CHAOS_MILESTONES)}, a {LEVEL_CHAOS_CHANCE}% chance on
                                        every level-up, or the Ritual of Chaos.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-4 items-start">
                                    <div className="bg-[#222] p-3 rounded-lg border border-white/10 shrink-0">
                                        <WikiIcon file="Worn_Equipment.png" alt="" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-200 text-lg">Equipment Slots</h3>
                                        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                            Start with 0 slots. Unlocking a slot (e.g. Head) moves it to Tier 1.
                                            You can equip items up to that Tier.
                                            <br/><br/>
                                            <span className="text-xs font-mono bg-black/30 px-2 py-1 rounded">See Equipment Tiers tab for details.</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4 items-start">
                                    <div className="bg-[#222] p-3 rounded-lg border border-white/10 shrink-0">
                                        <WikiIcon file="Stats_icon.png" alt="" size={24} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-200 text-lg">Skills</h3>
                                        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                            All skills start locked at Level 1 (except HP).
                                            <br/>
                                            1 Key = Unlock Tier 1 (Content 1-10). You may level a skill to 99, but you are restricted to using resources/methods from your unlocked Tiers only.
                                            <br/>
                                            Upgrade Tier to access higher level methods (Tier 2 = 1-20, ..., Tier 10 = 1-99).
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-4 items-start">
                                    <div className="bg-[#222] p-3 rounded-lg border border-white/10 shrink-0">
                                        <Map size={24} className="text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-200 text-lg">{gameModeId === 'chunked' ? 'Chunks' : 'Areas'}</h3>
                                        {gameModeId === 'chunked' ? (
                                            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                                Chunked mode has no named areas: you unlock map chunks, each a square of
                                                64 by 64 tiles. You start in one free chunk: central Lumbridge, with the
                                                castle, church and shops.
                                                <br/>
                                                1 Key = a <b>random frontier chunk</b>, one next to a chunk you already hold.
                                                After Pandemonium, with Sailing unlocked, coast across open sea from your
                                                land joins the frontier too.
                                                <br/>
                                                You can only enter chunks you've unlocked. Fate picks a random chunk from
                                                the frontier, not the one you want; only the Ritual of the Cartographer
                                                lets you choose.
                                            </p>
                                        ) : (
                                            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                                All of <b>Misthalin</b> (Lumbridge, Varrock, Draynor Village and more) is free from the start.
                                                <br/>
                                                1 Key = a random named area, such as Catherby or Rellekka. In Vanilla the areas you roll don't have to touch each other.
                                                <br/>
                                                Only Chunked makes you grow out from land you hold. You can only enter areas you've unlocked.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Every spend table */}
                            <div>
                                <h3 className="text-osrs-gold font-bold uppercase tracking-widest mb-3 flex items-center gap-2"><Coins size={16}/> Every Spend Table</h3>
                                <p className="text-xs text-gray-500 mb-4">A Standard Key cashes in on whichever table you choose, for a random entry from it. Equipment and Skills are tiered — repeat unlocks deepen them (slots × tiers); the rest are one-and-done.</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {spendTables.map(t => (
                                        <div key={t.label} className="bg-[#222] rounded-lg border border-white/5 p-3 flex items-start gap-3">
                                            <div className="text-[11px] font-mono font-bold text-osrs-gold bg-black/30 rounded px-2 py-1 shrink-0 mt-0.5" title={t.tiers ? `${t.count} entries × ${t.tiers} tiers` : `${t.count} entries`}>
                                                {t.count}{t.tiers ? `×${t.tiers}` : ''}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-sm font-bold text-gray-200">{t.label}</h4>
                                                <p className="text-[11px] text-gray-500 leading-snug">{t.blurb}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- EQUIPMENT TIERS --- */}
                    {activeTab === 'equipment' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Equipment Tiers</h1>
                                <p className="text-gray-400">Progression of gear power.</p>
                            </div>

                            <div className="bg-[#222] rounded-xl border border-white/5 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#111] text-gray-400 uppercase text-xs">
                                        <tr>
                                            <th className="p-4">Tier</th>
                                            <th className="p-4">Material / Level</th>
                                            <th className="p-4">Examples</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800 text-gray-300">
                                        <tr><td className="p-4 font-bold text-gray-500">Tier 1</td><td className="p-4">Bronze / Iron / Leather / Basic staves</td><td className="p-4 text-xs text-gray-500">Elemental staves, Wooden shield</td></tr>
                                        <tr><td className="p-4 font-bold text-orange-800">Tier 2</td><td className="p-4">Steel / Black / White / Studded</td><td className="p-4 text-xs text-gray-500">Oak shortbow, Steel scimitar</td></tr>
                                        <tr><td className="p-4 font-bold text-gray-400">Tier 3</td><td className="p-4">Mithril / Initiate</td><td className="p-4 text-xs text-gray-500">Willow bow, Xerician robes</td></tr>
                                        <tr><td className="p-4 font-bold text-green-700">Tier 4</td><td className="p-4">Adamant / Green D'hide</td><td className="p-4 text-xs text-gray-500">Maple bow, Mystic robes</td></tr>
                                        <tr><td className="p-4 font-bold text-cyan-500">Tier 5</td><td className="p-4">Rune / Blue D'hide</td><td className="p-4 text-xs text-gray-500">Yew bow, Ibans Staff</td></tr>
                                        <tr><td className="p-4 font-bold text-red-500">Tier 6</td><td className="p-4">Dragon / Red D'hide</td><td className="p-4 text-xs text-gray-500">Magic bow, Ancient staff</td></tr>
                                        <tr><td className="p-4 font-bold text-purple-500">Tier 7</td><td className="p-4">Barrows / Black &amp; Blessed D'hide</td><td className="p-4 text-xs text-gray-500">Ahrims, Karils, Obsidian</td></tr>
                                        <tr><td className="p-4 font-bold text-yellow-500">Tier 8</td><td className="p-4">God Wars / Zenyte</td><td className="p-4 text-xs text-gray-500">Bandos, Armadyl, Trident</td></tr>
                                        <tr><td className="p-4 font-bold text-blue-400">Tier 9</td><td className="p-4">Raids / Endgame</td><td className="p-4 text-xs text-gray-500">Ancestral, Torva, Masori, T-Bow</td></tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- STORAGE --- */}
                    {activeTab === 'storage' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Storage Restrictions</h1>
                                <p className="text-gray-400">Bank and storage rules.</p>
                            </div>

                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                <h3 className="font-bold text-gray-200 text-lg mb-4 flex items-center gap-2"><Package size={20}/> The Rules</h3>
                                <ul className="space-y-4 text-sm text-gray-300 list-disc list-inside">
                                    <li><b>Banking is locked by place.</b> Each place with a bank, bank chest or deposit box is one unlock on the <b>Banks</b> table, and it opens all of them there. A Key unlocks a random one; an Omni-Key picks one.</li>
                                    <li>Storage items, such as the looting bag, rune pouch and seed box, are unlocked from the <b>Storage</b> table.</li>
                                </ul>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
