import snapshot from './sources/runeproof-pack-releases.public.json';
import { publicQuestWalkthroughReleases } from './questWalkthroughPublicRelease';
import { runeProofCatalogueRevision } from './runeProofQuestCatalogue';
import {
  validateRuneProofPackReleaseSnapshot,
  type RuneProofPackHeader,
  type RuneProofPackRelease,
} from './runeProofPackRelease';

export const publicRuneProofPackHeaders: readonly RuneProofPackHeader[] = Object.freeze(
  publicQuestWalkthroughReleases.map(release => Object.freeze({
    questId: release.questId,
    packRevision: release.revision,
    catalogueRevision: runeProofCatalogueRevision,
  })),
);

const validated = validateRuneProofPackReleaseSnapshot(snapshot, {
  target: 'PUBLIC',
  catalogueRevision: runeProofCatalogueRevision,
  packRevisions: new Map(publicRuneProofPackHeaders.map(header => [
    header.questId,
    header.packRevision,
  ])),
});

export const publicRuneProofPackReleases: readonly RuneProofPackRelease[] = validated.entries;
