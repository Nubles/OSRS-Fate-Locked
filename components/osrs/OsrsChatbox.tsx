import React, { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useProfiles } from '../../context/ProfileContext';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { isRollEntry } from '../../utils/logEntry';
import { TableType, type LogEntry } from '../../types';
import { ModalFallback } from '../LoadingFallback';
import { useOsrsNav } from '../../utils/osrsNav';
import { OsrsLevelUp, levelUpMessage, unlockCostType, type LevelUpMessage } from './OsrsLevelUp';
import { useOsrsChatNotices } from './OsrsShellChatNotices';
import { useFirstHourView, type FirstHourView } from '../../utils/firstHourStore';
import './osrs-shell.css';

const TimelapseModal = lazyWithRetry(() => import('../TimelapseModal').then(m => ({ default: m.TimelapseModal })));

/** The History panel's filters, as OSRS chat tabs ("Game" is its level-up filter). */
type ChatTab = 'All' | 'Game' | 'Rolls' | 'Unlocks' | 'Rituals';
const TABS: ChatTab[] = ['All', 'Game', 'Rolls', 'Unlocks', 'Rituals'];
const MATCH: Record<ChatTab, (entry: LogEntry) => boolean> = {
  All: () => true,
  Game: entry => entry.type === 'LEVEL_UP' || entry.type === 'XTREME_MILESTONE' || entry.type === 'FATE',
  Rolls: isRollEntry,
  Unlocks: entry => entry.type === 'UNLOCK',
  Rituals: entry => entry.type === 'ALTAR',
};

const MAX_LINES = 150;
const COLLAPSED_KEY = 'fate_osrs_chat_collapsed_v1';

const readCollapsed = (): boolean => {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
};
const writeCollapsed = (collapsed: boolean) => {
  try { localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0'); } catch { /* per-viewer convenience only */ }
};

/** Parchment text colours, as the game's chatbox uses them. */
const toneOf = (entry: LogEntry): string => {
  switch (entry.type) {
    case 'ROLL_SUCCESS': case 'PITY': case 'XTREME_MILESTONE': return '#005f00';
    case 'ROLL_FAIL': return '#7f0000';
    case 'ROLL_OMNI': case 'PET': return '#6a0090';
    case 'UNLOCK': return '#ff0000';
    case 'ALTAR': return entry.meta?.won === false ? '#7f0000' : '#6a0090';
    case 'LEVEL_UP': return Number(entry.meta?.chaosKeysAwarded ?? 0) > 0 ? '#ef1020' : '#000000';
    case 'COMPENSATION': return '#000080';
    case 'FATE': return '#6a0090';
    default: return '#000000';
  }
};

/** One history entry as a chat line: who, what (coloured), and the details. */
const ChatLine: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const lead = isRollEntry(entry) && entry.source ? `${entry.source}: `
    : entry.type === 'ALTAR' ? 'Void Altar: ' : entry.type === 'FATE' ? 'Fate: ' : '';
  const unlocked = entry.type === 'UNLOCK' && entry.message.startsWith('Unlocked ');
  const what = unlocked ? entry.message.slice('Unlocked '.length) : entry.message;
  const gap = /[.!?:]$/.test(entry.message) ? ' ' : '. ';
  const when = new Date(entry.timestamp).toLocaleString();
  return (
    <div className="osrs-chat-line" title={`${when}: ${lead}${entry.message}${entry.details ? gap + entry.details : ''}`}>
      {lead}{unlocked && 'Unlocked '}
      <span style={{ color: toneOf(entry) }}>{what}</span>
      {entry.details ? `${gap}${entry.details}` : ''}
    </div>
  );
};

/**
 * The guided first hour's instruction, as Tutorial Island gives them: it
 * fills the chatbox, title in blue, what to do in black, and a progress bar.
 * A finished step says what it taught and waits for "Click here to continue".
 */
