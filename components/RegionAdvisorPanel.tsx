import React, { useMemo } from 'react';
import { Map, BookOpen, TrendingUp, Sparkles } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { rankLockedRegions, RankedRegion } from '../utils/regionAdvisor';

/**
 * Dashboard widget: "Which region should I unlock next?"
 *
 * Shows the top 4 locked regions ranked by how many quests + diary tiers
 * they gate-open.  Designed to sit in the Dashboard overview column next to
 * existing stat cards — compact, no interactive chrome, just signal.
 */

const MAX_SHOWN = 4;
const MAX_NAMES = 3;

export const RegionAdvisorPanel: React.FC = () => {
  const { unlocks } = useGame();

  const ranked = useMemo(() => rankLockedRegions(unlocks), [unlocks]);
  const top = ranked.slice(0, MAX_SHOWN);
  const topScore = top[0]?.score ?? 1;

  if (top.length === 0) {
    return (
      <div className="bg-[#151515] border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Map size={14} className="text-amber-400" />
          <h3 className="text-xs font-bold text-amber-300 uppercase tracking-widest">Region Advisor</h3>
        </div>
        <p className="text-[11px] text-gray-600 italic text-center py-2">
          All regions unlocked — impressive!
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#151515] border border-white/10 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Map size={14} className="text-amber-400" />
        <h3 className="text-xs font-bold text-amber-300 uppercase tracking-widest">Region Advisor</h3>
        <span className="ml-auto text-[10px] text-gray-600 font-mono">by unlock count</span>
      </div>
      <p className="text-[10px] text-gray-600 mb-3">
        Unlock these regions for the most forward progress
      </p>

      <div className="space-y-2">
        {top.map((region, idx) => {
          const barPct = topScore > 0 ? Math.round((region.score / topScore) * 100) : 0;
          const hasUnlocks = region.score > 0;

          return (
            <div
              key={region.id}
              className="bg-[#1a1a1a] border border-white/5 rounded-lg px-3 py-2"
            >
              {/* Region name row */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[9px] font-mono text-gray-600 w-3 shrink-0">{idx + 1}.</span>
                <span className="text-[12px] font-semibold text-amber-200 flex-1 truncate">
                  {region.id}
                </span>
                {hasUnlocks && (
                  <span className="text-[9px] font-bold text-amber-500/70 font-mono shrink-0">
                    ×{region.score}
                  </span>
                )}
              </div>

              {hasUnlocks ? (
                <>
                  {/* Impact bar */}
                  <div className="h-[3px] bg-black/40 rounded-full overflow-hidden mb-1.5">
                    <div
                      className="h-full bg-amber-500/50 rounded-full"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  {/* Unlock pills */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {region.newQuestNames.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-900/25 text-blue-300 border border-blue-500/25">
                        <BookOpen size={8} />
                        +{region.newQuestNames.length} quest{region.newQuestNames.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {region.newDiaryIds.length > 0 && (
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/25 text-green-300 border border-green-500/25">
                        <Map size={8} />
                        +{region.newDiaryIds.length} diary tier{region.newDiaryIds.length !== 1 ? 's' : ''}
                      </span>
                    )}

                    {/* Preview quest names */}
                    {region.newQuestNames.slice(0, MAX_NAMES).map((n) => (
                      <span
                        key={n}
                        className="text-[9px] text-gray-600 truncate max-w-[72px]"
                        title={n}
                      >
                        {n}
                      </span>
                    ))}
                    {region.newQuestNames.length > MAX_NAMES && (
                      <span className="text-[9px] text-gray-700">
                        +{region.newQuestNames.length - MAX_NAMES} more
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[9px] text-gray-700 italic">
                  No new quests/diaries gate on this region yet
                </p>
              )}
            </div>
          );
        })}
      </div>

      {ranked.length > MAX_SHOWN && (
        <p className="text-[9px] text-gray-700 text-right mt-2">
          <Sparkles size={8} className="inline mr-0.5" />
          {ranked.length - MAX_SHOWN} more locked regions
        </p>
      )}
    </div>
  );
};
