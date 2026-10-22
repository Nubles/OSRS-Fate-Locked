import React, { useEffect, useMemo, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { MERCHANTS_LIST, MERCHANT_UNLOCK_DETAILS, wikiUrlFor } from '../../constants';
import { chunkContentService } from '../../services/ChunkContentService';
import { useChunkContent } from '../../hooks/useChunkContent';
import { slayerReachability, type SlayerStatus, type SlayerTaskRow } from '../../utils/slayerReach';
import { slayerLocate } from '../../utils/slayerDecisions';
import { chunkUnlocked, chunkForPlace, showChunkOnMap, summarisePlaces } from '../../utils/chunkLocations';
import { shortcutReachability, type ShortcutStatus } from '../../utils/shortcutReach';
import { shopsByCategory, type CategoryShop } from '../../utils/merchantShops';
import { evaluateEntityAccess } from '../../utils/entityAccess';
import { itemSrc, skillIconSrc } from './OsrsDashGems';
import './osrs-world.css';

/**
 * The tool panel under the unlock detail on the Activities board, for the
 * three tables that have one: Slayer Task Reachability, Agility Shortcuts and
 * the Shop directory. Same data and rules as the classic panels
 * (SlayerReachabilityPanel, ShortcutsPanel, MerchantShopsPanel), drawn as
 * compact OSRS list rows.
 */

const Pin: React.FC<{ cx: number; cy: number; name: string }> = ({ cx, cy, name }) => (
  <button type="button" className="oact-pin" aria-label={`Show ${name} on map`} title="Show on map" onClick={() => showChunkOnMap(cx, cy)}>
    <svg aria-hidden="true" width="10" height="13" viewBox="0 0 10 13"><path d="M5 12C2 8 1 6.5 1 4.5a4 4 0 0 1 8 0C9 6.5 8 8 5 12z" fill="#c8b897" stroke="#000" strokeWidth="1" /><circle cx="5" cy="4.5" r="1.5" fill="#2e271e" /></svg>
  </button>
);

const Shell: React.FC<{ icon: string; title: string; right?: React.ReactNode; foot?: React.ReactNode; children: React.ReactNode }> = ({ icon, title, right, foot, children }) => (
  <div className="osrs-inner oact-tool">
    <div className="oact-tool-head">
      <img className="osrs-px" src={icon} alt="" aria-hidden="true" width={20} height={20} style={{ objectFit: 'contain' }} />
      <span className="oact-h">{title}</span>
      {right && <span className="oact-tool-right">{right}</span>}
    </div>
    {children}
    {foot && <div className="oact-tool-foot">{foot}</div>}
  </div>
);

const SLAYER_TAG: Record<SlayerStatus, string> = {
  'ready': 'ready', 'area-locked': 'area locked', 'slayer-locked': 'Slayer', 'combat-locked': 'Combat',
  'quest-locked': 'quest', 'access-unknown': 'access needs review', 'access-blocked': 'entry requirements', 'no-location': '-',
};
const slayerBadge = (r: SlayerTaskRow) =>
  r.masterBlocker?.label ?? r.blocker
  ?? (r.status === 'slayer-locked' && r.slayer ? `Slayer ${r.slayer}` : r.status === 'combat-locked' && r.combat ? `Combat ${r.combat}` : SLAYER_TAG[r.status]);

const SlayerTool: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const { ready, error, retry } = useChunkContent();
  const [open, setOpen] = useState<string | null | undefined>(undefined);
  const reach = useMemo(() => {
    if (!ready) return null;
    const locate = slayerLocate(chunkContentService, unlocks, gameModeId);
    return slayerReachability(chunkContentService.slayerMasters(), unlocks, locate, gameModeId);
  }, [ready, unlocks, gameModeId]);
  const icon = skillIconSrc('slayer');
  if (error) return <Shell icon={icon} title="Slayer Task Reachability"><div className="oact-tool-empty">Could not load Slayer locations. <button type="button" className="oact-link" onClick={retry}>Retry Slayer locations</button></div></Shell>;
  if (!reach) return <Shell icon={icon} title="Slayer Task Reachability"><div className="oact-tool-empty">Loading Slayer locations...</div></Shell>;
  if (reach.masters.length === 0) return null;
  const totalReady = reach.masters.reduce((a, m) => a + m.ready, 0);
  // The first master opens by default, as on the board.
  const openName = open === undefined ? reach.masters[0]?.master ?? null : open;
  return (
    <Shell icon={icon} title="Slayer Task Reachability"
      right={<>CB {reach.combatLevel} · Slayer {reach.slayerUnlocked ? reach.slayerLevel : 'locked'} · <span style={{ color: '#00ff00' }}>{totalReady} ready</span></>}
      foot="Ready = you meet the Slayer, combat and quest needs and the monster is in an unlocked chunk. Locations are best-effort from chunk data.">
      <div className="oact-tool-list">
        {reach.masters.map((m) => {
          const isOpen = openName === m.master;
          return (
            <React.Fragment key={m.master}>
              <button type="button" className={`oact-trow${isOpen ? ' is-open' : ''}`} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : m.master)}>
                <span className="oact-chev">{isOpen ? 'v' : '>'}</span>
                <span className="oact-trow-name" style={{ color: '#ff981f' }}>{m.master}</span>
                {m.masterBlocker && <span className="oact-trow-tag" style={{ color: '#ff3030' }}>{m.masterBlocker.label}</span>}
                <span className="oact-trow-count" style={{ color: m.ready ? '#00ff00' : '#8a7c66' }}>{m.ready} / {m.total}</span>
              </button>
              {isOpen && m.rows.map((r) => (
                <div key={r.monster} className="oact-tsub">
                  <span className="oact-trow-name" style={{ color: '#ffffff' }}>{r.monster}</span>
                  {r.loc && <Pin cx={r.loc.cx} cy={r.loc.cy} name={r.monster} />}
                  <span className="oact-trow-tag" style={{ color: r.status === 'ready' ? '#00ff00' : '#ffff00' }}>{r.status === 'ready' ? 'ready' : slayerBadge(r)}</span>
                  {r.slayer != null && !r.masterBlocker && r.status !== 'slayer-locked' && <span className="oact-trow-count" style={{ color: '#8a7c66' }}>lvl {r.slayer}</span>}
                </div>
              ))}
            </React.Fragment>
          );
        })}
      </div>
    </Shell>
  );
};

