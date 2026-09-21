import ocean from '../data/oceanChunks.json';
import type { UnlockState } from '../types';
export const OCEAN_CHUNK_KEYS: ReadonlySet<string> = new Set(ocean.keys);
export type SailingAccount = Pick<UnlockState, 'skills' | 'levels' | 'quests'>;
/** Ocean ownership is navigation access. Individual named islands keep their area/chunk locks. */
export const canNavigateOcean = (account?: SailingAccount): boolean => !!account
  && (account.skills?.Sailing ?? 0) > 0
  && (account.levels?.Sailing ?? 1) >= 1
  && account.quests.includes('Pandemonium');
