/**
 * "Ask before spending" (Settings, utils/viewerPrefs.ts confirmSpendPref): a
 * Yes / No box before Spend Keys spends a Key. The box loads on first use, so
 * players who leave the setting off never download it.
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
