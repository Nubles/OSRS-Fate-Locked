/**
 * The goal a pinned id stands for. The Strategy Guide used to pin four quests
 * by their display name ('Desert Treasure II - The Fallen Empire') rather than
 * their id ('Desert Treasure II'); such a pin is read as its quest. Saves keep
 * the pin as stored.
 *
 * Loaded only by lazy chunks (StrategyGuide, GoalTracker, goalRoute).
 */
import { QUEST_DATA } from '../data/questData';

let questIdByName: Map<string, string> | null = null;

export const resolvePinnedGoal = (id: string): string => {
    if (QUEST_DATA[id]) return id;
    questIdByName ??= new Map(Object.values(QUEST_DATA).filter(q => q.name !== q.id).map(q => [q.name, q.id]));
    return questIdByName.get(id) ?? id;
};
