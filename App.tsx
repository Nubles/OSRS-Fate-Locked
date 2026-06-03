
import React, { useState, useRef, useEffect, Component, ErrorInfo, ReactNode, lazy, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { GameProvider, useGame } from './context/GameContext';
import { usePortalHost } from './hooks/usePortalHost';
import { ProfileProvider, useProfiles } from './context/ProfileContext';
import { ActionSection } from './components/ActionSection';
import { GachaSection } from './components/GachaSection';
import { Dashboard } from './components/Dashboard';
import { LogViewer } from './components/LogViewer';
import { SectionGuide, GUIDES } from './components/SectionGuide';
import { PopOnChange } from './components/PopOnChange';
import { CommandPalette } from './components/CommandPalette';
import { VoidAltar } from './components/VoidAltar';
import { TransmutationEffect } from './components/TransmutationEffect';
import { ClarityEffect, GreedEffect, ChaosEffect } from './components/RitualEffects';
import { EffectsLayer } from './components/EffectsLayer';
import { OnboardingWizard } from './components/OnboardingWizard';
import { ProfileSwitcher } from './components/ProfileSwitcher';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { ModalFallback } from './components/LoadingFallback';
import { JournalSummaryCard } from './components/JournalSummaryCard';
import { useEscapeKey } from './hooks/useEscapeKey';
import { resolveModeRules } from './config/gameModes';

// Heavy, conditionally-rendered modals — code-split so they (and their deps,
// e.g. recharts in StatsModal) stay out of the initial bundle.
const StatsModal = lazy(() => import('./components/StatsModal').then(m => ({ default: m.StatsModal })));
const ReferenceModal = lazy(() => import('./components/ReferenceModal').then(m => ({ default: m.ReferenceModal })));
const OracleSearch = lazy(() => import('./components/OracleSearch').then(m => ({ default: m.OracleSearch })));
const StrategyGuide = lazy(() => import('./components/StrategyGuide').then(m => ({ default: m.StrategyGuide })));
const SupplyChainCalculator = lazy(() => import('./components/SupplyChainCalculator').then(m => ({ default: m.SupplyChainCalculator })));
const GameModePicker = lazy(() => import('./components/GameModePicker').then(m => ({ default: m.GameModePicker })));
const SyncCodeModal = lazy(() => import('./components/SyncCodeModal').then(m => ({ default: m.SyncCodeModal })));
import { obfuscateFateSave, deobfuscateFateSave } from './utils/encryption';
import { GameState } from './types';
import { Key, Sparkles, Download, Upload, RotateCcw, BarChart3, HelpCircle, Dna, PlayCircle, PauseCircle, Search, Swords, ShoppingBag, ScrollText, Compass, Database, SlidersHorizontal, Link2 } from 'lucide-react';

// --- Error Boundary ---
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#161616] flex items-center justify-center p-8">
          <div className="bg-[#1e1e1e] border border-red-500/30 rounded-xl p-8 max-w-lg text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-gray-400 mb-4">
              The application encountered an error. Your save data is preserved in localStorage.
            </p>
            <pre className="text-xs text-red-300/70 bg-black/30 rounded p-3 mb-6 text-left overflow-auto max-h-32">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Toast Component ---
const ToastNotification = () => {
  const { lastEvent } = useGame();
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!lastEvent) return;

    const undoableTypes = [
      'ROLL_SUCCESS', 'ROLL_FAIL', 'ROLL_OMNI', 'ROLL_PITY',
      'UNLOCK', 'RITUAL', 'LEVEL_UP'
    ];

    if (undoableTypes.includes(lastEvent.type)) {
      let msg = 'Action Complete';
      if (lastEvent.type.includes('ROLL')) msg = 'Roll Recorded';
      if (lastEvent.type === 'UNLOCK') msg = 'Content Unlocked';
      if (lastEvent.type === 'RITUAL') msg = 'Ritual Performed';
      if (lastEvent.type === 'LEVEL_UP') {
          // Check for Chaos Key award in metadata
          if (lastEvent.meta && 'chaosKeyAwarded' in lastEvent.meta && lastEvent.meta.chaosKeyAwarded) {
              msg = 'Level Up + Chaos Key!';
          } else {
              msg = 'Level Up';
          }
      }

      setMessage(msg);
      setVisible(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setVisible(false), 5000);
    }
  }, [lastEvent]);

  const host = usePortalHost('reveal-bottom');

  if (!visible || !host) return null;

  return createPortal(
    <div className="pointer-events-auto bg-[#222] border border-white/20 shadow-2xl rounded-lg p-3 flex items-center gap-4 animate-in slide-in-from-bottom-5 fade-in duration-300">
       <span className="text-sm font-bold text-gray-200">{message}</span>
    </div>,
    host,
  );
};

