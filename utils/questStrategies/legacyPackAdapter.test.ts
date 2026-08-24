import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../../data/questData';
import { reviewedQuestRequirements } from '../../data/questItemRequirements';
import {
  runeProofCatalogueFor,
  runeProofCatalogueRevision,
} from '../../data/runeProofQuestCatalogue';
import { questStrategyCatalogue } from '../../data/questWalkthroughs.public';
import { legacyStrategyToRuneProofPack } from './legacyPackAdapter';
import { compileRuneProofQuestPack } from './packCompiler';
import type {
  RequirementExpression,
  RuneProofAction,
  RuneProofQuestPack,
} from './packModel';
import { requirementExpressionForQuestData } from './preflight';

const PUBLIC_IDS = [
  "Cook's Assistant",
  'Sheep Shearer',
  'The Restless Ghost',
  'Rune Mysteries',
  'Imp Catcher',
] as const;

const PUBLIC_ACTION_IDS: Readonly<Record<(typeof PUBLIC_IDS)[number], readonly string[]>> = {
  "Cook's Assistant": [
    'cooks-assistant:start-quest',
    'cooks-assistant:take-pot',
    'cooks-assistant:take-bucket',
    'cooks-assistant:milk-cow',
    'cooks-assistant:take-egg',
    'cooks-assistant:pick-grain',
    'cooks-assistant:make-flour',
    'cooks-assistant:return-to-cook',
    'cooks-assistant:complete',
  ],
  'Sheep Shearer': [
    'sheep-shearer:start-with-fred',
    'sheep-shearer:shear-wool',
    'sheep-shearer:spin-wool',
    'sheep-shearer:return-to-fred',
    'sheep-shearer:complete',
  ],
  'The Restless Ghost': [
    'the-restless-ghost:start-with-aereck',
    'the-restless-ghost:get-amulet',
    'the-restless-ghost:talk-to-ghost',
    'the-restless-ghost:take-skull',
    'the-restless-ghost:return-to-ghost',
    'the-restless-ghost:use-skull',
    'the-restless-ghost:complete',
  ],
  'Rune Mysteries': [
    'rune-mysteries:start-with-duke',
    'rune-mysteries:take-talisman-to-sedridor',
    'rune-mysteries:take-package-to-aubury',
    'rune-mysteries:return-notes-to-sedridor',
    'rune-mysteries:complete',
  ],
  'Imp Catcher': [
    'imp-catcher:get-black-bead',
    'imp-catcher:get-red-bead',
    'imp-catcher:get-white-bead',
    'imp-catcher:get-yellow-bead',
    'imp-catcher:give-beads-to-mizgog',
    'imp-catcher:complete',
  ],
};

const atomsIn = (expression: RequirementExpression): readonly RequirementExpression[] => (
  expression.kind === 'ALL' || expression.kind === 'ANY'
    ? expression.requirements.flatMap(atomsIn)
    : [expression]
);

const normalizedManualPrompt = (value: string): string => (
  value.normalize('NFKC').trim().replace(/\s+/gu, ' ')
);

