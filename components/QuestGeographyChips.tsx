import React from 'react';
import { Map, MapPin } from 'lucide-react';
import type { QuestGeographyDisplay } from '../utils/questGeographyDisplay';

interface QuestGeographyChipsProps {
  display: QuestGeographyDisplay;
  completed: boolean;
  evidence: readonly string[];
  onShowChunk: (cx: number, cy: number) => void;
}

const requirementClass = (met: boolean) =>
  'text-[10px] px-1.5 rounded flex items-center gap-1 border ' +
  (met
    ? 'bg-black/30 text-gray-500 border-white/5'
    : 'bg-red-900/10 text-red-400 border-red-500/20');

export const QuestGeographyChips: React.FC<QuestGeographyChipsProps> = ({
  display, completed, evidence, onShowChunk,
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
      </span>
    ))}
    {display.knownSteps.length > 0 && (
      <div className="contents" data-quest-known-steps>
        <span className="text-[9px] uppercase tracking-wide text-cyan-300/70">
          Known steps
        </span>
        {display.knownSteps.slice(0, 4).map(step => (
          <button
            key={`${step.cx},${step.cy}`}
            onClick={event => {
              event.stopPropagation();
              onShowChunk(step.cx, step.cy);
            }}
            className={`text-[10px] px-1.5 rounded flex items-center gap-1 border ${
              step.unlocked
                ? 'bg-emerald-900/10 text-emerald-400/80 border-emerald-500/20'
                : 'bg-red-900/10 text-red-400 border-red-500/30'
            }`}
            title={`${step.label} — ${step.unlocked ? 'unlocked' : 'locked'} (show on map)`}
          >
            <MapPin size={8} />
            {step.subArea ?? step.region ?? step.label}
            {step.role === 'first' && <span className="text-cyan-300/80">★</span>}
          </button>
        ))}
        {display.knownSteps.length > 4 && (
          <span className="text-[10px] px-1 text-gray-600">
            +{display.knownSteps.length - 4}
          </span>
        )}
      </div>
    )}
  </>
);
