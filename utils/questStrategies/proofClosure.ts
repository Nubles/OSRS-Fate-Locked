import type { QuestStrategyDefinition } from './model';

type StrategyAction = QuestStrategyDefinition['actions'][number];

/**
 * Closes the steps that proven steps imply. A step the player ticked, or any
 * step once the quest is complete, implies every step it depends on. A step
 * proven only because the player confirmed owning its item implies just the
 * steps that prepare that item: upstream steps whose outputs feed its inputs,
 * and theirs in turn. Owning an egg says nothing about the milk.
 */
export function closeProvenActions(
  ordered: readonly StrategyAction[],
  proven: ReadonlySet<string>,
  provenOnlyByItem: (action: StrategyAction) => boolean,
): Set<string> {
  const actionById = new Map(ordered.map(action => [action.id, action]));
  const completed = new Set(proven);

  const upstreamOf = (action: StrategyAction): StrategyAction[] => {
    const seen = new Set<string>();
    const found: StrategyAction[] = [];
    const visit = (actionId: string): void => {
      if (seen.has(actionId)) return;
      seen.add(actionId);
      const dependency = actionById.get(actionId);
      if (!dependency) return;
      found.push(dependency);
      dependency.dependsOn.forEach(visit);
    };
    action.dependsOn.forEach(visit);
    return found;
  };

  const closedEverything = new Set<string>();
  const closeEverything = (actionId: string): void => {
    if (closedEverything.has(actionId)) return;
    closedEverything.add(actionId);
    actionById.get(actionId)?.dependsOn.forEach((dependencyId) => {
      completed.add(dependencyId);
      closeEverything(dependencyId);
    });
  };

  const closePreparation = (actionId: string): void => {
    const action = actionById.get(actionId);
    if (!action) return;
    const inputs = new Set(action.coach.consumes.map(entry => entry.item.key));
    if (inputs.size === 0) return;
    for (const producer of upstreamOf(action)) {
      if (completed.has(producer.id)) continue;
      if (!producer.coach.fulfils.some(entry => inputs.has(entry.item.key))) continue;
      completed.add(producer.id);
      closePreparation(producer.id);
    }
  };

  for (const actionId of proven) {
    const action = actionById.get(actionId);
    if (!action) continue;
    if (provenOnlyByItem(action)) closePreparation(actionId);
    else closeEverything(actionId);
  }
  return completed;
}
