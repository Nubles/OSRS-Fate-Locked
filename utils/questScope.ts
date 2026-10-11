import { QUEST_DATA, type QuestData } from '../data/questData';
import { f2pQuestMembershipFor } from '../data/f2pQuestMembership';
import { isF2PMode } from '../config/gameModes';

const ALL_QUESTS = Object.values(QUEST_DATA);
const F2P_QUESTS = ALL_QUESTS.filter(quest => f2pQuestMembershipFor(quest.id) !== undefined);

/** The quests a run can do: the free-to-play quests in Free-to-play, every quest otherwise. */
export const questsForMode = (gameModeId?: string): QuestData[] => (isF2PMode(gameModeId) ? F2P_QUESTS : ALL_QUESTS);
