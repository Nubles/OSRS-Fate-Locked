// Only the two lazily loaded header menus use this, so it stays out of the
// start-up chunk that utils/backups.ts is part of.
import { RESET_CONFIRM_MESSAGE } from './backups';

/** Asked when that backup could not be kept: this browser has no room for one. */
export const RESET_NO_BACKUP_MESSAGE =
  'No backup could be kept in this browser, so this reset could not be undone. Cancel to export the run first (Sync Code → Export), or OK to reset anyway.';

/** Reset all progress in both layouts: confirm, and ask again if no backup could be kept. */
export const confirmReset = async (resetGame: (anyway?: boolean) => Promise<boolean>): Promise<void> => {
  if (window.confirm(RESET_CONFIRM_MESSAGE) && !(await resetGame()) && window.confirm(RESET_NO_BACKUP_MESSAGE)) await resetGame(true);
};
