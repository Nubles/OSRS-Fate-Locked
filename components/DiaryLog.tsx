
import React, { useMemo, useState } from 'react';
import { useGame } from '../context/GameContext';
import { DIARY_DATA, DiaryTier } from '../data/diaryData';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { Map, CheckCircle2, Lock, Sparkles, BookOpen, ChevronDown, CheckSquare, Square, ExternalLink } from 'lucide-react';
import { DROP_RATES } from '../config/rules';
import { MISTHALIN_AREAS } from '../constants';

interface DiaryLogProps {
  searchTerm?: string;
}

export const DiaryLog: React.FC<DiaryLogProps> = ({ searchTerm = '' }) => {
  const { unlocks, toggleDiary, rollForKey, toggleTask } = useGame();
  const [filterRegion, setFilterRegion] = useState('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getStatus = (diary: DiaryTier) => {
    if (unlocks.diaries.includes(diary.id)) return 'COMPLETED';
    
    const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === diary.id);
    
    // If we have tasks, determine status based on task accessibility
    if (tasks.length > 0) {
        // Check Region Lock: Are ALL tasks region locked?
        const allTasksRegionLocked = tasks.every(t => {
            if (!t.regions || t.regions.length === 0) return false;
            return t.regions.every(r => {
                const isMisthalin = r === 'Misthalin' || MISTHALIN_AREAS.includes(r);
                return !isMisthalin && !unlocks.regions.includes(r);
            });
        });
        if (allTasksRegionLocked) return 'LOCKED_REGION';

        // Check Skill Lock: Are ALL tasks skill locked? (Optional, but good for consistency)
        // For now, we'll keep the top-level simpler and rely on the existing behavior 
        // or just default to AVAILABLE if at least one task is region-accessible.
        
        // We can still check the DiaryTier object's explicit skills if we want, 
        // but often the tasks are the source of truth. 
        // Let's assume if regions are accessible, it's "AVAILABLE" (even if skills are low),
        // because you can technically "see" it.
    } else {
        // Fallback for empty/data-less diaries (shouldn't happen with full data)
        // Check Regions on Tier Object
        if (diary.requiredRegions.some(r => {
             // Handle Group Names or Specifics
             const isMisthalin = r === 'Misthalin' || MISTHALIN_AREAS.includes(r);
             const isUnlocked = isMisthalin || unlocks.regions.includes(r);
             // If r is a group name like 'Kandarin' and not in unlocks, this returns true (locked),
             // which is the bug we wanted to avoid if we rely solely on this. 
             // But since we prioritize tasks above, this fallback is minor.
             return !isUnlocked; 
        })) return 'LOCKED_REGION';
    }

    // Check Quests (Tier level)
    const missingQuests = diary.quests.some(qid => !unlocks.quests.includes(qid));
    if (missingQuests) return 'LOCKED_QUEST';

    return 'AVAILABLE';
  };

  const getDiaryWikiLink = (tierId: string) => {
    const [region, tier] = tierId.split(' ');
    const map: Record<string, string> = {
        'Ardougne': 'Ardougne_Diary',
        'Desert': 'Desert_Diary',
        'Falador': 'Falador_Diary',
        'Fremennik': 'Fremennik_Diary',
        'Kandarin': 'Kandarin_Diary',
        'Karamja': 'Karamja_Diary',
        'Kourend': 'Kourend_%26_Kebos_Diary',
        'Lumbridge': 'Lumbridge_%26_Draynor_Diary',
        'Morytania': 'Morytania_Diary',
        'Varrock': 'Varrock_Diary',
        'Western': 'Western_Provinces_Diary',
        'Wilderness': 'Wilderness_Diary'
    };
    const page = map[region] || 'Achievement_Diary';
    return `https://oldschool.runescape.wiki/w/${page}#${tier}`;
  };

  const diaries = useMemo(() => {
    return Object.values(DIARY_DATA).map(d => ({ ...d, status: getStatus(d) })).sort((a, b) => {
        const score = (s: string) => s === 'AVAILABLE' ? 0 : s.includes('LOCKED') ? 1 : 2;
        return score(a.status) - score(b.status) || a.id.localeCompare(b.id);
    });
  }, [unlocks]);

  const filteredDiaries = diaries.filter(d => {
      const matchesRegion = filterRegion === 'ALL' || d.region === filterRegion;
      
      if (!matchesRegion) return false;
      if (!searchTerm) return true;

      const lowerSearch = searchTerm.toLowerCase();
      if (d.id.toLowerCase().includes(lowerSearch)) return true;
      
      const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === d.id);
      return tasks.some(t => t.description.toLowerCase().includes(lowerSearch));
  });

  const regions = Array.from(new Set(Object.values(DIARY_DATA).map(d => d.region))).sort();

  const handleToggle = (e: React.MouseEvent, diary: DiaryTier) => {
      e.stopPropagation();
      const isCompleting = !unlocks.diaries.includes(diary.id);
      
      if (!isCompleting) return; 

      if (isCompleting) {
          const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === diary.id);
          if (tasks.length > 0) {
              const allDone = tasks.every(t => unlocks.completedTasks.includes(t.id));
              if (!allDone) {
                  alert("You must complete all individual tasks in this section first.");
                  return;
              }
          }

          toggleDiary(diary.id);
      }
  };

  const handleTaskToggle = (task: DiaryTask, diary: DiaryTier, e: React.MouseEvent) => {
      e.stopPropagation();
      
      if (unlocks.diaries.includes(diary.id)) return;
      if (unlocks.completedTasks.includes(task.id)) return;

      const isCompleting = !unlocks.completedTasks.includes(task.id);
      toggleTask(task.id);

      if (isCompleting) {
          const rate = DROP_RATES[diary.difficulty];
          rollForKey(diary.difficulty, rate, e.clientX, e.clientY);

          const tierTasks = ALL_DIARY_TASKS.filter(t => t.tierId === diary.id);
          const otherTasksDone = tierTasks.every(t => t.id === task.id || unlocks.completedTasks.includes(t.id));
          
          if (otherTasksDone) {
              if (!unlocks.diaries.includes(diary.id)) {
                  toggleDiary(diary.id); 
              }
          }
      }
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-white/10 bg-[#1a1a1a] shrink-0 flex gap-2 overflow-x-auto">
          <select 
            className="bg-[#222] border border-white/10 rounded px-2 py-1 text-xs text-gray-300 focus:border-green-500/50 outline-none"
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
          >
              <option value="ALL" className="bg-[#222]">All Regions</option>
              {regions.map(r => <option key={r} value={r} className="bg-[#222]">{r}</option>)}
          </select>
          <div className="text-xs text-gray-500 ml-auto flex items-center">
              {unlocks.diaries.length} Completed
          </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {filteredDiaries.map(diary => {
          const isCompleted = diary.status === 'COMPLETED';
          const isAvailable = diary.status === 'AVAILABLE';
          const isSearching = searchTerm.length > 0;
          const isExpanded = expandedId === diary.id || isSearching;
          const color = diary.tier === 'Elite' ? 'text-purple-400' : diary.tier === 'Hard' ? 'text-red-400' : diary.tier === 'Medium' ? 'text-blue-400' : 'text-green-400';
          
          const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === diary.id);
          const hasTasks = tasks.length > 0;
          const tasksCompletedCount = tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;
          
          const allTasksDone = !hasTasks || tasksCompletedCount === tasks.length;
          const isActionable = isCompleted || allTasksDone;

          return (
            <div 
              key={diary.id} 
              className={`relative border rounded-lg transition-all ${isCompleted ? 'bg-green-900/10 border-green-500/20 opacity-60' : isAvailable ? 'bg-green-900/10 border-green-500/40' : 'bg-[#1a1a1a] border-white/5 opacity-80'}`}
            >
              <div 
                className="p-3 flex justify-between items-start gap-4 cursor-pointer hover:bg-white/5"
                onClick={() => setExpandedId(isExpanded && !isSearching ? null : diary.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className={`font-bold text-sm truncate ${isCompleted ? 'text-green-400 line-through' : 'text-gray-200'}`}>
                      {diary.id}
                    </h3>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase tracking-wide ${color} border-current opacity-70`}>
                      {diary.tier}
                    </span>
                    {hasTasks && (
                        <span className="text-[9px] text-gray-500 font-mono ml-2">
                            {tasksCompletedCount}/{tasks.length}
                        </span>
                    )}
                  </div>
                  
                  {!isCompleted && !isExpanded && (
                    <div className="flex flex-wrap gap-2 mt-1.5 text-[10px] text-gray-500">
                        {diary.status === 'LOCKED_REGION' && <span className="text-red-400 flex items-center gap-1"><Map size={8}/> Region Locked</span>}
                        {diary.status === 'LOCKED_SKILL' && <span className="text-red-400 flex items-center gap-1"><Lock size={8}/> Skills Locked</span>}
                        {diary.status === 'LOCKED_QUEST' && <span className="text-red-400 flex items-center gap-1"><BookOpen size={8}/> Quests Locked</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                    <button 
                    onClick={(e) => handleToggle(e, diary)}
                    disabled={isCompleted}
                    className={`w-8 h-8 flex items-center justify-center rounded-full border transition-all shrink-0 z-10 
                        ${isCompleted ? 'bg-green-500 text-black border-green-400 cursor-default opacity-80' : 
                          isActionable ? 'bg-black/40 text-gray-600 border-gray-700 hover:border-gray-500 hover:text-gray-400' : 
                          'bg-black/20 text-gray-700 border-gray-800 cursor-not-allowed opacity-50'}`}
                    title={isCompleted ? "Completed" : isActionable ? "Complete Full Section" : "Complete all tasks first"}
                    >
                    {isCompleted ? <CheckCircle2 size={18} /> : isActionable ? <Sparkles size={16} /> : <Lock size={14} />}
                    </button>
                    {hasTasks && <ChevronDown size={16} className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
                </div>
              </div>

              {isExpanded && hasTasks && (
                  <div className="border-t border-white/5 bg-black/20 p-2 space-y-1">
                      {tasks.map(task => {
                          const isTaskDone = unlocks.completedTasks.includes(task.id);
                          const hasReqs = (task.skills && Object.keys(task.skills).length > 0) || (task.quests && task.quests.length > 0) || (task.regions && task.regions.length > 0);
                          
                          if (searchTerm && !task.description.toLowerCase().includes(searchTerm.toLowerCase()) && !diary.id.toLowerCase().includes(searchTerm.toLowerCase())) return null;

                          return (
                              <button 
                                key={task.id}
                                onClick={(e) => handleTaskToggle(task, diary, e)}
                                disabled={isCompleted || isTaskDone}
                                className={`w-full flex items-start gap-3 p-2 rounded text-left group ${(isCompleted || isTaskDone) ? 'cursor-default opacity-70' : 'hover:bg-white/5 cursor-pointer'}`}
                              >
                                  <div className={`mt-0.5 ${isTaskDone ? 'text-green-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                      {isTaskDone ? <CheckSquare size={14} /> : <Square size={14} />}
                                  </div>
                                  <div className="flex-1">
                                      <div className="flex items-center justify-between gap-2">
                                          <span className={`text-xs ${isTaskDone ? 'text-gray-400 line-through' : 'text-gray-300'}`}>{task.description}</span>
                                          <a 
                                            href={getDiaryWikiLink(task.tierId)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                                            onClick={(e) => e.stopPropagation()}
                                            title="Open Wiki"
                                          >
                                            <ExternalLink size={10} />
                                          </a>
                                      </div>
                                      
                                      {hasReqs && !isTaskDone && (
                                          <div className="flex flex-wrap gap-2 mt-1.5">
                                              {/* Skills */}
                                              {task.skills && Object.entries(task.skills).map(([skill, level]) => {
                                                  const current = unlocks.levels[skill] || 1;
                                                  const unlocked = (unlocks.skills[skill] || 0) > 0;
                                                  const met = unlocked && current >= level;
                                                  return (
                                                      <span key={skill} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-green-500/30 text-green-500 bg-green-900/10' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}>
                                                          <BookOpen size={8} /> {skill} {level}
                                                      </span>
                                                  );
                                              })}
                                              {/* Quests */}
                                              {task.quests && task.quests.map(q => {
                                                  const met = unlocks.quests.includes(q);
                                                  return (
                                                      <span key={q} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-green-500/30 text-green-500 bg-green-900/10' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}>
                                                          <BookOpen size={8} /> {q}
                                                      </span>
                                                  );
                                              })}
                                              {/* Regions */}
                                              {task.regions && task.regions.map(r => {
                                                  const isMisthalin = r === 'Misthalin' || MISTHALIN_AREAS.includes(r);
                                                  const isUnlocked = isMisthalin || unlocks.regions.includes(r);
                                                  return (
                                                      <span key={r} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${isUnlocked ? 'border-green-500/30 text-green-500 bg-green-900/10' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}>
                                                          <Map size={8} /> {r}
                                                      </span>
                                                  );
                                              })}
                                          </div>
                                      )}
                                  </div>
                              </button>
                          );
                      })}
                  </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
