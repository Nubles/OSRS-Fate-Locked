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
import { ModalFallback } from '../LoadingFallback';
import { filterHistory, historyFilterMatches, HistoryFilter, HistorySort } from '../LogViewer';
import { CASKET_ICON, CHAOS_KEY_ICON, KEY_ICON, OMNI_KEY_ICON, ON_PARCHMENT, ON_STONE, VOID_SEAL_ICON, WATCH_ICON, tableSprite } from './OsrsSpendShared';

const TimelapseModal = lazyWithRetry(() => import('../TimelapseModal').then(m => ({ default: m.TimelapseModal })));

const sh: React.CSSProperties = { textShadow: '1px 1px 0 #000' };
const RS = (size = 16, family = 'RS'): React.CSSProperties => ({ font: `${size}px '${family}', sans-serif` });
const LINE = 20;

type Tone = keyof typeof ON_PARCHMENT;

/** How each kind of history entry reads as a game message. */
const look = (e: LogEntry): { tone: Tone; icon: string; dim: boolean; kind: string } => {
  switch (e.type) {
    case 'ROLL_SUCCESS': return { tone: 'success', icon: KEY_ICON, dim: false, kind: 'Roll: Key found' };
    case 'PITY': return { tone: 'success', icon: KEY_ICON, dim: false, kind: 'Roll: pity Key' };
    case 'ROLL_FAIL': return { tone: 'fail', icon: KEY_ICON, dim: true, kind: 'Roll: no Key' };
    case 'ROLL_OMNI': return { tone: 'void', icon: OMNI_KEY_ICON, dim: false, kind: 'Roll: Omni-Key' };
    case 'PET': return { tone: 'void', icon: OMNI_KEY_ICON, dim: false, kind: 'Pet' };
    case 'UNLOCK': return { tone: 'unlock', icon: e.meta?.category ? tableSprite(e.meta.category) : CASKET_ICON, dim: false, kind: 'Unlock' };
    case 'ALTAR': return { tone: 'void', icon: VOID_SEAL_ICON, dim: false, kind: 'Void Altar ritual' };
    case 'LEVEL_UP': return { tone: 'level', icon: CHAOS_KEY_ICON, dim: false, kind: 'Level up' };
    case 'XTREME_MILESTONE': return { tone: 'success', icon: CHAOS_KEY_ICON, dim: false, kind: 'Xtreme milestone' };
    case 'COMPENSATION': return { tone: 'void', icon: OMNI_KEY_ICON, dim: false, kind: 'Compensation' };
    default: return { tone: 'plain', icon: CASKET_ICON, dim: false, kind: e.type };
  }
};

/** The blue speaker before the message: the roll's source, the unlock's table, or the system that wrote it. */
const speaker = (e: LogEntry): string => {
  if (e.source) return e.source;
  if (e.type === 'UNLOCK' && e.meta?.category) return tableDisplayName(e.meta.category);
  if (e.type === 'ALTAR') return 'Void Altar';
  if (e.type === 'LEVEL_UP') return 'Level up';
  return '';
};

const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
/** Unlock lines already name the table, so their "Category: X" detail would only repeat it. */
const lineDetails = (e: LogEntry) => (e.type === 'UNLOCK' ? '' : e.details ?? '');

const examineFor = (e: LogEntry): string => {
  const parts = [`${look(e).kind}.`, e.message + (e.message.endsWith('.') || e.message.endsWith('!') ? '' : '.')];
  if (e.details) parts.push(e.details);
  if (isRollEntry(e) && e.rollValue !== undefined && e.threshold !== undefined) {
    parts.push(`Rolled ${formatKeyRollValue(e.rollValue)} against ${formatKeyPercent(e.threshold)}.`);
  }
  return parts.join(' ');
};

interface RowData { entries: LogEntry[]; selected: string | null; onPick: (id: string) => void }

