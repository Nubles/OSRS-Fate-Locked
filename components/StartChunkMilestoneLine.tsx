import React from 'react';
import { useGame } from '../context/GameContext';
import { startChunkMilestone, startChunkMilestoneText } from '../utils/startChunkMilestone';

/**
 * Classic Spend Keys: progress to the next start-chunk Key while a Chunked
 * run holds only its start chunk. Loaded lazily, with the Chunked panels.
 */
export const StartChunkMilestoneLine: React.FC = () => {
  const { gameModeId, unlocks } = useGame();
  const totalLevel = Object.values(unlocks.levels).reduce((a, b) => a + b, 0);
  const milestone = startChunkMilestone(gameModeId, unlocks, totalLevel);
  if (!milestone) return null;
  return (
    <p data-testid="start-chunk-milestone" className="mb-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-[11px] font-mono leading-snug text-amber-200/80">
      {startChunkMilestoneText(milestone)}
    </p>
  );
};
