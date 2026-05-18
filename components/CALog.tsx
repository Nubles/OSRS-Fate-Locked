
import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { CA_DATA, CATier } from '../data/caData';
import { ALL_CA_TASKS, CATask } from '../data/caTasks';
import { Swords, CheckCircle2, Sparkles, Skull, Info, ChevronDown, CheckSquare, Square, Lock, ExternalLink } from 'lucide-react';
import { DROP_RATES } from '../config/rules';

interface CALogProps {
  searchTerm?: string;
}

export const CALog: React.FC<CALogProps> = ({ searchTerm = '' }) => {
  const { unlocks, toggleCA, rollForKey, toggleTask } = useGame();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getWikiUrl = (monster: string) => {
    if (monster === 'General') return 'https://oldschool.runescape.wiki/w/Combat_Achievements';
    return `https://oldschool.runescape.wiki/w/${encodeURIComponent(monster.replace(/ /g, '_'))}`;
  };

  const handleToggle = (e: React.MouseEvent, ca: CATier) => {
      e.stopPropagation();
      const isCompleting = !unlocks.cas.includes(ca.id);
      
      if (!isCompleting) return; // Prevent un-completing once done

      if (isCompleting) {
          const tasks = ALL_CA_TASKS.filter(t => t.tierId === ca.id);
          // If tasks exist, require them all to be complete
          if (tasks.length > 0) {
              const allDone = tasks.every(t => unlocks.completedTasks.includes(t.id));
              if (!allDone) {
                  alert("You must complete all individual tasks in this tier first.");
                  return;
              }
          }

          toggleCA(ca.id);
          // Removed guaranteed key roll for tier completion
      }
  };

  const handleTaskToggle = (task: CATask, ca: CATier, e: React.MouseEvent) => {
      e.stopPropagation();
      
      // Prevent toggling tasks if the CA tier is already complete
      if (unlocks.cas.includes(ca.id)) {
          return;
      }

      // Prevent unchecking if already completed
      if (unlocks.completedTasks.includes(task.id)) {
          return;
      }

      const isCompleting = !unlocks.completedTasks.includes(task.id);
      toggleTask(task.id);

      if (isCompleting) {
          // 1. Single Task Roll
          const rate = DROP_RATES[ca.difficulty];
          rollForKey(ca.difficulty, rate, e.clientX, e.clientY);

          // 2. Check for Full Section Completion
          const tierTasks = ALL_CA_TASKS.filter(t => t.tierId === ca.id);
          const otherTasksDone = tierTasks.every(t => t.id === task.id || unlocks.completedTasks.includes(t.id));
          
          if (otherTasksDone) {
              // If the tier is not yet marked complete
              if (!unlocks.cas.includes(ca.id)) {
                  toggleCA(ca.id);
                  // Removed guaranteed key roll for tier completion
              }
          }
      }
  };

  const getStyle = (id: string) => {
      switch(id) {
          case 'Easy': return 'border-green-500/50 text-green-400';
          case 'Medium': return 'border-blue-500/50 text-blue-400';
          case 'Hard': return 'border-red-500/50 text-red-400';
          case 'Elite': return 'border-purple-500/50 text-purple-400';
          case 'Master': return 'border-amber-500/50 text-amber-400';
          case 'Grandmaster': return 'border-yellow-400/50 text-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.2)]';
          default: return 'border-gray-500 text-gray-400';
      }
  };

  const filteredCAs = Object.values(CA_DATA).filter(ca => {
      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      // Match Tier ID
      if (ca.id.toLowerCase().includes(lowerSearch)) return true;
      // Match Tasks inside
      const tasks = ALL_CA_TASKS.filter(t => t.tierId === ca.id);
      return tasks.some(t => t.monster.toLowerCase().includes(lowerSearch) || t.description.toLowerCase().includes(lowerSearch));
  });

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-[#1a1a1a] shrink-0">
          <h2 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <Swords size={18} /> Combat Achievements
          </h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {filteredCAs.map(ca => {
            const isCompleted = unlocks.cas.includes(ca.id);
            const style = getStyle(ca.id);
            const isSearching = searchTerm.length > 0;
            const isExpanded = expandedId === ca.id || isSearching;
            
            // Get tasks
            const tasks = ALL_CA_TASKS.filter(t => t.tierId === ca.id);
            const hasTasks = tasks.length > 0;
            const tasksCompletedCount = tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
            
            // Determine if actionable (can complete manually if all tasks done or no tasks)
            const allTasksDone = !hasTasks || tasksCompletedCount === tasks.length;
            const isActionable = isCompleted || allTasksDone; 

            return (
                <div key={ca.id} className={`relative border rounded-lg transition-all group ${isCompleted ? 'bg-green-900/10 border-green-500/30 opacity-60' : `bg-[#1a1a1a] ${style}`}`}>
                    <div 
                        className="p-4 flex justify-between items-start cursor-pointer"
                        onClick={() => setExpandedId(isExpanded && !isSearching ? null : ca.id)}
                    >
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h3 className={`font-bold text-lg ${isCompleted ? 'text-gray-400 line-through' : 'text-white'}`}>{ca.id} Tier</h3>
                                <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded border border-white/10 text-gray-400 font-mono">{ca.pointsRequired} Pts</span>
                                {hasTasks && (
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        {tasksCompletedCount}/{tasks.length}
                                    </span>
                                )}
                            </div>
                            
                            {!isExpanded && (
                                <div className="text-xs text-gray-400 mb-2 font-mono">
                                    Rec: {ca.recommendedStats}
                                </div>
                            )}

                            {!isExpanded && (
                                <div className="flex flex-wrap gap-1">
                                    {ca.keyUnlocks.map(boss => {
                                        const unlocked = unlocks.bosses.includes(boss);
                                        return (
                                            <span key={boss} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${unlocked ? 'bg-green-900/20 text-green-400 border-green-500/20' : 'bg-red-900/20 text-red-400 border-red-500/20'}`}>
                                                <Skull size={8} /> {boss}
                                            </span>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            <button 
                                onClick={(e) => handleToggle(e, ca)}
                                disabled={isCompleted}
                                className={`w-10 h-10 flex items-center justify-center rounded-full border transition-all shrink-0 z-10 
                                    ${isCompleted ? 'bg-green-500 text-black border-green-400 cursor-default' : 
                                      isActionable ? 'bg-black/40 text-gray-600 border-gray-700 hover:border-gray-500 hover:text-gray-400' :
                                      'bg-black/20 text-gray-700 border-gray-800 cursor-not-allowed opacity-50'}`}
                                title={isCompleted ? "Completed" : isActionable ? "Complete Full Tier" : "Complete all tasks first"}
                            >
                                {isCompleted ? <CheckCircle2 size={20} /> : isActionable ? <Sparkles size={18} /> : <Lock size={16} />}
                            </button>
                            {hasTasks && <ChevronDown size={16} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                        </div>
                    </div>

                    {/* Task List */}
                    {isExpanded && hasTasks && (
                        <div className="border-t border-white/10 bg-black/20 p-2 space-y-1">
                            {tasks.map(task => {
                                const isTaskDone = unlocks.completedTasks.includes(task.id);
                                if (searchTerm && !task.description.toLowerCase().includes(searchTerm.toLowerCase()) && !task.monster.toLowerCase().includes(searchTerm.toLowerCase()) && !ca.id.toLowerCase().includes(searchTerm.toLowerCase())) return null;

                                return (
                                    <button 
                                        key={task.id}
                                        onClick={(e) => handleTaskToggle(task, ca, e)}
                                        disabled={isCompleted || isTaskDone}
                                        className={`w-full flex items-start gap-3 p-2 rounded text-left group ${(isCompleted || isTaskDone) ? 'cursor-default opacity-70' : 'hover:bg-white/5 cursor-pointer'}`}
                                    >
                                        <div className={`mt-0.5 ${isTaskDone ? 'text-green-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                            {isTaskDone ? <CheckSquare size={14} /> : <Square size={14} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-[10px] uppercase font-bold text-gray-500 bg-white/5 px-1.5 rounded">{task.monster}</span>
                                                <a 
                                                    href={getWikiUrl(task.monster)} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                                    onClick={(e) => e.stopPropagation()}
                                                    title="Open Wiki"
                                                >
                                                    <ExternalLink size={10} />
                                                </a>
                                            </div>
                                            <span className={`text-xs ${isTaskDone ? 'text-gray-400 line-through' : 'text-gray-300'}`}>{task.description}</span>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    )}
                    {isExpanded && !hasTasks && (
                        <div className="border-t border-white/10 bg-black/20 p-4 text-center text-xs text-gray-600 italic">
                            Tasks data not loaded for this tier yet.
                        </div>
                    )}
                </div>
            );
        })}
      </div>
    </div>
  );
};
