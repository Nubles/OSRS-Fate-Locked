import React, { Suspense, useEffect, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useProfiles } from '../../context/ProfileContext';
import { useFeatureGates } from '../../hooks/useFeatureGates';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { getGameMode, resolveModeRules } from '../../config/gameModes';
import { DISCORD_INVITE_URL } from '../../constants';
import { RESET_CONFIRM_MESSAGE } from '../../utils/backups';
import { FATE_EXPORT_HINT } from '../../utils/fateSaveFile';
import { setUiStyle, useUiStyle } from '../../utils/uiStyle';
import { setSkillOddsHover, useSkillOddsHover } from '../../utils/skillOddsPref';
import { clanBroadcastsPref, confirmSpendPref, tableOutlookPref, welcomeBackPref } from '../../utils/viewerPrefs';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { relaySync } from '../../services/relaySync';
import { ProfileSwitcher } from '../ProfileSwitcher';
import { FateMapOptions } from '../FateMapOptions';
import { OffDeviceCopyStatus } from '../OffDeviceCopyStatus';
import { OsrsXpDrops } from './OsrsXpDrops';
import { CHUNKED_OMNI_LAND_TEXT } from '../../config/economy';
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
const StatsIcon = () => <Svg><path d="M2 14V8M6 14V3M10 14V6M14 14V10" strokeWidth="2.5" /></Svg>;
const GearIcon = () => <Svg><circle cx="8" cy="8" r="2.5" /><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" /></Svg>;

const titleCase = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