const unresolvedManualCompletionIds = (pack: RuneProofQuestPack): readonly string[] => {
  const evidenceIds = new Set(pack.evidence.map(evidence => evidence.id));
  const hasValidEvidence = (ids: readonly string[]): boolean => ids.length > 0
    && ids.every(id => id.trim().length > 0 && evidenceIds.has(id));
  const declared = new Set<string>();
  const collectRequirementDeclarations = (expression: RequirementExpression): void => {
    atomsIn(expression).forEach((atom) => {
      if (atom.kind === 'MANUAL_CONFIRMATION'
        && atom.confirmationId.trim().length > 0
        && normalizedManualPrompt(atom.prompt).length > 0
        && hasValidEvidence(atom.evidenceIds)) {
        declared.add(atom.confirmationId);
      }
    });
  };
  collectRequirementDeclarations(pack.preflight);
  pack.branches.forEach(branch => collectRequirementDeclarations(branch.requirements));
  const actions = [
    ...pack.sharedActions,
    ...pack.branches.flatMap(branch => branch.actions),
  ];
  actions.forEach((action) => {
    collectRequirementDeclarations(action.requirements);
    action.alternatives.forEach(alternative => {
      collectRequirementDeclarations(alternative.requirements);
    });
    if (action.combat
      && action.combat.confirmationId.trim().length > 0
      && hasValidEvidence(action.combat.evidenceIds)) {
      declared.add(action.combat.confirmationId);
    }
  });
  return actions.flatMap(action => (
    action.completion.kind === 'MANUAL'
      && !declared.has(action.completion.confirmationId)
      && !(
        action.completion.confirmationId === `manual:${action.id}`
        && normalizedManualPrompt(action.instruction).length > 0
        && hasValidEvidence(action.evidenceIds)
      )
        ? [action.completion.confirmationId]
        : []
  ));
};

const publicPackFor = (questId: (typeof PUBLIC_IDS)[number]): {
  readonly pack: RuneProofQuestPack;
  readonly actions: readonly RuneProofAction[];
} => {
  const strategy = questStrategyCatalogue.find(value => value.questId === questId)!;
  const catalogue = runeProofCatalogueFor(strategy.questId)!;
  const pack = legacyStrategyToRuneProofPack(strategy, {
    catalogue,
    catalogueRevision: runeProofCatalogueRevision,
    preflight: requirementExpressionForQuestData(QUEST_DATA[strategy.questId], catalogue),
    reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
  });
  return { pack, actions: pack.branches[0].actions };
};

