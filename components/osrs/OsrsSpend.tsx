import React, { useMemo, useState } from 'react';
import './osrs-spend.css';
import { TableType } from '../../types';
import { useSpendModel, SpendCategory } from '../GachaSection';
import { openDashboardPool } from '../../utils/dashboardPoolNavigation';
import { unlockableAreas } from '../../utils/freeAreas';
import { isAreaReachable } from '../../utils/reachability';
import { BANK_BY_ID } from '../../data/banks';
import { EQUIPMENT_SLOTS, SKILLS_LIST } from '../../constants';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY, chunkLabel } from '../../utils/chunkAdjacency';
import { andList, LEVEL_CHAOS_CHANCE, SKILL_CHAOS_MILESTONES } from '../../config/economy';
import { categoryColor } from '../../utils/rarity';
import { useGame } from '../../context/GameContext';
import { CHAOS_KEY_ICON, KEY_ICON, OMNI_KEY_ICON, osrsSkillIcon, tableSprite, tierGem } from './OsrsSpendShared';

type Chip = { text: string; icon?: string; gem?: string | null; on: boolean; examine: string };

const sh: React.CSSProperties = { textShadow: '1px 1px 0 #000' };
const RS = (size = 16, family = 'RS'): React.CSSProperties => ({ font: `${size}px '${family}', sans-serif` });

/** What a table's card can do right now; the same rules as the classic SpendCard. */
const cardState = (c: SpendCategory, rollable: boolean, keys: number, pending: boolean) => {
  const complete = !c.can;
  const blocked = c.can && !rollable;
  const disabled = !c.can || !rollable || pending;
  const keysAvailable = keys > 0;
  const clickable = !disabled && keysAvailable && !complete;
  return { complete, blocked, clickable, keysAvailable };
};

