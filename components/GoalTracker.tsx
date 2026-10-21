
import React, { Suspense, useEffect, useState } from 'react';
import { useGame } from '../context/GameContext';
import { STRATEGY_DATABASE, ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { TableType } from '../types';
import { calculateGoalProgress, GoalProgress } from '../utils/goalLogic';
import { evaluateDiaryTierEligibility } from '../utils/journalStatus';
import { Pin, Trash2, CheckCircle2, AlertCircle, Route } from 'lucide-react';
import { enforcedQuestAreas } from '../utils/questGeographyDisplay';
import { importWithRetry, lazyWithRetry } from '../utils/lazyRetry';

// The Resource Engine (its 3,800-item table) and the route planner load only
// when a pinned goal needs them, not for every run that pins a quest.
type ResourceEngine = typeof import('../utils/supplyChain');
const loadResourceEngine = () => importWithRetry(() => import('../utils/supplyChain'));
const GoalRouteView = lazyWithRetry(() => import('./GoalRouteView').then(m => ({ default: m.GoalRouteView })));

/** The requirement a quest or strategy goal is measured against, if it is one. */
const goalRequirement = (id: string): ContentRequirement | undefined => {
  const quest = QUEST_DATA[id];
  // Quest facts and readiness always come from the canonical journal.
  if (quest) {
    return {
      id: quest.id,
      category: TableType.QUESTS,
      regions: enforcedQuestAreas(quest),
      skills: quest.skills,
      quests: quest.prereqs,
      description: `Series: ${quest.series || 'None'}`
    };
  }
  return STRATEGY_DATABASE[id];
};

/** A pinned goal that is no diary, quest or strategy entry can only be a Resource Engine item. */
export const goalNeedsResourceEngine = (id: string): boolean => !DIARY_DATA[id] && !goalRequirement(id);

export const GoalTracker: React.FC = () => {
  const gameState = useGame();
  const { pinnedGoals, togglePin, unlocks, gameModeId } = gameState;
  // Which pinned goal has its full route expanded (one at a time keeps it tidy).
  const [routeFor, setRouteFor] = useState<string | null>(null);
  const needsEngine = pinnedGoals.some(goalNeedsResourceEngine);
  const [engine, setEngine] = useState<ResourceEngine | null>(null);
  const [engineError, setEngineError] = useState<unknown>(null);
  useEffect(() => {
    if (!needsEngine || engine) return;
    let live = true;
    loadResourceEngine().then(
      module => { if (live) setEngine(module); },
      error => { if (live) setEngineError(error); },
    );
    return () => { live = false; };
  }, [needsEngine, engine]);
  // A failed load goes to the error boundary, as a failed tracker chunk did.
  if (engineError) throw engineError;

  // Wait for the engine so the cards appear together, as before.
  if (pinnedGoals.length === 0 || (needsEngine && !engine)) return null;

  return (
    <div className="mb-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
      {pinnedGoals.length > 0 && (
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest px-1 border-b border-white/5 pb-2">
          <Pin size={12} /> Active Goals
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {pinnedGoals.map(id => {
          const req = goalRequirement(id);
          const diary = DIARY_DATA[id];

          // Final fallback: a Resource Engine item. Engine items don't fit
          // ContentRequirement (they're gated by per-source unlock IDs the
          // strategy schema doesn't model), so we compute progress via the
          // engine's own analyzer and feed the same GoalProgress shape back.
          let progress: GoalProgress;
          let description: string | undefined;
          if (diary) {
            const eligibility = evaluateDiaryTierEligibility(diary, unlocks, gameModeId);
            const total = eligibility.evidence.length + eligibility.blockers.length + eligibility.manualChecks.length;
            progress = {
              percentage: eligibility.eligible || eligibility.status === 'COMPLETED'
                ? 100
                : total === 0 ? 0 : Math.min(99, Math.round((eligibility.evidence.length / total) * 100)),
              missing: [...eligibility.blockers.map(blocker => blocker.label), ...eligibility.manualChecks.map(check => 'Confirm: ' + check)],
              totalSteps: total,
              completedSteps: eligibility.evidence.length,
            };
            description = `Region: ${diary.region} | Difficulty: ${diary.tier}`;
          } else if (req) {
            progress = calculateGoalProgress(req, unlocks, gameModeId);
            description = req.description;
          } else if (engine) {
            // Not in the engine's table either: no card, as before.
            const engineProgress = engine.calculateEngineItemProgress(id, gameState);
            if (!engineProgress) return null;
            progress = engineProgress;
            description = 'Resource Engine item';
          } else {
            return null;
          }

          const isComplete = progress.percentage === 100;

          return (
            <div key={id} className={`relative bg-[#1a1a1a] border rounded-lg p-3 group transition-all ${isComplete ? 'border-green-500/30 bg-green-900/5' : 'border-white/10 hover:border-white/20'}`}>
              
              <div className="flex justify-between items-start mb-2">
                <h4 className={`font-bold text-sm leading-tight pr-4 ${isComplete ? 'text-green-400' : 'text-gray-200'}`}>{id}</h4>
                <div className="absolute top-2 right-2 flex items-center gap-1">
                  <button
                    onClick={() => setRouteFor(r => (r === id ? null : id))}
                    className={`transition-colors ${routeFor === id ? 'text-cyan-300' : 'text-gray-600 hover:text-cyan-300'}`}
                    title={routeFor === id ? 'Hide route' : 'Show route to goal'}
                    aria-label="Toggle route to goal"
                  >
                    <Route size={14} />
                  </button>
                  <button
                    onClick={() => togglePin(id)}
                    className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Unpin"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 w-full bg-black/50 rounded-full overflow-hidden mb-2">
                <div 
                  className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : progress.percentage > 75 ? 'bg-green-600' : progress.percentage > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              {/* Missing Requirements Text */}
              <div className="text-[10px] text-gray-500 font-mono min-h-[1.5em] flex items-center">
                {isComplete ? (
                  <span className="flex items-center gap-1 text-green-500"><CheckCircle2 size={10} /> Ready to play</span>
                ) : (
                  <div className="flex items-start gap-1 text-red-400/80 w-full overflow-hidden" title={progress.missing.join('\n')}>
                    <AlertCircle size={10} className="mt-0.5 shrink-0" />
                    <span className="truncate w-full">{progress.missing[0]} {progress.missing.length > 1 ? `+${progress.missing.length - 1} more` : ''}</span>
                  </div>
                )}
              </div>

            </div>
          );
        })}
      </div>

      {/* Expanded "route to goal" planning view for the selected pin. */}
      {routeFor && pinnedGoals.includes(routeFor) && (
        <Suspense fallback={null}><GoalRouteView goalId={routeFor} /></Suspense>
      )}
    </div>
  );
};
