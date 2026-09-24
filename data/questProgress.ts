/** A quest milestone that is not represented by the completed-quest journal. */
export interface QuestProgressRequirement {
  quest: string;
  label: string;
}

/** Completion proves prior progress; otherwise the milestone needs confirmation. */
export const pendingQuestProgress = (
  requirements: readonly QuestProgressRequirement[] | undefined,
  completedQuests: readonly string[],
): string[] => (requirements ?? [])
  .filter(requirement => !completedQuests.includes(requirement.quest))
  .map(requirement => requirement.label);
