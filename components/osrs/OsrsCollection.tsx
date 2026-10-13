import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';
import './osrs-spend.css';
import { useGame } from '../../context/GameContext';
import { COLLECTION_LOG_DATA } from '../../data/collectionLogData';
import { collectionLogSync } from '../../services/CollectionLogSyncService';
import { wikiService } from '../../services/WikiService';
import { useCollectionLogModel } from '../CollectionLog';
import { Coins } from '../OsrsIcon';
import { WikiIcon } from '../WikiIcon';

const sh: React.CSSProperties = { textShadow: '1px 1px 0 #000' };
const RS = (size = 16, family = 'RS'): React.CSSProperties => ({ font: `${size}px '${family}', sans-serif` });
const CELL_W = 50;
const CELL_H = 46;

const tabStyle = (on: boolean): React.CSSProperties => ({
  all: 'unset', boxSizing: 'border-box', cursor: 'pointer', flex: '1 1 0', minWidth: 72, textAlign: 'center', padding: '0 8px', height: 28, lineHeight: '30px',
  ...RS(), color: '#ff981f', textShadow: '1px 1px 0 #000', border: '1px solid var(--osrs-bevel-hi, #5c5244)', borderBottom: 0,
  ...(on ? { background: 'var(--osrs-selected, #5a4c3a)', position: 'relative', top: 1, color: '#ffffff' } : { background: 'var(--osrs-inner, #2e271e)' }),
});

/** The item's sprite, looked up by name the same way the classic log does. */
const ItemSprite: React.FC<{ name: string }> = ({ name }) => {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    wikiService.fetchImage(name).then(url => { if (mounted && url) setSrc(url); });
    return () => { mounted = false; };
  }, [name]);
  if (!src) return <span aria-hidden="true" style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-bevel-hi, #5c5244)' }}>?</span>;
  return <img src={src} alt="" aria-hidden="true" loading="lazy" className="osrs-px" onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }} />;
};

interface CellData {
  items: any[]; cols: number; counts: Record<number, number>; blocked: Set<number>; searchTerm: string; pageName: string;
  onClick: (e: React.MouseEvent, id: number, name: string) => void;
  onHover: (i: number | null, el?: HTMLElement) => void;
}

const Cell = ({ columnIndex, rowIndex, style, data }: GridChildComponentProps<CellData>) => {
  const i = rowIndex * data.cols + columnIndex;
  if (i >= data.items.length) return null;
  const item = data.items[i];
  const review = data.blocked.has(item.id);
  const count = review ? 0 : data.counts[item.id] || 0;
  const hit = !!data.searchTerm && item.name.toLowerCase().includes(data.searchTerm.toLowerCase());
  const page = item.sourcePage ?? data.pageName;
  return (
    <div style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <button type="button" disabled={review} className={`ocoll-cell${count > 0 ? '' : ' is-missing'}${hit ? ' is-hit' : ''}`}
        aria-label={`Log ${item.name}${count ? ` (owned ${count})` : ''}`}
        data-examine-name={item.name}
        data-examine={`${item.name}: ${review ? 'saved identity needs review' : count > 0 ? `obtained${count > 1 ? ` x${count}` : ''}` : 'not obtained yet'}. ${page} collection log.`}
        onClick={e => data.onClick(e, item.id, item.name)}
        onMouseEnter={e => data.onHover(i, e.currentTarget)} onMouseLeave={() => data.onHover(null)}
        onFocus={e => data.onHover(i, e.currentTarget)} onBlur={() => data.onHover(null)}>
        <ItemSprite name={item.name} />
        {count > 1 && <span className="osrs-stack">{count}</span>}
      </button>
    </div>
  );
};

