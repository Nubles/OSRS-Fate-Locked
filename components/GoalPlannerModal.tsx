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
import { RuneProofErrorBoundary } from './questRoutes/RuneProofErrorBoundary';
import { analyzeQuest } from '../utils/questRoutes/analyzeQuest';
import {
  loadRuneProofCatalogue,
  loadRuneProofPackFor,
  loadRuneProofPlatformReviewHarness,
  runeProofLoadedPackMatchesRelease,
  validatedRuneProofPlatformReviewHarness,
  type RuneProofCatalogueSummary,
  type RuneProofLoadedPack,
  type RuneProofPlatformReviewHarness,
} from '../data/questWalkthroughLoader';
import type { RuneProofPackRelease } from '../data/runeProofPackRelease';
import {
  CHUNK_CONTENT_DATA_VERSION,
  chunkContentService,
} from '../services/ChunkContentService';
import { runeProofAvailability } from '../utils/questRoutes/featureFlag';
import { RuneProofCoach } from './questStrategies/RuneProofCoach';
import {
  buildRuneProofPackCoachModel,
  type RuneProofCoachCompletionTarget,
} from '../utils/questStrategies/coach';
import {
  preflightRuneProofObjectives,
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
} from '../utils/questRoutes/goalPlannerRuneProof';
import { preflightSnapshot } from '../utils/questStrategies/preflight';
import type { RuneProofAvailability } from '../utils/questRoutes/featureFlag';
import { useRuneProofProgress, type RuneProofProgressControls } from '../hooks/useRuneProofProgress';
import type { RuneProofCompiledPack } from '../utils/questStrategies/packModel';
import type { RuneProofRequirementSnapshot } from '../utils/questStrategies/requirements';
import type { RuneProofQuestProgressV2 } from '../utils/questStrategies/progress';
import type { RuneProofStorage } from '../utils/questRoutes/previewChecks';
import {
  DEFAULT_RUNE_PROOF_FILTERS,
  filterRuneProofCatalogue,
  RuneProofCatalogueFilters,
  type RuneProofCatalogueFilterState,
} from './questStrategies/RuneProofCatalogueFilters';

export type { RuneProofIntegration } from '../utils/questRoutes/goalPlannerRuneProof';

type RuneProofServiceToken = Readonly<{
  loadCatalogue: RuneProofIntegration['loadCatalogue'];
  loadPack: RuneProofIntegration['loadPack'];
  loadReviewHarness: RuneProofIntegration['loadReviewHarness'];
  analyze: RuneProofIntegration['analyze'];
  contentService: RuneProofIntegration['contentService'];
  progressStorage: RuneProofIntegration['progressStorage'];
}>;

type RuneProofProvenanceToken = Readonly<Record<never, never>>;

interface RuneProofQuestWorkspace {
  readonly requestKey: string;
  readonly serviceToken: RuneProofServiceToken;
  readonly release: RuneProofPackRelease;
  readonly loaded: RuneProofLoadedPack;
  readonly connectGraph?: ConnectGraph;
  readonly analysis?: ReturnType<RuneProofIntegration['analyze']>;
}

interface RuneProofPackWorkspaceProps {
  readonly pack: RuneProofCompiledPack;
  readonly progress: RuneProofQuestProgressV2;
  readonly requirementSnapshot: RuneProofRequirementSnapshot;
  readonly completedQuestIds: ReadonlySet<string>;
  readonly controls: RuneProofProgressControls;
  readonly legacyProjection?: RuneProofQuestWorkspace;
}

