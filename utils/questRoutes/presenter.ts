import type {
  DeepReadonly,
  QuestItemRouteAnalysis,
  QuestRouteAnalysis,
  QuestRouteStatus,
} from './analyzeQuest';
import type {
  ChunkKey,
  ItemRoute,
  ItemRouteState,
  SupplyPolicy,
  RouteGate,
  SourceKind,
} from './model';

export type PresentedBlockerCategory =
  | 'Skill'
  | 'Quest'
  | 'Unlock'
  | 'Access / station';

export interface PresentedBlocker {
  readonly category: PresentedBlockerCategory;
  readonly label: string;
}

export interface PresentedRouteStep {
  readonly label: string;
  readonly sourceKind?: string;
  readonly chunk?: ChunkKey;
  readonly blockers: readonly PresentedBlocker[];
  readonly quantity?: number;
  readonly consumed?: boolean;
  readonly requiresChunkUnlock: boolean;
  readonly hasDataGap: boolean;
}

export interface PresentedRoute {
  readonly id: string;
  readonly label: string;
  readonly sourceKind: string;
  readonly outputQuantity: number;
  readonly isBest: boolean;
  readonly requiresChunkUnlock: boolean;
  readonly steps: readonly PresentedRouteStep[];
  readonly blockers: readonly PresentedBlocker[];
  readonly deterministic: boolean;
  readonly probabilityText?: string;
  readonly travelNote?: string;
  readonly dataNote?: string;
}

export interface PresentedMissingChunkOption {
  readonly chunks: readonly ChunkKey[];
  readonly advice: string;
  readonly remainingBlockers: readonly PresentedBlocker[];
}

export interface PresentedQuestItem {
  readonly id: string;
  readonly anchorId: string;
  readonly analysisState: ItemRouteState;
  readonly supplyPolicy: SupplyPolicy;
  readonly quantity: number;
  readonly itemName: string;
  readonly title: string;
  readonly statusText: string;
  readonly supplyNote?: string;
  readonly requirementNote?: string;
  readonly routes: readonly PresentedRoute[];
  readonly missingChunkOptions: readonly PresentedMissingChunkOption[];
  readonly dataNotes: readonly string[];
}

export interface PresentedQuestAnalysis {
  readonly questId: string;
  readonly heading: string;
  readonly items: readonly PresentedQuestItem[];
}

const QUEST_STATUS_TEXT: Record<QuestRouteStatus, string> = {
  READY_NOW: 'Ready now',
  CANNOT_COMPLETE_YET: 'Cannot complete yet',
  ANALYSIS_INCOMPLETE: 'Analysis incomplete',
};

const ITEM_STATUS_TEXT: Record<ItemRouteState, string> = {
  OBTAINABLE_NOW: 'Obtainable now',
  ROUTE_BLOCKED: 'Route exists — requirement missing',
  NO_CURRENT_SOURCE: 'No source in current chunks',
  DATA_INCOMPLETE: 'Route data incomplete',
};

const SOURCE_KIND_TEXT: Record<SourceKind, string> = {
  SPAWN: 'Spawn',
  SHOP: 'Shop',
  DROP: 'Drop',
  GATHER: 'Gathering',
  RECIPE: 'Recipe',
};

const presentGate = (gate: RouteGate): PresentedBlocker => {
  switch (gate.type) {
    case 'SKILL': return { category: 'Skill', label: gate.label };
    case 'QUEST': return { category: 'Quest', label: gate.label };
    case 'UNLOCK': return { category: 'Unlock', label: gate.label };
    case 'UNRESOLVED': return { category: 'Access / station', label: gate.label };
  }
};

type PresentedInputRoute = DeepReadonly<ItemRoute>;

const presentStepLabel = (
  step: DeepReadonly<ItemRoute['steps'][number]>,
): string => (
  step.sourceKind === 'SPAWN'
    ? `Pick up ${step.label} (ground spawn)`
    : step.label
);
const probabilityText = (route: PresentedInputRoute): string | undefined => {
  if (route.deterministic || route.probability === undefined) return undefined;
  const percentage = route.probability * 100;
  return `${Number.isInteger(percentage) ? percentage : percentage.toFixed(1)}% chance`;
};