const SHORTCUT_FILTERS: { key: 'all' | ShortcutStatus; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'ready', label: 'Ready' }, { key: 'level', label: 'Need level' }, { key: 'area-locked', label: 'Area locked' },
];

const ShortcutsTool: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const [ready, setReady] = useState(chunkContentService.ready);
  const [filter, setFilter] = useState<'all' | ShortcutStatus>('all');
  useEffect(() => { if (!ready) chunkContentService.init().then(() => setReady(true)); }, [ready]);
  const reach = useMemo(() => {
    if (!ready) return null;
    const shortcuts = chunkContentService.shortcuts();
    const locate = (s: typeof shortcuts[number]) => {
      for (const obj of s.objects) {
        const hit = chunkContentService.entityLocations(obj, ['object']);
        if (hit && hit.locations.length) {
          const un = hit.locations.find((l) => chunkUnlocked(l.cx, l.cy, unlocks, gameModeId));
          const l = un ?? hit.locations[0];
          return { cx: l.cx, cy: l.cy, unlocked: !!un };
        }
      }
      for (const name of s.chunks) {
        const c = chunkForPlace(name);
        if (c) return { cx: c.cx, cy: c.cy, unlocked: chunkUnlocked(c.cx, c.cy, unlocks, gameModeId) };
      }
      return null;
    };
    return shortcutReachability(shortcuts, unlocks, locate);
  }, [ready, unlocks, gameModeId]);
  const icon = skillIconSrc('agility');
  if (!reach) return <Shell icon={icon} title="Agility Shortcuts"><div className="oact-tool-empty">Loading shortcuts...</div></Shell>;
  if (reach.total === 0) return null;
  const rows = filter === 'all' ? reach.rows : reach.rows.filter((r) => r.status === filter);
  const TAG: Record<ShortcutStatus, [string, string]> = { 'ready': ['ready', '#00ff00'], 'area-locked': ['area locked', '#ffff00'], 'level': ['', '#c77dff'], 'no-location': ['-', '#8a7c66'] };
  return (
    <Shell icon={icon} title="Agility Shortcuts" right={<><span style={{ color: '#00ff00' }}>{reach.ready}</span> / {reach.total} usable now</>}>
      <div className="oact-tool-filters" role="group" aria-label="Shortcut filter">
        {SHORTCUT_FILTERS.map((f) => (
          <button key={f.key} type="button" className={`osrs-btn${filter === f.key ? ' is-on' : ''}`} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      <div className="oact-tool-list">
        {rows.map((r) => (
          <div key={`${r.skill}:${r.name}`} className="oact-tsub" style={{ paddingLeft: 8, background: 'transparent' }}>
            <span style={{ width: 30, flexShrink: 0, fontFamily: 'RSSmall, sans-serif', color: '#ffff00' }}>L{r.level}</span>
            <span className="oact-trow-name" style={{ color: '#ffffff', fontFamily: 'RS, sans-serif' }}>{r.name}</span>
            {r.loc && <Pin cx={r.loc.cx} cy={r.loc.cy} name={r.name} />}
            <span className="oact-trow-tag" style={{ color: TAG[r.status][1] }}>{r.status === 'level' ? `${r.skill} ${r.level}` : TAG[r.status][0]}</span>
          </div>
        ))}
        {rows.length === 0 && <div className="oact-tool-empty">No shortcuts in this filter.</div>}
      </div>
    </Shell>
  );
};

const ShopsTool: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const { ready, error, retry } = useChunkContent();
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const grouped = useMemo(() => (ready ? shopsByCategory() : null), [ready]);
  const icon = itemSrc(1004);
  const head = { icon, title: 'Shop directory' };
  if (!grouped) {
    return (
      <Shell {...head}>
        <div className="oact-tool-empty">{error ? <>Could not load the shop directory. <button type="button" className="oact-link" onClick={retry}>Retry shop directory</button></> : 'Loading shop directory...'}</div>
      </Shell>
    );
  }
  const accessFor = (shop: CategoryShop) => shop.locations.map((location) => evaluateEntityAccess(shop.name, shop.kind ?? 'shop', location, unlocks, gameModeId));
  const toggle = (c: string) => setOpenCats((prev) => { const next = new Set(prev); next.has(c) ? next.delete(c) : next.add(c); return next; });
  // Unlocked categories first, as on the board.
  const cats = [...MERCHANTS_LIST.filter((c) => unlocks.merchants.includes(c)), ...MERCHANTS_LIST.filter((c) => !unlocks.merchants.includes(c))];
  return (
    <Shell {...head} foot="A shop is usable when its category, location and access are all open.">
      <div className="oact-tool-list">
        {cats.map((cat) => {
          const catUnlocked = unlocks.merchants.includes(cat);
          const shops = grouped.get(cat) ?? [];
          const detail = MERCHANT_UNLOCK_DETAILS[cat];
          const isOpen = openCats.has(cat);
          const usableCount = catUnlocked ? shops.filter((s) => accessFor(s).some((a) => a.status === 'ALLOWED')).length : 0;
          return (
            <React.Fragment key={cat}>
              <button type="button" className={`oact-trow${isOpen ? ' is-open' : ''}`} aria-expanded={isOpen} onClick={() => toggle(cat)}>
                <span className="oact-chev">{isOpen ? 'v' : '>'}</span>
                <span style={{ width: 12, flexShrink: 0, color: catUnlocked ? '#00ff00' : '#ff3030' }}>{catUnlocked ? '+' : 'x'}</span>
                <span className="oact-trow-name" style={{ color: catUnlocked ? '#ffffff' : '#8a7c66' }}>{cat}</span>
                <span className="oact-trow-count" style={{ color: catUnlocked ? '#ffff00' : '#6f6250' }}>
                  {catUnlocked ? `${usableCount}/${shops.length} usable` : `${shops.length} shops · category locked`}
                </span>
              </button>
              {isOpen && (
                <>
                  {detail && <div className="oact-tsub oact-wrap" style={{ color: '#c8b897' }}>{detail}</div>}
                  {!shops.length && <div className="oact-tsub" style={{ color: '#ffff00' }}>Provider locations for this category still need review.</div>}
                  {shops.map((shop) => {
                    const places = summarisePlaces(shop.locations, unlocks, gameModeId);
                    const access = accessFor(shop);
                    const usable = catUnlocked && access.some((a) => a.status === 'ALLOWED');
                    const reasons = [...new Set(access.flatMap((a) => a.reasons))];
                    return (
                      <div key={shop.name} className="oact-tsub oact-wrap">
                        <span style={{ width: 12, flexShrink: 0, color: usable ? '#00ff00' : '#6f6250' }}>{usable ? '+' : '-'}</span>
                        <a href={wikiUrlFor(shop.name)} target="_blank" rel="noopener noreferrer" style={{ color: usable ? '#ffffff' : '#8a7c66', textDecoration: 'none' }}>{shop.name}</a>
                        {shop.stockStatus === 'service' && <span style={{ color: '#8a7c66' }}>Service</span>}
                        {shop.stockStatus === 'zero-stock' && <span style={{ color: '#8a7c66' }}>No default stock</span>}
                        {shop.onlySource?.length ? <span style={{ color: '#7fd7ff' }} title="No other shop sells these">Only shop selling {shop.onlySource.join(', ')}</span> : null}
                        {catUnlocked && !usable && reasons.length > 0 && <span style={{ color: '#ffcf40' }} title={reasons.join('; ')}>{access.some((a) => a.status === 'UNKNOWN') ? 'Access needs confirmation' : reasons[0]}</span>}
                        {places.slice(0, 3).map((p) => (
                          <button key={p.label} type="button" className="oact-chip" onClick={() => showChunkOnMap(p.cx, p.cy)}
                            style={{ background: p.unlocked ? '#0f3a0f' : '#3a1414', color: p.unlocked ? '#0dc10d' : '#ff5050' }}
                            title={`${p.label}: ${p.unlocked ? 'unlocked' : 'locked'}. Click to view on map`}>{p.label}</button>
                        ))}
                        {!catUnlocked && places.some((p) => p.unlocked) && <span style={{ color: '#ffcf40' }}>location reachable, category locked</span>}
                      </div>
                    );
                  })}
                </>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </Shell>
  );
};

export const OsrsActivitiesTools: React.FC<{ id: string }> = ({ id }) =>
  id === 'SLAYER' ? <SlayerTool /> : id === 'MOBILITY' ? <ShortcutsTool /> : id === 'MERCHANTS' ? <ShopsTool /> : null;

export default OsrsActivitiesTools;