interface HeaderProps {
  setShowAltar: (show: boolean) => void;
  setShowStats: (show: boolean) => void;
  setShowReference: (show: boolean) => void;
  setShowOracle: (show: boolean) => void;
  setShowStrategy: (show: boolean) => void;
  setShowSupplyChain: (show: boolean) => void;
  setShowGameMode: (show: boolean) => void;
  setShowSyncCode: (show: boolean) => void;
}

const Header = ({ setShowAltar, setShowStats, setShowReference, setShowOracle, setShowStrategy, setShowSupplyChain, setShowGameMode, setShowSyncCode }: HeaderProps) => {
  const { keys, specialKeys, chaosKeys, fatePoints, activeBuff, animationsEnabled, toggleAnimations, importSave, resetGame, getExportData, createBackup, gameModeId, customMode } = useGame();
  const pityRules = resolveModeRules(gameModeId, customMode);
  const pityCap = pityRules.pityEnabled ? pityRules.pityThreshold : 50; // 50 = visual-only fallback
  const nearPity = pityRules.pityEnabled && fatePoints >= pityRules.pityThreshold * 0.8;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result as string;
        const imported = deobfuscateFateSave(fileContent);

        if (imported) {
            createBackup('Before file import');
            importSave(imported as Partial<GameState>);
            alert("Fate restored successfully.");
        } else {
            alert("Failed to read the ancient texts. (Invalid save file)");
        }
      } catch (err) {
          alert("Failed to import save data.");
          console.error(err);
      }
    };
    reader.onerror = () => {
      alert("Failed to read the file.");
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleExport = () => {
      const rawData = getExportData();
      if (!rawData) return;

      try {
          const jsonData = JSON.parse(rawData);
          const obfuscatedData = obfuscateFateSave(jsonData);

          const blob = new Blob([obfuscatedData], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `fate_locked_${Date.now()}.fate`;
          a.click();
          URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Export failed", e);
          alert("Failed to export fate data.");
      }
  };

  return (
      <header className="bg-[#1e1e1e] border-b border-white/10 sticky top-0 z-50 shadow-xl backdrop-blur-md bg-opacity-95">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex flex-col xl:flex-row items-center justify-between gap-4">

          {/* Logo Section */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-900 rounded-lg flex items-center justify-center border border-amber-500/50 shadow-inner">
              <span className="text-2xl drop-shadow-md">🗝️</span>
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-100 tracking-tight uppercase leading-none">Fate Locked Ironman</h1>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5 tracking-wide">RNG EDITION COMMAND CENTER</p>
            </div>
            <ProfileSwitcher />
          </div>

          {/* Resources Bar */}
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6 bg-black/20 p-1.5 pr-4 rounded-xl border border-white/5 w-full xl:w-auto shadow-inner">
            <div className="w-full md:w-48 lg:w-64 px-2">
               <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
                  <span className={nearPity ? "text-red-400 animate-pulse" : "text-gray-500"}>Fate Points</span>
                  <span className="text-gray-400">{pityRules.pityEnabled ? `${fatePoints}/${pityRules.pityThreshold}` : `${fatePoints} Fate`}</span>
               </div>
               <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/10 relative">
                 <div className={`relative h-full overflow-hidden transition-all duration-500 ${animationsEnabled ? 'progress-sheen' : ''} ${nearPity ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-amber-600'}`} style={{ width: `${Math.min(100, (fatePoints / pityCap) * 100)}%` }} />
                      </div>
            </div>
            <div className="hidden md:block w-px h-8 bg-white/5"></div>
            <div className="flex items-center gap-3 justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg min-w-[60px] justify-center">
                   <Key className="w-4 h-4 text-amber-400" />
                   <span className="font-bold text-amber-100 text-lg leading-none"><PopOnChange value={keys} /></span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors min-w-[60px] justify-center ${specialKeys > 0 ? 'bg-purple-500/20 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/10 opacity-50'}`}>
                   <Sparkles className={`w-4 h-4 ${specialKeys > 0 ? 'text-purple-400 animate-pulse' : 'text-gray-500'}`} />
                   <span className={`font-bold text-lg leading-none ${specialKeys > 0 ? 'text-purple-200' : 'text-gray-500'}`}><PopOnChange value={specialKeys} /></span>
                </div>
                {chaosKeys > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-lg animate-in fade-in slide-in-from-right-4 min-w-[60px] justify-center">
                     <Dna className="w-4 h-4 text-red-400 animate-pulse" />
                     <span className="font-bold text-red-100 text-lg leading-none"><PopOnChange value={chaosKeys} /></span>
                  </div>
                )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
             {/* Accept .fate files and legacy .json files */}
             <input type="file" ref={fileInputRef} className="hidden" accept=".json,.fate" onChange={handleFileChange} />

             <button
                onClick={() => setShowAltar(true)}
                className={`h-8 group px-3 rounded-lg border font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg ${activeBuff !== 'NONE' ? activeBuff === 'GREED' ? 'bg-amber-900/40 border-amber-500 text-amber-300' : 'bg-blue-900/40 border-blue-500 text-blue-300' : 'bg-[#252525] border-purple-500/30 text-purple-300 hover:bg-purple-900/20'}`}
             >
                <span className={`w-1.5 h-1.5 rounded-full ${activeBuff !== 'NONE' ? (activeBuff === 'GREED' ? 'bg-amber-400 animate-bounce' : 'bg-blue-400 animate-pulse') : 'bg-purple-500'}`}></span>
                <span>{activeBuff === 'NONE' ? 'Altar' : activeBuff}</span>
             </button>

             <button
               onClick={() => window.dispatchEvent(new CustomEvent('fate:open-palette'))}
               className="h-8 px-2.5 rounded-lg border border-white/10 bg-[#252525] hover:bg-white/5 hover:border-white/20 text-gray-400 hover:text-white flex items-center gap-2 transition-colors group"
               title="Command palette — jump to anything"
             >
                <Search size={13} />
                <span className="text-[11px] font-medium hidden sm:inline">Jump to…</span>
                <kbd className="text-[9px] font-mono text-gray-500 border border-white/15 rounded px-1 py-0.5 hidden sm:inline group-hover:border-white/25">⌘K</kbd>
             </button>

             <div className="flex items-center bg-[#252525] border border-white/10 rounded-lg p-0.5 gap-0.5 h-8">
                 <button onClick={() => setShowOracle(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors" title="Oracle — search content"><Search size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowStrategy(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:bg-white/5 rounded transition-colors" title="Strategy Guide"><Compass size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowSupplyChain(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-colors" title="Resource Engine"><Database size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowStats(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded transition-colors" title="Stats"><BarChart3 size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowReference(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-yellow-400 hover:bg-white/5 rounded transition-colors" title="Rules"><HelpCircle size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowGameMode(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded transition-colors" title="Game Mode"><SlidersHorizontal size={14} /></button>
             </div>

             <div className="flex items-center bg-[#252525] border border-white/10 rounded-lg p-0.5 gap-0.5 h-8">
                 <button onClick={toggleAnimations} className={`w-7 h-full flex items-center justify-center rounded transition-colors ${animationsEnabled ? 'text-green-400' : 'text-gray-500'}`} title="Animations">
                    {animationsEnabled ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                 </button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => fileInputRef.current?.click()} className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 rounded" title="Import Save"><Upload size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={handleExport} className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/5 rounded" title="Export Encrypted Save"><Download size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowSyncCode(true)} className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-cyan-400 hover:bg-white/5 rounded" title="Sync Code (move run between devices)"><Link2 size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => { if(window.confirm("Are you sure you want to reset ALL progress? This cannot be undone.")) resetGame(); }} className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-white/5 rounded" title="Reset"><RotateCcw size={14} /></button>
             </div>
          </div>
        </div>
      </header>
  );
};

// --- New Control Panel Component ---
const ControlPanel = () => {
  const [activeTab, setActiveTab] = useState<'FARM' | 'SPEND' | 'LOG'>('FARM');

  // Command-palette navigation to a control tab.
  useEffect(() => {
    const onNav = (e: Event) => {
      const target = (e as CustomEvent<{ target?: string }>).detail?.target ?? '';
      if (target.startsWith('ctrl:')) setActiveTab(target.slice(5) as 'FARM' | 'SPEND' | 'LOG');
    };
    window.addEventListener('fate:nav', onNav);
    return () => window.removeEventListener('fate:nav', onNav);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#1b1b1b] border border-[#333] rounded-lg overflow-hidden shadow-xl">
      {/* Tabs */}
      <div className="flex border-b border-[#333] bg-[#161616] shrink-0">
        <button
          onClick={() => setActiveTab('FARM')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'FARM' ? 'bg-[#252525] text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
        >
          <Swords size={14} /> Farm Keys
        </button>
        <button
          onClick={() => setActiveTab('SPEND')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'SPEND' ? 'bg-[#252525] text-osrs-gold border-b-2 border-osrs-gold' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
        >
          <ShoppingBag size={14} /> Spend Keys
        </button>
        <button
          onClick={() => setActiveTab('LOG')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'LOG' ? 'bg-[#252525] text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
        >
          <ScrollText size={14} /> History
        </button>
      </div>

      {/* Contextual guide for the active panel */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-1 bg-[#141414] border-b border-[#2a2a2a] shrink-0 text-[10px] text-gray-500">
        <span>{GUIDES[activeTab]?.title}</span>
        <SectionGuide id={activeTab} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
        <div className={activeTab === 'FARM' ? 'block' : 'hidden'}>
           <ActionSection />
        </div>
        <div className={activeTab === 'SPEND' ? 'block' : 'hidden'}>
           <GachaSection />
        </div>
        <div className={activeTab === 'LOG' ? 'block h-full' : 'hidden'}>
           <LogViewer />
        </div>
      </div>
    </div>
  );
};

const GameLayout = () => {
  const { lastEvent, animationsEnabled, hasSeenOnboarding, history } = useGame();
  const { recentlyCreatedId, activeProfileId, clearRecentlyCreated } = useProfiles();

  // UI States
  const [showStats, setShowStats] = useState(false);
  const [showReference, setShowReference] = useState(false);
  const [showAltar, setShowAltar] = useState(false);
  const [showOracle, setShowOracle] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showSupplyChain, setShowSupplyChain] = useState(false);
  const [supplyChainPreset, setSupplyChainPreset] = useState<string | undefined>(undefined);

  // Cross-component shortcut: any child can dispatch `open-resource-engine`
  // with `{ detail: { item: 'Vorkath' } }` to open the modal pre-populated.
  // Used by the GoalTracker's Closest-unlocks chips so the dashboard can deep-
  // link into the engine without prop-drilling a callback through every layer.
  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ item?: string }>).detail;
      setSupplyChainPreset(detail?.item);
      setShowSupplyChain(true);
    };
    window.addEventListener('open-resource-engine', onOpen);
    return () => window.removeEventListener('open-resource-engine', onOpen);
  }, []);

  // Command-palette navigation: open the modals this layout owns.
  React.useEffect(() => {
    const onNav = (e: Event) => {
      const target = (e as CustomEvent<{ target?: string }>).detail?.target ?? '';
      const map: Record<string, (v: boolean) => void> = {
        'open:altar': setShowAltar,
        'open:stats': setShowStats,
        'open:reference': setShowReference,
        'open:oracle': setShowOracle,
        'open:strategy': setShowStrategy,
        'open:supply': setShowSupplyChain,
        'open:gamemode': setShowGameMode,
        'open:sync': setShowSyncCode,
      };
      map[target]?.(true);
    };
    window.addEventListener('fate:nav', onNav);
    return () => window.removeEventListener('fate:nav', onNav);
  }, []);
  const [showGameMode, setShowGameMode] = useState(false);
  const [showSyncCode, setShowSyncCode] = useState(false);
  const [syncImportCode, setSyncImportCode] = useState<string | undefined>(undefined);
  const [activeRitualAnim, setActiveRitualAnim] = useState<'NONE' | 'LUCK' | 'GREED' | 'CHAOS' | 'TRANSMUTE'>('NONE');

  // Deep link: a `#sync=<code>` fragment (from a shared link or scanned QR)
  // opens the Sync Code modal pre-filled on the Import tab, then clears the
  // hash so a refresh doesn't re-trigger it and the URL stays tidy.
  useEffect(() => {
    const hash = window.location.hash;
    const marker = '#sync=';
    if (hash.startsWith(marker)) {
      const code = hash.slice(marker.length);
      if (code) {
        setSyncImportCode(code);
        setShowSyncCode(true);
      }
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }, []);

  // Watch for ritual events to trigger animations
  React.useEffect(() => {
    if (lastEvent?.type === 'RITUAL' && animationsEnabled) {
       setActiveRitualAnim((lastEvent.meta as any).type);
    }
  }, [lastEvent, animationsEnabled]);

  // Ctrl/⌘+K now opens the command palette (which can jump to the Oracle and
  // everything else); the CommandPalette component owns that key handler.

  // A freshly-created profile prompts the player to choose a game mode while
  // the run is still empty (and the mode therefore still unlocked).
  useEffect(() => {
    if (recentlyCreatedId && recentlyCreatedId === activeProfileId) {
      setShowGameMode(true);
      clearRecentlyCreated();
    }
  }, [recentlyCreatedId, activeProfileId, clearRecentlyCreated]);

  // The first profile is created implicitly, so new players reach the game via
  // the onboarding wizard rather than `createProfile`. Catch that finish-line:
  // when onboarding flips to complete on a still-empty run, prompt the mode pick.
  const prevOnboarded = useRef(hasSeenOnboarding);
  useEffect(() => {
    if (!prevOnboarded.current && hasSeenOnboarding && history.length === 0) {
      setShowGameMode(true);
    }
    prevOnboarded.current = hasSeenOnboarding;
  }, [hasSeenOnboarding, history.length]);

  // Escape closes whichever top-level modal is open.
  const anyModalOpen = showStats || showReference || showAltar
    || showOracle || showStrategy || showSupplyChain || showGameMode || showSyncCode;
  useEscapeKey(() => {
    setShowStats(false);
    setShowReference(false);
    setShowAltar(false);
    setShowOracle(false);
    setShowStrategy(false);
    setShowSupplyChain(false);
    setShowGameMode(false);
    setShowSyncCode(false);
  }, anyModalOpen);

  return (
    <div className="min-h-screen bg-osrs-bg text-osrs-text pb-6 font-sans selection:bg-osrs-gold selection:text-black relative">
      <EffectsLayer />

      {/* Shared notification stacks: every toast/reveal portals into one of
          these so they queue cleanly instead of overlapping in a corner. */}
      <div id="reveal-top" className="fixed top-24 right-5 z-[9998] flex flex-col gap-3 items-end pointer-events-none" />
      <div id="reveal-bottom" className="fixed bottom-5 right-5 z-[9997] flex flex-col-reverse gap-3 items-end pointer-events-none" />
      <ToastNotification />

      {!hasSeenOnboarding && <OnboardingWizard />}

      {activeRitualAnim === 'TRANSMUTE' && <TransmutationEffect onComplete={() => setActiveRitualAnim('NONE')} />}
      {activeRitualAnim === 'LUCK' && <ClarityEffect onComplete={() => setActiveRitualAnim('NONE')} />}
      {activeRitualAnim === 'GREED' && <GreedEffect onComplete={() => setActiveRitualAnim('NONE')} />}
      {activeRitualAnim === 'CHAOS' && <ChaosEffect onComplete={() => setActiveRitualAnim('NONE')} />}

      {showAltar && <VoidAltar onClose={() => setShowAltar(false)} />}
      <Suspense fallback={<ModalFallback />}>
        {showStats && <StatsModal onClose={() => setShowStats(false)} />}
        {showReference && <ReferenceModal onClose={() => setShowReference(false)} />}
        {showOracle && <OracleSearch onClose={() => setShowOracle(false)} />}
        {showStrategy && <StrategyGuide onClose={() => setShowStrategy(false)} />}
        {showSupplyChain && <SupplyChainCalculator initialQuery={supplyChainPreset} onClose={() => { setShowSupplyChain(false); setSupplyChainPreset(undefined); }} />}
        {showGameMode && <GameModePicker onClose={() => setShowGameMode(false)} />}
        {showSyncCode && <SyncCodeModal onClose={() => { setShowSyncCode(false); setSyncImportCode(undefined); }} initialImportCode={syncImportCode} />}
      </Suspense>

      <Header
        setShowAltar={setShowAltar}
        setShowStats={setShowStats}
        setShowReference={setShowReference}
        setShowOracle={setShowOracle}
        setShowStrategy={setShowStrategy}
        setShowSupplyChain={setShowSupplyChain}
        setShowGameMode={setShowGameMode}
        setShowSyncCode={setShowSyncCode}
      />

      {/* Global ⌘K command palette — navigates via fate:nav events. */}
      <CommandPalette />

      {/* Main Command Center Layout */}
      <main className="max-w-[1600px] mx-auto px-4 py-4 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">

          {/* LEFT: Journal summary + Interaction & Control (35%).
              The journal summary lives here (rather than inside a Dashboard tab)
              so it stays visible across every tab switch. Clicking a row fires a
              `navigate-journal` event the Dashboard listens for. */}
          <div className="lg:col-span-4 h-full min-h-[500px] flex flex-col gap-4">
            <div className="shrink-0">
              <PanelErrorBoundary name="Journal summary">
                <JournalSummaryCard
                  onNavClick={(tab) =>
                    window.dispatchEvent(new CustomEvent('navigate-journal', { detail: { tab } }))
                  }
                />
              </PanelErrorBoundary>
            </div>
            <div className="flex-1 min-h-0">
              <PanelErrorBoundary name="Control panel">
                <ControlPanel />
              </PanelErrorBoundary>
            </div>
          </div>

          {/* RIGHT: Dashboard Visualization (65%) */}
          <div className="lg:col-span-8 h-full min-h-[500px] flex flex-col gap-4">
             <div className="flex-1 overflow-hidden h-full">
               <PanelErrorBoundary name="Dashboard">
                 <Dashboard />
               </PanelErrorBoundary>
             </div>
          </div>

        </div>
      </main>
    </div>
  );
};

/** Bridge reads profile context and passes storageKey to GameProvider.
 *  key={activeProfileId} forces a clean remount when switching profiles. */
const GameProviderBridge: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeProfileId, storageKeyForActiveProfile } = useProfiles();
  return (
    <GameProvider key={activeProfileId} storageKey={storageKeyForActiveProfile}>
      {children}
    </GameProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ProfileProvider>
        <GameProviderBridge>
          <GameLayout />
        </GameProviderBridge>
      </ProfileProvider>
    </ErrorBoundary>
  );
}

export default App;
