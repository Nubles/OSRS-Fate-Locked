
import { lazyWithRetry } from './utils/lazyRetry';
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useReducer, Component, ErrorInfo, ReactNode, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { GameProvider, useGame } from './context/GameContext';
import { usePortalHost } from './hooks/usePortalHost';
import { ProfileProvider, useProfiles } from './context/ProfileContext';
import { ActionSection } from './components/ActionSection';
import { GachaSection } from './components/GachaSection';
import { Dashboard } from './components/Dashboard';
const LogViewer = lazyWithRetry(() => import('./components/LogViewer').then(m => ({ default: m.LogViewer })));
// Re-checks the Roll Inbox's saved rows in the background, so its rules load after the first paint.
const RollInboxDriver = lazyWithRetry(() => import('./components/RollInboxDriver'));
// The claimed pet that follows the player, with Your Pets; it loads once the run has a pet.
const PetFollower = lazyWithRetry(() => import('./components/PetFollower'));
import { SectionGuide, GUIDES } from './components/SectionGuide';
import { PopOnChange } from './components/PopOnChange';
import { WikiIcon } from './components/WikiIcon';
import { EffectsLayer } from './components/EffectsLayer';
import { OnlineSyncDriver } from './components/OnlineSyncDriver';
import { canDismissRunelitePairing, type RunelitePairingPhase } from './components/runelitePairingPhase';
import { CoachStrip } from './components/CoachStrip';
import { FeatureRevealDriver } from './components/FeatureRevealDriver';
import { SaveConflictBanner } from './components/SaveConflictBanner';
import { SaveFailureBanner } from './components/SaveFailureBanner';
import { effectiveSaveDurability, SaveDurabilityStatus } from './components/SaveDurabilityStatus';
import { ProfileRecoveryBanner } from './components/ProfileRecoveryBanner';
import { SaveRecoveryGuard } from './components/SaveRecoveryGuard';
import { SaveBootstrap } from './components/SaveBootstrap';
import { DiscordSyncDriver } from './components/DiscordSyncDriver';
import { downloadFateSave, FATE_EXPORT_DONE_MESSAGE, FATE_EXPORT_HINT } from './utils/fateSaveFile';
import { RESET_CONFIRM_MESSAGE } from './utils/backups';
import { isOwnershipConflictBlock } from './utils/profileWriterLease';
import { useFeatureGates } from './hooks/useFeatureGates';
import { flashElement } from './utils/flash';
import { ProfileSwitcher } from './components/ProfileSwitcher';
import { PanelErrorBoundary } from './components/PanelErrorBoundary';
import { UpdateBanner } from './components/UpdateBanner';
import { ModalFallback } from './components/LoadingFallback';
import { JournalSummaryCard } from './components/JournalSummaryCard';
import { isChunkLoadError, reloadIfNewBuild } from './utils/chunkLoadError';
import { reportError } from './utils/errorBeacon';
import { useEscapeKey } from './hooks/useEscapeKey';
import { resolveModeRules } from './config/gameModes';
import { CHUNKED_OMNI_LAND_TEXT, RITUALS, type Ritual } from './config/economy';
import { showToast } from './utils/toast';
import { importUiDecision, isCurrentImportRequest } from './utils/gamePersistence';
import { prefetchHeavyChunks } from './utils/prefetch';
import { LATEST_CHANGELOG_ID } from './data/changelogLatest';
import type { FateCompensationChoice, PetCompensationChoice } from './types';
import { earlierPetRollTimes, gambitStakeFor } from './utils/petCompensation';
import {
  changelogVisibilityReducer, markChangelogSeen, mayAutoOpenChangelogAgain,
  resolveChangelogModalRenderPolicy, shouldAutoOpenChangelog,
  shouldEnableUnderlyingModalEscape, shouldShowChangelog,
} from './utils/changelogState';
import { relaySync } from './services/relaySync';
import { parseRunelitePairFragment } from './utils/runelitePairing';
import {
  hasRuneliteGuideQuery,
  removeRuneliteGuideQuery,
} from './utils/runeliteGuideState';

