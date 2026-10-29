import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import './osrs-spend.css';
import { useGame } from '../../context/GameContext';
import { LogEntry } from '../../types';
import { isRollEntry } from '../../utils/logEntry';
import { formatKeyPercent, formatKeyRollValue } from '../../utils/keyRoll';
import { tableDisplayName } from '../../utils/tableDisplay';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { lazyWithRetry } from '../../utils/lazyRetry';
import { openOsrsScreen } from '../../utils/osrsNav';
import { ModalFallback } from '../LoadingFallback';
import { filterHistory, historyFilterMatches, HistoryFilter, HistorySort } from '../LogViewer';
import { CASKET_ICON, CHAOS_KEY_ICON, KEY_ICON, OMNI_KEY_ICON, ON_PARCHMENT, ON_STONE, QUEST_ICON, VOID_SEAL_ICON, osrsItem, osrsSkillIcon } from './OsrsSpendShared';
import { clock, examineFor, lineDetails, look, speaker } from './OsrsHistoryShared';
import { setHistoryEntry, useKeysView } from './OsrsKeysState';
import { OsrsKeysTabs } from './OsrsKeysTabs';
import { formatRate, summarizeKeyHistory, type KeySourceGroup } from '../../utils/keyHistorySummary';
import { useScrollMore } from '../../utils/scrollFade';

const TimelapseModal = lazyWithRetry(() => import('../TimelapseModal').then(m => ({ default: m.TimelapseModal })));

const sh: React.CSSProperties = { textShadow: '1px 1px 0 #000' };
const RS = (size = 16, family = 'RS'): React.CSSProperties => ({ font: `${size}px '${family}', sans-serif` });
const LINE = 20;

interface RowData { entries: LogEntry[]; selected: string | null; onPick: (id: string) => void; wide: boolean }

