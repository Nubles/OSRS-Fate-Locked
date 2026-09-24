export interface QuestWalkthroughRelease {
  readonly questId: string;
  readonly revision: string;
  readonly releaseStatus: 'PREVIEW_ONLY' | 'APPROVED';
}

const RELEASES: readonly QuestWalkthroughRelease[] = [
  {
    questId: "Cook's Assistant",
    revision: '2311293172d8ea0d4ddc1d69e7d5e696af92951edb7e07543b502fa46671e1a1',
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
  {
    questId: 'Sheep Shearer',
    revision: '61adaed2635c9bfa09158c13dc25c906b3d5746e2cd20f849ed2a29cc552618d',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: 'The Restless Ghost',
    revision: 'ac29fd792fcc21964d4ad9c274a28a6f9d5f119f45524b310231060e20cd6e16',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: 'Rune Mysteries',
    revision: '5307348d9dab40a1801d78b06660af566112223a339dfa017f4a43306149bd5f',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: 'Imp Catcher',
    revision: '0f50a69f17989b9b244ba0f47f1461c65d720eece2b9603ad14158850ad53cdd',
    releaseStatus: 'PREVIEW_ONLY',
  },
];

const releaseByQuestId = new Map(RELEASES.map(release => [release.questId, release]));

export const questWalkthroughReleaseFor = (
  questId: string,
): QuestWalkthroughRelease | undefined => releaseByQuestId.get(questId);
