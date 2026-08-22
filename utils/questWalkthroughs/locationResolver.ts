import type { ExactEntityHit } from '../../data/questRouteRecipes';
import { ALL_CHUNK_KEYS } from '../chunkAdjacency';
import type { QuestRouteAnalysisSnapshot } from '../questRoutes/analyzeQuest';
import type { ChunkKey } from '../questRoutes/model';
import type {
  QuestWalkthroughActionDefinition,
  QuestWalkthroughDefinition,
  ResolvedQuestWalkthrough,
  ResolvedWalkthroughAction,
  ResolvedWalkthroughLocation,
  WalkthroughEntityRef,
  WalkthroughLocationEvidenceKind,
} from './model';

type EntityLocationSnapshot = Pick<QuestRouteAnalysisSnapshot, 'entityLocations'>;

const mappedChunks = new Set<string>(ALL_CHUNK_KEYS);
const compareCodeUnit = (left: string, right: string): number => (
  left < right ? -1 : left > right ? 1 : 0
);

const normalizeEntityName = (name: string): string => (
  name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')
);

const sameEntity = (left: WalkthroughEntityRef, right: WalkthroughEntityRef): boolean => (
  left.kind === right.kind && normalizeEntityName(left.name) === normalizeEntityName(right.name)
);

const validChunk = (value: unknown): value is ChunkKey => (
  typeof value === 'string'
  && /^-?\d+,-?\d+$/.test(value)
  && mappedChunks.has(value)
);

const sortedUniqueChunks = (chunks: readonly ChunkKey[]): ChunkKey[] => (
  [...new Set(chunks)].sort(compareCodeUnit)
);

const validatedDirectiveChunks = (
  chunks: readonly ChunkKey[],
): { valid: true; chunks: ChunkKey[] } | { valid: false; chunks: [] } => {
  if (chunks.length === 0 || chunks.some(chunk => !validChunk(chunk))) {
    return { valid: false, chunks: [] };
  }
  return { valid: true, chunks: sortedUniqueChunks(chunks) };
};

const entityCandidateChunks = (
  entity: WalkthroughEntityRef,
  hits: readonly ExactEntityHit[],
): ChunkKey[] => {
  const chunks: ChunkKey[] = [];
  hits.forEach((hit) => {
    if (hit.kind !== entity.kind || normalizeEntityName(hit.name) !== normalizeEntityName(entity.name)) return;
    hit.locations.forEach(({ cx, cy }) => {
      if (!Number.isInteger(cx) || !Number.isInteger(cy)) return;
      const chunk = `${cx},${cy}` as ChunkKey;
      if (validChunk(chunk)) chunks.push(chunk);
    });
  });
  return sortedUniqueChunks(chunks);
};

const unresolved = (
  evidenceKind: WalkthroughLocationEvidenceKind,
  explanation: string,
  options: Pick<ResolvedWalkthroughLocation, 'candidateChunks' | 'sourceEntity' | 'sourceActionId' | 'review'> = {
    candidateChunks: [],
  },
): ResolvedWalkthroughLocation => ({
  confidence: 'UNMAPPED',
  evidenceKind,
  chunks: [],
  candidateChunks: options.candidateChunks,
  explanation,
  ...(options.sourceEntity ? { sourceEntity: { ...options.sourceEntity } } : {}),
  ...(options.sourceActionId ? { sourceActionId: options.sourceActionId } : {}),
  ...(options.review ? { review: { ...options.review } } : {}),
});