/** One timeline line: [time] icon Source: message details, and on the wide board the roll against its chance. */
const Line = ({ index, style, data }: ListChildComponentProps<RowData>) => {
  const e = data.entries[index];
  const l = look(e);
  const who = speaker(e);
  const details = lineDetails(e);
  const roll = data.wide && isRollEntry(e) && e.rollValue !== undefined && e.threshold !== undefined;
  const hit = roll && e.rollValue! <= e.threshold!;
  return (
    <div style={style}>
      <button type="button" className={`ohist-line${data.wide ? ' wide' : ''}`} aria-pressed={data.selected === e.id} onClick={() => data.onPick(e.id)}
        data-examine-name={who || l.kind} data-examine={examineFor(e)}>
        <span>[{clock(e.timestamp)}]</span>
        <img className="osrs-px" src={l.icon} alt="" aria-hidden="true" style={{ width: 18, height: 16, objectFit: 'contain', filter: l.dim ? 'grayscale(1) brightness(.7)' : 'none' }} />
        <span style={{ minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
          {who && <span style={{ color: '#0000ff' }}>{who}: </span>}
          <span style={{ color: ON_PARCHMENT[l.tone] }}>{e.message}</span>
          {details && <span> {details}</span>}
        </span>
        {roll && (
          <span style={{ whiteSpace: 'nowrap' }}>
            <span style={{ color: hit ? ON_PARCHMENT.success : ON_PARCHMENT.fail }}>{formatKeyRollValue(e.rollValue!)}</span>
            <span style={{ color: 'var(--osrs-bevel-hi, #5c5244)' }}> vs </span>
            <span>{formatKeyPercent(e.threshold!)}</span>
            {e.baseThreshold !== undefined && e.baseThreshold !== e.threshold && (
              <span style={{ color: '#000080' }} title="Base chance before mode modifiers"> ({formatKeyPercent(e.baseThreshold)} base)</span>
            )}
          </span>
        )}
      </button>
    </div>
  );
};

const FILTERS: { id: HistoryFilter; label: string; icon: string }[] = [
  { id: 'ALL', label: 'All', icon: QUEST_ICON },
  { id: 'ROLLS', label: 'Rolls', icon: KEY_ICON },
  { id: 'UNLOCKS', label: 'Unlocks', icon: CASKET_ICON },
  { id: 'RITUALS', label: 'Rituals', icon: VOID_SEAL_ICON },
  { id: 'PROGRESS', label: 'Level', icon: CHAOS_KEY_ICON },
];

/** Unlocks fate drew for free in Chunked, by their recorded costType. */
const FREE_DRAWS: Record<string, string> = { mercy: "Fate's Mercy", breakthrough: 'a Breakthrough' };

/** The chosen entry in full: what kind it is, where it came from, its Key roll and its place in the chain. */
export const EntryDetail: React.FC<{ entry: LogEntry; num: number; total: number }> = ({ entry: e, num, total }) => {
  const l = look(e);
  const roll = isRollEntry(e) && e.rollValue !== undefined && e.threshold !== undefined;
  const hit = roll && e.rollValue! <= e.threshold!;
  const rows: { k: string; v: string; color?: string }[] = [{ k: 'Type', v: l.kind }];
  if (e.source) rows.push({ k: 'Source', v: e.source });
  if (e.type === 'UNLOCK' && e.meta?.category) {
    rows.push({ k: 'Table', v: tableDisplayName(e.meta.category) });
    const cost = e.meta.cost ?? 1;
    const free = FREE_DRAWS[e.meta.costType as string];
    if (free) {
      // Chunked's free fate draws: nothing was paid.
      rows.push({ k: 'Paid with', v: `Nothing: ${free}`, color: '#c77dff' });
      if (e.details) rows.push({ k: 'Details', v: e.details });
    } else {
      const paid = e.meta.costType === 'chaosKey' ? `${cost} Chaos Key` : e.meta.costType === 'specialKey' ? `${cost} Omni-Key` : `${cost} Key${cost === 1 ? '' : 's'}`;
      rows.push({ k: 'Paid with', v: paid, color: e.meta.costType === 'chaosKey' ? '#ff981f' : e.meta.costType === 'specialKey' ? '#c77dff' : '#ffff00' });
    }
  } else if (e.details) rows.push({ k: 'Details', v: e.details });
  const date = new Date(e.timestamp);
  return (
    <div className="osrs-inner ohist-detail">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...sh }}>
        <span style={{ ...RS(16, 'RSBold'), color: '#ff981f' }}>Entry {num.toLocaleString()}</span>
        <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>of {total.toLocaleString()}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0 }}>
          <img className="osrs-px" src={l.icon} alt="" aria-hidden="true" style={{ width: 36, height: 32, objectFit: 'contain', filter: l.dim ? 'grayscale(1) brightness(.7)' : 'none' }} />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...sh }}>
          <span style={{ ...RS(16, 'RSBold'), color: ON_STONE[l.tone] }}>{e.message}</span>
          <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>
            {date.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })} · {clock(e.timestamp)}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--osrs-well, #1f1a14)' }}>
        {rows.map(r => (
          <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '76px minmax(0, 1fr)', columnGap: 8, padding: '5px 2px', borderBottom: '1px solid var(--osrs-well, #1f1a14)', ...RS(), lineHeight: '18px', ...sh }}>
            <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>{r.k}</span><span style={{ color: r.color ?? '#ffffff', overflowWrap: 'anywhere' }}>{r.v}</span>
          </div>
        ))}
      </div>
      {roll && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ ...RS(16, 'RSBold'), color: '#ff981f', ...sh }}>Key roll</span>
          <div role="img" aria-label={`Rolled ${formatKeyRollValue(e.rollValue!)}, needed ${formatKeyPercent(e.threshold!)} or under`}
            style={{ position: 'relative', height: 18, marginTop: 8, background: '#4a1414', border: '1px solid #000' }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, e.threshold!)}%`, background: '#1f7a1f', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.3)' }} />
            <div style={{ position: 'absolute', top: -8, bottom: -4, left: `${Math.min(100, Math.max(0, e.rollValue!))}%`, width: 3, marginLeft: -1, background: '#ffff00', boxShadow: '0 0 0 1px #000' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...RS(16, 'RSSmall'), color: 'var(--osrs-muted, #8a7c66)', ...sh }}><span>0</span><span>50</span><span>100</span></div>
          <span style={{ ...RS(), color: '#ffffff', lineHeight: '18px', ...sh }}>
            Rolled {formatKeyRollValue(e.rollValue!)}, needed {formatKeyPercent(e.threshold!)} or under. <span style={{ color: hit ? '#00ff00' : '#ff3030' }}>{hit ? 'Key found.' : 'No Key.'}</span>
            {e.baseThreshold !== undefined && e.baseThreshold !== e.threshold && (
              <span style={{ color: 'var(--osrs-tan, #c8b897)' }} title="Base chance before mode modifiers"> ({formatKeyPercent(e.baseThreshold)} base)</span>
            )}
          </span>
        </div>
      )}
      {e.hash && (
        <div className="osrs-chat" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 10px', lineHeight: '18px' }}>
          <span><span style={{ color: '#800000' }}>Chain:</span> {e.prevHash === 'GENESIS' ? 'the start of the run' : e.prevHash ? `#${e.prevHash}` : 'unknown'} <span style={{ color: 'var(--osrs-bevel-hi, #5c5244)' }}>to</span> #{e.hash}</span>
          <span>Each entry is chained to the one before it, so the tracker can spot a hand-edited save. It is a check in your browser, not proof for anyone else.</span>
        </div>
      )}
    </div>
  );
};

