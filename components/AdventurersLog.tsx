import React, { useEffect, useMemo, useState } from 'react';
import { relaySync } from '../services/relaySync';
import { MAP_IMAGE } from '../utils/mapCoords';
import { MAP_GRID } from '../utils/chunkMapBits';
import { fetchAdventurersLog, sinceText, type AdventurersLogData, type LogFetch } from '../utils/adventurersLog';
import './adventurers-log.css';

/**
 * A run's public Adventurer's Log, at `#/log/<run id>` (index.tsx): the
 * progress summary its player chose to make public in Settings > Discord,
 * with a map of the chunks they own. Read-only and self-contained (no
 * GameContext), like the stream overlay, so anyone can open the link.
 */

/** The map's view: the owned chunks' bounds with a margin, never narrower than this. */
const MIN_VIEW_COLS = 14;
const MIN_VIEW_ROWS = 9;
const VIEW_MARGIN = 2;

interface View { x: number; y: number; w: number; h: number }

/** The part of the grid to show, in grid cells (column, row from the north-west corner). */
export const mapView = (owned: ReadonlySet<string>): View => {
  let minCol = Infinity; let maxCol = -Infinity; let minRow = Infinity; let maxRow = -Infinity;
  for (const key of owned) {
    const [cx, cy] = key.split(',').map(Number);
    const col = cx - MAP_GRID.minCx;
    const row = MAP_GRID.maxCy - cy;
    minCol = Math.min(minCol, col); maxCol = Math.max(maxCol, col);
    minRow = Math.min(minRow, row); maxRow = Math.max(maxRow, row);
  }
  if (!Number.isFinite(minCol)) return { x: 0, y: 0, w: MAP_GRID.cols, h: MAP_GRID.rows };
  const grow = (lo: number, hi: number, min: number, size: number): [number, number] => {
    let a = lo - VIEW_MARGIN; let b = hi + 1 + VIEW_MARGIN;
    if (b - a < min) { const pad = (min - (b - a)) / 2; a -= pad; b += pad; }
    if (a < 0) { b -= a; a = 0; }
    if (b > size) { a -= b - size; b = size; }
    return [Math.max(0, a), Math.min(size, b)];
  };
  const [x0, x1] = grow(minCol, maxCol, MIN_VIEW_COLS, MAP_GRID.cols);
  const [y0, y1] = grow(minRow, maxRow, MIN_VIEW_ROWS, MAP_GRID.rows);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

/** The outline round the owned chunks: every cell edge with an unowned neighbour. */
const outlinePath = (owned: ReadonlySet<string>): string => {
  const has = (col: number, row: number) => owned.has(`${MAP_GRID.minCx + col},${MAP_GRID.maxCy - row}`);
  const parts: string[] = [];
  for (const key of owned) {
    const [cx, cy] = key.split(',').map(Number);
    const col = cx - MAP_GRID.minCx;
    const row = MAP_GRID.maxCy - cy;
    if (!has(col, row - 1)) parts.push(`M${col} ${row}h1`);
    if (!has(col, row + 1)) parts.push(`M${col} ${row + 1}h1`);
    if (!has(col - 1, row)) parts.push(`M${col} ${row}v1`);
    if (!has(col + 1, row)) parts.push(`M${col + 1} ${row}v1`);
  }
  return parts.join('');
};

const LogMap: React.FC<{ owned: ReadonlySet<string> }> = ({ owned }) => {
  const view = useMemo(() => mapView(owned), [owned]);
  const cells = useMemo(() => [...owned].map(key => {
    const [cx, cy] = key.split(',').map(Number);
    return { key, col: cx - MAP_GRID.minCx, row: MAP_GRID.maxCy - cy };
  }), [owned]);
  const outline = useMemo(() => outlinePath(owned), [owned]);
  // A close view needs the sharper picture.
  const src = view.w <= 24 ? MAP_IMAGE.sizes[1].src : MAP_IMAGE.sizes[0].src;
  return (
    <svg
      className="alog-map-svg"
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      style={{ aspectRatio: `${view.w} / ${view.h}` }}
      role="img"
      aria-label={`World map with ${owned.size} owned ${owned.size === 1 ? 'chunk' : 'chunks'} lit`}
    >
      <defs>
        <mask id="alog-owned" maskUnits="userSpaceOnUse" x="0" y="0" width={MAP_GRID.cols} height={MAP_GRID.rows}>
          <rect x="0" y="0" width={MAP_GRID.cols} height={MAP_GRID.rows} fill="#fff" />
          {cells.map(c => <rect key={c.key} x={c.col} y={c.row} width="1" height="1" fill="#000" />)}
        </mask>
      </defs>
      <image href={src} x="0" y="0" width={MAP_GRID.cols} height={MAP_GRID.rows} preserveAspectRatio="none" />
      <rect x="0" y="0" width={MAP_GRID.cols} height={MAP_GRID.rows} fill="#0b0907" fillOpacity="0.68" mask="url(#alog-owned)" />
      <path d={outline} fill="none" stroke="#ff981f" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="square" />
    </svg>
  );
};

const Stat: React.FC<{ label: string; done: number; total: number }> = ({ label, done, total }) => {
  const share = total > 0 ? done / total : 0;
  return (
    <div className="alog-stat">
      <div className="alog-stat-row">
        <span>{label}</span>
        <span className="alog-stat-val">{done.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="alog-bar" role="presentation"><div className="alog-bar-fill" style={{ width: `${(share * 100).toFixed(1)}%` }} /></div>
    </div>
  );
};

const LogBody: React.FC<{ log: AdventurersLogData; now: number }> = ({ log, now }) => {
  const unit = log.areas.unit === 'chunks' ? 'Chunks' : 'Areas';
  return (
    <>
      <div className="alog-grid">
        <section className="alog-panel" aria-label="Progress">
          <Stat label={`${unit} unlocked`} done={log.areas.unlocked} total={log.areas.total} />
          {log.areas.unit === 'areas' && <Stat label="Chunks owned" done={log.chunks.unlocked} total={log.chunks.total} />}
          <Stat label="Quests" done={log.quests.done} total={log.quests.total} />
          <Stat label="Diary tasks" done={log.diaryTasks.done} total={log.diaryTasks.total} />
          <div className="alog-stat alog-stat-row">
            <span>Combat Achievements</span>
            <span className="alog-stat-val">
              {log.ca.points.toLocaleString()} pts{log.ca.tier ? ` · ${log.ca.tier}` : ''}
            </span>
          </div>
        </section>
        <section className="alog-panel" aria-labelledby="alog-recent-h">
          <h2 id="alog-recent-h" className="alog-h2">Recent unlocks</h2>
          {log.recent.length === 0 ? (
            <p className="alog-dim">Nothing unlocked yet.</p>
          ) : (
            <ul className="alog-recent">
              {log.recent.map(entry => (
                <li key={`${entry.at}:${entry.text}`}>
                  <span className="alog-recent-what">{entry.text.replace(/^Unlocked /, '')}</span>
                  <span className="alog-dim">{sinceText(entry.at, now)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {log.map && (
        <figure className="alog-map">
          <LogMap owned={log.map} />
          <figcaption className="alog-dim">
            The {log.map.size.toLocaleString()} {log.map.size === 1 ? 'chunk' : 'chunks'} this run owns, outlined in orange.
          </figcaption>
        </figure>
      )}
    </>
  );
};

const AdventurersLog: React.FC<{ id: string }> = ({ id }) => {
  const [state, setState] = useState<LogFetch | null>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    void fetchAdventurersLog(relaySync.base(), id).then(result => { if (!cancelled) setState(result); });
    return () => { cancelled = true; };
  }, [id]);

  const log = state?.kind === 'found' ? state.log : null;
  useEffect(() => {
    document.title = log?.account ? `${log.account}'s Adventurer's Log · Fate Locked` : "Adventurer's Log · Fate Locked";
  }, [log]);

  const appUrl = `${window.location.origin}${window.location.pathname}`;
  return (
    <main className="alog">
      <article className="alog-win">
        <header className="alog-head">
          <h1 className="alog-title">Adventurer&apos;s Log</h1>
          {log && (
            <p className="alog-who">
              <span className="alog-name">{log.account ?? 'A Fate Locked adventurer'}</span>
              <span className="alog-mode">{log.mode}</span>
            </p>
          )}
        </header>
        <div className="alog-body">
          {state === null && <p className="alog-msg">Opening the log…</p>}
          {state?.kind === 'missing' && (
            <p className="alog-msg">This log is private, or no longer shared. Ask its owner for a fresh link.</p>
          )}
          {state?.kind === 'error' && (
            <p className="alog-msg">The log could not be reached. Check your connection and reload the page.</p>
          )}
          {log && <LogBody log={log} now={now} />}
        </div>
        <footer className="alog-foot">
          {log && (
            <span className="alog-dim">
              {log.startedAt ? `Run started ${new Date(log.startedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
              {log.startedAt && log.updatedAt ? ' · ' : ''}
              {log.updatedAt ? `Updated ${sinceText(log.updatedAt, now)}` : ''}
            </span>
          )}
          <a className="alog-link" href={appUrl}>Play Fate Locked</a>
        </footer>
      </article>
    </main>
  );
};

export default AdventurersLog;
