import { confirmSpendPref } from './viewerPrefs';

/**
 * "Ask before Key clicks" (Settings, utils/viewerPrefs.ts
 * confirmSpendPref): a Yes / No box before a click spends a Key or rolls for
 * one. The box loads on first use, so players who turn the setting off never
 * download it.
 */
let asking: Promise<boolean> | null = null;

/** True when the player picks Yes. A second ask while the box is open is a No. */
export function askBeforeSpending(question: string): Promise<boolean> {
  if (asking) return Promise.resolve(false);
  asking = import('../components/SpendConfirm')
    .then(m => m.openSpendConfirm(question))
    .catch(() => false)
    .finally(() => { asking = null; });
  return asking;
}

/** Run `act` now when the setting is off, else only after a Yes. */
export function confirmThen(question: string, act: () => void): void {
  if (!confirmSpendPref.read()) { act(); return; }
  void askBeforeSpending(question).then(yes => { if (yes) act(); });
}
