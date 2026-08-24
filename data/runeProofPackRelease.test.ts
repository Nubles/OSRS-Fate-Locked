import { describe, expect, it, vi } from 'vitest';
import { runeProofCatalogueRevision } from './runeProofQuestCatalogue';
import {
  publicRuneProofPackHeaders,
  publicRuneProofPackReleases,
} from './runeProofPackRelease.public';
import { previewRuneProofPackHeaders } from './runeProofPackRelease.preview';
import { publicQuestWalkthroughReleases } from './questWalkthroughPublicRelease';
import { validateRuneProofPackReleaseManifest } from './runeProofPackRelease';

const PUBLIC_IDS = [
  "Cook's Assistant",
  'Sheep Shearer',
  'The Restless Ghost',
  'Rune Mysteries',
  'Imp Catcher',
];

const previewContext = {
  target: 'PREVIEW' as const,
  catalogueRevision: runeProofCatalogueRevision,
  packRevisions: new Map([['Example', 'revision']]),
};

describe('RuneProof pack lifecycle', () => {
  it('contains exactly the five already-public exact revisions', () => {
    expect(publicRuneProofPackReleases.map(release => release.questId)).toEqual(PUBLIC_IDS);
    expect(publicRuneProofPackReleases.every(release =>
      release.lifecycle === 'PUBLIC_APPROVED')).toBe(true);
    expect(publicRuneProofPackReleases.every(release =>
      release.catalogueRevision === runeProofCatalogueRevision)).toBe(true);
    expect(Object.isFrozen(publicRuneProofPackReleases)).toBe(true);
  });

  it.each(['DRAFT', 'PREVIEW_VALIDATED', 'MILESTONE_APPROVED'] as const)(
    'does not admit %s into a public manifest',
    (lifecycle) => {
      expect(() => validateRuneProofPackReleaseManifest([{
        questId: 'Example',
        packRevision: 'revision',
        catalogueRevision: runeProofCatalogueRevision,
        lifecycle,
      }], {
        target: 'PUBLIC',
        catalogueRevision: runeProofCatalogueRevision,
        packRevisions: new Map([['Example', 'revision']]),
      })).toThrow(/PUBLIC requires PUBLIC_APPROVED/);
    },
  );

  it('invalidates approval when the exact pack revision changes', () => {
    expect(() => validateRuneProofPackReleaseManifest([{
      questId: 'Example',
      packRevision: 'old-revision',
      catalogueRevision: runeProofCatalogueRevision,
      lifecycle: 'PREVIEW_VALIDATED',
    }], {
      target: 'PREVIEW',
      catalogueRevision: runeProofCatalogueRevision,
      packRevisions: new Map([['Example', 'new-revision']]),
    })).toThrow(/does not match compiled pack revision/);
  });

  it('rejects drafts, absent packs, catalogue drift, duplicate IDs, and extra fields', () => {
    const release = {
      questId: 'Example',
      packRevision: 'revision',
      catalogueRevision: runeProofCatalogueRevision,
      lifecycle: 'PREVIEW_VALIDATED' as const,
    };
    expect(() => validateRuneProofPackReleaseManifest([
      { ...release, lifecycle: 'DRAFT' },
    ], previewContext)).toThrow(/PREVIEW does not admit DRAFT/);
    expect(() => validateRuneProofPackReleaseManifest([
      { ...release, questId: 'Missing' },
    ], previewContext)).toThrow(/has no compiled pack/);
    expect(() => validateRuneProofPackReleaseManifest([
      { ...release, catalogueRevision: 'stale-catalogue' },
    ], previewContext)).toThrow(/catalogue revision/);
    expect(() => validateRuneProofPackReleaseManifest([
      release,
      release,
    ], previewContext)).toThrow(/duplicate quest ID/);
    expect(() => validateRuneProofPackReleaseManifest([{
      ...release,
      inferredApproval: true,
    }], previewContext)).toThrow(/unexpected field/);
  });

  it('rejects sparse manifest arrays without reading through the hole', () => {
    const sparse = Array(1) as unknown[];
    expect(() => validateRuneProofPackReleaseManifest(
      sparse,
      previewContext,
    )).toThrow(/dense array/);
  });

  it('keeps public and preview headers consistent with canonical action-free releases', () => {
    const canonical = publicQuestWalkthroughReleases.map(release => ({
      questId: release.questId,
      packRevision: release.revision,
      catalogueRevision: runeProofCatalogueRevision,
    }));
    expect(publicRuneProofPackHeaders).toEqual(canonical);
    expect(previewRuneProofPackHeaders).toEqual(canonical);
  });

  it('derives headers from canonical release revisions before validating snapshots', async () => {
    vi.resetModules();
    vi.doMock('./questWalkthroughPublicRelease', async (importOriginal) => {
      const original = await importOriginal<typeof import('./questWalkthroughPublicRelease')>();
      return {
        ...original,
        publicQuestWalkthroughReleases: original.publicQuestWalkthroughReleases.map(
          (release, index) => index === 0
            ? { ...release, revision: 'canonical-revision-changed' }
            : release,
        ),
      };
    });
    try {
      const [publicResult, previewResult] = await Promise.allSettled([
        import('./runeProofPackRelease.public'),
        import('./runeProofPackRelease.preview'),
      ]);
      expect(publicResult).toMatchObject({
        status: 'rejected',
        reason: expect.objectContaining({ message: expect.stringMatching(/compiled pack revision/) }),
      });
      expect(previewResult).toMatchObject({
        status: 'rejected',
        reason: expect.objectContaining({ message: expect.stringMatching(/compiled pack revision/) }),
      });
    } finally {
      vi.doUnmock('./questWalkthroughPublicRelease');
      vi.resetModules();
    }
  });
});
