import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../../context/GameContext';
import { useLocalStorage } from '../../hooks/useLocalStorage';
import { computeUnlockImpact } from '../../utils/unlockImpact';
import { showChunkOnMap } from '../../utils/chunkLocations';
import {
  selectJournalNextBestActions, placeFor, wikiUrl, openJournalAction, planJournalAction,
  type JournalNextBestAction, type SubTab,
} from '../JournalNextBest';
import { JournalIcon } from './OsrsJournalParts';

/**
 * "Next best actions" in the OSRS layout: the same ranked feed of quests and
 * diary tiers as stone buttons (yellow ready, orange one thing missing), each
 * opening an OSRS "Choose Option" menu with the classic menu's actions.
 */

const ChooseOption: React.FC<{ a: JournalNextBestAction; onPick: (s: SubTab) => void; onClose: () => void }> = ({ a, onPick, onClose }) => {
  const { unlocks, gameModeId } = useGame();
  const [showUnlocks, setShowUnlocks] = useState(false);
  const place = placeFor(a, unlocks);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Close on a press outside the menu and its button, or on Escape.
  useEffect(() => {
    const onPointerDown = (event: Event) => {
      const anchor = menuRef.current?.parentElement;
      if (anchor && event.target instanceof Node && !anchor.contains(event.target)) closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeRef.current(); };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const opens = useMemo(() => {
    if (a.kind !== 'quest') return null;
    const imp = computeUnlockImpact(unlocks, { ...unlocks, quests: [...unlocks.quests, a.id] }, gameModeId);
    return { quests: imp.directQuestNames, diaries: imp.directDiaryIds };
  }, [a, unlocks, gameModeId]);

  const Item: React.FC<{ verb: string; onClick?: () => void; disabled?: boolean }> = ({ verb, onClick, disabled }) => (
    <button
      type="button"
      role="menuitem"
      className="ojr-menu-item"
      disabled={disabled}
      onClick={() => { if (!disabled) { onClick?.(); onClose(); } }}
    >
      {verb} <span className="t">{a.name}</span>
    </button>
  );

  return (
    <div ref={menuRef} className="ojr-menu" role="menu" aria-label={`Options for ${a.name}`}>
      <div className="ojr-menu-title">Choose Option</div>
      <div className="ojr-menu-body">
        <Item verb="Open in the list" onClick={() => openJournalAction(a, onPick)} />
        <Item verb={place ? 'Start on the map' : 'No map location for'} disabled={!place} onClick={() => place && showChunkOnMap(place.cx, place.cy)} />
        <a role="menuitem" className="ojr-menu-item" href={wikiUrl(a)} target="_blank" rel="noopener noreferrer" onClick={onClose}>
          Wiki guide <span className="t">{a.name}</span>
        </a>
        <Item verb="Plan a route" onClick={() => planJournalAction(a)} />
        {opens && (opens.quests.length > 0 || opens.diaries.length > 0) && (
          <>
            <button type="button" role="menuitem" className="ojr-menu-item" aria-expanded={showUnlocks} onClick={() => setShowUnlocks(s => !s)}>
              What it unlocks <span className="t">{opens.quests.length} quests, {opens.diaries.length} diary tiers</span>
            </button>
            {showUnlocks && (
              <div className="ojr-menu-note">
                {opens.quests.length > 0 && <div>Quests: {opens.quests.slice(0, 5).join(', ')}{opens.quests.length > 5 ? '…' : ''}</div>}
                {opens.diaries.length > 0 && <div>Diary tiers: {opens.diaries.slice(0, 4).join(', ')}{opens.diaries.length > 4 ? '…' : ''}</div>}
              </div>
            )}
          </>
        )}
        <button type="button" role="menuitem" className="ojr-menu-item" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
};

export const OsrsJournalNextBest: React.FC<{ onPick: (sub: SubTab) => void }> = ({ onPick }) => {
  const { unlocks, gameModeId } = useGame();
  const [open, setOpen] = useLocalStorage<boolean>('jrnl:nextbest:open', true);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const actions = useMemo(() => selectJournalNextBestActions(unlocks, gameModeId), [unlocks, gameModeId]);

  if (actions.length === 0) return null;
  const ready = actions.filter(a => a.unmet === 0).length;

  return (
    <div className="ojr-nb">
      <button type="button" className="ojr-nb-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" style={{ transform: open ? 'none' : 'rotate(-90deg)' }}><path d="M1 3l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        Next best actions
        <span className="ojr-nb-sum">{ready > 0 ? `${ready} ready` : `${actions.length} close`}</span>
      </button>
      {open && (
        <div className="ojr-nb-list">
          {actions.map(a => {
            const key = `${a.kind}:${a.id}`;
            const isReady = a.unmet === 0;
            return (
              <div key={key} className="ojr-nb-item">
                <button
                  type="button"
                  className={`osrs-btn${openItem === key ? ' is-on' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={openItem === key}
                  data-examine={isReady
                    ? `${a.kind === 'quest' ? 'Quest' : 'Diary tier'}. Every requirement is met.`
                    : `${a.kind === 'quest' ? 'Quest' : 'Diary tier'}. One thing missing: ${a.firstBlocker}.`}
                  data-examine-name={a.name}
                  onClick={() => setOpenItem(openItem === key ? null : key)}
                >
                  <JournalIcon kind={a.kind === 'quest' ? 'quest' : 'diary'} size={16} />
                  <span className="ojr-nb-name" style={{ color: isReady ? '#ffff00' : undefined }}>{a.name}</span>
                  <span className="ojr-nb-tag" style={{ color: isReady ? '#00ff00' : 'var(--osrs-tan, #c8b897)' }}>{isReady ? 'ready' : a.firstBlocker}</span>
                </button>
                {openItem === key && <ChooseOption a={a} onPick={onPick} onClose={() => setOpenItem(null)} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OsrsJournalNextBest;
