
import React from 'react';
import { useGame } from '../context/GameContext';
import { STRATEGY_DATABASE, ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { TableType } from '../types';
import { calculateGoalProgress } from '../utils/goalLogic';
import { Pin, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

export const GoalTracker: React.FC = () => {
  const { pinnedGoals, togglePin, unlocks } = useGame();

  if (pinnedGoals.length === 0) return null;

  return (
    <div className="mb-4 space-y-2 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-widest px-1 border-b border-white/5 pb-2">
        <Pin size={12} /> Active Goals
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {pinnedGoals.map(id => {
          let req: ContentRequirement | undefined = STRATEGY_DATABASE[id];

          // Fallback construction for items not in the manual Strategy DB (Quests/Diaries)
          if (!req) {
             const quest = QUEST_DATA[id];
             if (quest) {
                 req = {
                     id: quest.name,
                     category: TableType.QUESTS,
                     regions: quest.regions,
                     skills: quest.skills,
                     quests: quest.prereqs,
                     description: `Series: ${quest.series || 'None'}`
                 };
             } else {
                 const diary = DIARY_DATA[id];
                 if (diary) {
                     req = {
                         id: diary.id,
                         category: TableType.DIARIES,
                         regions: diary.requiredRegions, // Diaries require specific extra regions sometimes
                         skills: diary.skills,
                         quests: diary.quests,
                         description: `Region: ${diary.region} | Difficulty: ${diary.tier}`
                     };
                 }
             }
          }

          if (!req) return null; 

          const progress = calculateGoalProgress(req, unlocks);
          const isComplete = progress.percentage === 100;

          return (
            <div key={id} className={`relative bg-[#1a1a1a] border rounded-lg p-3 group transition-all ${isComplete ? 'border-green-500/30 bg-green-900/5' : 'border-white/10 hover:border-white/20'}`}>
              
              <div className="flex justify-between items-start mb-2">
                <h4 className={`font-bold text-sm leading-tight pr-4 ${isComplete ? 'text-green-400' : 'text-gray-200'}`}>{id}</h4>
                <button 
                  onClick={() => togglePin(id)} 
                  className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
                  title="Unpin"
                >
                  <Trash2 size={14} />
                </button>
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
    </div>
  );
};
