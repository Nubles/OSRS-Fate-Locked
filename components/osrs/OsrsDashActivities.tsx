import React, { useEffect, useMemo, useState } from 'react';
import type { TableType } from '../../types';
import type { ActivityReq } from '../../data/activityRequirements';
import type { ActivityReadiness } from '../../utils/activityReadiness';
import { SPECIAL_ICONS, UTILITY_ITEM_IDS, wikiUrlFor } from '../../constants';
import { bossTier, TIER_LABEL } from '../../data/bossKeyTiers';
import { withSkillGateQuests } from '../../utils/journalStatus';
import { wikiService } from '../../services/WikiService';
import { NoteTrigger } from '../NoteTrigger';
import { OsrsActivitiesTools } from './OsrsActivitiesTools';
import { itemSrc, skillIconSrc, wikiImageSrc } from './OsrsDashGems';
import './osrs-world.css';

/**
 * Activities & Utility in the OSRS layout (Activities board): the unlock
 * tables down the left, the chosen table's unlocks as a coloured name list
 * (green ready, yellow owned but not ready, red locked), and the selected
 * unlock's detail on the right with its requirements, readiness and the
 * Omni-Key and Note actions.
 *
 * The unlock data comes from Dashboard's own renderGrid: each card element it
 * returns carries the exact props the classic card gets (filtered by the
 * search box and the Actionable toggle, readiness, Omni availability and the
 * Omni click handler), so both layouts share one source of truth.
 */

export interface OsrsActivityCategory {
  id: string;
  label: string;
  list: string[];
  unlocked: string[];
  type: TableType;
  details?: Record<string, string>;
  nameMap?: Record<string, string>;
}

interface Props {
  categories: OsrsActivityCategory[];
  activeId: string;
  onSelect: (id: string) => void;
  searchQuery: string;
  specialKeys: number;
  renderGrid: (c: OsrsActivityCategory) => React.ReactNode;
}

/** The props of one classic unlock card (see Dashboard's UnlockCard). */
interface CardData {
  id: string;
  item: string;
  isUnlocked: boolean;
  canUnlock: boolean;
  icon?: string;
  onClick: () => void;
  subText?: string;
  region?: string;
  req?: ActivityReq;
  readiness?: ActivityReadiness;
  suspendModals?: boolean;
}

/** Reads the unlock cards out of the element tree renderGrid returns. */
const readCards = (node: React.ReactNode): CardData[] => {
  const out: CardData[] = [];
  const walk = (n: React.ReactNode) => React.Children.forEach(n, (ch) => {
    if (!React.isValidElement(ch)) return;
    const p = ch.props as Record<string, unknown>;
    if (typeof p.item === 'string' && typeof p.isUnlocked === 'boolean' && typeof p.onClick === 'function') {
      out.push({ ...(p as unknown as CardData), id: ch.key != null ? String(ch.key) : (p.item as string) });
    } else if (p.children) walk(p.children as React.ReactNode);
  });
  walk(node);
  return out;
};

/** A local sprite for each unlock table (the board's icons). */
const CATEGORY_ICON: Record<string, string> = {
  BOSSES: itemSrc(21907),
  MINIGAMES: itemSrc(4067),
  FARMING: itemSrc(5343),
  MOBILITY: itemSrc(1712),
  GUILDS: itemSrc(8851),
  ARCANA: itemSrc(563),
  POH: itemSrc(8013),
  STORAGE: itemSrc(12791),
  MERCHANTS: itemSrc(1004),
  SLAYER: itemSrc(4155),
  BANKS: `${import.meta.env.BASE_URL}osrs-ui/bank_icon.png`,
};

type Status = 'ready' | 'owned' | 'locked' | 'omni';
const STATUS_COLOR: Record<Status, string> = { ready: '#00ff00', owned: '#ffff00', locked: '#ff5050', omni: '#c77dff' };
const statusOf = (c: CardData): Status =>
  c.isUnlocked ? (c.readiness?.status === 'READY' ? 'ready' : 'owned') : c.canUnlock ? 'omni' : 'locked';

const SKILL_NAMES = new Set(['Attack', 'Strength', 'Defence', 'Ranged', 'Prayer', 'Magic', 'Runecraft', 'Construction', 'Hitpoints', 'Agility', 'Herblore', 'Thieving', 'Crafting', 'Fletching', 'Slayer', 'Hunter', 'Mining', 'Smithing', 'Fishing', 'Cooking', 'Firemaking', 'Woodcutting', 'Farming', 'Sailing']);

