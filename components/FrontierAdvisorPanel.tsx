import React, { useEffect, useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { rankFrontierChunks } from '../utils/frontierAdvisor';
import { chunkRegion } from '../utils/chunkAdjacency';
import { chunkContentService } from '../services/ChunkContentService';
import { AdvisorList, AdvisorItem } from './AdvisorList';

/**
 * Chunked mode's Region Advisor equivalent: ranks the chunks you could roll
 * next (the frontier) by what they'd actually be worth — first footholds in
 * new named areas (scored with the same impact engine as the Region Advisor)
 * plus chunk-local content (bank/shops/monsters) as a tie-breaker. Rolls are
 * random-adjacent so you can't pick, but you CAN know what you're hoping for.
 *
 * Rendered in the World tab's list view where RegionAdvisorPanel sits for the
 * named-region modes.
 */

export const FrontierAdvisorPanel: React.FC = () => {
  const { unlocks, gameModeId } = useGame();

  // Chunk content is lazily fetched; re-rank once it lands (the ranking is
  // still useful without it — footholds don't need it).
  const [contentTick, setContentTick] = useState(0);
  useEffect(() => {
    if (!chunkContentService.ready) {
      chunkContentService.init().then((ok) => { if (ok) setContentTick((t) => t + 1); });
    }
  }, []);

  const ranked = useMemo(
    () => rankFrontierChunks(
      unlocks,
      gameModeId,
      chunkContentService.ready ? (cx, cy) => chunkContentService.contentFor(cx, cy) : undefined,
      chunkContentService.ready ? (cx, cy) => chunkContentService.hasBank(cx, cy) : undefined,
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [unlocks, gameModeId, contentTick],
  );

  const items: AdvisorItem[] = ranked.map((r) => {
    const bits: string[] = [];
    if (r.newAreas.length > 0) bits.push(`opens ${r.newAreas.join(' · ')}`);
    if (r.content?.hasBank) bits.push('bank');
    if (r.content && r.content.shops > 0) bits.push(`${r.content.shops} shop${r.content.shops > 1 ? 's' : ''}`);
    if (r.content && r.content.monsters > 0) bits.push(`${r.content.monsters} monster${r.content.monsters > 1 ? 's' : ''}`);
    return {
      id: r.key,
      title: r.label,
      meta: bits.join(' · ') || undefined,
      directQuests: r.newQuestNames,
      directDiaries: r.newDiaryIds,
      cascadeQuests: r.cascadeQuestNames,
      cascadeDiaries: r.cascadeDiaryIds,
      score: r.score,
      cascadeScore: r.sortScore, // drives the relative bar + ordering
    };
  });

  return (
    <AdvisorList
      items={items}
      accent="cyan"
      heading="Frontier Advisor"
      subheading="What your rollable chunks are worth — hope for the top ones"
      caption="by foothold impact"
      icon={<Compass size={13} />}
      maxShown={5}
      maxNames={3}
      emptyLabel="No frontier yet — roll your first chunk to open one."
      onItemClick={(key) => {
        // Same affordance as the Region Advisor: jump to the chunk's continent
        // card in the list below and flash it.
        const region = chunkRegion(key);
        const el = region ? document.querySelector<HTMLElement>(`[data-region-card="${region}"]`) : null;
        if (!el) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        el.classList.add('ring-2', 'ring-cyan-400/70');
        window.setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400/70'), 1800);
      }}
      variant="card"
    />
  );
};

export default FrontierAdvisorPanel;
