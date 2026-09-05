import React, { useMemo, useState, useEffect } from 'react';
import {
  Target, Search, X, MapPin, BookOpen, Award, Dumbbell,
  CheckCircle2, Circle, ArrowRight, Star, Compass, Route,
} from 'lucide-react';
import { useGame } from '../context/GameContext';
import { wikiUrlFor } from '../constants';
import {
  listGoalTargets, planForTarget, GoalTarget, GoalPlan, PlanStep, GoalKind,
  AlternativePlanStep,
} from '../utils/goalPlanner';
import { evaluateDiaryTaskEligibility, evaluateQuestEligibility, getDiaryStatus, getQuestStatus } from '../utils/journalStatus';
import { isAreaReachable } from '../utils/reachability';
import { QUEST_DATA } from '../data/questData';
import { ALL_DIARY_TASKS } from '../data/diaryTasks';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { DIARY_DATA } from '../data/diaryData';
import { SectionGuide } from './SectionGuide';
import { UnlockState } from '../types';
import { QuestRoutePanel } from './questRoutes/QuestRoutePanel';
import { RuneProofErrorBoundary } from './questRoutes/RuneProofErrorBoundary';
import { isQuestAnalysisUsable } from '../utils/questRoutes/analysisValidation';
import { analyzeQuest } from '../utils/questRoutes/analyzeQuest';
import { reviewedQuestRequirements } from '../data/questItemRequirements';
import {
  loadQuestStrategyCatalogue,
  loadQuestWalkthroughFor,
} from '../data/questWalkthroughLoader';
import type { QuestWalkthroughRelease } from '../data/questWalkthroughRelease';
import {
  CHUNK_CONTENT_DATA_VERSION,
  chunkContentService,
} from '../services/ChunkContentService';
import { runeProofAvailability } from '../utils/questRoutes/featureFlag';
import { buildQuestRequirementChecklist } from '../utils/questRoutes/requirementChecklist';
import { useRuneProofPreviewChecks } from '../hooks/useRuneProofPreviewChecks';
import { useRuneProofPreviewActions } from '../hooks/useRuneProofPreviewActions';
import { RuneProofCoach } from './questStrategies/RuneProofCoach';
import { buildRuneProofCoachModel } from '../utils/questStrategies/coach';
import type { QuestStrategyDefinition } from '../utils/questStrategies/model';
import {
  questStrategyProgress,
  rankRuneProofObjectives,
  type RuneProofObjectiveCandidate,
} from '../utils/questStrategies/objectives';
import { RuneProofObjectivePicker } from './questStrategies/RuneProofObjectivePicker';
import type { ConnectGraph } from '../services/ChunkContentService';
import {
  canonicalRuneProofAccountIdentity,
  materializeQuestRouteSnapshot,
  materializeRuneProofAccount,
  type RuneProofIntegration,
  type RuneProofRenderState,
  type RuneProofRequestIdentity,
} from '../utils/questRoutes/goalPlannerRuneProof';

export type { RuneProofIntegration } from '../utils/questRoutes/goalPlannerRuneProof';

type RuneProofPlannerState =
  | (Extract<RuneProofRenderState, { unavailable: false }> & {
      readonly strategy: QuestStrategyDefinition | null;
      readonly connectGraph: ConnectGraph;
    })
  | (Extract<RuneProofRenderState, { unavailable: true }> & {
      readonly strategy: null;
      readonly connectGraph?: undefined;
    });

interface RuneProofActionHydrationScope {
  readonly runId: string;
  readonly strategies: readonly QuestStrategyDefinition[];
}

interface RuneProofCoachWorkspaceProps {
  readonly strategy: QuestStrategyDefinition;
  readonly analysis: Extract<RuneProofRenderState, { unavailable: false }>['analysis'];
  readonly connectGraph: ConnectGraph;
  readonly confirmedItemKeys: ReadonlySet<string>;
  readonly confirmedActionIds: ReadonlySet<string>;
  readonly completedQuestIds: ReadonlySet<string>;
  readonly onSetItemConfirmed: (questId: string, itemKey: string, confirmed: boolean) => void;
  readonly onSetActionConfirmed: (questId: string, actionId: string, confirmed: boolean) => void;
}

