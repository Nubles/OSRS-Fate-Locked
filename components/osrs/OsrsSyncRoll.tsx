import React, { useEffect, useRef, useState } from 'react';
import { BASELINE_NOTE, syncHoldText, syncIdleText, useAutoRoll } from '../AutoRollPanel';
import { RollInbox } from '../RollInbox';
import { RuneLiteOnboarding } from '../RuneLiteOnboarding';
import { WikiIcon } from '../WikiIcon';
import { GROUP_IRON_TITLES, GROUP_TITLES, type AccountTitle } from '../../utils/accountTitle';
import { absoluteUrl, itemSrc, skillIconSrc } from './OsrsDashGems';
import './osrs-world.css';

/**
 * Sync & Roll in the OSRS layout (the SyncRoll board): the Roll Inbox on the
 * left, the hiscores sync and the RuneLite guide on the right. Every control
 * is the classic panel's own (useAutoRoll, RollInbox, RuneLiteOnboarding);
 * this only lays them out and dresses them as interface panels.
 */

// Each title's tag, in the colour of its in-game chat badge.
const TITLE_COLOR: Record<AccountTitle['tone'], string> = {
  ultimate: '#dcdcdc',
  hardcore: '#ff3030',
  ironman: '#a8a8a8',
  group: '#5a7cf0',
  unranked: '#0dc10d',
  regular: '#ffff00',
};

const RefreshGlyph = () => (
  <svg aria-hidden="true" width="13" height="13" viewBox="0 0 14 14"><path d="M12 7a5 5 0 1 1-1.5-3.5M12 1v3.5H8.5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
);
const LockGlyph = ({ size = 12 }: { size?: number }) => (
  <svg aria-hidden="true" width={size} height={size * 14 / 12} viewBox="0 0 12 14"><path d="M3 6V4a3 3 0 0 1 6 0v2" fill="none" stroke="#c77dff" strokeWidth="2" /><rect x="1" y="6" width="10" height="7" fill="#c77dff" /></svg>
);

