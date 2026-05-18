
import React, { useState, useMemo } from 'react';
import { useGame } from '../context/GameContext';
import { QUEST_DATA, QuestData } from '../data/questData';
import { MISTHALIN_AREAS, WIKI_OVERRIDES } from '../constants';
import { CheckCircle2, Lock, Map, BookOpen, Sparkles, Scroll, Bookmark, Layers, List, ExternalLink } from 'lucide-react';
import { DROP_RATES } from '../config/rules';
import { DropSource } from '../types';

interface QuestLogProps {
  searchTerm?: string;
}

// Helpers
const getWikiUrl = (name: string) => {
    // Special handling for Recipe for Disaster subquests to avoid broken links
    if (name.startsWith('RFD:')) {
        return 'https://oldschool.runescape.wiki/w/Recipe_for_Disaster';
    }
    if (WIKI_OVERRIDES[name]) return `https://oldschool.runescape.wiki/w/${WIKI_OVERRIDES[name]}`;
    return `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, '_'))}`;
};

const getDifficultyColor = (difficulty: DropSource) => {
    if (difficulty === DropSource.QUEST_GRANDMASTER) return 'text-yellow-400 border-yellow-500/30 bg-yellow-900/10';
    if (difficulty === DropSource.QUEST_MASTER) return 'text-purple-400 border-purple-500/30 bg-purple-900/10';
    if (difficulty === DropSource.QUEST_EXPERIENCED) return 'text-red-400 border-red-500/30 bg-red-900/10';
    if (difficulty === DropSource.QUEST_INTERMEDIATE) return 'text-blue-400 border-blue-500/30 bg-blue-900/10';
    return 'text-green-400 border-green-500/30 bg-green-900/10'; // Novice
};

const getDifficultyLabel = (difficulty: DropSource) => {
    return difficulty.replace('Quest (', '').replace(')', '');
};

// QuestCard Component
interface QuestCardProps {
    quest: any; // Augmented QuestData with status
    unlocks: any;
    currentQP: number;
    onToggle: (e: React.MouseEvent, quest: any) => void;
}

const QuestCard: React.FC<QuestCardProps> = ({ quest, unlocks, currentQP, onToggle }) => {
    const isCompleted = quest.status === 'COMPLETED';
    const isAvailable = quest.status === 'AVAILABLE';
    const diffStyle = getDifficultyColor(quest.difficulty);
    
    return (
      <div 
          className={`
              relative border rounded-lg p-3 transition-all
              ${isCompleted ? 'bg-green-900/10 border-green-500/20 opacity-60 hover:opacity-100' : 
                isAvailable ? 'bg-blue-900/10 border-blue-500/40 hover:bg-blue-900/20' : 
                'bg-[#1a1a1a] border-white/5 opacity-80'}
          `}
      >
          <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-bold text-sm truncate ${isCompleted ? 'text-green-400 line-through' : isAvailable ? 'text-blue-300' : 'text-gray-400'}`}>
                          {quest.name}
                      </h3>
                      <a 
                          href={getWikiUrl(quest.name)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-gray-500 hover:text-white transition-colors p-0.5"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Wiki"
                      >
                          <ExternalLink size={12} />
                      </a>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono font-bold uppercase tracking-wide whitespace-nowrap ${diffStyle}`}>
                          {getDifficultyLabel(quest.difficulty)}
                      </span>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-1.5">
                      {quest.regions.map((r: string) => {
                          const unlocked = unlocks.regions.includes(r) || MISTHALIN_AREAS.includes(r) || r === 'Misthalin';
                          return (
                              <span key={r} className={`text-[10px] px-1.5 rounded flex items-center gap-1 border ${unlocked ? 'bg-emerald-900/20 text-emerald-400 border-emerald-500/20' : 'bg-red-900/10 text-red-400 border-red-500/20'}`}>
                                  <Map size={8} /> {r}
                              </span>
                          );
                      })}
                  </div>

                  {Object.keys(quest.skills).length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1.5">
                          {Object.entries(quest.skills).map(([skill, lvl]) => {
                              const reqLevel = lvl as number;
                              let met = false;
                              let isLocked = false;

                              if (skill === 'Quest Points') {
                                  met = currentQP >= reqLevel;
                              } else {
                                  const currentLevel = unlocks.levels[skill] || 1;
                                  const skillUnlocked = (unlocks.skills[skill] || 0) > 0;
                                  isLocked = !skillUnlocked;
                                  met = skillUnlocked && currentLevel >= reqLevel;
                              }

                              return (
                                  <span key={skill} className={`text-[10px] px-1.5 rounded flex items-center gap-1 border ${met ? 'bg-amber-900/20 text-amber-400 border-amber-500/20' : 'bg-red-900/10 text-red-400 border-red-500/20'}`}>
                                      {skill === 'Quest Points' ? <Sparkles size={8} /> : <BookOpen size={8} />}
                                      {skill === 'Quest Points' ? 'QP' : skill} {reqLevel}
                                      {isLocked && <Lock size={8} className="ml-0.5" />}
                                  </span>
                              );
                          })}
                      </div>
                  )}
              </div>
              
              <button 
                  onClick={(e) => onToggle(e, quest)}
                  disabled={isCompleted}
                  className={`
                      w-8 h-8 flex items-center justify-center rounded-full border transition-all shrink-0
                      ${isCompleted 
                          ? 'bg-green-500 border-green-400 shadow-[0_0_10px_rgba(34,197,94,0.4)] cursor-default' 
                          : 'bg-black/40 border-gray-700 hover:border-gray-500 hover:text-gray-400 cursor-pointer'}
                  `}
                  title={isCompleted ? "Completed" : "Complete & Roll"}
              >
                  <img 
                      src="https://oldschool.runescape.wiki/images/Quests.png" 
                      alt="Quest Icon" 
                      className={`w-5 h-5 object-contain transition-all ${isCompleted ? '' : 'grayscale opacity-40'}`} 
                  />
              </button>
          </div>

          {!isCompleted && !isAvailable && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-red-400/80 font-mono flex flex-col gap-0.5">
                  {quest.status === 'LOCKED_REGION' && <span className="flex items-center gap-1"><Lock size={8}/> Locked by Region</span>}
                  {quest.status === 'LOCKED_SKILL' && <span className="flex items-center gap-1"><Lock size={8}/> Skill requirements not met</span>}
                  {quest.status === 'LOCKED_QUEST' && <span className="flex items-center gap-1"><Lock size={8}/> Missing prerequisite quests</span>}
              </div>
          )}
          
          {!isCompleted && isAvailable && (
              <div className="mt-2 pt-2 border-t border-white/5 text-[10px] text-blue-400/60 font-mono flex items-center gap-1">
                  <Sparkles size={8} /> Ready to complete! Click to roll.
              </div>
          )}
      </div>
    );
};

