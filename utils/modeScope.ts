/**
 * Small checks of what a run's mode can log, kept free of the big data sets
 * (quests, Combat Achievement tasks, the collection log) so the reducer can
 * use them without growing the app's first download. utils/modeContent.ts
 * has the lists for screens.
 */
import { F2P_CA_TASK_IDS, F2P_PET_IDS, isF2PCollectionLogItemId } from '../data/f2pContent';
import { isF2PMode } from '../config/gameModes';

const F2P_CA_TASK_SET = new Set<string>(F2P_CA_TASK_IDS);

/** Whether a run can do this Combat Achievement task. */
export const caTaskInMode = (taskId: string, gameModeId?: string): boolean => !isF2PMode(gameModeId) || F2P_CA_TASK_SET.has(taskId);

/** Whether a run can claim this pet. */
export const petInMode = (petId: number, gameModeId?: string): boolean => !isF2PMode(gameModeId) || F2P_PET_IDS.includes(petId);

export const MEMBERS_LOG_ITEM_REASON = 'This collection log item is members only, so it gives no Key in Free-to-play.';

/** Whether a run can log this collection log item. */
export const collectionLogItemInMode = (itemId: number, gameModeId?: string): boolean =>
  !isF2PMode(gameModeId) || isF2PCollectionLogItemId(itemId);
