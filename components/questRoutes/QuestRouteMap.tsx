import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { MAP_IMAGE } from '../../utils/mapCoords';
import type { ChunkKey } from '../../utils/questRoutes/model';
import {
  createRouteMapGeometry,
  panRouteMap,
  zoomRouteMapAt,
  type RouteMapSize,
  type RouteMapTransform,
} from '../../utils/questRoutes/routeMapGeometry';
import type {
  QuestRouteMapChunk,
  QuestRouteMapLayer,
  QuestRouteMapLayerId,
  QuestRouteMapMarkerState,
  QuestRouteMapModel,
  QuestRouteMapStep,
} from '../../utils/questRoutes/routeMapModel';

export interface QuestRouteMapFocusRequest {
  readonly layer: QuestRouteMapLayerId;
  readonly targetId: string;
  readonly nonce: number;
}

export interface QuestRouteMapProps {
  readonly model: QuestRouteMapModel;
  readonly focusRequest?: QuestRouteMapFocusRequest;
  readonly onViewTarget?: (targetAnchor: string) => void;
  readonly onOpenWorldChunk?: (cx: number, cy: number) => void;
}

const DEFAULT_VIEWPORT: RouteMapSize = { width: 640, height: 360 };
const ZOOM_FACTOR = 1.4;

const ROUTE_STATE_TEXT: Record<QuestRouteMapMarkerState, string> = {
  USABLE: 'Usable now',
  BLOCKED: 'Blocked',
  INCOMPLETE: 'Route data incomplete',
};

const ROUTE_PATTERN: Record<QuestRouteMapMarkerState, string> = {
  USABLE: 'usable',
  BLOCKED: 'blocked',
  INCOMPLETE: 'incomplete',
};

const PREPARATION_PATTERN_CLASS: Record<QuestRouteMapMarkerState, string> = {
  USABLE: 'border-emerald-300 bg-emerald-700/85',
  BLOCKED: 'border-amber-200 bg-[repeating-linear-gradient(135deg,rgba(180,83,9,0.95)_0_5px,rgba(120,53,15,0.95)_5px_10px)]',
  INCOMPLETE: 'border-dashed border-slate-300 bg-slate-800/85',
};

const QUEST_PATH_PATTERN_CLASS: Record<QuestRouteMapMarkerState, string> = {
  USABLE: 'border-cyan-200 bg-cyan-700/90',
  BLOCKED: 'border-orange-100 bg-[repeating-linear-gradient(45deg,rgba(194,65,12,0.95)_0_5px,rgba(124,45,18,0.95)_5px_10px)]',
  INCOMPLETE: 'border-dashed border-violet-200 bg-violet-950/90',
};

