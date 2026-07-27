
import React, { useState, useRef } from 'react';
import { X, Shield, Package, ArrowUp, BookOpen, Dices, Sparkles, Map, Zap, Scroll, Skull, Activity, Lock, Key, Dna, Coins, HelpCircle, GraduationCap, SlidersHorizontal, Compass } from 'lucide-react';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useGame } from '../context/GameContext';
import { GAME_MODES, getGameMode, resolveModeRules } from '../config/gameModes';
import { REGION_MODIFIERS } from '../config/regionModifiers';
import { CLUE_ONBOARDING_MINIMUMS, EARN_METHODS, KEY_TYPES, RITUALS, SPEND_TABLES, UNLOCK_KEY_COST, VANILLA_BOSS_KEY_RATES, VANILLA_BOSS_STANDARD_KEY_TOTAL } from '../config/economy';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';
import { TableType } from '../types';
import { ALL_CHUNK_KEYS } from '../utils/chunkAdjacency';

interface ReferenceModalProps {
  onClose: () => void;
  initialTab?: TabId;
}

type TabId = 'core' | 'economy' | 'modes' | 'drops' | 'altar' | 'region' | 'unlocks' | 'equipment' | 'storage';

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
  const ritualCost = (base: number) => Math.round(base * rules.ritualCostMultiplier);
  const vanillaPolicyLabel = gameModeId === 'vanilla'
    ? 'Vanilla-only rules'
    : 'Vanilla-only (not active for this run)';

  // Chunked mode unlocks individual map chunks, not named regions — swap the
  // "Areas" entry for the real table/count/blurb so the Codex matches what
  // Spend Keys actually shows (see components/GachaSection.tsx).
  const spendTables = gameModeId === 'chunked'
    ? SPEND_TABLES.map(t => t.type === TableType.REGIONS
        ? { ...t, type: TableType.CHUNKS, label: 'Chunks', count: ALL_CHUNK_KEYS.length, blurb: 'Unlock a random chunk directly adjacent to territory you already hold.' }
        : t)
    : SPEND_TABLES;

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: 'core', label: 'Core Rules', icon: BookOpen },
    { id: 'economy', label: 'Key Economy', icon: Coins },
    { id: 'modes', label: 'Game Modes', icon: SlidersHorizontal },
    { id: 'drops', label: 'RNG & Drop Rates', icon: Dices },
    { id: 'altar', label: 'The Void Altar', icon: Zap },
    { id: 'region', label: 'Region Bonuses', icon: Compass },
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
            <h2 className="text-xl font-bold text-gray-100 tracking-wide">Fate-Locked Ironman: Codex</h2>
            <span
              className="text-[10px] font-bold uppercase tracking-wider text-amber-200 bg-amber-900/40 px-2 py-1 rounded border border-amber-500/30"
              title={activeMode.description}
            >
              {activeMode.name} Mode
            </span>
          </div>
          <button 
            onClick={onClose}
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
                                <p className="text-gray-400 text-lg">The ultimate test of adaptability and fortune.</p>
                            </div>

                            {/* The Concept */}
                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                 <h3 className="text-osrs-gold font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Skull size={18} /> The Concept
                                </h3>
                                <p className="text-gray-300 leading-relaxed text-sm">
                                    This is a <b>"Snowball" style restriction mode</b> for Old School RuneScape. 
                                    You start as a fresh account (Ironman) with everything locked: you cannot equip armor, train skills past level 1, enter specific map regions, or use transport methods.
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
                                                Click the corresponding button in the app. It rolls 1-100.
                                                <br/>
                                                <span className="text-green-400">Success:</span> Roll under the threshold to get a Key.
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
                                        Bad luck protection. Each failed roll adds 1 Fate Point.
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
                                        Rare upgrade on a successful roll (<span className="text-white font-bold">{rules.omniChanceBase}% base chance</span> in your mode).
                                        <br/><br/>
                                        These let you <span className="text-white font-bold">pick exactly what you want</span> to unlock, bypassing the RNG gacha.
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
                                <p className="text-center text-xs text-gray-500 mt-4">Every unlock widens the funnel — more skills, regions and bosses mean more tasks to roll on. That snowball <i>is</i> the game.</p>
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
                                    <li><b className="text-white">1.</b> You finish <b>Dragon Slayer II</b> — a <b className="text-purple-400">Master</b> quest — and tick it off in the Journal.</li>
                                    <li><b className="text-white">2.</b> The app rolls <span className="font-mono">1–100</span> against its <b className="text-purple-400">95%</b> threshold. You roll <span className="font-mono text-green-400">42</span> → a Key!</li>
                                    <li><b className="text-white">3.</b> Every success then rolls for an upgrade. In {activeMode.name} mode that's a <b className="text-purple-400">{rules.omniChanceBase}%</b> Omni chance (up to 20% on this very quest). Miss it and you bank a Standard Key; hit it and you <i>also</i> pocket an <b className="text-purple-400">Omni-Key</b>.</li>
                                    <li><b className="text-white">4.</b> Take the Key to <b className="text-osrs-gold">Spend Keys</b>, choose the <b>Skills</b> table, and unlock a random skill tier — say Slayer. Those new Slayer levels open fresh tasks to roll on.</li>
                                    <li className="text-gray-500 text-xs pt-1">Roll <span className="font-mono">96–100</span> instead and you'd get no Key — but you'd gain a Fate Point{rules.pityEnabled ? <>, inching toward a guaranteed Key at <b>{rules.pityThreshold}</b></> : ''}.</li>
                                </ol>
                            </div>

                            {/* Fate + altar quick ref */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-[#222] p-5 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Shield size={16} className="text-osrs-pity"/> Fate Points</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Earned <b>+1 per failed roll</b>, reset to 0 the moment you get any Key.
                                        {rules.pityEnabled
                                            ? <> At <b className="text-white">{rules.pityThreshold}</b> they convert a failure into a guaranteed <b>Pity Key</b>.</>
                                            : <> Pity is <b className="text-red-400">off</b> in {activeMode.name} mode.</>}
                                        {' '}Either way, they're the fuel for the Void Altar.
                                    </p>
                                </div>
                                <div className="bg-[#222] p-5 rounded-xl border border-white/5">
                                    <h4 className="font-bold text-gray-200 mb-2 flex items-center gap-2"><Zap size={16} className="text-purple-400"/> Spend Fate at the Altar</h4>
                                    <ul className="space-y-1.5 text-xs text-gray-400">
                                        {RITUALS.map(r => (
                                            <li key={r.id} className="flex justify-between gap-2">
                                                <span>{r.name}</span>
                                                <span className="font-mono text-gray-300 shrink-0">{r.fateCost ? `${ritualCost(r.fateCost)} Fate` : `${r.keyCost} Keys`}</span>
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
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Slayer is your engine.</b> It's the most repeatable roll — climb to higher masters (Konar 35%, Duradel 70%, Boss tasks 80%) as soon as you can survive them.</span></li>
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Save Omni-Keys for the big wishes.</b> Pick a must-have — a key region, a raid boss, a gear slot — rather than spending them where the table is tiny.</span></li>
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Bad luck still pays.</b> Every failed roll banks Fate. Spend it on Clarity before a high-stakes roll, or save toward a Chaos Key.</span></li>
                                    <li className="flex gap-2"><span className="text-emerald-400 font-bold shrink-0">›</span><span><b>Grandmaster quests are the single best roll.</b> A guaranteed Key and the best Omni odds in the game — with Elite diaries and the top CA tiers close behind.</span></li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* --- GAME MODES --- */}
                    {activeTab === 'modes' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Game Modes</h1>
                                <p className="text-gray-400">Every run is played under one fixed ruleset.</p>
                            </div>

                            <div className="bg-[#222] p-6 rounded-xl border border-amber-500/20">
                                <h3 className="text-amber-400 font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <Lock size={16} /> The Mode Locks On Start
                                </h3>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    You pick a mode when a profile is created. The moment the run logs
                                    its first action, the mode is <b>permanently locked</b> — this keeps a
                                    run's ruleset fixed and its verified history meaningful. To play a
                                    different mode, start a new profile.
                                </p>
                            </div>

                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                <h3 className="text-gray-200 font-bold uppercase tracking-widest mb-4">The Rule Knobs</h3>
                                <ul className="space-y-3 text-sm text-gray-400">
                                    <li><b className="text-sky-400">Pity System</b> — whether failed rolls eventually guarantee a Key, and after how many Fate Points.</li>
                                    <li><b className="text-purple-400">Base Omni Chance</b> — the % chance a successful roll upgrades to an Omni-Key.</li>
                                    <li><b className="text-amber-400">Ritual Cost</b> — a multiplier applied to every Void Altar ritual's Fate cost.</li>
                                    <li><b className="text-emerald-400">Region Modifiers</b> — whether explored continents grant passive bonuses (see the Region Bonuses tab).</li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {GAME_MODES.map(mode => {
                                    const isActive = mode.id === activeMode.id;
                                    const r = (mode.id === 'custom' && isActive) ? rules : mode.rules;
                                    return (
                                        <div key={mode.id} className={`bg-[#222] p-5 rounded-xl border ${isActive ? 'border-amber-500/60' : 'border-white/5'}`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <h4 className="font-bold text-white text-lg">{mode.name}</h4>
                                                {isActive && <span className="text-[9px] uppercase tracking-wider bg-emerald-900/60 text-emerald-300 px-1.5 py-0.5 rounded">Your run</span>}
                                            </div>
                                            <p className="text-xs text-amber-300/70 mb-2">{mode.tagline}</p>
                                            <p className="text-xs text-gray-400 mb-3 leading-relaxed">{mode.description}</p>
                                            <div className="grid grid-cols-2 gap-y-1.5 text-[11px] font-mono bg-black/30 p-3 rounded border border-white/5">
                                                <span className="text-gray-500">Pity</span>
                                                <span className="text-gray-200">{r.pityEnabled ? `${r.pityThreshold} Fate` : 'Disabled'}</span>
                                                <span className="text-gray-500">Omni base</span>
                                                <span className="text-gray-200">{r.omniChanceBase}%</span>
                                                <span className="text-gray-500">Ritual cost</span>
                                                <span className="text-gray-200">{r.ritualCostMultiplier.toFixed(2)}×</span>
                                                <span className="text-gray-500">Regions</span>
                                                <span className="text-gray-200">{r.regionModifiers ? 'On' : 'Off'}</span>
                                            </div>
                                            {mode.id === 'custom' && !isActive && (
                                                <p className="text-[10px] text-gray-600 mt-2 italic">Defaults shown — every value is tunable in the mode picker.</p>
                                            )}
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
                                        Any successful key roll has a <b>{rules.omniChanceBase}% chance</b> to upgrade to an Omni-Key in <b>{activeMode.name}</b> mode.
                                        <br/><br/>
                                        High-effort sources keep elevated odds: Grandmaster Quests <b>20%</b>, Elite Diaries / CA &amp; Diary completions <b>10%</b>.
                                        {rules.regionModifiers && <><br/><br/><span className="text-emerald-400">Region bonuses add to this — see the Region Bonuses tab.</span></>}
                                    </p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-lg border border-red-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Dna className="text-red-400" size={20} />
                                        <h4 className="font-bold text-red-400">Chaos Keys</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Obtained via rare drop (2%) on Level Up.
                                        <br/><br/>
                                        Also obtainable via the Ritual of Chaos ({ritualCost(25)} Fate Points).
                                    </p>
                                </div>
                                <div className="bg-black/20 p-4 rounded-lg border border-amber-500/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Shield className="text-amber-400" size={20} />
                                        <h4 className="font-bold text-amber-400">Pity Timer</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        {rules.pityEnabled ? (
                                          <>{rules.pityThreshold} failed rolls = 1 Guaranteed Key.<br/><br/>This counter resets whenever ANY key is obtained.</>
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
                                                Cost: <span className="text-white font-bold">{r.fateCost ? `${ritualCost(r.fateCost)} Fate Points` : `${r.keyCost} Keys`}</span>
                                                <br/>
                                                Effect: {r.effect}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- REGION BONUSES --- */}
                    {activeTab === 'region' && (
                        <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                            <div>
                                <h1 className="text-3xl font-black text-white mb-2">Region Bonuses</h1>
                                <p className="text-gray-400">Passive modifiers granted by the continents you've explored.</p>
                            </div>

                            <div className={`p-4 rounded-xl border ${rules.regionModifiers ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-[#222] border-white/5'}`}>
                                <p className="text-sm text-gray-300 leading-relaxed">
                                    {rules.regionModifiers ? (
                                        <><b className="text-emerald-400">Active in {activeMode.name} mode.</b> A continent's passive switches on once you unlock any region inside it, and every active bonus stacks.</>
                                    ) : (
                                        <><b className="text-gray-500">Inactive in {activeMode.name} mode.</b> Region passives only apply when a mode has Region Modifiers enabled — e.g. Region Rush, or a Custom mode with the toggle on.</>
                                    )}
                                </p>
                            </div>

                            <div className="bg-[#222] rounded-xl border border-white/5 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#111] text-gray-400 uppercase text-xs">
                                        <tr>
                                            <th className="p-4">Continent</th>
                                            <th className="p-4">Passive</th>
                                            <th className="p-4">Effect</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800 text-gray-300">
                                        {REGION_MODIFIERS.map(mod => (
                                            <tr key={mod.continent}>
                                                <td className="p-4 font-bold text-white">{mod.continent}</td>
                                                <td className="p-4 text-emerald-300">{mod.name}</td>
                                                <td className="p-4 text-gray-400 text-xs">{mod.description}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <p className="text-xs text-gray-500 italic">
                                Misthalin's passive is always active — it's your homeland. Bonuses shift the
                                effective success threshold and Omni chance of every roll.
                            </p>
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
                                        Spend on a table to <b>pick exactly</b> the entry you want — no RNG.
                                        Earned by upgrading a successful roll, or forged at the Altar.
                                    </p>
                                </div>
                                <div className="bg-[#222] p-4 rounded-xl border border-red-500/30">
                                    <h4 className="font-bold text-red-400 mb-1 flex items-center gap-2"><Dna size={16}/> Chaos Key</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed">
                                        Unlocks a <b>random entry from ANY table</b> — you don't choose the
                                        table. Rare Level-Up drop, or the Ritual of Chaos.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex gap-4 items-start">
                                    <div className="bg-[#222] p-3 rounded-lg border border-white/10 shrink-0">
                                        <Shield size={24} className="text-gray-400" />
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
                                        <BookOpen size={24} className="text-blue-400" />
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
                                        <h3 className="font-bold text-gray-200 text-lg">{gameModeId === 'chunked' ? 'Chunks' : 'Regions'}</h3>
                                        {gameModeId === 'chunked' ? (
                                            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                                Chunked mode uses a different model entirely: no named regions.
                                                You start in a single free chunk — the Lumbridge castle courtyard.
                                                <br/>
                                                1 Key = Unlock a <b>random chunk directly adjacent</b> to one you already
                                                hold (map-region granularity, not a named area).
                                                <br/>
                                                You can only enter chunks you've unlocked, one step out from your
                                                territory at a time — Fate hands you a random tile of the frontier,
                                                not the one you wanted.
                                            </p>
                                        ) : (
                                            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                                                You start in <b>Misthalin</b> (Lumbridge/Varrock/Draynor).
                                                <br/>
                                                1 Key = Unlock a random named area (e.g. "Catherby", "Fremennik Province"). Vanilla named-area rolls can be scattered.
                                                <br/>
                                                Only Chunked mode enforces adjacent expansion. You can only enter unlocked regions.
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
                                        <tr><td className="p-4 font-bold text-gray-500">Tier 1</td><td className="p-4">Bronze / Iron / Leather</td><td className="p-4 text-xs text-gray-500">Standard spells, Wooden shield</td></tr>
                                        <tr><td className="p-4 font-bold text-orange-800">Tier 2</td><td className="p-4">Steel / Black / Studded</td><td className="p-4 text-xs text-gray-500">Oak shortbow, Steel scimitar</td></tr>
                                        <tr><td className="p-4 font-bold text-gray-400">Tier 3</td><td className="p-4">Mithril / Initiate</td><td className="p-4 text-xs text-gray-500">Willow bow, Xerician robes</td></tr>
                                        <tr><td className="p-4 font-bold text-green-700">Tier 4</td><td className="p-4">Adamant / Green D'hide</td><td className="p-4 text-xs text-gray-500">Maple bow, Mystic robes</td></tr>
                                        <tr><td className="p-4 font-bold text-cyan-500">Tier 5</td><td className="p-4">Rune / Blue D'hide</td><td className="p-4 text-xs text-gray-500">Yew bow, Ibans Staff</td></tr>
                                        <tr><td className="p-4 font-bold text-red-500">Tier 6</td><td className="p-4">Dragon / Red D'hide</td><td className="p-4 text-xs text-gray-500">Magic bow, Ancient staff</td></tr>
                                        <tr><td className="p-4 font-bold text-purple-500">Tier 7</td><td className="p-4">Barrows / Black D'hide</td><td className="p-4 text-xs text-gray-500">Ahrims, Karils, Obsidian</td></tr>
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
                                <p className="text-gray-400">Inventory management is key.</p>
                            </div>

                            <div className="bg-[#222] p-6 rounded-xl border border-white/5">
                                <h3 className="font-bold text-gray-200 text-lg mb-4 flex items-center gap-2"><Package size={20}/> The Rules</h3>
                                <ul className="space-y-4 text-sm text-gray-300 list-disc list-inside">
                                    <li><b>No Banking</b> allowed by default (Ultimate Ironman).</li>
                                    <li>However, you can unlock specific <b>Storage Containers</b> via the gacha.</li>
                                    <li>Unlockable items include: Looting Bag, Rune Pouch, Seed Box, etc.</li>
                                    <li>If you unlock "Bank Access" (Rare), you may use banks in specific regions only.</li>
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