/** The unlock's picture: a big render for bosses and places, an item slot for sprites. */
const StageImage: React.FC<{ name: string; icon?: string; owned: boolean }> = ({ name, icon, owned }) => {
  const id = UTILITY_ITEM_IDS[name];
  const curated = icon || SPECIAL_ICONS[name];
  const [wiki, setWiki] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, true>>({});
  const [small, setSmall] = useState(false);
  useEffect(() => {
    let alive = true;
    setWiki(null);
    wikiService.fetchImage(name).then((u) => { if (alive) setWiki(u); });
    return () => { alive = false; };
  }, [name]);
  const candidates = [
    wiki,
    id ? `https://chisel.weirdgloop.org/static/img/osrs-sprite/${id}.png` : null,
    curated ? wikiImageSrc(curated) : null,
  ].filter(Boolean) as string[];
  const src = candidates.find((c) => !failed[c]);
  if (!src) return <span className="osrs-slot oact-stage-slot" aria-hidden="true" />;
  const filter = owned ? undefined : 'grayscale(.9) brightness(.5)';
  const img = (
    <img src={src} alt={name} className={small ? 'osrs-px' : undefined}
      onLoad={(e) => setSmall(e.currentTarget.naturalWidth <= 64 && e.currentTarget.naturalHeight <= 64)}
      onError={() => setFailed((f) => ({ ...f, [src]: true }))}
      style={small ? { width: 72, height: 64, objectFit: 'contain', filter } : { position: 'relative', height: '92%', maxWidth: '92%', objectFit: 'contain', objectPosition: 'bottom', filter }} />
  );
  return small ? <span className="osrs-slot oact-stage-slot">{img}</span> : img;
};

const QUEST_ICON = `${import.meta.env.BASE_URL}osrs-ui/quest_point_icon.png`;

