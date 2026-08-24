import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  defineRuneProofQuestPack,
  requirementAll,
  runeProofFindingId,
  type RequirementExpression,
  type RuneProofQuestPack,
} from './packModel';

describe('RuneProof pack model', () => {
  it('builds immutable, versioned expressions and packs', () => {
    const preflight = requirementAll({
      kind: 'QUEST_COMPLETED',
      id: 'quest:example',
      questId: 'Example',
      evidenceIds: ['quest-data:Example'],
    });
    const pack = defineRuneProofQuestPack({
      schemaVersion: 1,
      questId: 'Example',
      revision: 'pack-revision',
      catalogueRevision: 'catalogue-revision',
      sources: [],
      evidence: [],
      initialItems: [],
      preflight,
      branches: [],
      sharedActions: [],
      completion: {
        canonicalQuestId: 'Example',
        branchActionIds: {},
        evidenceIds: [],
      },
      migrations: [],
    });
    expect(Object.isFrozen(pack)).toBe(true);
    expect(Object.isFrozen(preflight.requirements)).toBe(true);
    expectTypeOf(pack).toMatchTypeOf<RuneProofQuestPack>();
    expectTypeOf(preflight).toMatchTypeOf<RequirementExpression>();
  });

  it('distinguishes absent finding scope from a literal dash ID', () => {
    const absent = runeProofFindingId({
      code: 'DUPLICATE_ID', scope: 'PACK', questId: 'Example',
    }, 'same');
    const literalDash = runeProofFindingId({
      code: 'DUPLICATE_ID', scope: 'PACK', questId: 'Example', branchId: '-',
    }, 'same');
    expect(absent).not.toBe(literalDash);
  });
});
