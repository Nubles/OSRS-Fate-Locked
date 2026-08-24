import type { QuestItemRequirement } from '../questRoutes/model';
import {
  runeProofFindingId,
  type RuneProofAction,
  type RuneProofCompileFinding,
  type RuneProofItemEffect,
} from './packModel';

export interface RuneProofItemLedgerInput {
  readonly questId: string;
  readonly branchId: string;
  readonly initialItems: readonly QuestItemRequirement[];
  readonly actions: readonly Pick<
    RuneProofAction,
    'id' | 'sourceOrder' | 'itemEffects'
  >[];
}

export interface RuneProofItemLedgerResult {
  readonly finalQuantities: Readonly<Record<string, number>>;
  readonly findings: readonly RuneProofCompileFinding[];
}

export interface RuneProofConfirmedItemLedgerInput {
  readonly initialItems: readonly QuestItemRequirement[];
  readonly actions: readonly Pick<
    RuneProofAction,
    'id' | 'sourceOrder' | 'dependsOn' | 'itemEffects'
  >[];
  readonly confirmedInitialItemKeys: ReadonlySet<string>;
  readonly completedActionIds: ReadonlySet<string>;
}

interface LedgerIssue {
  readonly itemKey: string;
  readonly message: string;
}

interface ItemAliasTable {
  readonly canonicalByProofKey: ReadonlyMap<string, string>;
  readonly ambiguousOwners: ReadonlyMap<string, readonly string[]>;
}

const positiveInteger = (quantity: number): boolean =>
  Number.isInteger(quantity) && quantity > 0;

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const stableActions = <T extends Pick<RuneProofAction, 'id' | 'sourceOrder'>>(
  actions: readonly T[],
): T[] => [...actions].sort((left, right) =>
  left.sourceOrder - right.sourceOrder || compareText(left.id, right.id));

const add = (
  quantities: Map<string, number>,
  itemKey: string,
  quantity: number,
): void => {
  quantities.set(itemKey, (quantities.get(itemKey) ?? 0) + quantity);
};

const underflowIssue = (
  itemKey: string,
  quantity: number,
  available: number,
): LedgerIssue => ({
  itemKey,
  message: `Item "${itemKey}" requires quantity ${quantity}, but only ${available} is available.`,
});

const invalidQuantityIssue = (
  itemKey: string,
  quantity: number,
): LedgerIssue => ({
  itemKey,
  message: `Item "${itemKey}" quantity must be a positive integer; received ${String(quantity)}.`,
});

const subtract = (
  quantities: Map<string, number>,
  itemKey: string,
  quantity: number,
): LedgerIssue | undefined => {
  const available = quantities.get(itemKey) ?? 0;
  if (available < quantity) return underflowIssue(itemKey, quantity, available);

  const next = available - quantity;
  if (next === 0) quantities.delete(itemKey);
  else quantities.set(itemKey, next);
  return undefined;
};

const requireOpeningQuantity = (
  openingQuantities: ReadonlyMap<string, number>,
  itemKey: string,
  quantity: number,
): LedgerIssue | undefined => {
  const available = openingQuantities.get(itemKey) ?? 0;
  return available < quantity
    ? underflowIssue(itemKey, quantity, available)
    : undefined;
};

const applyItemEffects = (
  openingQuantities: ReadonlyMap<string, number>,
  itemEffects: readonly RuneProofItemEffect[],
): { readonly quantities?: Map<string, number>; readonly issue?: LedgerIssue } => {
  const quantities = new Map(openingQuantities);

  for (const effect of itemEffects) {
    if (!positiveInteger(effect.quantity)) {
      return { issue: invalidQuantityIssue(effect.itemKey, effect.quantity) };
    }

    let issue: LedgerIssue | undefined;
    switch (effect.kind) {
      case 'ACQUIRE':
      case 'QUEST_PROVIDED':
        add(quantities, effect.itemKey, effect.quantity);
        break;
      case 'PRODUCE':
        for (const input of effect.from) {
          if (!positiveInteger(input.quantity)) {
            issue = invalidQuantityIssue(input.itemKey, input.quantity);
            break;
          }
          issue = subtract(quantities, input.itemKey, input.quantity);
          if (issue) break;
        }
        if (!issue) add(quantities, effect.itemKey, effect.quantity);
        break;
      case 'CONSUME':
      case 'RETURN':
        issue = subtract(quantities, effect.itemKey, effect.quantity);
        break;
      case 'LEND':
        issue = subtract(quantities, effect.itemKey, effect.quantity);
        if (!issue && effect.replacementItemKey !== undefined) {
          add(quantities, effect.replacementItemKey, effect.quantity);
        }
        break;
      case 'RETAIN':
      case 'REUSE':
        issue = requireOpeningQuantity(
          openingQuantities,
          effect.itemKey,
          effect.quantity,
        );
        break;
    }

    if (issue) return { issue };
  }

  return { quantities };
};