const RuneProofCoachWorkspace: React.FC<RuneProofCoachWorkspaceProps> = ({
  strategy,
  analysis,
  connectGraph,
  confirmedItemKeys,
  confirmedActionIds,
  completedQuestIds,
  onSetItemConfirmed,
  onSetActionConfirmed,
}) => {
  const model = useMemo(() => buildRuneProofCoachModel({
    strategy,
    analysis,
    connectGraph,
    confirmedItemKeys,
    confirmedActionIds,
    completedQuestIds,
  }), [
    analysis,
    completedQuestIds,
    confirmedItemKeys,
    confirmedActionIds,
    connectGraph,
    strategy,
  ]);
  const handleConfirmAction = React.useCallback((actionId: string) => {
    const action = strategy.actions.find(candidate => candidate.id === actionId);
    if (!action) return;

    if (action.coach.completion.kind === 'ITEM_CONFIRMED') {
      onSetItemConfirmed(strategy.questId, action.coach.completion.itemKey, true);
      return;
    }
    onSetActionConfirmed(strategy.questId, actionId, true);
  }, [onSetActionConfirmed, onSetItemConfirmed, strategy]);

  return (
    <RuneProofCoach
      model={model}
      onConfirmAction={handleConfirmAction}
    />
  );
};

/**
 * Goal Planner — the reverse of the advisors.
 *
 * The player picks any target (a quest, diary tier, or region) and gets the
 * full ordered roadmap to unlock it: regions to open, skill levels to train,
 * and every prerequisite quest sequenced so prereqs always come first.
 *
 * All reasoning lives in utils/goalPlanner.ts; this is purely presentational.
 */

interface Props {
  onClose: () => void;
  onOpenWorldChunk?: (cx: number, cy: number) => void;
  /** Pre-select a target when opened from elsewhere (e.g. the journal feed). */
  initialTarget?: { kind: GoalKind; id: string } | null;
  runeProof?: RuneProofIntegration;
}

const DEFAULT_RUNEPROOF: RuneProofIntegration = {
  availability: runeProofAvailability((import.meta as any).env ?? {}),
  chunkDataVersion: CHUNK_CONTENT_DATA_VERSION,
  contentService: chunkContentService,
  analyze: analyzeQuest,
  loadWalkthrough: loadQuestWalkthroughFor,
};

const EMPTY_RUNE_PROOF_STRATEGIES: readonly QuestStrategyDefinition[] = Object.freeze([]);

const KIND_META: Record<GoalKind, { icon: React.ReactNode; label: string; color: string }> = {
  quest: { icon: <BookOpen size={13} />, label: 'Quest', color: 'text-blue-300' },
  diary: { icon: <Award size={13} />, label: 'Diary', color: 'text-green-300' },
  region: { icon: <MapPin size={13} />, label: 'Region', color: 'text-emerald-300' },
};

// Status of a target in the current snapshot — drives the picker dot.
export type TargetState = 'done' | 'ready' | 'confirm' | 'locked';

const objectiveReadinessFor = (
  state: TargetState,
): RuneProofObjectiveCandidate['readiness'] => {
  switch (state) {
    case 'ready': return 'READY';
    case 'confirm': return 'CONFIRM';
    case 'locked':
    case 'done': return 'BLOCKED';
  }
};

function targetState(t: GoalTarget, unlocks: any, gameModeId?: string): TargetState {
  if (t.kind === 'quest') {
    const s = getQuestStatus(QUEST_DATA[t.id], unlocks, gameModeId);
    return s === 'COMPLETED' ? 'done' : s === 'AVAILABLE' ? 'ready' : 'locked';
  }
  if (t.kind === 'diary') {
    const s = getDiaryStatus(DIARY_DATA[t.id], unlocks, gameModeId);
    return s === 'COMPLETED' ? 'done' : s === 'AVAILABLE' ? 'ready' : 'locked';
  }
  return isAreaReachable(t.id, unlocks, gameModeId) ? 'done' : 'locked';
}

export function goalPlannerTargetState(
  target: GoalTarget,
  unlocks: UnlockState,
  gameModeId?: string,
): TargetState {
  if (target.kind === 'quest') {
    const eligibility = evaluateQuestEligibility(QUEST_DATA[target.id], unlocks, gameModeId);
    if (eligibility.status === 'COMPLETED') return 'done';
    if (eligibility.eligible) return 'ready';
    return eligibility.confirmable && eligibility.manualChecks.length > 0 ? 'confirm' : 'locked';
  }
  if (target.kind === 'diary') {
    if (unlocks.diaries.includes(target.id)) return 'done';
    const taskEligibilities = ALL_DIARY_TASKS.filter(task => (
      task.tierId === target.id && !unlocks.completedTasks.includes(task.id)
    )).map(task => evaluateDiaryTaskEligibility(task, unlocks, gameModeId));
    if (taskEligibilities.every(eligibility => eligibility.eligible)) return 'ready';
    return taskEligibilities.every(eligibility => eligibility.machineEligible)
      && taskEligibilities.some(eligibility => eligibility.manualChecks.length > 0) ? 'confirm' : 'locked';
  }
  return isAreaReachable(target.id, unlocks, gameModeId) ? 'done' : 'locked';
}