const Line = ({ index, style, data }: ListChildComponentProps<RowData>) => {
  const e = data.entries[index];
  const l = look(e);
  const who = speaker(e);
  const details = lineDetails(e);
  const roll = isRollEntry(e) && e.rollValue !== undefined && e.threshold !== undefined;
  const hit = roll && e.rollValue! <= e.threshold!;
  return (
    <div style={style}>
      <button type="button" className="ohist-line" aria-pressed={data.selected === e.id} onClick={() => data.onPick(e.id)}
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
  { id: 'ALL', label: 'All', icon: WATCH_ICON },
  { id: 'ROLLS', label: 'Rolls', icon: KEY_ICON },
  { id: 'UNLOCKS', label: 'Unlocks', icon: CASKET_ICON },
  { id: 'RITUALS', label: 'Rituals', icon: VOID_SEAL_ICON },
  { id: 'PROGRESS', label: 'Level', icon: CHAOS_KEY_ICON },
];

/** The chosen entry in full: what kind it is, where it came from, its Key roll and its place in the chain. */
const EntryDetail: React.FC<{ entry: LogEntry; num: number; total: number; onClose: () => void }> = ({ entry: e, num, total, onClose }) => {
  const l = look(e);
  const roll = isRollEntry(e) && e.rollValue !== undefined && e.threshold !== undefined;
  const hit = roll && e.rollValue! <= e.threshold!;
  const rows: { k: string; v: string; color?: string }[] = [{ k: 'Type', v: l.kind }];
  if (e.source) rows.push({ k: 'Source', v: e.source });
  if (e.type === 'UNLOCK' && e.meta?.category) {
    rows.push({ k: 'Table', v: tableDisplayName(e.meta.category) });
    const cost = e.meta.cost ?? 1;
    const paid = e.meta.costType === 'chaosKey' ? `${cost} Chaos Key` : e.meta.costType === 'specialKey' ? `${cost} Omni-Key` : `${cost} Key${cost === 1 ? '' : 's'}`;
    rows.push({ k: 'Paid with', v: paid, color: e.meta.costType === 'chaosKey' ? '#ff981f' : e.meta.costType === 'specialKey' ? '#c77dff' : '#ffff00' });
  } else if (e.details) rows.push({ k: 'Details', v: e.details });
  const date = new Date(e.timestamp);
  return (
    <div className="osrs-inner" style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, padding: 8, maxHeight: '45%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...sh }}>
        <span style={{ ...RS(16, 'RSBold'), color: '#ff981f' }}>Entry {num.toLocaleString()}</span>
        <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>of {total.toLocaleString()}</span>
        <button type="button" className="osrs-btn" onClick={onClose} aria-label="Close entry" style={{ marginLeft: 'auto', width: 24, height: 24, padding: 0 }}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12"><path d="M2 2l8 8M10 2l-8 8" stroke="#ff981f" strokeWidth="2.5" /></svg>
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0 }}>
          <img className="osrs-px" src={l.icon} alt="" aria-hidden="true" style={{ width: 36, height: 32, objectFit: 'contain', filter: l.dim ? 'grayscale(1) brightness(.7)' : 'none' }} />
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, ...sh }}>
          <span style={{ ...RS(16, 'RSBold'), color: ON_STONE[l.tone] }}>{e.message}</span>
          <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>{date.toLocaleDateString()} · {clock(e.timestamp)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--osrs-well, #1f1a14)' }}>
        {rows.map(r => (
          <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr)', columnGap: 8, padding: '4px 2px', borderBottom: '1px solid var(--osrs-well, #1f1a14)', ...RS(), lineHeight: '18px', ...sh }}>
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
        <div className="osrs-chat" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 8px', lineHeight: '18px' }}>
          <span><span style={{ color: '#800000' }}>Chain:</span> {e.prevHash === 'GENESIS' ? 'the start of the run' : e.prevHash ? `#${e.prevHash}` : 'unknown'} <span style={{ color: 'var(--osrs-bevel-hi, #5c5244)' }}>to</span> #{e.hash}</span>
          <span>Each entry is chained to the one before it, so the tracker can spot a hand-edited save. It is a check in your browser, not proof for anyone else.</span>
        </div>
      )}
    </div>
  );
};

