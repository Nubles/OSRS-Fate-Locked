import type { RuneProofCatalogueEntry } from '../../data/runeProofQuestCatalogue';
import type { QuestItemRequirement } from '../questRoutes/model';
import { isIndependentReviewWalkthroughSource } from '../questWalkthroughs/model';
import type { QuestStrategyAction, QuestStrategyDefinition } from './model';
import {
  defineRuneProofQuestPack,
  requirementAll,
  type RequirementExpression,
  type ReviewedEvidenceReference,
  type ReviewedLocationReference,
  type ReviewedMethodReference,
  type ReviewedSourceReference,
  type RuneProofAction,
  type RuneProofInitialItemRequirement,
  type RuneProofItemEffect,
  type RuneProofQuestPack,
} from './packModel';

export interface LegacyStrategyPackContext {
  readonly catalogue: RuneProofCatalogueEntry;
  readonly catalogueRevision: string;
  readonly preflight: RequirementExpression;
  readonly reviewedRoots: readonly QuestItemRequirement[];
  readonly requirementAuditEntry?: LegacyRequirementAuditEntry;
}

export interface LegacyRequirementAuditEntry {
  readonly id: string;
  readonly reviewedAt: string;
  readonly source: {
    readonly url: string;
    readonly revision: number;
    readonly revisionTimestamp: string;
  };
}

const isoTimestamp = (value: string): string => (
  /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value
);

const validTimestamp = (value: unknown): value is string => {
  if (typeof value !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    || Number.isNaN(Date.parse(value))) return false;
  const canonicalInput = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return new Date(value).toISOString() === canonicalInput;
};

const latestTimestamp = (...values: readonly string[]): string => values
  .map(isoTimestamp)
  .reduce((latest, value) => Date.parse(value) > Date.parse(latest) ? value : latest);

const encoded = (value: string): string => encodeURIComponent(value);

const walkthroughWikiSourceId = (questId: string): string => `walkthrough-wiki:${questId}`;
const walkthroughReviewSourceId = (questId: string): string => `walkthrough-review:${questId}`;
const questDataSourceId = (questId: string): string => `quest-data:${questId}`;
const reviewedRootsSourceId = (questId: string): string => `reviewed-roots:${questId}`;
const auditSourceId = (questId: string): string => `requirement-audit:${questId}`;
const actionEvidenceId = (actionId: string): string => `action:${actionId}`;
const sourceLineEvidenceId = (lineId: string): string => `source-line:${lineId}`;
const initialItemEvidenceId = (itemKey: string): string => `initial-item:${itemKey}`;
const catalogueRequirementEvidenceId = (questId: string): string => (
  `catalogue:${encoded(questId)}:requirement-status`
);

