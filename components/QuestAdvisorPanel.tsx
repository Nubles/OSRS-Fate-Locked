import React from 'react';
import { TrendingUp, BookOpen, Map, ArrowDown, Sparkles } from 'lucide-react';
import { RankedQuest } from '../utils/questAdvisor';

/**
 * Quest Impact Advisor panel.
 *
 * Replaces the "Ready Now" strip when the player switches to "High Impact"
 * mode. Shows the top 5 available quests ranked by how many other quests +
 * diary tiers they'd unblock, so ironmen can prioritise the quest that buys
 * the most forward progress.
 *
 * Render:  "+8 quests · +5 diaries"  in small colour-coded pills
 *
 * Clicking a row scrolls to that quest card in the list below (same
 * onItemClick callback the JournalNextUpStrip uses).
 */

const MAX_SHOWN = 5;
const MAX_NAMES = 4; // how many quest names to preview in the tooltip

interface Props {
  ranked: RankedQuest[];
  onItemClick: (id: string) => void;
}

export const QuestAdvisorPanel: React.FC<Props> = ({ ranked, onItemClick }) => {
  const top = ranked.slice(0, MAX_SHOWN);

  if (top.length === 0) {
    return (
      <div className="px-3 pt-3">
        <div className="rounded-lg border border-white/5 bg-gradient-to-r from-violet-900/5 to-transparent p-3 text-center">
          <p className="text-[11px] text-gray-600 italic">
            No available quests to rank — complete some prerequisites first.
          </p>
        </div>
      </div>
    );
  }

  const topScore = top[0]?.score ?? 1;

  return (
    <div className="px-3 pt-3">
      <div className="rounded-lg border border-white/5 bg-gradient-to-r from-violet-900/8 to-transparent p-2.5">

        {/* Header */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <TrendingUp size={11} className="text-violet-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-violet-300">
            High Impact
          </span>
          <span className="text-[10px] text-gray-600 font-mono">
            top {top.length} by unlock count
          </span>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Ranked rows */}
        <div className="space-y-1">
          {top.map((quest, idx) => {
            const barPct = topScore > 0 ? Math.round((quest.score / topScore) * 100) : 0;
            const hasUnlocks = quest.score > 0;

            return (
              <button
                key={quest.id}
                onClick={() => onItemClick(quest.id)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 bg-[#1a1a1a] border border-white/5 rounded-md hover:bg-white/5 hover:border-white/15 transition-all text-left group"
              >
                {/* Rank badge */}
                <span className="text-[9px] font-mono font-bold text-gray-600 w-4 shrink-0 text-right">
                  {idx + 1}.
                </span>

                {/* Quest name + impact bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-gray-100 truncate">
                      {quest.name}
                    </span>
                    {quest.points > 0 && (
                      <span className="text-[9px] text-gray-600 font-mono shrink-0">
                        {quest.points} QP
                      </span>
                    )}
                  </div>

                  {hasUnlocks ? (
                    <>
                      {/* Relative progress bar — widest bar = highest scorer */}
                      <div className="h-[3px] bg-black/40 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-violet-500/60 rounded-full transition-all duration-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>

                      {/* Unlock pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {quest.newQuestNames.length > 0 && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-900/25 text-blue-300 border border-blue-500/25">
                            <BookOpen size={8} />
                            +{quest.newQuestNames.length} quest{quest.newQuestNames.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {quest.newDiaryIds.length > 0 && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-900/25 text-green-300 border border-green-500/25">
                            <Map size={8} />
                            +{quest.newDiaryIds.length} diary tier{quest.newDiaryIds.length !== 1 ? 's' : ''}
                          </span>
                        )}

                        {/* Preview a few quest names that open up */}
                        {quest.newQuestNames.slice(0, MAX_NAMES).map((n) => (
                          <span key={n} className="text-[9px] text-gray-600 truncate max-w-[80px]" title={n}>
                            {n}
                          </span>
                        ))}
                        {quest.newQuestNames.length > MAX_NAMES && (
                          <span className="text-[9px] text-gray-700 shrink-0">
                            +{quest.newQuestNames.length - MAX_NAMES} more
                          </span>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-[9px] text-gray-700 italic">
                      No new unlocks — but available to complete
                    </p>
                  )}
                </div>

                {/* Arrow CTA */}
                <ArrowDown
                  size={11}
                  className="text-gray-600 group-hover:text-violet-400 rotate-[-45deg] transition-all shrink-0"
                />
              </button>
            );
          })}
        </div>

        {/* Footer hint */}
        {ranked.length > MAX_SHOWN && (
          <p className="text-[9px] text-gray-700 text-right mt-1.5 pr-1">
            <Sparkles size={8} className="inline mr-0.5" />
            {ranked.length - MAX_SHOWN} more available — scroll to find them
          </p>
        )}
      </div>
    </div>
  );
};
