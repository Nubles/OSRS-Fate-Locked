import React, { useEffect, useMemo, useState } from 'react';
import { MapPin } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { chunkContentService, EntityKind } from '../services/ChunkContentService';
import { summarisePlaces, showChunkOnMap } from '../utils/chunkLocations';

/**
 * "Where is it?" chips for any game entity (monster / object / NPC / item
 * spawn / shop / quest), resolved from the chunk dataset: each named place,
 * green when the player can already go there, red when locked. Clicking a
 * chip jumps to that chunk on the World map.
 */
interface Props {
  name: string;
  kinds?: EntityKind[];
  /** Max place chips before "+N more". */
  cap?: number;
  className?: string;
}

export const EntityLocations: React.FC<Props> = ({ name, kinds, cap = 4, className }) => {
  const { unlocks } = useGame();
  const [, setTick] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!chunkContentService.ready) chunkContentService.init().then(() => setTick(t => t + 1));
  }, []);

  const places = useMemo(() => {
    if (!chunkContentService.ready) return null;
    const hit = chunkContentService.entityLocations(name, kinds);
    if (!hit) return [];
    return summarisePlaces(hit.locations, unlocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, kinds?.join(','), unlocks, chunkContentService.ready]);

  if (!places || places.length === 0) return null;

  const shown = expanded ? places : places.slice(0, cap);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className ?? ''}`}>
      <MapPin size={9} className="text-gray-600 shrink-0" />
      {shown.map(p => (
        <button
          key={p.label}
          onClick={(e) => { e.stopPropagation(); showChunkOnMap(p.cx, p.cy); }}
          className={`text-[9px] px-1.5 py-px rounded border transition-colors ${
            p.unlocked
              ? 'bg-emerald-950/60 border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/60'
              : 'bg-red-950/40 border-red-800/30 text-red-300/80 hover:bg-red-900/40'
          }`}
          title={`${p.label} — ${p.unlocked ? 'unlocked' : 'locked'} · click to view on map`}
        >
          {p.label}
        </button>
      ))}
      {places.length > cap && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(x => !x); }}
          className="text-[9px] text-cyan-400/80 hover:text-cyan-300"
        >
          {expanded ? 'less' : `+${places.length - cap}`}
        </button>
      )}
    </span>
  );
};