/** RuneLite link state for the dot on the RuneLite button: null when not paired. */
const useRelayDot = (): { colour: string; label: string } | null => {
  const [, force] = useState(0);
  useEffect(() => relaySync.subscribe(() => force(value => value + 1)), []);
  if (!relaySync.enabled) return null;
  if (relaySync.status === 'error' || relaySync.failures > 0) return { colour: '#ff3030', label: 'RuneLite connected, but the last send failed' };
  if (relaySync.status === 'syncing') return { colour: '#ffff00', label: 'RuneLite connected, sending now' };
  return { colour: '#00ff00', label: 'RuneLite connected' };
};

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
  const skillOddsHover = useSkillOddsHover();
  const tableOutlook = tableOutlookPref.use();
  const confirmSpend = confirmSpendPref.use();
  const welcomeBack = welcomeBackPref.use();
  const clanBroadcasts = clanBroadcastsPref.use();
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
  const [showRlMenu, setShowRlMenu] = useState(false);
  const runeliteRef = useRef<HTMLButtonElement>(null);
  useEscapeKey(() => { setShowMenu(false); settingsRef.current?.focus(); }, showMenu);
  useEscapeKey(() => { setShowRlMenu(false); runeliteRef.current?.focus(); }, showRlMenu);
  const relayDot = useRelayDot();
  const settingsRef = useRef<HTMLButtonElement>(null);
  const mode = getGameMode(gameModeId);
  const runName = [`${mode.name} mode${mode.beta ? ' (Beta)' : ''}`, linkedAccount || activeProfileName].filter(Boolean).join(' · ');

  const fateTitle = pityRules.pityEnabled
    ? `Fate Points: failed rolls build these, and at ${pityRules.pityThreshold} you get a guaranteed Pity Key. You can also spend them on rituals at the Altar.`
    : 'Fate Points: failed rolls build these. Spend them on rituals at the Altar.';
  const fateText = pityRules.pityEnabled ? `Fate ${fatePoints}/${pityRules.pityThreshold}` : `${fatePoints} Fate`;

  const closeThen = (run: () => void) => () => { setShowMenu(false); run(); };
  const onOff = (on: boolean) => (
    <span className="osrs-menu-state" style={{ color: on ? '#00ff00' : '#ff3030' }}>{on ? 'on' : 'off'}</span>
  );

  return (
    <header className="osrs-win osrs-hdr">
      {/* Run name and profile */}
      <div className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
        <img className="osrs-px" src={sprite('key.png')} alt="" aria-hidden="true" width={36} height={32} />
      </div>
      <div className="osrs-hdr-titlebox" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <h1 className="osrs-hdr-title" style={{ margin: 0 }}>Fate Locked Ironman</h1>
        <span className="osrs-hdr-sub">{runName}</span>
      </div>
      <div className="osrs-hdr-profile" style={{ flexShrink: 0 }}><ProfileSwitcher /></div>

      {/* Fate Points orb */}
      <div className="osrs-tip" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 10, flexShrink: 0 }} data-osrs-tip={fateTitle} role="img" aria-label={`${fateText}. ${fateTitle}`}>
        <div className="osrs-orb-num" style={nearPity ? { color: '#ff0000' } : undefined}>{fatePoints}</div>
        <div className="osrs-orb" style={{ background: `conic-gradient(${nearPity ? '#c42f2f' : '#8a3fc4'} 0 ${fill}%, #2a1f33 ${fill}% 100%)` }}>
          <img className="osrs-px" src={sprite('void_seal.png')} alt="" aria-hidden="true" width={27} height={24} />
        </div>
        <span className="osrs-sh osrs-hdr-fate-text" style={{ font: "var(--osrs-fs) 'RSSmall', sans-serif", color: nearPity ? '#ff3030' : 'var(--osrs-tan, #c8b897)', marginLeft: 4, whiteSpace: 'nowrap' }}>{fateText}</span>
      </div>

      {/* Key stacks, with the XP drops rising past them */}
      <div data-tour="keys" style={{ position: 'relative', display: 'flex', gap: 4, marginLeft: 6, flexShrink: 0 }}>
        <div className="osrs-slot osrs-tip" style={{ width: 44, height: 40 }} data-osrs-tip={`Keys: ${keys}. Spend one on a table in Spend Keys for a random unlock.`} role="img" aria-label={`Keys: ${keys}`}>
          <img className="osrs-px" src={sprite('key.png')} alt="Keys" width={36} height={32} />
          <span className="osrs-stack">{keys}</span>
        </div>
        <div className="osrs-slot osrs-tip" style={{ width: 44, height: 40 }} data-osrs-tip={`Omni-Keys: ${specialKeys}. Click a locked entry on the Character, World or Activities tab to unlock exactly that.${gameModeId === 'chunked' ? ` ${CHUNKED_OMNI_LAND_TEXT}` : ''}`} role="img" aria-label={`Omni-Keys: ${specialKeys}`}>
          <img className="osrs-px" src={sprite('omni_key.png')} alt="Omni-Keys" width={36} height={32} />
          <span className="osrs-stack">{specialKeys}</span>
        </div>
        <div className="osrs-slot osrs-tip" style={{ width: 44, height: 40 }} data-osrs-tip={`Chaos Keys: ${chaosKeys}. For each one, fate picks a table, then a random entry in it.`} role="img" aria-label={`Chaos Keys: ${chaosKeys}`}>
          <img className="osrs-px" src={sprite('chaos_key.png')} alt="Chaos Keys" width={36} height={32} />
          <span className="osrs-stack">{chaosKeys}</span>
        </div>
        <OsrsXpDrops />
      </div>

      {/* Controls, in the board's order: Void Altar, Jump to, RuneLite, Stats, Rules, Settings.
          The classic header's other tools live in the Settings menu. */}
      <div className="osrs-hdr-controls">
        {gates.has('tool:altar') && (
          <button
            type="button"
            data-tour="altar"
            onClick={() => setShowAltar(true)}
            className={`osrs-btn osrs-hbtn${activeBuff !== 'NONE' ? ' is-on' : ''}`}
            style={{ padding: '0 12px 0 6px', color: activeBuff === 'NONE' ? '#c77dff' : activeBuff === 'GREED' ? '#ffff00' : '#ffffff' }}
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
          title="Command palette: jump to anything (Ctrl+K / ⌘K)"
          aria-label="Jump to anything (Ctrl+K)"
        >
          <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" style={{ flexShrink: 0 }}><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="#c8b897" strokeWidth="2" /></svg>
          <span>Jump to...</span>
        </button>

        {/* RuneLite opens a small menu: exporting copies + downloads a file,
            which a plain "RuneLite" button shouldn't do on one click. */}
        <div style={{ position: 'relative', height: 34, flexShrink: 0 }}>
          <button
            ref={runeliteRef}
            type="button"
            onClick={() => setShowRlMenu(v => !v)}
            className={`osrs-btn osrs-hbtn${showRlMenu ? ' is-on' : ''}`}
            style={{ height: 34 }}
            aria-expanded={showRlMenu}
            aria-haspopup="menu"
            title={`${relayDot ? `${relayDot.label}. ` : ''}RuneLite plugin: export your run or open the guide`}
          >
            {relayDot && <span className="osrs-rl-dot" style={{ background: relayDot.colour }} aria-hidden="true" />}
            RuneLite
            <svg aria-hidden="true" width="9" height="6" viewBox="0 0 9 6"><path d="M0 0h9L4.5 6z" fill="currentColor" /></svg>
          </button>
          {showRlMenu && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowRlMenu(false)} />
              <div className="osrs-win osrs-menu osrs-rl-menu" role="menu" aria-label="RuneLite">
                <div className="osrs-title osrs-menu-title">RuneLite</div>
                <div className="osrs-inner osrs-menu-list">
                  {relayDot && <div className="osrs-menu-note"><span className="osrs-rl-dot" style={{ background: relayDot.colour }} aria-hidden="true" /> {relayDot.label}</div>}
                  <button type="button" role="menuitem" className="osrs-menu-item" onClick={() => { setShowRlMenu(false); onRuneliteExport(); }} title="Copies your run to the clipboard and downloads it. Then use 'Import from clipboard' in the plugin.">Export run to RuneLite</button>
                  <button type="button" role="menuitem" className="osrs-menu-item" onClick={() => { setShowRlMenu(false); onOpenRuneliteGuide(runeliteRef.current); }}>RuneLite Plugin Guide</button>
                </div>
              </div>
            </>
          )}
        </div>

        {gates.has('tool:stats') && <button type="button" onClick={() => setShowStats(true)} className="osrs-btn osrs-ibtn" title="Fate Analytics" aria-label="Fate Analytics"><StatsIcon /></button>}
        <button type="button" onClick={() => setShowReference(true)} className="osrs-btn osrs-ibtn" title="Rules" aria-label="Rules" style={{ fontFamily: "'RSBold', sans-serif" }}>?</button>

        <div data-reveal="tools" style={{ position: 'relative', height: 34, flexShrink: 0 }}>
          <button
            ref={settingsRef}
            type="button"
            onClick={() => setShowMenu(v => !v)}
            className={`osrs-btn osrs-ibtn${showMenu ? ' is-on' : ''}`}
            title="Settings, tools & save"
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
                  {/* Tools the Main board's header has no room for (classic header buttons). */}
                  <button type="button" className="osrs-menu-item" onClick={closeThen(() => setShowOracle(true))}>Oracle (search content)</button>
                  {gates.has('tool:strategy') && <button type="button" className="osrs-menu-item" onClick={closeThen(() => setShowStrategy(true))}>Strategy Guide</button>}
                  {gates.has('tool:supply') && <button type="button" className="osrs-menu-item" onClick={closeThen(() => setShowSupplyChain(true))}>Resource Engine</button>}
                  <button type="button" className="osrs-menu-item" onClick={closeThen(() => setShowGameMode(true))}>Game Mode</button>
                  <a className="osrs-menu-item" href={DISCORD_INVITE_URL} target="_blank" rel="noreferrer" onClick={() => setShowMenu(false)} aria-label="Join the Fate Locked Discord">Discord</a>
                  <div className="osrs-menu-sep" />
                  <button type="button" className="osrs-menu-item" onClick={closeThen(() => onOpenRuneliteGuide(settingsRef.current))}>RuneLite Plugin Guide</button>
                  <button type="button" className="osrs-menu-item" onClick={closeThen(() => onOpenChangelog(settingsRef.current))}>What's New</button>
                  <div className="osrs-menu-sep" />
                  <button type="button" className="osrs-menu-item" onClick={() => toggleAnimations()} aria-pressed={animationsEnabled}>Animations {onOff(animationsEnabled)}</button>
                  {gameModeId === 'chunked' && <FateMapOptions osrs />}
                  <button type="button" className="osrs-menu-item" onClick={() => setUiStyle(uiStyle === 'osrs' ? 'classic' : 'osrs')} aria-pressed={uiStyle === 'osrs'}>OSRS layout {onOff(uiStyle === 'osrs')}</button>
                  {uiStyle === 'osrs' && <Suspense fallback={null}><OsrsInterfaceOptions /></Suspense>}
                  <button type="button" className="osrs-menu-item" onClick={() => toggleAdvisors()} aria-pressed={advisorsEnabled}>Advisor panels {onOff(advisorsEnabled)}</button>
                  <button type="button" className="osrs-menu-item" onClick={() => setSkillOddsHover(!skillOddsHover)} aria-pressed={skillOddsHover} title="On: a skill's roll odds show when you hover it. Off: they open from the small i in its corner.">Skill odds on hover {onOff(skillOddsHover)}</button>
                  <button type="button" className="osrs-menu-item" onClick={() => tableOutlookPref.set(!tableOutlook)} aria-pressed={tableOutlook} title="On: each table on Spend Keys says how many of its draws you could use straight away. A Key still draws from the whole table.">Table outlook {onOff(tableOutlook)}</button>
                  <button type="button" className="osrs-menu-item" onClick={() => confirmSpendPref.set(!confirmSpend)} aria-pressed={confirmSpend} title="On: Spend Keys asks Yes or No before each Key is spent.">Ask before spending {onOff(confirmSpend)}</button>
                  <button type="button" className="osrs-menu-item" onClick={() => welcomeBackPref.set(!welcomeBack)} aria-pressed={welcomeBack} title="On: after 12 hours or more away, a short note in the chatbox says what your last session did.">Welcome back note {onOff(welcomeBack)}</button>
                  <button type="button" className="osrs-menu-item" onClick={() => clanBroadcastsPref.set(!clanBroadcasts)} aria-pressed={clanBroadcasts} title="On: the chatbox has a Clan tab showing other players' unlocks from the Fate Locked Discord's #live-unlocks.">Clan broadcasts {onOff(clanBroadcasts)}</button>
                  <div className="osrs-menu-sep" />
                  <OffDeviceCopyStatus osrs />
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
    </header>
  );
};

export default OsrsHeader;