export const QuestLog: React.FC<QuestLogProps> = ({ searchTerm = '' }) => {
  const { unlocks, toggleQuest, rollForKey } = useGame();
  const [filter, setFilter] = useState<'ALL' | 'AVAILABLE' | 'COMPLETED' | 'LOCKED'>('ALL');
  const [groupBySeries, setGroupBySeries] = useState(false);

  const getStatus = (quest: QuestData) => {
    if (unlocks.quests.includes(quest.id)) return 'COMPLETED';
    
    const missingRegions = quest.regions.filter(r => {
        if (MISTHALIN_AREAS.includes(r) || r === 'Misthalin') return false;
        return !unlocks.regions.includes(r);
    });
    
    if (missingRegions.length > 0) return 'LOCKED_REGION';

    const missingSkills = Object.entries(quest.skills).some(([skill, lvl]) => {
      if (skill === 'Quest Points') {
         const currentQP = unlocks.quests.reduce((acc, qid) => acc + (QUEST_DATA[qid]?.points || 0), 0);
         return currentQP < lvl;
      }
      const current = unlocks.levels[skill] || 1;
      const isUnlocked = (unlocks.skills[skill] || 0) > 0;
      return !isUnlocked || current < lvl;
    });
    if (missingSkills) return 'LOCKED_SKILL';

    const missingPrereqs = quest.prereqs.some(qid => !unlocks.quests.includes(qid));
    if (missingPrereqs) return 'LOCKED_QUEST';

    return 'AVAILABLE';
  };

  const allQuests = useMemo(() => {
    return Object.values(QUEST_DATA).map(q => ({ ...q, status: getStatus(q) })).sort((a, b) => {
        const score = (s: string) => s === 'AVAILABLE' ? 0 : s.includes('LOCKED') ? 1 : 2;
        return score(a.status) - score(b.status) || a.name.localeCompare(b.name);
    });
  }, [unlocks]);

  const filteredQuests = allQuests.filter(q => {
    const matchesSearch = q.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === 'ALL') return true;
    if (filter === 'COMPLETED') return q.status === 'COMPLETED';
    if (filter === 'AVAILABLE') return q.status === 'AVAILABLE';
    if (filter === 'LOCKED') return q.status.includes('LOCKED');
    return true;
  });

  const mainQuests = filteredQuests.filter(q => q.points > 0);
  const miniquests = filteredQuests.filter(q => q.points === 0);

  const seriesGroups = useMemo(() => {
      if (!groupBySeries) return [];
      const groups: Record<string, typeof filteredQuests> = {};
      filteredQuests.forEach(q => {
          const s = q.series || 'Miscellaneous';
          if (!groups[s]) groups[s] = [];
          groups[s].push(q);
      });
      return Object.entries(groups).sort((a, b) => {
          if (a[0] === 'Miscellaneous') return 1;
          if (b[0] === 'Miscellaneous') return -1;
          return a[0].localeCompare(b[0]);
      });
  }, [filteredQuests, groupBySeries]);

  const handleQuestToggle = (e: React.MouseEvent, quest: QuestData) => {
      e.stopPropagation();
      const isCompleted = unlocks.quests.includes(quest.id);
      
      if (isCompleted) return;

      toggleQuest(quest.id);

      const rate = DROP_RATES[quest.difficulty];
      rollForKey(quest.difficulty, rate, e.clientX, e.clientY);
  };

  const totalQuests = Object.values(QUEST_DATA).filter(q => q.points > 0).length;
  const totalMinis = Object.values(QUEST_DATA).filter(q => q.points === 0).length;
  const completedMain = unlocks.quests.filter(id => (QUEST_DATA[id]?.points || 0) > 0).length;
  const completedMinis = unlocks.quests.filter(id => (QUEST_DATA[id]?.points || 0) === 0).length;
  const currentQP = unlocks.quests.reduce((acc, qid) => acc + (QUEST_DATA[qid]?.points || 0), 0);

  return (
    <div className="bg-[#121212] flex flex-col h-full rounded-lg border border-white/10 overflow-hidden">
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-[#1a1a1a] shrink-0">
        <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-bold text-blue-200 flex items-center gap-2">
                <BookOpen size={18} /> Quest Journal
            </h2>
            <div className="flex flex-col items-end">
                <span className="text-xs text-blue-400 font-mono font-bold">
                    QP: {currentQP}
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                    {completedMain}/{totalQuests} Quests
                </span>
                <span className="text-[10px] text-gray-500 font-mono">
                    {completedMinis}/{totalMinis} Minis
                </span>
            </div>
        </div>
        
        <div className="flex gap-2 justify-between">
            <button
                onClick={() => setGroupBySeries(!groupBySeries)}
                className={`flex-1 flex items-center justify-center p-1.5 rounded border ${groupBySeries ? 'bg-purple-900/40 border-purple-500 text-purple-300' : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'}`}
                title={groupBySeries ? "Group by Type (Main/Mini)" : "Group by Series"}
            >
                {groupBySeries ? <><Layers size={16} className="mr-2" /> Series</> : <><List size={16} className="mr-2" /> List</>}
            </button>

            <select 
                className="flex-1 bg-[#222] border border-white/10 rounded px-2 text-xs text-gray-300 focus:border-blue-500/50 outline-none"
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
            >
                <option value="ALL" className="bg-[#222]">All Status</option>
                <option value="AVAILABLE" className="bg-[#222]">Available</option>
                <option value="LOCKED" className="bg-[#222]">Locked</option>
                <option value="COMPLETED" className="bg-[#222]">Completed</option>
            </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
        
        {groupBySeries ? (
            // SERIES GROUPING VIEW
            <>
                {seriesGroups.map(([seriesName, quests]) => (
                    <div key={seriesName}>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 pb-2 flex items-center gap-2 sticky top-0 bg-[#121212] z-10 border-b border-white/5 mb-2">
                            <Layers size={12} /> {seriesName} ({quests.length})
                        </h3>
                        <div className="space-y-2">
                            {quests.map(quest => (
                                <QuestCard 
                                    key={quest.id} 
                                    quest={quest} 
                                    unlocks={unlocks} 
                                    currentQP={currentQP} 
                                    onToggle={handleQuestToggle} 
                                />
                            ))}
                        </div>
                    </div>
                ))}
                {seriesGroups.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-xs italic">
                        No quests found matching filter.
                    </div>
                )}
            </>
        ) : (
            // STANDARD MAIN/MINI VIEW
            <>
                {mainQuests.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 pb-2 flex items-center gap-2 sticky top-0 bg-[#121212] z-10 border-b border-white/5 mb-2">
                            <Scroll size={12} /> Quests ({mainQuests.length})
                        </h3>
                        <div className="space-y-2">
                            {mainQuests.map(quest => (
                                <QuestCard 
                                    key={quest.id} 
                                    quest={quest} 
                                    unlocks={unlocks} 
                                    currentQP={currentQP} 
                                    onToggle={handleQuestToggle} 
                                />
                            ))}
                        </div>
                    </div>
                )}

                {miniquests.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1 pb-2 pt-2 flex items-center gap-2 sticky top-0 bg-[#121212] z-10 border-b border-white/5 mb-2">
                            <Bookmark size={12} /> Miniquests ({miniquests.length})
                        </h3>
                        <div className="space-y-2">
                            {miniquests.map(quest => (
                                <QuestCard 
                                    key={quest.id} 
                                    quest={quest} 
                                    unlocks={unlocks} 
                                    currentQP={currentQP} 
                                    onToggle={handleQuestToggle} 
                                />
                            ))}
                        </div>
                    </div>
                )}

                {mainQuests.length === 0 && miniquests.length === 0 && (
                    <div className="text-center py-10 text-gray-500 text-xs italic">
                        No quests found matching filter.
                    </div>
                )}
            </>
        )}

      </div>
    </div>
  );
};
