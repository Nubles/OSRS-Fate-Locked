import { QUEST_EQUIPMENT_REQUIREMENTS } from './questEquipmentRequirements';
import { QUEST_DATA, type QuestData } from './questData';
import { sourcedQuestItemPredicates } from './questOperationalSources';
import { reviewedQuestActionRequirements } from './questActionRequirements';
import type { RequirementPredicate } from '../utils/requirementPredicates';

/** Quest-level completion readiness, not RuneProof's permission to perform the next action.
 * Item acquisition is not inferred from a skill level. Legally pre-owned supplies are valid.
 * Sources: pinned quest-operational-items revisions and the quest requirement audit snapshot.
 */
export function questOperationalRequirements(quest: QuestData): RequirementPredicate[] {
  if (quest.operationalRequirements !== undefined) return quest.operationalRequirements;
  // A supplied custom contract must explicitly declare its operations. Missing imported
  // content cannot silently inherit the assumption that no supplies are needed.
  if (!Object.hasOwn(QUEST_DATA, quest.id)) return [{ kind: 'unknown', key: `quest-operations:${quest.id}`, label: `${quest.name}: operational requirements have not been classified` }];
  const items = sourcedQuestItemPredicates(quest.id);
  const actions = reviewedQuestActionRequirements(quest.id) ?? [{
    kind: 'manual', key: `quest-operations:${quest.id}`,
    label: `${quest.name}'s quest actions and equipment use are legal under your method and equipment unlocks, including obtaining and using quest-provided tools.`,
  } satisfies RequirementPredicate];
  return [...items, ...(SPECIFIC[quest.id] ?? []), ...(Object.hasOwn(QUEST_EQUIPMENT_REQUIREMENTS, quest.id) ? QUEST_EQUIPMENT_REQUIREMENTS[quest.id] : []), ...actions];
}

/** Reviewed 2026-09-05 against linked OSRS Wiki pages; no recommended combat level is a gate. */
const SPECIFIC: Record<string, RequirementPredicate[]> = {
  // Wearing the quest-provided amulet requires an unlocked neck slot.
  // Reviewed walkthrough: the-restless-ghost:talk-to-ghost. Carrying it is insufficient.
  'The Restless Ghost': [
    { kind: 'equipment', slot: 'Neck', tier: 1, label: 'Necklace slot T1: wear the ghostspeak amulet' },
  ],
  'Priest in Peril': [
    { kind: 'manual', key: 'priest-essence', label: '50 unnoted rune/pure essence in total, legally available; a mixture and multiple trips are allowed' },
    { kind: 'manual', key: 'priest-bucket', label: 'A legal bucket source for blessing water, including obtaining it during the quest' },
    { kind: 'manual', key: 'priest-combat', label: 'A legal way to defeat the temple guardian (immune to Magic) and a Monk of Zamorak' },
  ],
  'Demon Slayer': [
    { kind: 'manual', key: 'demon-supplies', label: '25 bones and a water container available through legal sources for the keys' },
    { kind: 'equipment', slot: 'Weapon', tier: 1 },
    { kind: 'manual', key: 'demon-silverlight', label: 'Permission to wield the quest-provided Silverlight and defeat Delrith' },
  ],
  'Misthalin Mystery': [
    { kind: 'manual', key: 'misthalin-tools', label: 'Permission to use the quest-provided bucket, tinderbox and knife, and perform the final knife action' },
  ],
};
