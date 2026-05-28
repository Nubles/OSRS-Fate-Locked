import React, { useMemo } from 'react';
import { Dumbbell } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { rankSkillBottlenecks } from '../utils/skillAdvisor';
import { AdvisorList, AdvisorItem } from './AdvisorList';

/**
 * Dashboard widget: "Which skill should I train next, and to what level?"
 *
 * Thin adapter over the shared <AdvisorList> — maps ranked skills into the
 * generic item shape (meta shows the level jump) and flashes the matching
 * skill card when a row is clicked. Lives in the CHARACTER tab skills column.
 */

export const SkillAdvisorPanel: React.FC = () => {
  const { unlocks } = useGame();
  const ranked = useMemo(() => rankSkillBottlenecks(unlocks), [unlocks]);

  // Scroll the matching skill card into view + flash a highlight ring.
  const scrollToSkill = (id: string) => {
    const el = document.querySelector<HTMLElement>(`[data-skill-card="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.add('ring-2', 'ring-cyan-400/70');
    window.setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400/70'), 1800);
  };

  const items: AdvisorItem[] = ranked.map((s) => ({
    id: s.id,
    title: s.id,
    meta: `Lv ${s.currentLevel}→${s.targetLevel}`,
    directQuests: s.newQuestNames,
    directDiaries: s.newDiaryIds,
    cascadeQuests: s.cascadeQuestNames,
    cascadeDiaries: s.cascadeDiaryIds,
    score: s.score,
    cascadeScore: s.cascadeScore,
  }));

  return (
    <AdvisorList
      items={items}
      accent="cyan"
      heading="Skill Advisor"
      subheading="Train these next to clear the most content gates"
      caption="by unlock chain"
      icon={<Dumbbell size={13} />}
      maxShown={4}
      maxNames={3}
      emptyLabel="No skill thresholds are gating new content right now."
      onItemClick={scrollToSkill}
      variant="card"
    />
  );
};