const resolveDirectLocation = (
  action: QuestWalkthroughActionDefinition,
  snapshot: EntityLocationSnapshot,
): ResolvedWalkthroughLocation => {
  const directive = action.location;

  if (directive.kind === 'EXPLICIT_CHUNKS') {
    const validated = validatedDirectiveChunks(directive.chunks);
    if (!validated.valid) {
      return unresolved('EXPLICIT_CHUNK', 'The explicit source chunk is invalid or outside the supported map.');
    }
    const sourceEntity = action.entities.length === 1 ? action.entities[0] : undefined;
    const candidateChunks = sourceEntity
      ? entityCandidateChunks(sourceEntity, snapshot.entityLocations as readonly ExactEntityHit[])
      : [];
    if (sourceEntity && candidateChunks.length > 1) {
      const candidateSet = new Set(candidateChunks);
      const intersection = validated.chunks.filter(chunk => candidateSet.has(chunk));
      if (intersection.length !== 1) {
        return {
          confidence: 'AMBIGUOUS',
          evidenceKind: 'EXPLICIT_CHUNK',
          chunks: [],
          candidateChunks: intersection.length > 0 ? intersection : candidateChunks,
          explanation: `Explicit source chunks do not select exactly one canonical ${sourceEntity.name} chunk.`,
          sourceEntity: { ...sourceEntity },
        };
      }
      return {
        confidence: 'EXACT',
        evidenceKind: 'EXPLICIT_CHUNK',
        chunks: intersection,
        candidateChunks: [],
        explanation: `Explicit source evidence narrows ${sourceEntity.name} to one canonical chunk.`,
        sourceEntity: { ...sourceEntity },
      };
    }
    return {
      confidence: 'EXACT',
      evidenceKind: 'EXPLICIT_CHUNK',
      chunks: validated.chunks,
      candidateChunks: [],
      explanation: sourceEntity
        ? `Explicit source chunks authoritatively narrow ${sourceEntity.name}.`
        : 'Explicit source chunks are authoritative.',
      ...(sourceEntity ? { sourceEntity: { ...sourceEntity } } : {}),
    };
  }

  if (directive.kind === 'EXACT_ENTITY') {
    const candidateChunks = entityCandidateChunks(directive.entity, snapshot.entityLocations as readonly ExactEntityHit[]);
    if (candidateChunks.length === 1) {
      return {
        confidence: 'EXACT',
        evidenceKind: 'EXACT_ENTITY',
        chunks: candidateChunks,
        candidateChunks: [],
        explanation: `${directive.entity.name} has one exact canonical chunk.`,
        sourceEntity: { ...directive.entity },
      };
    }
    if (candidateChunks.length > 1) {
      return {
        confidence: 'AMBIGUOUS',
        evidenceKind: 'EXACT_ENTITY',
        chunks: [],
        candidateChunks,
        explanation: `${directive.entity.name} has multiple exact canonical chunks and no source evidence selects one.`,
        sourceEntity: { ...directive.entity },
      };
    }
    return unresolved('EXACT_ENTITY', `No exact ${directive.entity.kind} match was found for ${directive.entity.name}.`, {
      candidateChunks: [],
      sourceEntity: directive.entity,
    });
  }

  if (directive.kind === 'REVIEWED_ALIAS') {
    const review = {
      reviewer: directive.reviewer,
      reviewedAt: directive.reviewedAt,
      evidence: directive.evidence,
      rationale: directive.rationale,
    };
    const validated = validatedDirectiveChunks(directive.chunks);
    if (!validated.valid) {
      return unresolved('REVIEWED_ALIAS', `Reviewed alias ${directive.alias} contains an invalid or out-of-map chunk.`, {
        candidateChunks: [],
        review,
      });
    }
    return {
      confidence: 'REVIEWED',
      evidenceKind: 'REVIEWED_ALIAS',
      chunks: validated.chunks,
      candidateChunks: [],
      explanation: `${directive.alias}: ${directive.evidence} ${directive.rationale}`,
      review,
    };
  }

  if (directive.kind === 'INHERITED_TARGET') {
    return unresolved('INHERITED_TARGET', `Target ${directive.targetEntity.name} requires exact or reviewed evidence from ${directive.sourceActionId}.`, {
      candidateChunks: [],
      sourceEntity: directive.targetEntity,
      sourceActionId: directive.sourceActionId,
    });
  }

  if (action.kind === 'INFORMATION') {
    return {
      confidence: action.confidence,
      evidenceKind: 'NONE',
      chunks: [],
      candidateChunks: [],
      explanation: 'This informational action does not require a spatial location.',
    };
  }
  return unresolved('NONE', 'This spatial action has no authoritative location evidence.');
};

