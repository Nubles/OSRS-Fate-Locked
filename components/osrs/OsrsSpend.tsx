import React, { useMemo } from 'react';
import './osrs-spend.css';
import { TableType, type LogEntry } from '../../types';
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
import { openOsrsScreen, setOsrsKeysTab } from '../../utils/osrsNav';
import { CASKET_ICON, CHAOS_KEY_ICON, KEY_ICON, OMNI_KEY_ICON, ON_PARCHMENT, osrsSkillIcon, tableSprite, tierGem } from './OsrsSpendShared';
import { clock, lineDetails, look, speaker } from './OsrsHistoryShared';
import { setRevealHost, setSpendTable, useKeysView } from './OsrsKeysState';
import { OsrsKeysTabs } from './OsrsKeysTabs';
import { sentenceCaseLabel } from '../../utils/labelCase';
import { useScrollMore } from '../../utils/scrollFade';

type Chip = { text: string; icon?: string; gem?: string | null; on: boolean; examine: string };

/** What a table's card can do right now; the same rules as the classic SpendCard. */
const cardState = (c: SpendCategory, rollable: boolean, keys: number, pending: boolean) => {
  const complete = !c.can;
  const blocked = c.can && !rollable;
  const disabled = !c.can || !rollable || pending;
  const keysAvailable = keys > 0;
  const clickable = !disabled && keysAvailable && !complete;
  return { complete, blocked, clickable, keysAvailable };
};
type CardState = ReturnType<typeof cardState>;

const BLOCKED_TITLE = 'No entry here is eligible yet — open more locations or quests first.';
const statusText = (st: CardState) =>
  st.complete ? 'Complete.' : st.blocked ? 'Blocked: no entry here is eligible yet.' : !st.keysAvailable ? 'Needs a Key to roll.' : 'Ready to roll for 1 Key.';

/** Notices that only show when they apply: Omni-Keys ready and Keys owed. */
const Notices: React.FC<{ specialKeys: number; keysOwed: number; isChunked: boolean }> = ({ specialKeys, keysOwed, isChunked }) => (
  <>
    {specialKeys > 0 && (
      <div className="ospend-note">
        <div className="osrs-slot ospend-note-slot">
          <img className="osrs-px" src={OMNI_KEY_ICON} alt="" aria-hidden="true" />
          <span className="osrs-stack">{specialKeys}</span>
        </div>
        <div className="ospend-note-words">
          <span className="t" style={{ color: '#c77dff' }}>{specialKeys} Omni-Key{specialKeys > 1 ? 's' : ''} Ready</span>
          <span className="s">
            Omni-Keys aren't spent here. Click a locked skill, gear slot, {isChunked ? '' : 'area, '}boss or other entry on the <span style={{ color: '#c77dff' }}>Dashboard</span> to pick exactly what to unlock.
          </span>
        </div>
      </div>
    )}
    {keysOwed > 0 && (
      <div className="ospend-note">
        <div className="osrs-slot ospend-note-slot">
          <img className="osrs-px" src={KEY_ICON} alt="" aria-hidden="true" style={{ filter: 'grayscale(1) brightness(.6)' }} />
          <span className="osrs-stack" style={{ color: '#ff3030' }}>{keysOwed}</span>
        </div>
        <div className="ospend-note-words">
          <span className="t">{keysOwed} Standard Key{keysOwed === 1 ? '' : 's'} owed</span>
          <span className="s">
            From the pet compensation you chose: the next {keysOwed === 1 ? 'Standard Key you earn pays' : `${keysOwed} Standard Keys you earn pay`} this first.
          </span>
        </div>
      </div>
    )}
  </>
);

