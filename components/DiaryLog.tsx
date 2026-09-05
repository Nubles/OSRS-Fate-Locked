
import React, { useMemo, useState, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { DIARY_DATA, DiaryTier } from '../data/diaryData';
import { ALL_DIARY_TASKS, DiaryTask } from '../data/diaryTasks';
import { Map, CheckCircle2, Lock, Sparkles, BookOpen, ChevronDown, CheckSquare, Square, ExternalLink, ArrowUpRight, TrendingUp, MapPin } from 'lucide-react';
import { chunkForPlace, showChunkOnMap } from '../utils/chunkLocations';
import { diaryUnmet, isAlmostThere } from '../utils/journalProgress';
import { isAreaReachable } from '../utils/reachability';
import { actualSkillLevel } from '../utils/skillLevels';
import { JournalFilterBar, JournalStatus } from './JournalFilterBar';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SkillTrainingPopover, SkillPopoverState } from './SkillTrainingPopover';
import { DiaryInsights } from './JournalInsights';
import { DiaryHeatmap } from './DiaryHeatmap';
import {
  countDoableTasks, diaryRequirementOptionLabel, evaluateDiaryTaskEligibility,
  evaluateDiaryTierEligibility, getDiaryStatus, meetsSkillRequirement,
} from '../utils/journalStatus';
import { requestManualAttestation } from '../utils/manualAttestation';

// Doable-now counting lives in utils/journalStatus (shared with the
// insights band) — see countDoableTasks there.

interface DiaryLogProps {
  searchTerm?: string;
  suspendModals?: boolean;
}

