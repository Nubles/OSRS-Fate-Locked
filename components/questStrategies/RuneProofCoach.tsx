import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Lock,
  MapPin,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState } from 'react';
import type {
  RuneProofAlternativeSourceGroup,
  RuneProofCoachAction,
  RuneProofCoachActionState,
  RuneProofCoachCompletionTarget,
  RuneProofCoachLocationModel,
  RuneProofCoachModel,
  RuneProofPackCoachAction,
  RuneProofPackCoachModel,
  RuneProofReviewedAlternativeModel,
} from '../../utils/questStrategies/coach';
import type { ChunkKey } from '../../utils/questRoutes/model';
import { chunkRectOnMap } from '../../utils/questRoutes/routeMapGeometry';
import { RuneProofProofDrawer } from './RuneProofProofDrawer';
import { RuneProofTemporaryMap } from './RuneProofTemporaryMap';
import { RuneProofBranchSelector } from './RuneProofBranchSelector';
import { RuneProofCombatReadiness } from './RuneProofCombatReadiness';
import { RuneProofInitialItems } from './RuneProofInitialItems';
import { RuneProofManualConfirmations } from './RuneProofManualConfirmations';

interface LegacyRuneProofCoachProps {
  readonly variant: 'LEGACY';
  readonly model: RuneProofCoachModel;
  readonly onConfirmAction: (actionId: string) => void;
  readonly onSetCompletion?: never;
  readonly onSelectBranch?: never;
  readonly onSetItemConfirmed?: never;
  readonly onSetManualConfirmed?: never;
}

interface RuneProofPackCoachProps {
  readonly variant: 'PACK';
  readonly model: RuneProofPackCoachModel;
  readonly onConfirmAction?: never;
  readonly onSetCompletion: (
    target: RuneProofCoachCompletionTarget,
    confirmed: boolean,
  ) => void;
  readonly onSelectBranch: (branchId: string) => void;
  readonly onSetItemConfirmed: (itemKey: string, confirmed: boolean) => void;
  readonly onSetManualConfirmed: (confirmationId: string, confirmed: boolean) => void;
}

export type RuneProofCoachProps =
  | LegacyRuneProofCoachProps
  | RuneProofPackCoachProps;

interface ActionPresentation {
  readonly label: string;
  readonly className: string;
  readonly Icon: LucideIcon;
}

const ACTION_PRESENTATION: Record<RuneProofCoachActionState, ActionPresentation> = {
  COMPLETED: {
    label: 'Completed',
    className: 'text-emerald-300',
    Icon: CheckCircle2,
  },
  DO_NOW: {
    label: 'Do now',
    className: 'text-cyan-200',
    Icon: MapPin,
  },
  AVAILABLE_NEXT: {
    label: 'Available next',
    className: 'text-gray-400',
    Icon: Clock3,
  },
  BLOCKED: {
    label: 'Blocked',
    className: 'text-amber-200',
    Icon: Lock,
  },
  NEEDS_CONFIRMATION: {
    label: 'Needs confirmation',
    className: 'text-violet-200',
    Icon: Circle,
  },
};

const CHUNK_KEY_PATTERN = /^(-?\d+),(-?\d+)$/;

const worldChunk = (
  chunks: RuneProofCoachAction['mapChunks'],
): ChunkKey | undefined => {
  const firstChunk = chunks[0];
  if (!firstChunk) return undefined;

  const match = CHUNK_KEY_PATTERN.exec(firstChunk);
  if (!match) return undefined;

  const cx = Number(match[1]);
  const cy = Number(match[2]);
  if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy)) return undefined;

  const chunk = (String(cx) + ',' + String(cy)) as ChunkKey;
  if (chunk !== firstChunk) return undefined;
  return chunkRectOnMap(chunk) ? chunk : undefined;
};