/** History as an OSRS chatbox: every roll, unlock and ritual as a coloured game message. */
const OsrsHistory: React.FC = () => {
  const { history, linkedAccount } = useGame();
  const listRef = useRef<List>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<HistoryFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<HistorySort>('ASC');
  const [showTimelapse, setShowTimelapse] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

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

  // Opening an entry shrinks the chatbox, so keep the chosen line in view.
  useEffect(() => {
    if (!selected) return;
    const i = filteredHistory.findIndex(e => e.id === selected);
    if (i >= 0) requestAnimationFrame(() => listRef.current?.scrollToItem(i, 'smart'));
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const selIndex = selected ? history.findIndex(e => e.id === selected) : -1;
  const itemData = useMemo<RowData>(() => ({
    entries: filteredHistory, selected, onPick: (id: string) => setSelected(cur => (cur === id ? null : id)),
  }), [filteredHistory, selected]);

  return (
    <div style={{ height: '100%', minHeight: 420, display: 'flex', flexDirection: 'column', gap: 4, padding: 4, color: '#ff981f', ...RS() }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', ...sh }}>
        <h2 style={{ margin: 0, ...RS(16, 'RSBold'), color: '#ff981f' }}>Fate Timeline</h2>
        <span style={{ ...RS(16, 'RSSmall'), color: '#ffff00', padding: '0 6px', background: 'var(--osrs-well, #1f1a14)', border: '1px solid #000', lineHeight: '18px' }}>{filteredHistory.length.toLocaleString()}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          <button type="button" className="osrs-btn" onClick={() => setShowTimelapse(true)} title="Play back history as a verified timelapse" style={{ height: 26 }}>Timelapse</button>
          <button type="button" className="osrs-btn" onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
            title={sortOrder === 'ASC' ? 'Sort: Oldest First' : 'Sort: Newest First'} style={{ height: 26 }}>
            {sortOrder === 'ASC' ? 'Old -> New' : 'New -> Old'}
          </button>
        </div>
      </div>

      <div className="osrs-chat" style={{ flex: 1, minHeight: 160, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0, padding: '4px 2px' }}>
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
        <label style={{ height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px', borderTop: '1px solid #8f8062' }}>
          <span>{linkedAccount ? `${linkedAccount}:` : 'Search:'}</span>
          <input type="text" className="ohist-search" placeholder="Search history..." aria-label="Search history"
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          <span aria-hidden="true" style={{ color: '#0000ff' }}>*</span>
        </label>
      </div>

      <div role="tablist" aria-label="Filter history" style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {FILTERS.map(f => (
          <button key={f.id} type="button" role="tab" className="ohist-ftab" aria-selected={filterType === f.id} onClick={() => setFilterType(f.id)}>
            <img className="osrs-px" src={f.icon} alt="" aria-hidden="true" style={{ width: 22, height: 20, objectFit: 'contain', flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '16px', minWidth: 0 }}>
              <span className="ohist-flabel" style={{ ...RS(), color: filterType === f.id ? '#ffffff' : '#ff981f' }}>{f.label}</span>
              <span style={{ ...RS(16, 'RSSmall'), color: '#00ff00' }}>{counts[f.id].toLocaleString()}</span>
            </span>
          </button>
        ))}
      </div>

      {selIndex >= 0 && (
        <EntryDetail entry={history[selIndex]} num={selIndex + 1} total={history.length} onClose={() => setSelected(null)} />
      )}

      {showTimelapse && (
        <Suspense fallback={<ModalFallback label="Loading timelapse…" />}>
          <TimelapseModal history={history} onClose={() => setShowTimelapse(false)} />
        </Suspense>
      )}
    </div>
  );
};

export default OsrsHistory;
