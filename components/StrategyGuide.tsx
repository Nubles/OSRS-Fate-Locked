import React, { useState, useMemo, useRef } from 'react';
import { useGame } from '../context/GameContext';
import { SectionGuide } from './SectionGuide';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { STRATEGY_DATABASE, ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { TableType } from '../types';
import { isAreaReachable } from '../utils/reachability';
import { 
    EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, 
    POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, 
    GUILDS_LIST, FARMING_PATCH_LIST, MISTHALIN_AREAS, REGION_GROUPS
} from '../constants';
import { CheckCircle, XCircle, Lock, Map, BookOpen, AlertCircle, Compass, Target, Search, ScrollText, Filter, Pin, SlidersHorizontal, Check, ArrowUpRight, TrendingUp, Sparkles, BrainCircuit } from 'lucide-react';

const ROOT_UNLOCKS = {
    [TableType.EQUIPMENT]: new Set(EQUIPMENT_SLOTS),
    [TableType.SKILLS]: new Set(SKILLS_LIST),
    [TableType.REGIONS]: new Set(REGIONS_LIST),
    [TableType.MOBILITY]: new Set(MOBILITY_LIST),
    [TableType.ARCANA]: new Set(ARCANA_LIST),
    [TableType.POH]: new Set(POH_LIST),
    [TableType.MERCHANTS]: new Set(MERCHANTS_LIST),
    [TableType.MINIGAMES]: new Set(MINIGAMES_LIST),
    [TableType.BOSSES]: new Set(BOSSES_LIST),
    [TableType.STORAGE]: new Set(STORAGE_LIST),
    [TableType.GUILDS]: new Set(GUILDS_LIST),
    [TableType.FARMING_LAYERS]: new Set(FARMING_PATCH_LIST),
};

const analyzeRequirement = (req: ContentRequirement, unlocks: any, gameModeId?: string) => {
    const missingRegions = req.regions.filter(r => {
        if (isAreaReachable(r, unlocks, gameModeId)) return false;
        if (REGION_GROUPS[r]) {
            const hasSubRegion = REGION_GROUPS[r].some((area: string) => isAreaReachable(area, unlocks, gameModeId));
            if (hasSubRegion) return false;
        }
        return true;
    });
    
    const missingSkills = Object.entries(req.skills).filter(([skill, level]) => {
        const currentLevel = unlocks.levels[skill] || 1;
        const isUnlocked = (unlocks.skills[skill] || 0) > 0;
        return !isUnlocked || currentLevel < (level as number);
    }).map(([skill, level]) => {
        const currentLevel = unlocks.levels[skill] || 1;
        const isUnlocked = (unlocks.skills[skill] || 0) > 0;
        return { skill, reqLevel: level as number, currentLevel, isUnlocked };
    });

    const missingQuests = (req.quests || []).filter(q => !unlocks.quests.includes(q));

    const isCategoryUnlocked = (() => {
        if (req.category === TableType.QUESTS || req.category === TableType.AGILITY_COURSES || req.category === TableType.DIARIES) return true;
        const rootSet = ROOT_UNLOCKS[req.category];
        const isRootItem = rootSet ? rootSet.has(req.id) : false;
        if (!isRootItem) return true; 
        switch(req.category) {
            case TableType.BOSSES: return unlocks.bosses.includes(req.id);
            case TableType.MINIGAMES: return unlocks.minigames.includes(req.id);
            case TableType.GUILDS: return unlocks.guilds.includes(req.id);
            case TableType.FARMING_LAYERS: return unlocks.farming.includes(req.id);
            case TableType.MOBILITY: return unlocks.mobility.includes(req.id);
            case TableType.ARCANA: return unlocks.arcana.includes(req.id);
            case TableType.POH: return unlocks.housing.includes(req.id);
            case TableType.STORAGE: return unlocks.storage.includes(req.id);
            case TableType.MERCHANTS: return unlocks.merchants.includes(req.id);
            default: return true; 
        }
    })();

    const totalReqs = req.regions.length + Object.keys(req.skills).length + (req.quests?.length || 0) + 1;
    const metReqs = (req.regions.length - missingRegions.length) + 
                    (Object.keys(req.skills).length - missingSkills.length) + 
                    ((req.quests?.length || 0) - missingQuests.length) +
                    (isCategoryUnlocked ? 1 : 0);
                    
    const completionPercent = totalReqs === 0 ? 100 : Math.round((metReqs / totalReqs) * 100);

    return {
        isFullyPlayable: missingRegions.length === 0 && missingSkills.length === 0 && missingQuests.length === 0 && isCategoryUnlocked,
        missingRegions,
        missingSkills,
        missingQuests,
        isCategoryUnlocked,
        completionPercent
    };
};

const calculateProphecyScore = (req: ContentRequirement, analysis: any) => {
    let score = 0;
    score += analysis.missingRegions.length * 100;
    analysis.missingSkills.forEach((s: any) => {
        score += (s.reqLevel - s.currentLevel);
        if (!s.isUnlocked) score += 50;
    });
    score += analysis.missingQuests.length * 20;
    if (!analysis.isCategoryUnlocked) score += 30;
    return score;
};

export const StrategyGuide: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const dialogRef = useRef<HTMLDivElement>(null);
    useFocusTrap(dialogRef);
    const { unlocks, togglePin, pinnedGoals, gameModeId } = useGame();
    const [activeTab, setActiveTab] = useState<'PLAYABLE' | 'PLANNER' | 'PROPHECY'>('PLAYABLE');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    const allContent = useMemo<Record<string, ContentRequirement>>(() => {
        const database: Record<string, ContentRequirement> = {};
        Object.values(QUEST_DATA).forEach(q => {
            if (unlocks.quests.includes(q.name)) return;
            database[q.name] = {
                id: q.name,
                category: TableType.QUESTS,
                regions: q.regions,
                skills: q.skills,
                quests: q.prereqs,
                description: `Series: ${q.series || 'None'} | Difficulty: ${q.difficulty.replace('Quest (', '').replace(')', '')}`
            };
        });
        Object.values(DIARY_DATA).forEach(d => {
            if (unlocks.diaries.includes(d.id)) return;
            database[d.id] = {
                id: d.id,
                category: TableType.DIARIES,
                regions: [...d.requiredRegions],
                skills: d.skills,
                quests: d.quests,
                description: `Region: ${d.region} | Difficulty: ${d.difficulty.replace('Diary (', '').replace(')', '')}`
            };
        });
        Object.entries(STRATEGY_DATABASE).forEach(([key, val]) => {
            if (val.category === TableType.QUESTS && unlocks.quests.includes(val.id)) return;
            database[key] = { ...val, id: key };
        });
        return database;
    }, [unlocks]);

    const contentAnalysis = useMemo(() => {
        return Object.entries(allContent)
            .map(([key, req]) => {
                const typedReq = req as ContentRequirement;
                const analysis = analyzeRequirement(typedReq, unlocks, gameModeId);
                return { ...typedReq, uniqueId: key, analysis };
            });
    }, [allContent, unlocks, gameModeId]);

    const categories = useMemo(() => {
        const cats = new Set(contentAnalysis.map(c => c.category));
        return ['ALL', ...Array.from(cats).sort()];
    }, [contentAnalysis]);

    const playableContent = useMemo(() => contentAnalysis.filter(c => c.analysis.isFullyPlayable), [contentAnalysis]);
    
    const plannerContent = useMemo(() => contentAnalysis
        .filter(c => !c.analysis.isFullyPlayable)
        .sort((a, b) => b.analysis.completionPercent - a.analysis.completionPercent), 
    [contentAnalysis]);

    const prophecyList = useMemo(() => {
        return contentAnalysis
            .filter(c => !c.analysis.isFullyPlayable)
            .map(c => ({
                ...c,
                difficultyScore: calculateProphecyScore(c, c.analysis)
            }))
            .sort((a, b) => a.difficultyScore - b.difficultyScore)
            .slice(0, 10);
    }, [contentAnalysis]);

    const filterList = (list: typeof contentAnalysis, term: string, category: string) => {
        let filtered = list;
        if (category !== 'ALL') filtered = filtered.filter(item => item.category === category);
        if (!term || term.trim() === '') return filtered;
        const lowerTerm = term.toLowerCase().trim();
        return filtered.filter(item => {
            if (item.uniqueId.toLowerCase().includes(lowerTerm)) return true;
            if (item.id.toLowerCase().includes(lowerTerm)) return true;
            if (item.regions.some(r => r.toLowerCase().includes(lowerTerm))) return true;
            if (Object.keys(item.skills).some(s => s.toLowerCase().includes(lowerTerm))) return true;
            if (item.quests && item.quests.some(q => q.toLowerCase().includes(lowerTerm))) return true;
            return false;
        });
    };

    const filteredPlayable = useMemo(() => filterList(playableContent, searchTerm, selectedCategory), [playableContent, searchTerm, selectedCategory]);
    const filteredPlanner = useMemo(() => filterList(plannerContent, searchTerm, selectedCategory), [plannerContent, searchTerm, selectedCategory]);

    return (
        <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Strategy guide" tabIndex={-1} className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#121212] border border-gray-700 w-full max-w-5xl h-[85vh] rounded-xl flex flex-col shadow-2xl overflow-hidden">
                <div className="bg-[#1a1a1a] p-4 border-b border-gray-700 flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-900/30 rounded border border-emerald-500/30">
                            <Compass className="w-5 h-5 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">Fate Strategy Guide <SectionGuide id="STRATEGY" /></h2>
                            <p className="text-xs text-gray-500">Analyze timeline capabilities & bottlenecks.</p>
                        </div>
                    </div>
                    
                    <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                        <button 
                            onClick={() => setActiveTab('PLAYABLE')}
                            className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'PLAYABLE' ? 'bg-emerald-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Available
                        </button>
                        <button 
                            onClick={() => setActiveTab('PLANNER')}
                            className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'PLANNER' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Locked
                        </button>
                        <button 
                            onClick={() => setActiveTab('PROPHECY')}
                            className={`px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'PROPHECY' ? 'bg-purple-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Sparkles size={12} /> Prophecy
                        </button>
                    </div>

                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <XCircle className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="bg-[#161616] border-b border-white/5 p-3 shrink-0 flex flex-col gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder={activeTab === 'PLAYABLE' ? "Search available content..." : "Search locked goals..."}
                            className="w-full bg-black/50 border border-white/10 rounded-lg pl-10 pr-10 py-2 text-sm text-gray-200 focus:outline-none focus:border-emerald-500/50 transition-colors placeholder-gray-600"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1">
                                <XCircle size={14} />
                            </button>
                        )}
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <div className="flex items-center text-gray-500 mr-2 shrink-0">
                            <SlidersHorizontal size={14} />
                        </div>
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500 hover:text-gray-300'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden bg-[#0a0a0a] relative">
                    {activeTab === 'PLAYABLE' && (
                        <div className="h-full overflow-y-auto custom-scrollbar p-6">
                            {filteredPlayable.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                                    <Search size={48} className="opacity-20" />
                                    <p>No available content found.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {filteredPlayable.map(content => {
                                        const isPinned = pinnedGoals.includes(content.uniqueId);
                                        return (
                                            <div key={content.uniqueId} className="bg-[#1a1a1a] border border-emerald-500/30 p-4 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:bg-[#202020] transition-colors group relative flex flex-col h-full">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[9px] font-bold text-emerald-400 bg-emerald-900/20 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wide">
                                                        {content.category}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={() => togglePin(content.uniqueId)} className={`p-1 rounded transition-colors ${isPinned ? 'text-blue-400 bg-blue-900/20' : 'text-gray-600 hover:text-gray-300'}`} title={isPinned ? "Unpin Goal" : "Pin as Goal"}>
                                                            <Pin size={14} fill={isPinned ? "currentColor" : "none"} />
                                                        </button>
                                                        <CheckCircle size={16} className="text-emerald-500" />
                                                    </div>
                                                </div>
                                                <h3 className="text-gray-100 font-bold text-base mb-1 leading-tight">{content.uniqueId}</h3>
                                                {content.id !== content.uniqueId && <p className="text-[10px] text-gray-600 mb-1 font-mono uppercase tracking-wider">{content.id}</p>}
                                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-3 flex-1" title={content.description}>{content.description}</p>
                                                <div className="pt-3 border-t border-white/5 flex gap-2 flex-wrap">
                                                    {content.regions.map(r => <span key={r} className="text-[9px] flex items-center gap-1 text-gray-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5"><Map size={10} /> {r}</span>)}
                                                    {Object.keys(content.skills).map(s => <span key={s} className="text-[9px] flex items-center gap-1 text-gray-400 bg-black/40 px-1.5 py-0.5 rounded border border-white/5"><BookOpen size={10} /> {s}</span>)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'PLANNER' && (
                        <div className="h-full flex flex-col">
                             <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                                {filteredPlanner.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-4">
                                        <Search size={48} className="opacity-20" />
                                        <p>No locked content found.</p>
                                    </div>
                                ) : (
                                    filteredPlanner.map(content => {
                                        const { missingRegions, missingSkills, missingQuests, isCategoryUnlocked, completionPercent } = content.analysis;
                                        const isPinned = pinnedGoals.includes(content.uniqueId);
                                        const progressColor = completionPercent > 75 ? 'bg-green-500' : completionPercent > 40 ? 'bg-yellow-500' : 'bg-red-500';
                                        
                                        return (
                                            <div key={content.uniqueId} className="bg-[#161616] border border-white/5 rounded-lg p-4 flex flex-col lg:flex-row gap-6 relative overflow-hidden group hover:border-white/10 transition-colors">
                                                <div className="absolute bottom-0 left-0 h-1 bg-white/5 w-full"><div className={`h-full ${progressColor} transition-all duration-500`} style={{ width: `${completionPercent}%` }}></div></div>
                                                <div className="lg:w-1/3 shrink-0 flex flex-col">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="flex flex-col gap-1">
                                                             <h3 className="text-gray-200 font-bold text-lg leading-tight">{content.uniqueId}</h3>
                                                             {content.id !== content.uniqueId && <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{content.id}</span>}
                                                        </div>
                                                        <button onClick={() => togglePin(content.uniqueId)} className={`p-1.5 rounded transition-colors ${isPinned ? 'text-blue-400 bg-blue-900/20' : 'text-gray-600 hover:text-gray-300'}`} title={isPinned ? "Unpin Goal" : "Pin as Goal"}>
                                                            <Pin size={16} fill={isPinned ? "currentColor" : "none"} />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-[10px] text-gray-500 uppercase border border-white/10 px-1.5 py-0.5 rounded">{content.category}</span>
                                                        <span className={`text-[10px] font-bold ${completionPercent > 80 ? 'text-green-400' : 'text-gray-500'}`}>{completionPercent}% Complete</span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">{content.description}</p>
                                                    <div className="mt-auto flex flex-col gap-1">
                                                        {!isCategoryUnlocked && <div className="flex items-center gap-2 text-red-400 text-xs font-bold bg-red-900/10 p-1.5 rounded border border-red-500/20"><Lock size={12} /><span>LOCKED CATEGORY (Requires Key)</span></div>}
                                                    </div>
                                                </div>
                                                <div className="flex-1 flex flex-col justify-center border-t lg:border-t-0 lg:border-l border-white/5 pt-4 lg:pt-0 lg:pl-6">
                                                    <div className="text-[9px] font-bold uppercase tracking-widest text-gray-600 mb-3 flex items-center gap-2"><Target size={10} /> Requirements Breakdown</div>
                                                    <div className="flex flex-wrap items-start gap-2">
                                                        {content.regions.map((region) => {
                                                            const isMissing = missingRegions.includes(region);
                                                            return <div key={region} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-mono transition-colors ${isMissing ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-green-900/10 border-green-500/20 text-green-500/70'}`}><Map size={12} /><span>{region}</span>{isMissing ? <Lock size={10} /> : <Check size={10} />}</div>
                                                        })}
                                                        {Object.entries(content.skills).map(([skill, level]) => {
                                                            const skillStatus = missingSkills.find(s => s.skill === skill);
                                                            const isMissing = !!skillStatus;
                                                            const isLocked = skillStatus && !skillStatus.isUnlocked;
                                                            return <div key={skill} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-mono transition-colors ${isMissing ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-green-900/10 border-green-500/20 text-green-500/70'}`}><BookOpen size={12} /><span>{skill} {level}</span>{isLocked ? <Lock size={10} /> : isMissing ? <span className="text-[9px] bg-red-500/20 px-1 rounded">{skillStatus?.currentLevel}</span> : <Check size={10} />}</div>
                                                        })}
                                                        {content.quests && content.quests.map(q => {
                                                            const isMissing = missingQuests.includes(q);
                                                            return <div key={q} className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-mono transition-colors ${isMissing ? 'bg-red-900/20 border-red-500/30 text-red-400' : 'bg-green-900/10 border-green-500/20 text-green-500/70'}`}><ScrollText size={12} />{q}{isMissing ? <Lock size={10} /> : <Check size={10} />}</div>
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                             </div>
                        </div>
                    )}

                    {activeTab === 'PROPHECY' && (
                        <div className="h-full flex flex-col p-6 overflow-y-auto custom-scrollbar">
                            <div className="bg-purple-900/20 border border-purple-500/30 p-6 rounded-xl mb-6 flex items-start gap-4">
                                <div className="p-3 bg-purple-500/20 rounded-full border border-purple-500/40">
                                    <BrainCircuit size={32} className="text-purple-300" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-white mb-2">The Oracle's Prophecy</h3>
                                    <p className="text-sm text-gray-300 leading-relaxed">
                                        These are your most efficient next steps. The Oracle calculates the "Distance" to every goal based on your current unlocks, levels, and prerequisites.
                                        <br/><span className="text-purple-300 text-xs mt-2 block">Low score = Easier to achieve.</span>
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {prophecyList.map((content, idx) => {
                                    const { completionPercent } = content.analysis;
                                    const isPinned = pinnedGoals.includes(content.uniqueId);
                                    
                                    return (
                                        <div key={content.uniqueId} className="bg-[#1a1a1a] border border-white/5 rounded-lg p-4 flex items-center gap-4 hover:bg-[#202020] transition-colors group">
                                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-900/40 border border-purple-500/30 flex items-center justify-center font-bold text-purple-300 text-sm">
                                                #{idx + 1}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="font-bold text-white text-base truncate">{content.uniqueId}</h4>
                                                    <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500 uppercase tracking-wide border border-white/5">{content.category}</span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                                                    <span>Difficulty Score: <span className="text-purple-400 font-bold">{content.difficultyScore}</span></span>
                                                    <span>Progress: <span className={completionPercent > 80 ? 'text-green-400' : 'text-yellow-500'}>{completionPercent}%</span></span>
                                                </div>
                                            </div>

                                            <button 
                                                onClick={() => togglePin(content.uniqueId)}
                                                className={`p-2 rounded-full transition-all ${isPinned ? 'bg-blue-600 text-white shadow-lg scale-110' : 'bg-black/40 text-gray-600 hover:text-white hover:bg-white/10'}`}
                                                title="Pin Goal"
                                            >
                                                <Pin size={18} fill={isPinned ? "currentColor" : "none"} />
                                            </button>
                                            
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowUpRight size={18} className="text-gray-600" />
                                            </div>
                                        </div>
                                    );
                                })}
                                {prophecyList.length === 0 && (
                                    <div className="text-center py-10 text-gray-500 italic">No prophecies available. You may have unlocked everything possible!</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default StrategyGuide;
