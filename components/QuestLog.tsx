
import React, { useState, useMemo, useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { QUEST_DATA, QuestData } from '../data/questData';
import { WIKI_OVERRIDES } from '../constants';
import { CheckCircle2, Lock, Map, BookOpen, Sparkles, Scroll, Bookmark, Layers, List, ExternalLink, ArrowUpRight, TrendingUp, MapPin } from 'lucide-react';
import { chunkContentService } from '../services/ChunkContentService';
import { questLocations, QuestLocationInfo } from '../utils/questLocations';
import { showChunkOnMap } from '../utils/chunkLocations';
import { isAlmostThere } from '../utils/journalProgress';
import {
  evaluateQuestEligibility,
  meetsSkillRequirement,
  questRequirementOptionLabel,
} from '../utils/journalStatus';
import { requestManualAttestation } from '../utils/manualAttestation';
import { effectiveSkillLevel } from '../utils/slayerReach';
import { DropSource, UnlockState } from '../types';
import { JournalFilterBar, JournalStatus } from './JournalFilterBar';
import { QuestAdvisorPanel } from './QuestAdvisorPanel';
import { rankAvailableQuests } from '../utils/questAdvisor';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { SkillTrainingPopover, SkillPopoverState } from './SkillTrainingPopover';
import { QuestInsights } from './JournalInsights';

interface QuestLogProps {
  searchTerm?: string;
  suspendModals?: boolean;
}

export const questLogEligibility = (
  quest: QuestData,
  unlocks: UnlockState,
  gameModeId?: string,
) => evaluateQuestEligibility(quest, unlocks, gameModeId);

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

// Solid accent colour for the card's left edge — a strong difficulty signal.
const getDifficultyAccent = (difficulty: DropSource) => {
    if (difficulty === DropSource.QUEST_GRANDMASTER) return 'bg-yellow-400';
    if (difficulty === DropSource.QUEST_MASTER) return 'bg-purple-400';
    if (difficulty === DropSource.QUEST_EXPERIENCED) return 'bg-red-400';
    if (difficulty === DropSource.QUEST_INTERMEDIATE) return 'bg-blue-400';
    return 'bg-green-400'; // Novice
};

const getDifficultyLabel = (difficulty: DropSource) => {
    return difficulty.replace('Quest (', '').replace(')', '');
};

// QuestCard Component
interface QuestCardProps {
    quest: any; // Augmented QuestData with status
    unlocks: any;
    gameModeId?: string;
    currentQP: number;
    onToggle: (e: React.MouseEvent, quest: any) => void;
    highlight?: boolean;
    /** Called when the player clicks a missing prereq quest chip — parent scrolls to it. */
    onPrereqClick?: (questId: string) => void;
    /** Called when the player clicks an unmet skill chip — parent shows the training popover. */
    onSkillClick?: (skill: string, required: number, current: number, rect: DOMRect) => void;
}

const QuestCard: React.FC<QuestCardProps> = ({ quest, unlocks, gameModeId, currentQP, onToggle, highlight, onPrereqClick, onSkillClick }) => {
    const isCompleted = quest.status === 'COMPLETED';
    const isAvailable = quest.status === 'AVAILABLE';
    const diffStyle = getDifficultyColor(quest.difficulty);

    const eligibility = quest.eligibility;

    // "Almost there" — locked by exactly one canonical requirement (a quick win).
    const unmet = !isCompleted && !isAvailable ? eligibility.blockers : [];
    const almost = isAlmostThere(unmet);

    // Chunk-derived locations remain informational map links only. Canonical
    // access is entirely determined by evaluateQuestEligibility.
    const loc: QuestLocationInfo = questLocations(quest.name, unlocks, gameModeId);

    // Req-met accounting — drives the progress bar shown on LOCKED cards so
    // players can see at a glance how close they are without counting chips.
    const regionReqs: string[] = quest.regions;
    const metRegions = regionReqs.filter((region: string) =>
      eligibility.evidence.includes(region));
    const locationReqs = quest.locations ?? [];
    const metLocations = locationReqs.filter((location: { label: string }) =>
      eligibility.evidence.includes(location.label));
    const skillReqs = Object.entries(quest.skills as Record<string, number>);
    const metSkills = skillReqs.filter(([skill, lvl]) =>
      eligibility.evidence.includes(skill + ' ' + lvl));
    const combatReqs = quest.combatLevel === undefined ? [] : [quest.combatLevel];
    const metCombat = combatReqs.filter((level: number) =>
      eligibility.evidence.includes('Combat level ' + level));
    const prereqReqs: string[] = quest.prereqs || [];
    const metPrereqs = prereqReqs.filter((qid: string) =>
      eligibility.evidence.includes(qid));
    const hasAlternative = Boolean(quest.oneOf?.length);
    const alternativeLabel = hasAlternative
      ? quest.oneOf.map(questRequirementOptionLabel).join(' or ')
      : '';
    const alternativeMet = !hasAlternative || !eligibility.blockers.some(
      (blocker: { kind: string; label: string }) =>
        blocker.kind === 'region' && blocker.label === alternativeLabel,
    );
    const totalReqs = regionReqs.length + locationReqs.length + skillReqs.length +
      combatReqs.length + prereqReqs.length + (hasAlternative ? 1 : 0);
    const totalMet = metRegions.length + metLocations.length + metSkills.length +
      metCombat.length + metPrereqs.length + (hasAlternative && alternativeMet ? 1 : 0);
    const reqPct = totalReqs === 0 ? 100 : Math.round((totalMet / totalReqs) * 100);

    return (
      <div
          data-journal-id={quest.id}
          className={`
              group relative border rounded-lg p-3 pl-4 overflow-hidden transition-all duration-200
              hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40
              ${isCompleted ? 'bg-green-900/10 border-green-500/20 opacity-60 hover:opacity-100' :
                isAvailable ? 'bg-blue-900/10 border-blue-500/40 hover:bg-blue-900/20' :
                'bg-[#1a1a1a] border-white/5 opacity-80 hover:opacity-100'}
              ${highlight ? 'ring-2 ring-amber-400/70 shadow-[0_0_20px_rgba(251,191,36,0.25)]' : ''}
          `}
      >
          {/* Difficulty accent edge */}
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${getDifficultyAccent(quest.difficulty)} ${isCompleted ? 'opacity-40' : 'opacity-80 group-hover:opacity-100'}`} />
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

                  {/*
                    Chip strategy: met requirements render in dim gray (bg-black/30
                    text-gray-500) so the eye ignores them. Failing requirements stay
                    red so the actual blockers stand out immediately.
                    Missing prereq quest chips are amber + clickable → scroll to that
                    quest in the list (onPrereqClick).
                  */}
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {quest.regions.map((region: string) => {
                          const met = isCompleted || eligibility.evidence.includes(region);
                          return (
                              <span key={region} className={'text-[10px] px-1.5 rounded flex items-center gap-1 border ' +
                                (met
                                  ? 'bg-black/30 text-gray-500 border-white/5'
                                  : 'bg-red-900/10 text-red-400 border-red-500/20')}>
                                  <Map size={8} /> {region}
                              </span>
                          );
                      })}
                      {locationReqs.map((location: { id: string; label: string }) => {
                          const met = isCompleted || eligibility.evidence.includes(location.label);
                          return (
                              <span key={location.id} className={'text-[10px] px-1.5 rounded flex items-center gap-1 border ' +
                                (met
                                  ? 'bg-black/30 text-gray-500 border-white/5'
                                  : 'bg-red-900/10 text-red-400 border-red-500/20')}>
                                  <MapPin size={8} /> {location.label}
                              </span>
                          );
                      })}
                      {combatReqs.map((level: number) => {
                          const met = isCompleted || eligibility.evidence.includes('Combat level ' + level);
                          return (
                              <span key={'combat:' + level} className={'text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border ' +
                                (met
                                  ? 'bg-black/30 text-gray-500 border-white/5'
                                  : 'bg-red-900/10 text-red-400 border-red-500/20')}>
                                  <BookOpen size={8} /> Combat level {level}
                              </span>
                          );
                      })}
                      {(quest.manualRequirements ?? []).map((requirement: string) => (
                          <span key={'manual:' + requirement}
                            className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border bg-cyan-900/10 text-cyan-300/80 border-cyan-500/20"
                            title="Manual requirement — shown for reference and not checked automatically">
                              <Bookmark size={8} /> {requirement}
                          </span>
                      ))}
                      {/* Informational chunk-derived locations only: click to inspect
                          the map. These chips do not change canonical eligibility. */}
                      {!isCompleted && loc.hasData && loc.places.slice(0, 4).map((p) => (
                          <button
                              key={`loc:${p.label}`}
                              onClick={(e) => { e.stopPropagation(); showChunkOnMap(p.cx, p.cy); }}
                              className={`text-[10px] px-1.5 rounded flex items-center gap-1 border transition-colors cursor-pointer ${
                                p.unlocked
                                  ? 'bg-emerald-900/10 text-emerald-400/80 border-emerald-500/20 hover:bg-emerald-900/25'
                                  : 'bg-red-900/10 text-red-400 border-red-500/30 hover:bg-red-900/25'}`}
                              title={`${p.label} — ${p.unlocked ? 'unlocked' : 'locked'}${p.role === 'first' ? ' · quest starts here' : ''} (show on map)`}
                          >
                              <MapPin size={8} /> {p.subArea ?? p.region ?? p.label}
                              {p.role === 'first' && <span className="text-cyan-300/80">★</span>}
                          </button>
                      ))}
                      {!isCompleted && loc.places.length > 4 && (
                          <span className="text-[10px] px-1 text-gray-600">+{loc.places.length - 4}</span>
                      )}
                      {hasAlternative && (
                        <span className={'text-[10px] px-2 py-1 rounded border ' +
                          (alternativeMet
                            ? 'bg-black/30 border-white/5 text-gray-500'
                            : 'bg-red-900/20 border-red-500/30 text-red-300')}>
                          One of: {quest.oneOf.map(questRequirementOptionLabel).join(' or ')}
                        </span>
                      )}
                      {Object.entries(quest.skills).map(([skill, lvl]) => {
                          const reqLevel = lvl as number;
                          let met = false;
                          let isLocked = false;
                          let currentLevel = 1;

                          if (skill === 'Quest Points') {
                              met = currentQP >= reqLevel;
                              currentLevel = currentQP;
                          } else {
                              currentLevel = effectiveSkillLevel(unlocks, skill);
                              const skillUnlocked = (unlocks.skills[skill] || 0) > 0;
                              isLocked = !skillUnlocked;
                              met = meetsSkillRequirement(unlocks, skill, reqLevel);
                          }

                          if (isCompleted || met) {
                              return (
                                  <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border bg-black/30 text-gray-500 border-white/5">
                                      {skill === 'Quest Points' ? <Sparkles size={8} /> : <BookOpen size={8} />}
                                      {skill === 'Quest Points' ? 'QP' : skill} {reqLevel}
                                  </span>
                              );
                          }
                          // Unmet skill → clickable button that opens the training popover
                          return (
                              <button
                                  key={skill}
                                  onClick={(e) => {
                                      e.stopPropagation();
                                      onSkillClick?.(skill, reqLevel, currentLevel, e.currentTarget.getBoundingClientRect());
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border bg-red-900/10 text-red-400 border-red-500/20 hover:bg-red-900/20 hover:border-red-400/40 transition-colors cursor-pointer"
                                  title={`Training guide: ${skill}`}
                              >
                                  {skill === 'Quest Points' ? <Sparkles size={8} /> : <BookOpen size={8} />}
                                  {skill === 'Quest Points' ? 'QP' : skill} {reqLevel}
                                  {isLocked && <Lock size={8} className="ml-0.5" />}
                                  <TrendingUp size={7} className="ml-0.5 opacity-60" />
                              </button>
                          );
                      })}
                      {/* Prereq quest chips. Completed prereqs are dim-gray; missing
                          ones are amber + clickable so the player can jump straight to
                          that quest in the list without manually searching. */}
                      {prereqReqs.map((qid: string) => {
                          const met = isCompleted || unlocks.quests.includes(qid);
                          if (met) {
                              return (
                                  <span key={qid} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border bg-black/30 text-gray-500 border-white/5">
                                      <Scroll size={8} /> {qid}
                                  </span>
                              );
                          }
                          return (
                              <button
                                  key={qid}
                                  onClick={(e) => { e.stopPropagation(); onPrereqClick?.(qid); }}
                                  className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 border bg-amber-900/10 text-amber-400 border-amber-500/30 hover:bg-amber-900/25 transition-colors cursor-pointer"
                                  title={`Jump to prerequisite: ${qid}`}
                              >
                                  <Scroll size={8} /> {qid} <ArrowUpRight size={7} />
                              </button>
                          );
                      })}
                  </div>
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

          {/* LOCKED card footer: req progress bar replaces the old plain-text
              status labels. The coloured chips above already communicate the
              specific blockers; the bar gives an at-a-glance % completion. */}
          {!isCompleted && !isAvailable && totalReqs > 0 && (
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
                  {almost && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center gap-1 shrink-0 animate-pulse">
                          <Sparkles size={8} /> Almost — {unmet[0].label}
                      </span>
                  )}
                  <div className="flex-1 h-1 bg-black/40 rounded-full overflow-hidden">
                      <div
                          className="h-full bg-amber-500/60 transition-all duration-500"
                          style={{ width: `${reqPct}%` }}
                      />
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono whitespace-nowrap shrink-0">
                      {totalMet}/{totalReqs} reqs
                  </span>
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

export const QuestLog: React.FC<QuestLogProps> = ({ searchTerm: externalSearch = '', suspendModals = false }) => {
  const { unlocks, completeQuest, advisorsEnabled, gameModeId } = useGame();
  // Filter state is persisted in localStorage so returning players don't have
  // to re-apply their preferred view every session.
  const [filter, setFilter] = useLocalStorage<JournalStatus>('jrnl:quest:filter', 'ALL');
  const [groupBySeries, setGroupBySeries] = useLocalStorage<boolean>('jrnl:quest:group', false);
  const [advisorMode, setAdvisorMode] = useLocalStorage<boolean>('jrnl:quest:advisor', false);
  const [localSearch, setLocalSearch] = useState('');
  const [regionFilter, setRegionFilter] = useLocalStorage<string>('jrnl:quest:region', 'ALL');
  const [diffFilter, setDiffFilter] = useLocalStorage<string>('jrnl:quest:diff', 'ALL');
  const [sortMode, setSortMode] = useLocalStorage<string>('jrnl:quest:sort', 'SMART');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [skillPopover, setSkillPopover] = useState<SkillPopoverState | null>(null);
  // Chunk content powers the per-quest sub-area refinement; lazy-load it once,
  // then bump a tick so statuses recompute against the now-ready index.
  const [chunkTick, setChunkTick] = useState(0);
  useEffect(() => {
    if (chunkContentService.ready) { setChunkTick(t => t + 1); return; }
    chunkContentService.init().then(ok => { if (ok) setChunkTick(t => t + 1); });
  }, []);

  // focusCard is called from:
  //   • the "Next up" strip (same-tab, no filter clearing needed)
  //   • prereq quest chip clicks (may need to clear filters so the target is visible)
  // We clear all filters first, then schedule the scroll after React re-renders.
  const focusCard = (id: string) => {
    setFilter('ALL');
    setRegionFilter('ALL');
    setHighlightedId(id);
    // Brief timeout lets the state change flush + React re-render before we
    // query the DOM — ensures the card exists when we try to scroll to it.
    window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-journal-id="${id}"]`);
      if (el) {
        el.style.scrollMarginTop = '8px';
        el.scrollIntoView({ block: 'start', behavior: 'smooth' }); // header in view, not centred
      }
      window.setTimeout(() => setHighlightedId(null), 1800);
    }, 50);
  };

  // Focus a specific quest card when asked from elsewhere (journal feed).
  useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ id?: string }>).detail?.id;
      if (id && QUEST_DATA[id]) focusCard(id);
    };
    window.addEventListener('fate:journal-focus', onFocus);
    return () => window.removeEventListener('fate:journal-focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // External search (from the dashboard's global search box) takes precedence
  // when set so cross-tab search still works; otherwise the bar's own search
  // input drives.
  const searchTerm = externalSearch || localSearch;

  const allQuests = useMemo(() => {
    return Object.values(QUEST_DATA).map(q => {
      const eligibility = questLogEligibility(q, unlocks, gameModeId);
      return { ...q, status: eligibility.status, eligibility };
    }).sort((a, b) => {
        const score = (s: string) => s === 'AVAILABLE' ? 0 : s.includes('LOCKED') ? 1 : 2;
        return score(a.status) - score(b.status) || a.name.localeCompare(b.name);
    });
    // chunkTick: refresh informational map-location chips once the chunk index loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocks, gameModeId, chunkTick]);

  const filteredQuests = useMemo(() => {
    const diffRank = (d: DropSource) =>
      d === DropSource.QUEST_GRANDMASTER ? 5 : d === DropSource.QUEST_MASTER ? 4
        : d === DropSource.QUEST_EXPERIENCED ? 3 : d === DropSource.QUEST_INTERMEDIATE ? 2 : 1;
    const list = allQuests.filter(q => {
      const matchesSearch = q.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;
      if (regionFilter !== 'ALL' && !q.regions.includes(regionFilter)) return false;
      if (diffFilter !== 'ALL' && getDifficultyLabel(q.difficulty) !== diffFilter) return false;
      if (filter === 'COMPLETED') return q.status === 'COMPLETED';
      if (filter === 'AVAILABLE') return q.status === 'AVAILABLE';
      if (filter === 'LOCKED') return q.status.includes('LOCKED');
      return true;
    });
    if (sortMode === 'NAME') return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortMode === 'QP') return [...list].sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
    if (sortMode === 'DIFFICULTY') return [...list].sort((a, b) => diffRank(a.difficulty) - diffRank(b.difficulty) || a.name.localeCompare(b.name));
    return list; // SMART: status-major order from allQuests
  }, [allQuests, searchTerm, regionFilter, diffFilter, filter, sortMode]);

  // Region pills built from the regions actually used by quests, sorted.
  const questRegions = useMemo(
    () => Array.from(new Set(allQuests.flatMap((q) => q.regions))).sort(),
    [allQuests],
  );

  // Counts per status for the bar's pills.
  const statusCounts = useMemo(() => ({
    ALL: allQuests.length,
    AVAILABLE: allQuests.filter((q) => q.status === 'AVAILABLE').length,
    LOCKED: allQuests.filter((q) => q.status.includes('LOCKED')).length,
    COMPLETED: allQuests.filter((q) => q.status === 'COMPLETED').length,
  }), [allQuests]);

  // Quest Impact Advisor — ranked by unlock score. Only computed when the
  // panel is visible (advisor mode + not filtering) to avoid running O(n²)
  // simulations on every keystroke while the player is searching.
  const showAdvisorStrip = advisorsEnabled && !searchTerm && filter === 'ALL' && regionFilter === 'ALL' && advisorMode;
  const rankedQuests = useMemo(
    () => (showAdvisorStrip ? rankAvailableQuests(unlocks, gameModeId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAdvisorStrip, unlocks, gameModeId],
  );

  const mainQuests = filteredQuests.filter(q => q.kind === 'quest');
  const miniquests = filteredQuests.filter(q => q.kind === 'miniquest');

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
      const eligibility = evaluateQuestEligibility(quest, unlocks, gameModeId);
      const attestation = requestManualAttestation(
        quest.name,
        eligibility,
        message => window.confirm(message),
      );
      if (attestation === null) return;
      const result = completeQuest(quest.id, e.clientX, e.clientY, attestation);
      if (!result.ok) return;

      // Celebration overlay (QuestCompleteOverlay) shows the wiki reward scroll.
      window.dispatchEvent(new CustomEvent('fate:quest-complete', { detail: { name: quest.name } }));
  };

  const totalQuests = Object.values(QUEST_DATA).filter(q => q.kind === 'quest').length;
  const totalMinis = Object.values(QUEST_DATA).filter(q => q.kind === 'miniquest').length;
  const completedMain = unlocks.quests.filter(id => QUEST_DATA[id]?.kind === 'quest').length;
  const completedMinis = unlocks.quests.filter(id => QUEST_DATA[id]?.kind === 'miniquest').length;
  const currentQP = unlocks.quests.reduce((acc, qid) => acc + (
    QUEST_DATA[qid]?.kind === 'quest' ? QUEST_DATA[qid].points : 0
  ), 0);

  return (
    <div className="bg-[#121212] flex flex-col h-full rounded-lg border border-white/10 overflow-hidden">
      <JournalFilterBar
        title="Quest Journal"
        icon={<BookOpen size={14} />}
        accent="bg-blue-900/40 text-blue-300"
        searchValue={externalSearch || localSearch}
        onSearchChange={setLocalSearch}
        searchPlaceholder="Search quests..."
        status={filter}
        onStatusChange={setFilter}
        statusCounts={statusCounts}
        completed={completedMain + completedMinis}
        total={totalQuests + totalMinis}
        regions={questRegions}
        activeRegion={regionFilter}
        onRegionChange={setRegionFilter}
        tiers={[
          { id: 'Novice', colorClass: 'bg-green-900/40 text-green-300' },
          { id: 'Intermediate', colorClass: 'bg-cyan-900/40 text-cyan-300' },
          { id: 'Experienced', colorClass: 'bg-blue-900/40 text-blue-300' },
          { id: 'Master', colorClass: 'bg-purple-900/40 text-purple-300' },
          { id: 'Grandmaster', colorClass: 'bg-amber-900/40 text-amber-300' },
        ]}
        activeTier={diffFilter}
        onTierChange={setDiffFilter}
        rightExtras={
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-blue-300 font-mono font-bold whitespace-nowrap">QP {currentQP}</span>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              className="bg-black/40 border border-white/10 rounded text-[10px] text-gray-300 px-1 py-1 focus:outline-none focus:border-white/30"
              title="Sort quests"
              aria-label="Sort quests"
            >
              <option value="SMART">Smart</option>
              <option value="NAME">A–Z</option>
              <option value="QP">Quest Points</option>
              <option value="DIFFICULTY">Difficulty</option>
            </select>
            <button
              onClick={() => setAdvisorMode(!advisorMode)}
              className={`p-1 rounded border text-[10px] flex items-center gap-1 ${advisorMode ? 'bg-violet-900/40 border-violet-500/40 text-violet-300' : 'bg-black/40 border-white/10 text-gray-500 hover:text-white'}`}
              title={advisorMode ? 'Switch to Quick Wins (by difficulty)' : 'Switch to High Impact (by unlock count)'}
            >
              <TrendingUp size={12} />
            </button>
            <button
              onClick={() => setGroupBySeries(!groupBySeries)}
              className={`p-1 rounded border text-[10px] flex items-center gap-1 ${groupBySeries ? 'bg-purple-900/40 border-purple-500/40 text-purple-300' : 'bg-black/40 border-white/10 text-gray-500 hover:text-white'}`}
              title={groupBySeries ? 'Group by Type (Main/Mini)' : 'Group by Series'}
            >
              {groupBySeries ? <Layers size={12} /> : <List size={12} />}
            </button>
          </div>
        }
      />

      {advisorsEnabled && <QuestInsights />}

      {showAdvisorStrip && (
        <QuestAdvisorPanel
          ranked={rankedQuests}
          onItemClick={focusCard}
        />
      )}

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
                                    gameModeId={gameModeId}
                                    unlocks={unlocks}
                                    currentQP={currentQP}
                                    onToggle={handleQuestToggle}
                                    highlight={highlightedId === quest.id}
                                    onPrereqClick={focusCard}
                                    onSkillClick={(skill, req, cur, rect) =>
                                        setSkillPopover({ skill, requiredLevel: req, currentLevel: cur, anchorRect: rect })
                                    }
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
                                    gameModeId={gameModeId}
                                    unlocks={unlocks}
                                    currentQP={currentQP}
                                    onToggle={handleQuestToggle}
                                    highlight={highlightedId === quest.id}
                                    onPrereqClick={focusCard}
                                    onSkillClick={(skill, req, cur, rect) =>
                                        setSkillPopover({ skill, requiredLevel: req, currentLevel: cur, anchorRect: rect })
                                    }
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
                                    gameModeId={gameModeId}
                                    unlocks={unlocks}
                                    currentQP={currentQP}
                                    onToggle={handleQuestToggle}
                                    highlight={highlightedId === quest.id}
                                    onPrereqClick={focusCard}
                                    onSkillClick={(skill, req, cur, rect) =>
                                        setSkillPopover({ skill, requiredLevel: req, currentLevel: cur, anchorRect: rect })
                                    }
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

      {!suspendModals && skillPopover && (
        <SkillTrainingPopover
          {...skillPopover}
          onClose={() => setSkillPopover(null)}
        />
      )}
    </div>
  );
};
