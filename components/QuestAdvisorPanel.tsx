import React from 'react';
import { TrendingUp } from 'lucide-react';
import { RankedQuest } from '../utils/questAdvisor';
import { AdvisorList, AdvisorItem } from './AdvisorList';

/**
 * Quest Impact Advisor strip (Journal → Quests, "High Impact" mode).
 *
 * Thin adapter: maps RankedQuest[] → AdvisorItem[] and defers all rendering to
 * the shared <AdvisorList> so it stays pixel-identical to the Region advisor.
 */

interface Props {
  ranked: RankedQuest[];
  onItemClick: (id: string) => void;
}

export const QuestAdvisorPanel: React.FC<Props> = ({ ranked, onItemClick }) => {
  const items: AdvisorItem[] = ranked.map((q) => ({
    id: q.id,
    pendingChecks: q.pendingChecks,
    title: q.name,
    meta: q.points > 0 ? `${q.points} QP` : undefined,
    directQuests: q.newQuestNames,
    directDiaries: q.newDiaryIds,
    cascadeQuests: q.cascadeQuestNames,
    cascadeDiaries: q.cascadeDiaryIds,
    score: q.score,
    cascadeScore: q.cascadeScore,
  }));

  return (
    <AdvisorList
      items={items}
      accent="violet"
      heading="High Impact"
      caption="ranked by potential progress"
      subheading="Planning estimates. Each quest and downstream step still needs its listed checks confirmed."
      icon={<TrendingUp size={11} />}
      emptyLabel="No candidates with known gates met. Review quest requirements and unknown checks."
      onItemClick={onItemClick}
      variant="strip"
    />
  );
};
