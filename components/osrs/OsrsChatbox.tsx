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
import { relaySync } from '../../services/relaySync';
import { clanBroadcastsPref } from '../../utils/viewerPrefs';
import { CLAN_POLL_MS, CLAN_TAG, clanLines, fetchClanFeed, type ClanEntry } from '../../utils/clanFeed';
import './osrs-shell.css';

const TimelapseModal = lazyWithRetry(() => import('../TimelapseModal').then(m => ({ default: m.TimelapseModal })));

/**
 * The History panel's filters, as OSRS chat tabs ("Game" is its level-up
 * filter), and Clan: other players' unlocks from the Fate Locked Discord
 * (utils/clanFeed.ts), shown while Settings > Clan broadcasts is on.
 */
type ChatTab = 'All' | 'Game' | 'Rolls' | 'Unlocks' | 'Rituals' | 'Clan';
const TABS: ChatTab[] = ['All', 'Game', 'Rolls', 'Unlocks', 'Rituals'];
const MATCH: Record<ChatTab, (entry: LogEntry) => boolean> = {
  All: () => true,
  Game: entry => entry.type === 'LEVEL_UP' || entry.type === 'XTREME_MILESTONE' || entry.type === 'FATE',
  Rolls: isRollEntry,
  Unlocks: entry => entry.type === 'UNLOCK',
  Rituals: entry => entry.type === 'ALTAR',
  Clan: () => false,
};

/** Clan chat colours: the channel's name in blue, its messages in dark red. */
const CLAN_TAG_COLOR = '#0000ff';
const CLAN_TEXT_COLOR = '#7f0000';

/**
 * The clan feed while the Clan tab is showing: fetched when it opens and
 * every two minutes while it stays open. undefined while the first answer
 * is on its way, null when the relay can't give one.
 */
const useClanFeed = (showing: boolean): ClanEntry[] | null | undefined => {
  const [entries, setEntries] = useState<ClanEntry[] | null | undefined>(undefined);
  useEffect(() => {
    if (!showing) return;
    let cancelled = false;
    const load = async () => {
      const fresh = await fetchClanFeed(relaySync.base());
      // A failed refresh keeps the lines already shown.
      if (!cancelled) setEntries(current => fresh ?? (current ?? null));
    };
    void load();
    const timer = window.setInterval(load, CLAN_POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [showing]);
  return entries;
};

const ClanLog: React.FC<{ entries: ClanEntry[] | null | undefined }> = ({ entries }) => {
  const lines = useMemo(() => (entries ? clanLines(entries) : []), [entries]);
  const info = (text: string) => <div className="osrs-chat-line" style={{ color: '#000080' }}>{text}</div>;
  if (entries === undefined) return info('Joining the Fate Locked clan channel…');
  if (entries === null) return info('The clan channel can\'t be reached right now. It will try again shortly.');
  if (lines.length === 0) return info('No clan broadcasts yet. Link your run in Settings > Discord to share your unlocks here.');
  return (
    <>
      {lines.map(line => (
        <div
          key={line.key}
          className="osrs-chat-line"
          title={`${new Date(line.at).toLocaleString()}: ${line.name}${line.mode ? ` (${line.mode})` : ''} ${line.text}`}
        >
          <span style={{ color: CLAN_TAG_COLOR }}>[{CLAN_TAG}]</span>{' '}
          <span style={{ color: CLAN_TEXT_COLOR }}>{line.name} {line.text}</span>
        </div>
      ))}
    </>
  );
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
    case 'FATE': return entry.meta?.omen === 'bane' ? '#7f0000' : entry.meta?.omen === 'boon' ? '#005f00'
      : entry.meta?.fate === 'site' || entry.meta?.fate === 'seal' ? '#0000ff' : '#6a0090';
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
 * The OSRS layout's chatbox, docked at the bottom of the page: the run's
 * history (the same entries the History panel shows) as parchment chat lines,
 * with the History panel's filters as chat tabs. Clicking the selected tab
 * hides or shows it, as in the game. New unlocks show the level-up message
 * here once their reveal has been accepted.
 */
export const OsrsChatbox: React.FC = () => {
  const { history, lastEvent, unlocks, linkedAccount } = useGame();
  const { activeProfileName } = useProfiles();
  const [pickedTab, setTab] = useState<ChatTab>('All');
  const clanOn = clanBroadcastsPref.use();
  // Turning Clan broadcasts off while its tab is showing goes back to All.
  const tab: ChatTab = pickedTab === 'Clan' && !clanOn ? 'All' : pickedTab;
  const tabs: ChatTab[] = clanOn ? [...TABS, 'Clan'] : TABS;
  const { screen, progressionWide } = useOsrsNav();
  const notices = useOsrsChatNotices();
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
  const clan = useClanFeed(tab === 'Clan' && bodyOpen && !levelUp);
  const name = linkedAccount || activeProfileName;
  const note = tab === 'All'
    ? `Fate Timeline · ${history.length.toLocaleString()} ${history.length === 1 ? 'entry' : 'entries'}`
    : tab === 'Clan' ? 'Clan · unlocks from the Fate Locked Discord'
    : `Fate Timeline · ${tab} only`;

  return (
    <>
    <div ref={dockRef} className={`osrs-chatdock${bodyOpen ? '' : ' is-collapsed'}`}>
        {bodyOpen && (
          <div className="osrs-chat osrs-chat-body">
            {levelUp ? (
              <OsrsLevelUp key={levelUp.id} message={levelUp.message} onContinue={dismissLevelUp} />
            ) : (
              <>
                <div className="osrs-chat-log" role="log" aria-label={tab === 'Clan' ? 'Clan broadcasts' : `Fate Timeline, ${tab}`}>
                  <div style={{ display: 'flex', flexDirection: 'column', padding: '2px 8px' }}>
                    {tab === 'Clan' ? <ClanLog entries={clan} /> : lines.length === 0
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
          {tabs.map(label => (
            <button
              key={label}
              type="button"
              role="tab"
              className="osrs-ctab"
              aria-selected={tab === label}
              aria-expanded={tab === label ? !collapsed : undefined}
              title={tab === label ? (collapsed ? 'Show the chatbox' : 'Hide the chatbox')
                : label === 'Clan' ? 'Show unlocks from other players in the Fate Locked Discord'
                : `Show ${label === 'All' ? 'every entry' : `${label} only`}`}
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
            title="Play back history as a timelapse"
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