/** Chaos Keys: a button when there is one to spend, an info row otherwise. */
const ChaosRow: React.FC<{ chaosKeys: number; totalLevel: number; onSpend: () => void; wide: boolean }> = ({ chaosKeys, totalLevel, onSpend, wide }) => {
  const rule = `Guaranteed at skill levels ${andList(SKILL_CHAOS_MILESTONES)}, plus a ${LEVEL_CHAOS_CHANCE}% chance on any level-up`;
  if (chaosKeys > 0) {
    return (
      <button type="button" className={`ospend-chaos is-live${wide ? ' wide' : ''}`} onClick={onSpend}
        data-examine-name="Chaos Key" data-examine="Unlocks a random entry from all the tables at once.">
        <span className="osrs-slot ospend-note-slot">
          <img className="osrs-px" src={CHAOS_KEY_ICON} alt="" aria-hidden="true" />
          <span className="osrs-stack">{chaosKeys}</span>
        </span>
        <span className="ospend-note-words">
          <span className="t ospend-chaos-title" style={{ color: '#ff3030' }}>Chaos Key Available</span>
          <span className="s">Unlocks a random entry from all the tables at once.</span>
        </span>
        <span className="ospend-chaos-cta">Spend</span>
      </button>
    );
  }
  if (!wide) {
    return (
      <div className="ospend-chaos" title={rule} data-examine-name="Chaos Keys" data-examine={`${rule}.`}>
        <img className="osrs-px" src={CHAOS_KEY_ICON} alt="" aria-hidden="true" style={{ width: 36, height: 32 }} />
        <span className="ospend-note-words">
          <span className="t">Chaos Keys</span>
          <span className="s">{LEVEL_CHAOS_CHANCE}% chance on every level up</span>
        </span>
        <span className="ospend-total">Total level {totalLevel}</span>
      </div>
    );
  }
  return (
    <div className="ospend-chaos wide">
      <div className="osrs-slot ospend-note-slot">
        <img className="osrs-px" src={CHAOS_KEY_ICON} alt="" aria-hidden="true" style={{ filter: 'grayscale(1) brightness(.6)' }} />
        <span className="osrs-stack">0</span>
      </div>
      <span className="ospend-note-words">
        <span className="t">Chaos Keys</span>
        <span className="s">{rule}</span>
      </span>
      <span className="ospend-total-big"><span className="n">{totalLevel}</span><span className="l">Total Level</span></span>
    </div>
  );
};

/** Compact: one table as a stone card (World board): sprite and count, name and Roll, then its blurb (two lines, full text on hover). */
const TableCard: React.FC<{ c: SpendCategory; st: CardState; onRoll: () => void; onOpen: () => void }> = ({ c, st, onRoll, onOpen }) => {
  const what = sentenceCaseLabel(c.subLabel);
  return (
    <div className="ospend-card" data-examine-name={c.label} data-examine={`${c.label}: ${c.subLabel}. ${c.unlocked} of ${c.total} unlocked. ${statusText(st)}`}>
      <button type="button" className="osrs-slot ospend-card-slot" onClick={onOpen} title={`${c.label}: ${c.unlocked} of ${c.total} unlocked. Open in the full window.`}
        aria-label={`${c.label}: ${c.unlocked} of ${c.total} unlocked. Open in the full window`}>
        <img className="osrs-px" src={tableSprite(c.type)} alt="" aria-hidden="true" style={{ opacity: st.keysAvailable || st.complete ? 1 : 0.55 }} />
        <span className="osrs-stack">{c.unlocked}</span>
      </button>
      <span className="ospend-card-row">
        <button type="button" className="ospend-card-name" onClick={onOpen} tabIndex={-1} aria-hidden="true"
          style={{ color: st.complete ? '#0dc10d' : '#ff981f' }}>{c.label}</button>
        <button type="button" className={`osrs-btn ospend-roll${st.complete || st.blocked ? '' : ' is-key'}`} disabled={!st.clickable} onClick={onRoll}
          aria-label={`Unlock from ${c.label}`} title={st.blocked && !st.complete ? BLOCKED_TITLE : st.complete ? undefined : `Roll: spend 1 Key on ${c.label}`}>
          {st.complete ? 'Done' : st.blocked ? 'Blocked' : <img className="osrs-px" src={KEY_ICON} alt="" aria-hidden="true" />}
        </button>
      </span>
      <span className="what" title={what}>{what}</span>
    </div>
  );
};

/** The recent game messages under the reveal window (SpendRoll board). */
const CHAT_LINES = 7;
const RecentChat: React.FC<{ history: readonly LogEntry[]; name: string }> = ({ history, name }) => {
  const lines = useMemo(() => history.slice(-CHAT_LINES), [history]);
  return (
    <div className="osrs-chat ospend-chat">
      <div className="ospend-chat-lines">
        {lines.map(e => {
          const l = look(e);
          const who = speaker(e);
          const d = lineDetails(e);
          return (
            <div key={e.id} className="ln">
              [{clock(e.timestamp)}] {who && <span style={{ color: '#0000ff' }}>{who}:</span>} <span style={{ color: ON_PARCHMENT[l.tone] }}>{e.message}</span>{d ? ` ${d}` : ''}
            </div>
          );
        })}
      </div>
      <div className="ospend-chat-name">{name}: <span style={{ color: '#0000ff' }}>*</span></div>
    </div>
  );
};

/**
 * Spend Keys drawn as an OSRS interface. Compact (home screen Keys panel,
 * World board): the Chaos Keys row and a 2-column card per table. Wide (Keys
 * screen, SpendRoll board): the unlock tables as item slots, the chosen
 * table's detail, and the reveal window. Every table, count and handler comes
 * from GachaSection's useSpendModel.
 */
