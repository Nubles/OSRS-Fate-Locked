import React, { useMemo } from 'react';
import { Map } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { rankLockedRegions } from '../utils/regionAdvisor';
import { AdvisorList, AdvisorItem } from './AdvisorList';
import { flashSelector } from '../utils/flash';

/**
 * Dashboard widget: "Which region should I unlock next?"
 *
 * Thin adapter over the shared <AdvisorList> — maps ranked regions into the
 * generic item shape and renders the standalone card variant. Sits in the
 * WORLD tab list view.
 */

export const RegionAdvisorPanel: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const ranked = useMemo(() => rankLockedRegions(unlocks, gameModeId), [unlocks, gameModeId]);

  // Scroll the matching region group card into view + flash a highlight ring.
  const scrollToRegion = (id: string) => flashSelector(`[data-region-card="${id}"]`, 'amber');

  const items: AdvisorItem[] = ranked.map((r) => ({
    id: r.id,
    title: r.id,
    directQuests: r.newQuestNames,
    directDiaries: r.newDiaryIds,
    cascadeQuests: r.cascadeQuestNames,
    cascadeDiaries: r.cascadeDiaryIds,
    score: r.score,
    cascadeScore: r.cascadeScore,
  }));

  return (
    <AdvisorList
      items={items}
      accent="amber"
      heading="Region Advisor"
      subheading="Potential progress after this change. Quest and diary checks still need confirmation."
      caption="by unlock chain"
      icon={<Map size={13} />}
      maxShown={4}
      maxNames={3}
      emptyLabel="All regions unlocked — impressive!"
      onItemClick={scrollToRegion}
      variant="card"
    />
  );
};
