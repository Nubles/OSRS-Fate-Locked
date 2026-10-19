import React, { useEffect } from 'react';
import { setOsrsProgressionTabs } from '../../utils/osrsNav';
import { SectionGuide } from '../SectionGuide';
import { ActivityAccessWarning } from '../ActivityAccessWarning';
import type { TableType, UnlockState } from '../../types';
import { itemSrc } from './OsrsDashGems';
import './osrs-dashboard.css';

/**
 * OSRS layout of the Progression window's chrome (Main board): the title row
 * ("Progression", the mode badge and the tool buttons) and the tab strip with
 * the unlock filter. Every control calls the same handler the classic header
 * does; Dashboard passes them in. The run's % complete (a ring and bar in the
 * classic header) is on the title: hover it, or right-click > Examine.
 */

export interface OsrsDashTab { id: string; label: string }

interface HeaderProps {
  modeName: string;
  modeDescription?: string;
  /** The achievement title the player wears, if any. */
  wornTitle?: { title: string; description: string };
  specialKeys: number;
  goalPlanner: { label: string; title: string };
  onGoalPlanner: () => void;
  onAchievements: () => void;
  onForecast: () => void;
  onFateThread: () => void;
  /** The Rival button (only when the Rival feature is on). */
  rival?: React.ReactNode;
  onKillPlanner: () => void;
  onShareRun: () => void;
  completionPercent: number;
}

export const OsrsDashHeader: React.FC<HeaderProps> = ({
  modeName, modeDescription, wornTitle, specialKeys, goalPlanner, onGoalPlanner, onAchievements, onForecast,
  onFateThread, rival, onKillPlanner, onShareRun, completionPercent,
}) => (
  <div className="osrs-dash-head shrink-0">
    <h2
      className="osrs-title osrs-dash-headtitle"
      title={`${completionPercent}% complete`}
      data-examine-name="Progression"
      data-examine={`Your run is ${completionPercent}% complete.`}
    >
      Progression
    </h2>
    <span className="osrs-dash-badge" title={modeDescription}>{modeName}</span>
    {wornTitle && (
      <button
        type="button"
        className="osrs-dash-badge is-title"
        onClick={onAchievements}
        title={`Your title, from the achievement "${wornTitle.title}": ${wornTitle.description}`}
      >
        {wornTitle.title}
      </button>
    )}
    {specialKeys > 0 && (
      <span className="osrs-dash-badge is-omni">
        <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={18} height={16} />
        Omni-Key Active
      </span>
    )}
    <div className="osrs-dash-tools">
      <button type="button" className="osrs-btn" onClick={onGoalPlanner} title={goalPlanner.title}>{goalPlanner.label}</button>
      <button type="button" className="osrs-btn" onClick={onAchievements} title="View achievements & milestones">Achievements</button>
      <button type="button" className="osrs-btn" onClick={onForecast} title="Forecast how long Fate will take to unlock something">Forecast</button>
      <button type="button" className="osrs-btn" onClick={onFateThread} title="See every unlock, grouped by table, and replay them in order">Fate Thread</button>
      {rival}
      <button type="button" className="osrs-btn" onClick={onKillPlanner} title="Plan boss kills: DPS, time-to-kill and readiness">Kill Planner</button>
      <button type="button" className="osrs-btn" onClick={onShareRun} title="Generate shareable run card">Share Run</button>
    </div>
  </div>
);

interface TabsProps {
  tabs: OsrsDashTab[];
  activeTab: string;
  onTab: (id: string) => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  showOnlyActionable: boolean;
  onToggleActionable: () => void;
  suspendModals: boolean;
  /** The "?" guide to show; the active tab's own guide when left out. */
  guideId?: string;
}

/** In-game tab names (the classic strip says "Collection Log"). */
const TAB_LABEL: Record<string, string> = { COLLECTION: 'Collection' };

