import React from 'react';
import { showChunkOnMap } from '../utils/chunkLocations';
import { Map, MapPin } from 'lucide-react';
import type { QuestGeographyDisplay } from '../utils/questGeographyDisplay';

interface QuestGeographyChipsProps {
  display: QuestGeographyDisplay;
  completed: boolean;
  evidence: readonly string[];
}

const requirementClass = (met: boolean) =>
  'text-[10px] px-1.5 rounded flex items-center gap-1 border ' +
  (met
    ? 'bg-black/30 text-gray-500 border-white/5'
    : 'bg-red-900/10 text-red-400 border-red-500/20');

export const QuestGeographyChips: React.FC<QuestGeographyChipsProps> = ({
  display, completed, evidence,
}) => (
  <>
    {display.regions.map(region => (
      <span
        key={`region:${region}`}
        className={requirementClass(completed || evidence.includes(region))}
      >
        <Map size={8} /> {region}
      </span>
    ))}
    {display.locations.map(location => (
      <span
        key={`location:${location.id}`}
        className={requirementClass(
          completed || evidence.includes(location.label),
        )}
      >
        <MapPin size={8} /> {location.label}
        {location.chunkOptions.map((coord, index) => (
          <React.Fragment key={`${coord.cx},${coord.cy}`}>
            {index > 0 && <span>or</span>}
            <button type="button" onClick={event => { event.stopPropagation(); showChunkOnMap(coord.cx, coord.cy); }}
              className="underline decoration-dotted" title={`Show chunk (${coord.cx}, ${coord.cy}) on map`}>
              ({coord.cx}, {coord.cy})
            </button>
          </React.Fragment>
        ))}
      </span>
    ))}
    {display.routeGroups?.map(group => (
      <details key={`route:${group.id}`} className={requirementClass(completed || evidence.includes(group.label))}>
        <summary className="cursor-pointer">{group.label} · One complete route</summary>
        {group.routes.map(route => (
          <div key={route.id} className="py-1">
            <span>{route.label}: </span>
            {route.locations.length ? route.locations.map((location, index) => (
              <React.Fragment key={location.id}>
                {index > 0 && <span> + </span>}{location.label}{' '}
                {location.chunkOptions.map((coord, optionIndex) => (
                  <React.Fragment key={`${coord.cx},${coord.cy}`}>
                    {optionIndex > 0 && <span> or </span>}
                    <button type="button" onClick={event => {event.stopPropagation(); showChunkOnMap(coord.cx, coord.cy);}}
                      className="underline decoration-dotted" title={`Show chunk (${coord.cx}, ${coord.cy}) on map`}>({coord.cx}, {coord.cy})</button>
                  </React.Fragment>
                ))}
              </React.Fragment>
            )) : <span>Direct access</span>}
          </div>
        ))}
      </details>
    ))}
    {/* Partial route evidence remains in the geography model for RuneProof. */}
  </>
);