/** The collection log as the OSRS interface: category tabs, the page list, and the item grid. */
const OsrsCollection: React.FC<{ searchTerm?: string }> = ({ searchTerm = '' }) => {
  const {
    unlocks, identityReview, activeTab, setActiveTab, activePage, setActivePage, viewMode, setViewMode,
    vaultValue, mostValuable, formatNumber, currentTabContent, handleItemClick, filteredPages, allSearchItems,
    activeItems, globalStats, reach, showReach, setShowReach, pendingReviewCount,
  } = useCollectionLogModel(searchTerm);
  const { history } = useGame();

  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [rootW, setRootW] = useState(0);
  const [gridSize, setGridSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        if (e.target === rootRef.current) setRootW(e.contentRect.width);
        if (e.target === gridRef.current) setGridSize({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    if (rootRef.current) ro.observe(rootRef.current);
    if (gridRef.current) ro.observe(gridRef.current);
    return () => ro.disconnect();
  }, []);
  const wide = rootW >= 1100;

  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const onHover = (i: number | null, el?: HTMLElement) => {
    if (i === null || !el || !gridRef.current) { setHover(null); return; }
    const g = gridRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = Math.min(r.left - g.left + 30, Math.max(0, g.width - 220));
    const below = r.bottom - g.top + 44 < g.height;
    setHover({ i, x, y: below ? r.bottom - g.top + 2 : r.top - g.top - 40 });
  };

  const searching = viewMode === 'SEARCH_ALL';
  const page = currentTabContent?.pages[activePage];
  const pageName = searching ? '' : page?.name ?? '';
  const got = activeItems.filter((i: any) => unlocks.collectionLog[i.id]).length;
  const total = activeItems.length;
  const gotColor = got === 0 ? '#ff0000' : got === total ? '#00ff00' : '#ffff00';
  const cols = Math.max(1, Math.floor(gridSize.width / CELL_W));

  const cellData = useMemo<CellData>(() => ({
    items: activeItems, cols, counts: unlocks.collectionLog, blocked: identityReview.blockedIds, searchTerm, pageName,
    onClick: handleItemClick, onHover,
  }), [activeItems, cols, unlocks.collectionLog, identityReview.blockedIds, searchTerm, pageName]);

  const hovered = hover ? activeItems[hover.i] : null;
  const hoveredCount = hovered ? (identityReview.blockedIds.has(hovered.id) ? 0 : unlocks.collectionLog[hovered.id] || 0) : 0;

  // The Key rolls new log entries made, newest first, straight from the history.
  const rolls = useMemo(() => history.filter(e => e.source?.startsWith('Col. Log:')).slice(-40).reverse(), [history]);

  const reachPanel = (
    <div className="osrs-win" style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
      <h2 style={{ margin: '2px 0', textAlign: 'center', ...RS(16, 'RSBold'), color: '#ff981f', ...sh }}>Unlock coverage</h2>
      <div className="osrs-inner" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 10px', ...sh }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ ...RS(32, 'RSBold'), lineHeight: '28px', color: '#00ff00' }}>{reach.pct}%</span>
          <span style={{ ...RS(), color: 'var(--osrs-tan, #c8b897)' }}><span style={{ color: '#ffffff' }}>{reach.obtainable}</span> / {reach.total} slots covered by source unlocks</span>
        </div>
        <span style={{ ...RS(), color: 'var(--osrs-tan, #c8b897)' }}>Unlock-gated: <span style={{ color: '#ffffff' }}>{reach.gatedObtainable}/{reach.gatedTotal}</span></span>
        {reach.tabs.filter(t => t.gated).map(t => (
          <div key={t.tab} style={{ display: 'grid', gridTemplateColumns: '86px minmax(0, 1fr) 72px', alignItems: 'center', columnGap: 8, ...RS() }}>
            <span style={{ color: '#ff981f' }}>{t.tab}</span>
            <div className="ocoll-bar"><div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${t.total ? Math.round((t.obtainable / t.total) * 100) : 0}%`, background: '#0dc10d', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,.35)' }} /></div>
            <span style={{ textAlign: 'right', ...RS(16, 'RSSmall'), color: '#ffff00' }}>{t.obtainable}/{t.total}</span>
          </div>
        ))}
        {reach.suggestions.length > 0 && (
          <>
            <span style={{ marginTop: 4, ...RS(16, 'RSBold'), color: '#ff981f' }}>Expand unlock coverage</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 4 }}>
              {reach.suggestions.slice(0, 6).map(s => (
                <div key={s.tab + s.page} data-examine-name={s.unlock}
                  data-examine={`Unlocking ${s.unlock} would cover ${s.items} more collection log slot${s.items === 1 ? '' : 's'}.`}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 8px 2px 2px', background: 'var(--osrs-window, #3e3529)', border: '1px solid #000', boxShadow: 'inset 1px 1px 0 var(--osrs-bevel-hi, #5c5244), inset -1px -1px 0 var(--osrs-bevel-lo, #14110d)' }}>
                  <span className="osrs-slot" style={{ width: 40, height: 36, flexShrink: 0 }}>
                    <WikiIcon file={s.kind === 'boss' ? 'Slayer_icon.png' : 'Minigames.png'} alt="" size={22} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: '17px' }}>
                    <span style={{ ...RS(), color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.unlock}</span>
                    <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>{s.kind === 'boss' ? 'Bosses table' : 'Minigames table'}</span>
                  </span>
                  <span style={{ ...RS(16, 'RSBold'), color: '#00ff00' }}>+{s.items}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-muted, #8a7c66)', lineHeight: '15px' }}>
          Measures source ownership only. Check activity readiness for areas, quests, levels and entry conditions before attempting content. Clues &amp; Other are an approximate baseline, not guaranteed obtainable slots.
        </span>
      </div>
    </div>
  );

  const rollsPanel = (
    <div className="osrs-win" style={{ padding: 4, display: 'flex', flexDirection: 'column', gap: 4, flex: wide ? 1 : undefined, height: wide ? undefined : 118, minHeight: 0, flexShrink: 0 }}>
      <h2 style={{ margin: '2px 0', textAlign: 'center', ...RS(16, 'RSBold'), color: '#ff981f', ...sh }}>Collection log rolls</h2>
      <div className="osrs-chat" style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1, padding: '6px 8px' }}>
        {rolls.length === 0 && <div style={{ flexShrink: 0, lineHeight: '18px' }}>No collection log rolls yet. Each new item you log rolls for a Key.</div>}
        {rolls.map(e => {
          const ok = e.type === 'ROLL_SUCCESS' || e.type === 'PITY' || e.type === 'ROLL_OMNI';
          return (
            <div key={e.id} style={{ flexShrink: 0, lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              data-examine-name={e.source} data-examine={`${e.source}: ${e.message} ${e.details ?? ''}`.trim()}>
              <span style={{ color: '#0000ff' }}>{e.source}:</span> <span style={{ color: ok ? '#005f00' : '#7f0000' }}>{e.message}</span> {e.details}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} style={{ height: '100%', minHeight: 0, gap: 8, color: '#ff981f', ...RS(),
      ...(wide ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gridTemplateRows: 'minmax(0, 1fr)' }
        : { display: 'flex', flexDirection: 'column', overflowY: 'auto' }) }}>
      {!wide && showReach && reachPanel}

      <div className="osrs-win" style={{ minHeight: 360, flex: wide ? undefined : '1 0 360px', padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {(pendingReviewCount > 0 || collectionLogSync.newSources.length > 0 || identityReview.savedRecords > 0) && (
          <div role="status" className="osrs-chat" style={{ padding: '4px 8px', lineHeight: '18px' }}>
            {pendingReviewCount > 0 || collectionLogSync.newSources.length > 0
              ? 'New Wiki collection entries are awaiting a reviewed app update before they can be logged. ' : ''}
            {identityReview.savedRecords > 0
              ? `${identityReview.savedRecords} earlier live-entry records are preserved in your save and need identity review. They have not been reassigned to new items.` : ''}
          </div>
        )}

        {/* Title row: the log's value, the title with the total, and the coverage toggle. */}
        <div style={{ position: 'relative', minHeight: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap', ...sh }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span title={mostValuable ? `Most valuable: ${mostValuable.name} (${formatNumber(mostValuable.value)})` : undefined}
              style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 8px 0 2px', background: 'var(--osrs-well, #1f1a14)', border: '1px solid #000', ...RS(16, 'RSSmall'), color: '#ffff00' }}>
              <Coins size={22} aria-hidden="true" />{formatNumber(vaultValue)} gp
            </span>
            {mostValuable && rootW >= 760 && (
              <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)', whiteSpace: 'nowrap' }}>
                MVP: <span style={{ color: '#ffffff' }}>{mostValuable.name}</span> <span style={{ color: '#00ff00' }}>({formatNumber(mostValuable.value)})</span>
              </span>
            )}
          </div>
          <h2 style={{ margin: 0, ...RS(16, 'RSBold'), color: '#ff981f' }}>Collection Log - {globalStats.obtained}/{globalStats.total}</h2>
          <button type="button" className={`osrs-btn${showReach ? ' is-on' : ''}`} aria-pressed={showReach} onClick={() => setShowReach(s => !s)}
            title="Collection Log source unlock coverage" style={{ height: 26, padding: '0 8px' }}>
            <span style={{ color: '#00ff00' }}>{reach.pct}%</span> unlock coverage
          </button>
        </div>

        <div role="tablist" aria-label="Collection log categories" style={{ display: 'flex', gap: 3, padding: '0 2px', borderBottom: '1px solid var(--osrs-bevel-hi, #5c5244)', overflowX: 'auto', flexShrink: 0 }}>
          {Object.keys(COLLECTION_LOG_DATA).map(tab => (
            <button key={tab} type="button" role="tab" aria-selected={activeTab === tab && !searchTerm}
              onClick={() => { setActiveTab(tab); setViewMode('PAGE'); }}
              style={{ ...tabStyle(activeTab === tab && !searchTerm), opacity: searchTerm ? 0.5 : 1 }}>{tab}</button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'minmax(150px, 34%) minmax(0, 1fr)', gap: 4 }}>
          {/* Page list */}
          <div className="osrs-inner" style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            {searchTerm && (
              <button type="button" className="ocoll-page" onClick={() => setViewMode('SEARCH_ALL')}
                style={{ background: searching ? 'var(--osrs-selected, #5a4c3a)' : '#352d23', color: searching ? '#ffffff' : '#ff981f' }}>
                All Results ({allSearchItems.length})
              </button>
            )}
            {filteredPages.map(({ tab, key, data }, i) => {
              const totalItems = data.items.length;
              const unlockedItems = data.items.filter((it: any) => unlocks.collectionLog[it.id]).length;
              const complete = totalItems > 0 && totalItems === unlockedItems;
              const active = viewMode === 'PAGE' && activePage === key && (searchTerm ? true : activeTab === tab);
              return (
                <button key={`${tab}-${key}`} type="button" className="ocoll-page" aria-pressed={active}
                  onClick={() => { if (searchTerm) setActiveTab(tab); setActivePage(key); setViewMode('PAGE'); }}
                  data-examine-name={data.name} data-examine={`${data.name}: ${unlockedItems} of ${totalItems} obtained.`}
                  style={{ background: active ? 'var(--osrs-selected, #5a4c3a)' : i % 2 ? 'var(--osrs-inner, #2e271e)' : '#352d23' }}>
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: active ? '#ffffff' : complete ? '#0dc10d' : '#ff981f' }}>{data.name}</span>
                    {searchTerm && <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-muted, #8a7c66)', lineHeight: '14px' }}>{tab}</span>}
                  </span>
                  {complete && (
                    <svg aria-hidden="true" width="11" height="9" viewBox="0 0 11 9" style={{ flexShrink: 0 }}><path d="M1 4.5l3 3 6-6" fill="none" stroke="#0dc10d" strokeWidth="2" /></svg>
                  )}
                </button>
              );
            })}
            {filteredPages.length === 0 && !allSearchItems.length && <div style={{ padding: 16, textAlign: 'center', color: 'var(--osrs-muted, #8a7c66)', ...sh }}>No results found</div>}
          </div>

          {/* The page: its name, the obtained count, and the items. */}
          <div className="osrs-inner" style={{ minHeight: 0, display: 'flex', flexDirection: 'column', background: '#1e1a15' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px 6px', borderBottom: '1px solid #000', background: 'var(--osrs-inner, #2e271e)', ...sh }}>
              <span style={{ ...RS(16, 'RSBold'), color: '#ff981f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {searching ? `Search: "${searchTerm}"` : page?.name || 'Select a Category'}
              </span>
              {(searching || page) && (
                <span style={{ ...RS(), color: '#ff981f' }}>{searching ? 'Found' : 'Obtained'}: <span style={{ color: gotColor }}>{got}/{total}</span></span>
              )}
            </div>
            <div ref={gridRef} style={{ position: 'relative', flex: 1, minHeight: 0, padding: '4px 6px' }}>
              {activeItems.length > 0 && gridSize.width > 0 ? (
                <Grid columnCount={cols} columnWidth={CELL_W} rowCount={Math.ceil(activeItems.length / cols)} rowHeight={CELL_H}
                  width={gridSize.width} height={gridSize.height} itemData={cellData}>
                  {Cell}
                </Grid>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--osrs-muted, #8a7c66)', ...sh }}>
                  {searchTerm && allSearchItems.length === 0 ? 'No matches found' : 'Select a category to view items'}
                </div>
              )}
              {hovered && hover && (
                <div className="osrs-tooltip" style={{ position: 'absolute', left: hover.x, top: hover.y, lineHeight: '17px', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 2 }}>
                  <span style={{ display: 'block' }}>{hovered.name}</span>
                  <span style={{ display: 'block', color: identityReview.blockedIds.has(hovered.id) ? '#7f0000' : hoveredCount > 0 ? '#005f00' : '#7f0000' }}>
                    {identityReview.blockedIds.has(hovered.id) ? 'Saved identity needs review'
                      : hoveredCount > 0 ? `Obtained${hoveredCount > 1 ? ` x${hoveredCount}` : ''}` : 'Not obtained · click to log'}
                  </span>
                  {hovered.sourcePage && <span style={{ display: 'block', color: 'var(--osrs-bevel-hi, #5c5244)' }}>{hovered.sourcePage}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {wide ? (
        <div style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {showReach && reachPanel}
          {rollsPanel}
        </div>
      ) : rollsPanel}
    </div>
  );
};

export default OsrsCollection;