const ChunkLabel = ({ action }: { readonly action: RuneProofCoachAction }) => {
  const chunk = worldChunk(action.mapChunks);
  return (
    <span className="font-mono text-[10px] font-semibold text-cyan-200">
      {chunk ? `Chunk ${chunk}` : 'Chunk needs review'}
    </span>
  );
};

const StateLabel = ({ state }: { readonly state: RuneProofCoachActionState }) => {
  const presentation = ACTION_PRESENTATION[state];
  const { Icon } = presentation;

  return (
    <span className={'inline-flex items-center gap-1 font-semibold ' + presentation.className}>
      <Icon size={13} aria-hidden />
      <span>{presentation.label}</span>
    </span>
  );
};

const CurrentActionCard = ({
  action,
  onConfirmAction,
  onShowMap,
}: {
  readonly action: RuneProofCoachAction;
  readonly onConfirmAction: LegacyRuneProofCoachProps['onConfirmAction'];
  readonly onShowMap: (action: RuneProofCoachAction, trigger: HTMLButtonElement) => void;
}) => {
  const mapChunk = worldChunk(action.mapChunks);

  return (
    <article className="rounded-lg border border-cyan-400/30 bg-cyan-950/20 p-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <StateLabel state={action.state} />
          <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-gray-100">
            {action.instruction}
          </p>
          <p className="mt-1">
            <ChunkLabel action={action} />
          </p>
          {action.locationLabel ? (
            <p className="mt-1 text-[11px] text-gray-400">Location: {action.locationLabel}</p>
          ) : null}
          {action.preferredMethodLabel ? (
            <p className="mt-1 text-[11px] text-gray-400">
              Reviewed method: {action.preferredMethodLabel}
            </p>
          ) : null}
          {action.blockerText ? (
            <p
              role="note"
              className="mt-2 rounded border border-amber-400/25 bg-amber-950/30 px-2 py-1.5 text-[11px] text-amber-100"
            >
              {action.blockerText}
            </p>
          ) : null}
        </div>

        {mapChunk || action.confirmationAllowed ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {mapChunk ? (
              <button
                type="button"
                aria-label={'Show ' + action.instruction + ' on map'}
                onClick={event => onShowMap(action, event.currentTarget)}
                className="inline-flex items-center justify-center gap-1.5 rounded border border-cyan-300/40 bg-cyan-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                <MapPin size={13} aria-hidden />
                Show on map
              </button>
            ) : null}
            {action.confirmationAllowed ? (
              <button
                type="button"
                onClick={() => onConfirmAction(action.id)}
                className="rounded border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-gray-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                {action.confirmationLabel ?? 'Mark action complete'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
};

const TimelineAction = ({
  action,
  index,
  isCurrent,
  onConfirmAction,
}: {
  readonly action: RuneProofCoachAction;
  readonly index: number;
  readonly isCurrent: boolean;
  readonly onConfirmAction: LegacyRuneProofCoachProps['onConfirmAction'];
}) => (
  <li className="min-w-0 rounded-md border border-white/10 bg-[#1b1b1b]">
    <details open={isCurrent}>
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300">
        <span className="mt-0.5 text-[10px] font-mono text-gray-600" aria-hidden>
          {index + 1}.
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[11px] font-semibold leading-relaxed text-gray-200">
            {action.instruction}
          </span>
          <span className="mt-1 block">
            <StateLabel state={action.state} />
          </span>
          <span className="mt-1 block">
            <ChunkLabel action={action} />
          </span>
        </span>
        <ChevronRight size={14} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
      </summary>
      <div className="space-y-1 border-t border-white/5 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
        {action.locationLabel ? <p>Location: {action.locationLabel}</p> : null}
        {action.preferredMethodLabel ? <p>Reviewed method: {action.preferredMethodLabel}</p> : null}
        {action.blockerText ? <p className="text-amber-100">{action.blockerText}</p> : null}
        {!isCurrent && action.confirmationAllowed ? (
          <button
            type="button"
            onClick={() => onConfirmAction(action.id)}
            className="rounded border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-gray-100 transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            {action.confirmationLabel ?? 'Mark action complete'}
          </button>
        ) : null}
        {isCurrent ? <p>Use the next action above to map or confirm this step.</p> : null}
      </div>
    </details>
  </li>
);

const AlternativeSources = ({
  sources,
}: {
  readonly sources: readonly RuneProofAlternativeSourceGroup[];
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = 'runeproof-alternatives-' + useId();

  return (
    <section className="rounded-lg border border-white/10 bg-[#171717]">
      <h3>
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen(open => !open)}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-gray-200 transition-colors hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        >
          <span>Other legal sources</span>
          <ChevronDown
            size={15}
            className={'shrink-0 text-gray-400 transition-transform ' + (isOpen ? 'rotate-180' : '')}
            aria-hidden
          />
        </button>
      </h3>

      {isOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label="Other legal sources"
          className="space-y-3 border-t border-white/10 px-3 py-3"
        >
          {sources.length > 0 ? (
            sources.map(source => (
              <section key={source.itemKey}>
                <h4 className="text-[11px] font-semibold text-gray-200">{source.itemName}</h4>
                <ul className="mt-1.5 space-y-1.5">
                  {source.routes.map(route => (
                    <li
                      key={route.id}
                      className="rounded border border-white/10 bg-black/15 px-2.5 py-2 text-[11px] text-gray-300"
                    >
                      <span className="font-semibold text-gray-100">{route.label}</span>
                      <span className="ml-1.5 text-gray-500">{route.sourceKind}</span>
                      <span className="ml-1.5 text-gray-500">
                        {route.deterministic ? 'Deterministic' : route.probabilityText ?? 'Chance-based'}
                      </span>
                      {route.variantCount > 1 && (
                        <span className="ml-1.5 text-gray-500">
                          {route.variantCount} route variants
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <p className="text-[11px] text-gray-500">No other reviewed legal sources are available.</p>
          )}
        </div>
      ) : null}
    </section>
  );
};

function LegacyRuneProofCoachView({
  model,
  onConfirmAction,
}: LegacyRuneProofCoachProps) {
  const coachId = useId();
  const objectiveHeadingId = 'runeproof-objective-heading-' + coachId;
  const nextActionHeadingId = 'runeproof-next-action-heading-' + coachId;
  const routeHeadingId = 'runeproof-route-heading-' + coachId;
  const currentActionId = model.nextAction?.id;
  const [temporaryMap, setTemporaryMap] = useState<{
    readonly action: RuneProofCoachAction;
    readonly chunk: ChunkKey;
    readonly returnFocusTarget: HTMLButtonElement;
  } | null>(null);

  const showTemporaryMap = (action: RuneProofCoachAction, trigger: HTMLButtonElement) => {
    const chunk = worldChunk(action.mapChunks);
    if (!chunk) return;
    setTemporaryMap({ action, chunk, returnFocusTarget: trigger });
  };

  return (
    <section
      aria-labelledby={objectiveHeadingId}
      className="min-w-0 w-full space-y-4"
    >
      <header className="border-b border-white/10 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">RuneProof</p>
        <h2 id={objectiveHeadingId} className="mt-1 text-base font-bold text-gray-100">
          {model.questId}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">{model.recommendationReason}</p>
        <div className="mt-3 flex items-center gap-2">
          <progress
            aria-label={model.questId + ' progress'}
            value={model.progress.completed}
            max={model.progress.total || 1}
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full accent-cyan-400"
          />
          <span className="shrink-0 text-[10px] font-mono text-gray-500">
            {model.progress.completed}/{model.progress.total} complete
          </span>
        </div>
      </header>

      <section aria-labelledby={nextActionHeadingId}>
        <div className="mb-2 flex items-center gap-2">
          <h3 id={nextActionHeadingId} className="text-sm font-bold text-gray-100">
            Next action
          </h3>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        {model.nextAction ? (
          <CurrentActionCard
            action={model.nextAction}
            onConfirmAction={onConfirmAction}
            onShowMap={showTemporaryMap}
          />
        ) : model.actions.length > 0 ? (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-100">
            All reviewed actions are complete.
          </p>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-gray-300">
            No reviewed actions are available for this objective.
          </p>
        )}
      </section>

      <section aria-labelledby={routeHeadingId}>
        <div className="mb-2 flex items-center gap-2">
          <h3 id={routeHeadingId} className="text-sm font-bold text-gray-100">
            Route
          </h3>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <ol aria-label={model.questId + ' route'} className="space-y-2">
          {model.actions.map((action, index) => (
            <TimelineAction
              key={action.id}
              action={action}
              index={index}
              isCurrent={action.id === currentActionId}
              onConfirmAction={onConfirmAction}
            />
          ))}
        </ol>
      </section>

      <AlternativeSources sources={model.alternativeSources} />

      <RuneProofProofDrawer variant="LEGACY" proof={model.proof} />

      {temporaryMap ? (
        <RuneProofTemporaryMap
          instruction={temporaryMap.action.instruction}
          locationLabel={temporaryMap.action.locationLabel}
          chunk={temporaryMap.chunk}
          returnFocusTarget={temporaryMap.returnFocusTarget}
          onClose={() => setTemporaryMap(null)}
        />
      ) : null}
    </section>
  );
}

const proofStateLabel = (state: RuneProofPackCoachModel['proofState']): string => {
  switch (state) {
    case 'READY': return 'Ready';
    case 'CONFIRM': return 'Needs confirmation';
    case 'BLOCKED': return 'Blocked';
    case 'NEEDS_REVIEW': return 'Needs review';
    case 'COMPLETE': return 'Complete';
  }
};

const locationChunks = (
  location: RuneProofCoachLocationModel,
): readonly ChunkKey[] => location.kind === 'SURFACE'
  ? location.mapChunks
  : location.entranceChunks;

const PackLocation = ({ location }: { readonly location: RuneProofCoachLocationModel }) => (
  <div className="space-y-0.5 text-[11px] text-gray-400">
    <p>Location: {location.label}</p>
    {location.kind === 'SURFACE' ? (
      <p>Surface chunks: {location.mapChunks.join(' · ')}</p>
    ) : (
      <>
        <p>Instance: {location.instanceId}</p>
        <p>Entrance chunks: {location.entranceChunks.join(' · ')}</p>
      </>
    )}
    <p>Plane: {location.plane}</p>
  </div>
);

const targetIsConfirmed = (
  model: RuneProofPackCoachModel,
  target: RuneProofCoachCompletionTarget,
): boolean => {
  const confirmations = model.progress.activeConfirmations;
  switch (target.kind) {
    case 'ACTION': return confirmations.actionIds.includes(target.id);
    case 'ITEM': return confirmations.itemKeys.includes(target.id);
    case 'MANUAL': return confirmations.manualIds.includes(target.id);
    case 'CHECKPOINT': return confirmations.checkpointIds.includes(target.id);
  }
};

const PackActionCompletion = ({
  action,
  checked,
  onSetCompletion,
}: {
  readonly action: RuneProofPackCoachAction;
  readonly checked: boolean;
  readonly onSetCompletion: RuneProofPackCoachProps['onSetCompletion'];
}) => action.confirmationAllowed ? (
  <label className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-200">
    <input
      type="checkbox"
      checked={checked}
      onChange={event => onSetCompletion(
        action.completionTarget,
        event.currentTarget.checked,
      )}
      className="mt-0.5"
    />
    <span>Confirm {action.instruction}</span>
  </label>
) : null;

const PackActionCopy = ({ action }: { readonly action: RuneProofPackCoachAction }) => (
  <div className="space-y-2">
    <div>
      <StateLabel state={action.state} />
      <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-gray-100">
        {action.instruction}
      </p>
    </div>
    <PackLocation location={action.reviewedLocation} />
    {action.preferredMethodLabel ? (
      <p className="text-[11px] text-gray-400">
        Reviewed method: {action.preferredMethodLabel}
      </p>
    ) : null}
  </div>
);

const PackActionGuidance = ({ action }: { readonly action: RuneProofPackCoachAction }) => (
  action.blockerText
  || action.unblockActions.length > 0
  || action.requirementAdvisories.length > 0
) ? (
  <section
    aria-label="Current action guidance"
    className="space-y-2 rounded-lg border border-white/10 bg-[#171717] p-3"
  >
    {action.blockerText ? (
      <p
        role="note"
        className="rounded border border-amber-400/25 bg-amber-950/30 px-2 py-1.5 text-[11px] text-amber-100"
      >
        {action.blockerText}
      </p>
    ) : null}
    {action.unblockActions.length > 0 ? (
      <section aria-label="Reviewed unblock actions">
        <h5 className="text-[10px] font-bold uppercase tracking-widest text-amber-200">
          Unblock actions
        </h5>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-amber-100">
          {action.unblockActions.map((unblock, index) => (
            <li key={`${unblock}:${index}`}>{unblock}</li>
          ))}
        </ul>
      </section>
    ) : null}
    {action.requirementAdvisories.length > 0 ? (
      <section aria-label="Reviewed route advisories">
        <h5 className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">
          Route advisories
        </h5>
        <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-gray-300">
          {action.requirementAdvisories.map((advisory, index) => (
            <li key={`${advisory}:${index}`}>{advisory}</li>
          ))}
        </ul>
      </section>
    ) : null}
  </section>
) : null;

const PackTimelineAction = ({
  action,
  index,
  model,
  onSetCompletion,
}: {
  readonly action: RuneProofPackCoachAction;
  readonly index: number;
  readonly model: RuneProofPackCoachModel;
  readonly onSetCompletion: RuneProofPackCoachProps['onSetCompletion'];
}) => (
  <li className="min-w-0 rounded-md border border-white/10 bg-[#1b1b1b]">
    <details open={action.current}>
      <summary className="flex cursor-pointer list-none items-start gap-2 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300">
        <span className="mt-0.5 text-[10px] font-mono text-gray-600" aria-hidden>
          {index + 1}.
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words text-[11px] font-semibold leading-relaxed text-gray-200">
            {action.instruction}
          </span>
          <span className="mt-1 block"><StateLabel state={action.state} /></span>
        </span>
        <ChevronRight size={14} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
      </summary>
      <div className="space-y-2 border-t border-white/5 px-3 py-2">
        <PackLocation location={action.reviewedLocation} />
        {action.preferredMethodLabel ? (
          <p className="text-[11px] text-gray-400">
            Reviewed method: {action.preferredMethodLabel}
          </p>
        ) : null}
        {!action.current ? (
          <PackActionCompletion
            action={action}
            checked={targetIsConfirmed(model, action.completionTarget)}
            onSetCompletion={onSetCompletion}
          />
        ) : (
          <p className="text-[11px] text-gray-500">Use the Do now card for this current step.</p>
        )}
      </div>
    </details>
  </li>
);

const ReviewedAlternative = ({
  alternative,
  onSetManualConfirmed,
}: {
  readonly alternative: RuneProofReviewedAlternativeModel;
  readonly onSetManualConfirmed: RuneProofPackCoachProps['onSetManualConfirmed'];
}) => (
  <article
    aria-label={alternative.label}
    className="space-y-2 rounded-lg border border-white/10 bg-[#171717] p-3"
  >
    <header className="flex flex-wrap items-center gap-2">
      <h4 className="text-xs font-bold text-gray-100">{alternative.label}</h4>
      <span className="text-[10px] font-semibold text-cyan-200">
        {proofStateLabel(alternative.state)}
      </span>
    </header>
    {alternative.reviewedLocation ? <PackLocation location={alternative.reviewedLocation} /> : null}
    {alternative.blockerReasons.length > 0 ? (
      <ul aria-label="Alternative blockers" className="list-disc space-y-1 pl-4 text-[11px] text-amber-100">
        {alternative.blockerReasons.map((blocker, index) => (
          <li key={`${blocker}:${index}`}>{blocker}</li>
        ))}
      </ul>
    ) : null}
    {alternative.unblockActions.length > 0 ? (
      <ul aria-label="Alternative unblock actions" className="list-disc space-y-1 pl-4 text-[11px] text-emerald-200">
        {alternative.unblockActions.map((unblock, index) => (
          <li key={`${unblock}:${index}`}>{unblock}</li>
        ))}
      </ul>
    ) : null}
    <p className="break-words text-[10px] text-gray-500">
      Reviewed evidence: {alternative.evidenceIds.join(', ')}
    </p>
    <RuneProofManualConfirmations
      confirmations={alternative.manualConfirmations}
      onSetManualConfirmed={onSetManualConfirmed}
    />
  </article>
);

type PackTemporaryMapState = Readonly<{
  instruction: string;
  locationLabel: string;
  plane: number;
  chunk: ChunkKey;
  returnFocusTarget: HTMLButtonElement;
} & (
  { kind: 'SURFACE' }
  | { kind: 'INSTANCE'; instanceId: string }
)>;

function RuneProofPackCoachView({
  model,
  onSetCompletion,
  onSelectBranch,
  onSetItemConfirmed,
  onSetManualConfirmed,
}: RuneProofPackCoachProps) {
  const coachId = useId();
  const objectiveHeadingId = 'runeproof-pack-objective-heading-' + coachId;
  const doNowHeadingId = 'runeproof-pack-do-now-heading-' + coachId;
  const routeHeadingId = 'runeproof-pack-route-heading-' + coachId;
  const [temporaryMap, setTemporaryMap] = useState<PackTemporaryMapState | null>(null);

  const showTemporaryMap = (
    action: RuneProofPackCoachAction,
    trigger: HTMLButtonElement,
  ) => {
    const chunks = locationChunks(action.reviewedLocation);
    const chunk = worldChunk(chunks);
    if (!chunk) return;
    if (action.reviewedLocation.kind === 'INSTANCE') {
      setTemporaryMap({
        kind: 'INSTANCE',
        instruction: `Entrance for ${action.instruction}`,
        locationLabel: `Entrance: ${action.reviewedLocation.label}`,
        instanceId: action.reviewedLocation.instanceId,
        plane: action.reviewedLocation.plane,
        chunk,
        returnFocusTarget: trigger,
      });
      return;
    }
    setTemporaryMap({
      kind: 'SURFACE',
      instruction: action.instruction,
      locationLabel: action.reviewedLocation.label,
      plane: action.reviewedLocation.plane,
      chunk,
      returnFocusTarget: trigger,
    });
  };

  return (
    <section aria-labelledby={objectiveHeadingId} className="min-w-0 w-full space-y-4">
      <header className="border-b border-white/10 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">RuneProof</p>
        <h2 id={objectiveHeadingId} className="mt-1 text-base font-bold text-gray-100">
          {model.questId}
        </h2>
        <p className="mt-1 text-xs font-semibold text-cyan-200">
          Proof state: {proofStateLabel(model.proofState)}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-gray-400">
          {model.branch.recommendationReason}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <progress
            aria-label={model.questId + ' progress'}
            value={model.progress.completed}
            max={model.progress.total || 1}
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full accent-cyan-400"
          />
          <span className="shrink-0 text-[10px] font-mono text-gray-500">
            {model.progress.completed}/{model.progress.total} complete
          </span>
        </div>
      </header>

      <RuneProofBranchSelector
        key={model.questId}
        branches={model.branch.options}
        onSelectBranch={onSelectBranch}
      />

      <RuneProofInitialItems
        items={model.initialItems}
        onSetItemConfirmed={onSetItemConfirmed}
      />
      <RuneProofManualConfirmations
        confirmations={model.manualConfirmations}
        onSetManualConfirmed={onSetManualConfirmed}
      />

      {model.currentCombatCards.map(card => (
        <RuneProofCombatReadiness
          key={card.id}
          model={card}
          onSetConfirmed={onSetManualConfirmed}
        />
      ))}

      <section aria-labelledby={doNowHeadingId}>
        <div className="mb-2 flex items-center gap-2">
          <h3 id={doNowHeadingId} className="text-sm font-bold text-gray-100">Do now</h3>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        {model.doNow ? (
          <article className="rounded-lg border border-cyan-400/30 bg-cyan-950/20 p-3">
            <PackActionCopy action={model.doNow} />
            <div className="mt-3 flex flex-wrap items-start gap-3">
              {worldChunk(locationChunks(model.doNow.reviewedLocation)) ? (
                <button
                  type="button"
                  aria-label={model.doNow.reviewedLocation.kind === 'INSTANCE'
                    ? `Show entrance for ${model.doNow.instruction} on map`
                    : `Show ${model.doNow.instruction} on map`}
                  onClick={event => showTemporaryMap(model.doNow!, event.currentTarget)}
                  className="rounded border border-cyan-300/40 bg-cyan-950/50 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-100"
                >
                  Show on map
                </button>
              ) : null}
              <PackActionCompletion
                action={model.doNow}
                checked={targetIsConfirmed(model, model.doNow.completionTarget)}
                onSetCompletion={onSetCompletion}
              />
            </div>
          </article>
        ) : (
          <p className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-gray-300">
            {model.proofState === 'COMPLETE'
              ? 'All reviewed actions are complete.'
              : 'No reviewed current action is available.'}
          </p>
        )}
      </section>

      <section aria-labelledby={routeHeadingId}>
        <div className="mb-2 flex items-center gap-2">
          <h3 id={routeHeadingId} className="text-sm font-bold text-gray-100">Route</h3>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        <ol aria-label={model.questId + ' route'} className="space-y-2">
          {model.actions.map((action, index) => (
            <PackTimelineAction
              key={action.id}
              action={action}
              index={index}
              model={model}
              onSetCompletion={onSetCompletion}
            />
          ))}
        </ol>
      </section>

      {model.doNow ? <PackActionGuidance action={model.doNow} /> : null}

      {model.reviewedAlternatives.length > 0 ? (
        <section aria-label="Reviewed alternatives" className="space-y-2">
          <h3 className="text-sm font-bold text-gray-100">Reviewed alternatives</h3>
          {model.reviewedAlternatives.map(alternative => (
            <ReviewedAlternative
              key={alternative.id}
              alternative={alternative}
              onSetManualConfirmed={onSetManualConfirmed}
            />
          ))}
        </section>
      ) : null}

      <AlternativeSources sources={model.alternativeSources} />
      <RuneProofProofDrawer variant="PACK" proof={model.proof} />

      {temporaryMap ? (
        <RuneProofTemporaryMap
          instruction={temporaryMap.instruction}
          locationLabel={temporaryMap.kind === 'INSTANCE'
            ? `${temporaryMap.locationLabel} · Instance: ${temporaryMap.instanceId} · Plane: ${temporaryMap.plane}`
            : `${temporaryMap.locationLabel} · Plane: ${temporaryMap.plane}`}
          chunk={temporaryMap.chunk}
          returnFocusTarget={temporaryMap.returnFocusTarget}
          onClose={() => setTemporaryMap(null)}
        />
      ) : null}
    </section>
  );
}

export function RuneProofCoach(props: RuneProofCoachProps) {
  if (props.variant === 'LEGACY') return <LegacyRuneProofCoachView {...props} />;
  return <RuneProofPackCoachView {...props} />;
}
