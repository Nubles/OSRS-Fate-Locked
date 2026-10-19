import { useSyncExternalStore } from 'react';

/**
 * A new run's first rolls ask "Did you finish this in game?" before they
 * roll, because a roll can't be undone and a new player clicks things to see
 * what they do. The First Steps guide (components/FirstHourGuide.tsx, loaded
 * lazily) turns the check on for a run's first few rolls and draws the
 * question; the Roll buttons, skill cards and collection log await
 * askBeforeRoll before they roll. Kept tiny on purpose: the entry chunk
 * imports it.
 */
export interface RollCheck {
  /** "Did you finish this in game?" */
  question: string;
  answer: (roll: boolean) => void;
}

let on = false;
let pending: RollCheck | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Set by the guide: whether the run's next roll should ask first. */
export const setRollCheckOn = (next: boolean): void => {
  on = next;
  // A question left waiting when the check goes off doesn't roll.
  if (!next && pending) pending.answer(false);
};

/** Whether a roll asks first right now. Callers test it before awaiting, so an unchecked roll stays synchronous. */
export const rollCheckOn = (): boolean => on;

/** Resolves true to roll, false to leave it. Without the check it resolves true at once. */
export const askBeforeRoll = (question = 'Did you finish this in game?'): Promise<boolean> => {
  if (!on) return Promise.resolve(true);
  if (pending) return Promise.resolve(false);
  return new Promise((resolve) => {
    const check: RollCheck = {
      question,
      answer: (roll) => {
        if (pending !== check) return;
        pending = null;
        emit();
        resolve(roll);
      },
    };
    pending = check;
    emit();
  });
};

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** The question waiting for an answer, or null. */
export const getRollCheck = (): RollCheck | null => pending;

/** The question waiting for an answer, or null. */
export const useRollCheck = (): RollCheck | null => useSyncExternalStore(subscribe, getRollCheck, getRollCheck);