export const resolveWalkthroughLocations = (
  action: QuestWalkthroughActionDefinition,
  snapshot: EntityLocationSnapshot,
): ResolvedWalkthroughLocation => resolveDirectLocation(action, snapshot);

const sourceNamesTarget = (
  sourceDefinition: QuestWalkthroughActionDefinition,
  sourceLocation: ResolvedWalkthroughLocation,
  target: WalkthroughEntityRef,
): boolean => {
  if (sourceLocation.sourceEntity) {
    return sameEntity(sourceLocation.sourceEntity, target);
  }
  return sourceDefinition.entities.some(entity => sameEntity(entity, target));
};

const cloneResolvedAction = (
  action: QuestWalkthroughActionDefinition,
  location: ResolvedWalkthroughLocation,
): ResolvedWalkthroughAction => ({
  ...action,
  definition: structuredClone(action),
  rawWikiLineIds: [...action.rawWikiLineIds],
  dependsOn: [...action.dependsOn],
  entities: action.entities.map(entity => ({ ...entity })),
  items: action.items.map(item => ({ ...item, item: { ...item.item } })),
  gates: action.gates.map(gate => ({ ...gate })),
  location,
});

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

export const resolveQuestWalkthroughLocations = (
  definition: QuestWalkthroughDefinition,
  snapshot: EntityLocationSnapshot,
): ResolvedQuestWalkthrough => {
  const definitionsById = new Map(definition.actions.map(action => [action.id, action]));
  const locationsById = new Map<string, ResolvedWalkthroughLocation>();
  const resolving = new Set<string>();

  const resolveAction = (action: QuestWalkthroughActionDefinition): ResolvedWalkthroughLocation => {
    const existing = locationsById.get(action.id);
    if (existing) return existing;
    if (resolving.has(action.id)) {
      return unresolved('INHERITED_TARGET', `Inherited location cycle detected at ${action.id}.`);
    }
    resolving.add(action.id);

    let resolved: ResolvedWalkthroughLocation;
    if (action.location.kind !== 'INHERITED_TARGET') {
      resolved = resolveDirectLocation(action, snapshot);
    } else {
      const { sourceActionId, targetEntity } = action.location;
      const sourceDefinition = definitionsById.get(sourceActionId);
      const sourceLocation = sourceDefinition ? resolveAction(sourceDefinition) : undefined;
      const authoritative = sourceLocation
        && (sourceLocation.confidence === 'EXACT' || sourceLocation.confidence === 'REVIEWED')
        && sourceLocation.chunks.length > 0;
      if (sourceDefinition && sourceLocation && authoritative && sourceNamesTarget(sourceDefinition, sourceLocation, targetEntity)) {
        resolved = {
          confidence: sourceLocation.confidence,
          evidenceKind: 'INHERITED_TARGET',
          chunks: [...sourceLocation.chunks],
          candidateChunks: [],
          explanation: `Inherited ${targetEntity.name} from exact or reviewed evidence on ${sourceActionId}.`,
          sourceEntity: { ...targetEntity },
          sourceActionId,
          ...(sourceLocation.review ? { review: { ...sourceLocation.review } } : {}),
        };
      } else {
        resolved = unresolved('INHERITED_TARGET', `Action ${sourceActionId} does not provide exact or reviewed evidence for ${targetEntity.name}.`, {
          candidateChunks: [],
          sourceEntity: targetEntity,
          sourceActionId,
        });
      }
    }

    resolving.delete(action.id);
    locationsById.set(action.id, resolved);
    return resolved;
  };

  const resolved: ResolvedQuestWalkthrough = {
    ...definition,
    source: { ...definition.source },
    sourceLines: definition.sourceLines.map(line => ({ ...line })),
    actions: definition.actions.map(action => cloneResolvedAction(action, resolveAction(action))),
  };
  return deepFreeze(resolved);
};
