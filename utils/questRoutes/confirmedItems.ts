import type { QuestPreparationRouteAnalysis } from './analyzeQuest';
import { questRouteStatusForItems } from './questRouteStatus';

export const remainingQuestRouteAnalysis = <
  Analysis extends QuestPreparationRouteAnalysis,
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
    status: questRouteStatusForItems(items),
  } as Analysis;
};
