import React from 'react';
import { Check, Lock } from 'lucide-react';
import type { ChunkEntrance } from '../services/ChunkContentService';
import { WikiLink } from './WikiLink';

interface Props {
  mode: 'chunk' | 'region';
  entrances: ChunkEntrance[];
  unlocked: boolean;
}

export const ChunkEntranceNotices: React.FC<Props> = ({ mode, entrances, unlocked }) => {
  if (mode === 'region' || entrances.length === 0) return null;

  const state = unlocked ? 'available' : 'locked with this chunk';
  const rowClass = unlocked
    ? 'mt-2 px-2 py-1 rounded bg-emerald-950/40 border border-emerald-700/30 text-emerald-300/90 text-[10px] flex items-start gap-1.5'
    : 'mt-2 px-2 py-1 rounded bg-amber-950/50 border border-amber-700/40 text-amber-300/90 text-[10px] flex items-start gap-1.5';
  const Icon = unlocked ? Check : Lock;

  return (
    <>
      {entrances.map(entrance => (
        <div key={`${entrance.location}/${entrance.label}`} className={rowClass}>
          <Icon size={10} className="shrink-0 mt-px" />
          <div>
            <div>
              <WikiLink name={entrance.location} page={entrance.wikiPage}>
                {entrance.label}
              </WikiLink>
              {' — '}{state}
            </div>
            {entrance.requirements.length > 0 && (
              <div className="mt-0.5 text-amber-200/90">
                Also requires: {entrance.requirements.join(', ')}
              </div>
            )}
          </div>
        </div>
      ))}
    </>
  );
};
