import type { QuestItemRouteAnalysis, QuestRouteStatus } from './analyzeQuest';

export const questRouteStatusForItems = (
  items: readonly QuestItemRouteAnalysis[],
): QuestRouteStatus => {
  const playerObtained = items.filter(
    item => item.requirement.supplyPolicy === 'PLAYER_OBTAINED',
  );
  if (playerObtained.every(item => item.state === 'OBTAINABLE_NOW')) {
    return 'READY_NOW';
  }
  if (playerObtained.some(
    item => item.state === 'ROUTE_BLOCKED' || item.state === 'NO_CURRENT_SOURCE',
  )) {
    return 'CANNOT_COMPLETE_YET';
  }
  return 'ANALYSIS_INCOMPLETE';
};
