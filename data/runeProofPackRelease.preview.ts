import snapshot from './sources/runeproof-pack-releases.preview.json';
import { publicQuestWalkthroughReleases } from './questWalkthroughPublicRelease';
import { runeProofCatalogueRevision } from './runeProofQuestCatalogue';
import {
  validateRuneProofPackReleaseSnapshot,
  type RuneProofPackHeader,
  type RuneProofPackRelease,
} from './runeProofPackRelease';

export const previewRuneProofPackHeaders: readonly RuneProofPackHeader[] = Object.freeze(
  publicQuestWalkthroughReleases.map(release => Object.freeze({
    questId: release.questId,
    packRevision: release.revision,
    catalogueRevision: runeProofCatalogueRevision,
  })),
);

const validated = validateRuneProofPackReleaseSnapshot(snapshot, {
  target: 'PREVIEW',
  catalogueRevision: runeProofCatalogueRevision,
  packRevisions: new Map(previewRuneProofPackHeaders.map(header => [
    header.questId,
    header.packRevision,
  ])),
});

export const previewRuneProofPackReleases: readonly RuneProofPackRelease[] = validated.entries;