const OsrsSyncRoll: React.FC = () => {
  const {
    linkedAccount, name, setName, status, error, fetched, groupTitle, chooseGroupTitle, title,
    rolledTo, applied, skillRolling, skillKeysGained, currentLevels, isUnlocked, gains, onFetch, autoRoll, totalGain,
    plans, holds, baselineTaken,
    renameOpen, newName, setNewName, renameError, renamedTo, onRename, openRename, cancelRename,
  } = useAutoRoll();

  const rootRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const wide = w >= 1000;

  const earned = skillKeysGained && (skillKeysGained.keys + skillKeysGained.special + skillKeysGained.chaos) > 0 ? skillKeysGained : null;

  const sync = (
    <div className="osrs-inner osync-panel">
      <div className="osync-head">
        <img className="osrs-px" src={itemSrc(989)} alt="" aria-hidden="true" width={27} height={24} />
        <h2>Sync &amp; Roll</h2>
        <span className="osync-tag" style={{ color: '#c77dff', background: '#2a1f33' }}>Prototype</span>
      </div>
      <span className="osync-small" style={{ color: 'var(--osrs-tan, #c8b897)' }}>
        Pull your account from the OSRS hiscores and roll every level you've gained since you linked it, as if you logged each one.
        Powered by the Wise Old Man API. Currently syncs skill levels.
      </span>

      {/* Username: locked to the linked character once set (Change name moves it). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label className="osync-input" title={linkedAccount ? 'This run is linked to this account' : undefined}>
          {linkedAccount ? <LockGlyph /> : (
            <svg aria-hidden="true" width="13" height="13" viewBox="0 0 14 14"><circle cx="6" cy="6" r="4.5" fill="none" stroke="#c8b897" strokeWidth="2" /><path d="M9.5 9.5L13 13" stroke="#c8b897" strokeWidth="2" /></svg>
          )}
          <input
            value={linkedAccount ?? name}
            onChange={(e) => !linkedAccount && setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFetch()}
            placeholder="OSRS username..."
            readOnly={!!linkedAccount}
            aria-label="OSRS username"
            maxLength={12}
            style={{ color: linkedAccount ? 'var(--osrs-tan, #c8b897)' : '#ffffff' }}
          />
        </label>
        <button type="button" className="osrs-btn" onClick={onFetch} disabled={status === 'loading' || (!linkedAccount && !name.trim())}
          style={{ height: 30, padding: '0 12px', gap: 6 }}>
          <RefreshGlyph />{status === 'loading' ? 'Loading...' : linkedAccount ? 'Refresh' : 'Fetch'}
        </button>
      </div>
      {linkedAccount && (
        <span className="osync-small" style={{ color: 'var(--osrs-muted, #8a7c66)' }}>
          This run is linked to <span style={{ color: '#ffffff' }}>{linkedAccount}</span>
          {!renameOpen && <>{' '}<button type="button" className="osync-link" onClick={openRename}>Change name</button></>}
        </span>
      )}
      {linkedAccount && renameOpen && (
        <div className="osrs-chat osync-rename" data-testid="character-rename">
          <span className="osync-small">
            Changed your OSRS name? Type the new one as it shows in game. RuneLite records your run on this
            character, and Sync &amp; Roll pulls its hiscores. Roll any new levels first: the new name's levels count as already had.
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <label className="osync-input">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onRename()}
                placeholder="New name..."
                aria-label="New OSRS name"
                maxLength={12}
                style={{ color: '#ffffff' }}
              />
            </label>
            <button type="button" className="osrs-btn" onClick={onRename} disabled={!newName.trim()} style={{ height: 30, padding: '0 12px' }}>Save name</button>
            <button type="button" className="osrs-btn" onClick={cancelRename} style={{ height: 30, padding: '0 12px' }}>Cancel</button>
          </div>
          {renameError && <span role="alert" className="osync-small" style={{ color: '#800000' }}>{renameError}</span>}
        </div>
      )}
      {renamedTo && !renameOpen && (
        <span role="status" className="osync-small" style={{ color: '#00ff00' }}>
          This run now uses {renamedTo}. A paired RuneLite gets the new name within a minute or two;
          if it still shows the old one, log out and back in.
        </span>
      )}

      {status === 'error' && (
        <span role="alert" style={{ color: '#ff3030' }}>
          {error}
          {linkedAccount && !renameOpen && ' If you changed your OSRS name, use "Change name" above.'}
        </span>
      )}

      {fetched && (
        <>
          {baselineTaken && (
            <span role="status" data-testid="sync-baseline-note" className="osync-small" style={{ color: '#00ffff' }}>
              {BASELINE_NOTE}
            </span>
          )}
          <div className="osync-account">
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px', minWidth: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: "'RSBold', sans-serif", color: '#ffffff' }}>{fetched.displayName}</span>
                {title && (
                  <span className="osync-tag" data-account-title={title.label} style={{ color: TITLE_COLOR[title.tone], background: 'var(--osrs-inner, #2e271e)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {title.badge && <WikiIcon file={title.badge} alt="" size={11} />}
                    {title.label}
                  </span>
                )}
              </span>
              <span className="osync-small" style={{ color: 'var(--osrs-muted, #8a7c66)' }}>
                Total level <span style={{ color: '#ffffff' }}>{fetched.totalLevel}</span>
                {fetched.combatLevel != null && <> · Combat <span style={{ color: '#ffffff' }}>{fetched.combatLevel}</span></>}
              </span>
              {fetched.accountType === 'regular' && !groupTitle && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                  <span className="osync-small" style={{ color: '#ffff00' }}>
                    Not on the ironman hiscores. Wise Old Man lists group irons as regular accounts, so pick yours if you're one:
                  </span>
                  <div role="group" aria-label="Group ironman title" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {GROUP_IRON_TITLES.map((choice) => (
                      <button key={choice} type="button" className="osrs-btn" onClick={() => chooseGroupTitle(choice)} style={{ height: 24, padding: '0 8px', gap: 4 }}>
                        <WikiIcon file={GROUP_TITLES[choice].badge!} alt="" size={11} />
                        {GROUP_TITLES[choice].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {fetched.accountType === 'regular' && groupTitle && (
                <span className="osync-small" style={{ color: 'var(--osrs-muted, #8a7c66)' }}>
                  Your group title: Wise Old Man can't tell group irons apart.{' '}
                  <button type="button" className="osync-link" onClick={() => chooseGroupTitle(null)}>Change</button>
                </span>
              )}
            </div>
            <div style={{ marginLeft: 'auto', textAlign: 'right', maxWidth: 300, lineHeight: '18px' }}>
              {!applied && !skillRolling && gains.length > 0 && (
                <button type="button" className="osrs-btn" onClick={autoRoll} style={{ height: 30, padding: '0 12px', color: '#00ff00' }}>
                  Auto-roll {gains.length} skill{gains.length === 1 ? '' : 's'} (+{totalGain})
                </button>
              )}
              {skillRolling && <span style={{ color: '#ffff00' }}>Rolling levels...</span>}
              {applied && (
                <span style={{ color: '#0dc10d' }}>
                  Synced
                  {earned && (
                    <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>
                      {' '}· earned <span style={{ color: '#ffff00' }}>{earned.keys} Key{earned.keys === 1 ? '' : 's'}</span>
                      {earned.special > 0 && <>, <span style={{ color: '#c77dff' }}>{earned.special} Omni-Key{earned.special === 1 ? '' : 's'}</span></>}
                      {earned.chaos > 0 && <>, <span style={{ color: '#ff3030' }}>{earned.chaos} Chaos Key{earned.chaos === 1 ? '' : 's'}</span></>}
                    </span>
                  )}
                </span>
              )}
              {!applied && !skillRolling && gains.length === 0 && (
                <span style={{ color: 'var(--osrs-tan, #c8b897)' }}>{syncIdleText(holds)}</span>
              )}
            </div>
          </div>

          {/* Skill grid: current to real, gains highlighted; revealed as the roll reaches them. */}
          <div className="osync-skills">
            {fetched.skills.map((s) => {
              const current = currentLevels[s.skill] ?? 1;
              const unlocked = isUnlocked(s.skill);
              const gainIdx = gains.findIndex(g => g.skill === s.skill);
              const isGain = gainIdx > -1;
              const revealed = !isGain || applied || gainIdx < rolledTo;
              const held = plans[s.skill]?.hold === 'linked';
              const shown = isGain ? gains[gainIdx].level : s.level;
              return (
                <div key={s.skill} className={`osync-skill${unlocked ? '' : ' is-locked'}${isGain && !applied ? ' is-gain' : ''}`}
                  data-sync-hold={plans[s.skill]?.hold ?? undefined}
                  title={syncHoldText(s.skill, plans[s.skill])}>
                  <img className="osrs-px" src={skillIconSrc(s.skill)} alt="" aria-hidden="true" />
                  <span className="osync-skill-name">{s.skill}</span>
                  {!unlocked ? (
                    <span className="osync-skill-lvl" style={{ fontFamily: "'RSSmall', sans-serif", color: 'var(--osrs-btn-off, #7d705c)' }}>locked</span>
                  ) : (
                    <span className="osync-skill-lvl">
                      {isGain && !applied && <span style={{ color: 'var(--osrs-muted, #8a7c66)', fontFamily: "'RSSmall', sans-serif" }}>{current} &rarr; </span>}
                      <span style={{ color: isGain ? (revealed ? '#00ff00' : 'var(--osrs-muted, #8a7c66)') : held ? 'var(--osrs-muted, #8a7c66)' : '#ffff00' }}>{revealed ? shown : '..'}</span>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <span className="osync-small" style={{ color: '#6f6250', lineHeight: '15px' }}>
            Hiscores data via Wise Old Man · each synced level runs through the live RNG engine, so it awards keys, Omni and
            Chaos exactly as levelling it would, all logged to History · levels the account had when linked don't roll · a backup is created first.
          </span>
        </>
      )}

      {status === 'idle' && !linkedAccount && (
        <div className="osync-empty">
          Enter your OSRS username to bind this run to your account. Levels it already has don't roll; only the ones you gain from now on.
        </div>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className={`osync-root${wide ? ' is-wide' : ''}`}>
      <div className="osrs-inner osync-inbox" style={{ ['--osync-inbox-icon' as string]: `url(${absoluteUrl(itemSrc(20546))})` }}>
        <RollInbox />
      </div>
      <div className="osync-right">
        {sync}
        <div className="osrs-inner osync-rl">
          <RuneLiteOnboarding />
        </div>
      </div>
    </div>
  );
};

export default OsrsSyncRoll;
