export interface QuestWalkthroughRelease {
  readonly questId: string;
  readonly revision: string;
  readonly releaseStatus: 'PREVIEW_ONLY' | 'APPROVED';
}

const RELEASES: readonly QuestWalkthroughRelease[] = [
  {
    questId: "Cook's Assistant",
    revision: '426d462830b5d68ab53e085aea49b6b7f45e785f9f8c6974984da756c6163ea0',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: "Daddy's Home",
    revision: 'b9441f541e61ba860e325369d560c5465573d6af6bb9a462db19be007ba68b2e',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: "Doric's Quest",
    revision: '19a1c036b94472c209efe0ddd47823c54c5893eb7e2de56509ea80aa463f5691',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: 'Elemental Workshop I',
    revision: 'f47c094bf2e5c52d96238477993ccf8988a166d78ef5987bc89ca9a8394b5194',
    releaseStatus: 'PREVIEW_ONLY',
  },
];

const releaseByQuestId = new Map(RELEASES.map(release => [release.questId, release]));

export const questWalkthroughReleaseFor = (
  questId: string,
): QuestWalkthroughRelease | undefined => releaseByQuestId.get(questId);