// Heavy, conditionally-rendered modals — code-split so they (and their deps,
// e.g. recharts in StatsModal) stay out of the initial bundle.
const StatsModal = lazyWithRetry(() => import('./components/StatsModal').then(m => ({ default: m.StatsModal })));
const FateThread = lazyWithRetry(() => import('./components/FateThread').then(m => ({ default: m.FateThread })));
const ReferenceModal = lazyWithRetry(() => import('./components/ReferenceModal').then(m => ({ default: m.ReferenceModal })));
const RunelitePairingDialog = lazyWithRetry(() => import('./components/RunelitePairingDialog').then(m => ({ default: m.RunelitePairingDialog })));
const OracleSearch = lazyWithRetry(() => import('./components/OracleSearch').then(m => ({ default: m.OracleSearch })));
const StrategyGuide = lazyWithRetry(() => import('./components/StrategyGuide').then(m => ({ default: m.StrategyGuide })));
const SupplyChainCalculator = lazyWithRetry(() => import('./components/SupplyChainCalculator').then(m => ({ default: m.SupplyChainCalculator })));
const GameModePicker = lazyWithRetry(() => import('./components/GameModePicker').then(m => ({ default: m.GameModePicker })));
const SyncCodeModal = lazyWithRetry(() => import('./components/SyncCodeModal').then(m => ({ default: m.SyncCodeModal })));
const OnlineBackupDriver = lazyWithRetry(() => import('./components/OnlineBackupDriver').then(m => ({ default: m.OnlineBackupDriver })));
const OffDeviceCopyStatus = lazyWithRetry(() => import('./components/OffDeviceCopyStatus').then(m => ({ default: m.OffDeviceCopyStatus })));
const PersistentStorageDriver = lazyWithRetry(() => import('./components/PersistentStorageDriver').then(m => ({ default: m.PersistentStorageDriver })));
const ProgressShareDriver = lazyWithRetry(() => import('./components/ProgressShareDriver').then(m => ({ default: m.ProgressShareDriver })));
const OnlineBackupPrompt = lazyWithRetry(() => import('./components/OnlineBackupPrompt').then(m => ({ default: m.OnlineBackupPrompt })));
const BackupNagBanner = lazyWithRetry(() => import('./components/BackupNagBanner').then(m => ({ default: m.BackupNagBanner })));
const RelayPublishBanner = lazyWithRetry(() => import('./components/RelayPublishBanner'));
const ModelGallery = lazyWithRetry(() => import('./components/ModelGallery').then(m => ({ default: m.ModelGallery })));
const DiscordSettingsModal = lazyWithRetry(() => import('./components/DiscordSettingsModal'));
// The release notes load with the modal; only the latest release's id is
// needed up front, to decide whether What's New opens.
const ChangelogModal = lazyWithRetry(() =>
  Promise.all([import('./components/ChangelogModal'), import('./data/changelog')])
    .then(([module, changelog]) => ({
      default: (props: Omit<React.ComponentProps<typeof module.ChangelogModal>, 'releases'>) => (
        <module.ChangelogModal {...props} releases={changelog.CHANGELOG_RELEASES} />
      ),
    })),
);
// Shown only on demand (onboarding, rituals, the altar) or mounted as idle
// listeners (palette, tour, quest celebration), so they stay out of the entry
// chunk.
const OnboardingWizard = lazyWithRetry(() => import('./components/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
const VoidAltar = lazyWithRetry(() => import('./components/VoidAltar').then(m => ({ default: m.VoidAltar })));
const RitualAnimation = lazyWithRetry(() => import('./components/RitualAnimation').then(m => ({ default: m.RitualAnimation })));
const CommandPalette = lazyWithRetry(() => import('./components/CommandPalette').then(m => ({ default: m.CommandPalette })));
const GuidedTour = lazyWithRetry(() => import('./components/GuidedTour').then(m => ({ default: m.GuidedTour })));
const QuestCompleteOverlay = lazyWithRetry(() => import('./components/QuestCompleteOverlay').then(m => ({ default: m.QuestCompleteOverlay })));
// The OSRS layout's shell (utils/uiStyle.ts): loaded only while that layout is on.
const OsrsHeader = lazyWithRetry(() => import('./components/osrs/OsrsHeader').then(m => ({ default: m.OsrsHeader })));
const FateMapOptions = lazyWithRetry(() => import('./components/FateMapOptions'));
const OsrsShellFrame = lazyWithRetry(() => import('./components/osrs/OsrsShellFrame'));
const OsrsContextMenu = lazyWithRetry(() => import('./components/osrs/OsrsContextMenu').then(m => ({ default: m.OsrsContextMenu })));
const RunelitePluginGuide = lazyWithRetry(() =>
  import('./components/runelite-guide/RunelitePluginGuide').then(module => ({
    default: module.RunelitePluginGuide,
  })),
);
import { deobfuscateFateSave, MAX_FATE_FILE_BYTES } from './utils/encryption';
import { Download, Upload, RotateCcw, BarChart3, HelpCircle, PlayCircle, PauseCircle, Search, Database, SlidersHorizontal, Link2, Radio, Settings, MessageCircle } from 'lucide-react';
import { OSRS_MIN_WIDTH, readUiStyle, setUiStyle, useIsOsrsUi, useIsWideEnoughForOsrs, useUiStyle } from './utils/uiStyle';
import { openOsrsScreen, setOsrsKeysTab, useOsrsNav, type OsrsKeysTab } from './utils/osrsNav';
import { Key, Sparkles, Dna, Swords, ShoppingBag, ScrollText, Compass, Lightbulb } from './components/OsrsIcon';
import { exportRuneliteBundle } from './utils/runeliteExport';
import { BookOpen } from './components/OsrsIcon';
import { DISCORD_INVITE_URL } from './constants';

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
    // Before the reload below: a chunk error is reported only when the last
    // reload didn't fix it (utils/errorBeacon.ts).
    reportError('boundary', error);
    // Stale chunk from a superseded deploy — retrying in-app can't fix it,
    // so reload once to pick up the current build. A dropped connection
    // stays on the Reload screen below instead of the browser's error page.
    if (isChunkLoadError(error)) void reloadIfNewBuild();
  }

  render() {
    if (this.state.hasError) {
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className="min-h-screen bg-[#161616] flex items-center justify-center p-8">
            <div className="bg-[#1e1e1e] border border-amber-500/30 rounded-xl p-8 max-w-lg text-center">
              <h1 className="text-2xl font-bold text-amber-400 mb-2">Couldn't load the tracker</h1>
              <p className="text-gray-400 mb-4">Your connection may have dropped for a moment. Your save data is safe.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors"
              >
                Reload now
              </button>
            </div>
          </div>
        );
      }
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
            {readUiStyle() === 'osrs' && (
              /* A crash in the OSRS layout would come straight back after a
                 reload (the choice is saved), and its only switch is in the
                 header that just crashed. */
              <button
                onClick={() => {
                  setUiStyle('classic');
                  window.location.reload();
                }}
                className="block mx-auto mt-3 text-sm text-gray-400 hover:text-white underline"
              >
                Switch to the classic layout and reload
              </button>
            )}
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
  /** Optional handoff button — closes the loop (e.g. key won → "Spend it"). */
  const [action, setAction] = useState<{ label: string; run: () => void } | null>(null);
  const timeoutRef = useRef<number | null>(null);

  // Imperative channel (import/export feedback, etc.).
  useEffect(() => {
    const onToast = (e: Event) => {
      const msg = (e as CustomEvent<{ message?: string }>).detail?.message;
      if (!msg) return;
      setMessage(msg);
      setAction(null);
      setVisible(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setVisible(false), 5000);
    };
    window.addEventListener('fate:toast', onToast);
    return () => window.removeEventListener('fate:toast', onToast);
  }, []);

  useEffect(() => {
    if (!lastEvent) return;

    const undoableTypes = [
      'ROLL_SUCCESS', 'ROLL_FAIL', 'ROLL_OMNI', 'ROLL_PITY',
      'UNLOCK', 'RITUAL', 'LEVEL_UP', 'PET'
    ];

    if (undoableTypes.includes(lastEvent.type)) {
      let msg = 'Action Complete';
      if (lastEvent.type.includes('ROLL')) msg = 'Roll Recorded';
      if (lastEvent.type === 'UNLOCK') msg = 'Content Unlocked';
      if (lastEvent.type === 'PET') msg = 'New Pet: Omni-Key Found!';
      if (lastEvent.type === 'RITUAL') {
        const rm = lastEvent.meta as any;
        msg = rm?.type === 'GAMBIT'
          ? (rm.won ? 'The Void blinked — Gambit WON!' : 'The Void keeps your Fate.')
          : rm?.type === 'CARTOGRAPHER' ? 'Course charted — chunk unlocked!'
          : 'Ritual Performed';
      }
      if (lastEvent.type === 'LEVEL_UP') {
          const chaosKeysAwarded = lastEvent.meta && 'chaosKeysAwarded' in lastEvent.meta
            ? Number(lastEvent.meta.chaosKeysAwarded)
            : Number(Boolean(lastEvent.meta && 'chaosKeyAwarded' in lastEvent.meta && lastEvent.meta.chaosKeyAwarded));
          if (chaosKeysAwarded > 0) {
              msg = `Level Up + ${chaosKeysAwarded === 1 ? 'Chaos Key' : `${chaosKeysAwarded} Chaos Keys`}!`;
          } else {
              msg = 'Level Up';
          }
      }
      const mergedLevelMeta = lastEvent.meta as any;
      if (lastEvent.type.includes('ROLL')
        && typeof mergedLevelMeta?.skill === 'string'
        && typeof mergedLevelMeta?.level === 'number'
      ) {
        const chaosKeysAwarded = Number(mergedLevelMeta.chaosKeysAwarded ?? mergedLevelMeta.chaosKeyAwarded ?? 0);
        if (chaosKeysAwarded > 0) msg = `Level Up + ${chaosKeysAwarded === 1 ? 'Chaos Key' : `${chaosKeysAwarded} Chaos Keys`}!`;
      }

      setMessage(msg);
      // A won key's natural next beat is spending it — hand the player there
      // instead of dead-ending at "Roll Recorded".
      if (lastEvent.type === 'ROLL_SUCCESS' || lastEvent.type === 'ROLL_OMNI' || lastEvent.type === 'ROLL_PITY' || lastEvent.type === 'PET') {
        setAction({
          label: 'Spend it',
          run: () => {
            window.dispatchEvent(new CustomEvent('fate:nav', { detail: { target: 'ctrl:SPEND' } }));
            setVisible(false);
          },
        });
      } else {
        setAction(null);
      }
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
       {action && (
         <button
           onClick={action.run}
           className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-white transition-colors"
         >
           {action.label} →
         </button>
       )}
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
  setShowDiscord: (show: boolean) => void;
  onOpenRuneliteGuide: (returnFocusTarget: HTMLElement | null) => void;
  onOpenChangelog: (returnFocusTarget: HTMLElement | null) => void;
}

const Header = ({ setShowAltar, setShowStats, setShowReference, setShowOracle, setShowStrategy, setShowSupplyChain, setShowGameMode, setShowSyncCode, setShowDiscord, onOpenRuneliteGuide, onOpenChangelog }: HeaderProps) => {
  const uiStyle = useUiStyle();
  const osrsFits = useIsWideEnoughForOsrs();
  const osrsHeader = useIsOsrsUi();
  const { keys, specialKeys, chaosKeys, fatePoints, activeBuff, animationsEnabled, toggleAnimations, advisorsEnabled, toggleAdvisors, importSave, resetGame, getExportData, gameModeId, customMode, unlocks, pinnedGoals, linkedAccount, runId, runRevision, bossStandardKeysAwarded } = useGame();
  // Progressive disclosure — advanced tools stay hidden until the run earns them.
  const gates = useFeatureGates();
  const { storageKeyForActiveProfile } = useProfiles();
  const pityRules = resolveModeRules(gameModeId, customMode);
  const pityCap = pityRules.pityEnabled ? pityRules.pityThreshold : 50; // 50 = visual-only fallback
  const nearPity = pityRules.pityEnabled && fatePoints >= pityRules.pityThreshold * 0.8;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeFileReaderRef = useRef<FileReader | null>(null);
  const fileReadRequestRef = useRef(0);
  const activeProfileKeyRef = useRef(storageKeyForActiveProfile);
  activeProfileKeyRef.current = storageKeyForActiveProfile;
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);
  const [showUtilMenu, setShowUtilMenu] = useState(false);

  useEffect(() => {
    fileReadRequestRef.current += 1;
    activeFileReaderRef.current?.abort();
    activeFileReaderRef.current = null;
    return () => {
      fileReadRequestRef.current += 1;
      activeFileReaderRef.current?.abort();
      activeFileReaderRef.current = null;
    };
  }, [storageKeyForActiveProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    const request = {
      id: fileReadRequestRef.current + 1,
      source: activeProfileKeyRef.current,
    };
    fileReadRequestRef.current = request.id;
    activeFileReaderRef.current?.abort();

    const clearInput = () => { input.value = ''; };
    if (file.size > MAX_FATE_FILE_BYTES) {
      showToast('That save file is too large.');
      clearInput();
      return;
    }

    const reader = new FileReader();
    activeFileReaderRef.current = reader;
    const isCurrent = () => isCurrentImportRequest(
      fileReadRequestRef.current,
      activeProfileKeyRef.current,
      request,
    );
    const release = () => {
      if (activeFileReaderRef.current === reader) activeFileReaderRef.current = null;
    };

    reader.onload = async (event) => {
      if (!isCurrent()) {
        release();
        clearInput();
        return;
      }
      try {
        const fileContent = event.target?.result;
        if (typeof fileContent !== 'string') {
          showToast('Import failed — could not read save data');
          return;
        }

        const decoded = deobfuscateFateSave(fileContent);
        if (decoded.ok === false) {
          showToast(decoded.message);
          return;
        }
        if (!isCurrent()) return;

        const result = await importSave(decoded.value);
        if (!isCurrent()) return;
        const decision = importUiDecision(result);
        if (decision.error) {
          showToast(decision.error);
          return;
        }
        if (decision.success) {
          showToast(decision.warning
            ? `${decision.success}. ${decision.warning}`
            : decision.success);
        }
      } catch {
        if (isCurrent()) showToast('Import failed — could not read save data');
      } finally {
        release();
        clearInput();
      }
    };
    reader.onerror = () => {
      if (isCurrent()) showToast('Import failed — could not read the file');
      release();
      clearInput();
    };
    reader.onabort = () => {
      release();
      clearInput();
    };
    try {
      reader.readAsText(file);
    } catch {
      if (isCurrent()) showToast('Import failed — could not read the file');
      release();
      clearInput();
    }
  };

  const handleExport = () => {
      const result = downloadFateSave(getExportData(), storageKeyForActiveProfile);
      if (result.ok === false) {
        showToast(result.message);
        return;
      }
      showToast(FATE_EXPORT_DONE_MESSAGE);
  };
  const exportRunelite = () => exportRuneliteBundle(unlocks, { runId, runRevision, keys, specialKeys, chaosKeys, fatePoints, activeBuff, pinnedGoals, linkedAccount, gameModeId: gameModeId ?? 'vanilla', customMode, bossStandardKeysAwarded });
  // Accept .fate files and legacy .json files
  const fileInput = <input type="file" ref={fileInputRef} className="hidden" accept=".json,.fate" onChange={handleFileChange} />;

  if (osrsHeader) return (
    <>
      {fileInput}
      <Suspense fallback={<div style={{ height: 64 }} />}>
        <OsrsHeader
          setShowAltar={setShowAltar} setShowStats={setShowStats} setShowReference={setShowReference}
          setShowOracle={setShowOracle} setShowStrategy={setShowStrategy} setShowSupplyChain={setShowSupplyChain}
          setShowGameMode={setShowGameMode} setShowSyncCode={setShowSyncCode} setShowDiscord={setShowDiscord}
          onOpenRuneliteGuide={onOpenRuneliteGuide} onOpenChangelog={onOpenChangelog}
          onImportSave={() => fileInputRef.current?.click()} onExportSave={handleExport} onRuneliteExport={exportRunelite}
        />
      </Suspense>
    </>
  );

  return (
      <header className="bg-[#1e1e1e] border-b border-white/10 sticky top-0 z-50 shadow-xl backdrop-blur-md bg-opacity-95">
        <div className="max-w-[1600px] mx-auto px-4 py-2 flex flex-col xl:flex-row items-center justify-between gap-4">

          {/* Logo Section */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-600 to-amber-900 rounded-lg flex items-center justify-center border border-amber-500/50 shadow-inner">
              <WikiIcon file="Crystal_key.png" alt="Fate Locked" Fallback={Key} size={24} className="drop-shadow-md" />
            </div>
            <div>
              <h1 className="text-lg font-black text-gray-100 tracking-tight uppercase leading-none">Fate Locked Ironman</h1>
              <p className="text-[10px] text-gray-500 font-mono mt-0.5 tracking-wide">Ironman challenge tracker</p>
            </div>
            <ProfileSwitcher />
          </div>

          {/* Resources Bar */}
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6 bg-black/20 p-1.5 pr-4 rounded-xl border border-white/5 w-full xl:w-auto shadow-inner">
            <div className="w-full md:w-48 lg:w-64 px-2" title={pityRules.pityEnabled
                ? `Fate Points: failed rolls build these, and at ${pityRules.pityThreshold} you get a guaranteed Pity Key. You can also spend them on rituals at the Altar.`
                : 'Fate Points: failed rolls build these. Spend them on rituals at the Altar.'}>
               <div className="flex justify-between text-[10px] mb-1.5 font-bold uppercase tracking-wider">
                  <span className={nearPity ? "text-red-400 animate-pulse" : "text-gray-500"}>Fate Points</span>
                  <span className="text-gray-400">{pityRules.pityEnabled ? `${fatePoints}/${pityRules.pityThreshold}` : `${fatePoints} Fate`}</span>
               </div>
               <div className="h-2 bg-black/50 rounded-full overflow-hidden border border-white/10 relative">
                 <div className={`relative h-full overflow-hidden transition-all duration-500 ${animationsEnabled ? 'progress-sheen' : ''} ${nearPity ? 'bg-red-500 shadow-[0_0_10px_#ef4444]' : 'bg-amber-600'}`} style={{ width: `${Math.min(100, (fatePoints / pityCap) * 100)}%` }} />
                      </div>
            </div>
            <div className="hidden md:block w-px h-8 bg-white/5"></div>
            <div data-tour="keys" className="flex items-center gap-3 justify-center">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg min-w-[60px] justify-center" title="Keys: spend one on a table in Spend Keys for a random unlock">
                   <WikiIcon file="Crystal_key.png" alt="Keys" Fallback={Key} size={17} className="drop-shadow" />
                   <span className="font-bold text-amber-100 text-lg leading-none"><PopOnChange value={keys} /></span>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors min-w-[60px] justify-center ${specialKeys > 0 ? 'bg-purple-500/20 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-white/5 border-white/10 opacity-50'}`} title={`Omni-Keys: click a locked entry on the Dashboard to unlock exactly that.${gameModeId === 'chunked' ? ` ${CHUNKED_OMNI_LAND_TEXT}` : ''}`}>
                   <WikiIcon file="Enhanced_crystal_key.png" alt="Omni-Keys" Fallback={Sparkles} size={18} className={specialKeys > 0 ? 'animate-pulse' : 'opacity-50 grayscale'} />
                   <span className={`font-bold text-lg leading-none ${specialKeys > 0 ? 'text-purple-200' : 'text-gray-500'}`}><PopOnChange value={specialKeys} /></span>
                </div>
                {chaosKeys > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded-lg animate-in fade-in slide-in-from-right-4 min-w-[60px] justify-center" title="Chaos Keys: each one unlocks a random entry from all the tables at once">
                     <WikiIcon file="Sinister_key.png" alt="Chaos Keys" Fallback={Dna} size={17} className="animate-pulse drop-shadow" />
                     <span className="font-bold text-red-100 text-lg leading-none"><PopOnChange value={chaosKeys} /></span>
                  </div>
                )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-center gap-2 min-w-0 max-w-full">
             {fileInput}

             {gates.has('tool:altar') && <button
                data-tour="altar"
                onClick={() => setShowAltar(true)}
                className={`h-8 group px-3 rounded-lg border font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg ${activeBuff !== 'NONE' ? activeBuff === 'GREED' ? 'bg-amber-900/40 border-amber-500 text-amber-300' : 'bg-blue-900/40 border-blue-500 text-blue-300' : 'bg-[#252525] border-purple-500/30 text-purple-300 hover:bg-purple-900/20'}`}
             >
                <span className={`w-1.5 h-1.5 rounded-full ${activeBuff !== 'NONE' ? (activeBuff === 'GREED' ? 'bg-amber-400 animate-bounce' : 'bg-blue-400 animate-pulse') : 'bg-purple-500'}`}></span>
                <span>{activeBuff === 'NONE' ? 'Altar' : activeBuff}</span>
             </button>}

             <button
               data-tour="palette"
               onClick={event => window.dispatchEvent(new CustomEvent('fate:open-palette', {
                 detail: {
                   returnFocusTarget: event.currentTarget,
                 },
               }))}
               className="h-8 px-2.5 rounded-lg border border-white/10 bg-[#252525] hover:bg-white/5 hover:border-white/20 text-gray-400 hover:text-white flex items-center gap-2 transition-colors group"
               title="Command palette — jump to anything"
             >
                <Search size={13} />
                <span className="text-[11px] font-medium hidden sm:inline">Jump to…</span>
                <kbd className="text-[9px] font-mono text-gray-500 border border-white/15 rounded px-1 py-0.5 hidden sm:inline group-hover:border-white/25">⌘K</kbd>
             </button>

             <button
               onClick={exportRunelite}
               className="h-8 px-2.5 rounded-lg border border-amber-500/40 bg-amber-900/30 hover:bg-amber-800/40 text-amber-200 hover:text-amber-100 flex items-center gap-2 transition-colors"
               title="Export your run for the RuneLite plugin (copies to clipboard + downloads). Then use 'Import from clipboard' in the plugin."
             >
                <Radio size={13} />
                <span className="text-[11px] font-medium hidden sm:inline">RuneLite</span>
             </button>

             <a
               href={DISCORD_INVITE_URL}
               target="_blank"
               rel="noreferrer"
               aria-label="Join the Fate Locked Discord"
               title="Join the Fate Locked Discord"
               className="h-8 px-2.5 rounded-lg border border-indigo-400/40 bg-indigo-900/30 hover:bg-indigo-800/40 text-indigo-200 hover:text-indigo-100 flex items-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70"
             >
               <MessageCircle size={13} aria-hidden="true" />
               <span className="text-[11px] font-medium hidden sm:inline">Discord</span>
             </a>
             <div data-reveal="tools" className="flex items-center bg-[#252525] border border-white/10 rounded-lg p-0.5 gap-0.5 h-8">
                 <button onClick={() => setShowOracle(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 rounded transition-colors" title="Oracle — search content" aria-label="Oracle — search content"><Search size={14} /></button>
                 {gates.has('tool:strategy') && <>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowStrategy(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-emerald-400 hover:bg-white/5 rounded transition-colors" title="Strategy Guide" aria-label="Strategy Guide"><Compass size={14} /></button>
                 </>}
                 {gates.has('tool:supply') && <>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowSupplyChain(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-cyan-400 hover:bg-white/5 rounded transition-colors" title="Resource Engine" aria-label="Resource Engine"><Database size={14} /></button>
                 </>}
                 {gates.has('tool:stats') && <>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowStats(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-blue-400 hover:bg-white/5 rounded transition-colors" title="Fate Analytics" aria-label="Fate Analytics"><BarChart3 size={14} /></button>
                 </>}
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowReference(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-yellow-400 hover:bg-white/5 rounded transition-colors" title="Rules" aria-label="Rules"><HelpCircle size={14} /></button>
                 <div className="w-px h-4 bg-white/10"></div>
                 <button onClick={() => setShowGameMode(true)} className="w-7 h-full flex items-center justify-center text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded transition-colors" title="Game Mode" aria-label="Game Mode"><SlidersHorizontal size={14} /></button>
             </div>

             {/* Low-frequency utilities live behind one gear menu — they were six
                 always-visible icons crowding the header for actions used once a
                 session at most. */}
             <div className="relative h-8">
                 <button
                   ref={settingsTriggerRef}
                   onClick={() => setShowUtilMenu((v) => !v)}
                   className={`h-8 w-8 flex items-center justify-center bg-[#252525] border border-white/10 rounded-lg transition-colors ${showUtilMenu ? 'text-white border-white/25' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                   title="Settings & save tools"
                   aria-label="Settings & save tools"
                   aria-expanded={showUtilMenu}
                 >
                    <Settings size={14} />
                 </button>
                 {showUtilMenu && (
                   <>
                     <div className="fixed inset-0 z-[90]" onClick={() => setShowUtilMenu(false)} />
                     <div className="absolute right-0 top-9 z-[91] w-56 bg-[#1c1c1c] border border-white/15 rounded-lg shadow-2xl py-1.5 text-[12px]">
                        <button type="button" onClick={() => {
                          setShowUtilMenu(false);
                          onOpenRuneliteGuide(settingsTriggerRef.current);
                        }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-amber-300">
                          <BookOpen size={13} className="text-amber-300" />
                          RuneLite Plugin Guide
                        </button>
                        <button type="button" onClick={() => {
                          setShowUtilMenu(false);
                          onOpenChangelog(settingsTriggerRef.current);
                        }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-amber-300">
                          <ScrollText size={13} className="text-amber-300" />
                          What's New
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <button onClick={() => { toggleAnimations(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white" aria-pressed={animationsEnabled}>
                           {animationsEnabled ? <PlayCircle size={13} className="text-green-400" /> : <PauseCircle size={13} className="text-gray-500" />}
                           Animations <span className="ml-auto text-[10px] text-gray-500">{animationsEnabled ? 'on' : 'off'}</span>
                        </button>
                        {gameModeId === 'chunked' && <Suspense fallback={null}><FateMapOptions /></Suspense>}
                        <button onClick={() => { setUiStyle(uiStyle === 'osrs' ? 'classic' : 'osrs'); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white" aria-pressed={uiStyle === 'osrs'} title={osrsFits ? undefined : `The OSRS layout shows on windows at least ${OSRS_MIN_WIDTH} pixels wide`}>
                           <SlidersHorizontal size={13} className={uiStyle === 'osrs' ? 'text-amber-400' : 'text-gray-500'} />
                           OSRS layout <span className="ml-auto text-[10px] text-gray-500">{uiStyle === 'osrs' ? (osrsFits ? 'on' : 'on, wide screens') : 'off'}</span>
                        </button>
                        <button onClick={() => { toggleAdvisors(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white" aria-pressed={advisorsEnabled}>
                           <Lightbulb size={13} className={advisorsEnabled ? 'text-amber-400' : 'text-gray-500'} />
                           Advisor panels <span className="ml-auto text-[10px] text-gray-500">{advisorsEnabled ? 'on' : 'off'}</span>
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <Suspense fallback={null}><OffDeviceCopyStatus /></Suspense>
                        <button onClick={() => { setShowUtilMenu(false); fileInputRef.current?.click(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white">
                           <Upload size={13} /> Import save
                        </button>
                        <button onClick={() => { setShowUtilMenu(false); handleExport(); }} title={FATE_EXPORT_HINT} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-white">
                           <Download size={13} /> Export save file (.fate)
                        </button>
                        <button onClick={() => { setShowUtilMenu(false); setShowSyncCode(true); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-cyan-300">
                           <Link2 size={13} /> Sync code (move device)
                        </button>
                        <button onClick={() => { setShowUtilMenu(false); setShowDiscord(true); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-gray-300 hover:bg-white/5 hover:text-indigo-300">
                           <Radio size={13} /> Discord notifications
                        </button>
                        <div className="my-1 border-t border-white/10" />
                        <button onClick={() => { setShowUtilMenu(false); if(window.confirm(RESET_CONFIRM_MESSAGE)) void resetGame(); }} className="w-full flex items-center gap-2.5 px-3 py-1.5 text-red-300/90 hover:bg-red-900/20 hover:text-red-200">
                           <RotateCcw size={13} /> Reset all progress
                        </button>
                     </div>
                   </>
                 )}
             </div>
          </div>
        </div>
      </header>
  );
};

// --- New Control Panel Component ---
const PANEL_TO_KEYS_TAB: Record<'FARM' | 'SPEND' | 'LOG', OsrsKeysTab> = { FARM: 'farm', SPEND: 'spend', LOG: 'history' };
const KEYS_TAB_TO_PANEL: Record<OsrsKeysTab, 'FARM' | 'SPEND' | 'LOG'> = { farm: 'FARM', spend: 'SPEND', history: 'LOG' };

const ControlPanel: React.FC<{ suspendModals?: boolean }> = ({ suspendModals = false }) => {
  const [classicTab, setClassicTab] = useState<'FARM' | 'SPEND' | 'LOG'>('FARM');
  const isOsrs = useIsOsrsUi();
  // OSRS layout: this panel's tab and the wide Keys screen's tab are one choice
  // (utils/osrsNav.ts), so opening the Keys screen lands on the same tab and
  // closing it brings the choice back here. The nav store is the only source
  // of truth there; two effects syncing two copies could chase each other
  // when they disagreed on mount.
  const { keysTab } = useOsrsNav();
  const activeTab = isOsrs ? KEYS_TAB_TO_PANEL[keysTab] : classicTab;
  const setActiveTab = useCallback((tab: 'FARM' | 'SPEND' | 'LOG') => {
    setClassicTab(tab);
    setOsrsKeysTab(PANEL_TO_KEYS_TAB[tab]);
  }, []);
  // History reveals with the first logged event (progressive disclosure).
  const gates = useFeatureGates();
  const showLogTab = gates.has('ctrl:LOG') || activeTab === 'LOG';
  // History mounts on first visit, then stays mounted (its filters/scroll
  // survive tab switches) — rendering the full history list at startup while
  // hidden was pure wasted work on the critical path.
  const [logVisited, setLogVisited] = useState(false);
  useEffect(() => { if (activeTab === 'LOG') setLogVisited(true); }, [activeTab]);

  // Command-palette navigation to a control tab.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onNav = (e: Event) => {
      const target = (e as CustomEvent<{ target?: string }>).detail?.target ?? '';
      if (target.startsWith('ctrl:')) {
        setActiveTab(target.slice(5) as 'FARM' | 'SPEND' | 'LOG');
        // Cross-panel jumps (coach strip, toasts, palette, suggestions) land
        // here from far away — the house ring pulse says "you are here".
        flashElement(panelRef.current, 'amber');
      }
    };
    window.addEventListener('fate:nav', onNav);
    return () => window.removeEventListener('fate:nav', onNav);
  }, []);

  return (
    <div ref={panelRef} className={isOsrs ? 'osrs-win flex flex-col h-full overflow-hidden p-1 gap-1' : 'flex flex-col h-full bg-[#1b1b1b] border border-[#333] rounded-lg overflow-hidden shadow-xl'}>
      {isOsrs ? <>
      {/* OSRS layout: the Main board's tab strip, plus a small control that
          opens the wide Keys screen on the same tab. The panel guide sits
          beside it (the board has no row for it). */}
      <div className="flex shrink-0 items-end" style={{ gap: 3, padding: '2px 2px 0', borderBottom: '1px solid var(--osrs-rule, #5c5244)' }}>
        <div role="tablist" className="flex" style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <button type="button" role="tab" data-tour="farm" aria-selected={activeTab === 'FARM'} onClick={() => setActiveTab('FARM')} className="osrs-tab" style={{ flex: 1, textAlign: 'center' }}>Farm Keys</button>
          <button type="button" role="tab" data-tour="spend" aria-selected={activeTab === 'SPEND'} onClick={() => setActiveTab('SPEND')} className="osrs-tab" style={{ flex: 1, textAlign: 'center' }}>Spend Keys</button>
          {showLogTab && <button type="button" role="tab" aria-selected={activeTab === 'LOG'} onClick={() => setActiveTab('LOG')} className="osrs-tab" style={{ flex: 1, textAlign: 'center' }}>History</button>}
        </div>
        <span className="osrs-keys-guide flex items-center justify-center" style={{ width: 22, height: 26, marginBottom: 1 }}>
          <SectionGuide id={activeTab} suspendModals={suspendModals} />
        </span>
        <button
          type="button"
          className="osrs-btn"
          onClick={() => openOsrsScreen('keys', PANEL_TO_KEYS_TAB[activeTab])}
          title={`Open the full ${activeTab === 'FARM' ? 'Farm Keys' : activeTab === 'SPEND' ? 'Spend Keys' : 'History'} window`}
          aria-label={`Open the full ${activeTab === 'FARM' ? 'Farm Keys' : activeTab === 'SPEND' ? 'Spend Keys' : 'History'} window`}
          style={{ width: 26, height: 26, padding: 0, marginBottom: 2, flexShrink: 0 }}
        >
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M7 1h4v4M11 1L6.5 5.5M5 11H1V7M1 11l4.5-4.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </button>
      </div>
      </> : <>
      {/* Tabs */}
      <div className="flex border-b border-[#333] bg-[#161616] shrink-0">
        <button
          data-tour="farm"
          onClick={() => setActiveTab('FARM')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'FARM' ? 'bg-[#252525] text-green-400 border-b-2 border-green-400' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
        >
          <WikiIcon file="Slayer_icon.png" alt="Farm Keys" Fallback={Swords} size={15} className={activeTab === 'FARM' ? '' : 'opacity-60 grayscale'} /> Farm Keys
        </button>
        <button
          data-tour="spend"
          onClick={() => setActiveTab('SPEND')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'SPEND' ? 'bg-[#252525] text-osrs-gold border-b-2 border-osrs-gold' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
        >
          <WikiIcon file="Mystery_box.png" alt="Spend Keys" Fallback={ShoppingBag} size={15} className={activeTab === 'SPEND' ? '' : 'opacity-60 grayscale'} /> Spend Keys
        </button>
        {showLogTab && <button
          onClick={() => setActiveTab('LOG')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${activeTab === 'LOG' ? 'bg-[#252525] text-blue-400 border-b-2 border-blue-400' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a1a]'}`}
        >
          <WikiIcon file="Watch.png" alt="History" Fallback={ScrollText} size={15} className={activeTab === 'LOG' ? '' : 'opacity-60 grayscale'} /> History
        </button>}
      </div>

      {/* Contextual guide for the active panel */}
      <div className="flex items-center justify-end gap-1.5 px-3 py-1 bg-[#141414] border-b border-[#2a2a2a] shrink-0 text-[10px] text-gray-500">
        <span>{GUIDES[activeTab]?.title}</span>
        <SectionGuide id={activeTab} suspendModals={suspendModals} />
      </div>
      </>}

      {/* Content. The OSRS layout's compact Keys views fill a definite height and scroll inside themselves. */}
      <div className={isOsrs ? 'flex-1 min-h-0 overflow-hidden' : 'flex-1 overflow-y-auto custom-scrollbar p-1'}>
        <div className={activeTab === 'FARM' ? (isOsrs ? 'block h-full' : 'block') : 'hidden'}>
           <ActionSection />
        </div>
        <div className={activeTab === 'SPEND' ? (isOsrs ? 'block h-full' : 'block') : 'hidden'}>
           <GachaSection />
        </div>
        <div className={activeTab === 'LOG' ? 'block h-full' : 'hidden'}>
           {logVisited && (
             <Suspense fallback={<ModalFallback />}>
               <LogViewer />
             </Suspense>
           )}
        </div>
      </div>
    </div>
  );
};

const GameLayout = () => {
  const {
    lastEvent, animationsEnabled, hasSeenOnboarding, history, linkedAccount, unlocks,
    fateCompensation, resolveFateCompensation, saveDurability, saveStatus,
    petCompensation, resolvePetCompensation, petsClaimed, gameModeId, customMode,
    saveOwnershipBlockReason, retrySave,
    getExportData,
  } = useGame();
  // A pending offer from a balance change keeps What's New open until it's settled.
  const hasPendingOffer = fateCompensation.status === 'pending' || petCompensation.status === 'pending';
  const isOsrs = useIsOsrsUi();
  const {
    recentlyCreatedId,
    activeProfileId,
    activeProfileName,
    storageKeyForActiveProfile,
    clearRecentlyCreated,
  } = useProfiles();
  const exportBackup = React.useCallback(
    () => downloadFateSave(getExportData(), storageKeyForActiveProfile),
    [getExportData, storageKeyForActiveProfile],
  );
  const failureReason = saveDurability.failureReason
    ?? (isOwnershipConflictBlock(saveOwnershipBlockReason)
      ? 'ownership_conflict'
      : saveOwnershipBlockReason === 'storage_unavailable'
        ? 'storage_unavailable'
        : undefined);
  const effectiveDurability = effectiveSaveDurability(saveDurability, saveStatus, failureReason);
  const dualStorageFailure = effectiveDurability.primary === 'failed'
    && effectiveDurability.recovery === 'degraded'
    && effectiveDurability.failureReason !== 'ownership_conflict';

  const directGuideRequested = typeof window !== 'undefined'
    && hasRuneliteGuideQuery(window.location.search);
  const [showRuneliteGuide, setShowRuneliteGuide] = useState(directGuideRequested);
  const runeliteGuideReturnFocusTarget = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!directGuideRequested) return;
    const search = removeRuneliteGuideQuery(window.location.search);
    window.history.replaceState(
      null,
      '',
      window.location.pathname + search + window.location.hash,
    );
  }, []);

  const [showChangelog, dispatchChangelog] = useReducer(
    changelogVisibilityReducer,
    undefined,
    () => shouldAutoOpenChangelog({
      hasSeenOnboarding,
      releaseIsUnseen: shouldShowChangelog(LATEST_CHANGELOG_ID),
      startupHash: typeof window === 'undefined' ? '' : window.location.hash,
      hasPendingGameModePrompt: recentlyCreatedId === activeProfileId,
      hasPendingGuidePrompt: directGuideRequested,
      hasPendingCompensation: hasPendingOffer,
    }),
  );

  const [runelitePairCode, setRunelitePairCode] = useState<string | null>(
    () => {
      if (typeof window === 'undefined') return null;
      const code = parseRunelitePairFragment(window.location.hash);
      if (code) {
        window.history.replaceState(
          null, '', window.location.pathname + window.location.search,
        );
      }
      return code;
    },
  );
  const [runelitePairPhase, setRunelitePairPhase] =
    useState<RunelitePairingPhase>('confirm');
  const [runelitePairError, setRunelitePairError] =
    useState<string | undefined>(undefined);

  const changelogReturnFocusTarget = useRef<HTMLElement | null>(null);
  const changelogAutoOpenKey = `${activeProfileId}:${LATEST_CHANGELOG_ID}`;
  const changelogAutoOpenedRelease = useRef<string | null>(
    showChangelog ? changelogAutoOpenKey : null,
  );
  const openChangelog = (returnFocusTarget: HTMLElement | null = null) => {
    changelogReturnFocusTarget.current = returnFocusTarget;
    dispatchChangelog({ type: 'OPEN' });
  };
  const closeChangelog = () => {
    if (hasPendingOffer) return;
    markChangelogSeen(LATEST_CHANGELOG_ID);
    dispatchChangelog({ type: 'DISMISS' });
    changelogReturnFocusTarget.current = null;
  };
  const resolveCompensation = (choice: FateCompensationChoice) => {
    resolveFateCompensation(choice);
    markChangelogSeen(LATEST_CHANGELOG_ID);
  };
  const resolvePets = (
    choice: PetCompensationChoice,
    keyOnly: Array<{ id: number; name: string } | null>,
    omni: Array<{ id: number; name: string } | null>,
  ) => {
    resolvePetCompensation(choice, keyOnly, omni);
    markChangelogSeen(LATEST_CHANGELOG_ID);
  };

  const openRuneliteGuide = (returnFocusTarget: HTMLElement | null = null) => {
    runeliteGuideReturnFocusTarget.current = returnFocusTarget;
    setShowRuneliteGuide(true);
  };
  const closeRuneliteGuide = () => {
    setShowRuneliteGuide(false);
    runeliteGuideReturnFocusTarget.current = null;
  };

  // Warm the heavy lazy chunks (map, stats+charts, resource engine, …) during
  // idle time so opening them is instant instead of a visible fetch delay.
  useEffect(() => { prefetchHeavyChunks(); }, []);

  useEffect(() => relaySync.subscribe(() => {
    if (!runelitePairCode || relaySync.code !== runelitePairCode) return;
    if (relaySync.status === 'synced') {
      setRunelitePairPhase('success');
      setRunelitePairError(undefined);
    } else if (relaySync.status === 'error') {
      setRunelitePairPhase('error');
      setRunelitePairError(
        relaySync.lastError || 'Profile could not be sent.',
      );
    } else {
      setRunelitePairPhase('uploading');
      setRunelitePairError(undefined);
    }
  }), [runelitePairCode]);

  const closeRunelitePairing = () => {
    if (!canDismissRunelitePairing(runelitePairPhase)) return;
    setRunelitePairCode(null);
    setRunelitePairPhase('confirm');
    setRunelitePairError(undefined);
  };

  // UI States
  const [showStats, setShowStats] = useState(false);
  const [showFateThread, setShowFateThread] = useState(false);
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
      const detail = (e as CustomEvent<{
        target?: string;
        returnFocusTarget?: HTMLElement | null;
      }>).detail;
      const target = detail?.target ?? '';
      if (target === 'open:online-backup') {
        // A sync link's code would open the Import tab instead.
        setSyncImportCode(undefined);
        setSyncInitialTab('ONLINE');
        setShowSyncCode(true);
        return;
      }
      if (target === 'open:runelite-guide') {
        openRuneliteGuide(
          detail?.returnFocusTarget
          ?? document.querySelector<HTMLElement>('[data-tour="palette"]'),
        );
        return;
      }
      const map: Record<string, (v: boolean) => void> = {
        'open:altar': setShowAltar,
        'open:stats': setShowStats,
        'open:fatethread': setShowFateThread,
        'open:reference': setShowReference,
        'open:oracle': setShowOracle,
        'open:strategy': setShowStrategy,
        'open:supply': setShowSupplyChain,
        'open:gamemode': setShowGameMode,
        'open:sync': setShowSyncCode,
        'open:gallery': setShowGallery,
      };
      map[target]?.(true);
    };
    window.addEventListener('fate:nav', onNav);
    return () => window.removeEventListener('fate:nav', onNav);
  }, []);
  const [showGameMode, setShowGameMode] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [showDiscord, setShowDiscord] = useState(false);
  const [showSyncCode, setShowSyncCode] = useState(false);
  const [syncImportCode, setSyncImportCode] = useState<string | undefined>(undefined);
  const [syncInitialTab, setSyncInitialTab] = useState<'ONLINE' | undefined>(undefined);
  const [activeRitual, setActiveRitual] = useState<{ id: string; ritual: Ritual['id']; meta: Record<string, unknown> } | null>(null);

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
    if (lastEvent?.type !== 'RITUAL' || !animationsEnabled) return;
    const meta = (lastEvent.meta ?? {}) as Record<string, unknown>;
    if (RITUALS.some(r => r.id === meta.type)) setActiveRitual({ id: lastEvent.id, ritual: meta.type as Ritual['id'], meta });
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
  // This adjusts state during render rather than in an effect: saving the
  // completion re-renders from the durability store before an effect's queued
  // update applies, and in that render What's New auto-opened over the prompt.
  const [onboardingSeenAtLastRender, setOnboardingSeenAtLastRender] = useState(hasSeenOnboarding);
  if (onboardingSeenAtLastRender !== hasSeenOnboarding) {
    setOnboardingSeenAtLastRender(hasSeenOnboarding);
    if (hasSeenOnboarding && history.length === 0) setShowGameMode(true);
  }

  const startupHash = typeof window === 'undefined' ? '' : window.location.hash;
  const hasPendingSyncPrompt = showSyncCode
    || (startupHash.startsWith('#sync=') && startupHash.length > '#sync='.length)
    || !!runelitePairCode;
  const hasPendingGameModePrompt = showGameMode
    || recentlyCreatedId === activeProfileId;
  useEffect(() => {
    if (
      showChangelog
      || !mayAutoOpenChangelogAgain(changelogAutoOpenedRelease.current === changelogAutoOpenKey, hasPendingOffer)
      || !shouldAutoOpenChangelog({
        hasSeenOnboarding,
        releaseIsUnseen: shouldShowChangelog(LATEST_CHANGELOG_ID),
        startupHash,
        hasPendingGameModePrompt,
        hasPendingSyncPrompt,
        hasPendingGuidePrompt: showRuneliteGuide,
        hasPendingCompensation: hasPendingOffer,
      })
    ) return;

    changelogAutoOpenedRelease.current = changelogAutoOpenKey;
    dispatchChangelog({ type: 'OPEN' });
  }, [
    activeProfileId,
    changelogAutoOpenKey,
    hasPendingOffer,
    hasPendingGameModePrompt,
    hasPendingSyncPrompt,
    hasSeenOnboarding,
    recentlyCreatedId,
    showChangelog,
    showRuneliteGuide,
    startupHash,
  ]);

  // Escape closes whichever top-level modal is open.
  const anyModalOpen = showStats || showReference || showAltar
    || showOracle || showStrategy || showSupplyChain || showGameMode
    || showSyncCode || !!runelitePairCode;
  const topLevelGuideOpen = showChangelog || showRuneliteGuide;
  useEscapeKey(() => {
    setShowStats(false);
    setShowReference(false);
    setShowAltar(false);
    setShowOracle(false);
    setShowStrategy(false);
    setShowSupplyChain(false);
    setShowGameMode(false);
    setShowSyncCode(false);
    setRunelitePairCode(null);
    setRunelitePairPhase('confirm');
    setRunelitePairError(undefined);
  }, shouldEnableUnderlyingModalEscape(anyModalOpen, topLevelGuideOpen));
  const modalRenderPolicy = resolveChangelogModalRenderPolicy(topLevelGuideOpen);

  // Shared between the classic grid and the OSRS frame (same components, same props).
  const headerEl = (
    <Header
      setShowAltar={setShowAltar}
      setShowStats={setShowStats}
      setShowReference={setShowReference}
      setShowOracle={setShowOracle}
      setShowStrategy={setShowStrategy}
      setShowSupplyChain={setShowSupplyChain}
      setShowGameMode={setShowGameMode}
      setShowSyncCode={setShowSyncCode}
      setShowDiscord={setShowDiscord}
      onOpenRuneliteGuide={openRuneliteGuide}
      onOpenChangelog={openChangelog}
    />
  );
  const journalCardEl = (
    <PanelErrorBoundary name="Journal summary">
      <JournalSummaryCard
        onNavClick={(tab) =>
          window.dispatchEvent(new CustomEvent('navigate-journal', { detail: { tab } }))
        }
      />
    </PanelErrorBoundary>
  );
  const controlPanelEl = (
    <PanelErrorBoundary name="Control panel">
      <ControlPanel suspendModals={modalRenderPolicy.suspendDashboardModals} />
    </PanelErrorBoundary>
  );
  const dashboardEl = (
    <PanelErrorBoundary name="Dashboard">
      <Dashboard suspendModals={modalRenderPolicy.suspendDashboardModals} />
    </PanelErrorBoundary>
  );

  return (
    <div className={isOsrs
      ? 'osrs-shell min-h-screen bg-osrs-bg text-osrs-text font-sans selection:bg-osrs-gold selection:text-black relative'
      : 'min-h-screen bg-osrs-bg text-osrs-text pb-6 font-sans selection:bg-osrs-gold selection:text-black relative'}>
      <EffectsLayer />
      <OnlineSyncDriver />
      <Suspense fallback={null}><OnlineBackupDriver /></Suspense>
      {/* Quietly asks the browser to keep site storage at the run's first roll. */}
      <Suspense fallback={null}><PersistentStorageDriver /></Suspense>
      <Suspense fallback={null}><RollInboxDriver /></Suspense>
      {(petsClaimed?.length ?? 0) > 0 && <Suspense fallback={null}><PetFollower /></Suspense>}
      {/* Progressive-disclosure watcher — always mounted (same rule as
          RollInboxDriver): detected events must queue from every screen. */}
      <FeatureRevealDriver />
      {/* OSRS layout: right-click menu (Examine), mounted once. */}
      {isOsrs && <Suspense fallback={null}><OsrsContextMenu /></Suspense>}


      {/* Shared notification stacks: every toast/reveal portals into one of
          these so they queue cleanly instead of overlapping in a corner. */}
      <div id="reveal-top" className="fixed top-24 right-5 z-[9998] flex flex-col gap-3 items-end pointer-events-none" />
      <div id="reveal-bottom" className="fixed bottom-5 right-5 z-[9997] flex flex-col-reverse gap-3 items-end pointer-events-none" />
      <ToastNotification />

      <Suspense fallback={null}>
        {!hasSeenOnboarding && !topLevelGuideOpen && <OnboardingWizard />}

        {activeRitual && (
          <RitualAnimation key={activeRitual.id} ritual={activeRitual.ritual} meta={activeRitual.meta}
            ownedChunks={unlocks.chunks ?? []} onComplete={() => setActiveRitual(null)} />
        )}
      </Suspense>

      <Suspense fallback={<ModalFallback />}>
        {modalRenderPolicy.renderAppModals && (
          <>
            {showAltar && <VoidAltar onClose={() => setShowAltar(false)} />}
            {showStats && <StatsModal onClose={() => setShowStats(false)} />}
            {showFateThread && <FateThread onClose={() => setShowFateThread(false)} />}
            {showReference && <ReferenceModal onClose={() => setShowReference(false)} />}
            {showOracle && <OracleSearch onClose={() => setShowOracle(false)} />}
            {showStrategy && <StrategyGuide onClose={() => setShowStrategy(false)} />}
            {showSupplyChain && <SupplyChainCalculator initialQuery={supplyChainPreset} onClose={() => { setShowSupplyChain(false); setSupplyChainPreset(undefined); }} />}
            {showGameMode && <GameModePicker onClose={() => setShowGameMode(false)} />}
            {showSyncCode && <SyncCodeModal onClose={() => { setShowSyncCode(false); setSyncImportCode(undefined); setSyncInitialTab(undefined); }} initialImportCode={syncImportCode} initialTab={syncInitialTab} />}
            {showGallery && <ModelGallery onClose={() => setShowGallery(false)} />}
            {showDiscord && <DiscordSettingsModal onClose={() => setShowDiscord(false)} />}
          </>
        )}
        {showRuneliteGuide && (
          <RunelitePluginGuide
            onClose={closeRuneliteGuide}
            returnFocusTarget={runeliteGuideReturnFocusTarget.current}
          />
        )}
        {showChangelog && (
          <ChangelogModal
            onClose={closeChangelog}
            compensation={fateCompensation}
            onResolveCompensation={resolveCompensation}
            petCompensation={petCompensation}
            petsClaimed={petsClaimed}
            petGambitStake={gambitStakeFor(resolveModeRules(gameModeId, customMode))}
            petRollTimes={petCompensation.status === 'pending' ? earlierPetRollTimes(history) : undefined}
            onResolvePetCompensation={resolvePets}
            returnFocusTarget={changelogReturnFocusTarget.current}
          />
        )}
      </Suspense>

      {!isOsrs && headerEl}

      {!isOsrs && <ProfileRecoveryBanner />}

      {!isOsrs && <SaveConflictBanner />}

      {/* Compact durability status for ordinary saves and degraded recovery. */}
      {!isOsrs && !dualStorageFailure && (
        <SaveDurabilityStatus
          snapshot={effectiveDurability}
          retrySave={retrySave}
          exportBackup={exportBackup}
        />
      )}

      {!isOsrs && <SaveFailureBanner />}

      {/* Says when the RuneLite profile couldn't be sent, and when it's tried again. */}
      {!isOsrs && <Suspense fallback={null}><RelayPublishBanner /></Suspense>}

      <Suspense fallback={null}>
        {/* Global ⌘K command palette — navigates via fate:nav events. */}
        {modalRenderPolicy.renderGlobalDialogOverlays && <CommandPalette />}
        {/* Replayable spotlight tour — start via fate:start-tour. */}
        {modalRenderPolicy.renderGlobalDialogOverlays && <GuidedTour gameModeId={gameModeId} />}
        {/* Quest-complete celebration with the wiki reward scroll. */}
        {modalRenderPolicy.renderGlobalDialogOverlays && <QuestCompleteOverlay />}
      </Suspense>
      {modalRenderPolicy.renderGlobalDialogOverlays && runelitePairCode && (
        <Suspense fallback={null}>
        <RunelitePairingDialog
          code={runelitePairCode}
          replacing={relaySync.enabled}
          profileName={activeProfileName}
          linkedAccount={linkedAccount ?? null}
          phase={runelitePairPhase}
          error={runelitePairError}
          onConfirm={() => {
            if (!relaySync.adoptCode(runelitePairCode, activeProfileId)) {
              setRunelitePairPhase('confirm');
              setRunelitePairError(
                'This connection could not be saved. Try again.',
              );
              return;
            }
            setRunelitePairPhase('uploading');
            setRunelitePairError(undefined);
          }}
          onRetry={() => {
            if (relaySync.requestPush()) {
              setRunelitePairPhase('uploading');
              setRunelitePairError(undefined);
            } else {
              setRunelitePairPhase('error');
              setRunelitePairError(
                'This connection is no longer active.',
              );
            }
          }}
          onClose={closeRunelitePairing}
        />
        </Suspense>
      )}

      {/* One contextual "next step" hint under the header — teaches the loop. */}
      {!isOsrs && <CoachStrip />}

      {/* Asks once per run whether to turn on online backup. */}
      {!isOsrs && <Suspense fallback={null}><OnlineBackupPrompt /></Suspense>}
      {/* Dismissible "export a .fate backup" reminder for unbacked-up runs. */}
      {!isOsrs && <Suspense fallback={null}><BackupNagBanner /></Suspense>}
      {/* Posts new unlocks to the profile's Discord webhook (if configured). */}
      <DiscordSyncDriver />
      {/* Keeps the run's shared progress current for the Discord bot's /progress (if sharing is on). */}
      <Suspense fallback={null}><ProgressShareDriver /></Suspense>

      {/* Main Command Center Layout */}
      {isOsrs ? (
        /* The OSRS layout: header, parchment line, one screen, docked chatbox,
           all inside the window (components/osrs/OsrsShellFrame.tsx). */
        <Suspense fallback={null}>
          <OsrsShellFrame
            header={headerEl}
            criticalBanners={<><ProfileRecoveryBanner /><SaveConflictBanner /><SaveFailureBanner /></>}
            journalCard={journalCardEl}
            keysPanel={controlPanelEl}
            progression={dashboardEl}
            durability={effectiveDurability}
            showDurability={!dualStorageFailure}
            retrySave={retrySave}
            exportBackup={exportBackup}
          />
        </Suspense>
      ) : (
      <main className="max-w-[1600px] mx-auto px-4 py-4 h-[calc(100vh-80px)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full">

          {/* LEFT: Journal summary + Interaction & Control (35%).
              The journal summary lives here (rather than inside a Dashboard tab)
              so it stays visible across every tab switch. Clicking a row fires a
              `navigate-journal` event the Dashboard listens for. */}
          <div className="lg:col-span-4 h-full min-h-[500px] flex flex-col gap-4">
            <div className="shrink-0">
              {journalCardEl}
            </div>
            <div className="flex-1 min-h-0">
              {controlPanelEl}
            </div>
          </div>

          {/* RIGHT: Dashboard Visualization (65%) */}
          <div className="lg:col-span-8 h-full min-h-[500px] flex flex-col gap-4">
             <div className="flex-1 overflow-hidden h-full">
               {dashboardEl}
             </div>
          </div>

        </div>
      </main>
      )}
    </div>
  );
};

const ProfileEvictionBridge: React.FC<{ profileId: string }> = ({ profileId }) => {
  const { registerProfileEvictionHandler } = useProfiles();
  const { stageForProfileEviction } = useGame();

  useLayoutEffect(() => registerProfileEvictionHandler(removedProfileId => {
    if (removedProfileId === profileId) stageForProfileEviction();
  }), [profileId, registerProfileEvictionHandler, stageForProfileEviction]);

  return null;
};

/** Bridge reads profile context and passes storageKey to GameProvider.
 *  key={activeProfileId} forces a clean remount when switching profiles. */
const GameProviderBridge: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    activeProfileId,
    metadataReadOnly,
    storageKeyForActiveProfile,
  } = useProfiles();
  // Every tab shares the RuneLite pairing; only a tab showing the paired
  // profile publishes it. Set before anything below reads relaySync.enabled.
  relaySync.setActiveProfile(activeProfileId);
  return (
    <SaveBootstrap profileId={activeProfileId} storageKey={storageKeyForActiveProfile}>
      {bootstrap => (
        <GameProvider
          key={activeProfileId}
          readOnly={metadataReadOnly}
          storageKey={storageKeyForActiveProfile}
          bootstrap={bootstrap}
        >
          <ProfileEvictionBridge profileId={activeProfileId} />
          {children}
        </GameProvider>
      )}
    </SaveBootstrap>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ProfileProvider>
        <SaveRecoveryGuard />
        <GameProviderBridge>
          <GameLayout />
        </GameProviderBridge>
      </ProfileProvider>
      <UpdateBanner />
    </ErrorBoundary>
  );
}

export default App;
