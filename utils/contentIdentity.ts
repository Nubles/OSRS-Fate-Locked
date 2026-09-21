import aliases from '../data/contentAliases.json';
import { QUEST_DATA } from '../data/questData';
import { BOSSES_LIST } from '../data/items';

const normalise = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
const questIds = new Map<string, string>();
for (const quest of Object.values(QUEST_DATA)) {
  questIds.set(normalise(quest.id), quest.id);
  questIds.set(normalise(quest.name), quest.id);
}
for (const [alias, id] of Object.entries(aliases.quests)) questIds.set(normalise(alias), id);
const bossIds = new Map(BOSSES_LIST.map(name => [normalise(name), name]));
for (const [alias, id] of Object.entries(aliases.bosses)) bossIds.set(normalise(alias), id);

/** Reviewed aliases preserve saved IDs and RFD subquest identity. */
export const canonicalQuestId = (name: string): string | undefined => questIds.get(normalise(name));
export const resolveQuest = (name: string) => {
  const id = canonicalQuestId(name);
  return id ? QUEST_DATA[id] : undefined;
};
export const canonicalBossId = (name: string): string | undefined => bossIds.get(normalise(name));
