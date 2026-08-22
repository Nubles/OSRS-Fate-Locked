import type { QuestWalkthroughRelease } from './questWalkthroughRelease';

const PUBLIC_RELEASES: readonly QuestWalkthroughRelease[] = [
  {
    questId: "Cook's Assistant",
    revision: 'runeproof-public-cooks-assistant-v1',
    releaseStatus: 'APPROVED',
  },
  {
    questId: 'Sheep Shearer',
    revision: 'runeproof-public-sheep-shearer-v1',
    releaseStatus: 'APPROVED',
  },
  {
    questId: 'The Restless Ghost',
    revision: 'runeproof-public-the-restless-ghost-v1',
    releaseStatus: 'APPROVED',
  },
  {
    questId: 'Rune Mysteries',
    revision: 'runeproof-public-rune-mysteries-v1',
    releaseStatus: 'APPROVED',
  },
  {
    questId: 'Imp Catcher',
    revision: 'runeproof-public-imp-catcher-v1',
    releaseStatus: 'APPROVED',
  },
];

const releaseByQuestId = new Map(PUBLIC_RELEASES.map(release => [release.questId, release]));

export const publicQuestWalkthroughReleases: readonly QuestWalkthroughRelease[] = Object.freeze(
  [...PUBLIC_RELEASES],
);

export const publicQuestWalkthroughReleaseFor = (
  questId: string,
): QuestWalkthroughRelease | undefined => releaseByQuestId.get(questId);