/**
 * The History board (Keys screen, wide): the Fate Timeline as a chatbox of
 * coloured game messages with the chosen entry in full beside it. Same
 * filters, search, sort and timelapse as the classic timeline.
 */
const HistoryBoard: React.FC = () => {
  const wide = true;
  const { history, linkedAccount } = useGame();
  const listRef = useRef<List>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<HistoryFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<HistorySort>('ASC');
  const [showTimelapse, setShowTimelapse] = useState(false);
  const { historyEntry } = useKeysView();

  useEscapeKey(() => setShowTimelapse(false), showTimelapse);

  const filteredHistory = useMemo(
    () => filterHistory(history, filterType, searchTerm, sortOrder),
    [history, filterType, searchTerm, sortOrder],
  );
  const counts = useMemo(() => {
    const out: Record<HistoryFilter, number> = { ALL: 0, ROLLS: 0, UNLOCKS: 0, RITUALS: 0, PROGRESS: 0 };
    for (const e of history) for (const f of FILTERS) if (historyFilterMatches(e, f.id)) out[f.id]++;
    return out;
  }, [history]);

  // Same auto-scroll as the classic timeline: keep the newest entry in view.
  useEffect(() => {
    if (listRef.current && !searchTerm && filterType === 'ALL') {
      if (sortOrder === 'ASC') listRef.current.scrollToItem(filteredHistory.length - 1, 'end');
      else listRef.current.scrollToItem(0, 'start');
    }
  }, [filteredHistory.length, searchTerm, filterType, sortOrder]);

  // The wide board always shows an entry: the chosen one, else the latest Key found.
  const selIndex = useMemo(() => {
    if (historyEntry) {
      const i = history.findIndex(e => e.id === historyEntry);
      if (i >= 0) return i;
    }
    for (let i = history.length - 1; i >= 0; i--) if (history[i].type === 'ROLL_SUCCESS') return i;
    return history.length - 1;
  }, [history, historyEntry]);
  const selectedId = wide && selIndex >= 0 ? history[selIndex].id : null;

  // Keep the chosen line in view when the wide board opens on it.
  useEffect(() => {
    if (!wide || !selectedId) return;
    const i = filteredHistory.findIndex(e => e.id === selectedId);
    if (i >= 0) requestAnimationFrame(() => listRef.current?.scrollToItem(i, 'smart'));
  }, [wide, historyEntry]); // eslint-disable-line react-hooks/exhaustive-deps

  const itemData = useMemo<RowData>(() => ({
    entries: filteredHistory,
    selected: selectedId,
    wide,
    // On the compact panel a line opens the full History window on that entry.
    onPick: (id: string) => {
      setHistoryEntry(id);
      if (!wide) openOsrsScreen('keys', 'history');
    },
  }), [filteredHistory, selectedId, wide]);

  const sortBtn = (
    <button type="button" className={wide ? 'osrs-btn ohist-big' : 'osrs-btn ohist-small'} onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
      title={sortOrder === 'ASC' ? 'Sort: Oldest First' : 'Sort: Newest First'} style={wide ? { marginLeft: 'auto' } : undefined}>
      <span>{sortOrder === 'ASC' ? 'Old -> New' : 'New -> Old'}</span>{wide && <span className="sub">Sort</span>}
    </button>
  );
  const timelapseBtn = (
    <button type="button" className={wide ? 'osrs-btn ohist-big' : 'osrs-btn ohist-small'} onClick={() => setShowTimelapse(true)} title="Play back history as a timelapse">
      <span>Timelapse</span>{wide && <span className="sub">Play back</span>}
    </button>
  );

  const title = (
    <div className={`ohist-title${wide ? ' wide' : ''}`}>
      <h2>Fate Timeline</h2>
      <span className="count">{filteredHistory.length.toLocaleString()}</span>
      {!wide && <span className="tools">{sortBtn}{timelapseBtn}</span>}
    </div>
  );

  const chat = (
    <div className="osrs-chat ohist-chat">
      <div style={{ flex: 1, minHeight: 0, padding: wide ? '6px 4px' : '4px 2px' }}>
        {filteredHistory.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center' }}>No records found matching criteria.</div>
        ) : (
          <AutoSizer>
            {({ height, width }) => height > 0 && (
              <List ref={listRef} height={height} width={width} itemCount={filteredHistory.length} itemSize={LINE} itemData={itemData}
                initialScrollOffset={sortOrder === 'ASC' ? Math.max(0, filteredHistory.length * LINE - height) : 0}>
                {Line}
              </List>
            )}
          </AutoSizer>
        )}
      </div>
      <label className="ohist-searchline">
        <span>{linkedAccount ? `${linkedAccount}:` : 'Search:'}</span>
        <input type="text" className="ohist-search" placeholder="Search history..." aria-label="Search history"
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      </label>
    </div>
  );

  const filters = (
    <div role="tablist" aria-label="Filter history" className={`ohist-filters${wide ? ' wide' : ''}`}>
      {FILTERS.map(f => (
        <button key={f.id} type="button" role="tab" className="ohist-ftab" aria-selected={filterType === f.id} onClick={() => setFilterType(f.id)}>
          <img className="osrs-px" src={f.icon} alt="" aria-hidden="true" />
          <span className="ohist-fwords">
            <span className="ohist-flabel" style={{ color: filterType === f.id ? '#ffffff' : '#ff981f' }}>{f.label}</span>
            <span className="ohist-fcount">{counts[f.id].toLocaleString()}</span>
          </span>
        </button>
      ))}
      {wide && sortBtn}
      {wide && timelapseBtn}
    </div>
  );

  const timelapse = showTimelapse && (
    <Suspense fallback={<ModalFallback label="Loading timelapse…" />}>
      <TimelapseModal history={history} onClose={() => setShowTimelapse(false)} />
    </Suspense>
  );

  return (
    <div className="osrs-win ohist ohist-wide">
      <OsrsKeysTabs hint="History: every roll, unlock and ritual in your run." />
      <div className="ohist-body">
        <div className="ohist-left">
          {title}
          {chat}
          {filters}
        </div>
        {selIndex >= 0
          ? <EntryDetail entry={history[selIndex]} num={selIndex + 1} total={history.length} />
          : <div className="osrs-inner ohist-detail"><span style={{ color: 'var(--osrs-muted, #8a7c66)' }}>Nothing logged yet.</span></div>}
      </div>
      {timelapse}
    </div>
  );
};

