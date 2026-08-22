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
    revision: '2aa93838959a1fd0c26ab45642b9bb39e5bad0321487129cdf2fb39f2bf971e2',
    releaseStatus: 'PREVIEW_ONLY',
  },
  {
    questId: 'The Restless Ghost',
    revision: '10713567065dfb8118da8fa8bcd91413bad41070d9f42d3bed46666e756b1c7a',
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