const RuneProofPackWorkspace: React.FC<RuneProofPackWorkspaceProps> = ({
  pack,
  progress,
  requirementSnapshot,
  completedQuestIds,
  controls,
  legacyProjection,
}) => {
  const model = useMemo(() => buildRuneProofPackCoachModel({
    pack,
    progress,
    requirementSnapshot,
    completedQuestIds,
    ...(legacyProjection?.loaded.legacyProjection && legacyProjection.analysis ? {
      legacyProjection: {
        strategy: legacyProjection.loaded.legacyProjection.strategy,
        analysis: legacyProjection.analysis,
        connectGraph: legacyProjection.connectGraph,
      },
    } : {}),
  }), [completedQuestIds, legacyProjection, pack, progress, requirementSnapshot]);
  const evaluations = useMemo(() => Object.fromEntries(model.branch.options.map(option => [
    option.id,
    { state: option.state, evidenceComplete: option.evidenceComplete },
  ])), [model.branch.options]);
  const setCompletion = React.useCallback((
    target: RuneProofCoachCompletionTarget,
    confirmed: boolean,
  ) => {
    switch (target.kind) {
      case 'ACTION': controls.setActionConfirmed(target.id, confirmed); break;
      case 'ITEM': controls.setItemConfirmed(target.id, confirmed); break;
      case 'MANUAL': controls.setManualConfirmed(target.id, confirmed); break;
      case 'CHECKPOINT': controls.setCheckpointConfirmed(target.id, confirmed); break;
    }
  }, [controls]);

  return <RuneProofCoach
    variant="PACK"
    model={model}
    onSetCompletion={setCompletion}
    onSelectBranch={branchId => controls.selectBranch(branchId, evaluations)}
    onSetItemConfirmed={controls.setItemConfirmed}
    onSetManualConfirmed={controls.setManualConfirmed}
  />;
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
  /** Deprecated compatibility handoff; PACK RuneProof keeps navigation in its contained map. */
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
  loadCatalogue: loadRuneProofCatalogue,
  loadPack: loadRuneProofPackFor,
  loadReviewHarness: loadRuneProofPlatformReviewHarness,
};

const KIND_META: Record<GoalKind, { icon: React.ReactNode; label: string; color: string }> = {
  quest: { icon: <BookOpen size={13} />, label: 'Quest', color: 'text-blue-300' },
  diary: { icon: <Award size={13} />, label: 'Diary', color: 'text-green-300' },
  region: { icon: <MapPin size={13} />, label: 'Region', color: 'text-emerald-300' },
};

// Status of a target in the current snapshot — drives the picker dot.
export type TargetState = 'done' | 'ready' | 'confirm' | 'locked';

