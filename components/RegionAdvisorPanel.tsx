import React, { useMemo } from 'react';
import { Map } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { rankLockedRegions } from '../utils/regionAdvisor';
import { AdvisorList, AdvisorItem } from './AdvisorList';

/**
 * Dashboard widget: "Which region should I unlock next?"
 *
 * Thin adapter over the shared <AdvisorList> — maps ranked regions into the
 * generic item shape and renders the standalone card variant. Sits in the
 * WORLD tab list view.
 */

export const RegionAdvisorPanel: React.FC = () => {
  const { unlocks } = useGame();
  const ranked = useMemo(() => rankLockedRegions(unlocks), [unlocks]);

  // Scroll the matching region group card into view + flash a highlight ring.
  const scrollToRegion = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-region-card="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('ring-2', 'ring-amber-400/70');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-amber-400/70'), 1800);
  };

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
      subheading="Unlock these regions for the most forward progress"
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