const OsrsSpend: React.FC<{ wide?: boolean }> = ({ wide = false }) => {
  const { keys, specialKeys, chaosKeys, keysOwed, unlocks, pendingUnlock, gameModeId, isChunked, rollable, totalLevel, handleUnlock, handleChaosUnlock, SPEND_CATEGORIES } = useSpendModel();
  const { customMode, history, linkedAccount } = useGame();
  const { spendTable } = useKeysView();
  const sel = SPEND_CATEGORIES.find(c => c.type === spendTable) ?? SPEND_CATEGORIES.find(c => c.type === TableType.REGIONS || c.type === TableType.CHUNKS) ?? SPEND_CATEGORIES[0];
  const stateOf = (c: SpendCategory) => cardState(c, !!rollable.get(c.type), keys, !!pendingUnlock);
  const selState = stateOf(sel);
  const [cardsRef, cardsMore] = useScrollMore<HTMLDivElement>();

  // What the player already owns from the chosen table, read from the same unlocks.
  const chips = useMemo((): Chip[] => {
    if (!wide) return [];
    const owned = (list: string[] | undefined, label: (s: string) => string = s => s) =>
      (list ?? []).map(item => ({ text: label(item), on: true, examine: `${label(item)}: unlocked from the ${sel.label} table.` }))
        .sort((a, b) => a.text.localeCompare(b.text));
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
  }, [wide, sel.type, sel.label, unlocks, gameModeId, customMode]);

  if (!wide) {
    return (
      <div className="ospend ospend-compact">
        <Notices specialKeys={specialKeys} keysOwed={keysOwed ?? 0} isChunked={isChunked} />
        <ChaosRow chaosKeys={chaosKeys} totalLevel={totalLevel} onSpend={handleChaosUnlock} wide={false} />
        <div ref={cardsRef} className={`osrs-inner ospend-cards${cardsMore ? ' is-more' : ''}`}>
          {SPEND_CATEGORIES.map(c => (
            <TableCard key={c.label} c={c} st={stateOf(c)} onRoll={() => handleUnlock(c.type)}
              onOpen={() => { setSpendTable(c.type); openOsrsScreen('keys', 'spend'); }} />
          ))}
        </div>
      </div>
    );
  }

  const tiered = sel.type === TableType.SKILLS || sel.type === TableType.EQUIPMENT;
  const listTitle = tiered ? 'Your tiers' : chips.length ? 'Already unlocked' : 'Nothing unlocked from this table yet';
  const pct = selState.complete ? 100 : sel.total > 0 ? Math.round((sel.unlocked / sel.total) * 100) : 0;
  const cta = selState.complete ? 'Done' : selState.blocked ? 'Blocked' : !selState.keysAvailable ? 'Need Keys' : 'Unlock';
  const playerName = linkedAccount || 'You';

  // The reveal window when no roll is playing: the game's "Select an Option" for the chosen table.
  const pick = selState.complete
    ? { text: `Every entry on the ${sel.label} table is unlocked.`, yes: null as string | null, no: null as string | null }
    : selState.blocked
      ? { text: `No entry on the ${sel.label} table is eligible yet: open more locations or quests first.`, yes: null, no: null }
      : !selState.keysAvailable
        ? { text: 'You have no Keys. Farm Keys to earn more, then come back.', yes: null, no: 'Go to Farm Keys.' }
        : { text: `Spend 1 Key on the ${sel.label} table? It unlocks a random locked entry from it.`, yes: 'Yes, spend 1 Key.', no: null };

  return (
    <div className="ospend ospend-wide">
      <div className="osrs-win ospend-main">
        <OsrsKeysTabs hint="Spend a Key on a table to unlock a random entry from it." small />
        <Notices specialKeys={specialKeys} keysOwed={keysOwed ?? 0} isChunked={isChunked} />
        <ChaosRow chaosKeys={chaosKeys} totalLevel={totalLevel} onSpend={handleChaosUnlock} wide />

        {/* The unlock tables, one item slot each. */}
        <div className="osrs-inner ospend-tables">
          <div className="ospend-tables-head">
            <h2>Unlock tables</h2>
            <span>Number = what you already own</span>
          </div>
          <div className="ospend-cells">
            {SPEND_CATEGORIES.map(c => {
              const st = stateOf(c);
              const on = c.type === sel.type;
              return (
                <button key={c.label} type="button" className="ospend-cell" aria-pressed={on} onClick={() => setSpendTable(c.type)}
                  title={`${c.label}: ${c.unlocked} of ${c.total} unlocked`}
                  data-examine-name={c.label}
                  data-examine={`${c.label}: ${c.subLabel}. ${c.unlocked} of ${c.total} unlocked. ${statusText(st)}`}>
                  <span className={`osrs-slot ospend-cell-slot${on ? ' on' : ''}`}>
                    <img className="osrs-px" src={tableSprite(c.type)} alt="" aria-hidden="true"
                      style={{ opacity: st.keysAvailable || on || st.complete ? 1 : 0.55 }} />
                    <span className="osrs-stack">{c.unlocked}</span>
                  </span>
                  <span className="ospend-cname" style={{ color: on ? '#ffffff' : st.complete ? '#0dc10d' : '#ff981f' }}>{c.label}</span>
                  <span className="ospend-cfrac">{c.unlocked}/{c.total}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The chosen table: roll it, view its pool, see what it already gave. */}
        <div className="osrs-inner ospend-detail">
          <div className="ospend-detail-head">
            <div className="osrs-slot" style={{ width: 52, height: 48, flexShrink: 0 }}>
              <img className="osrs-px" src={tableSprite(sel.type)} alt="" aria-hidden="true" style={{ width: 36, height: 32, objectFit: 'contain' }} />
            </div>
            <div className="ospend-detail-name">
              <span className="t">{sel.label}</span>
              <span className="s" title={sentenceCaseLabel(sel.subLabel)}>{sentenceCaseLabel(sel.subLabel)}</span>
            </div>
            <div className="ospend-detail-tools">
              <span className="ospend-price" title="Price">
                <img className="osrs-px" src={KEY_ICON} alt="" aria-hidden="true" />1
              </span>
              <button type="button" className="osrs-btn" disabled={!selState.clickable} onClick={() => handleUnlock(sel.type)}
                aria-label={`Unlock from ${sel.label}`} title={selState.blocked && !selState.complete ? BLOCKED_TITLE : undefined}
                style={{ height: 30, padding: '0 14px' }}>{cta}</button>
              <button type="button" className="osrs-btn" onClick={() => openDashboardPool(sel.type)} style={{ height: 30, padding: '0 10px' }}>View pool</button>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="ospend-bar" style={{ flex: 1 }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.max(pct, sel.unlocked > 0 ? 1 : 0)}%`, background: selState.complete ? '#0dc10d' : categoryColor(sel.type), boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.35)' }} />
            </div>
            <span className="ospend-frac">{sel.unlocked}/{sel.total} unlocked</span>
          </div>
          <span className="ospend-listtitle">{listTitle}</span>
          {chips.length > 0 && (
            <div className="ospend-chips">
              {chips.map(c => (
                <span key={c.text} className={`ospend-chip${c.on ? '' : ' off'}`} data-examine-name={c.text} data-examine={c.examine}>
                  {c.icon && <img className="osrs-px" src={c.icon} alt="" aria-hidden="true" style={{ width: 18, height: 18, objectFit: 'contain', filter: c.on ? 'none' : 'grayscale(1) brightness(.6)' }} />}
                  {c.text}
                  {c.gem && <img className="osrs-px" src={c.gem} alt="" aria-hidden="true" style={{ width: 18, height: 16 }} />}
                </span>
              ))}
            </div>
          )}
          <span className="ospend-foot">
            Omni-Keys (spent on the Dashboard) pick the exact unlock; Chaos Keys unlock at random from every table at once.
          </span>
        </div>
      </div>

      <div className="ospend-side">
        <div className="osrs-win ospend-reveal">
          {/* While a roll plays, the reveal (PendingUnlockReveal) draws in here. */}
          <div ref={setRevealHost} className="ospend-reveal-host" hidden={!pendingUnlock} />
          {!pendingUnlock && (
            <>
              <div className="ospend-reveal-title"><h2>Spend Keys</h2></div>
              <div className="osrs-inner ospend-pick">
                <div className="osrs-slot ospend-pick-slot">
                  <img className="osrs-px" src={CASKET_ICON} alt="" aria-hidden="true" style={{ filter: selState.clickable ? 'none' : 'grayscale(1) brightness(.6)' }} />
                </div>
                <div className="osrs-chat ospend-pick-dialog" role="group" aria-label="Select an Option">
                  <span style={{ color: '#800000' }}>Select an Option</span>
                  <span style={{ lineHeight: '18px' }}>{pick.text}</span>
                  {pick.yes && <button type="button" className="ospend-opt" onClick={() => handleUnlock(sel.type)} disabled={!selState.clickable}>{pick.yes}</button>}
                  {pick.no && <button type="button" className="ospend-opt" onClick={() => setOsrsKeysTab('farm')}>{pick.no}</button>}
                </div>
              </div>
            </>
          )}
        </div>
        <RecentChat history={history} name={playerName} />
      </div>
    </div>
  );
};

export default OsrsSpend;
