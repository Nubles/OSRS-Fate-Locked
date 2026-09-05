import identities from './questCatalog.json';
import { QUEST_DATA, type QuestData } from './questData';

export type QuestId = `quest:${string}`;
export interface QuestIdentity { readonly id: QuestId; readonly legacyId: string }
export interface CatalogQuest { readonly id: QuestId; readonly data: QuestData; readonly prerequisiteIds: readonly QuestId[] }
const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');

/** Saved names stay boundary aliases. New relations use allocated, immutable IDs. */
export function createQuestIndex(rows: readonly QuestIdentity[], source: Readonly<Record<string, QuestData>>) {
  const references = new Map<string, QuestId>();
  const byId = new Map<QuestId, CatalogQuest>();
  for (const { id, legacyId } of rows) {
    if (!/^quest:\d{4}$/.test(id) || byId.has(id) || !Object.hasOwn(source, legacyId)) throw new Error(`Invalid quest identity: ${id}`);
    const data = source[legacyId];
    for (const reference of new Set([id, legacyId, data.name])) {
      const key = normalize(reference);
      if (references.has(key) && references.get(key) !== id) throw new Error(`Ambiguous quest reference: ${reference}`);
      references.set(key, id);
    }
    byId.set(id, { id, data, prerequisiteIds: [] });
  }
  for (const key of Object.keys(source)) if (!references.has(normalize(key))) throw new Error(`Missing quest identity: ${key}`);
  for (const [id, row] of byId) {
    const prerequisiteIds = row.data.prereqs.map(reference => {
      const prerequisite = references.get(normalize(reference));
      if (!prerequisite) throw new Error(`Dangling quest prerequisite: ${reference}`);
      return prerequisite;
    });
    byId.set(id, { ...row, prerequisiteIds });
  }
  return { byId: byId as ReadonlyMap<QuestId, CatalogQuest>, resolve: (reference: string) => references.get(normalize(reference)) };
}
export const QUEST_INDEX = createQuestIndex(identities as QuestIdentity[], QUEST_DATA);
export const questId = QUEST_INDEX.resolve;
export function catalogQuest(reference: string): CatalogQuest | undefined {
  const id = questId(reference);
  return id ? QUEST_INDEX.byId.get(id) : undefined;
}
export const completedQuestIds = (references: readonly string[]): ReadonlySet<QuestId> => new Set(
  references.map(questId).filter((id): id is QuestId => id !== undefined),
);

/** Compatibility adapter for existing save readers. Preserve unknown values for recovery,
 * but coalesce stable IDs and display aliases to the immutable saved key before evaluation. */
export function canonicalQuestUnlocks<T extends { quests: string[] }>(unlocks: T): T {
  if (unlocks.quests.every(reference => Object.hasOwn(QUEST_DATA, reference))) return unlocks;
  return { ...unlocks, quests: [...new Set(unlocks.quests.map(reference => catalogQuest(reference)?.data.id ?? reference))] };
}
export function questPointsForReferences(references: readonly string[]): number {
  return [...completedQuestIds(references)].reduce((total, id) => {
    const quest = QUEST_INDEX.byId.get(id)!.data;
    return total + (quest.kind === 'quest' ? quest.points : 0);
  }, 0);
}
