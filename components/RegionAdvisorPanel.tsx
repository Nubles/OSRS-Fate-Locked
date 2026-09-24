import React, { useMemo } from 'react';
import { Map } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { rankLockedRegions } from '../utils/regionAdvisor';
import { AdvisorList, AdvisorItem } from './AdvisorList';
import { flashSelector } from '../utils/flash';
import { displayAreaName } from '../data/areaMapPolicy';

/**
 * Dashboard widget: "Which area should I unlock next?"
 *
 * Thin adapter over the shared <AdvisorList> — maps ranked areas into the
 * generic item shape and renders the standalone card variant. Sits in the
 * WORLD tab list view.
 */

export const RegionAdvisorPanel: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const ranked = useMemo(() => rankLockedRegions(unlocks, gameModeId), [unlocks, gameModeId]);

  // Scroll the area's continent card into view + flash a highlight ring.
  const scrollToRegion = (id: string) => {
    const region = ranked.find((r) => r.id === id)?.region ?? id;
    flashSelector(`[data-region-card="${region}"]`, 'amber');
  };

  const items: AdvisorItem[] = ranked.map((r) => ({
    id: r.id,
    title: displayAreaName(r.id),
    meta: r.region,
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
      subheading="Unlock these areas for the most forward progress"
      caption="by unlock chain"
      icon={<Map size={13} />}
      maxShown={4}
      maxNames={3}
      emptyLabel="All areas unlocked — impressive!"
      onItemClick={scrollToRegion}
      variant="card"
    />
  );
};
