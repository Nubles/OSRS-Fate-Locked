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
  RuneProofCoachModel,
} from '../../utils/questStrategies/coach';
import { RuneProofProofDrawer } from './RuneProofProofDrawer';

export interface RuneProofCoachProps {
  readonly model: RuneProofCoachModel;
  readonly onConfirmAction: (actionId: string) => void;
  readonly onOpenWorldChunk?: (cx: number, cy: number) => void;
}

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

const worldChunk = (
  chunks: RuneProofCoachAction['mapChunks'],
): { readonly cx: number; readonly cy: number } | undefined => {
  const firstChunk = chunks[0];
  if (!firstChunk) return undefined;

  const [rawX, rawY, extra] = firstChunk.split(',');
  const cx = Number(rawX);
  const cy = Number(rawY);
  return extra === undefined && Number.isInteger(cx) && Number.isInteger(cy)
    ? { cx, cy }
    : undefined;
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
  onOpenWorldChunk,
}: {
  readonly action: RuneProofCoachAction;
  readonly onConfirmAction: RuneProofCoachProps['onConfirmAction'];
  readonly onOpenWorldChunk: RuneProofCoachProps['onOpenWorldChunk'];
}) => {
  const mapLocation = onOpenWorldChunk ? worldChunk(action.mapChunks) : undefined;

  return (
    <article className="rounded-lg border border-cyan-400/30 bg-cyan-950/20 p-3">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <StateLabel state={action.state} />
          <p className="mt-1 break-words text-sm font-semibold leading-relaxed text-gray-100">
            {action.instruction}
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

        {mapLocation || action.confirmationAllowed ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {mapLocation ? (
              <button
                type="button"
                aria-label={'Show ' + action.instruction + ' on map'}
                onClick={() => onOpenWorldChunk?.(mapLocation.cx, mapLocation.cy)}
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
                Mark action complete
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
}: {
  readonly action: RuneProofCoachAction;
  readonly index: number;
  readonly isCurrent: boolean;
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
        </span>
        <ChevronRight size={14} className="mt-0.5 shrink-0 text-gray-500" aria-hidden />
      </summary>
      <div className="space-y-1 border-t border-white/5 px-3 py-2 text-[11px] leading-relaxed text-gray-400">
        {action.locationLabel ? <p>Location: {action.locationLabel}</p> : null}
        {action.preferredMethodLabel ? <p>Reviewed method: {action.preferredMethodLabel}</p> : null}
        {action.blockerText ? <p className="text-amber-100">{action.blockerText}</p> : null}
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
          {sources.map(source => (
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
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export function RuneProofCoach({
  model,
  onConfirmAction,
  onOpenWorldChunk,
}: RuneProofCoachProps) {
  const currentActionId = model.nextAction?.id;

  return (
    <section
      aria-labelledby="runeproof-objective-heading"
      className="min-w-0 w-full space-y-4"
    >
      <header className="border-b border-white/10 pb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">RuneProof</p>
        <h2 id="runeproof-objective-heading" className="mt-1 text-base font-bold text-gray-100">
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

      <section aria-labelledby="runeproof-next-action-heading">
        <div className="mb-2 flex items-center gap-2">
          <h3 id="runeproof-next-action-heading" className="text-sm font-bold text-gray-100">
            Next action
          </h3>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        {model.nextAction ? (
          <CurrentActionCard
            action={model.nextAction}
            onConfirmAction={onConfirmAction}
            onOpenWorldChunk={onOpenWorldChunk}
          />
        ) : (
          <p className="rounded-lg border border-emerald-400/25 bg-emerald-950/20 px-3 py-2.5 text-xs text-emerald-100">
            All reviewed actions are complete.
          </p>
        )}
      </section>

      <section aria-labelledby="runeproof-route-heading">
        <div className="mb-2 flex items-center gap-2">
          <h3 id="runeproof-route-heading" className="text-sm font-bold text-gray-100">
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
            />
          ))}
        </ol>
      </section>

      {model.alternativeSources.length > 0 ? (
        <AlternativeSources sources={model.alternativeSources} />
      ) : null}

      <RuneProofProofDrawer proof={model.proof} />
    </section>
  );
}