const listWithAnd = (values: readonly (string | number)[]): string => {
  if (values.length === 0) return '';
  if (values.length === 1) return String(values[0]);
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}`;
};

const chunkStatusText = (
  layer: QuestRouteMapLayer,
  chunk: QuestRouteMapChunk,
): string => {
  if (layer.id !== 'QUEST_PATH') return ROUTE_STATE_TEXT[chunk.state];
  const statuses = [...new Set(chunk.steps
    .filter((step): step is Extract<QuestRouteMapStep, { kind: 'QUEST_ACTION' }> => (
      step.kind === 'QUEST_ACTION'
    ))
    .map(step => step.statusText))];
  return statuses.length > 0 ? listWithAnd(statuses) : ROUTE_STATE_TEXT[chunk.state];
};

const chunkButtonName = (
  layer: QuestRouteMapLayer,
  chunk: QuestRouteMapChunk,
): string => {
  const sequences = chunk.steps.map(step => step.sequence);
  const countLabel = sequences.length === 1 ? 'step' : 'steps';
  const chunkLabel = layer.id === 'QUEST_PATH' ? 'Quest path chunk' : 'Route chunk';
  const layerStepLabel = layer.id === 'QUEST_PATH' ? 'Quest' : 'Preparation';
  return `${chunkLabel} ${chunk.chunk}: ${layerStepLabel} ${countLabel} ${listWithAnd(sequences)}. ${chunkStatusText(layer, chunk)}`;
};

const stepDisplayName = (step: QuestRouteMapStep): string => (
  step.kind === 'QUEST_ACTION' ? step.label : step.itemName
);

const conciseChunkLabel = (chunk: QuestRouteMapChunk): string => {
  const sequences = chunk.steps.map(step => step.sequence);
  const label = sequences.length === 1 ? 'Step' : 'Steps';
  return `${label} ${listWithAnd(sequences)} · ${chunk.steps.map(stepDisplayName).join(', ')}`;
};

const mapIdToken = (value: string): string => value
  .toLocaleLowerCase('en-GB')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const layerIdentity = (
  model: QuestRouteMapModel,
  layer: QuestRouteMapLayer,
): string => `${model.questId}|${layer.id}|${layer.chunks.map(chunk => (
  `${chunk.chunk}:${chunk.steps.map(step => `${step.id}:${step.sequence}`).join(',')}`
)).join('|')}`;

const initialLayerId = (model: QuestRouteMapModel): QuestRouteMapLayerId => (
  model.defaultLayer
);

const initialChunk = (chunks: readonly QuestRouteMapChunk[]): ChunkKey | null =>
  chunks.find(chunk => chunk.state !== 'USABLE')?.chunk
  ?? chunks[0]?.chunk
  ?? null;

interface NormalisedFocusRequest {
  readonly layer: QuestRouteMapLayerId;
  readonly targetId: string;
  readonly nonce: number;
}

const normaliseFocusRequest = (
  focusRequest?: QuestRouteMapFocusRequest,
): NormalisedFocusRequest | null => {
  if (!focusRequest) return null;
  const candidate = focusRequest as unknown as Record<string, unknown>;
  if (
    Object.hasOwn(candidate, 'itemId')
    || (candidate.layer !== 'QUEST_PATH' && candidate.layer !== 'PREPARATION')
    || typeof candidate.targetId !== 'string'
    || candidate.targetId.length === 0
    || typeof candidate.nonce !== 'number'
    || !Number.isFinite(candidate.nonce)
  ) return null;
  return {
    layer: candidate.layer,
    targetId: candidate.targetId,
    nonce: candidate.nonce,
  };
};

const useReducedMotion = (): boolean => {
  const query = '(prefers-reduced-motion: reduce)';
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(query).matches
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia(query);
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reducedMotion;
};

const orderTraySteps = (
  steps: readonly QuestRouteMapStep[],
  preferredTargetId: string | null,
): QuestRouteMapStep[] => {
  const ordered = [...steps].sort((left, right) => left.sequence - right.sequence);
  if (!preferredTargetId) return ordered;
  return [
    ...ordered.filter(step => step.targetId === preferredTargetId),
    ...ordered.filter(step => step.targetId !== preferredTargetId),
  ];
};

export const QuestRouteMap: React.FC<QuestRouteMapProps> = ({
  model,
  focusRequest,
  onViewTarget,
  onOpenWorldChunk,
}) => {
  const mapRegionRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef(new Map<ChunkKey, HTMLButtonElement>());
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const consumedFocusRequestRef = useRef<NormalisedFocusRequest | null>(null);
  const pendingFocusRequestRef = useRef<NormalisedFocusRequest | null>(null);
  const [viewportSize, setViewportSize] = useState<RouteMapSize>(DEFAULT_VIEWPORT);
  const [activeLayerId, setActiveLayerId] = useState<QuestRouteMapLayerId>(() => (
    initialLayerId(model)
  ));
  const activeLayer = model.layers.find(layer => layer.id === activeLayerId)
    ?? model.layers[0];
  const identity = layerIdentity(model, activeLayer);
  const geometry = useMemo(
    () => createRouteMapGeometry(activeLayer.chunks.map(chunk => chunk.chunk), viewportSize),
    [identity, viewportSize],
  );
  const selectableChunks = useMemo(
    () => activeLayer.chunks.filter(chunk => geometry.validChunks.has(chunk.chunk)),
    [activeLayer.chunks, geometry],
  );
  const allGeometry = useMemo(
    () => createRouteMapGeometry(
      model.layers.flatMap(layer => layer.chunks.map(chunk => chunk.chunk)),
      viewportSize,
    ),
    [model, viewportSize],
  );
  const [transform, setTransform] = useState<RouteMapTransform>(geometry.fitted);
  const [selectedChunk, setSelectedChunk] = useState<ChunkKey | null>(
    initialChunk(selectableChunks),
  );
  const [preferredTargetId, setPreferredTargetId] = useState<string | null>(null);
  const [hoveredChunk, setHoveredChunk] = useState<ChunkKey | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const reducedMotion = useReducedMotion();
  const requestedFocus = normaliseFocusRequest(focusRequest);
  const viewTarget = onViewTarget ?? (() => undefined);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;
    const updateSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setViewportSize(current => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };
    const initialRect = viewport.getBoundingClientRect();
    updateSize(initialRect.width, initialRect.height);
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setTransform(geometry.fitted);
  }, [geometry]);

  useEffect(() => {
    setActiveLayerId(initialLayerId(model));
    setImageFailed(false);
  }, [model.questId]);

  useEffect(() => {
    setSelectedChunk(initialChunk(selectableChunks));
    setPreferredTargetId(null);
    setHoveredChunk(null);
    setIsDragging(false);
    dragRef.current = null;
  }, [identity]);

  useEffect(() => {
    if (!requestedFocus) return;
    const consumed = consumedFocusRequestRef.current;
    if (
      consumed?.layer === requestedFocus.layer
      && consumed.targetId === requestedFocus.targetId
      && consumed.nonce === requestedFocus.nonce
    ) return;

    consumedFocusRequestRef.current = requestedFocus;
    if (requestedFocus.layer !== activeLayer.id) {
      pendingFocusRequestRef.current = requestedFocus;
      setActiveLayerId(requestedFocus.layer);
      return;
    }

    const requestedStep = selectableChunks
      .flatMap(chunk => chunk.steps.map(step => ({ chunk, step })))
      .filter(entry => entry.step.targetId === requestedFocus.targetId)
      .sort((left, right) => left.step.sequence - right.step.sequence)[0];
    if (!requestedStep) return;

    setSelectedChunk(requestedStep.chunk.chunk);
    setPreferredTargetId(requestedFocus.targetId);
    setTransform(createRouteMapGeometry([requestedStep.chunk.chunk], viewportSize).fitted);
    mapRegionRef.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    markerRefs.current.get(requestedStep.chunk.chunk)?.focus({ preventScroll: true });
  }, [requestedFocus?.layer, requestedFocus?.targetId, requestedFocus?.nonce]);

  useEffect(() => {
    const pending = pendingFocusRequestRef.current;
    if (!pending || pending.layer !== activeLayer.id) return;

    const requestedStep = selectableChunks
      .flatMap(chunk => chunk.steps.map(step => ({ chunk, step })))
      .filter(entry => entry.step.targetId === pending.targetId)
      .sort((left, right) => left.step.sequence - right.step.sequence)[0];
    pendingFocusRequestRef.current = null;
    if (!requestedStep) return;

    setSelectedChunk(requestedStep.chunk.chunk);
    setPreferredTargetId(pending.targetId);
    setTransform(createRouteMapGeometry([requestedStep.chunk.chunk], viewportSize).fitted);
    mapRegionRef.current?.scrollIntoView?.({
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    markerRefs.current.get(requestedStep.chunk.chunk)?.focus({ preventScroll: true });
  }, [activeLayer.id, identity, selectableChunks, viewportSize, reducedMotion]);

  const selected = selectableChunks.find(chunk => chunk.chunk === selectedChunk) ?? null;
  const selectedWorldChunk = useMemo(() => {
    if (!selected || !onOpenWorldChunk || !selected.steps.some(step => step.canOpenWorldChunk)) {
      return null;
    }
    const [cx, cy] = selected.chunk.split(',').map(Number);
    return Number.isFinite(cx) && Number.isFinite(cy) ? { cx, cy } : null;
  }, [selected, onOpenWorldChunk]);
  const hovered = selectableChunks.find(chunk => chunk.chunk === hoveredChunk) ?? null;
  const traySteps = selected ? orderTraySteps(selected.steps, preferredTargetId) : [];
  const mapId = `runeproof-route-map-${mapIdToken(model.questId)}`;
  const trayId = `${mapId}-tray`;
  const trayHeadingId = `${trayId}-heading`;
  const trayLabel = `Selected ${activeLayer.label} chunk details`;
  const patternClasses = activeLayer.id === 'QUEST_PATH'
    ? QUEST_PATH_PATTERN_CLASS
    : PREPARATION_PATTERN_CLASS;

  if (allGeometry.validChunks.size === 0) return null;

  const zoom = (factor: number) => {
    setTransform(current => zoomRouteMapAt(
      current,
      factor,
      { x: viewportSize.width / 2, y: viewportSize.height / 2 },
      viewportSize,
    ));
  };

  const selectDirectly = (chunk: ChunkKey) => {
    setSelectedChunk(chunk);
    setPreferredTargetId(null);
  };

  const selectLayer = (layerId: QuestRouteMapLayerId) => {
    setActiveLayerId(layerId);
    setPreferredTargetId(null);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  return (
    <section
      ref={mapRegionRef}
      role="region"
      aria-label={`${model.questId} main path map`}
      className="space-y-2 rounded-lg border border-white/10 bg-[#101416] p-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
          Route map
        </p>
        <div className="flex gap-1" aria-label="Route map controls">
          <button
            type="button"
            aria-label="Zoom route map in"
            onClick={() => zoom(ZOOM_FACTOR)}
            className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            +
          </button>
          <button
            type="button"
            aria-label="Zoom route map out"
            onClick={() => zoom(1 / ZOOM_FACTOR)}
            className="rounded border border-white/15 bg-black/30 px-2 py-1 text-xs text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            −
          </button>
          <button
            type="button"
            aria-label={activeLayer.id === 'QUEST_PATH' ? 'Fit Quest path' : 'Fit complete route'}
            onClick={() => setTransform(geometry.fitted)}
            className="rounded border border-white/15 bg-black/30 px-2 py-1 text-[10px] font-semibold text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Fit
          </button>
        </div>
      </div>

      <div className="flex gap-1" role="group" aria-label="Map layer">
        {model.layers.map(layer => (
          <button
            key={layer.id}
            type="button"
            aria-pressed={layer.id === activeLayer.id}
            onClick={() => selectLayer(layer.id)}
            className={`rounded border px-2.5 py-1 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${
              layer.id === activeLayer.id
                ? 'border-cyan-300 bg-cyan-950/60 text-cyan-100'
                : 'border-white/15 bg-black/30 text-gray-300'
            }`}
          >
            {layer.label}
          </button>
        ))}
      </div>

      <div
        ref={viewportRef}
        data-testid="route-map-viewport"
        data-route-map-viewport=""
        data-map-scale={transform.scale}
        data-map-x={transform.x}
        data-map-y={transform.y}
        onPointerDown={(event) => {
          if (event.button !== 0 || (event.target as Element).closest('button')) return;
          dragRef.current = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
          };
          setIsDragging(true);
          event.currentTarget.setPointerCapture?.(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const delta = { x: event.clientX - drag.x, y: event.clientY - drag.y };
          dragRef.current = { pointerId: drag.pointerId, x: event.clientX, y: event.clientY };
          setTransform(current => panRouteMap(current, delta, viewportSize));
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative h-[360px] w-full touch-none select-none overflow-hidden rounded-md border border-white/10 bg-[#080b0c] cursor-grab active:cursor-grabbing"
      >
        <div
          data-testid="route-map-layer"
          className={`absolute left-0 top-0 origin-top-left ${reducedMotion || isDragging ? '' : 'transition-transform duration-200'}`}
          style={{
            width: MAP_IMAGE.width,
            height: MAP_IMAGE.height,
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          }}
        >
          {!imageFailed && (
            <>
              <img
                src={MAP_IMAGE.srcLo}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-fill"
                draggable={false}
              />
              <img
                src={MAP_IMAGE.src}
                alt="OSRS world map"
                onError={() => setImageFailed(true)}
                className="absolute inset-0 h-full w-full object-fill"
                draggable={false}
              />
            </>
          )}

          {selectableChunks.map(chunk => {
            const rect = geometry.validChunks.get(chunk.chunk)!;
            const isSelected = chunk.chunk === selectedChunk;
            const minimumTargetSize = 24 / Math.max(transform.scale, Number.EPSILON);
            const targetWidth = Math.max(rect.width, minimumTargetSize);
            const targetHeight = Math.max(rect.height, minimumTargetSize);
            const markerId = `${mapId}-${activeLayer.id.toLowerCase()}-chunk-${chunk.chunk.replace(',', '-')}`;
            return (
              <button
                key={chunk.chunk}
                ref={(element) => {
                  if (element) markerRefs.current.set(chunk.chunk, element);
                  else markerRefs.current.delete(chunk.chunk);
                }}
                id={markerId}
                type="button"
                aria-label={chunkButtonName(activeLayer, chunk)}
                aria-pressed={isSelected}
                aria-controls={trayId}
                aria-describedby={isSelected ? trayHeadingId : undefined}
                data-route-state={chunk.state}
                data-route-pattern={ROUTE_PATTERN[chunk.state]}
                onClick={() => selectDirectly(chunk.chunk)}
                onMouseEnter={() => setHoveredChunk(chunk.chunk)}
                onMouseLeave={() => setHoveredChunk(null)}
                onFocus={() => setHoveredChunk(chunk.chunk)}
                onBlur={() => setHoveredChunk(null)}
                className="absolute z-10 flex items-center justify-center border-0 bg-transparent p-0 text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cyan-200"
                style={{
                  left: rect.x - ((targetWidth - rect.width) / 2),
                  top: rect.y - ((targetHeight - rect.height) / 2),
                  width: targetWidth,
                  height: targetHeight,
                }}
              >
                <span
                  aria-hidden="true"
                  data-route-marker-highlight=""
                  className={`pointer-events-none absolute left-1/2 top-1/2 flex items-center justify-center border-2 font-bold text-white shadow-md ${patternClasses[chunk.state]} ${isSelected ? 'ring-4 ring-white/90' : ''}`}
                  style={{
                    width: rect.width,
                    height: rect.height,
                    fontSize: Math.max(16, Math.min(rect.width, rect.height) * 0.28),
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {chunk.steps.map(step => step.sequence).join(',')}
                </span>
              </button>
            );
          })}
        </div>

        {hovered && !imageFailed && (
          <div
            role="status"
            className="pointer-events-none absolute bottom-2 left-2 right-2 rounded bg-black/85 px-2 py-1.5 text-[11px] text-gray-100"
          >
            {conciseChunkLabel(hovered)}
          </div>
        )}
      </div>

      {imageFailed && (
        <p
          role="status"
          className="rounded border border-amber-500/30 bg-amber-950/25 px-2 py-1.5 text-sm font-semibold text-amber-200"
        >
          Map unavailable
        </p>
      )}

      {selected && (
        <section
          id={trayId}
          role="region"
          aria-label="Selected route chunk details"
          aria-live="polite"
          className="rounded-md border border-white/10 bg-black/20 p-2"
        >
          <div role="region" aria-label={trayLabel}>
          <h3
            id={trayHeadingId}
            className="text-[10px] font-bold uppercase tracking-wide text-gray-300"
          >
            {trayLabel}
          </h3>
          <ol className="mt-1.5 space-y-2">
            {traySteps.map(step => (
              <li
                key={step.id}
                data-route-step-target={step.targetId}
                data-route-step-item={step.kind === 'PREPARATION' ? step.targetId : undefined}
                data-route-state={step.state}
                data-route-pattern={ROUTE_PATTERN[step.state]}
                className="rounded border border-white/10 bg-white/[0.03] p-2 text-[11px] text-gray-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-100">
                      <span className="mr-1 text-cyan-300">Step {step.sequence}</span>
                      {step.kind === 'QUEST_ACTION' ? step.label : step.itemName}
                    </p>
                    {step.kind === 'PREPARATION' && (
                      <>
                        <p className="mt-0.5 text-gray-400">{step.routeLabel}</p>
                        {step.sourceKind && <p className="text-gray-500">{step.sourceKind}</p>}
                      </>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold text-gray-200">
                    {step.kind === 'QUEST_ACTION'
                      ? step.statusText
                      : ROUTE_STATE_TEXT[step.state]}
                  </span>
                </div>
                {step.kind === 'PREPARATION' && step.blockers.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-amber-200">
                    {step.blockers.map((blocker, index) => (
                      <li key={`${blocker.category}:${blocker.label}:${index}`}>
                        {blocker.category}: {blocker.label}
                      </li>
                    ))}
                  </ul>
                )}
                {step.kind === 'PREPARATION' && step.requiresChunkUnlock && (
                  <p className="mt-1 font-semibold text-amber-200">
                    Requires a chunk unlock
                  </p>
                )}
                <button
                  type="button"
                  aria-label={step.kind === 'QUEST_ACTION'
                    ? `View quest step ${step.sequence}: ${step.label}`
                    : `View requirement for ${step.itemName}`}
                  onClick={() => viewTarget(step.targetAnchor)}
                  className="mt-1.5 rounded border border-cyan-400/30 bg-cyan-950/30 px-2 py-1 text-[10px] font-semibold text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                >
                  {step.kind === 'QUEST_ACTION' ? 'View quest step' : 'View requirement'}
                </button>
              </li>
            ))}
          </ol>
          {selectedWorldChunk && (
            <button
              type="button"
              aria-label={`Open chunk ${selectedWorldChunk.cx},${selectedWorldChunk.cy} on world map`}
              onClick={() => onOpenWorldChunk?.(selectedWorldChunk.cx, selectedWorldChunk.cy)}
              className="mt-2 rounded border border-emerald-400/30 bg-emerald-950/30 px-2 py-1 text-[10px] font-semibold text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              Open on world map
            </button>
          )}
          </div>
        </section>
      )}
    </section>
  );
};

export default QuestRouteMap;