export const DiaryLog: React.FC<DiaryLogProps> = ({ searchTerm: externalSearch = '', suspendModals = false }) => {
  const { unlocks, completeDiaryTask, completeDiaryTier, advisorsEnabled, gameModeId } = useGame();
  // Filter state persisted across sessions.
  const [filterRegion, setFilterRegion] = useLocalStorage<string>('jrnl:diary:region', 'ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useLocalStorage<JournalStatus>('jrnl:diary:status', 'ALL');
  const [filterTier, setFilterTier] = useLocalStorage<string>('jrnl:diary:tier', 'ALL');
  const [sortMode, setSortMode] = useLocalStorage<string>('jrnl:diary:sort', 'AREA');
  const [localSearch, setLocalSearch] = useState('');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [skillPopover, setSkillPopover] = useState<SkillPopoverState | null>(null);
  const searchTerm = externalSearch || localSearch;

  const focusCard = (id: string) => {
    setExpandedId(id);
    // Clear filters so the target card is guaranteed to be visible.
    setFilterStatus('ALL');
    setFilterRegion('ALL');
    setFilterTier('ALL');
    setHighlightedId(id);
    // Align the card's top (header + border + first task in view) rather than
    // centring the now-expanded, tall card — and wait a frame longer so the
    // heatmap-collapse + expand layout settles before we measure.
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-journal-id="${id}"]`);
      if (el) {
        el.style.scrollMarginTop = '8px';
        el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
      window.setTimeout(() => setHighlightedId(null), 1800);
    }, 120);
  };

  // Focus a specific diary card when asked from elsewhere (journal feed).
  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id && DIARY_DATA[id]) focusCard(id);
    };
    window.addEventListener('fate:journal-focus', onFocus);
    return () => window.removeEventListener('fate:journal-focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getStatus = (diary: DiaryTier) => (
    getDiaryStatus(diary, unlocks, gameModeId)
  );

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
  }, [unlocks, gameModeId]);

  const filteredDiaries = diaries.filter(d => {
      const matchesRegion = filterRegion === 'ALL' || d.region === filterRegion;
      if (!matchesRegion) return false;
      if (filterTier !== 'ALL' && d.tier !== filterTier) return false;
      if (filterStatus !== 'ALL') {
        if (filterStatus === 'COMPLETED' && d.status !== 'COMPLETED') return false;
        if (filterStatus === 'AVAILABLE' && d.status !== 'AVAILABLE') return false;
        if (filterStatus === 'LOCKED' && !d.status.includes('LOCKED')) return false;
      }

      if (!searchTerm) return true;
      const lowerSearch = searchTerm.toLowerCase();
      if (d.id.toLowerCase().includes(lowerSearch)) return true;
      const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === d.id);
      return tasks.some(t => t.description.toLowerCase().includes(lowerSearch));
  });

  const regions = Array.from(new Set(Object.values(DIARY_DATA).map(d => d.region))).sort();

  // "Closest first": ranked by how *finishable* a tier actually is given the
  // player's levels / quests / regions. Tiers with at least one doable-now
  // task come first (you can make progress today), ordered by fewest tasks
  // remaining, then by most doable. Fully-blocked tiers — however few tasks
  // they have left — sink below every actionable one. Completed sink last.
  const sortedDiaries = useMemo(() => {
    if (sortMode !== 'PROGRESS') return filteredDiaries;
    const key = (d: { id: string; status: string }): [number, number, number] => {
      if (d.status === 'COMPLETED') return [2, Infinity, 0];
      const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === d.id);
      const remaining = tasks.filter(t => !unlocks.completedTasks.includes(t.id)).length;
      if (!tasks.length || remaining === 0) return [2, Infinity, 0];
      const doable = countDoableTasks(tasks, unlocks, gameModeId);
      return [doable > 0 ? 0 : 1, remaining, -doable];
    };
    return [...filteredDiaries].sort((a, b) => {
      const ka = key(a), kb = key(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
    });
  }, [filteredDiaries, sortMode, unlocks, gameModeId]);

  const statusCounts = useMemo(() => ({
    ALL: diaries.length,
    AVAILABLE: diaries.filter((d) => d.status === 'AVAILABLE').length,
    LOCKED: diaries.filter((d) => d.status.includes('LOCKED')).length,
    COMPLETED: diaries.filter((d) => d.status === 'COMPLETED').length,
  }), [diaries]);

  const handleToggle = (e: React.MouseEvent, diary: DiaryTier) => {
      e.stopPropagation();
      completeDiaryTier(diary.id);
  };

  const handleTaskToggle = (task: DiaryTask, e: React.MouseEvent) => {
      const eligibility = evaluateDiaryTaskEligibility(task, unlocks, gameModeId);
      const attestation = requestManualAttestation(
        task.description,
        eligibility,
        message => window.confirm(message),
      );
      if (attestation === null) return;
      completeDiaryTask(task.id, e.clientX, e.clientY, attestation);
  };

  return (
    <div className="flex flex-col h-full bg-[#121212] border border-white/10 rounded-lg overflow-hidden">
      <JournalFilterBar
        title="Diaries"
        icon={<Map size={14} />}
        accent="bg-green-900/40 text-green-300"
        searchValue={externalSearch || localSearch}
        onSearchChange={setLocalSearch}
        searchPlaceholder="Search diaries or tasks..."
        status={filterStatus}
        onStatusChange={setFilterStatus}
        statusCounts={statusCounts}
        completed={unlocks.diaries.length}
        total={Object.keys(DIARY_DATA).length}
        regions={regions}
        activeRegion={filterRegion}
        onRegionChange={setFilterRegion}
        tiers={[
          { id: 'Easy', colorClass: 'bg-green-900/40 text-green-300' },
          { id: 'Medium', colorClass: 'bg-blue-900/40 text-blue-300' },
          { id: 'Hard', colorClass: 'bg-red-900/40 text-red-300' },
          { id: 'Elite', colorClass: 'bg-purple-900/40 text-purple-300' },
        ]}
        activeTier={filterTier}
        onTierChange={setFilterTier}
        rightExtras={
          <select
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            className="bg-black/40 border border-white/10 rounded text-[10px] text-gray-300 px-1 py-1 focus:outline-none focus:border-white/30 shrink-0"
            title="Sort diaries"
            aria-label="Sort diaries"
          >
            <option value="AREA">By area</option>
            <option value="PROGRESS">Closest first</option>
          </select>
        }
      />

      <DiaryHeatmap onPick={focusCard} />

      {advisorsEnabled && <DiaryInsights />}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
        {sortedDiaries.map(diary => {
          const isCompleted = diary.status === 'COMPLETED';
          const isAvailable = diary.status === 'AVAILABLE';
          const needsConfirmation = diary.status === 'NEEDS_CONFIRMATION' || diary.status === 'UNKNOWN';
          const isSearching = searchTerm.length > 0;
          const isExpanded = expandedId === diary.id || isSearching;
          const color = diary.tier === 'Elite' ? 'text-purple-400' : diary.tier === 'Hard' ? 'text-red-400' : diary.tier === 'Medium' ? 'text-blue-400' : 'text-green-400';

          const tasks = ALL_DIARY_TASKS.filter(t => t.tierId === diary.id);
          const hasTasks = tasks.length > 0;
          const tasksCompletedCount = tasks.filter(t => unlocks.completedTasks.includes(t.id)).length;

          const allTasksDone = !hasTasks || tasksCompletedCount === tasks.length;
          const isActionable = isCompleted || allTasksDone;

          // Tasks the player can tick off right now — drives the green badge.
          const doableNow = isCompleted ? 0 : countDoableTasks(tasks, unlocks, gameModeId);

          // Req progress for LOCKED diary cards: count diary-level gates met
          // (required regions + prerequisite quests + skill requirements).
          const tierEligibility = evaluateDiaryTierEligibility(diary, unlocks, gameModeId);
          const dUnmet = (isCompleted || isAvailable)
            ? []
            : diaryUnmet(diary, unlocks, gameModeId);
          const dTotalMet = tierEligibility.evidence.length;
          const dTotalReqs = dTotalMet + tierEligibility.blockers.length;
          const dReqPct = dTotalReqs === 0 ? 100 : Math.round((dTotalMet / dTotalReqs) * 100);
          const missingDiaryQuests = dUnmet
            .filter(requirement => requirement.kind === 'quest' && requirement.label !== 'All quests')
            .map(requirement => requirement.label);
          // "Almost there" — the tier is blocked by exactly one requirement.
          const dAlmost = isAlmostThere(dUnmet);

          return (
            <div
              key={diary.id}
              data-journal-id={diary.id}
              className={`group relative border rounded-lg overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40 ${isCompleted ? 'bg-green-900/10 border-green-500/20 opacity-60 hover:opacity-100' : isAvailable ? 'bg-green-900/10 border-green-500/40' : 'bg-[#1a1a1a] border-white/5 opacity-80 hover:opacity-100'} ${highlightedId === diary.id ? 'ring-2 ring-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.25)]' : ''}`}
            >
              {/* Tier accent edge */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${diary.tier === 'Elite' ? 'bg-purple-400' : diary.tier === 'Hard' ? 'bg-red-400' : diary.tier === 'Medium' ? 'bg-blue-400' : 'bg-green-400'} ${isCompleted ? 'opacity-40' : 'opacity-80 group-hover:opacity-100'}`} />
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
                    {/* Green "X now" pill — only shown when the tier has
                        tasks the player can actually complete right now. */}
                    {hasTasks && !isCompleted && doableNow > 0 && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-900/25 text-emerald-400 border border-emerald-500/30">
                            {doableNow} now
                        </span>
                    )}
                  </div>
                  
                  {/* Locked summary: req progress bar + missing quest chips.
                      Replaces the old plain-text "Region/Skill/Quest Locked" labels
                      with an at-a-glance % bar and clickable prereq chips. */}
                  {needsConfirmation && <div className="text-xs text-cyan-300">Needs confirmation: inventory, account mode, or manual task conditions</div>}
                  {!isCompleted && !isAvailable && !isExpanded && dTotalReqs > 0 && (
                    <div className="mt-1.5 space-y-1.5">
                      <div className="flex items-center gap-2">
                        {dAlmost && (
                          <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1 shrink-0 animate-pulse">
                            <Sparkles size={8} /> Almost — {dUnmet[0].label}
                          </span>
                        )}
                        <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500/50 transition-all duration-500"
                            style={{ width: `${dReqPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-gray-600 font-mono whitespace-nowrap shrink-0">
                          {dTotalMet}/{dTotalReqs} reqs
                        </span>
                      </div>
                      {missingDiaryQuests.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {missingDiaryQuests.map(q => (
                            <a
                              key={q}
                              href={`https://oldschool.runescape.wiki/w/${encodeURIComponent(q.replace(/ /g, '_'))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1 border bg-amber-900/10 text-amber-400 border-amber-500/30 hover:bg-amber-900/25 transition-colors"
                              title={`Wiki: ${q}`}
                            >
                              <BookOpen size={7} /> {q} <ArrowUpRight size={7} />
                            </a>
                          ))}
                        </div>
                      )}
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
                          const taskEligibility = evaluateDiaryTaskEligibility(task, unlocks, gameModeId);
                          const alternativeLabel = task.oneOf?.length
                            ? task.oneOf.map(diaryRequirementOptionLabel).join(' or ')
                            : undefined;
                          const anyRegionAlternativeLabel = task.anyOfRegions?.length
                            ? task.anyOfRegions.join(' or ')
                            : undefined;
                          const hasReqs = Boolean(
                            Object.keys(task.skills ?? {}).length || task.items?.length || task.quests?.length
                            || task.regions?.length || task.anyOfRegions?.length
                            || task.oneOf?.length || task.combatLevel
                            || task.allQuests || task.anySkillLevel || task.questPoints !== undefined
                            || task.manualRequirements?.length,
                          );
                          const skillRequirements = Object.entries(task.skills ?? {});
                          const unmetSkillRequirements = skillRequirements.filter(([skill, level]) =>
                            !meetsSkillRequirement(unlocks, skill, level as number),
                          );
                          const regionRequirements = [
                            ...(task.regions ?? []),
                            ...(task.anyOfRegions ?? []),
                          ].map((region) => ({
                            region,
                            chunk: chunkForPlace(region),
                          }));
                          const hasRequirementActions = unmetSkillRequirements.length > 0
                            || regionRequirements.length > 0;
                          const completionLabel = task.description
                            ? `Complete diary task: ${task.description}`
                            : 'Complete diary task';
                          
                          if (searchTerm && !task.description.toLowerCase().includes(searchTerm.toLowerCase()) && !diary.id.toLowerCase().includes(searchTerm.toLowerCase())) return null;

                          return (
                            <div
                              key={task.id}
                              data-diary-task-row={task.id}
                              className={`w-full flex flex-wrap items-start gap-2 p-2 rounded group ${(isCompleted || isTaskDone) ? 'cursor-default opacity-70' : 'hover:bg-white/5'}`}
                            >
                              <button
                                onClick={(e) => handleTaskToggle(task, e)}
                                disabled={isCompleted || isTaskDone}
                                aria-label={completionLabel}
                                className={`min-w-0 flex-1 flex items-start gap-3 text-left ${(isCompleted || isTaskDone) ? 'cursor-default' : 'cursor-pointer'}`}
                              >
                                <div className={`mt-0.5 ${isTaskDone ? 'text-green-400' : 'text-gray-600 group-hover:text-gray-400'}`}>
                                  {isTaskDone ? <CheckSquare size={14} /> : <Square size={14} />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className={`text-xs ${isTaskDone ? 'text-gray-400 line-through' : 'text-gray-300'}`}>{task.description}</span>
                                  {hasReqs && !isTaskDone && (
                                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                                      {skillRequirements.filter(([skill, level]) => meetsSkillRequirement(unlocks, skill, level as number)).map(([skill, level]) => (
                                        <span key={skill} className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-white/5 text-gray-500 bg-black/30">
                                          <BookOpen size={8} /> {skill} {level as number}
                                        </span>
                                      ))}
                                      {task.items?.map(item => (
                                        <span key={item} className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-white/5 text-gray-500 bg-black/30">
                                          <BookOpen size={8} /> {item}
                                        </span>
                                      ))}
                                      {task.quests?.map(q => {
                                        const met = unlocks.quests.includes(q);
                                        return (
                                          <span key={q} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-white/5 text-gray-500 bg-black/30' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}>
                                            <BookOpen size={8} /> {q}
                                          </span>
                                        );
                                      })}
                                      {task.questPoints !== undefined && (() => {
                                        const label = `Quest Points ${task.questPoints}`;
                                        const met = !taskEligibility.blockers.some(blocker => blocker.label === label);
                                        return <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-white/5 text-gray-500 bg-black/30' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}><BookOpen size={8} /> {label}</span>;
                                      })()}
                                      {task.manualRequirements?.map(requirement => (
                                        <span key={requirement} className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-cyan-500/30 text-cyan-300 bg-cyan-900/10">
                                          <BookOpen size={8} /> Confirm: {requirement}
                                        </span>
                                      ))}
                                      {alternativeLabel && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${taskEligibility.blockers.some(blocker => blocker.kind === 'alternative' && blocker.label === alternativeLabel) ? 'border-red-500/30 text-red-400 bg-red-900/10' : 'border-white/5 text-gray-500 bg-black/30'}`}>
                                          <BookOpen size={8} /> One of: {alternativeLabel}
                                        </span>
                                      )}
                                      {anyRegionAlternativeLabel && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${taskEligibility.blockers.some(blocker => blocker.kind === 'alternative' && blocker.label === anyRegionAlternativeLabel) ? 'border-red-500/30 text-red-400 bg-red-900/10' : 'border-white/5 text-gray-500 bg-black/30'}`}>
                                          <MapPin size={8} /> Any area: {anyRegionAlternativeLabel}
                                        </span>
                                      )}
                                      {[task.combatLevel ? `Combat level ${task.combatLevel}` : undefined, task.allQuests ? 'All quests' : undefined, task.anySkillLevel ? `Any skill ${task.anySkillLevel}` : undefined].filter((label): label is string => Boolean(label)).map(label => {
                                        const met = !taskEligibility.blockers.some(blocker => blocker.label === label);
                                        return <span key={label} className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 ${met ? 'border-white/5 text-gray-500 bg-black/30' : 'border-red-500/30 text-red-400 bg-red-900/10'}`}><BookOpen size={8} /> {label}</span>;
                                      })}
                                    </div>
                                  )}
                                </div>
                              </button>

                              <a
                                href={getDiaryWikiLink(task.tierId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open Wiki for diary task: ${task.description}`}
                                className="shrink-0 text-gray-500 hover:text-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                title="Open Wiki"
                              >
                                <ExternalLink size={10} />
                              </a>

                              {hasRequirementActions && !isTaskDone && (
                                <div className="basis-full flex flex-wrap gap-1.5">
                                  {unmetSkillRequirements.map(([skill, level]) => {
                                    const current = actualSkillLevel(unlocks, skill);
                                    return (
                                      <button
                                        key={skill}
                                        onClick={(e) => setSkillPopover({ skill, requiredLevel: level as number, currentLevel: current, anchorRect: e.currentTarget.getBoundingClientRect() })}
                                        className="text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 border-red-500/30 text-red-400 bg-red-900/10 hover:bg-red-900/20 hover:border-red-400/40 transition-colors cursor-pointer"
                                        title={`Training guide: ${skill}`}
                                      >
                                        <BookOpen size={8} /> {skill} {level as number} <TrendingUp size={7} className="opacity-60" />
                                      </button>
                                    );
                                  })}
                                  {regionRequirements.map(({ region, chunk }) => {
                                    const isUnlocked = isAreaReachable(region, unlocks, gameModeId);
                                    const cls = isUnlocked ? 'border-white/5 text-gray-500 bg-black/30 hover:bg-white/5' : 'border-red-500/30 text-red-400 bg-red-900/10 hover:bg-red-900/20';
                                    return (
                                      <button
                                        key={region}
                                        onClick={() => { if (chunk) showChunkOnMap(chunk.cx, chunk.cy); }}
                                        disabled={!chunk}
                                        title={chunk ? `Show ${region} on the map` : region}
                                        aria-label={chunk ? `Show ${region} on the map` : `${region} is unavailable on the map`}
                                        className={`text-[9px] px-1.5 py-0.5 rounded border flex items-center gap-1 transition-colors ${cls} ${chunk ? 'cursor-pointer' : 'cursor-default'}`}
                                      >
                                        <MapPin size={8} /> {region}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                      })}
                  </div>
              )}
            </div>
          );
        })}
      </div>

      {!suspendModals && skillPopover && (
        <SkillTrainingPopover
          {...skillPopover}
          onClose={() => setSkillPopover(null)}
        />
      )}
    </div>
  );
};
