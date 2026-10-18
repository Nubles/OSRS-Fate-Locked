/**
 * The quests that keep Fate's Mercy shut: those the run's chunks let it do
 * now (chunkedQuestRows' DOABLE rows). They need the chunk content, so the
 * provider loads this module with Mercy's call and reads them itself, rather
 * than trusting a list the caller sends (audit V3, October 2026). Without the
 * content there is no list, and so no call.
 */
import type { GameState } from '../types';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkedQuestRows } from '../components/QuestDoabilityPanel';
import { DEFAULT_MODE_ID } from '../config/gameModes';

type QuestState = Pick<GameState, 'unlocks' | 'gameModeId'>;

/** The doable quests, or null while the chunk content isn't loaded. */
export const doableChunkedQuests = (state: QuestState): string[] | null =>
  chunkContentService.ready
    ? chunkedQuestRows(state.unlocks, state.gameModeId ?? DEFAULT_MODE_ID).filter(row => row.bucket === 'DOABLE').map(row => row.id)
    : null;

/**
 * Loads the chunk content if it isn't yet, then lists the doable quests for
 * the run as it is then (read() is called after the load). Null when the
 * content can't be loaded.
 */
export const loadDoableChunkedQuests = async (read: () => QuestState): Promise<string[] | null> => {
  if (!chunkContentService.ready && !(await chunkContentService.init())) return null;
  return doableChunkedQuests(read());
};
