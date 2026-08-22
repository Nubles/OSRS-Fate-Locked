import type { ChunkKey } from '../questRoutes/model';
import {
  isIndependentReviewWalkthroughSource,
  type EvaluatedWalkthroughAction,
  type QuestWalkthroughAnalysis,
  type ResolvedWalkthroughLocation,
  type WalkthroughBlocker,
} from './model';

export interface PresentedWalkthroughAction {
  readonly id: string;
  readonly anchorId: string;
  readonly section: 'PREPARE' | 'QUEST';
  readonly sourceOrder: number;
  readonly instruction: string;
  readonly statusText:
    | 'Ready here'
    | 'Prepare first'
    | 'Requirement missing'
    | 'Chunk locked'
    | 'Location needs review'
    | 'Information';
  readonly blockerNotes: readonly string[];
  readonly itemNotes: readonly string[];
  readonly evidenceText: string;
  readonly sourceWording: readonly {
    readonly id: string;
    readonly text: string;
  }[];
  readonly mapChunks: readonly ChunkKey[];
  readonly canShowOnMap: boolean;
}

interface PresentedWalkthroughAttributionBase {
  readonly wikiLabel: string;
  readonly wikiUrl: string;
  readonly licenceLabel: string;
  readonly licenceUrl: string;
  readonly reuseStatusText: string;
}

export type PresentedWalkthroughAttribution =
  | (PresentedWalkthroughAttributionBase & {
      readonly kind: 'CHUNK_PICKER_REVIEW';
      readonly chunkPickerLabel: string;
      readonly chunkPickerCommit: string;
    })
  | (PresentedWalkthroughAttributionBase & {
      readonly kind: 'INDEPENDENT_REVIEW';
      readonly author: string;
      readonly authoredAt: string;
      readonly methodology: string;
    });

export interface PresentedQuestWalkthrough {
  readonly questId: string;
  readonly prepareActions: readonly PresentedWalkthroughAction[];
  readonly questActions: readonly PresentedWalkthroughAction[];
  readonly actions: readonly PresentedWalkthroughAction[];
  readonly attribution: PresentedWalkthroughAttribution;
}

const walkthroughBlockerIdentity = (blocker: WalkthroughBlocker): string => {
  switch (blocker.kind) {
    case 'CHUNK': return `CHUNK:${blocker.chunk}`;
    case 'ITEM': return `ITEM:${blocker.itemKey}`;
    case 'DEPENDENCY': return `DEPENDENCY:${blocker.actionId}`;
    case 'LOCATION': return `LOCATION:${blocker.label}`;
    case 'GATE': return `GATE:${JSON.stringify(blocker.gate)}`;
  }
};

const rootBlockerIdentitiesFor = (
  blocker: WalkthroughBlocker,
  confirmedItemKeys: ReadonlySet<string>,
  actionsById: ReadonlyMap<string, EvaluatedWalkthroughAction>,
  dependencyPath: ReadonlySet<string> = new Set(),
): readonly string[] => {
  if (blocker.kind === 'LOCATION') return [];
  if (blocker.kind === 'ITEM') {
    return confirmedItemKeys.has(blocker.itemKey)
      ? []
      : [walkthroughBlockerIdentity(blocker)];
  }
  if (blocker.kind !== 'DEPENDENCY') return [walkthroughBlockerIdentity(blocker)];

  const dependency = actionsById.get(blocker.actionId);
  if (!dependency || dependencyPath.has(blocker.actionId)) {
    return [walkthroughBlockerIdentity(blocker)];
  }
  const nextPath = new Set(dependencyPath);
  nextPath.add(blocker.actionId);
  return dependency.blockers.flatMap(candidate => rootBlockerIdentitiesFor(
    candidate,
    confirmedItemKeys,
    actionsById,
    nextPath,
  ));
};

export const knownWalkthroughBlockerIdentities = (
  analysis: QuestWalkthroughAnalysis,
  confirmedItemKeys: ReadonlySet<string>,
): readonly string[] => {
  const actionsById = new Map(
    analysis.actions.map(action => [action.definition.id, action]),
  );
  return [...new Set(analysis.blockers.flatMap(blocker => rootBlockerIdentitiesFor(
    blocker,
    confirmedItemKeys,
    actionsById,
  )))];
};

const deepFreeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(entry => deepFreeze(entry));
    Object.freeze(value);
  }
  return value;
};

const itemText = (quantity: number, name: string): string => `${quantity} ${name}`;

const instructionWithoutCoordinates = (instruction: string): string => instruction
  .replace(/\b\d{1,3},\d{1,3}\b/g, '')
  .replace(/\s{2,}/g, ' ')
  .trim();

const locationEvidenceText = (location: ResolvedWalkthroughLocation): string => {
  const chunks = location.chunks.join(', ');
  const candidates = location.candidateChunks.join(', ');
  let detail: string;

  switch (location.evidenceKind) {
    case 'EXPLICIT_CHUNK':
      detail = `explicit chunk${chunks ? ` (${chunks})` : ''}`;
      break;
    case 'EXACT_ENTITY':
      detail = `exact entity${location.sourceEntity
        ? ` (${location.sourceEntity.kind} ${location.sourceEntity.name})`
        : ''}`;
      break;
    case 'INHERITED_TARGET':
      detail = `inherited target${location.sourceActionId
        ? ` from ${location.sourceActionId}`
        : ''}${location.sourceEntity ? ` (${location.sourceEntity.kind} ${location.sourceEntity.name})` : ''}`;
      break;
    case 'REVIEWED_ALIAS':
      detail = `reviewed alias${location.review
        ? ` (reviewed by ${location.review.reviewer} on ${location.review.reviewedAt})`
        : ''}`;
      break;
    case 'NONE':
      detail = 'unresolved evidence';
      break;
  }

  const candidateDetail = candidates ? ` Candidate chunks: ${candidates}.` : '';
  const reviewDetail = location.review
    ? ` Review evidence: ${location.review.evidence} Rationale: ${location.review.rationale}.`
    : '';
  return `Location evidence: ${detail}. ${location.explanation}${candidateDetail}${reviewDetail}`;
};

const effectiveBlockersFor = (
  action: EvaluatedWalkthroughAction,
  confirmedItemKeys: ReadonlySet<string>,
  actionsById: ReadonlyMap<string, EvaluatedWalkthroughAction>,
): readonly WalkthroughBlocker[] => action.blockers.filter((blocker) => {
  if (blocker.kind === 'ITEM') return !confirmedItemKeys.has(blocker.itemKey);
  if (blocker.kind !== 'DEPENDENCY') return true;
  return rootBlockerIdentitiesFor(
    blocker,
    confirmedItemKeys,
    actionsById,
  ).length > 0;
});

const statusTextFor = (
  action: EvaluatedWalkthroughAction,
  effectiveBlockers: readonly WalkthroughBlocker[],
  confirmedItemKeys: ReadonlySet<string>,
): PresentedWalkthroughAction['statusText'] => {
  if (action.state === 'INFORMATION') return 'Information';
  if (effectiveBlockers.some(blocker => blocker.kind === 'CHUNK')) {
    return 'Chunk locked';
  }
  if (effectiveBlockers.some(blocker => blocker.kind !== 'LOCATION')) {
    return 'Requirement missing';
  }
  if (
    effectiveBlockers.some(blocker => blocker.kind === 'LOCATION')
    || action.state === 'LOCATION_NEEDS_REVIEW'
    || action.location.confidence === 'AMBIGUOUS'
    || action.location.confidence === 'UNMAPPED'
  ) {
    return 'Location needs review';
  }
  if (action.state === 'ITEM_EVIDENCE_INCOMPLETE') return 'Prepare first';
  if (action.itemPreparation.some(item => (
    item.obtainableNow && !confirmedItemKeys.has(item.itemKey)
  ))) return 'Prepare first';
  return 'Ready here';
};

const itemNotesFor = (
  action: EvaluatedWalkthroughAction,
  confirmedItemKeys: ReadonlySet<string>,
): readonly string[] => {
  const preparationByKey = new Map(
    action.itemPreparation.map(item => [item.itemKey, item]),
  );
  return action.definition.items
    .filter(item => item.supplyPolicy === 'PLAYER_OBTAINED')
    .map((requirement) => {
      const preparation = preparationByKey.get(requirement.item.key);
      const item = itemText(requirement.quantity, requirement.item.name);
      if (preparation?.analysisState === 'DATA_INCOMPLETE' || !preparation) {
        return `Acquisition data is incomplete for ${item}; confirm a source before continuing.`;
      }
      if (confirmedItemKeys.has(requirement.item.key)) return `${item} confirmed.`;
      if (preparation.obtainableNow) return `Obtain ${item} using the Preparation routes.`;
      return `Obtain ${item}; no current acquisition route is available.`;
    });
};