const FirstHourInstruction: React.FC<{ view: FirstHourView }> = ({ view }) => (
  <div className="osrs-fh" role="status" aria-live="polite" aria-label={`First steps, step ${view.stepNumber} of ${view.stepCount}: ${view.title}`}>
    <div className="osrs-fh-side">
      <img className="osrs-px" src={view.icon} alt="" aria-hidden="true" />
    </div>
    <div className="osrs-fh-text">
      <span className="osrs-fh-title">{view.title}</span>
      <span className="osrs-fh-body">{view.body}</span>
      {view.phase === 'done' ? (
        <button type="button" className="osrs-lvl-cont" onClick={view.next}>Click here to continue</button>
      ) : (
        <span className="osrs-fh-foot">
          {view.counter && <span style={{ color: '#7f0000' }}>{view.counter}</span>}
          {view.optional && <button type="button" className="osrs-chat-link" onClick={view.skipStep}>Skip this step</button>}
        </span>
      )}
    </div>
    <div className="osrs-fh-meta">
      <span className="osrs-fh-step">Step {view.stepNumber} of {view.stepCount}</span>
      <span className="osrs-fh-bar" role="img" aria-label={`${view.percent}% done`}>
        <span style={{ width: `${view.percent}%` }} />
        <span className="osrs-fh-pct">{view.percent}%</span>
      </span>
      <button type="button" className="osrs-chat-link" onClick={view.skipGuide} title="Stop the guide for this run. Settings can turn it back on.">Skip guide</button>
    </div>
  </div>
);

/**
 * The OSRS layout's chatbox, docked at the bottom of the page: the run's
 * history (the same entries the History panel shows) as parchment chat lines,
 * with the History panel's filters as chat tabs. Clicking the selected tab
 * hides or shows it, as in the game. New unlocks show the level-up message
 * here once their reveal has been accepted.
 */
