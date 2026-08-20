import type {
  QuestWalkthroughDefinition,
  WalkthroughEntityRef,
} from './model';

export const collectWalkthroughEntityRequests = (
  definition: Pick<QuestWalkthroughDefinition, 'actions'>,
): readonly WalkthroughEntityRef[] => {
  const entities = new Map<string, WalkthroughEntityRef>();
  definition.actions.forEach(action => action.entities.forEach((entity) => {
    entities.set(`${entity.kind}\u0000${entity.name}`, entity);
  }));
  return [...entities.values()].sort((left, right) => (
    left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  ));
};
