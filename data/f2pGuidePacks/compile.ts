import { QUEST_DATA } from '../questData';
import { f2pQuestMembershipFor } from '../f2pQuestMembership';
import type { QuestGuideArticle } from '../questGuideArticles';
import type { QuestWalkthroughDefinition } from '../../utils/questWalkthroughs/model';
import { questStrategyFromWalkthrough, type QuestStrategyDefinition } from '../../utils/questStrategies/model';
import type { RouteGate } from '../../utils/questRoutes/model';
import type { F2PGuidePack } from './types';

export function compileF2PGuidePack(pack: F2PGuidePack): { walkthrough: QuestWalkthroughDefinition; strategy: QuestStrategyDefinition } {
  const membership = f2pQuestMembershipFor(pack.questId);
  if (!membership || membership.slug !== pack.slug) throw new Error(`Invalid F2P pack identity: ${pack.questId}`);
  const revision = `runeproof-preview-${pack.slug}-v1`;
  const sourceUrl = `https://oldschool.runescape.wiki/w/${encodeURIComponent(pack.questId.replace(/ /g, '_'))}?oldid=${pack.wikiRevision}`;
  const ids = pack.steps.map(step => `${pack.slug}:${step.id}`);
  const quest = QUEST_DATA[pack.questId];
  const prerequisites: RouteGate[] = [
    ...Object.entries(quest.skills).filter(([skill]) => skill === 'Quest Points').map(([skill, level]): RouteGate => ({ type: 'SKILL', skill, level, label: `${skill} ${level}` })),
    ...quest.prereqs.map(questId => ({ type: 'QUEST' as const, questId, label: questId })),
  ];
  // Include the ordinary supplies collected along the route in resolver coverage,
  // while retaining external roots separately for the ordered item-flow check.
  const supplies = new Map(pack.rootItems.map(item => [item.item.key, item]));
  for (const step of pack.steps) for (const item of [...(step.items ?? []), ...(step.fulfils ?? [])]) {
    if (item.supplyPolicy === 'PLAYER_OBTAINED' && !supplies.has(item.item.key)) supplies.set(item.item.key, item);
  }
  const requirementsReview = {
    questId: pack.questId, wikiRevision: pack.wikiRevision, reviewedAt: '2026-09-23', items: [...supplies.values()],
  };
  const walkthrough: QuestWalkthroughDefinition = {
    questId: pack.questId, revision, releaseStatus: 'PREVIEW_ONLY', requirementsReview,
    source: {
      kind: 'INDEPENDENT_REVIEW', author: 'Fate Locked', authoredAt: '2026-09-23',
      methodology: 'Independent F2P test guide checked against pinned full Wiki pages and QuestHelper source; location evidence retained per step. Walking connections are not certified by this review.',
      wikiTitle: pack.questId, wikiRevision: pack.wikiRevision, wikiRevisionTimestamp: pack.wikiTimestamp,
      wikiUrl: sourceUrl, wikiLicence: 'CC BY-NC-SA 3.0', wikiLicenceUrl: 'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    },
    sourceLines: [],
    actions: pack.steps.map((step, index) => ({
      id: ids[index], sourceOrder: index + 1, section: 'QUEST', kind: step.kind ?? 'INTERACT_OBJECT',
      confidence: step.chunks.length ? 'REVIEWED' : 'UNMAPPED', displayText: step.text,
      rawWikiLineIds: [], entities: [], dependsOn: index ? [ids[index - 1]] : [],
      items: step.items ?? [], manualChecks: step.manualChecks,
      gates: [...(index === 0 || index === pack.steps.length - 1 ? prerequisites : []), ...(step.gates ?? [])],
      location: step.chunks.length ? {
        kind: 'REVIEWED_ALIAS', alias: step.location, chunks: step.chunks,
        reviewer: 'Fate Locked source review', reviewedAt: '2026-09-23',
        evidence: step.locationEvidence, rationale: step.locationEvidence,
      } : { kind: 'NONE' },
      coach: {
        consumes: step.consumes ?? [], fulfils: step.fulfils ?? [], fallbackPolicy: 'NONE',
        completion: index === pack.steps.length - 1 ? { kind: 'QUEST_COMPLETED', questId: pack.questId } : { kind: 'MANUAL' },
      },
    })),
  };
  const compiled = questStrategyFromWalkthrough(walkthrough, { membership, rootRequirements: pack.rootItems, allowUnmappedPreview: true });
  if (!compiled) throw new Error(`Invalid F2P pack action/item flow: ${pack.questId}`);
  const article: QuestGuideArticle = {
    questId: pack.questId, guideRevision: revision, sourceUrl, links: pack.links, guideNotes: pack.notes,
    startPoint: pack.startPoint, difficulty: pack.difficulty, length: pack.length,
    requirements: pack.requirements, itemsRequired: pack.itemsRequired, itemsObtained: pack.itemsObtained,
    recommended: pack.recommended, enemies: pack.enemies, rewards: pack.rewards,
    steps: Object.fromEntries(pack.steps.map((step, index) => [ids[index], {
      section: step.section, location: step.location, details: step.details,
    }])),
  };
  return { walkthrough, strategy: { ...compiled, article, requirementsReview, vanillaPreview: true, previewNotes: [
    'Test guide — step destinations are checked where shown; walking routes between them still need review.', ...(pack.notes?.slice(0, 1) ?? []),
  ] } };
}
