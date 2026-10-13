import React from 'react';
import type { TableType } from '../../types';
import { SlayerReachabilityPanel } from '../SlayerReachabilityPanel';
import { ShortcutsPanel } from '../ShortcutsPanel';
import { MerchantShopsPanel } from '../MerchantShopsPanel';
import { itemSrc, skillIconSrc } from './OsrsDashGems';
import './osrs-dashboard.css';

/**
 * Activities & Utility in the OSRS layout: the unlock tables as a column of
 * item slots (stack number = unlocks you own, green bar = share unlocked),
 * and the chosen table's unlocks beside it. The unlock cards themselves are
 * the classic ones (Dashboard renders them through renderGrid), drawn as
 * OSRS item rows by osrs-dashboard.css.
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

/** A local sprite for each unlock table (presentation only). */
const CATEGORY_ICON: Record<string, string> = {
  BOSSES: itemSrc(6570),
  MINIGAMES: itemSrc(2520),
  FARMING: itemSrc(5343),
  MOBILITY: itemSrc(772),
  GUILDS: skillIconSrc('overall'),
  ARCANA: itemSrc(562),
  POH: itemSrc(8013),
  STORAGE: itemSrc(11941),
  MERCHANTS: itemSrc(13204),
  SLAYER: itemSrc(11864),
  BANKS: itemSrc(405),
};

const CategoryHead: React.FC<{ c: OsrsActivityCategory }> = ({ c }) => (
  <div className="osrs-dash-acthead">
    <h3 className="osrs-title" style={{ margin: 0 }}>{c.label}</h3>
    <span className="osrs-sh" style={{ color: 'var(--osrs-yellow, #ff0)' }}>{c.unlocked.length} / {c.list.length} unlocked</span>
  </div>
);

export const OsrsDashActivities: React.FC<Props> = ({ categories, activeId, onSelect, searchQuery, specialKeys, renderGrid }) => {
  const selected = categories.find(c => c.id === activeId) ?? categories[0];
  const q = searchQuery.toLowerCase();
  const matching = searchQuery
    ? categories.filter(c => c.list.some(i => `${i} ${c.nameMap?.[i] ?? i}`.toLowerCase().includes(q)))
    : [];
  const ownedAll = categories.reduce((n, c) => n + c.unlocked.length, 0);

  return (
    <div className="h-full osrs-dash-activities">
      <div className="osrs-inner osrs-dash-cats" role="group" aria-label="Unlock tables">
        <div className="osrs-dash-panelhead" style={{ padding: '2px 4px 4px' }}>
          <span className="osrs-title">Unlock tables</span>
          <span className="osrs-dash-yellow-s">{ownedAll} owned</span>
        </div>
        {categories.map(c => {
          const isActive = !searchQuery && c.id === selected.id;
          const total = c.list.length;
          const got = c.unlocked.length;
          const pct = total ? Math.round((got / total) * 100) : 0;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-pressed={isActive}
              className={`osrs-dash-cat${isActive ? ' is-on' : ''}`}
              data-examine-name={c.label}
              data-examine={`${c.label}. ${got} of ${total} unlocked.`}
            >
              <span className="osrs-slot" style={{ width: 40, height: 36, flexShrink: 0 }}>
                {CATEGORY_ICON[c.id] && <img className="osrs-px" src={CATEGORY_ICON[c.id]} alt="" aria-hidden="true" width={36} height={32} style={{ objectFit: 'contain' }} />}
                <span className="osrs-stack">{got}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
                  <span className="osrs-dash-cat-label">{c.label}</span>
                  <span className="osrs-dash-yellow-s" style={{ marginLeft: 'auto' }}>{got}/{total}</span>
                </span>
                <span className="osrs-dash-catbar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="osrs-inner osrs-dash-actlist">
        {searchQuery ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar pb-4">
            {matching.length === 0 && (
              <div className="osrs-sh" style={{ padding: 14, color: 'var(--osrs-tan, #c8b897)' }}>No activities match "{searchQuery}".</div>
            )}
            {matching.map(c => (
              <div key={c.id} style={{ marginBottom: 8 }}>
                <CategoryHead c={c} />
                <div className="osrs-dash-cards">{renderGrid(c)}</div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <CategoryHead c={selected} />
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar pb-4" style={{ padding: 4 }}>
              {selected.id === 'SLAYER' && <SlayerReachabilityPanel />}
              {selected.id === 'MOBILITY' && <ShortcutsPanel />}
              <div className="osrs-dash-cards">{renderGrid(selected)}</div>
              {selected.id === 'MERCHANTS' && <MerchantShopsPanel />}
            </div>
          </>
        )}
        <div className="osrs-chat osrs-dash-actfoot">
          <img className="osrs-px" src={itemSrc('omni_key')} alt="" aria-hidden="true" width={27} height={24} />
          <span>Roll a table with a Key, or spend an Omni-Key to pick one locked unlock. You have <span style={{ color: '#7f0000' }}>{specialKeys} Omni-Key{specialKeys === 1 ? '' : 's'}</span>.</span>
        </div>
      </div>
    </div>
  );
};

export default OsrsDashActivities;
