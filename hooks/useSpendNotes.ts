import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import type { TableType } from '../types';
import type { SpendNote } from '../utils/spendNoteTypes';
import { tableOutlookPref } from '../utils/viewerPrefs';
import { noteLayoutMoved } from '../utils/clickGuard';

export type { SpendNote };

/**
 * Spend Keys' outlook and hope lines per table, worked out a moment after the
 * run changes (the Areas outlook takes tens of milliseconds) and loaded on
 * first use, so neither a level-up nor the first paint waits for them.
 */
export const useSpendNotes = (): ReadonlyMap<TableType, SpendNote> => {
  const outlookOn = tableOutlookPref.use();
  const { unlocks, gameModeId, customMode, hopes } = useGame();
  const [notes, setNotes] = useState<ReadonlyMap<TableType, SpendNote>>(() => new Map());

  useEffect(() => {
    if (!outlookOn && !hopes?.length) { setNotes(new Map()); return; }
    let live = true;
    const timer = setTimeout(() => {
      import('../utils/spendNotes').then(({ spendNotes }) => {
        if (!live) return;
        // The new lines can move the cards under the pointer: hold spend clicks for a moment.
        noteLayoutMoved();
        setNotes(spendNotes(unlocks, gameModeId, customMode, hopes, outlookOn));
      }).catch(() => { /* a failed chunk load just leaves the lines off */ });
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [outlookOn, unlocks, gameModeId, customMode, hopes]);

  return notes;
};
