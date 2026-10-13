import React, { Suspense, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useProfiles } from '../../context/ProfileContext';
import { useFeatureGates } from '../../hooks/useFeatureGates';
import { getGameMode, resolveModeRules } from '../../config/gameModes';
import { DISCORD_INVITE_URL } from '../../constants';
import { RESET_CONFIRM_MESSAGE } from '../../utils/backups';
import { FATE_EXPORT_HINT } from '../../utils/fateSaveFile';
import { setUiStyle, useUiStyle } from '../../utils/uiStyle';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { ProfileSwitcher } from '../ProfileSwitcher';
import { OsrsXpDrops } from './OsrsXpDrops';
import './osrs-shell.css';

const OsrsInterfaceOptions = lazyWithRetry(() => import('./OsrsInterfaceOptions'));

const sprite = (file: string) => `${import.meta.env.BASE_URL}osrs-ui/items/${file}`;

export interface OsrsHeaderProps {
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
  /** The classic header's handlers, shared so every button does the same thing. */
  onImportSave: () => void;
  onExportSave: () => void;
  onRuneliteExport: () => void;
}

/* Small stroked icons in the stone buttons' text colour (orange, white on hover). */
const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">{children}</svg>
);
const SearchIcon = () => <Svg><circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l4.5 4.5" /></Svg>;
const CompassIcon = () => <Svg><circle cx="8" cy="8" r="6" /><path d="M10.5 5.5L9 9l-3.5 1.5L7 7z" fill="currentColor" strokeWidth="1" /></Svg>;
const EngineIcon = () => <Svg><ellipse cx="8" cy="3.5" rx="5.5" ry="2" /><path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" /></Svg>;
const StatsIcon = () => <Svg><path d="M2 14V8M6 14V3M10 14V6M14 14V10" strokeWidth="2.5" /></Svg>;
const ModeIcon = () => <Svg><path d="M2 4h12M2 8h12M2 12h12" /><path d="M5 2.5v3M11 6.5v3M7 10.5v3" strokeWidth="2.5" /></Svg>;
const GearIcon = () => <Svg><circle cx="8" cy="8" r="2.5" /><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" /></Svg>;

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/**
 * The OSRS layout's header: run name, the Fate Points orb, the Key stacks as
 * item slots, and the classic header's buttons as stone buttons. It reads the
 * same game state as the classic header and calls the same handlers.
 */
