import type { QuestEquipmentBlocker, QuestPreparationRouteAnalysis } from './analyzeQuest';
import { questRouteStatusForItems } from './questRouteStatus';

export const remainingQuestRouteAnalysis = <
  Analysis extends QuestPreparationRouteAnalysis & {
    readonly equipmentBlockers?: readonly QuestEquipmentBlocker[];
  },
>(
  analysis: Analysis,
  confirmedItemKeys: ReadonlySet<string>,
): Analysis => {
  const items = analysis.items.filter(item => (
    item.requirement.supplyPolicy === 'PLAYER_OBTAINED'
    && !confirmedItemKeys.has(item.requirement.item.key)
  ));
  return {
    ...analysis,
    items,
    status: analysis.equipmentBlockers?.length
      ? 'CANNOT_COMPLETE_YET'
      : questRouteStatusForItems(items),
  } as Analysis;
};