const travelNote = (route: PresentedInputRoute): string | undefined => {
  if (route.travelCost <= 0 && !route.travelCostEstimated) return undefined;
  const unit = route.travelCost === 1 ? 'chunk' : 'chunks';
  const estimate = route.travelCostEstimated ? ' (geometric estimate)' : '';
  return `Travel: ${route.travelCost} ${unit}${estimate}`;
};

const routeLabel = (route: PresentedInputRoute): string => {
  if (route.sourceKind !== 'RECIPE' && route.sourceKind !== 'GATHER') {
    return route.sourceLabel;
  }

  return route.steps.find(step => step.sourceKind === route.sourceKind)?.label
    ?? (route.sourceKind === 'GATHER' ? 'Gathering route' : 'Recipe route');
};

const presentRoute = (
  route: PresentedInputRoute,
  index: number,
  missingRouteIds: ReadonlySet<string>,
): PresentedRoute => ({
  id: route.id,
  label: routeLabel(route),
  sourceKind: SOURCE_KIND_TEXT[route.sourceKind],
  outputQuantity: route.outputQuantity,
  isBest: index === 0,
  requiresChunkUnlock: missingRouteIds.has(route.id),
  steps: route.steps.map(step => ({
    label: presentStepLabel(step),
    sourceKind: step.sourceKind ? SOURCE_KIND_TEXT[step.sourceKind] : undefined,
    chunk: step.chunk,
    blockers: step.blockers?.map(presentGate) ?? [],
    quantity: step.quantity,
    consumed: step.consumed,
    requiresChunkUnlock: step.requiresChunkUnlock,
    hasDataGap: step.hasDataGap,
  })),
  blockers: route.blockers.map(presentGate),
  deterministic: route.deterministic,
  probabilityText: probabilityText(route),
  travelNote: travelNote(route),
  dataNote: route.hasDataGap ? 'Route data incomplete for this route.' : undefined,
});

const chunkAdvice = (chunks: readonly ChunkKey[]): string => {
  const noun = chunks.length === 1 ? 'chunk' : 'chunks';
  return `Unlock ${noun} ${chunks.join(', ')} to gain a known route.`;
};

const itemAnchorId = (item: QuestItemRouteAnalysis, index: number): string =>
  `runeproof-item-${index + 1}-${item.requirement.item.key
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')}`;

const presentItem = (
  item: QuestItemRouteAnalysis,
  index: number,
): PresentedQuestItem => {
  const missingRouteIds = new Set(item.missingChunkRoutes.map(route => route.id));
  const routes = [...item.currentRoutes, ...item.missingChunkRoutes];

  return {
    id: `${item.requirement.item.key}-${index}`,
    anchorId: itemAnchorId(item, index),
    analysisState: item.state,
    supplyPolicy: item.requirement.supplyPolicy,
    quantity: item.requirement.quantity,
    itemName: item.requirement.item.name,
    title: `${item.requirement.quantity} × ${item.requirement.item.name}`,
    statusText: ITEM_STATUS_TEXT[item.state],
    supplyNote: item.requirement.supplyPolicy === 'QUEST_PROVIDED'
      ? 'Provided during the quest'
      : undefined,
    requirementNote: item.requirement.note,
    routes: routes.map((route, routeIndex) => presentRoute(route, routeIndex, missingRouteIds)),
    missingChunkOptions: item.state !== 'OBTAINABLE_NOW'
      ? item.missingChunkOptions.map(option => ({
        chunks: [...option.chunks],
        advice: chunkAdvice(option.chunks),
        remainingBlockers: option.remainingGates.map(presentGate),
      }))
      : [],
    dataNotes: [...item.dataNotes],
  };
};

/** Converts route analysis into compact player-facing text without mutating it. */
export const presentQuestAnalysis = (
  analysis: QuestRouteAnalysis,
): PresentedQuestAnalysis => ({
  questId: analysis.questId,
  heading: QUEST_STATUS_TEXT[analysis.status],
  items: analysis.items.map(presentItem),
});
