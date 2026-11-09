import { importWithRetry } from './lazyRetry';
import { confirmSpendPref } from './viewerPrefs';

/**
 * "Ask before Key clicks" (Settings, utils/viewerPrefs.ts
 * confirmSpendPref): a Yes / No box before a click spends a Key or rolls for
 * one. The box loads on first use, so players who turn the setting off never
 * download it.
 */
let asking: Promise<boolean> | null = null;

/** The same module the box is opened from, so warming it and opening it share one download. */
const loadBox = () => import('../components/SpendConfirm');

/**
 * Fetch the box ahead of the first Key click (utils/prefetch.ts), while the
 * setting is on. A tab left open across a new version can no longer fetch it,
 * because each version's files have their own names.
 */
export function warmSpendConfirm(): Promise<unknown> {
  return confirmSpendPref.read() ? loadBox() : Promise.resolve();
}

/**
 * The browser's own box, for when the in-game one can't be fetched (a new
 * version went live under this tab, or the connection dropped). The click
 * still asks and still works; doing nothing looked like a dead button.
 */
const askPlainly = (question: string): boolean => {
  try { return window.confirm(question); } catch { return false; }
};

/** True when the player picks Yes. A second ask while the box is open is a No. */
export function askBeforeSpending(question: string): Promise<boolean> {
  if (asking) return Promise.resolve(false);
  asking = importWithRetry(loadBox, 2, 300)
    .then(m => m.openSpendConfirm(question), () => askPlainly(question))
    .catch(() => false)
    .finally(() => { asking = null; });
  return asking;
}

/** Run `act` now when the setting is off, else only after a Yes. */
export function confirmThen(question: string, act: () => void): void {
  if (!confirmSpendPref.read()) { act(); return; }
  void askBeforeSpending(question).then(yes => { if (yes) act(); });
}