export const OsrsHeader: React.FC<OsrsHeaderProps> = ({
  setShowAltar, setShowStats, setShowReference, setShowOracle, setShowStrategy, setShowSupplyChain,
  setShowGameMode, setShowSyncCode, setShowDiscord, onOpenRuneliteGuide, onOpenChangelog,
  onImportSave, onExportSave, onRuneliteExport,
}) => {
  const uiStyle = useUiStyle();
  const {
    keys, specialKeys, chaosKeys, fatePoints, activeBuff, animationsEnabled, toggleAnimations,
    advisorsEnabled, toggleAdvisors, resetGame, gameModeId, customMode, linkedAccount,
  } = useGame();
  const gates = useFeatureGates();
  const { activeProfileName } = useProfiles();
  const pityRules = resolveModeRules(gameModeId, customMode);
  const pityCap = pityRules.pityEnabled ? pityRules.pityThreshold : 50; // 50 = visual-only fallback
  const nearPity = pityRules.pityEnabled && fatePoints >= pityRules.pityThreshold * 0.8;
  const fill = Math.max(0, Math.min(100, (fatePoints / pityCap) * 100));
  const [showMenu, setShowMenu] = useState(false);
  const settingsRef = useRef<HTMLButtonElement>(null);
  const runName = [`${getGameMode(gameModeId).name} mode`, linkedAccount || activeProfileName].filter(Boolean).join(' · ');

  const fateTitle = pityRules.pityEnabled
    ? `Fate Points: failed rolls build these, and at ${pityRules.pityThreshold} you get a guaranteed Pity Key. You can also spend them on rituals at the Altar.`
    : 'Fate Points: failed rolls build these. Spend them on rituals at the Altar.';
  const fateText = pityRules.pityEnabled ? `Fate ${fatePoints}/${pityRules.pityThreshold}` : `${fatePoints} Fate`;

  const closeThen = (run: () => void) => () => { setShowMenu(false); run(); };
  const onOff = (on: boolean) => (
    <span className="osrs-menu-state" style={{ color: on ? '#00ff00' : '#ff3030' }}>{on ? 'on' : 'off'}</span>
  );

  return (
    <header className="osrs-hdr-bar">
      <div className="osrs-hdr-wrap">
        <div className="osrs-win osrs-hdr">
          {/* Run name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
              <img className="osrs-px" src={sprite('key.png')} alt="" aria-hidden="true" width={36} height={32} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <h1 className="osrs-hdr-title" style={{ margin: 0 }}>Fate Locked Ironman</h1>
              <span className="osrs-hdr-sub">{runName}</span>
            </div>
            <ProfileSwitcher />
          </div>

          {/* Fate Points orb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} title={fateTitle} role="img" aria-label={fateText}>
            <div className="osrs-orb-num" style={nearPity ? { color: '#ff0000' } : undefined}>{fatePoints}</div>
            <div className="osrs-orb" style={{ background: `conic-gradient(${nearPity ? '#c42f2f' : '#8a3fc4'} 0 ${fill}%, #2a1f33 ${fill}% 100%)` }}>
              <img className="osrs-px" src={sprite('void_seal.png')} alt="" aria-hidden="true" width={27} height={24} />
            </div>
            <span className="osrs-sh" style={{ font: "16px 'RSSmall', sans-serif", color: nearPity ? '#ff3030' : 'var(--osrs-tan, #c8b897)', marginLeft: 4, whiteSpace: 'nowrap' }}>{fateText}</span>
          </div>

          {/* Key stacks, with the XP drops rising past them */}
          <div data-tour="keys" style={{ position: 'relative', display: 'flex', gap: 4 }}>
            <div className="osrs-slot" style={{ width: 44, height: 40 }} title="Keys: spend one on a table in Spend Keys for a random unlock">
              <img className="osrs-px" src={sprite('key.png')} alt="Keys" width={36} height={32} />
              <span className="osrs-stack">{keys}</span>
            </div>
            <div className="osrs-slot" style={{ width: 44, height: 40 }} title={`Omni-Keys: click a locked entry on the Dashboard to unlock exactly that.${gameModeId === 'chunked' ? ' In Chunked, land only comes from Chunk unlocks and the Ritual of the Cartographer.' : ''}`}>
              <img className="osrs-px" src={sprite('omni_key.png')} alt="Omni-Keys" width={36} height={32} style={specialKeys > 0 ? undefined : { opacity: 0.45 }} />
              <span className="osrs-stack">{specialKeys}</span>
            </div>
            <div className="osrs-slot" style={{ width: 44, height: 40 }} title="Chaos Keys: each one unlocks a random entry from all the tables at once">
              <img className="osrs-px" src={sprite('chaos_key.png')} alt="Chaos Keys" width={36} height={32} style={chaosKeys > 0 ? undefined : { opacity: 0.45 }} />
              <span className="osrs-stack">{chaosKeys}</span>
            </div>
            <OsrsXpDrops />
          </div>

          {/* Controls: the classic header's buttons */}
          <div className="osrs-hdr-controls">
            {gates.has('tool:altar') && (
              <button
                type="button"
                data-tour="altar"
                onClick={() => setShowAltar(true)}
                className={`osrs-btn osrs-hbtn${activeBuff !== 'NONE' ? ' is-on' : ''}`}
                style={{ paddingLeft: 6, color: activeBuff === 'NONE' ? '#c77dff' : activeBuff === 'GREED' ? '#ffff00' : '#ffffff' }}
                title={activeBuff === 'NONE' ? 'Void Altar' : `Void Altar: ${titleCase(activeBuff)} is active`}
              >
                <img className="osrs-px" src={sprite('void_seal.png')} alt="" aria-hidden="true" width={27} height={24} />
                {activeBuff === 'NONE' ? 'Void Altar' : titleCase(activeBuff)}
              </button>
            )}

            <button
              type="button"
              data-tour="palette"
              className="osrs-jump"
              onClick={event => window.dispatchEvent(new CustomEvent('fate:open-palette', {
                detail: { returnFocusTarget: event.currentTarget },
              }))}
              title="Command palette — jump to anything"
            >
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="#c8b897" strokeWidth="2" /></svg>
              <span>Jump to...</span>
              <kbd>⌘K</kbd>
            </button>

            <button
              type="button"
              onClick={onRuneliteExport}
              className="osrs-btn osrs-hbtn"
              title="Export your run for the RuneLite plugin (copies to clipboard + downloads). Then use 'Import from clipboard' in the plugin."
            >
              RuneLite
            </button>

            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Join the Fate Locked Discord"
              title="Join the Fate Locked Discord"
              className="osrs-btn osrs-hbtn"
            >
              Discord
            </a>

            <div data-reveal="tools" style={{ display: 'flex', gap: 2 }}>
              <button type="button" onClick={() => setShowOracle(true)} className="osrs-btn osrs-ibtn" title="Oracle — search content" aria-label="Oracle — search content"><SearchIcon /></button>
              {gates.has('tool:strategy') && <button type="button" onClick={() => setShowStrategy(true)} className="osrs-btn osrs-ibtn" title="Strategy Guide" aria-label="Strategy Guide"><CompassIcon /></button>}
              {gates.has('tool:supply') && <button type="button" onClick={() => setShowSupplyChain(true)} className="osrs-btn osrs-ibtn" title="Resource Engine" aria-label="Resource Engine"><EngineIcon /></button>}
              {gates.has('tool:stats') && <button type="button" onClick={() => setShowStats(true)} className="osrs-btn osrs-ibtn" title="Fate Analytics" aria-label="Fate Analytics"><StatsIcon /></button>}
              <button type="button" onClick={() => setShowReference(true)} className="osrs-btn osrs-ibtn" title="Rules" aria-label="Rules" style={{ fontFamily: "'RSBold', sans-serif" }}>?</button>
              <button type="button" onClick={() => setShowGameMode(true)} className="osrs-btn osrs-ibtn" title="Game Mode" aria-label="Game Mode"><ModeIcon /></button>
            </div>

            <div style={{ position: 'relative', height: 34 }}>
              <button
                ref={settingsRef}
                type="button"
                onClick={() => setShowMenu(v => !v)}
                className={`osrs-btn osrs-ibtn${showMenu ? ' is-on' : ''}`}
                title="Settings & save tools"
                aria-label="Settings & save tools"
                aria-expanded={showMenu}
              >
                <GearIcon />
              </button>
              {showMenu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowMenu(false)} />
                  <div className="osrs-win osrs-menu">
                    <div className="osrs-title osrs-menu-title">Settings</div>
                    <div className="osrs-inner osrs-menu-list">
                      <button type="button" className="osrs-menu-item" onClick={closeThen(() => onOpenRuneliteGuide(settingsRef.current))}>RuneLite Plugin Guide</button>
                      <button type="button" className="osrs-menu-item" onClick={closeThen(() => onOpenChangelog(settingsRef.current))}>What's New</button>
                      <div className="osrs-menu-sep" />
                      <button type="button" className="osrs-menu-item" onClick={() => toggleAnimations()} aria-pressed={animationsEnabled}>Animations {onOff(animationsEnabled)}</button>
                      <button type="button" className="osrs-menu-item" onClick={() => setUiStyle(uiStyle === 'osrs' ? 'classic' : 'osrs')} aria-pressed={uiStyle === 'osrs'}>OSRS layout {onOff(uiStyle === 'osrs')}</button>
                      {uiStyle === 'osrs' && <Suspense fallback={null}><OsrsInterfaceOptions /></Suspense>}
                      <button type="button" className="osrs-menu-item" onClick={() => toggleAdvisors()} aria-pressed={advisorsEnabled}>Advisor panels {onOff(advisorsEnabled)}</button>
                      <div className="osrs-menu-sep" />
                      <button type="button" className="osrs-menu-item" onClick={closeThen(onImportSave)}>Import save</button>
                      <button type="button" className="osrs-menu-item" onClick={closeThen(onExportSave)} title={FATE_EXPORT_HINT}>Export save file (.fate)</button>
                      <button type="button" className="osrs-menu-item" onClick={closeThen(() => setShowSyncCode(true))}>Sync code (move device)</button>
                      <button type="button" className="osrs-menu-item" onClick={closeThen(() => setShowDiscord(true))}>Discord notifications</button>
                      <div className="osrs-menu-sep" />
                      <button type="button" className="osrs-menu-item is-danger" onClick={closeThen(() => { if (window.confirm(RESET_CONFIRM_MESSAGE)) void resetGame(); })}>Reset all progress</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default OsrsHeader;