/* ── Compact: the Keys panel's History tab, a summary of the Key rolls ───── */

const GROUP_ICON: Record<KeySourceGroup, string> = {
  Slayer: osrsSkillIcon('slayer', true),
  Clues: osrsItem('19835.png'),
  Bosses: osrsItem('21907.png'),
  Activities: osrsItem('4067.png'),
  Quests: QUEST_ICON,
  Diaries: osrsItem('achievement_diaries_icon.png'),
  'Combat Achievements': osrsItem('combat_achievements_icon.png'),
  'Collection log': osrsItem('22711.png'),
  Levels: osrsSkillIcon('overall', true),
  Pets: OMNI_KEY_ICON,
  Other: CASKET_ICON,
};

/** "today 14:02" style stamp: the clock for today, else the short date too. */
const when = (ts: number): string => {
  const d = new Date(ts);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? clock(ts)
    : `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${clock(ts)}`;
};

/**
 * Opens the chatbox's Fate Timeline (All tab, unfolded) and moves focus to it.
 * The chatbox owns its state, so this presses its own tab buttons.
 */
const showChatboxLog = () => {
  const dock = document.querySelector<HTMLElement>('.osrs-chatdock');
  if (!dock) return;
  const tabs = Array.from(dock.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
  const all = tabs.find(t => t.textContent?.trim() === 'All');
  if (all && all.getAttribute('aria-selected') !== 'true') all.click();
  else if (all && all.getAttribute('aria-expanded') === 'false') all.click();
  dock.scrollIntoView({ block: 'nearest' });
  requestAnimationFrame(() => all?.focus());
};

/** Opens the History board on one entry, as the old compact timeline's lines did. */
const openEntry = (id: string) => {
  setHistoryEntry(id);
  openOsrsScreen('keys', 'history');
};

/**
 * The Keys panel's History tab: what the rolls have paid so far, per source,
 * with the run's luckiest roll, longest dry streak and latest Key. The full
 * log is the chatbox right below it (and the History board), so it is not
 * repeated here.
 */
const KeySummary: React.FC = () => {
  const { history } = useGame();
  const s = useMemo(() => summarizeKeyHistory(history), [history]);
  const [tableRef, tableMore] = useScrollMore<HTMLDivElement>();
  const latest = s.latestKey;
  const lucky = s.luckiest;

  return (
    <div className="ohist ohist-compact ohsum">
      <div className="ohist-title">
        <h2>Key summary</h2>
        <span className="count" title={`${s.keys} of ${s.rolls} rolls found a Key`}>{s.keys.toLocaleString()} Key{s.keys === 1 ? '' : 's'} from {s.rolls.toLocaleString()} roll{s.rolls === 1 ? '' : 's'}</span>
        <span className="tools">
          <button type="button" className="osrs-btn ohist-small" onClick={() => openOsrsScreen('keys', 'history')} title="Open the History board: every entry, filters and the roll detail">
            History board
          </button>
        </span>
      </div>

      {s.rolls === 0 ? (
        <div className="osrs-inner ohsum-empty">No Key rolls yet. Farm Keys to make your first roll; each one shows up here by source.</div>
      ) : (
        <div ref={tableRef} className={`osrs-inner ohsum-table oscroll${tableMore ? ' is-more' : ''}`} role="table" aria-label="Key rolls by source">
          <div role="row" className="ohsum-row head">
            <span role="columnheader">Source</span>
            <span role="columnheader" className="n">Rolls</span>
            <span role="columnheader" className="n">Keys</span>
            <span role="columnheader" className="n">Win</span>
          </div>
          {s.rows.map(r => (
            <div key={r.group} role="row" className="ohsum-row"
              data-examine-name={r.group} data-examine={`${r.group}: ${r.rolls} roll${r.rolls === 1 ? '' : 's'}, ${r.keys} found a Key (${formatRate(r.rate)}).`}>
              <span role="cell" className="src">
                <img className="osrs-px" src={GROUP_ICON[r.group]} alt="" aria-hidden="true" />
                <span>{r.group}</span>
              </span>
              <span role="cell" className="n">{r.rolls.toLocaleString()}</span>
              <span role="cell" className="n k">{r.keys.toLocaleString()}</span>
              <span role="cell" className="n" style={{ color: r.keys ? 'var(--osrs-green, #00ff00)' : 'var(--osrs-red, #ff3030)' }}>{formatRate(r.rate)}</span>
            </div>
          ))}
        </div>
      )}

      {s.rolls > 0 && (
        <div className="ohsum-facts">
          <button type="button" className="ohsum-fact" disabled={!latest} onClick={() => latest && openEntry(latest.id)}
            title={latest ? `Latest Key: ${latest.source ?? 'roll'} (open on the History board)` : undefined}>
            <span className="l">Latest Key</span>
            {latest
              ? <><span className="v">{latest.source ?? 'Roll'}</span><span className="d">{when(latest.timestamp)}</span></>
              : <span className="v dim">None yet</span>}
          </button>
          <button type="button" className="ohsum-fact" disabled={!lucky} onClick={() => lucky && openEntry(lucky.entry.id)}
            title={lucky ? `Luckiest roll: won at ${formatKeyPercent(lucky.chance)} (open on the History board)` : undefined}>
            <span className="l">Luckiest roll</span>
            {lucky
              ? <><span className="v"><span style={{ color: 'var(--osrs-green, #00ff00)' }}>{formatKeyPercent(lucky.chance)}</span> chance</span><span className="d">{lucky.entry.source ?? 'Roll'}</span></>
              : <span className="v dim">No wins yet</span>}
          </button>
          <div className="ohsum-fact" title="The most rolls in a row that found no Key">
            <span className="l">Longest dry streak</span>
            <span className="v">{s.longestDry.toLocaleString()} roll{s.longestDry === 1 ? '' : 's'}</span>
            <span className="d">{s.currentDry > 0 ? `Now ${s.currentDry} without a Key` : 'Last roll found a Key'}</span>
          </div>
        </div>
      )}

      <div className="ohsum-foot">
        <img className="osrs-px" src={KEY_ICON} alt="" aria-hidden="true" />
        <span>Full log in the chatbox below.</span>
        <button type="button" className="osrs-btn ohist-small" onClick={showChatboxLog}>Show log</button>
      </div>
    </div>
  );
};

/** History in the OSRS layout: a Key summary on the home Keys panel, the full board on the Keys screen. */
const OsrsHistory: React.FC<{ wide?: boolean }> = ({ wide = false }) => (wide ? <HistoryBoard /> : <KeySummary />);

export default OsrsHistory;