const presentAction = (
  action: EvaluatedWalkthroughAction,
  effectiveBlockers: readonly WalkthroughBlocker[],
  confirmedItemKeys: ReadonlySet<string>,
  sourceLinesById: ReadonlyMap<string, QuestWalkthroughAnalysis['sourceLines'][number]>,
): PresentedWalkthroughAction => {
  const authoritative = (
    (action.location.confidence === 'EXACT' || action.location.confidence === 'REVIEWED')
    && action.location.chunks.length > 0
  );
  const sourceDetails = action.definition.rawWikiLineIds.length > 0
    ? ` Source lines: ${action.definition.rawWikiLineIds.join(', ')}.`
    : ' Source lines: none recorded.';

  return {
    id: action.definition.id,
    anchorId: action.definition.id,
    section: action.definition.section,
    sourceOrder: action.definition.sourceOrder,
    instruction: instructionWithoutCoordinates(action.definition.displayText),
    statusText: statusTextFor(action, effectiveBlockers, confirmedItemKeys),
    blockerNotes: effectiveBlockers.map(blocker => blocker.label),
    itemNotes: itemNotesFor(action, confirmedItemKeys),
    evidenceText: `${locationEvidenceText(action.location)}${sourceDetails}`,
    sourceWording: action.definition.rawWikiLineIds.map(id => ({
      id,
      text: sourceLinesById.get(id)?.rawText ?? `Pinned source wording unavailable for ${id}.`,
    })),
    mapChunks: authoritative ? [...action.location.chunks] : [],
    canShowOnMap: authoritative,
  };
};

export const presentQuestWalkthrough = (
  analysis: QuestWalkthroughAnalysis,
  confirmedItemKeys: ReadonlySet<string>,
): PresentedQuestWalkthrough => {
  const actionsById = new Map(
    analysis.actions.map(action => [action.definition.id, action]),
  );
  const sourceLinesById = new Map(
    analysis.sourceLines.map(line => [line.id, line]),
  );
  const actions = analysis.actions
    .map((action, index) => ({ action, index }))
    .sort((left, right) => (
      left.action.definition.sourceOrder - right.action.definition.sourceOrder
      || left.index - right.index
    ))
    .map(({ action }) => presentAction(
      action,
      effectiveBlockersFor(action, confirmedItemKeys, actionsById),
      confirmedItemKeys,
      sourceLinesById,
    ));
  const prepareActions = actions.filter(action => action.section === 'PREPARE');
  const questActions = actions.filter(action => action.section === 'QUEST');
  const attributionBase = {
    wikiLabel: `Old School RuneScape Wiki — ${analysis.source.wikiTitle} (revision ${analysis.source.wikiRevision})`,
    wikiUrl: analysis.source.wikiUrl,
    licenceLabel: `Wiki licence: ${analysis.source.wikiLicence}`,
    licenceUrl: analysis.source.wikiLicenceUrl,
  };
  const attribution: PresentedWalkthroughAttribution = isIndependentReviewWalkthroughSource(analysis.source)
    ? {
        ...attributionBase,
        kind: 'INDEPENDENT_REVIEW',
        author: analysis.source.author,
        authoredAt: analysis.source.authoredAt,
        methodology: analysis.source.methodology,
        reuseStatusText: `${analysis.releaseStatus}; independently authored guide.`,
      }
    : {
        ...attributionBase,
        kind: 'CHUNK_PICKER_REVIEW',
        chunkPickerLabel: `Chunk Picker — ${analysis.source.chunkPickerRepository}`,
        chunkPickerCommit: analysis.source.chunkPickerCommit,
        reuseStatusText: `${analysis.releaseStatus}; Chunk Picker reuse: ${analysis.source.chunkPickerLicenceStatus}.`,
      };

  return deepFreeze({
    questId: analysis.questId,
    prepareActions,
    questActions,
    actions,
    attribution,
  });
};
