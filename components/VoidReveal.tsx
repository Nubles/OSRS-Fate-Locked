
import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Map, Box, Copy, Shield, BookOpen, Footprints, Zap, Home, Store, Gamepad2, Skull, Package, Dna, ExternalLink, Flag, Check, Loader2 } from 'lucide-react';
import { WIKI_OVERRIDES } from '../constants';

interface VoidRevealProps {
  itemName: string;
  itemType: string;
  itemImage?: string;
  onComplete: () => void;
  isChaos?: boolean;
  animationsEnabled: boolean;
}

type Phase = 'idle' | 'imploding' | 'singularity' | 'roulette' | 'flash' | 'reveal';

const getWikiUrl = (name: string) => {
  if (WIKI_OVERRIDES[name]) {
    return `https://oldschool.runescape.wiki/w/${WIKI_OVERRIDES[name]}`;
  }
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`;
};

const getItemDescription = (type: string, name: string): string => {
    const t = type.toLowerCase();
    
    // New specific checks
    if (name === 'Bedroom (Servant)') return "You may now hire Servants (Demon Butler) to speed up Construction training.";
    if (name === 'Servant\'s Moneybag') return "You may now pay your servant directly from the coffer.";
    if (name === 'Achievement Cape Hanger') return "You may now mount Achievement Capes to utilize their perks.";

    if (t.includes('skill')) return `Training methods unlocked for ${name}. You may train to 99 using unlocked methods.`;
    if (t.includes('equipment')) return "You can now equip items in this slot (up to your unlocked tier).";
    if (t.includes('region') || t.includes('area')) return "Travel restrictions lifted. You may now enter and explore this area.";
    if (t.includes('boss')) return "You are now permitted to challenge this encounter.";
    if (t.includes('minigame')) return "Activity access granted. You may now participate.";
    if (t.includes('mobility')) return "Transportation method unlocked. You may now use this network.";
    if (t.includes('arcana')) return "You have unlocked access to these spells or prayers.";
    if (t.includes('housing')) return "You may now build and utilize this room or feature in your POH.";
    if (t.includes('merchant')) return "You may now trade with these shopkeepers.";
    if (t.includes('storage')) return "You may now utilize this item to store goods.";
    if (t.includes('guild')) return "You may now enter this Guild and use its facilities.";
    if (t.includes('farming')) return "You have unlocked this category of Farming patches.";
    return "Content successfully unlocked.";
};

export const VoidReveal: React.FC<VoidRevealProps> = ({ itemName, itemType, itemImage, onComplete, isChaos = false, animationsEnabled }) => {
  const [phase, setPhase] = useState<Phase>(() => {
      if (!animationsEnabled) return 'reveal';
      return isChaos ? 'roulette' : 'imploding';
  });
  const [imageError, setImageError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rouletteIndex, setRouletteIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const rouletteIcons = [
      { icon: Shield, color: 'text-gray-400' },
      { icon: BookOpen, color: 'text-blue-400' },
      { icon: Map, color: 'text-emerald-400' },
      { icon: Footprints, color: 'text-amber-400' },
      { icon: Zap, color: 'text-violet-400' },
      { icon: Home, color: 'text-orange-400' },
      { icon: Store, color: 'text-yellow-400' },
      { icon: Gamepad2, color: 'text-cyan-400' },
      { icon: Skull, color: 'text-red-400' },
      { icon: Package, color: 'text-amber-600' },
      { icon: Flag, color: 'text-teal-400' },
      { icon: Footprints, color: 'text-blue-300' }
  ];

  useEffect(() => {
    // Focus the container on mount to capture keyboard events (prevent spacebar hitting buttons behind modal)
    if (containerRef.current) {
        containerRef.current.focus();
    }
  }, []);

  // Preload Image during animation
  useEffect(() => {
    if (!itemImage) {
        setImgLoaded(true);
        return;
    }

    let cancelled = false;
    const img = new Image();
    img.src = itemImage;
    img.onload = () => { if (!cancelled) setImgLoaded(true); };
    img.onerror = () => {
        if (!cancelled) {
            setImageError(true);
            setImgLoaded(true);
        }
    };

    return () => { cancelled = true; };
  }, [itemImage]);

  useEffect(() => {
    if (!animationsEnabled) {
        setPhase('reveal');
        return;
    }

    if (isChaos) {
        // CHAOS MODE TIMELINE
        const spinInterval = setInterval(() => {
            setRouletteIndex(prev => (prev + 1) % rouletteIcons.length);
        }, 80);

        const flashTimer = setTimeout(() => {
            clearInterval(spinInterval);
            setPhase('flash');
        }, 2500);

        const revealTimer = setTimeout(() => {
            setPhase('reveal');
        }, 2700);

        return () => {
            clearInterval(spinInterval);
            clearTimeout(flashTimer);
            clearTimeout(revealTimer);
        };
    } else {
        // STANDARD VOID TIMELINE
        const timer1 = setTimeout(() => setPhase('singularity'), 1500); // Start shrinking
        const timer2 = setTimeout(() => setPhase('flash'), 2200);       // White flash
        const timer3 = setTimeout(() => setPhase('reveal'), 2400);      // Show item

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
            clearTimeout(timer3);
        };
    }
  }, [isChaos, animationsEnabled]);

  const handleCopyFlex = () => {
      const text = `🔥 Fate-Locked UIM Update 🔥\nJust unlocked: **${itemName}** (${itemType})!\n#OSRS #FateLocked`;
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  // Determine color theme based on item type
  const getTheme = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('equipment') || t.includes('weapon') || t.includes('gear')) {
      return {
        borderOuter: 'border-amber-500/30',
        borderInner: 'border-yellow-600/50',
        shadow: 'shadow-[0_0_50px_rgba(245,158,11,0.5)]',
        text: 'text-amber-500',
        icon: 'text-amber-400',
        bgGradient: 'from-amber-500/20',
        button: 'bg-amber-500 hover:bg-amber-400',
        particle: 'bg-amber-400',
        hex: '#fbbf24' // Amber-400
      };
    } else if (t.includes('region') || t.includes('area')) {
      return {
        borderOuter: 'border-emerald-500/30',
        borderInner: 'border-green-600/50',
        shadow: 'shadow-[0_0_50px_rgba(16,185,129,0.5)]',
        text: 'text-emerald-500',
        icon: 'text-emerald-400',
        bgGradient: 'from-emerald-500/20',
        button: 'bg-emerald-500 hover:bg-emerald-400',
        particle: 'bg-emerald-400',
        hex: '#34d399' // Emerald-400
      };
    } else if (t.includes('boss') || t.includes('slayer')) {
      return {
        borderOuter: 'border-red-500/30',
        borderInner: 'border-rose-600/50',
        shadow: 'shadow-[0_0_50px_rgba(239,68,68,0.5)]',
        text: 'text-red-500',
        icon: 'text-red-400',
        bgGradient: 'from-red-500/20',
        button: 'bg-red-500 hover:bg-red-400',
        particle: 'bg-red-400',
        hex: '#f87171' // Red-400
      };
    } else if (t.includes('skill')) {
        return {
          borderOuter: 'border-blue-500/30',
          borderInner: 'border-cyan-600/50',
          shadow: 'shadow-[0_0_50px_rgba(59,130,246,0.5)]',
          text: 'text-blue-500',
          icon: 'text-blue-400',
          bgGradient: 'from-blue-500/20',
          button: 'bg-blue-500 hover:bg-blue-400',
          particle: 'bg-blue-400',
          hex: '#60a5fa' // Blue-400
        };
    } else if (t.includes('arcana') || t.includes('magic')) { // Arcana Theme
        return {
          borderOuter: 'border-violet-500/30',
          borderInner: 'border-purple-600/50',
          shadow: 'shadow-[0_0_50px_rgba(139,92,246,0.5)]',
          text: 'text-violet-500',
          icon: 'text-violet-400',
          bgGradient: 'from-violet-500/20',
          button: 'bg-violet-500 hover:bg-violet-400',
          particle: 'bg-violet-400',
          hex: '#8b5cf6' // Violet-500
        };
    } else if (t.includes('housing') || t.includes('poh')) { // Housing Theme (Orange/Brown)
        return {
          borderOuter: 'border-orange-500/30',
          borderInner: 'border-orange-600/50',
          shadow: 'shadow-[0_0_50px_rgba(249,115,22,0.5)]',
          text: 'text-orange-500',
          icon: 'text-orange-400',
          bgGradient: 'from-orange-500/20',
          button: 'bg-orange-500 hover:bg-orange-400',
          particle: 'bg-orange-400',
          hex: '#f97316' // Orange-500
        };
    } else if (t.includes('merchants') || t.includes('shop')) { // Merchants Theme (Yellow/Gold)
        return {
          borderOuter: 'border-yellow-400/30',
          borderInner: 'border-yellow-500/50',
          shadow: 'shadow-[0_0_50px_rgba(250,204,21,0.5)]',
          text: 'text-yellow-400',
          icon: 'text-yellow-300',
          bgGradient: 'from-yellow-400/20',
          button: 'bg-yellow-400 hover:bg-yellow-300',
          particle: 'bg-yellow-300',
          hex: '#facc15' // Yellow-400
        };
    } else if (t.includes('minigame')) {
        return {
          borderOuter: 'border-cyan-400/30',
          borderInner: 'border-cyan-500/50',
          shadow: 'shadow-[0_0_50px_rgba(34,211,238,0.5)]',
          text: 'text-cyan-400',
          icon: 'text-cyan-300',
          bgGradient: 'from-cyan-400/20',
          button: 'bg-cyan-400 hover:bg-cyan-300',
          particle: 'bg-cyan-300',
          hex: '#22d3ee'
        };
    } else if (t.includes('guild')) {
        return {
          borderOuter: 'border-teal-400/30',
          borderInner: 'border-teal-500/50',
          shadow: 'shadow-[0_0_50px_rgba(45,212,191,0.5)]',
          text: 'text-teal-400',
          icon: 'text-teal-300',
          bgGradient: 'from-teal-400/20',
          button: 'bg-teal-400 hover:bg-teal-300',
          particle: 'bg-teal-300',
          hex: '#2dd4bf'
        };
    } else if (t.includes('farming')) {
        return {
          borderOuter: 'border-green-400/30',
          borderInner: 'border-green-500/50',
          shadow: 'shadow-[0_0_50px_rgba(74,222,128,0.5)]',
          text: 'text-green-400',
          icon: 'text-green-300',
          bgGradient: 'from-green-400/20',
          button: 'bg-green-400 hover:bg-green-300',
          particle: 'bg-green-300',
          hex: '#4ade80'
        };
    } else {
      // Default (Purple/Void)
      return {
        borderOuter: 'border-purple-500/30',
        borderInner: 'border-fuchsia-600/50',
        shadow: 'shadow-[0_0_50px_rgba(168,85,247,0.5)]',
        text: 'text-purple-500',
        icon: 'text-purple-400',
        bgGradient: 'from-purple-500/20',
        button: 'bg-purple-500 hover:bg-purple-400',
        particle: 'bg-purple-400',
        hex: '#c084fc' // Purple-400
      };
    }
  };

  const theme = getTheme(itemType);
  const isRegion = itemType.toLowerCase().includes('regions') || itemType.toLowerCase().includes('area');
  const RouletteIcon = rouletteIcons[rouletteIndex].icon;
  const description = getItemDescription(itemType, itemName);

  return (
    <div 
        ref={containerRef}
        tabIndex={-1}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md overflow-y-auto outline-none"
    >
      
      {/* PHASE: CHAOS ROULETTE */}
      {phase === 'roulette' && (
          <div className="relative flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 m-auto">
              {/* Chaotic Background */}
              <div className="absolute w-[800px] h-[800px] bg-red-600/10 rounded-full blur-3xl animate-pulse mix-blend-overlay"></div>
              <div className="absolute inset-0 bg-red-500/5 animate-glitch opacity-20"></div>

              {/* Central Spinner */}
              <div className="relative z-10 w-48 h-48 bg-black/80 rounded-full border-4 border-red-500 shadow-[0_0_60px_rgba(239,68,68,0.6)] flex items-center justify-center overflow-hidden animate-shake">
                  {/* Spinning Ring */}
                  <div className="absolute inset-0 border-t-4 border-r-2 border-red-400/50 rounded-full animate-[spin_0.5s_linear_infinite]"></div>
                  
                  {/* The Icon */}
                  <div className="relative z-10 transform scale-125 transition-all duration-75">
                      <RouletteIcon size={64} className={`${rouletteIcons[rouletteIndex].color} drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]`} />
                  </div>

                  {/* Glitch Overlay on Icon */}
                  <div className="absolute inset-0 bg-white/10 mix-blend-overlay animate-pulse"></div>
              </div>

              {/* Text */}
              <div className="mt-12 text-center relative z-10">
                  <div className="text-red-500 font-black text-4xl tracking-[0.2em] animate-glitch drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">
                      CHAOS ROLL
                  </div>
                  <div className="text-red-300/60 font-mono text-sm tracking-[0.5em] mt-2 animate-pulse">
                      DETERMINING FATE...
                  </div>
              </div>
          </div>
      )}

      {/* PHASE 1 & 2: THE BLACK HOLE (Standard Mode) */}
      {(phase === 'imploding' || phase === 'singularity') && (
        <div className={`relative flex items-center justify-center transition-all duration-700 ease-in-out m-auto ${phase === 'singularity' ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}`}>
          
          {/* Ambient Glow */}
          <div className={`absolute w-[600px] h-[600px] rounded-full bg-gradient-to-r ${theme.bgGradient} blur-[100px] opacity-20 animate-pulse`} />

          {/* Distant Orbit Rings */}
          <div className={`absolute w-[400px] h-[400px] rounded-full border border-dashed ${theme.borderOuter} opacity-10 animate-[spin_20s_linear_infinite]`} />
          <div className={`absolute w-350px] h-[350px] rounded-full border border-dotted ${theme.borderOuter} opacity-20 animate-[spin_15s_linear_infinite_reverse]`} />

          {/* Main Accretion Disk (Blurry Outer Ring) */}
          <div className={`absolute w-72 h-72 rounded-full border-4 ${theme.borderOuter} blur-md animate-void-spin opacity-50`} />
          <div className={`absolute w-64 h-64 rounded-full border-2 ${theme.borderOuter} animate-[spin_4s_linear_infinite] opacity-40`} />

          {/* Inner Energy Stream (Sharp, Fast) */}
          <div className={`absolute w-52 h-52 rounded-full border-t-4 border-r-2 border-l-0 border-b-0 ${theme.borderInner} animate-[spin_1.5s_linear_infinite] opacity-80`} />
          <div className={`absolute w-48 h-48 rounded-full border-b-4 border-l-2 border-r-0 border-t-0 ${theme.borderInner} animate-[spin_2s_linear_infinite_reverse] opacity-70`} />

          {/* The Void / Event Horizon */}
          <div className={`relative w-40 h-40 bg-black rounded-full ${theme.shadow} flex items-center justify-center overflow-hidden z-10 ${phase === 'singularity' ? 'animate-shake' : ''}`}>
             
             {/* Swirling Interior (Conic Gradient) */}
             <div 
               className="absolute inset-[-50%] opacity-30 animate-[spin_3s_linear_infinite]"
               style={{ background: `conic-gradient(from 0deg, transparent 0%, ${theme.hex} 100%)` }}
             />
             
             {/* The Singularity (Pure Black Center) */}
             <div className="absolute inset-2 bg-black rounded-full z-20 flex items-center justify-center">
                {/* Inner Pulse */}
                <div className={`w-full h-full rounded-full bg-gradient-to-tr ${theme.bgGradient} opacity-30 animate-pulse`} />
             </div>
          </div>
          
          {/* Infalling Particles */}
          <div className="absolute inset-0 pointer-events-none">
             {[...Array(6)].map((_, i) => (
                <div 
                   key={i}
                   className={`absolute left-1/2 top-1/2 w-1 h-1 rounded-full ${theme.particle} animate-ping opacity-0`}
                   style={{ 
                       transform: `rotate(${i * 60}deg) translate(120px)`,
                       animationDuration: `${1 + Math.random()}s`,
                       animationDelay: `${Math.random() * 0.5}s`
                   }}
                />
             ))}
          </div>

          {/* Text */}
          <div className={`absolute top-60 ${theme.text} text-xs tracking-[0.5em] opacity-80 animate-pulse font-bold uppercase drop-shadow-md text-center`}>
            Altering Fate...
          </div>
        </div>
      )}

      {/* PHASE 3: THE FLASH */}
      {phase === 'flash' && (
        <div className={`absolute inset-0 ${isChaos ? 'bg-red-500/40' : 'bg-white/25'} animate-flash z-[110]`} />
      )}

      {/* PHASE 4: THE REVEAL */}
      {phase === 'reveal' && (
        <div className={`relative z-[120] flex flex-col items-center ${animationsEnabled ? 'animate-float-up' : ''} m-auto p-4`}>
          
          {/* God Rays Background */}
          {animationsEnabled && (
              <div className={`absolute -z-10 w-[600px] h-[600px] bg-gradient-to-t ${theme.bgGradient} to-transparent rounded-full blur-3xl animate-pulse`} />
          )}
          
          {/* The Card */}
          <div className={`relative bg-gradient-to-b from-gray-900 to-black border-2 border-gray-700 p-8 rounded-xl shadow-2xl text-center transition-all duration-300 ${isRegion ? 'max-w-6xl w-auto min-w-[340px]' : 'min-w-[340px] max-w-md'}`}>
            {/* Rarity Star */}
            <div className={`absolute -top-6 left-1/2 -translate-x-1/2 bg-black border-2 ${theme.borderInner} p-3 rounded-full shadow-lg`}>
              {isChaos ? (
                  <Dna className={`w-8 h-8 text-red-500 fill-current ${animationsEnabled ? 'animate-pulse' : ''}`} />
              ) : (
                  <Sparkles className={`w-8 h-8 ${theme.icon} fill-current ${animationsEnabled ? 'animate-pulse' : ''}`} />
              )}
            </div>

            <div className="mt-6 space-y-2">
              <h3 className={`${theme.text} text-sm font-bold uppercase tracking-widest drop-shadow-sm`}>
                  {isChaos ? 'CHAOS UNLOCK' : `${itemType} UNLOCKED`}
              </h3>
              
              {itemImage && !imageError ? (
                 <div className="flex justify-center my-6 relative min-h-[6rem] items-center">
                    {animationsEnabled && (
                        <div className={`absolute inset-0 bg-gradient-to-t ${theme.bgGradient} blur-xl opacity-50 animate-pulse`}></div>
                    )}
                    
                    {!imgLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center z-20">
                            <Loader2 className={`w-8 h-8 animate-spin ${theme.text}`} />
                        </div>
                    )}

                    <img 
                        src={itemImage} 
                        alt={itemName} 
                        className={`${isRegion ? 'w-auto h-auto max-h-[70vh] max-w-full rounded-lg border border-white/10 shadow-2xl' : 'w-24 h-24'} object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] relative z-10 transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                        onError={() => {
                            setImageError(true);
                            setImgLoaded(true); // Ensure spinner stops even on error
                        }}
                    />
                 </div>
              ) : (
                // Fallback Icon if Image Missing or Error
                <div className="flex justify-center my-6 relative">
                    <div className={`w-24 h-24 rounded-full bg-gradient-to-br ${theme.bgGradient} flex items-center justify-center border border-white/10 shadow-inner`}>
                       {isRegion ? <Map className={`w-12 h-12 ${theme.icon}`} /> : <Box className={`w-12 h-12 ${theme.icon}`} />}
                    </div>
                </div>
              )}
              
              <h2 className="text-3xl font-black text-white drop-shadow-md break-words leading-tight">{itemName}</h2>
              <p className="text-gray-400 text-xs italic mt-2 px-4 leading-relaxed border-t border-white/5 pt-2">{description}</p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-700 flex flex-col gap-3">
               <button 
                 onClick={onComplete}
                 className={`w-full px-8 py-3 ${theme.button} text-black font-black text-sm uppercase tracking-wider rounded shadow-lg transition-transform hover:scale-105 active:scale-95`}
               >
                 Accept Destiny
               </button>
               
               <div className="flex gap-2 justify-center w-full">
                   <button 
                       onClick={handleCopyFlex}
                       className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white transition-colors py-2 px-4 rounded hover:bg-white/5"
                   >
                       {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                       {copied ? 'Copied!' : 'Share Flex'}
                   </button>

                   <a 
                       href={getWikiUrl(itemName)}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="flex items-center justify-center gap-2 text-xs text-gray-500 hover:text-white transition-colors py-2 px-4 rounded hover:bg-white/5"
                   >
                       <ExternalLink size={14} />
                       Wiki
                   </a>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
