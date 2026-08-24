import { describe, expect, it } from 'vitest';
import snapshot from './sources/runeproof-quest-catalogue.json';
import {
  runeProofQuestCatalogue,
  validateRuneProofQuestCatalogue,
} from './runeProofQuestCatalogue';

describe('RuneProof quest catalogue', () => {
  it('reconciles the exact normalized catalogue', () => {
    expect(runeProofQuestCatalogue).toHaveLength(210);
    expect(runeProofQuestCatalogue.filter(entry => entry.kind === 'quest')).toHaveLength(191);
    expect(runeProofQuestCatalogue.filter(entry => entry.kind === 'miniquest')).toHaveLength(19);
    expect(Object.isFrozen(runeProofQuestCatalogue)).toBe(true);
  });

  it('rejects a source revision that is not pinned', () => {
    const changed = structuredClone(snapshot);
    changed.entries[0].sourceRevision = '';
    expect(() => validateRuneProofQuestCatalogue(changed))
      .toThrow(/sourceRevision must be a non-empty string/);
  });

  it('rejects an impossible complexity override review date', () => {
    const changed = structuredClone(snapshot);
    const entry = changed.entries.find(candidate => candidate.membership === 'MEMBERS')!;
    const mutableComplexity = entry.requirementComplexity as typeof entry.requirementComplexity & {
      override?: {
        fromMilestone: number;
        toMilestone: number;
        reviewer: string;
        reviewedAt: string;
        reason: string;
      };
    };
    mutableComplexity.override = {
      fromMilestone: entry.requirementComplexity.baselineMilestone,
      toMilestone: entry.requirementComplexity.assignedMilestone,
      reviewer: 'Catalogue reviewer',
      reviewedAt: '2026-02-31',
      reason: 'Boundary validation regression fixture',
    };
    expect(() => validateRuneProofQuestCatalogue(changed))
      .toThrow(/override.reviewedAt must be a valid date/);
  });

  it('rejects an impossible source revision timestamp', () => {
    const changed = structuredClone(snapshot);
    changed.entries[0].sourceRevisionTimestamp = '2026-02-31T12:00:00Z';
    expect(() => validateRuneProofQuestCatalogue(changed))
      .toThrow(/sourceRevisionTimestamp must be a valid timestamp/);
  });

  it('rejects a string milestone instead of coercing it', () => {
    const changed = structuredClone(snapshot) as unknown as {
      entries: Array<{ milestone: unknown }>;
    };
    changed.entries[0].milestone = '1';
    expect(() => validateRuneProofQuestCatalogue(changed))
      .toThrow(/milestone must be 1, 2, 3, 4, or 5/);
  });
});