const wikiPath = (title: string): string => title
  .split('/')
  .map(part => encoded(part.replace(/\s+/g, '_')).replace(/'/g, '%27'))
  .join('/');

const exactRequirementAuditUrl = (
  value: unknown,
  catalogue: RuneProofCatalogueEntry,
): boolean => {
  if (typeof value !== 'string') return false;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  const searchKeys = [...parsed.searchParams.keys()].sort();
  return parsed.origin === 'https://oldschool.runescape.wiki'
    && parsed.username === ''
    && parsed.password === ''
    && parsed.pathname === '/w/index.php'
    && parsed.hash === ''
    && searchKeys.length === 2
    && searchKeys[0] === 'oldid'
    && searchKeys[1] === 'title'
    && parsed.searchParams.get('title') === catalogue.wikiTitle.replace(/ /g, '_')
    && parsed.searchParams.get('oldid') === catalogue.sourceRevision;
};

const reviewTimestampFor = (strategy: QuestStrategyDefinition): string => latestTimestamp(
  strategy.source.wikiRevisionTimestamp,
  ...(isIndependentReviewWalkthroughSource(strategy.source)
    ? [strategy.source.authoredAt]
    : strategy.actions.flatMap(action => (
      action.location.kind === 'REVIEWED_ALIAS' ? [action.location.reviewedAt] : []
    ))),
);

const sourceReferencesFor = (
  strategy: QuestStrategyDefinition,
  catalogue: RuneProofCatalogueEntry,
  requirementAuditEntry: LegacyRequirementAuditEntry | undefined,
): readonly ReviewedSourceReference[] => {
  const reviewedAt = reviewTimestampFor(strategy);
  const reviewSource: ReviewedSourceReference = isIndependentReviewWalkthroughSource(strategy.source)
    ? {
      id: walkthroughReviewSourceId(strategy.questId),
      kind: 'INDEPENDENT_REVIEW',
      uri: `urn:runeproof:walkthrough-review:${encoded(strategy.questId)}`,
      revision: strategy.revision,
      revisionTimestamp: isoTimestamp(strategy.source.authoredAt),
      reviewedAt: isoTimestamp(strategy.source.authoredAt),
      author: strategy.source.author,
      methodology: strategy.source.methodology,
    }
    : {
      id: walkthroughReviewSourceId(strategy.questId),
      kind: 'CHUNK_PICKER',
      uri: `https://github.com/${strategy.source.chunkPickerRepository}/tree/${strategy.source.chunkPickerCommit}`,
      revision: strategy.source.chunkPickerCommit,
      revisionTimestamp: strategy.source.wikiRevisionTimestamp,
      reviewedAt,
    };
  const sources: ReviewedSourceReference[] = [
    {
      id: walkthroughWikiSourceId(strategy.questId),
      kind: 'WIKI_REVISION',
      uri: strategy.source.wikiUrl,
      revision: strategy.source.wikiRevision,
      revisionTimestamp: strategy.source.wikiRevisionTimestamp,
      reviewedAt,
    },
    reviewSource,
    {
      id: questDataSourceId(strategy.questId),
      kind: 'QUEST_DATA',
      uri: `https://oldschool.runescape.wiki/w/${wikiPath(catalogue.wikiTitle)}?oldid=${catalogue.sourceRevision}`,
      revision: catalogue.sourceRevision,
      revisionTimestamp: catalogue.sourceRevisionTimestamp,
      reviewedAt: latestTimestamp(catalogue.sourceRevisionTimestamp, reviewedAt),
    },
    {
      id: reviewedRootsSourceId(strategy.questId),
      kind: 'INDEPENDENT_REVIEW',
      uri: `urn:runeproof:reviewed-roots:${encoded(strategy.questId)}`,
      revision: strategy.revision,
      revisionTimestamp: reviewedAt,
      reviewedAt,
      author: 'Fate Locked',
      methodology: 'Reviewed canonical item roots and accepted item alternatives.',
    },
  ];

  if (catalogue.requirementStatus === 'UNRESOLVED') {
    const audit = requirementAuditEntry;
    if (!audit
      || audit.id !== strategy.questId
      || !validTimestamp(audit.reviewedAt)
      || !Number.isSafeInteger(audit.source.revision)
      || audit.source.revision <= 0
      || String(audit.source.revision) !== catalogue.sourceRevision
      || audit.source.revisionTimestamp !== catalogue.sourceRevisionTimestamp
      || Date.parse(audit.reviewedAt) < Date.parse(audit.source.revisionTimestamp)
      || !exactRequirementAuditUrl(audit.source.url, catalogue)) {
      throw new Error(`Missing exact requirement audit source for ${strategy.questId}.`);
    }
    sources.push({
      id: auditSourceId(strategy.questId),
      kind: 'WIKI_REVISION',
      uri: audit.source.url,
      revision: String(audit.source.revision),
      revisionTimestamp: audit.source.revisionTimestamp,
      reviewedAt: audit.reviewedAt,
    });
  }

  return sources;
};

const evidenceIdsForAction = (action: QuestStrategyAction): readonly string[] => [
  actionEvidenceId(action.id),
  ...action.rawWikiLineIds.map(sourceLineEvidenceId),
];

const adaptedLocation = (
  action: QuestStrategyDefinition['actions'][number],
  evidenceIds: readonly string[],
): ReviewedLocationReference => ({
  kind: 'SURFACE',
  label: action.location.kind === 'REVIEWED_ALIAS'
    ? action.location.alias
    : action.displayText,
  chunks: [...action.mapChunks],
  plane: 0,
  evidenceIds,
});

const itemPair = (
  entry: QuestStrategyAction['coach']['consumes'][number],
): Readonly<{ itemKey: string; quantity: number }> => ({
  itemKey: entry.item.key,
  quantity: entry.quantity,
});

const itemEffectsFor = (action: QuestStrategyAction): readonly RuneProofItemEffect[] => {
  const effects: RuneProofItemEffect[] = [];
  const transformation = action.coach.preferredMethod?.kind === 'TRANSFORMATION'
    && action.coach.fulfils.length > 0;
  const transformedOutput = transformation ? action.coach.fulfils[0] : undefined;

  if (transformedOutput) {
    effects.push({
      kind: 'PRODUCE',
      itemKey: transformedOutput.item.key,
      quantity: transformedOutput.quantity,
      from: action.coach.consumes.map(itemPair),
    });
  } else {
    action.coach.consumes.forEach(entry => effects.push({
      kind: 'CONSUME',
      itemKey: entry.item.key,
      quantity: entry.quantity,
    }));
  }

  action.coach.fulfils.slice(transformedOutput ? 1 : 0).forEach(entry => effects.push({
    kind: entry.supplyPolicy === 'QUEST_PROVIDED' ? 'QUEST_PROVIDED' : 'ACQUIRE',
    itemKey: entry.item.key,
    quantity: entry.quantity,
  }));

  const consumedKeys = new Set(action.coach.consumes.map(entry => entry.item.key));
  action.items
    .filter(entry => !consumedKeys.has(entry.item.key))
    .forEach(entry => effects.push({
      kind: transformation ? 'REUSE' : 'RETAIN',
      itemKey: entry.item.key,
      quantity: entry.quantity,
    }));

  return effects;
};

const preferredMethodFor = (
  action: QuestStrategyAction,
  evidenceIds: readonly string[],
): ReviewedMethodReference | undefined => {
  const method = action.coach.preferredMethod;
  if (!method) return undefined;
  return {
    id: `legacy-method:${action.id}`,
    label: method.kind === 'DIRECT_SOURCE' ? method.sourceLabel : method.recipeId,
    kind: method.kind,
    evidenceIds,
  };
};

const completionFor = (action: QuestStrategyAction): RuneProofAction['completion'] => {
  switch (action.coach.completion.kind) {
    case 'QUEST_COMPLETED':
      return {
        kind: 'CANONICAL_QUEST_COMPLETED',
        questId: action.coach.completion.questId,
      };
    case 'ITEM_CONFIRMED':
      return {
        kind: 'ITEM_CONFIRMED',
        itemKey: action.coach.completion.itemKey,
      };
    case 'MANUAL':
      return { kind: 'ACTION_CONFIRMED' };
  }
};

const adaptAction = (
  action: QuestStrategyDefinition['actions'][number],
): RuneProofAction => {
  const evidenceIds = evidenceIdsForAction(action);
  const location = adaptedLocation(action, evidenceIds);
  return {
    id: action.id,
    sourceOrder: action.sourceOrder,
    instruction: action.displayText,
    kind: action.kind,
    dependsOn: [...action.dependsOn],
    requirements: requirementAll(),
    itemEffects: itemEffectsFor(action),
    location,
    completion: completionFor(action),
    ...(action.coach.preferredMethod
      ? { preferredMethod: preferredMethodFor(action, evidenceIds) }
      : {}),
    alternatives: action.coach.fallbackPolicy === 'INTERCHANGEABLE'
      ? [{
        id: `legacy-alternative:${action.id}`,
        label: 'Accepted legacy interchangeable route',
        kind: 'QUEST_ROUTE',
        evidenceIds,
        requirements: requirementAll(),
        location,
      }]
      : [],
    evidenceIds,
  };
};

const externalItemKeys = (actions: readonly RuneProofAction[]): ReadonlySet<string> => {
  const supplied = new Set<string>();
  const external = new Set<string>();
  const requireItem = (itemKey: string): void => {
    if (!supplied.has(itemKey)) external.add(itemKey);
  };

  [...actions]
    .sort((left, right) => left.sourceOrder - right.sourceOrder || left.id.localeCompare(right.id))
    .forEach(action => action.itemEffects.forEach((effect) => {
      if (effect.kind === 'PRODUCE') {
        effect.from.forEach(input => requireItem(input.itemKey));
        supplied.add(effect.itemKey);
      } else if (effect.kind === 'ACQUIRE' || effect.kind === 'QUEST_PROVIDED') {
        supplied.add(effect.itemKey);
      } else if (effect.kind === 'CONSUME' || effect.kind === 'RETAIN'
        || effect.kind === 'REUSE' || effect.kind === 'RETURN' || effect.kind === 'LEND') {
        requireItem(effect.itemKey);
        if (effect.kind === 'LEND' && effect.replacementItemKey) {
          supplied.add(effect.replacementItemKey);
        }
      }
    }));
  return external;
};

const atomicRequirements = (
  expression: RequirementExpression,
): readonly Exclude<RequirementExpression, { kind: 'ALL' | 'ANY' }>[] => (
  expression.kind === 'ALL' || expression.kind === 'ANY'
    ? expression.requirements.flatMap(atomicRequirements)
    : [expression]
);

const addEvidence = (
  evidence: Map<string, ReviewedEvidenceReference>,
  next: ReviewedEvidenceReference,
): void => {
  const existing = evidence.get(next.id);
  if (!existing) {
    evidence.set(next.id, next);
    return;
  }
  if (existing.sourceId !== next.sourceId
    || existing.sourceLocator !== next.sourceLocator
    || existing.decision !== next.decision) {
    throw new Error(`Conflicting evidence ID "${next.id}".`);
  }
};

const evidenceReferencesFor = ({
  strategy,
  catalogue,
  preflight,
  initialItems,
  sources,
}: {
  readonly strategy: QuestStrategyDefinition;
  readonly catalogue: RuneProofCatalogueEntry;
  readonly preflight: RequirementExpression;
  readonly initialItems: readonly RuneProofInitialItemRequirement[];
  readonly sources: readonly ReviewedSourceReference[];
}): readonly ReviewedEvidenceReference[] => {
  const evidence = new Map<string, ReviewedEvidenceReference>();
  const sourceIds = new Set(sources.map(source => source.id));

  strategy.actions.forEach((action) => {
    addEvidence(evidence, {
      id: actionEvidenceId(action.id),
      sourceId: walkthroughReviewSourceId(strategy.questId),
      sourceLocator: `action:${action.id}`,
      decision: `Retain reviewed action ${action.sourceOrder}: ${action.displayText}`,
    });
  });
  strategy.sourceLines.forEach((line) => {
    addEvidence(evidence, {
      id: sourceLineEvidenceId(line.id),
      sourceId: walkthroughWikiSourceId(strategy.questId),
      sourceLocator: `source-line:${line.id}`,
      decision: `Retain source line ${line.sourceOrder}: ${line.rawText}`,
    });
  });

  const knownQuestDataEvidenceId = questDataSourceId(strategy.questId);
  const knownCatalogueEvidenceId = catalogueRequirementEvidenceId(strategy.questId);
  atomicRequirements(preflight).forEach((requirement) => {
    requirement.evidenceIds.forEach((id) => {
      if (id === knownQuestDataEvidenceId) {
        addEvidence(evidence, {
          id,
          sourceId: knownQuestDataEvidenceId,
          sourceLocator: `quest-data:${strategy.questId}`,
          decision: `Use the exact reviewed quest requirements for ${strategy.questId}.`,
        });
      } else if (id === knownCatalogueEvidenceId
        && sourceIds.has(auditSourceId(strategy.questId))) {
        addEvidence(evidence, {
          id,
          sourceId: auditSourceId(strategy.questId),
          sourceLocator: 'requirement-status',
          decision: `Preserve the unresolved catalogue requirement status for ${strategy.questId}.`,
        });
      } else {
        throw new Error(`Unknown preflight evidence ID "${id}" for ${strategy.questId}.`);
      }
    });
  });

  initialItems.forEach((root) => {
    const alternatives = root.alternatives?.map(alternative => alternative.name).join(', ') || 'none';
    addEvidence(evidence, {
      id: initialItemEvidenceId(root.item.key),
      sourceId: reviewedRootsSourceId(strategy.questId),
      sourceLocator: `root:${root.item.key}`,
      decision: `Require ${root.quantity} × ${root.item.name} before the reviewed route; accepted alternatives: ${alternatives}.`,
    });
  });

  return [...evidence.values()];
};

export const legacyStrategyToRuneProofPack = (
  strategy: QuestStrategyDefinition,
  context: LegacyStrategyPackContext,
): RuneProofQuestPack => {
  const actions = strategy.actions.map(adaptAction);
  const externallyRequired = externalItemKeys(actions);
  const initialItems: readonly RuneProofInitialItemRequirement[] = context.reviewedRoots
    .filter(root => root.supplyPolicy === 'PLAYER_OBTAINED'
      && externallyRequired.has(root.item.key))
    .map(root => ({
      ...structuredClone(root),
      evidenceIds: [initialItemEvidenceId(root.item.key)],
    }));
  const sources = sourceReferencesFor(
    strategy,
    context.catalogue,
    context.requirementAuditEntry,
  );
  const evidence = evidenceReferencesFor({
    strategy,
    catalogue: context.catalogue,
    preflight: context.preflight,
    initialItems,
    sources,
  });
  const completionAction = actions.find(action => (
    action.completion.kind === 'CANONICAL_QUEST_COMPLETED'
  ));

  if (!completionAction) {
    throw new Error(`Legacy strategy ${strategy.questId} has no completion action.`);
  }

  return defineRuneProofQuestPack({
    schemaVersion: 1,
    questId: strategy.questId,
    revision: strategy.revision,
    catalogueRevision: context.catalogueRevision,
    sources,
    evidence,
    initialItems,
    preflight: context.preflight,
    branches: [{
      id: 'main',
      label: 'Reviewed route',
      requirements: requirementAll(),
      rank: {
        localRoutePenalty: 0,
        newUnlockCount: 0,
        riskCost: 0,
        tieBreak: 0,
      },
      actions,
      checkpointIds: [],
      evidenceIds: [...new Set(actions.flatMap(action => action.evidenceIds))],
    }],
    sharedActions: [],
    completion: {
      canonicalQuestId: strategy.questId,
      branchActionIds: { main: completionAction.id },
      evidenceIds: completionAction.evidenceIds,
    },
    migrations: [],
  });
};