const objectiveProofStateFor = (
  state: TargetState,
): RuneProofObjectiveCandidate['proofState'] => {
  switch (state) {
    case 'ready': return 'READY';
    case 'confirm': return 'CONFIRM';
    case 'locked': return 'BLOCKED';
    case 'done': return 'COMPLETE';
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

const createEphemeralRuneProofStorage = (): RuneProofStorage => {
  const values = new Map<string, string>();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
  };
};

const exactReleaseFor = (
  summary: RuneProofCatalogueSummary | undefined,
): RuneProofPackRelease | undefined => {
  if (
    !summary
    || summary.packDisposition !== 'RELEASED'
    || summary.packRevision === undefined
    || summary.lifecycle === undefined
    || summary.lifecycle === 'DRAFT'
    || summary.reviewStatus !== summary.lifecycle
    || !summary.playable
    || summary.proofState === 'NEEDS_REVIEW'
  ) return undefined;
  return {
    questId: summary.questId,
    packRevision: summary.packRevision,
    catalogueRevision: summary.catalogueRevision,
    lifecycle: summary.lifecycle,
  };
};

const copyConnectGraph = (
  graph: Readonly<Record<string, readonly string[]>>,
): ConnectGraph => Object.fromEntries(
  Object.entries(graph).map(([from, destinations]) => [from, [...destinations]]),
);

const proofStateLabel = (state: RuneProofCatalogueSummary['proofState']): string => (
  state === 'NEEDS_REVIEW'
    ? 'Needs review'
    : state.charAt(0) + state.slice(1).toLowerCase()
);

export const GoalPlannerModal: React.FC<Props> = ({
  onClose,
  initialTarget,
  runeProof,
}) => {
  const { unlocks, gameModeId, runId } = useGame();
  const integration = runeProof ?? DEFAULT_RUNEPROOF;
  const {
    analyze,
    availability,
    chunkDataVersion,
    contentService,
    progressStorage,
  } = integration;
  const runeProofEnabled = availability !== 'OFF';
  const loadCatalogue = integration.loadCatalogue ?? loadRuneProofCatalogue;
  const loadPack = integration.loadPack ?? loadRuneProofPackFor;
  const loadReviewHarness = integration.loadReviewHarness
    ?? loadRuneProofPlatformReviewHarness;
  const serviceToken = useMemo<RuneProofServiceToken>(() => Object.freeze({
    loadCatalogue,
    loadPack,
    loadReviewHarness,
    analyze,
    contentService,
    progressStorage,
  }), [
    analyze,
    availability,
    contentService,
    loadCatalogue,
    loadPack,
    loadReviewHarness,
    progressStorage,
  ]);
  const [reviewStorage] = useState(createEphemeralRuneProofStorage);
  const catalogueProvenance = useMemo<RuneProofProvenanceToken>(
    () => Object.freeze({}),
    [availability, loadCatalogue, runeProofEnabled],
  );
  const reviewProvenance = useMemo<RuneProofProvenanceToken>(
    () => Object.freeze({}),
    [availability, loadReviewHarness],
  );
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<RuneProofCatalogueFilterState>(
    DEFAULT_RUNE_PROOF_FILTERS,
  );
  const [selected, setSelected] = useState<{ kind: GoalKind; id: string } | null>(
    initialTarget ?? null,
  );
  const [objectivePickerOpen, setObjectivePickerOpen] = useState(false);
  const [focusChangeObjective, setFocusChangeObjective] = useState(false);
  const changeObjectiveButtonRef = React.useRef<HTMLButtonElement>(null);
  const reviewButtonRef = React.useRef<HTMLButtonElement>(null);
  const reviewReturnFocusRef = React.useRef<HTMLElement | null>(null);
  const reviewLoadRef = React.useRef<{
    readonly token: RuneProofProvenanceToken;
  }>();
  const [catalogueState, setCatalogueState] = useState<{
    readonly token: RuneProofProvenanceToken;
    readonly summaries: readonly RuneProofCatalogueSummary[];
  }>();
  const [questWorkspace, setQuestWorkspace] = useState<RuneProofQuestWorkspace>();
  const questWorkspaceCache = React.useRef<readonly RuneProofQuestWorkspace[]>([]);
  const [unavailableState, setUnavailableState] = useState<{
    readonly requestKey: string;
    readonly serviceToken: RuneProofServiceToken;
  }>();
  const [reviewWorkspace, setReviewWorkspace] = useState<{
    readonly token: RuneProofProvenanceToken;
    readonly harness: RuneProofPlatformReviewHarness;
    readonly scenarioId: RuneProofPlatformReviewHarness['scenarios'][number]['id'];
  }>();
  const [reviewOpening, setReviewOpening] = useState<{
    readonly token: RuneProofProvenanceToken;
  }>();
  const [reviewUnavailable, setReviewUnavailable] = useState<{
    readonly token: RuneProofProvenanceToken;
  }>();
  const latestCatalogue = React.useRef(catalogueProvenance);
  latestCatalogue.current = catalogueProvenance;
  const latestReview = React.useRef(reviewProvenance);
  latestReview.current = reviewProvenance;
  const packRequestGeneration = React.useRef(0);
  const invalidatePackRequest = React.useCallback(() => {
    packRequestGeneration.current += 1;
  }, []);

  useEffect(() => {
    if (initialTarget) setSelected(initialTarget);
  }, [initialTarget]);

  useEffect(() => {
    const root = document.documentElement;
    const rootOverflow = root.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = rootOverflow;
      document.body.style.overflow = bodyOverflow;
    };
  }, []);

  const handleClose = React.useCallback(() => {
    invalidatePackRequest();
    onClose();
  }, [invalidatePackRequest, onClose]);
  useEscapeKey(handleClose, true);

  useEffect(() => {
    let active = true;
    if (!runeProofEnabled) return () => { active = false; };
    const provenance = catalogueProvenance;
    void loadCatalogue(availability)
      .then(summaries => {
        if (active && latestCatalogue.current === provenance) {
          setCatalogueState({ token: provenance, summaries });
        }
      })
      .catch(() => {
        if (active && latestCatalogue.current === provenance) {
          setCatalogueState({ token: provenance, summaries: [] });
        }
      });
    return () => { active = false; };
  }, [availability, catalogueProvenance, loadCatalogue, runeProofEnabled]);

  const catalogue = runeProofEnabled
    && catalogueState?.token === catalogueProvenance
    ? catalogueState.summaries
    : [];
  const catalogueIsCurrent = runeProofEnabled
    && catalogueState?.token === catalogueProvenance;
  const account = useMemo(
    () => materializeRuneProofAccount(unlocks, gameModeId),
    [gameModeId, unlocks],
  );
  const accountIdentity = useMemo(
    () => JSON.stringify(canonicalRuneProofAccountIdentity(account)),
    [account],
  );
  const stableAccount = useMemo(() => account, [accountIdentity]);
  const requirementSnapshot = useMemo(
    () => preflightSnapshot(unlocks, gameModeId),
    [accountIdentity, gameModeId, unlocks],
  );
  const completedQuestIds = requirementSnapshot.completedQuestIds;

  const currentReviewWorkspace = availability === 'PREVIEW'
    && reviewWorkspace?.token === reviewProvenance
    ? reviewWorkspace
    : undefined;
  const currentReviewOpening = availability === 'PREVIEW'
    && reviewOpening?.token === reviewProvenance;
  const reviewMode = currentReviewWorkspace !== undefined || currentReviewOpening;

  const questProgress = useRuneProofProgress(
    runId,
    questWorkspace === undefined ? [] : [questWorkspace.loaded.pack],
    questWorkspace?.loaded.pack.questId,
    progressStorage,
  );
  const reviewScenario = currentReviewWorkspace?.harness.scenarios.find(
    scenario => scenario.id === currentReviewWorkspace.scenarioId,
  );
  const reviewProgress = useRuneProofProgress(
    'runeproof-platform-review',
    reviewScenario === undefined ? [] : [reviewScenario.pack],
    reviewScenario?.pack.questId,
    reviewStorage,
  );

  const preflight = useMemo(() => questProgress.isIndexHydrated
    && catalogueIsCurrent
    ? preflightRuneProofObjectives({
        summaries: catalogue,
        snapshot: requirementSnapshot,
        progressIndex: questProgress.index,
      })
    : { candidates: [], metrics: undefined }, [
    catalogue,
    catalogueIsCurrent,
    questProgress.index,
    questProgress.isIndexHydrated,
    requirementSnapshot,
  ]);
  const candidatesByQuestId = useMemo(() => new Map(
    preflight.candidates.map(candidate => [candidate.questId, candidate]),
  ), [preflight.candidates]);
  const displayedCatalogue = useMemo(() => catalogue.map(summary => {
    const candidate = candidatesByQuestId.get(summary.questId);
    return candidate ? { ...summary, proofState: candidate.proofState } : summary;
  }), [candidatesByQuestId, catalogue]);
  const recommendations = useMemo(() => (
    questProgress.isIndexHydrated
      ? rankRuneProofObjectives(preflight.candidates)
      : []
  ), [preflight.candidates, questProgress.isIndexHydrated]);

  useEffect(() => {
    if (!catalogueIsCurrent || !questProgress.isIndexHydrated || !runeProofEnabled) return;
    if (
      selected !== null
      && selected.kind === 'quest'
      && catalogue.some(summary => summary.questId === selected.id)
    ) return;
    if (selected === null && filters.query.trim().length > 0) return;
    const first = recommendations[0];
    setSelected(first ? { kind: 'quest', id: first.questId } : null);
  }, [
    catalogue,
    catalogueIsCurrent,
    filters.query,
    questProgress.isIndexHydrated,
    recommendations,
    runeProofEnabled,
    selected,
  ]);

  const selectedSummary = selected?.kind === 'quest'
    ? displayedCatalogue.find(summary => summary.questId === selected.id)
    : undefined;
  const selectedRelease = useMemo(() => questProgress.isIndexHydrated
    ? exactReleaseFor(selectedSummary)
    : undefined, [
    questProgress.isIndexHydrated,
    selectedSummary?.catalogueRevision,
    selectedSummary?.lifecycle,
    selectedSummary?.packDisposition,
    selectedSummary?.packRevision,
    selectedSummary?.playable,
    selectedSummary?.proofState,
    selectedSummary?.questId,
    selectedSummary?.reviewStatus,
  ]);
  const requestKey = selectedRelease === undefined ? undefined : JSON.stringify([
    availability,
    runId,
    selectedRelease.questId,
    selectedRelease.packRevision,
    selectedRelease.catalogueRevision,
    selectedRelease.lifecycle,
    chunkDataVersion,
    accountIdentity,
  ]);
  const latestPackRequest = React.useRef<{
    requestKey?: string;
    serviceToken: RuneProofServiceToken;
  }>({ requestKey, serviceToken });
  latestPackRequest.current = { requestKey, serviceToken };
  const currentQuestWorkspace = !reviewMode
    && requestKey !== undefined
    && questWorkspace?.requestKey === requestKey
    && questWorkspace.serviceToken === serviceToken
    ? questWorkspace
    : undefined;
  const currentUnavailable = !reviewMode
    && requestKey !== undefined
    && unavailableState?.requestKey === requestKey
    && unavailableState.serviceToken === serviceToken;

  useEffect(() => {
    if (reviewMode || requestKey === undefined || selectedRelease === undefined) return;
    const generation = ++packRequestGeneration.current;
    let active = true;
    const cancel = () => {
      active = false;
      if (packRequestGeneration.current === generation) {
        packRequestGeneration.current += 1;
      }
    };
    const cached = questWorkspaceCache.current.find(workspace => (
      workspace.requestKey === requestKey && workspace.serviceToken === serviceToken
    ));
    if (cached) {
      setUnavailableState(undefined);
      setQuestWorkspace(cached);
      return cancel;
    }
    const request = { requestKey, serviceToken };
    const isCurrent = () => active
      && packRequestGeneration.current === generation
      && latestPackRequest.current.requestKey === request.requestKey
      && latestPackRequest.current.serviceToken === request.serviceToken;
    setUnavailableState(undefined);
    void Promise.resolve()
      .then(() => loadPack(availability, selectedRelease))
      .then(async loaded => {
        if (!isCurrent()) return;
        if (!loaded || !runeProofLoadedPackMatchesRelease(loaded, selectedRelease)) {
          setUnavailableState(request);
          return;
        }
        let analysis: RuneProofQuestWorkspace['analysis'];
        let connectGraph: ConnectGraph | undefined;
        if (loaded.legacyProjection !== undefined) {
          const initialized = await contentService.init();
          if (!isCurrent()) return;
          if (!initialized) {
            setUnavailableState(request);
            return;
          }
          const snapshot = materializeQuestRouteSnapshot(
            selectedRelease.questId,
            stableAccount,
            contentService,
            chunkDataVersion,
            loaded.legacyProjection.walkthrough,
            loaded.legacyProjection.reviewedRequirements,
          );
          analysis = analyze(
            selectedRelease.questId,
            snapshot,
            loaded.legacyProjection.walkthrough,
          );
          connectGraph = copyConnectGraph(snapshot.connectGraph);
        }
        if (!isCurrent()) return;
        const workspace: RuneProofQuestWorkspace = {
          requestKey,
          serviceToken,
          release: selectedRelease,
          loaded,
          analysis,
          connectGraph,
        };
        questWorkspaceCache.current = [
          ...questWorkspaceCache.current.filter(value => !(
            value.requestKey === requestKey && value.serviceToken === serviceToken
          )),
          workspace,
        ];
        setUnavailableState(undefined);
        setQuestWorkspace(workspace);
      })
      .catch(() => {
        if (isCurrent()) setUnavailableState(request);
      });
    return cancel;
  }, [
    requestKey,
    reviewMode,
    selectedRelease,
    serviceToken,
    stableAccount,
  ]);

  const seriesOptions = useMemo(() => [...new Set(
    displayedCatalogue.flatMap(summary => summary.series ? [summary.series] : []),
  )].sort(), [displayedCatalogue]);
  const filteredCatalogue = useMemo(
    () => filterRuneProofCatalogue(displayedCatalogue, filters),
    [displayedCatalogue, filters],
  );
  const ordinaryTargets = useMemo(() => listGoalTargets(), []);
  const ordinaryResults = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matched = normalized
      ? ordinaryTargets.filter(target => target.label.toLowerCase().includes(normalized)
        || target.group.toLowerCase().includes(normalized))
      : ordinaryTargets;
    return matched.map(target => ({
      target,
      state: goalPlannerTargetState(target, unlocks, gameModeId),
    })).sort((left, right) => {
      const rank = (state: TargetState) => state === 'ready' ? 0
        : state === 'confirm' ? 1 : state === 'locked' ? 2 : 3;
      return rank(left.state) - rank(right.state)
        || left.target.label.localeCompare(right.target.label);
    });
  }, [gameModeId, ordinaryTargets, query, unlocks]);
  const ordinaryPlan = useMemo(() => selected
    ? planForTarget(selected.kind, selected.id, unlocks, gameModeId)
    : null, [gameModeId, selected, unlocks]);
  const totalSteps = ordinaryPlan?.steps.length ?? 0;
  const doneSteps = ordinaryPlan?.steps.filter(step => step.done).length ?? 0;
  const pct = totalSteps === 0 ? 0 : Math.round((doneSteps / totalSteps) * 100);

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
    if (!focusChangeObjective || currentQuestWorkspace === undefined) return;
    changeObjectiveButtonRef.current?.focus();
    setFocusChangeObjective(false);
  }, [currentQuestWorkspace, focusChangeObjective]);

  const openReviewHarness = React.useCallback(async () => {
    if (availability !== 'PREVIEW' || currentReviewOpening || currentReviewWorkspace) return;
    invalidatePackRequest();
    const provenance = reviewProvenance;
    if (reviewLoadRef.current?.token === provenance) return;
    reviewLoadRef.current = { token: provenance };
    reviewReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : reviewButtonRef.current;
    setReviewOpening({ token: provenance });
    setReviewUnavailable(undefined);
    try {
      const loadedHarness = await loadReviewHarness(availability);
      if (latestReview.current !== provenance) return;
      const harness = await validatedRuneProofPlatformReviewHarness(loadedHarness);
      if (latestReview.current !== provenance) return;
      if (harness === undefined) {
        setReviewOpening(undefined);
        setReviewUnavailable({ token: provenance });
        return;
      }
      setReviewWorkspace({
        token: provenance,
        harness,
        scenarioId: harness.scenarios[0].id,
      });
      setReviewOpening(undefined);
    } catch {
      if (latestReview.current === provenance) {
        setReviewOpening(undefined);
        setReviewUnavailable({ token: provenance });
      }
    } finally {
      if (reviewLoadRef.current?.token === provenance) reviewLoadRef.current = undefined;
    }
  }, [
    availability,
    currentReviewOpening,
    currentReviewWorkspace,
    invalidatePackRequest,
    loadReviewHarness,
    reviewProvenance,
  ]);
  const closeReviewHarness = React.useCallback(() => {
    setReviewWorkspace(undefined);
    setReviewOpening(undefined);
    setReviewUnavailable(undefined);
    queueMicrotask(() => (reviewReturnFocusRef.current ?? reviewButtonRef.current)?.focus());
  }, []);

  const questProgressReady = currentQuestWorkspace !== undefined
    && questProgress.isSelectedHydrated
    && questProgress.selectedProgress !== undefined;
  const reviewProgressReady = currentReviewWorkspace !== undefined
    && reviewScenario !== undefined
    && reviewProgress.isSelectedHydrated
    && reviewProgress.selectedProgress !== undefined;
  const coachKey = reviewProgressReady
    ? `HARNESS:${reviewScenario.id}:${reviewScenario.pack.questId}:${reviewScenario.pack.revision}`
    : questProgressReady
      ? `QUEST:${currentQuestWorkspace.requestKey}`
      : undefined;
  const workspaceActive = runeProofEnabled || currentQuestWorkspace !== undefined;
  const selectedNeedsReview = selectedSummary !== undefined
    && selectedSummary.proofState === 'NEEDS_REVIEW';
  const routeLoading = !reviewMode
    && requestKey !== undefined
    && !currentUnavailable
    && (!currentQuestWorkspace || !questProgressReady);
  const currentReviewUnavailable = availability === 'PREVIEW'
    && reviewUnavailable?.token === reviewProvenance;

  const renderOrdinaryPlan = () => {
    if (!ordinaryPlan) return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 gap-3">
        <Target size={32} className="text-gray-700" aria-hidden />
        <p className="text-sm text-gray-500 font-semibold">
          {runeProofEnabled ? 'Choose a RuneProof objective' : 'Choose a goal'}
        </p>
      </div>
    );
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={KIND_META[ordinaryPlan.targetKind].color} aria-hidden>
              {KIND_META[ordinaryPlan.targetKind].icon}
            </span>
            <h3 className="text-sm font-bold text-white truncate">{ordinaryPlan.targetLabel}</h3>
          </div>
          {selectedNeedsReview ? <p role="status">Needs review</p> : null}
          {currentUnavailable ? <p role="status">Analysis unavailable</p> : null}
          <p className="text-[11px] text-gray-500"><GoalPlanReadiness plan={ordinaryPlan} /></p>
          {totalSteps > 0 ? (
            <div className="mt-2">
              <div className="h-1.5 bg-black/50 rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-[9px] text-gray-600 font-mono mt-1 text-right">
                {doneSteps}/{totalSteps} prerequisites met
              </p>
            </div>
          ) : null}
        </div>
        {ordinaryPlan.steps.length === 0 ? (
          <p className="text-[11px] text-gray-600 italic text-center py-4">
            No prerequisites — this target is wide open.
          </p>
        ) : (
          <>
            <PlanSection title="Regions to unlock" icon={<MapPin size={12} />} steps={ordinaryPlan.regionSteps} />
            <PlanSection title="Skills to train" icon={<Dumbbell size={12} />} steps={ordinaryPlan.skillSteps} />
            <AlternativeSection steps={ordinaryPlan.alternativeSteps} />
            {ordinaryPlan.qpStep ? <PlanSection title="Quest points" icon={<Star size={12} />} steps={[ordinaryPlan.qpStep]} /> : null}
            <PlanSection title="Confirm manually" icon={<Compass size={12} />} steps={ordinaryPlan.manualSteps} />
            <PlanSection title="Quests in order" icon={<ArrowRight size={12} />} steps={ordinaryPlan.questSteps} numbered />
          </>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={runeProofEnabled ? 'RuneProof' : 'Goal Planner'}
    >
      <div
        className={`bg-[#161616] border border-white/10 rounded-xl shadow-2xl w-full ${workspaceActive ? 'max-w-5xl' : 'max-w-3xl'} h-[80vh] flex flex-col overflow-hidden`}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b border-white/10 bg-[#1b1b1b] shrink-0">
          <div className="p-2 bg-cyan-900/20 rounded-lg border border-cyan-500/30 text-cyan-400"><Route size={18} /></div>
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
          {availability === 'PREVIEW' ? (
            <button ref={reviewButtonRef} type="button" onClick={openReviewHarness}>
              Review branch and combat controls
            </button>
          ) : null}
          <button onClick={handleClose} className="p-1.5 rounded hover:bg-white/10 text-gray-400" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 flex flex-col sm:flex-row min-h-0">
          <div className={`${workspaceActive ? `${objectivePickerOpen ? 'flex' : 'hidden'} sm:flex w-full h-[45%] sm:w-[32%] sm:h-auto` : 'flex w-full h-[34%] sm:w-[44%] sm:h-auto'} border-b sm:border-b-0 sm:border-r border-white/10 flex-col min-h-0 shrink-0`}>
            {runeProofEnabled ? (
              <>
                <RuneProofObjectivePicker recommendations={recommendations} onSelect={selectRuneProofObjective} />
                <div className="p-2.5 border-b border-white/5 overflow-y-auto">
                  <RuneProofCatalogueFilters
                    value={filters}
                    seriesOptions={seriesOptions}
                    resultCount={filteredCatalogue.length}
                    totalCount={displayedCatalogue.length}
                    onChange={setFilters}
                  />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                  {filteredCatalogue.length === 0 ? <p>No matches.</p> : null}
                  {filteredCatalogue.map(summary => {
                    const playable = exactReleaseFor(summary) !== undefined;
                    const selectedRow = selected?.kind === 'quest' && selected.id === summary.questId;
                    return (
                      <div key={summary.questId}>
                        <button
                          type="button"
                          onClick={() => selectTarget({ kind: 'quest', id: summary.questId })}
                          aria-label={`${summary.questId}${playable ? ' — Open reviewed route' : ''}`}
                          className={`group w-full text-left ${selectedRow ? 'bg-cyan-900/25' : ''}`}
                        >
                          <span>{summary.questId}</span>
                          <span> {summary.kind === 'quest' ? 'Quest' : 'Miniquest'} · {summary.membership}</span>
                          <span> · {proofStateLabel(summary.proofState)}</span>
                        </button>
                        <details>
                          <summary>Review metadata for {summary.questId}</summary>
                          <p>{summary.reviewStatus} · milestone {summary.milestone}</p>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <>
                <div className="p-2.5 border-b border-white/5 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" aria-hidden />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search quests, diaries, regions…"
                      className="bg-black/30 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/40 w-full transition-colors"
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
                  {ordinaryResults.length === 0 ? (
                    <p className="text-[11px] text-gray-600 italic text-center py-6">No matches.</p>
                  ) : null}
                  {ordinaryResults.map(({ target, state }) => {
                    const meta = KIND_META[target.kind];
                    const isSelected = selected?.kind === target.kind && selected.id === target.id;
                    return <button
                      key={`${target.kind}:${target.id}`}
                      type="button"
                      onClick={() => selectTarget({ kind: target.kind, id: target.id })}
                      aria-current={isSelected ? 'true' : undefined}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors group ${
                        isSelected
                          ? 'bg-cyan-900/25 border border-cyan-500/30'
                          : 'border border-transparent hover:bg-white/5'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATE_DOT[state]}`} aria-hidden />
                      <span className={`shrink-0 ${meta.color}`} aria-hidden>{meta.icon}</span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-[11px] font-semibold text-gray-200 truncate">{target.label}</span>
                        <span className="block text-[9px] text-gray-600 truncate">{meta.label} · {target.group}</span>
                      </span>
                    </button>;
                  })}
                </div>
              </>
            )}
          </div>

          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {workspaceActive ? (
              <button ref={changeObjectiveButtonRef} type="button" onClick={() => setObjectivePickerOpen(open => !open)} className="sm:hidden" aria-expanded={objectivePickerOpen}>
                Change objective
              </button>
            ) : null}
            {currentReviewOpening ? <div role="status">Loading platform review…</div>
              : currentReviewUnavailable ? <div role="status">Platform review unavailable.</div>
              : currentReviewWorkspace && reviewScenario ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  <p>Platform review harness — not a quest</p>
                  <div role="tablist" aria-label="Platform review scenarios">
                    {currentReviewWorkspace.harness.scenarios.map(scenario => (
                      <button
                        key={scenario.id}
                        type="button"
                        role="tab"
                        aria-selected={scenario.id === currentReviewWorkspace.scenarioId}
                        onClick={() => setReviewWorkspace({ ...currentReviewWorkspace, scenarioId: scenario.id })}
                      >{scenario.label}</button>
                    ))}
                  </div>
                  <button type="button" onClick={closeReviewHarness}>Close platform review</button>
                  {reviewProgressReady ? (
                    <RuneProofErrorBoundary key={coachKey}>
                      <RuneProofPackWorkspace
                        pack={reviewScenario.pack}
                        progress={reviewProgress.selectedProgress!}
                        requirementSnapshot={reviewScenario.snapshot}
                        completedQuestIds={new Set(reviewScenario.completedQuestIds)}
                        controls={reviewProgress}
                      />
                    </RuneProofErrorBoundary>
                  ) : <div role="status">Loading review scenario…</div>}
                </div>
              ) : routeLoading ? (
                <div role="status">Loading {selectedRelease?.questId} RuneProof route…</div>
              ) : questProgressReady ? (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
                  <RuneProofErrorBoundary key={coachKey}>
                    <RuneProofPackWorkspace
                      pack={currentQuestWorkspace.loaded.pack}
                      progress={questProgress.selectedProgress!}
                      requirementSnapshot={requirementSnapshot}
                      completedQuestIds={completedQuestIds}
                      controls={questProgress}
                      legacyProjection={currentQuestWorkspace}
                    />
                  </RuneProofErrorBoundary>
                </div>
              ) : renderOrdinaryPlan()}
          </div>
        </div>
      </div>
    </div>
  );
};