export const OsrsChatbox: React.FC = () => {
  const { history, lastEvent, unlocks, linkedAccount } = useGame();
  const { activeProfileName } = useProfiles();
  const [tab, setTab] = useState<ChatTab>('All');
  const { screen, progressionWide } = useOsrsNav();
  const notices = useOsrsChatNotices();
  const guide = useFirstHourView();
  // Home keeps the saved open/closed choice. The wide Keys and Journal screens
  // and the full-width Progression tabs are drawn without a chatbox, so there
  // it starts folded to its tab row.
  const [homeCollapsed, setHomeCollapsed] = useState(readCollapsed);
  const [otherCollapsed, setOtherCollapsed] = useState(true);
  const onHome = screen === 'home' && !progressionWide;
  const collapsed = onHome ? homeCollapsed : otherCollapsed;
  const [showTimelapse, setShowTimelapse] = useState(false);
  const [queue, setQueue] = useState<Array<{ id: string; message: LevelUpMessage }>>([]);
  const dockRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => setShowTimelapse(false), showTimelapse);

  // Level-up messages: only for unlocks that happen while the chatbox is up.
  const seenEvent = useRef(lastEvent?.id ?? null);
  useEffect(() => {
    if (!lastEvent || lastEvent.id === seenEvent.current) return;
    seenEvent.current = lastEvent.id;
    const meta = (lastEvent.meta ?? {}) as Record<string, unknown>;
    let unlock: { table: string; item: string; costType?: string } | null = null;
    if (lastEvent.type === 'UNLOCK' && typeof meta.item === 'string' && typeof meta.category === 'string') {
      unlock = { table: meta.category, item: meta.item, costType: unlockCostType(history, meta.item) };
    } else if (lastEvent.type === 'RITUAL' && meta.type === 'CARTOGRAPHER' && typeof meta.chunk === 'string') {
      unlock = { table: TableType.CHUNKS, item: meta.chunk, costType: 'fate' };
    }
    if (!unlock) return;
    const message = levelUpMessage({ id: lastEvent.id, ...unlock }, unlocks);
    setQueue(current => [...current, { id: lastEvent.id, message }].slice(-5));
  }, [lastEvent, history, unlocks]);

  // Each new instruction unfolds the chatbox once; folding it again is respected.
  const guideBeat = guide ? `${guide.title}|${guide.phase}` : null;
  useEffect(() => {
    if (!guideBeat) return;
    setTab('All');
    setHomeCollapsed(false);
    setOtherCollapsed(false);
  }, [guideBeat]);

  const dismissLevelUp = useCallback(() => setQueue(current => current.slice(1)), []);
  const levelUp = queue[0];

  const lines = useMemo(() => {
    const match = MATCH[tab];
    const picked: LogEntry[] = [];
    for (let i = history.length - 1; i >= 0 && picked.length < MAX_LINES; i--) {
      if (match(history[i])) picked.push(history[i]);
    }
    return picked.reverse();
  }, [history, tab]);

  const setCollapsedAndSave = (next: boolean) => {
    if (onHome) { setHomeCollapsed(next); writeCollapsed(next); } else setOtherCollapsed(next);
  };
  const pickTab = (next: ChatTab) => {
    if (next === tab) setCollapsedAndSave(!collapsed);
    else { setTab(next); if (collapsed) setCollapsedAndSave(false); }
  };

  // Tell the page how tall the dock is, so the layout above can make room.
  useLayoutEffect(() => {
    const el = dockRef.current;
    const root = document.documentElement;
    if (!el) return;
    const apply = () => root.style.setProperty('--osrs-chat-h', `${el.offsetHeight}px`);
    apply();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    observer?.observe(el);
    return () => { observer?.disconnect(); root.style.removeProperty('--osrs-chat-h'); };
  }, []);

  // Off home the screen draws its own unlock reveal, so a level-up message
  // waits for home instead of unfolding the chatbox over it.
  const bodyOpen = !collapsed || (!!levelUp && onHome);
  const name = linkedAccount || activeProfileName;
  const note = tab === 'All'
    ? `Fate Timeline · ${history.length.toLocaleString()} ${history.length === 1 ? 'entry' : 'entries'}`
    : `Fate Timeline · ${tab} only`;

  return (
    <>
    <div ref={dockRef} className={`osrs-chatdock${bodyOpen ? '' : ' is-collapsed'}`}>
        {bodyOpen && (
          <div className="osrs-chat osrs-chat-body">
            {levelUp ? (
              <OsrsLevelUp key={levelUp.id} message={levelUp.message} onContinue={dismissLevelUp} />
            ) : guide && tab === 'All' ? (
              <FirstHourInstruction view={guide} />
            ) : (
              <>
                <div className="osrs-chat-log" role="log" aria-label={`Fate Timeline, ${tab}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 8px' }}>
                    {lines.length === 0
                      ? <div className="osrs-chat-line" style={{ color: '#000080' }}>Welcome to Fate Locked. Your rolls, unlocks and rituals will show here.</div>
                      : lines.map(entry => <ChatLine key={entry.id} entry={entry} />)}
                    {notices.map(notice => (
                      <div key={notice.id} className="osrs-chat-line osrs-chat-notice" title={notice.text}>
                        <span style={{ color: '#000080' }}>{notice.text}</span>
                        {notice.actions.map(action => (
                          <button key={action.label} type="button" className="osrs-chat-link" title={action.title} onClick={action.run}>{action.label}</button>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="osrs-chat-input" aria-hidden="true">{name ? `${name}: ` : ''}<span style={{ color: '#0000ff' }}>*</span></div>
              </>
            )}
          </div>
        )}
        <div role="tablist" aria-label="Chat filters" className={`osrs-chat-tabs${bodyOpen ? '' : ' is-collapsed'}`}>
          {TABS.map(label => (
            <button
              key={label}
              type="button"
              role="tab"
              className="osrs-ctab"
              aria-selected={tab === label}
              aria-expanded={tab === label ? !collapsed : undefined}
              title={tab === label ? (collapsed ? 'Show the chatbox' : 'Hide the chatbox') : `Show ${label === 'All' ? 'every entry' : `${label} only`}`}
              onClick={() => pickTab(label)}
            >
              {label}
            </button>
          ))}
          <span className="osrs-chat-note">{note}</span>
          <button
            type="button"
            className="osrs-ctab"
            style={{ marginLeft: 'auto', width: 124 }}
            onClick={() => setShowTimelapse(true)}
            title="Play back history as a verified timelapse"
          >
            Timelapse
          </button>
        </div>
    </div>
      {showTimelapse && (
        <Suspense fallback={<ModalFallback label="Loading timelapse…" />}>
          <TimelapseModal history={history} onClose={() => setShowTimelapse(false)} />
        </Suspense>
      )}
    </>
  );
};

export default OsrsChatbox;