export const OsrsDashTabs: React.FC<TabsProps> = ({
  tabs, activeTab, onTab, searchQuery, onSearch, showOnlyActionable, onToggleActionable, suspendModals, guideId,
}) => {
  const tabKey = tabs.map((t) => `${t.id}:${TAB_LABEL[t.id] ?? t.label}`).join('|');
  // The Journal screen draws the same tab row, so publish it.
  useEffect(() => {
    setOsrsProgressionTabs(tabs.map((t) => ({ id: t.id, label: TAB_LABEL[t.id] ?? t.label })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);
  return (
  <div className="osrs-dash-tabrow shrink-0">
    <div data-tour="dashtabs" role="tablist" aria-label="Dashboard sections" className="osrs-dash-tablist no-scrollbar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          data-dash-tab={TAB_LABEL[tab.id] ?? tab.label}
          data-first-hour={tab.id === 'JOURNAL' ? 'journal-tab' : tab.id === 'AUTOROLL' ? 'sync-tab' : undefined}
          aria-selected={activeTab === tab.id}
          className="osrs-tab"
          onClick={() => onTab(tab.id)}
        >
          {TAB_LABEL[tab.id] ?? tab.label}
        </button>
      ))}
    </div>
    <div className="osrs-dash-filter">
      <label className="osrs-dash-search">
        <svg aria-hidden="true" width="13" height="13" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5l3.5 3.5" stroke="#c8b897" strokeWidth="2" /></svg>
        <input type="text" placeholder="Filter unlocks..." aria-label="Filter unlocks" value={searchQuery} onChange={(e) => onSearch(e.target.value)} />
      </label>
      <button
        type="button"
        className={`osrs-btn${showOnlyActionable ? ' is-on' : ''}`}
        style={{ height: 26 }}
        aria-pressed={showOnlyActionable}
        onClick={onToggleActionable}
        title={showOnlyActionable ? 'Showing Actionable Only' : 'Show Actionable Content'}
      >
        <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M1 2h12L8.5 7.5V12l-3 1.5V7.5z" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
        Actionable
      </button>
      <SectionGuide id={guideId ?? activeTab} className="osrs-dash-guide" suspendModals={suspendModals} />
    </div>
  </div>
  );
};

interface ConfirmProps {
  item: string;
  table: TableType;
  unlocks: UnlockState;
  modeId: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** The Omni-Key confirmation, as an OSRS interface window over the dashboard. */
export const OsrsConfirmOmni: React.FC<ConfirmProps> = ({ item, table, unlocks, modeId, onCancel, onConfirm }) => (
  <div className="absolute inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,.6)' }}>
    <div className="osrs-win" role="dialog" aria-modal="true" aria-label="Confirm Unlock" style={{ width: 380, maxWidth: '100%', padding: 4 }}>
      <h3 className="osrs-title" style={{ margin: '2px 0 6px', textAlign: 'center' }}>Confirm Unlock</h3>
      <div className="osrs-inner" style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
            <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={36} height={32} />
          </span>
          <span className="osrs-sh" style={{ color: 'var(--osrs-purple, #c77dff)' }}>Omni-Key Required</span>
        </div>
        <p className="osrs-sh" style={{ margin: 0, color: 'var(--osrs-tan, #c8b897)', lineHeight: '18px' }}>
          Are you sure you want to use <span style={{ color: '#fff' }}>1 Omni-Key</span> to explicitly unlock <span style={{ color: 'var(--osrs-yellow, #ff0)' }}>{item}</span>?
        </p>
        <ActivityAccessWarning activity={item} table={table} unlocks={unlocks} modeId={modeId} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className="osrs-btn" style={{ flex: 1, height: 30 }} onClick={onCancel}>Cancel</button>
          <button type="button" className="osrs-btn" style={{ flex: 1, height: 30, color: 'var(--osrs-purple, #c77dff)' }} onClick={onConfirm}>Confirm</button>
        </div>
      </div>
    </div>
  </div>
);
