
import React, { useRef, useState, useMemo, useEffect } from 'react';
import { X, Copy, Download, Trophy, Map, Shield, Sparkles, Skull, Crown, Hash, Activity, Zap, Home, Store, Gamepad2, Package, BookOpen, Dna, Calendar, Star, Landmark } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { RunCardModal } from './RunCard';
import { SectionGuide } from './SectionGuide';
import { getGameMode } from '../config/gameModes';
import { showToast } from '../utils/toast';
import { EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX, SKILLS_LIST, REGIONS_LIST, REGION_GROUPS, SLOT_CONFIG } from '../constants';
import { isAreaReachable } from '../utils/reachability';

interface ShareModalProps {
  onClose: () => void;
}

type CardTheme = 'VOID' | 'GILDED' | 'IRON' | 'BLOOD' | 'NATURE';

const TIER_COLORS = [
  'bg-[#292524]', // T1 Stone
  'bg-[#7c2d12]', // T2 Bronze
  'bg-[#52525b]', // T3 Iron
  'bg-[#94a3b8]', // T4 Steel
  'bg-[#047857]', // T5 Adamant
  'bg-[#0891b2]', // T6 Rune
  'bg-[#b91c1c]', // T7 Dragon
  'bg-[#7e22ce]', // T8 Ancient
  'bg-[#c026d3]', // T9 Crystal
  'bg-[#facc15]', // T10 Gilded
];