const buildItemAliasTable = (
  initialItems: readonly QuestItemRequirement[],
): ItemAliasTable => {
  const ownersByProofKey = new Map<string, Set<string>>();
  const addOwner = (proofKey: string, canonicalKey: string): void => {
    const owners = ownersByProofKey.get(proofKey) ?? new Set<string>();
    owners.add(canonicalKey);
    ownersByProofKey.set(proofKey, owners);
  };

  initialItems.forEach(requirement => {
    addOwner(requirement.item.key, requirement.item.key);
    requirement.alternatives?.forEach(alternative => {
      addOwner(alternative.key, requirement.item.key);
    });
  });

  const canonicalByProofKey = new Map<string, string>();
  const ambiguousOwners = new Map<string, readonly string[]>();
  [...ownersByProofKey.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .forEach(([proofKey, owners]) => {
      const sortedOwners = [...owners].sort(compareText);
      if (sortedOwners.length === 1) {
        canonicalByProofKey.set(proofKey, sortedOwners[0]);
      } else {
        ambiguousOwners.set(proofKey, Object.freeze(sortedOwners));
      }
    });

  return { canonicalByProofKey, ambiguousOwners };
};

const frozenQuantities = (
  quantities: ReadonlyMap<string, number>,
): Readonly<Record<string, number>> => Object.freeze(Object.fromEntries(
  [...quantities.entries()].sort(([left], [right]) => compareText(left, right)),
));

const brokenLedgerFinding = (
  input: Pick<RuneProofItemLedgerInput, 'questId' | 'branchId'>,
  actionId: string | undefined,
  issue: LedgerIssue,
): RuneProofCompileFinding => {
  const identity = {
    code: 'BROKEN_ITEM_LEDGER' as const,
    scope: 'BRANCH' as const,
    questId: input.questId,
    branchId: input.branchId,
    actionId,
  };
  return {
    id: runeProofFindingId(identity, issue.itemKey),
    severity: 'BLOCKING',
    ...identity,
    message: issue.message,
    evidenceIds: [],
  };
};

export const evaluateRuneProofItemLedger = (
  input: RuneProofItemLedgerInput,
): RuneProofItemLedgerResult => {
  let quantities = new Map<string, number>();
  const findings: RuneProofCompileFinding[] = [];
  const aliases = buildItemAliasTable(input.initialItems);

  aliases.ambiguousOwners.forEach((owners, proofKey) => {
    findings.push(brokenLedgerFinding(input, undefined, {
      itemKey: proofKey,
      message: `Item key "${proofKey}" ambiguously identifies canonical roots ${owners.map(owner => `"${owner}"`).join(', ')}.`,
    }));
  });

  input.initialItems.forEach(requirement => {
    if (!positiveInteger(requirement.quantity)) {
      findings.push(brokenLedgerFinding(input, undefined, invalidQuantityIssue(
        requirement.item.key,
        requirement.quantity,
      )));
      return;
    }
    if (requirement.supplyPolicy === 'PLAYER_OBTAINED') {
      add(quantities, requirement.item.key, requirement.quantity);
    }
  });

  stableActions(input.actions).forEach(action => {
    const result = applyItemEffects(quantities, action.itemEffects);
    if (result.issue) {
      findings.push(brokenLedgerFinding(input, action.id, result.issue));
      return;
    }
    quantities = result.quantities ?? quantities;
  });

  return {
    finalQuantities: frozenQuantities(quantities),
    findings,
  };
};

export const replayRuneProofConfirmedItemLedger = (
  input: RuneProofConfirmedItemLedgerInput,
): Readonly<Record<string, number>> => {
  let quantities = new Map<string, number>();
  const aliases = buildItemAliasTable(input.initialItems);
  const confirmedCanonicalKeys = new Set<string>();

  input.confirmedInitialItemKeys.forEach(proofKey => {
    const canonicalKey = aliases.canonicalByProofKey.get(proofKey);
    if (canonicalKey !== undefined) confirmedCanonicalKeys.add(canonicalKey);
  });

  input.initialItems.forEach(requirement => {
    if (
      requirement.supplyPolicy === 'PLAYER_OBTAINED'
      && positiveInteger(requirement.quantity)
      && confirmedCanonicalKeys.has(requirement.item.key)
    ) {
      add(quantities, requirement.item.key, requirement.quantity);
    }
  });

  const replayedActionIds = new Set<string>();
  stableActions(input.actions).forEach(action => {
    if (
      !input.completedActionIds.has(action.id)
      || !action.dependsOn.every(dependencyId => replayedActionIds.has(dependencyId))
    ) return;

    const result = applyItemEffects(quantities, action.itemEffects);
    if (!result.quantities) return;
    quantities = result.quantities;
    replayedActionIds.add(action.id);
  });

  return frozenQuantities(quantities);
};
