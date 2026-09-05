import type { QuestPreparationRouteAnalysis } from './analyzeQuest';

/** External/test integrations may return nullable or stale analysis payloads. */
export function isQuestAnalysisUsable(analysis: QuestPreparationRouteAnalysis | null | undefined): analysis is QuestPreparationRouteAnalysis {
  return Boolean(analysis && Array.isArray(analysis.items) && analysis.items.every(item =>
    item && item.requirement?.item && typeof item.requirement.item.key === 'string'
    && Array.isArray(item.currentRoutes) && Array.isArray(item.missingChunkRoutes)
    && Array.isArray(item.missingChunkOptions) && Array.isArray(item.dataNotes)
  ));
}
