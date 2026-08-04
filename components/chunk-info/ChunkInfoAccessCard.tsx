import React from 'react';
import { Check, Landmark, Lock, Route } from 'lucide-react';
import type { ChunkEntrance } from '../../services/ChunkContentService';
import { WikiLink } from '../WikiLink';

export type ChunkInfoBankState = 'present' | 'available' | 'locked' | null;

interface Props {
  previewLocked: boolean;
  entryRequirements: string[];
  entrances: ChunkEntrance[];
  chunkUnlocked: boolean;
  bankState: ChunkInfoBankState;
}

const rowClass = 'flex items-start gap-2 py-1.5 text-[10px] text-gray-300';
const detailClass = 'mt-0.5 block text-[9px] text-gray-500';

export const ChunkInfoAccessCard: React.FC<Props> = ({
  previewLocked,
  entryRequirements,
  entrances,
  chunkUnlocked,
  bankState,
}) => {
  if (
    !previewLocked
    && entryRequirements.length === 0
    && entrances.length === 0
    && bankState === null
  ) {
    return null;
  }

  return (
    <section
      className="mt-2.5 rounded-lg border border-cyan-900/60 bg-cyan-950/20 px-2.5 py-2"
      aria-labelledby="chunk-info-access-heading"
    >
      <h4
        id="chunk-info-access-heading"
        className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-cyan-300/90"
      >
        Access &amp; facilities
      </h4>

      {previewLocked && (
        <div className={rowClass}>
          <Lock size={11} className="mt-px shrink-0 text-rose-300" />
          <span>
            Preview only
            <span className={detailClass}>Unlock this chunk before using its content.</span>
          </span>
        </div>
      )}

      {entryRequirements.length > 0 && (
        <div className={rowClass}>
          <Lock size={11} className="mt-px shrink-0 text-purple-300" />
          <span>
            Entry requirement
            <span className={detailClass}>{entryRequirements.join(', ')}</span>
          </span>
        </div>
      )}

      {entrances.map(entrance => (
        <div key={`${entrance.location}/${entrance.label}`} className={rowClass}>
          {chunkUnlocked ? (
            <Check size={11} className="mt-px shrink-0 text-emerald-300" />
          ) : (
            <Route size={11} className="mt-px shrink-0 text-rose-300" />
          )}
          <span>
            <WikiLink name={entrance.location} page={entrance.wikiPage}>
              {entrance.label}
            </WikiLink>
            <span className={detailClass}>
              {chunkUnlocked ? 'Available in this chunk' : 'Locked with this chunk'}
            </span>
            {entrance.requirements.length > 0 && (
              <span className={detailClass}>
                Also requires {entrance.requirements.join(', ')}
              </span>
            )}
          </span>
        </div>
      ))}

      {bankState && (
        <div className={rowClass}>
          <Landmark
            size={11}
            className={`mt-px shrink-0 ${bankState === 'locked' ? 'text-rose-300' : 'text-emerald-300'}`}
          />
          <span>
            {bankState === 'locked'
              ? 'Bank needs its own unlock'
              : bankState === 'available'
                ? 'Bank available'
                : 'Bank in this chunk'}
          </span>
        </div>
      )}
    </section>
  );
};