const StatsShareCard: React.FC<ShareModalProps & { embedded?: boolean }> = ({ onClose, embedded }) => {
  const gameState = useGame();
  const activeMode = getGameMode(gameState.gameModeId);
  const cardRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  const [isCapturing, setIsCapturing] = useState(false);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
  const [theme, setTheme] = useState<CardTheme>('VOID');

  // --- Stats Calculation ---
  const { unlocks, gameModeId } = gameState;
  const isChunked = gameModeId === 'chunked';
  // Chunked mode has no unlocks.regions — its "territory unlocked" stat is
  // chunk count instead.
  const totalRegions = isChunked ? (unlocks.chunks ?? []).length : unlocks.regions.length;
  const totalSkillTiers = (Object.values(unlocks.skills) as number[]).reduce((a, b) => a + b, 0);
  const totalEquipTiers = (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0);
  const totalLevel = (Object.values(unlocks.levels) as number[]).reduce((a, b) => a + b, 0);

  const maxProgression = (SKILLS_LIST.length * 10) + (EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX) + REGIONS_LIST.length;
  const currentProgression = totalSkillTiers + totalEquipTiers + totalRegions;
  const progressPercent = Math.round((currentProgression / maxProgression) * 100);

  // Region Mastery — chunk-aware: in Chunked mode an area counts once you
  // hold a chunk foothold in it (same rule as the map and World tab).
  const regionMastery = Object.entries(REGION_GROUPS).map(([group, areas]) => {
      const unlockedCount = areas.filter(a => isAreaReachable(a, unlocks, gameModeId)).length;
      return { group, count: unlockedCount, total: areas.length, percent: unlockedCount / areas.length };
  }).filter(r => r.count > 0).sort((a, b) => b.percent - a.percent);

  // Counts
  const bossCount = unlocks.bosses.length;
  const minigameCount = unlocks.minigames.length;
  const arcanaCount = unlocks.arcana.length;
  const pohCount = unlocks.housing.length;

  // --- Rank System ---
  const rank = useMemo(() => {
    if (progressPercent < 10) return { title: 'Lost Soul', color: 'text-gray-500', icon: Skull };
    if (progressPercent < 25) return { title: 'Fate Wanderer', color: 'text-blue-400', icon: Map };
    if (progressPercent < 50) return { title: 'Iron Determinator', color: 'text-gray-300', icon: Shield };
    if (progressPercent < 75) return { title: 'Void Champion', color: 'text-purple-400', icon: Trophy };
    return { title: 'Master of Fate', color: 'text-amber-400', icon: Crown };
  }, [progressPercent]);

  // --- Theme Styles ---
  const getThemeStyles = () => {
    switch (theme) {
      case 'GILDED':
        return {
          bg: 'bg-[#1a1814]',
          border: 'border-[#854d0e]',
          accent: 'text-yellow-500',
          sub: 'text-yellow-200/60',
          panel: 'bg-[#2a2620]',
          gradient: 'from-yellow-900/40 via-[#1a1814] to-black',
          deco: 'border-yellow-500/20',
          bar: 'bg-yellow-500'
        };
      case 'IRON':
        return {
          bg: 'bg-[#1a1a1a]',
          border: 'border-gray-500',
          accent: 'text-gray-300',
          sub: 'text-gray-500',
          panel: 'bg-[#262626]',
          gradient: 'from-gray-800/40 via-[#1a1a1a] to-black',
          deco: 'border-gray-500/20',
          bar: 'bg-gray-400'
        };
      case 'BLOOD':
        return {
          bg: 'bg-[#1a0a0a]',
          border: 'border-red-900',
          accent: 'text-red-500',
          sub: 'text-red-200/60',
          panel: 'bg-[#2a1010]',
          gradient: 'from-red-900/40 via-[#1a0a0a] to-black',
          deco: 'border-red-500/20',
          bar: 'bg-red-600'
        };
      case 'NATURE':
        return {
          bg: 'bg-[#0f1a10]',
          border: 'border-emerald-800',
          accent: 'text-emerald-400',
          sub: 'text-emerald-200/50',
          panel: 'bg-[#142515]',
          gradient: 'from-emerald-900/40 via-[#0f1a10] to-black',
          deco: 'border-emerald-500/20',
          bar: 'bg-emerald-500'
        };
      case 'VOID':
      default:
        return {
          bg: 'bg-[#0f0f13]',
          border: 'border-purple-900',
          accent: 'text-purple-400',
          sub: 'text-purple-200/50',
          panel: 'bg-[#18181b]',
          gradient: 'from-purple-900/20 via-[#0f0f13] to-black',
          deco: 'border-purple-500/20',
          bar: 'bg-purple-500'
        };
    }
  };

  const ts = getThemeStyles();

  // --- Actions ---
  const generateTextSummary = () => {
    return `📜 **Fate-Locked Ironman** - ${rank.title}
Progression: ${progressPercent}% | Total Level: ${totalLevel}
🔑 Keys: ${gameState.keys} | ✨ Omni: ${gameState.specialKeys} | 🧬 Chaos: ${gameState.chaosKeys}
🌍 ${isChunked ? 'Chunks' : 'Regions'}: ${totalRegions} Unlocked
⚔️ Gear Tiers: ${totalEquipTiers}
🏆 Bosses: ${bossCount} | 🎲 Minigames: ${minigameCount}
🏦 Banks: ${(unlocks.banks ?? []).length}/${100}
#OSRS #FateLocked`;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generateTextSummary());
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const handleDownloadImage = async () => {
    if (!cardRef.current) return;
    setIsCapturing(true);
    try {
      // Wait for font/styles to settle
      await new Promise(r => setTimeout(r, 200));
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        scale: 2, 
        logging: false
      });
      
      const link = document.createElement('a');
      link.download = `fate_locked_status_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Screenshot failed', err);
      showToast('Image generation failed — try your browser screenshot tool');
    } finally {
      setIsCapturing(false);
    }
  };

  const getSlotImage = (slot: string) => {
      const config = SLOT_CONFIG[slot];
      return config ? `https://oldschool.runescape.wiki/images/${config.file}` : '';
  };
  
  const getSkillImage = (skill: string) => {
      return `https://oldschool.runescape.wiki/images/${skill}_icon.png`;
  };

  // Notable feats logic
  const notableFeats = useMemo(() => {
      const feats = [];
      
      // Skills
      const maxedSkills = Object.entries(unlocks.skills).filter(([_, t]) => (t as number) >= 10);
      if (maxedSkills.length > 0) feats.push({ label: `${maxedSkills.length} Maxed Skills`, icon: Crown, color: 'text-yellow-400' });
      else if (Object.values(unlocks.skills).some(t => (t as number) >= 7)) feats.push({ label: 'High-Tier Skiller', icon: BookOpen, color: 'text-blue-400' });

      // Gear
      const maxedGear = Object.entries(unlocks.equipment).filter(([_, t]) => (t as number) >= 9);
      if (maxedGear.length > 0) feats.push({ label: 'Endgame Gear Unlocked', icon: Shield, color: 'text-red-400' });

      // Raids
      if (unlocks.bosses.includes('Chambers of Xeric') || unlocks.bosses.includes('Theatre of Blood') || unlocks.bosses.includes('Tombs of Amascut')) {
          feats.push({ label: 'Raid Access', icon: Skull, color: 'text-green-400' });
      }

      // Specifics
      if (unlocks.bosses.includes('Inferno')) feats.push({ label: 'Inferno Unlocked', icon: Zap, color: 'text-orange-500' });
      if (isAreaReachable('Prifddinas', unlocks, gameModeId)) feats.push({ label: 'Prifddinas Access', icon: Map, color: 'text-teal-400' });
      // 'Wilderness' is a REGION_GROUPS continent key, not an unlockable area —
      // unlocks.regions only ever contains children (Ferox Enclave, Lava Maze,
      // etc.). Check any Wilderness area is unlocked instead.
      if ((REGION_GROUPS['Wilderness'] || []).some(a => isAreaReachable(a, unlocks, gameModeId))) {
          feats.push({ label: 'Brave Wanderer', icon: Skull, color: 'text-gray-400' });
      }

      return feats.slice(0, 4);
  }, [unlocks, gameModeId]);

  const inner = (
      <div className="flex flex-col gap-6 items-center w-full max-w-5xl my-auto">

        {/* Theme Selectors */}
        <div className="flex gap-2 p-1.5 bg-[#1a1a1a] rounded-full border border-white/10 shadow-xl overflow-x-auto max-w-full">
            {(['VOID', 'GILDED', 'IRON', 'BLOOD', 'NATURE'] as CardTheme[]).map(t => (
                <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`px-4 py-1.5 rounded-full text-[10px] font-bold transition-all uppercase tracking-wider ${theme === t ? 'bg-white text-black shadow-md scale-105' : 'text-gray-500 hover:text-white'}`}
                >
                    {t}
                </button>
            ))}
        </div>

        {/* --- THE CARD --- */}
        <div 
          ref={cardRef}
          id="status-card"
          className={`
            w-full max-w-[850px]
            rounded-2xl border-[4px] ${ts.border}
            ${ts.bg} relative overflow-hidden shadow-2xl flex flex-col
          `}
        >
            {/* Background Texture */}
            <div className={`absolute inset-0 bg-gradient-to-br ${ts.gradient} pointer-events-none`}></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.07] pointer-events-none"></div>
            
            {/* Top Badge Decoration */}
            <div className={`absolute top-0 right-0 p-32 bg-gradient-to-bl from-white/5 to-transparent rounded-bl-full pointer-events-none`}></div>

            {/* HEADER */}
            <div className={`relative z-10 flex justify-between items-start p-8 pb-6 border-b ${ts.deco}`}>
                <div className="flex items-center gap-6">
                    <div className={`w-20 h-20 rounded-2xl border-2 ${ts.border} bg-black/40 flex items-center justify-center shadow-[0_0_25px_rgba(0,0,0,0.5)] backdrop-blur-md`}>
                        <rank.icon className={`w-12 h-12 ${rank.color} drop-shadow-lg`} />
                    </div>
                    <div>
                        <div className={`text-xs font-bold uppercase tracking-[0.2em] mb-1 ${ts.accent}`}>RNG Edition · {activeMode.name} Mode</div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tight leading-none drop-shadow-md">Fate Locked</h2>
                        <div className={`flex items-center gap-3 mt-2 ${rank.color}`}>
                            <span className="text-sm font-bold uppercase tracking-wide bg-black/30 px-2 py-0.5 rounded border border-white/5">{rank.title}</span>
                            <span className="text-xs text-gray-400 font-mono flex items-center gap-1.5"><Calendar size={12} /> {new Date().toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex flex-col items-end">
                         <span className={`text-5xl font-black text-white leading-none flex items-center gap-2 drop-shadow-lg`}>
                            {progressPercent}%
                         </span>
                         <span className={`text-[10px] font-mono uppercase tracking-[0.3em] ${ts.sub} mt-1`}>Completion</span>
                    </div>
                </div>
            </div>

            {/* STATS BAR */}
            <div className={`relative z-10 grid grid-cols-5 border-b ${ts.deco} bg-black/30 divide-x divide-white/5 backdrop-blur-sm`}>
                 <div className="py-3 px-2 flex flex-col items-center group">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 group-hover:text-gray-300 transition-colors">Total Level</span>
                    <span className="text-lg font-bold text-white flex items-center gap-1.5"><Activity size={14} className={ts.accent} /> {totalLevel}</span>
                 </div>
                 <div className="py-3 px-2 flex flex-col items-center group">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 group-hover:text-gray-300 transition-colors">Fate Points</span>
                    <span className="text-lg font-bold text-white flex items-center gap-1.5"><Shield size={14} className="text-amber-400" /> {gameState.fatePoints}</span>
                 </div>
                 <div className="py-3 px-2 flex flex-col items-center group">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 group-hover:text-gray-300 transition-colors">Keys</span>
                    <span className="text-lg font-bold text-white flex items-center gap-1.5"><Hash size={14} className={ts.accent} /> {gameState.keys}</span>
                 </div>
                 <div className="py-3 px-2 flex flex-col items-center group">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 group-hover:text-gray-300 transition-colors">Omni-Keys</span>
                    <span className="text-lg font-bold text-white flex items-center gap-1.5"><Sparkles size={14} className="text-purple-400" /> {gameState.specialKeys}</span>
                 </div>
                 <div className="py-3 px-2 flex flex-col items-center group">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5 group-hover:text-gray-300 transition-colors">Chaos Keys</span>
                    <span className="text-lg font-bold text-white flex items-center gap-1.5"><Dna size={14} className="text-red-500" /> {gameState.chaosKeys}</span>
                 </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="relative z-10 p-8 grid grid-cols-12 gap-8">
                
                {/* Left Panel: Gear & Unlocks (8 cols) */}
                <div className="col-span-7 space-y-7">
                    
                    {/* Skills Section */}
                    <div>
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${ts.accent} flex items-center gap-2 border-b border-white/5 pb-2`}>
                            <BookOpen size={14} /> Skill Mastery
                        </h3>
                        <div className="grid grid-cols-6 gap-2">
                             {SKILLS_LIST.map(skill => {
                                 const tier = unlocks.skills[skill] || 0;
                                 return (
                                     <div key={skill} className={`bg-black/40 rounded border ${ts.deco} p-1.5 flex flex-col items-center relative overflow-hidden group`}>
                                         <div className="relative z-10 w-6 h-6 flex items-center justify-center mb-1.5">
                                             <img 
                                                src={getSkillImage(skill)} 
                                                alt={skill} 
                                                className={`w-full h-full object-contain ${tier === 0 ? 'opacity-30 grayscale' : 'drop-shadow-sm'}`} 
                                                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
                                             />
                                         </div>
                                         {/* Tier Bar */}
                                         <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className={`h-full ${tier > 0 ? TIER_COLORS[Math.min(tier - 1, 9)] : 'bg-transparent'}`} style={{width: '100%'}}></div>
                                         </div>
                                     </div>
                                 )
                             })}
                        </div>
                    </div>

                    {/* Equipment Section */}
                    <div>
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${ts.accent} flex items-center gap-2 border-b border-white/5 pb-2`}>
                            <Shield size={14} /> Gear Access
                        </h3>
                        <div className="grid grid-cols-6 gap-2">
                             {EQUIPMENT_SLOTS.map(slot => {
                                 const tier = unlocks.equipment[slot] || 0;
                                 return (
                                     <div key={slot} className={`bg-black/40 rounded border ${ts.deco} p-1.5 flex flex-col items-center relative overflow-hidden group`}>
                                         <div className="relative z-10 w-8 h-8 flex items-center justify-center mb-1.5">
                                             <img src={getSlotImage(slot)} alt={slot} className={`w-full h-full object-contain ${tier === 0 ? 'opacity-20 grayscale' : 'drop-shadow-md'}`} />
                                         </div>
                                         <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                                            <div className={`h-full ${tier > 0 ? TIER_COLORS[Math.min(tier - 1, 9)] : 'bg-transparent'}`} style={{width: '100%'}}></div>
                                         </div>
                                     </div>
                                 )
                             })}
                        </div>
                    </div>

                    {/* Unlock Counters */}
                    <div>
                         <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${ts.accent} flex items-center gap-2 border-b border-white/5 pb-2`}>
                            <Zap size={14} /> Unlocked Content
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Skull size={12} /> Bosses</div>
                                <span className="font-bold text-white text-lg leading-none">{bossCount}</span>
                            </div>
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Gamepad2 size={12} /> Minigames</div>
                                <span className="font-bold text-white text-lg leading-none">{minigameCount}</span>
                            </div>
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Store size={12} /> Merchants</div>
                                <span className="font-bold text-white text-lg leading-none">{unlocks.merchants.length}</span>
                            </div>
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Home size={12} /> POH</div>
                                <span className="font-bold text-white text-lg leading-none">{pohCount}</span>
                            </div>
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Sparkles size={12} /> Arcana</div>
                                <span className="font-bold text-white text-lg leading-none">{arcanaCount}</span>
                            </div>
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Package size={12} /> Storage</div>
                                <span className="font-bold text-white text-lg leading-none">{unlocks.storage.length}</span>
                            </div>
                            <div className={`${ts.panel} p-2 rounded border ${ts.deco} flex flex-col items-center justify-center gap-1`}>
                                <div className="text-xs text-gray-400 font-bold uppercase flex items-center gap-1.5"><Landmark size={12} /> Banks</div>
                                <span className="font-bold text-white text-lg leading-none">{(unlocks.banks ?? []).length}</span>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Right Panel: Region Mastery (5 cols) */}
                <div className="col-span-5 flex flex-col h-full">
                     <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${ts.accent} flex items-center gap-2 border-b border-white/5 pb-2`}>
                        <Map size={14} /> World Mastery
                    </h3>
                    
                    <div className={`flex-1 ${ts.panel} rounded border ${ts.deco} p-4 overflow-hidden flex flex-col shadow-inner bg-black/20`}>
                        <div className="space-y-3">
                            {regionMastery.length === 0 && (
                                <div className="text-center py-10 text-xs italic text-gray-600">No regions explored...</div>
                            )}
                            {regionMastery.map(({ group, count, total, percent }) => (
                                <div key={group} className="space-y-1">
                                    <div className="flex justify-between text-[10px] uppercase font-bold text-gray-300">
                                        <span>{group}</span>
                                        <span className="opacity-70 font-mono">{Math.round(percent * 100)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-black/60 rounded-full overflow-hidden border border-white/5">
                                        <div className={`h-full ${ts.bar} transition-all shadow-[0_0_5px_currentColor]`} style={{ width: `${percent * 100}%` }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {/* Notable Feats Section */}
                        <div className="mt-auto pt-6">
                            <h4 className="text-[10px] font-bold uppercase text-gray-500 mb-3 flex items-center gap-2 border-t border-white/5 pt-3">
                                <Star size={10} /> Notable Feats
                            </h4>
                            <div className="flex flex-col gap-2">
                                {notableFeats.length > 0 ? notableFeats.map((feat, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-black/40 p-2 rounded border border-white/5">
                                        <feat.icon size={16} className={feat.color} />
                                        <span className="text-xs font-bold text-gray-300">{feat.label}</span>
                                    </div>
                                )) : (
                                    <div className="text-[10px] text-gray-600 italic text-center py-2">The journey has just begun...</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className={`relative z-10 py-3 px-8 bg-black/60 backdrop-blur-md flex justify-between items-center text-[10px] ${ts.sub} font-mono uppercase border-t ${ts.deco}`}>
                <div className="flex items-center gap-2">
                    <Activity size={12} />
                    <span>Fate is Absolute</span>
                </div>
                <div>ID: {Date.now().toString(36).toUpperCase()}</div>
            </div>
        </div>

        {/* Controls */}
        <div className="flex gap-4 w-full max-w-[850px]">
            <button 
                onClick={handleCopyText}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white font-bold rounded-lg transition-all border border-white/10 shadow-lg"
            >
                {copyStatus === 'copied' ? <span className="text-green-400 flex items-center gap-2"><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>Copied!</span> : <><Copy size={18} /> Copy Summary</>}
            </button>
            <button 
                onClick={handleDownloadImage}
                disabled={isCapturing}
                className={`flex-1 flex items-center justify-center gap-2 py-3 font-bold rounded-lg transition-all text-black shadow-lg hover:shadow-white/20 ${theme === 'GILDED' ? 'bg-yellow-500 hover:bg-yellow-400' : theme === 'BLOOD' ? 'bg-red-600 hover:bg-red-500 text-white' : theme === 'IRON' ? 'bg-gray-400 hover:bg-gray-300' : theme === 'NATURE' ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-purple-500 hover:bg-purple-400 text-white'}`}
            >
                {isCapturing ? <span className="animate-pulse">Generating Image...</span> : <><Download size={18} /> Download Card</>}
            </button>
        </div>
        
        {!embedded && <button onClick={onClose} className="text-gray-500 hover:text-white text-sm underline pb-4">Close</button>}
      </div>
  );

  if (embedded) return inner;
  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Share run" tabIndex={-1} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      {inner}
    </div>
  );
};

// ── Merged Share modal: one entry point, toggle between card styles. ──────────
export const ShareModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [style, setStyle] = useState<'stats' | 'map'>('stats');
  useEscapeKey(onClose, true);
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share run"
    >
      <div className="min-h-full flex flex-col items-center justify-center gap-4 py-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5 p-1.5 bg-[#1a1a1a] rounded-full border border-white/10 shadow-xl">
          {(['stats', 'map'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${style === s ? 'bg-white text-black shadow' : 'text-gray-400 hover:text-white'}`}
            >
              {s === 'stats' ? 'Stats card' : 'Map card'}
            </button>
          ))}
          <SectionGuide id="SHARE" className="px-1" />
        </div>
        {style === 'stats'
          ? <StatsShareCard embedded onClose={onClose} />
          : <RunCardModal embedded onClose={onClose} />}
        <button onClick={onClose} className="text-gray-500 hover:text-white text-sm underline pb-2">Close</button>
      </div>
    </div>
  );
};