const STATE_DOT: Record<TargetState, string> = {
  done: 'bg-emerald-500',
  ready: 'bg-amber-400',
  confirm: 'bg-violet-400',
  locked: 'bg-gray-600',
};

const STEP_ICON: Record<PlanStep['kind'], React.ReactNode> = {
  region: <MapPin size={12} />,
  skill: <Dumbbell size={12} />,
  qp: <Star size={12} />,
  quest: <BookOpen size={12} />,
  manual: <Compass size={12} />,
};

/** OSRS Wiki article for a step. Region display labels can contain surface
 *  aliases, so they link by the canonical step id. QP links to its overview;
 *  quest articles surface their
 *  quick-guide link at the top, so this doubles as a "how do I do this" jump. */
export const goalPlannerStepWikiHref = (step: PlanStep): string =>
  wikiUrlFor(step.kind === 'qp' ? 'Quest points' : step.kind === 'region' ? step.id : step.label);

export const goalPlannerStepHasWikiLink = (step: PlanStep): boolean =>
  step.kind !== 'manual' && !step.id.startsWith('alternative:');

const StepRow: React.FC<{ step: PlanStep; index?: number }> = ({ step, index }) => (
  <div
    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border text-left transition-colors ${
      step.done
        ? 'bg-emerald-950/20 border-emerald-500/15'
        : 'bg-[#1a1a1a] border-white/5'
    }`}
  >
    {step.done ? (
      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" aria-hidden />
    ) : (
      <Circle size={14} className="text-gray-600 shrink-0" aria-hidden />
    )}
    {typeof index === 'number' && (
      <span className="text-[9px] font-mono font-bold text-gray-600 w-4 shrink-0 text-right" aria-hidden>
        {index}.
      </span>
    )}
    <span className="text-gray-500 shrink-0" aria-hidden>{STEP_ICON[step.kind]}</span>
    {goalPlannerStepHasWikiLink(step) ? (
      <a
        href={goalPlannerStepWikiHref(step)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title={`Open ${step.label} on the OSRS Wiki`}
        className={`text-[11px] font-semibold truncate flex-1 hover:underline transition-colors ${
          step.done ? 'text-gray-500 line-through hover:text-gray-400' : 'text-gray-200 hover:text-cyan-300'
        }`}
      >
        {step.label}
      </a>
    ) : (
      <span
        className={`text-[11px] font-semibold truncate flex-1 ${
          step.done ? 'text-gray-500 line-through' : 'text-gray-200'
        }`}
      >
        {step.label}
      </span>
    )}
    {step.detail && (
      <span className="text-[9px] text-gray-500 font-mono shrink-0">{step.detail}</span>
    )}
  </div>
);

const PlanSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  steps: PlanStep[];
  numbered?: boolean;
}> = ({ title, icon, steps, numbered }) => {
  if (steps.length === 0) return null;
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <span className="text-gray-400" aria-hidden>{icon}</span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">{title}</span>
        <span className="text-[9px] text-gray-600 font-mono">{doneCount}/{steps.length}</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <div className="space-y-1">
        {steps.map((s, i) => (
          <StepRow key={`${s.kind}:${s.id}`} step={s} index={numbered ? i + 1 : undefined} />
        ))}
      </div>
    </div>
  );
};

const AlternativeSection: React.FC<{ steps: AlternativePlanStep[] }> = ({ steps }) => {
  if (steps.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5 px-0.5">
        <Route size={12} className="text-gray-400" aria-hidden />
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">Alternative routes</span>
        <span className="text-[9px] text-gray-600 font-mono">choose one</span>
        <div className="flex-1 h-px bg-white/5" />
      </div>
      <div className="space-y-1.5">
        {steps.map(step => (
          <div key={step.id} className="rounded-md border border-white/5 bg-[#1a1a1a] px-2.5 py-2">
            <div className="text-[10px] font-semibold text-gray-300 mb-1">{step.label}</div>
            <div className="space-y-1">
              {step.routes.map(route => (
                <div key={route.label} className="flex items-start gap-1.5 text-[10px] text-gray-400">
                  <Circle size={10} className="text-gray-600 mt-0.5 shrink-0" aria-hidden />
                  <span>
                    <span className="text-gray-200">{route.label}</span>
                    {route.blockers.length > 0 && (
                      <span className="text-gray-600"> ? {route.blockers.map(blocker => (
                        blocker.label + (blocker.detail ? ' ' + blocker.detail : '')
                      )).join(' + ')}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const GoalPlanReadiness: React.FC<{ plan: GoalPlan }> = ({ plan }) => {
  if (plan.alreadyDone) return <>{'Already complete \u2014 nothing left to do!'}</>;
  if (plan.alreadyReachable && plan.targetKind !== 'region') {
    return <>{'Available right now \u2014 go do it!'}</>;
  }
  if (plan.needsConfirmation) {
    return <>
      Needs confirmation: {plan.manualSteps.map(step => step.label).join(' \u00b7 ')}
    </>;
  }
  return <>{plan.remaining} step{plan.remaining !== 1 ? 's' : ''} remaining</>;
};
export const GoalPlannerModal: React.FC<Props> = ({
  onClose,
  onOpenWorldChunk,
  initialTarget,
  runeProof,
}) => {
  const { unlocks, gameModeId, runId } = useGame();
  const previewChecks = useRuneProofPreviewChecks(runId);
  const runeProofIntegration = runeProof ?? DEFAULT_RUNEPROOF;
  const runeProofEnabled = runeProofIntegration.availability !== 'OFF';
  const runeProofContentService = runeProofIntegration.contentService;
  const loadRuneProofWalkthrough = runeProofIntegration.loadWalkthrough ?? loadQuestWalkthroughFor;
  const runeProofRequestGeneration = React.useRef(0);
  const [runeProofState, setRuneProofState] = useState<RuneProofPlannerState | null>(null);
  const [runeProofStrategies, setRuneProofStrategies] = useState<readonly QuestStrategyDefinition[]>(
    EMPTY_RUNE_PROOF_STRATEGIES,
  );
  const [runeProofCatalogueLoaded, setRuneProofCatalogueLoaded] = useState(false);
  const [runeProofActionsHydratedScope, setRuneProofActionsHydratedScope] = useState<
    RuneProofActionHydrationScope | null
  >(null);
  const previewActions = useRuneProofPreviewActions(runId, runeProofStrategies);
  const cancelRuneProofRequest = React.useCallback(() => {
    runeProofRequestGeneration.current += 1;
    setRuneProofState(null);
  }, []);
  const handleClose = React.useCallback(() => {
    cancelRuneProofRequest();
    onClose();
  }, [cancelRuneProofRequest, onClose]);
  const handleOpenWorldChunk = React.useCallback((cx: number, cy: number) => {
    cancelRuneProofRequest();
    onClose();
    onOpenWorldChunk?.(cx, cy);
  }, [cancelRuneProofRequest, onClose, onOpenWorldChunk]);
  useEscapeKey(handleClose, true);
  useEffect(() => {
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const targets = useMemo(() => listGoalTargets(), []);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<{ kind: GoalKind; id: string } | null>(initialTarget ?? null);
  const [objectivePickerOpen, setObjectivePickerOpen] = useState(false);
  const [focusChangeObjective, setFocusChangeObjective] = useState(false);
  const changeObjectiveButtonRef = React.useRef<HTMLButtonElement>(null);
  useEffect(() => { if (initialTarget) setSelected(initialTarget); }, [initialTarget]);

  useEffect(() => {
    let active = true;
    setRuneProofStrategies(EMPTY_RUNE_PROOF_STRATEGIES);
    setRuneProofCatalogueLoaded(false);

    if (!runeProofEnabled) {
      return () => { active = false; };
    }

    void loadQuestStrategyCatalogue(runeProofIntegration.availability)
      .then((strategies) => {
        if (!active) return;
        setRuneProofStrategies(strategies);
        setRuneProofCatalogueLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setRuneProofStrategies(EMPTY_RUNE_PROOF_STRATEGIES);
        setRuneProofCatalogueLoaded(true);
      });

    return () => { active = false; };
  }, [runeProofEnabled, runeProofIntegration.availability]);

  useEffect(() => {
    if (
      !runeProofCatalogueLoaded
      || !runeProofEnabled
    ) {
      setRuneProofActionsHydratedScope(null);
      return;
    }

    // The action hook hydrates this matching run/catalogue scope in its own
    // effect. This runs after that hook so objectives never rank its temporary
    // empty action set as real progress.
    setRuneProofActionsHydratedScope({ runId, strategies: runeProofStrategies });
  }, [
    runId,
    runeProofCatalogueLoaded,
    runeProofEnabled,
    runeProofStrategies,
  ]);
  const runeProofActionsHydrated = (
    runeProofCatalogueLoaded
    && runeProofEnabled
    && runeProofActionsHydratedScope?.runId === runId
    && runeProofActionsHydratedScope.strategies === runeProofStrategies
  );
  const runeProofQuestIds = useMemo(
    () => new Set(runeProofStrategies.map(strategy => strategy.questId)),
    [runeProofStrategies],
  );
  const visibleTargets = useMemo(
    () => runeProofEnabled
      ? targets.filter(target => target.kind === 'quest' && runeProofQuestIds.has(target.id))
      : targets,
    [runeProofEnabled, runeProofQuestIds, targets],
  );

  const selectedRuneProofStrategy = useMemo(() => (
    selected?.kind === 'quest' && runeProofEnabled
      ? runeProofStrategies.find(strategy => strategy.questId === selected.id)
      : undefined
  ), [runeProofEnabled, runeProofStrategies, selected]);
  const runeProofQuestId = selectedRuneProofStrategy?.questId ?? null;
  const selectedWalkthroughRelease = useMemo<QuestWalkthroughRelease | undefined>(() => {
    if (!runeProofQuestId || !selectedRuneProofStrategy) return undefined;
    const injectedRelease = runeProofIntegration.walkthroughReleaseFor?.(runeProofQuestId);
    return injectedRelease ?? {
      questId: runeProofQuestId,
      revision: selectedRuneProofStrategy.revision,
      releaseStatus: runeProofIntegration.availability === 'PUBLIC' ? 'APPROVED' : 'PREVIEW_ONLY',
    };
  }, [runeProofIntegration, runeProofQuestId, selectedRuneProofStrategy]);
  const selectedRequirements = useMemo(
    () => runeProofQuestId ? reviewedQuestRequirements(runeProofQuestId) : undefined,
    [runeProofQuestId],
  );
  const materializedRuneProofAccount = useMemo(
    () => materializeRuneProofAccount(unlocks, gameModeId),
    [gameModeId, unlocks],
  );
  const runeProofAccountIdentity = useMemo(
    () => JSON.stringify(canonicalRuneProofAccountIdentity(materializedRuneProofAccount)),
    [materializedRuneProofAccount],
  );
  const runeProofAccount = useMemo(
    () => materializedRuneProofAccount,
    [runeProofAccountIdentity],
  );
  const confirmedItemKeys = useMemo(
    () => runeProofQuestId
      ? previewChecks.confirmedItemKeys(runeProofQuestId)
      : new Set<string>(),
    [previewChecks.checks, previewChecks.confirmedItemKeys, runeProofQuestId],
  );
  const completedQuestIds = useMemo(() => new Set(unlocks.quests), [unlocks.quests]);
  const targetsByQuestId = useMemo(() => new Map(
    targets
      .filter((target): target is GoalTarget & { readonly kind: 'quest' } => target.kind === 'quest')
      .map(target => [target.id, target]),
  ), [targets]);
  const runeProofObjectiveCandidates = useMemo<readonly RuneProofObjectiveCandidate[]>(() => {
    if (!runeProofActionsHydrated || !previewChecks.isHydratedForRun) return [];

    return runeProofStrategies.flatMap((strategy) => {
      const target = targetsByQuestId.get(strategy.questId);
      if (!target) return [];

      const state = goalPlannerTargetState(target, unlocks, gameModeId);
      const progress = questStrategyProgress(
        strategy,
        previewActions.confirmedActionIdsFor(strategy.questId),
        previewChecks.confirmedItemKeys(strategy.questId),
        completedQuestIds,
      );
      return [{
        strategy,
        readiness: objectiveReadinessFor(state),
        completed: state === 'done' || progress.completed === progress.total,
        progress,
      }];
    });
  }, [
    completedQuestIds,
    gameModeId,
    previewActions.confirmedActionIdsFor,
    previewChecks.confirmedItemKeys,
    previewChecks.isHydratedForRun,
    runeProofActionsHydrated,
    runeProofEnabled,
    runeProofStrategies,
    targetsByQuestId,
    unlocks,
  ]);
  const runeProofRecommendations = useMemo(
    () => rankRuneProofObjectives(runeProofObjectiveCandidates),
    [runeProofObjectiveCandidates],
  );

  useEffect(() => {
    if (
      !runeProofCatalogueLoaded
      || !runeProofActionsHydrated
      || !previewChecks.isHydratedForRun
      || !runeProofEnabled
    ) return;

    if (selected?.kind === 'quest' && runeProofQuestIds.has(selected.id)) return;
    if (selected === null && query.trim().length > 0) return;

    const firstRecommendation = runeProofRecommendations[0];
    setSelected(firstRecommendation
      ? { kind: 'quest', id: firstRecommendation.questId }
      : null);
  }, [
    query,
    runeProofCatalogueLoaded,
    runeProofActionsHydrated,
    previewChecks.isHydratedForRun,
    runeProofEnabled,
    runeProofQuestIds,
    runeProofRecommendations,
    selected,
  ]);
  const runeProofRequestKey = runeProofQuestId === null
    || selectedRequirements === undefined
    || selectedWalkthroughRelease === undefined
    ? null
    : JSON.stringify([
      runeProofQuestId,
      runeProofIntegration.chunkDataVersion,
      selectedRequirements.wikiRevision,
      selectedWalkthroughRelease.revision,
      runeProofAccountIdentity,
    ]);
  const runeProofRequest = useMemo<RuneProofRequestIdentity | null>(() => (
    runeProofRequestKey === null
      || runeProofQuestId === null
      || selectedWalkthroughRelease === undefined
      ? null
      : {
          key: runeProofRequestKey,
          questId: runeProofQuestId,
          walkthroughRelease: selectedWalkthroughRelease,
        }
  ), [runeProofRequestKey, runeProofQuestId, selectedWalkthroughRelease]);

  useEffect(() => {
    const generation = runeProofRequestGeneration.current + 1;
    runeProofRequestGeneration.current = generation;
    setRuneProofState(null);

    if (runeProofRequest === null) return undefined;

    const request = runeProofRequest;
    let active = true;
    const isCurrent = () => active && runeProofRequestGeneration.current === generation;
    const showUnavailable = () => {
      if (isCurrent()) {
        setRuneProofState({
          request,
          analysis: null,
          unavailable: true,
          strategy: null,
        });
      }
    };

    void Promise.resolve()
      .then(() => runeProofContentService.init())
      .then(async (loaded) => {
        if (!isCurrent()) return;
        if (!loaded) {
          showUnavailable();
          return;
        }

        const walkthrough = await loadRuneProofWalkthrough(
          runeProofIntegration.availability,
          request.walkthroughRelease,
        );
        if (!isCurrent()) return;
        if (walkthrough === undefined) {
          showUnavailable();
          return;
        }

        const strategy = selectedRuneProofStrategy;
        if (!strategy || strategy.questId !== request.questId) {
          showUnavailable();
          return;
        }

        const snapshot = materializeQuestRouteSnapshot(
          request.questId,
          runeProofAccount,
          runeProofContentService,
          runeProofIntegration.chunkDataVersion,
          walkthrough,
        );
        const analysis = runeProofIntegration.analyze(request.questId, snapshot, walkthrough);
        if (!isQuestAnalysisUsable(analysis)) { showUnavailable(); return; }
        const connectGraph = Object.fromEntries(
          Object.entries(snapshot.connectGraph).map(([from, destinations]) => (
            [from, [...destinations]]
          )),
        );
        if (isCurrent()) {
          setRuneProofState({
            request,
            analysis,
            unavailable: false,
            strategy,
            connectGraph,
          });
        }
      })
      .catch(showUnavailable);

    return () => {
      active = false;
    };
  }, [
    loadRuneProofWalkthrough,
    runeProofAccount,
    runeProofContentService,
    runeProofIntegration,
    runeProofRequest,
    selectedRuneProofStrategy,
  ]);

  // Filter + lightweight ranking: incomplete & matching first.
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? visibleTargets.filter((t) => t.label.toLowerCase().includes(q) || t.group.toLowerCase().includes(q))
      : visibleTargets;
    return matched
      .map((t) => ({ t, state: goalPlannerTargetState(t, unlocks, gameModeId) }))
      .sort((a, b) => {
        // Ready-to-start first, then locked, then done; alpha within.
        const rank = (s: TargetState) => (s === 'ready' ? 0 : s === 'confirm' ? 1 : s === 'locked' ? 2 : 3);
        return rank(a.state) - rank(b.state) || a.t.label.localeCompare(b.t.label);
      });
  }, [visibleTargets, query, unlocks, gameModeId]);

  const visibleSelection = runeProofEnabled
    ? selected?.kind === 'quest' && runeProofQuestIds.has(selected.id) ? selected : null
    : selected;

  const plan: GoalPlan | null = useMemo(
    () => (visibleSelection
      ? planForTarget(visibleSelection.kind, visibleSelection.id, unlocks, gameModeId)
      : null),
    [visibleSelection, unlocks, gameModeId],
  );

  const checklistRows = useMemo(() => {
    if (!runeProofQuestId || !plan) return [];
    const reviewed = reviewedQuestRequirements(runeProofQuestId);
    return reviewed
      ? buildQuestRequirementChecklist(plan, reviewed, confirmedItemKeys)
      : [];
  }, [confirmedItemKeys, plan, runeProofQuestId]);

  const totalSteps = plan ? plan.steps.length : 0;
  const doneSteps = plan ? plan.steps.filter((s) => s.done).length : 0;
  const pct = totalSteps > 0 ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const currentRuneProofState = runeProofRequest !== null
    && runeProofState?.request === runeProofRequest
    && runeProofState.request.key === runeProofRequest.key
    ? runeProofState
    : null;
  const activeCoachState = currentRuneProofState?.unavailable === false
    && currentRuneProofState.strategy !== null
    ? currentRuneProofState
    : null;
  const coachActive = activeCoachState !== null;
  const runeProofWorkspaceActive = runeProofEnabled || coachActive;
  const runeProofRouteLoading = runeProofEnabled
    && plan !== null
    && currentRuneProofState === null;
  const selectTarget = React.useCallback((target: { kind: GoalKind; id: string }) => {
    setSelected(target);
    setObjectivePickerOpen(false);
  }, []);
  const selectRuneProofObjective = React.useCallback((questId: string) => {
    setSelected({ kind: 'quest', id: questId });
    setObjectivePickerOpen(false);
    setFocusChangeObjective(window.matchMedia?.('(max-width: 639px)').matches === true);
  }, []);

  useEffect(() => {
    if (!focusChangeObjective || !coachActive) return;

    changeObjectiveButtonRef.current?.focus();
    setFocusChangeObjective(false);
  }, [coachActive, focusChangeObjective]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={runeProofEnabled ? 'RuneProof' : 'Goal Planner'}
    >
      <div
        className={`bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full ${
          runeProofWorkspaceActive ? 'max-w-5xl' : 'max-w-3xl'
        } h-[80vh] flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/30 text-cyan-400">
            <Route size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none flex items-center gap-1.5">
              {runeProofEnabled ? 'RuneProof' : 'Goal Planner'}
              {!runeProofEnabled ? <SectionGuide id="GOAL_PLANNER" /> : null}
            </h2>
            <p className="text-[11px] text-gray-500 mt-1">
              {runeProofEnabled
                ? 'Choose a RuneProof quest and follow its verified route.'
                : 'Pick a target — get the full ordered roadmap to unlock it.'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          {/* Picker column */}
          <div className={`${
            runeProofWorkspaceActive
              ? `${objectivePickerOpen ? 'flex' : 'hidden'} sm:flex w-full h-[45%] sm:w-[32%] sm:h-auto`
              : 'flex w-full h-[34%] sm:w-[44%] sm:h-auto'
          } border-b sm:border-b-0 sm:border-r border-white/10 flex-col min-h-0 shrink-0`}>
            {runeProofEnabled ? (
              <RuneProofObjectivePicker
                recommendations={runeProofRecommendations}
                onSelect={selectRuneProofObjective}
              />
            ) : null}
            <div className="p-2.5 border-b border-white/5 shrink-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" aria-hidden />
                <input
                  autoFocus
                  type="text"
                  placeholder={runeProofEnabled
                    ? 'Search RuneProof quests…'
                    : 'Search quests, diaries, regions…'}
                  className="bg-black/30 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 w-full transition-colors"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
              {results.length === 0 && (
                <p className="text-[11px] text-gray-600 italic text-center py-6">No matches.</p>
              )}
              {results.map(({ t, state }) => {
                const isSel = visibleSelection?.kind === t.kind && visibleSelection?.id === t.id;
                const meta = KIND_META[t.kind];
                return (
                  <button
                    key={`${t.kind}:${t.id}`}
                    onClick={() => selectTarget({ kind: t.kind, id: t.id })}
                    className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors group ${
                      isSel ? 'bg-cyan-900/25 border border-cyan-500/30' : 'border border-transparent hover:bg-white/5'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATE_DOT[state]}`} aria-hidden />
                    <span className={`shrink-0 ${meta.color}`} aria-hidden>{meta.icon}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[11px] font-semibold text-gray-200 truncate">{t.label}</span>
                      <span className="block text-[9px] text-gray-600 truncate">{meta.label} · {t.group}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan column */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {runeProofWorkspaceActive ? (
              <button
                ref={changeObjectiveButtonRef}
                type="button"
                onClick={() => setObjectivePickerOpen(open => !open)}
                className="sm:hidden mx-4 mt-3 self-start rounded border border-cyan-400/30 bg-cyan-950/30 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200"
                aria-expanded={objectivePickerOpen}
              >
                Change objective
              </button>
            ) : null}
            {!plan ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
                <Target size={32} className="text-gray-700" aria-hidden />
                <p className="text-sm text-gray-500 font-semibold">
                  {runeProofEnabled ? 'Choose a RuneProof quest' : 'Choose a goal'}
                </p>
                <p className="text-[11px] text-gray-600 max-w-[260px]">
                  {runeProofEnabled
                    ? 'Only quests with a RuneProof route appear here.'
                    : 'Select any quest, diary tier, or region on the left to see exactly what stands between you and it — in the order to tackle it.'}
                </p>
              </div>
            ) : runeProofRouteLoading ? (
              <div
                className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-2"
                role="status"
                aria-live="polite"
              >
                <Route size={28} className="text-cyan-500/60" aria-hidden />
                <p className="text-sm font-semibold text-gray-300">
                  Loading {plan.targetLabel} RuneProof route…
                </p>
              </div>
            ) : activeCoachState ? (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                <RuneProofErrorBoundary key={activeCoachState.request.key}>
                  <RuneProofCoachWorkspace
                    strategy={activeCoachState.strategy}
                    analysis={activeCoachState.analysis}
                    connectGraph={activeCoachState.connectGraph}
                    confirmedItemKeys={confirmedItemKeys}
                    confirmedActionIds={previewActions.confirmedActionIdsFor(activeCoachState.strategy.questId)}
                    completedQuestIds={completedQuestIds}
                    onSetItemConfirmed={previewChecks.setItemConfirmed}
                    onSetActionConfirmed={previewActions.setActionConfirmed}
                  />
                </RuneProofErrorBoundary>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {/* Plan header */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={KIND_META[plan.targetKind].color} aria-hidden>
                      {KIND_META[plan.targetKind].icon}
                    </span>
                    <h3 className="text-sm font-bold text-white truncate">{plan.targetLabel}</h3>
                  </div>

                  {plan.needsConfirmation && <p className="text-[11px] text-gray-500"><GoalPlanReadiness plan={plan} /></p>}
                  {!plan.needsConfirmation && (plan.alreadyDone ? (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 size={13} /> Already complete — nothing left to do!
                    </p>
                  ) : plan.alreadyReachable && plan.targetKind !== 'region' ? (
                    <p className="text-[11px] text-amber-300 flex items-center gap-1.5">
                      <Compass size={13} /> Available right now — go do it!
                    </p>
                  ) : (
                    <p className="text-[11px] text-gray-500">
                      <span className="text-gray-300 font-bold">{plan.remaining}</span> step
                      {plan.remaining !== 1 ? 's' : ''} remaining
                    </p>
                  ))}

                  {/* Progress bar */}
                  {totalSteps > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[9px] text-gray-600 font-mono mt-1 text-right">
                        {doneSteps}/{totalSteps} prerequisites met
                      </p>
                    </div>
                  )}
                </div>

                {plan.steps.length === 0 ? (
                  <p className="text-[11px] text-gray-600 italic text-center py-4">
                    No prerequisites — this target is wide open.
                  </p>
                ) : (
                  <>
                    <PlanSection title="Regions to unlock" icon={<MapPin size={12} />} steps={plan.regionSteps} />
                    <PlanSection title="Skills to train" icon={<Dumbbell size={12} />} steps={plan.skillSteps} />
                    <AlternativeSection steps={plan.alternativeSteps} />
                    {plan.qpStep && (
                      <PlanSection title="Quest points" icon={<Star size={12} />} steps={[plan.qpStep]} />
                    )}
                    <PlanSection
                      title="Confirm manually"
                      icon={<Compass size={12} />}
                      steps={plan.manualSteps}
                    />
                    <PlanSection
                      icon={<ArrowRight size={12} />}
                      title="Quests in order"
                      steps={plan.questSteps}
                      numbered
                    />
                  </>
                )}

                {runeProofRequest !== null
                  && currentRuneProofState !== null
                  && (
                    <RuneProofErrorBoundary key={runeProofRequest.key}>
                      <QuestRoutePanel
                        questId={runeProofRequest.questId}
                        analysis={currentRuneProofState.unavailable ? null : currentRuneProofState.analysis}
                        checklistRows={checklistRows}
                        confirmedItemKeys={confirmedItemKeys}
                        onSetItemConfirmed={previewChecks.setItemConfirmed}
                        walkthroughVisible
                        onOpenWorldChunk={onOpenWorldChunk ? handleOpenWorldChunk : undefined}
                      />
                    </RuneProofErrorBoundary>
                  )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