const Detail: React.FC<{ card: CardData; cat: OsrsActivityCategory; specialKeys: number; tool: boolean }> = ({ card, cat, specialKeys, tool }) => {
  const st = statusOf(card);
  const owned = card.isUnlocked;
  const r = card.readiness;
  const blocked = new Set(r?.status === 'NOT_READY' ? r.blockers.map((b) => b.label) : []);
  const req = card.req;
  const reqs: { text: string; icon?: string; bad: boolean }[] = [];
  if (req) {
    for (const a of req.requiredAreas ?? []) reqs.push({ text: `${a} (area)`, bad: [...blocked].some((b) => b.includes(a)) });
    for (const q of withSkillGateQuests(req.quests, req.skills)) reqs.push({ text: q, icon: QUEST_ICON, bad: blocked.has(q) });
    for (const [sk, lvl] of Object.entries(req.skills ?? {})) reqs.push({ text: `${sk} ${lvl}`, icon: SKILL_NAMES.has(sk) ? skillIconSrc(sk) : undefined, bad: blocked.has(`${sk} ${lvl}`) });
    if (req.combatLevel) reqs.push({ text: `Combat level ${req.combatLevel}`, bad: blocked.has(`Combat level ${req.combatLevel}`) });
    if (req.totalLevel) reqs.push({ text: `Total level ${req.totalLevel}`, bad: blocked.has(`Total level ${req.totalLevel}`) });
    if (req.questPoints) reqs.push({ text: `${req.questPoints} Quest Points`, bad: blocked.has(`${req.questPoints} Quest Points`) });
    if (req.warriorsGuildEntry) reqs.push({ text: '99 Attack or Strength, or 130 combined', bad: blocked.has('99 Attack or Strength, or 130 combined') });
    for (const m of req.manualRequirements ?? []) reqs.push({ text: m, bad: false });
  }
  const badge = !r || r.status === 'LOCKED' ? ['Not owned', '#4a3f30']
    : r.status === 'NOT_READY' ? ['Not ready', '#7f0000']
    : r.status === 'NEEDS_CONFIRMATION' ? ['Check required', '#00007f'] : ['Ready', '#005f00'];
  const summary = !r || r.status === 'LOCKED' ? `Roll the ${cat.label} table to unlock.`
    : r.status === 'NOT_READY' ? r.blockers.map((b) => b.label).join(', ')
    : r.status === 'NEEDS_CONFIRMATION' ? 'Confirm: ' + r.checks.join(', ') : 'You can do this now.';
  const tier = cat.id === 'BOSSES' ? bossTier(card.item) : null;
  const note = [req?.note, (!req || req.unverified) ? 'Access requirements not fully verified.' : ''].filter(Boolean).join(' ');
  const omniTitle = owned ? 'Already unlocked' : card.canUnlock ? `Unlock ${card.item} with an Omni-Key` : specialKeys > 0 ? 'Not available for an Omni-Key' : `You have ${specialKeys} Omni-Keys`;

  return (
    <div className="osrs-inner oact-detail" style={tool ? { flex: '0 0 auto', height: 388 } : { flex: 1 }}>
      <div className="oact-stage" style={{ height: tool ? 150 : 230 }}>
        <div className="oact-stage-shadow" aria-hidden="true" />
        <StageImage key={card.id} name={card.item} icon={card.icon} owned={owned} />
        {tier && <span className="oact-stage-tl">{tier === 'raid' ? 'Raid' : `${TIER_LABEL[tier]} boss`}</span>}
        <span className="oact-stage-tr" style={{ color: owned ? '#00ff00' : '#ff3030' }}>{owned ? 'Owned' : 'Locked'}</span>
      </div>
      <div className="oact-body">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="oact-name">{card.item}</span>
          <a className="oact-wiki" style={{ display: "inline-flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }} href={wikiUrlFor(card.item)} target="_blank" rel="noopener noreferrer">Wiki <svg aria-hidden="true" width="9" height="9" viewBox="0 0 10 10"><path d="M4 1h5v5M9 1L3 7M1 3v6h6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg></a>
        </div>
        {card.subText && <span className="oact-small oact-tan">{card.subText}</span>}
        {card.region && (
          <span className="oact-small" style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#0dc10d' }}>
            <svg aria-hidden="true" width="10" height="12" viewBox="0 0 10 12"><path d="M5 11.5S1 7 1 4.5a4 4 0 0 1 8 0C9 7 5 11.5 5 11.5z" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="5" cy="4.5" r="1.3" fill="currentColor" /></svg>
            {card.region}
          </span>
        )}
        {reqs.length > 0 && (
          <div className="oact-reqs">
            <span className="oact-h">Requirements</span>
            {reqs.map((q) => (
              <span key={q.text} className="oact-req" style={{ color: q.bad ? '#ff3030' : '#ffffff' }}>
                {q.icon ? <img className="osrs-px" src={q.icon} alt="" aria-hidden="true" width={16} height={16} style={{ objectFit: 'contain', flexShrink: 0 }} /> : <span className="oact-dash">-</span>}
                <span>{q.text}</span>
              </span>
            ))}
          </div>
        )}
        {note && <span className="oact-small oact-muted">{note}</span>}
        <div className="oact-foot">
          <div className="oact-badge">
            <b style={{ color: badge[1] }}>{badge[0]}</b>
            <span>{summary}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button type="button" className="osrs-btn oact-omni" disabled={!card.canUnlock || owned} title={omniTitle} onClick={card.onClick}>
              <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={22} height={20} />
              {owned ? 'Unlocked' : 'Unlock with an Omni-Key'}
            </button>
            <span className="oact-note"><NoteTrigger id={card.item} title={card.item} suspendModals={card.suspendModals} /></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const OsrsDashActivities: React.FC<Props> = ({ categories, activeId, onSelect, searchQuery, specialKeys, renderGrid }) => {
  const selected = categories.find((c) => c.id === activeId) ?? categories[0];
  const searching = searchQuery.trim().length > 0;
  // Cards per category, exactly as the classic grid would draw them.
  const cardsByCat = useMemo(() => {
    const m: Record<string, CardData[]> = {};
    for (const c of categories) {
      if (searching || c.id === selected.id) m[c.id] = readCards(renderGrid(c));
    }
    return m;
    // renderGrid is a fresh closure each render; recompute with it.
  }, [categories, selected.id, searching, renderGrid]);

  const rows = useMemo(() => {
    const cats = searching ? categories : [selected];
    return cats.flatMap((c) => (cardsByCat[c.id] ?? []).map((card) => ({ cat: c, card })));
  }, [categories, selected, searching, cardsByCat]);

  const [sel, setSel] = useState<{ cat: string; id: string } | null>(null);
  const current = rows.find((r) => sel && r.cat.id === sel.cat && r.card.id === sel.id)
    ?? rows.find((r) => r.card.isUnlocked && r.card.readiness?.status !== 'READY')
    ?? rows.find((r) => r.card.isUnlocked)
    ?? rows[0];

  const ownedAll = categories.reduce((n, c) => n + c.unlocked.length, 0);
  const tool = !searching && (selected.id === 'SLAYER' || selected.id === 'MOBILITY' || selected.id === 'MERCHANTS');
  const big = rows.length > 80;
  const cols = big ? 4 : 3;
  const rowH = big ? 18 : 20;

  return (
    <div className="oact-root">
      <div className="osrs-inner oact-cats" role="group" aria-label="Unlock tables">
        <div className="oact-cats-head"><span>Unlock tables</span><span className="oact-yellow-s">{ownedAll} owned</span></div>
        {categories.map((c) => {
          const on = !searching && c.id === selected.id;
          const total = c.list.length;
          const got = c.unlocked.length;
          const pct = total ? Math.round((got / total) * 100) : 0;
          return (
            <button key={c.id} type="button" className={`oact-cat${on ? ' is-on' : ''}`} aria-pressed={on}
              onClick={() => { onSelect(c.id); setSel(null); }}
              data-examine-name={c.label} data-examine={`${c.label}. ${got} of ${total} unlocked.`}>
              <span className="osrs-slot" style={{ width: 40, height: 36, flexShrink: 0 }}>
                <img className="osrs-px" src={CATEGORY_ICON[c.id] ?? itemSrc('key')} alt="" aria-hidden="true" width={36} height={32} style={{ objectFit: 'contain' }} />
              </span>
              <span className="oact-cat-text">
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span className="oact-cat-label">{c.label}</span>
                  <span className="oact-yellow-s" style={{ marginLeft: 'auto' }}>{got}/{total}</span>
                </span>
                <span className="oact-bar" aria-hidden="true"><span style={{ width: `${Math.max(pct, got ? 3 : 0)}%` }} /></span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="osrs-inner oact-list">
        <div className="oact-list-head">
          {searching ? (
            <>
              <h3>Search: "{searchQuery}"</h3>
              <span style={{ color: '#ffff00' }}>{rows.length} match{rows.length === 1 ? '' : 'es'}</span>
            </>
          ) : (
            <>
              <h3>{selected.label}</h3>
              <span style={{ color: '#ffff00' }}>{selected.unlocked.length} / {selected.list.length} unlocked</span>
            </>
          )}
          <span className="oact-legend">
            <span style={{ color: '#00ff00' }}>Ready</span><span style={{ color: '#ffff00' }}>Owned, not ready</span>
            {specialKeys > 0 && <span style={{ color: '#c77dff' }}>Omni-Key</span>}
            <span style={{ color: '#ff5050' }}>Locked</span>
          </span>
        </div>
        <div className="oact-names" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${Math.max(1, Math.ceil(rows.length / cols))}, ${rowH}px)` }}>
          {rows.map(({ cat, card }) => {
            const st = statusOf(card);
            const on = current && current.card.id === card.id && current.cat.id === cat.id;
            const title = `${card.item}${st === 'ready' ? ': owned, ready' : st === 'owned' ? ': owned, not ready yet' : st === 'omni' ? ': locked, Omni-Key available' : ': locked'}`;
            return (
              <button key={`${cat.id}:${card.id}`} type="button" className={`oact-name-row${on ? ' is-on' : ''}`} aria-pressed={!!on} title={title}
                style={{ color: STATUS_COLOR[st], height: rowH, lineHeight: `${rowH + 1}px`, fontFamily: big ? 'RSSmall, sans-serif' : undefined }}
                onClick={() => setSel({ cat: cat.id, id: card.id })}
                data-examine-name={card.item} data-examine={`${title}.${card.region ? ` ${card.region}.` : ''}`}>
                {card.item}
              </button>
            );
          })}
        </div>
        {rows.length === 0 && (
          <div className="oact-empty">{searching ? `No activities match "${searchQuery}".` : 'Nothing to show here with the Actionable filter on.'}</div>
        )}
        <div className="oact-msg">
          <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={27} height={24} />
          <span>Roll a table with a Key, or spend an Omni-Key to pick one locked unlock. You have <span style={{ color: '#7f0000' }}>{specialKeys} Omni-Key{specialKeys === 1 ? '' : 's'}</span>.</span>
        </div>
      </div>

      <div className="oact-right">
        {current ? <Detail card={current.card} cat={current.cat} specialKeys={specialKeys} tool={tool} />
          : <div className="osrs-inner oact-detail" style={{ flex: tool ? '0 0 auto' : 1 }} />}
        {tool && <OsrsActivitiesTools id={selected.id} />}
      </div>
    </div>
  );
};

export default OsrsDashActivities;