describe('legacy RuneProof pack adapter', () => {
  it('compiles exactly the five public journeys as one main branch', () => {
    expect(questStrategyCatalogue.map(strategy => strategy.questId)).toEqual(PUBLIC_IDS);
    for (const questId of PUBLIC_IDS) {
      const strategy = questStrategyCatalogue.find(value => value.questId === questId)!;
      const catalogue = runeProofCatalogueFor(strategy.questId)!;
      const { pack, actions } = publicPackFor(questId);
      const result = compileRuneProofQuestPack(pack, {
        catalogue,
        expectedCatalogueRevision: pack.catalogueRevision,
      });

      expect(result.findings.filter(finding => finding.severity === 'BLOCKING')).toEqual([]);
      expect(unresolvedManualCompletionIds(pack)).toEqual([]);
      expect(result.pack?.branches.map(branch => branch.id)).toEqual(['main']);
      expect(result.pack?.sharedActions).toEqual([]);
      expect(actions.map(action => action.id)).toEqual(PUBLIC_ACTION_IDS[questId]);
      expect(actions.map(action => ({
        id: action.id,
        sourceOrder: action.sourceOrder,
        instruction: action.instruction,
        dependsOn: action.dependsOn,
        chunks: action.location.kind === 'SURFACE' ? action.location.chunks : [],
      }))).toEqual(strategy.actions.map(action => ({
        id: action.id,
        sourceOrder: action.sourceOrder,
        instruction: action.displayText,
        dependsOn: action.dependsOn,
        chunks: action.mapChunks,
      })));
      expect(strategy.actions.flatMap((action, index) => (
        action.coach.completion.kind === 'MANUAL'
          ? [{ id: action.id, completion: actions[index].completion }]
          : []
      ))).toEqual(strategy.actions.flatMap(action => (
        action.coach.completion.kind === 'MANUAL'
          ? [{ id: action.id, completion: { kind: 'ACTION_CONFIRMED' } }]
          : []
      )));
      expect(pack.evidence.every(evidence => (
        pack.sources.some(source => source.id === evidence.sourceId)
      ))).toBe(true);
      expect(Object.isFrozen(pack)).toBe(true);
      expect(Object.isFrozen(actions)).toBe(true);
    }
  });

  it('retains the accepted Cook route and does not pre-seed route-produced ingredients', () => {
    const { pack } = publicPackFor("Cook's Assistant");
    expect(pack.branches[0].actions.find(action => action.id === 'cooks-assistant:pick-grain'))
      .toMatchObject({
        instruction: 'Pick grain outside Mill Lane Mill.',
        location: { kind: 'SURFACE', chunks: ['49,51'] },
      });
    expect(pack.initialItems.map(item => item.item.key)).not.toContain('grain');
    expect(pack.initialItems.map(item => item.item.key)).not.toContain('pot of flour');
  });

  it('preserves legacy transformation inputs without duplicate consumes', () => {
    const { actions } = publicPackFor("Cook's Assistant");
    const flour = actions.find(action => action.id === 'cooks-assistant:make-flour')!;

    expect(flour.itemEffects).toEqual([
      {
        kind: 'PRODUCE',
        itemKey: 'pot of flour',
        quantity: 1,
        from: [
          { itemKey: 'grain', quantity: 1 },
          { itemKey: 'pot', quantity: 1 },
        ],
      },
    ]);
  });

  it.each([
    {
      questId: "Cook's Assistant" as const,
      actionId: 'cooks-assistant:pick-grain',
      expectedEffects: [{
        kind: 'PRODUCE',
        itemKey: 'grain',
        quantity: 1,
        from: [],
      }],
    },
    {
      questId: 'Sheep Shearer' as const,
      actionId: 'sheep-shearer:shear-wool',
      expectedEffects: [
        {
          kind: 'PRODUCE',
          itemKey: 'wool',
          quantity: 20,
          from: [],
        },
        {
          kind: 'REUSE',
          itemKey: 'shears',
          quantity: 1,
        },
      ],
    },
  ])('preserves the input-free transformation for $actionId as PRODUCE', ({
    questId,
    actionId,
    expectedEffects,
  }) => {
    const { actions } = publicPackFor(questId);
    const action = actions.find(candidate => candidate.id === actionId)!;

    expect(action.itemEffects).toEqual(expectedEffects);
    expect(action.itemEffects.filter(effect => effect.kind === 'ACQUIRE')).toEqual([]);
  });

  it('does not resolve a malformed future explicit manual action declaration', () => {
    const { pack } = publicPackFor("Cook's Assistant");
    const valid: any = structuredClone(pack);
    const action = valid.branches[0].actions[0];
    const confirmationId = `manual:${action.id}`;
    action.completion = { kind: 'MANUAL', confirmationId };

    expect(unresolvedManualCompletionIds(valid)).toEqual([]);

    const changed: any = structuredClone(valid);
    const malformedAction = changed.branches[0].actions[0];
    malformedAction.instruction = '   ';
    malformedAction.evidenceIds = [];

    expect(unresolvedManualCompletionIds(changed)).toEqual([confirmationId]);
  });

  it('keeps only externally required reviewed roots and resolves their evidence', () => {
    const strategy = questStrategyCatalogue.find(value => value.questId === 'Imp Catcher')!;
    const catalogue = runeProofCatalogueFor(strategy.questId)!;
    const changed: any = structuredClone(strategy);
    changed.actions[0].coach.fulfils = [];
    const pack = legacyStrategyToRuneProofPack(changed, {
      catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      preflight: { kind: 'ALL', requirements: [] },
      reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
    });

    expect(pack.initialItems.map(root => ({
      key: root.item.key,
      evidenceIds: root.evidenceIds,
    }))).toEqual([{ key: 'black bead', evidenceIds: ['initial-item:black bead'] }]);
    expect(pack.evidence.find(evidence => evidence.id === 'initial-item:black bead'))
      .toMatchObject({
        sourceId: 'reviewed-roots:Imp Catcher',
        decision: 'Require 1 × Black bead before the reviewed route; accepted alternatives: none.',
      });
    expect(compileRuneProofQuestPack(pack, {
      catalogue,
      expectedCatalogueRevision: runeProofCatalogueRevision,
    }).findings.filter(finding => finding.severity === 'BLOCKING')).toEqual([]);

    const withoutInitialEvidence: any = structuredClone(pack);
    withoutInitialEvidence.evidence = withoutInitialEvidence.evidence.filter(
      (evidence: { readonly id: string }) => evidence.id !== 'initial-item:black bead',
    );
    expect(compileRuneProofQuestPack(withoutInitialEvidence, {
      catalogue,
      expectedCatalogueRevision: runeProofCatalogueRevision,
    }).findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH',
      severity: 'BLOCKING',
    }));
  });

  it('rejects preflight evidence that has no reviewed source', () => {
    const strategy = questStrategyCatalogue[0];
    const catalogue = runeProofCatalogueFor(strategy.questId)!;

    expect(() => legacyStrategyToRuneProofPack(strategy, {
      catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      preflight: {
        kind: 'MANUAL_CONFIRMATION',
        id: 'manual:unknown',
        confirmationId: 'manual:unknown',
        prompt: 'Confirm unknown evidence.',
        evidenceIds: ['unknown:evidence'],
      },
      reviewedRoots: [],
    })).toThrow('Unknown preflight evidence ID "unknown:evidence"');
  });

  it('requires an explicitly injected exact audit source for unresolved catalogues', () => {
    const strategy = questStrategyCatalogue[0];
    const catalogue = {
      ...runeProofCatalogueFor(strategy.questId)!,
      requirementStatus: 'UNRESOLVED' as const,
    };
    const context = {
      catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      preflight: requirementExpressionForQuestData(QUEST_DATA[strategy.questId], catalogue),
      reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
    };

    expect(() => legacyStrategyToRuneProofPack(strategy, context))
      .toThrow(`Missing exact requirement audit source for ${strategy.questId}.`);
    expect(() => legacyStrategyToRuneProofPack(strategy, {
      ...context,
      requirementAuditEntry: {
        id: strategy.questId,
        reviewedAt: '2026-07-28T00:00:00.000Z',
        source: {
          url: "https://oldschool.runescape.wiki/w/index.php?title=Cook's_Assistant&oldid=15240921",
          revision: 1,
          revisionTimestamp: catalogue.sourceRevisionTimestamp,
        },
      },
    })).toThrow(`Missing exact requirement audit source for ${strategy.questId}.`);

    const pack = legacyStrategyToRuneProofPack(strategy, {
      ...context,
      requirementAuditEntry: {
        id: strategy.questId,
        reviewedAt: '2026-07-28T00:00:00.000Z',
        source: {
          url: "https://oldschool.runescape.wiki/w/index.php?title=Cook's_Assistant&oldid=15240921",
          revision: Number(catalogue.sourceRevision),
          revisionTimestamp: catalogue.sourceRevisionTimestamp,
        },
      },
    });
    expect(pack.sources).toContainEqual(expect.objectContaining({
      id: `requirement-audit:${strategy.questId}`,
      revision: catalogue.sourceRevision,
      revisionTimestamp: catalogue.sourceRevisionTimestamp,
    }));
  });

  it.each([
    ['an unrelated HTTPS host', {
      url: 'https://example.invalid/unrelated?oldid=15240921',
      reviewedAt: '2026-07-28T00:00:00.000Z',
    }],
    ['the wrong Wiki title', {
      url: "https://oldschool.runescape.wiki/w/index.php?title=Sheep_Shearer&oldid=15240921",
      reviewedAt: '2026-07-28T00:00:00.000Z',
    }],
    ['the wrong pinned oldid', {
      url: "https://oldschool.runescape.wiki/w/index.php?title=Cook's_Assistant&oldid=1",
      reviewedAt: '2026-07-28T00:00:00.000Z',
    }],
    ['a malformed review timestamp', {
      url: "https://oldschool.runescape.wiki/w/index.php?title=Cook's_Assistant&oldid=15240921",
      reviewedAt: '2026-02-31T00:00:00.000Z',
    }],
    ['a coercible string revision', {
      url: "https://oldschool.runescape.wiki/w/index.php?title=Cook's_Assistant&oldid=15240921",
      reviewedAt: '2026-07-28T00:00:00.000Z',
      revision: '15240921',
    }],
  ])('rejects unresolved audit truth with %s before it can compile', (_label, invalid) => {
    const strategy = questStrategyCatalogue[0];
    const catalogue = {
      ...runeProofCatalogueFor(strategy.questId)!,
      requirementStatus: 'UNRESOLVED' as const,
    };
    const attempt = (): Readonly<{
      accepted: boolean;
      rejection?: string;
      blockingCodes?: readonly string[];
    }> => {
      try {
        const definition = legacyStrategyToRuneProofPack(strategy, {
          catalogue,
          catalogueRevision: runeProofCatalogueRevision,
          preflight: requirementExpressionForQuestData(QUEST_DATA[strategy.questId], catalogue),
          reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
          requirementAuditEntry: {
            id: strategy.questId,
            reviewedAt: invalid.reviewedAt,
            source: {
              url: invalid.url,
              revision: ('revision' in invalid
                ? invalid.revision
                : Number(catalogue.sourceRevision)) as number,
              revisionTimestamp: catalogue.sourceRevisionTimestamp,
            },
          },
        });
        const compiled = compileRuneProofQuestPack(definition, {
          catalogue,
          expectedCatalogueRevision: runeProofCatalogueRevision,
        });
        return {
          accepted: compiled.pack !== undefined,
          blockingCodes: compiled.findings
            .filter(finding => finding.severity === 'BLOCKING')
            .map(finding => finding.code),
        };
      } catch (error) {
        return {
          accepted: false,
          rejection: error instanceof Error ? error.message : String(error),
        };
      }
    };

    const result = attempt();
    expect(result.accepted).toBe(false);
    if (result.rejection) {
      expect(result.rejection).toMatch(/exact requirement audit source/);
    } else {
      expect(result.blockingCodes).toContain('SOURCE_MISMATCH');
    }
  });

  it('emits valid audit evidence as a compiler-enforced Wiki revision source', () => {
    const strategy = questStrategyCatalogue[0];
    const catalogue = {
      ...runeProofCatalogueFor(strategy.questId)!,
      requirementStatus: 'UNRESOLVED' as const,
    };
    const definition = legacyStrategyToRuneProofPack(strategy, {
      catalogue,
      catalogueRevision: runeProofCatalogueRevision,
      preflight: requirementExpressionForQuestData(QUEST_DATA[strategy.questId], catalogue),
      reviewedRoots: reviewedQuestRequirements(strategy.questId)!.items,
      requirementAuditEntry: {
        id: strategy.questId,
        reviewedAt: '2026-07-28T00:00:00.000Z',
        source: {
          url: "https://oldschool.runescape.wiki/w/index.php?title=Cook's_Assistant&oldid=15240921",
          revision: Number(catalogue.sourceRevision),
          revisionTimestamp: catalogue.sourceRevisionTimestamp,
        },
      },
    });
    const audit = definition.sources.find(source => (
      source.id === `requirement-audit:${strategy.questId}`
    ))!;
    const changed: any = structuredClone(definition);
    changed.sources.find((source: { readonly id: string }) => source.id === audit.id).uri =
      `https://example.invalid/unrelated?oldid=${catalogue.sourceRevision}`;
    const compiled = compileRuneProofQuestPack(changed, {
      catalogue,
      expectedCatalogueRevision: runeProofCatalogueRevision,
    });

    expect(audit.kind).toBe('WIKI_REVISION');
    expect(compiled.pack).toBeUndefined();
    expect(compiled.findings).toContainEqual(expect.objectContaining({
      code: 'SOURCE_MISMATCH',
      severity: 'BLOCKING',
    }));
  });
});