/** Spend Keys drawn as an OSRS interface: the unlock tables as item slots, and the chosen table's detail. */
const OsrsSpend: React.FC = () => {
  const { keys, specialKeys, chaosKeys, keysOwed, unlocks, pendingUnlock, gameModeId, isChunked, rollable, totalLevel, handleUnlock, handleChaosUnlock, SPEND_CATEGORIES } = useSpendModel();
  const { customMode } = useGame();
  const [selType, setSelType] = useState<TableType>(SPEND_CATEGORIES[0].type);
  const sel = SPEND_CATEGORIES.find(c => c.type === selType) ?? SPEND_CATEGORIES[0];
  const selState = cardState(sel, !!rollable.get(sel.type), keys, !!pendingUnlock);

  // What the player already owns from the chosen table, read from the same unlocks.
  const chips = useMemo((): Chip[] => {
    const owned = (list: string[] | undefined, label: (s: string) => string = s => s) =>
      (list ?? []).map(item => ({ text: label(item), on: true, examine: `${label(item)}: unlocked from the ${sel.label} table.` }));
    switch (sel.type) {
      case TableType.SKILLS:
        return SKILLS_LIST.map(skill => {
          const tier = unlocks.skills?.[skill] ?? 0;
          return { text: skill, icon: osrsSkillIcon(skill, true), gem: tierGem(tier), on: tier > 0, examine: tier > 0 ? `${skill}: tier ${tier}.` : `${skill}: locked.` };
        });
      case TableType.EQUIPMENT:
        return EQUIPMENT_SLOTS.map(slot => {
          const tier = unlocks.equipment?.[slot] ?? 0;
          return { text: tier > 0 ? slot : `${slot}: locked`, gem: tierGem(tier), on: tier > 0, examine: tier > 0 ? `${slot} slot: tier ${tier}.` : `${slot} slot: locked.` };
        });
      case TableType.REGIONS:
        return owned(unlockableAreas(gameModeId, customMode).filter(area => isAreaReachable(area, unlocks, gameModeId)));
      case TableType.CHUNKS:
        return owned(ALL_CHUNK_KEYS.filter(key => key !== CHUNKED_START_KEY && (unlocks.chunks ?? []).includes(key)), chunkLabel);
      case TableType.MOBILITY: return owned(unlocks.mobility);
      case TableType.ARCANA: return owned(unlocks.arcana);
      case TableType.STORAGE: return owned(unlocks.storage);
      case TableType.POH: return owned(unlocks.housing);
      case TableType.MERCHANTS: return owned(unlocks.merchants);
      case TableType.MINIGAMES: return owned(unlocks.minigames);
      case TableType.BOSSES: return owned(unlocks.bosses);
      case TableType.GUILDS: return owned(unlocks.guilds);
      case TableType.FARMING_LAYERS: return owned(unlocks.farming);
      case TableType.SLAYER_UNLOCKS: return owned(unlocks.slayerUnlocks);
      case TableType.BANKS: return owned(unlocks.banks, id => BANK_BY_ID[id]?.name ?? id);
      default: return [];
    }
  }, [sel.type, sel.label, unlocks, gameModeId, customMode]);

  const tiered = sel.type === TableType.SKILLS || sel.type === TableType.EQUIPMENT;
  const listTitle = tiered ? 'Your tiers' : chips.length ? 'Already unlocked' : 'Nothing unlocked from this table yet';
  const pct = selState.complete ? 100 : sel.total > 0 ? Math.round((sel.unlocked / sel.total) * 100) : 0;
  const cta = selState.complete ? 'Done' : selState.blocked ? 'Blocked' : !selState.keysAvailable ? 'Need Keys' : 'Unlock';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 4, color: '#ff981f', ...RS() }}>
      {specialKeys > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 10px 3px 4px', background: 'var(--osrs-well, #1f1a14)', border: '1px solid #000', ...sh }}>
          <div className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
            <img className="osrs-px" src={OMNI_KEY_ICON} alt="" aria-hidden="true" style={{ width: 36, height: 32 }} />
            <span className="osrs-stack">{specialKeys}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px', minWidth: 0 }}>
            <span style={{ ...RS(16, 'RSBold'), color: '#c77dff' }}>{specialKeys} Omni-Key{specialKeys > 1 ? 's' : ''} Ready</span>
            <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>
              Omni-Keys aren't spent here. Click a locked skill, gear slot, {isChunked ? '' : 'area, '}boss or other entry on the <span style={{ color: '#c77dff' }}>Dashboard</span> to pick exactly what to unlock.
            </span>
          </div>
        </div>
      )}

      {(keysOwed ?? 0) > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 10px 3px 4px', background: 'var(--osrs-well, #1f1a14)', border: '1px solid #000', ...sh }}>
          <div className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
            <img className="osrs-px" src={KEY_ICON} alt="" aria-hidden="true" style={{ width: 36, height: 32, filter: 'grayscale(1) brightness(.6)' }} />
            <span className="osrs-stack" style={{ color: '#ff3030' }}>{keysOwed}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px', minWidth: 0 }}>
            <span style={{ ...RS(16, 'RSBold'), color: '#ff981f' }}>{keysOwed} Standard Key{keysOwed === 1 ? '' : 's'} owed</span>
            <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>
              From the pet compensation you chose: the next {keysOwed === 1 ? 'Standard Key you earn pays' : `${keysOwed} Standard Keys you earn pay`} this first.
            </span>
          </div>
        </div>
      )}

      {/* Chaos Keys: a button when there is one to spend, an info row otherwise. */}
      {chaosKeys > 0 ? (
        <button type="button" className="ospend-chaos" onClick={handleChaosUnlock}
          data-examine-name="Chaos Key" data-examine="Unlocks a random entry from all the tables at once."
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 10px 3px 4px', background: '#3a1414', border: '1px solid #000', boxShadow: 'inset 1px 1px 0 #6b2a2a, inset -1px -1px 0 #1a0808', ...sh }}>
          <span className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
            <img className="osrs-px" src={CHAOS_KEY_ICON} alt="" aria-hidden="true" style={{ width: 36, height: 32 }} />
            <span className="osrs-stack">{chaosKeys}</span>
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px', minWidth: 0 }}>
            <span className="ospend-chaos-title" style={{ ...RS(16, 'RSBold'), color: '#ff3030' }}>Chaos Key Available</span>
            <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>Unlocks a random entry from all the tables at once.</span>
          </span>
          <span style={{ marginLeft: 'auto', ...RS(16, 'RSBold'), color: '#ff981f', flexShrink: 0 }}>Spend</span>
        </button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '3px 10px 3px 4px', background: 'var(--osrs-well, #1f1a14)', border: '1px solid #000', ...sh }}>
          <div className="osrs-slot" style={{ width: 44, height: 40, flexShrink: 0 }}>
            <img className="osrs-px" src={CHAOS_KEY_ICON} alt="" aria-hidden="true" style={{ width: 36, height: 32, filter: 'grayscale(1) brightness(.6)' }} />
            <span className="osrs-stack">0</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '17px', minWidth: 0 }}>
            <span style={{ ...RS(16, 'RSBold'), color: '#ff981f' }}>Chaos Keys</span>
            <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>
              Guaranteed at skill levels {andList(SKILL_CHAOS_MILESTONES)}, plus a {LEVEL_CHAOS_CHANCE}% chance on any level-up
            </span>
          </div>
          <span style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: '17px', flexShrink: 0 }}>
            <span style={{ ...RS(16, 'RSBold'), color: '#ffff00' }}>{totalLevel}</span>
            <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-muted, #8a7c66)' }}>Total Level</span>
          </span>
        </div>
      )}

      {/* The unlock tables, one item slot each. */}
      <div className="osrs-inner" style={{ padding: '6px 8px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap', ...sh }}>
          <h2 style={{ margin: 0, ...RS(16, 'RSBold'), color: '#ff981f' }}>Unlock tables</h2>
          <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>Number = what you already own</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '8px 6px' }}>
          {SPEND_CATEGORIES.map(c => {
            const st = cardState(c, !!rollable.get(c.type), keys, !!pendingUnlock);
            const on = c.type === sel.type;
            const status = st.complete ? 'Complete.' : st.blocked ? 'Blocked: no entry here is eligible yet.' : !st.keysAvailable ? 'Needs a Key to roll.' : 'Ready to roll for 1 Key.';
            return (
              <button key={c.label} type="button" className="ospend-cell" aria-pressed={on} onClick={() => setSelType(c.type)}
                title={`${c.label}: ${c.unlocked} of ${c.total} unlocked`}
                data-examine-name={c.label}
                data-examine={`${c.label}: ${c.subLabel}. ${c.unlocked} of ${c.total} unlocked. ${status}`}>
                <span className="osrs-slot" style={{ width: '100%', maxWidth: 86, height: 76, boxShadow: on ? 'inset 0 0 0 2px #ffffff, inset 1px 1px 0 3px var(--osrs-slot-hi, #2a231a)' : undefined }}>
                  <img className="osrs-px" src={tableSprite(c.type)} alt="" aria-hidden="true"
                    style={{ width: 54, height: 48, objectFit: 'contain', opacity: st.keysAvailable || on || st.complete ? 1 : 0.55 }} />
                  <span className="osrs-stack">{c.unlocked}</span>
                </span>
                <span className="ospend-cname" style={{ maxWidth: '100%', ...RS(), color: on ? '#ffffff' : st.complete ? '#0dc10d' : '#ff981f', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)', lineHeight: '13px' }}>{c.unlocked}/{c.total}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The chosen table: roll it, view its pool, see what it already gave. */}
      <div className="osrs-inner" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0 }}>
            <img className="osrs-px" src={tableSprite(sel.type)} alt="" aria-hidden="true" style={{ width: 36, height: 32, objectFit: 'contain' }} />
          </div>
          <div style={{ minWidth: 0, flex: '1 1 120px', display: 'flex', flexDirection: 'column', lineHeight: '18px', ...sh }}>
            <span style={{ ...RS(16, 'RSBold'), color: '#ff981f' }}>{sel.label}</span>
            <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-tan, #c8b897)' }}>{sel.subLabel}</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span title="Price" style={{ height: 30, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px 0 4px', background: 'var(--osrs-well, #1f1a14)', border: '1px solid #000', ...RS(16, 'RSBold'), color: '#ffff00', ...sh }}>
              <img className="osrs-px" src={KEY_ICON} alt="" aria-hidden="true" style={{ width: 27, height: 24 }} />1
            </span>
            <button type="button" className="osrs-btn" disabled={!selState.clickable} onClick={() => handleUnlock(sel.type)}
              aria-label={`Unlock from ${sel.label}`}
              title={selState.blocked && !selState.complete ? 'No entry here is eligible yet — open more locations or quests first.' : undefined}
              style={{ height: 30, padding: '0 14px' }}>{cta}</button>
            <button type="button" className="osrs-btn" onClick={() => openDashboardPool(sel.type)} style={{ height: 30, padding: '0 10px' }}>View pool</button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="ospend-bar" style={{ flex: 1 }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: selState.complete ? '#0dc10d' : categoryColor(sel.type), boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.35)' }} />
          </div>
          <span style={{ ...RS(), color: '#ffffff', ...sh }}>{sel.unlocked}/{sel.total} unlocked</span>
        </div>
        <span style={{ ...RS(16, 'RSBold'), color: '#ff981f', ...sh }}>{listTitle}</span>
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 4 }}>
            {chips.map(c => (
              <span key={c.text} data-examine-name={c.text} data-examine={c.examine}
                style={{ height: 24, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', gap: 5, padding: '0 7px 0 5px', background: c.on ? 'var(--osrs-window, #3e3529)' : '#241e17', border: '1px solid #000', ...RS(), color: c.on ? '#ffffff' : '#7d705c', ...sh }}>
                {c.icon && <img className="osrs-px" src={c.icon} alt="" aria-hidden="true" style={{ width: 16, height: 16, filter: c.on ? 'none' : 'grayscale(1) brightness(.6)' }} />}
                {c.text}
                {c.gem && <img className="osrs-px" src={c.gem} alt="" aria-hidden="true" style={{ width: 18, height: 16 }} />}
              </span>
            ))}
          </div>
        )}
        <span style={{ ...RS(16, 'RSSmall'), color: 'var(--osrs-muted, #8a7c66)', ...sh }}>
          Omni-Keys (spent on the Dashboard) pick the exact unlock; Chaos Keys unlock at random from every table at once.
        </span>
      </div>
    </div>
  );
};

export default OsrsSpend;
