import React, { Suspense, useEffect } from 'react';
import { useOsrsNav, getOsrsNav, openOsrsScreen, screenForJump } from '../../utils/osrsNav';
import { lazyWithRetry } from '../../utils/lazyRetry';
import type { SaveDurabilitySnapshot, SaveRetryResult } from '../../utils/recoveryTypes';
import type { FateSaveDownloadResult } from '../../utils/fateSaveFile';
import { OsrsShellNotice } from './OsrsShellNotice';
import { OsrsChatbox } from './OsrsChatbox';
import { PanelErrorBoundary } from '../PanelErrorBoundary';
import './osrs-shell.css';

const OsrsKeysWorkspace = lazyWithRetry(() => import('./OsrsKeysWorkspace'));
const OsrsJournalScreen = lazyWithRetry(() => import('./OsrsJournalScreen'));

export interface OsrsShellFrameProps {
  /** The app header (App's Header, which renders OsrsHeader in this layout). */
  header: React.ReactNode;
  /** Rare, critical classic banners (save conflict / failure, profile recovery). */
  criticalBanners: React.ReactNode;
  /** Home screen, left column: the Journal card. */
  journalCard: React.ReactNode;
  /** Home screen, left column: the Keys panel (ControlPanel). */
  keysPanel: React.ReactNode;
  /** Home screen, right: the Progression window (Dashboard). */
  progression: React.ReactNode;
  /** Save status, for the parchment line (shown only when something is wrong). */
  durability: SaveDurabilitySnapshot;
  showDurability: boolean;
  retrySave?: () => SaveRetryResult | Promise<SaveRetryResult>;
  exportBackup: () => FateSaveDownloadResult | void;
}

/**
 * The OSRS layout's full-window frame (Main board): the header, the parchment
 * game-message line, the screen body, and the docked chatbox, all inside the
 * window height. The body shows one screen from utils/osrsNav.ts:
 *   home    - left column (Journal card above the Keys panel) + Progression;
 *             the left column hides while a full-width Progression tab shows
 *   keys    - the wide Keys interface
 *   journal - the full Journal window
 * Home stays mounted while another screen shows, so its tabs, filters and
 * scroll positions survive the round trip. Each region has its own Suspense
 * boundary, so a lazy chunk loading inside one never blanks the whole frame.
 */
export const OsrsShellFrame: React.FC<OsrsShellFrameProps> = ({
  header, criticalBanners, journalCard, keysPanel, progression,
  durability, showDurability, retrySave, exportBackup,
}) => {
  const { screen, progressionWide } = useOsrsNav();
  const home = screen === 'home';
  // Jumps fired from the Journal or Keys screen (palette, chat hints, "Show on
  // map", "Plan a route") change the hidden home screen; bring it into view.
  // Capture phase, so the screen switches before the home screen's own
  // listeners act (a tab:JOURNAL jump then reopens the Journal screen).
  useEffect(() => {
    const follow = (target: string) => {
      const next = screenForJump(target, getOsrsNav());
      if (next) openOsrsScreen(next);
    };
    const onNav = (e: Event) => follow((e as CustomEvent<{ target?: string }>).detail?.target ?? '');
    const onPlanGoal = () => follow('plan-goal');
    window.addEventListener('fate:nav', onNav, true);
    window.addEventListener('fate:plan-goal', onPlanGoal, true);
    return () => {
      window.removeEventListener('fate:nav', onNav, true);
      window.removeEventListener('fate:plan-goal', onPlanGoal, true);
    };
  }, []);
  return (
    <div className="osrs-shell-frame">
      <Suspense fallback={<div style={{ height: 64 }} />}>{header}</Suspense>
      <OsrsShellNotice
        durability={durability}
        showDurability={showDurability}
        retrySave={retrySave}
        exportBackup={exportBackup}
      />
      {criticalBanners}
      <div className="osrs-shell-body">
        <div
          className={`osrs-shell-grid${progressionWide ? ' is-wide' : ''}`}
          hidden={!home}
          data-osrs-screen="home"
        >
          <div className="osrs-shell-left" hidden={progressionWide}>
            <div className="osrs-shell-journal" data-osrs-journal-card=""><Suspense fallback={null}>{journalCard}</Suspense></div>
            <div className="osrs-shell-keys" data-osrs-keys-panel=""><Suspense fallback={null}>{keysPanel}</Suspense></div>
          </div>
          <div className="osrs-shell-right"><Suspense fallback={null}>{progression}</Suspense></div>
        </div>
        {screen === 'keys' && (
          <div className="osrs-shell-screen" data-osrs-screen="keys">
            <Suspense fallback={null}><OsrsKeysWorkspace /></Suspense>
          </div>
        )}
        {screen === 'journal' && (
          <div className="osrs-shell-screen" data-osrs-screen="journal">
            <Suspense fallback={null}><OsrsJournalScreen /></Suspense>
          </div>
        )}
      </div>
      <PanelErrorBoundary name="Chatbox"><OsrsChatbox /></PanelErrorBoundary>
    </div>
  );
};

export default OsrsShellFrame;
