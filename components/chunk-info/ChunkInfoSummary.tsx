import React from 'react';
import type { ChunkInfoDrawerSummary } from './chunkInfoPresentation';

export const ChunkInfoSummary: React.FC<{ summary: ChunkInfoDrawerSummary }> = ({ summary }) => {
  const tiles = summary.kind === 'availability'
    ? [
        { value: summary.available, label: 'Available now', tone: 'text-emerald-300' },
        { value: summary.locked, label: 'Needs unlocks', tone: 'text-rose-300' },
      ]
    : [
        { value: summary.indexedActivities, label: 'Indexed activities', tone: 'text-cyan-200' },
        { value: summary.groups, label: 'Content groups', tone: 'text-gray-200' },
      ];

  return (
    <div role="group" className="grid grid-cols-2 gap-2 pt-2.5" aria-label={summary.kind === 'availability' ? 'Chunk availability summary' : 'Chunk indexed content summary'}>
      {tiles.map(tile => (
        <div key={tile.label} className="rounded-lg border border-white/10 bg-white/[0.035] px-2.5 py-2">
          <strong className={`block text-lg leading-none ${tile.tone}`}>{tile.value}</strong>
          <span className="mt-1 block text-[9px] text-gray-500">{tile.label}</span>
        </div>
      ))}
    </div>
  );
};
