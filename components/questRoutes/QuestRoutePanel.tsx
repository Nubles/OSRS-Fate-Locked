import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  QuestRouteAnalysis,
  RuneProofRouteAnalysis,
} from '../../utils/questRoutes/analyzeQuest';
import {
  knownWalkthroughBlockerIdentities,
  presentQuestWalkthrough,
} from '../../utils/questWalkthroughs/presenter';
import { remainingQuestRouteAnalysis } from '../../utils/questRoutes/confirmedItems';
import { chunkRectOnMap } from '../../utils/questRoutes/routeMapGeometry';
import {
  buildPreparationRouteMapModel,
  buildQuestRouteMapModel,
} from '../../utils/questRoutes/routeMapModel';
import {
  presentQuestAnalysis,
  type PresentedBlocker,
  type PresentedRoute,
} from '../../utils/questRoutes/presenter';
import {
  QuestRouteMap,
  type QuestRouteMapFocusRequest,
} from './QuestRouteMap';
import { QuestRequirementChecklist } from './QuestRequirementChecklist';
import { QuestWalkthrough } from './QuestWalkthrough';
import type { QuestRequirementChecklistRow } from '../../utils/questRoutes/requirementChecklist';

export interface QuestRoutePanelProps {
  questId: string;
  analysis: RuneProofRouteAnalysis | null;
  checklistRows: readonly QuestRequirementChecklistRow[];
  confirmedItemKeys: ReadonlySet<string>;
  walkthroughVisible?: boolean;
  walkthroughNotice?: string;
  onSetItemConfirmed: (
    questId: string,
    itemKey: string,
    confirmed: boolean,
  ) => void;
  onOpenWorldChunk?: (cx: number, cy: number) => void;
}

const toggleInSet = (current: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(current);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

const BlockerList: React.FC<{
  blockers: readonly PresentedBlocker[];
  className?: string;
}> = ({ blockers, className = '' }) => blockers.length === 0 ? null : (
  <ul className={`space-y-0.5 text-[11px] text-amber-200 ${className}`}>
    {blockers.map((blocker, index) => (
      <li key={`${blocker.category}:${blocker.label}:${index}`}>
        {blocker.category}: {blocker.label}
      </li>
    ))}
  </ul>
);

const RouteDetails: React.FC<{ route: PresentedRoute }> = ({ route }) => (
  <div className="space-y-2 text-[11px] leading-relaxed text-gray-300">
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-gray-500">
      <span><span className="font-semibold text-gray-400">Source:</span> {route.label}</span>
      <span>{route.sourceKind}</span>
      <span>{route.outputQuantity} output</span>
      <span>{route.deterministic ? 'Deterministic' : route.probabilityText ?? 'Chance-based'}</span>
      {route.requiresChunkUnlock && <span className="font-semibold text-cyan-300">Requires chunk unlock</span>}
    </div>

    {route.steps.length > 0 && (
      <ol className="space-y-1 border-l border-white/10 pl-3">
        {route.steps.map((step, index) => (
          <li key={`${step.label}:${step.chunk ?? 'unknown'}:${index}`}>
            <span className="font-medium text-gray-200">{step.label}</span>
            {step.quantity !== undefined && <span className="ml-1 text-gray-500">{step.quantity} needed</span>}
            {step.consumed === false && <span className="ml-1 text-gray-500">· kept</span>}
          </li>
        ))}
      </ol>
    )}

    <BlockerList blockers={route.blockers} />
    {route.travelNote && <p className="text-gray-500">{route.travelNote}</p>}
    {route.dataNote && (
      <p className="rounded border border-amber-500/20 bg-amber-950/20 px-2 py-1.5 text-amber-200">
        {route.dataNote}
      </p>
    )}
  </div>
);

export const QuestRoutePanel: React.FC<QuestRoutePanelProps> = ({
  questId,
  analysis,
  walkthroughVisible = true,
  walkthroughNotice,
  checklistRows,
  confirmedItemKeys,
  onSetItemConfirmed,
  onOpenWorldChunk,
}) => {
  const analysisWalkthrough = analysis && 'walkthrough' in analysis
    ? analysis.walkthrough
    : null;
  const remainingAnalysis = useMemo(
    () => analysis
      ? remainingQuestRouteAnalysis(analysis, confirmedItemKeys)
      : null,
    [analysis, confirmedItemKeys],
  );
  const presented = useMemo(
    () => remainingAnalysis ? presentQuestAnalysis(remainingAnalysis as QuestRouteAnalysis) : null,
    [remainingAnalysis],
  );
  const walkthrough = useMemo(
    () => analysisWalkthrough && walkthroughVisible ? presentQuestWalkthrough(analysisWalkthrough, confirmedItemKeys) : null,
    [analysisWalkthrough, confirmedItemKeys, walkthroughVisible],
  );
  const mapModel = useMemo(
    () => {
      if (!presented) return null;
      return walkthrough
        ? buildQuestRouteMapModel(presented, walkthrough)
        : buildPreparationRouteMapModel(presented);
    },
    [presented, walkthrough],
  );
  const preparationLayer = mapModel?.layers.find(layer => layer.id === 'PREPARATION');
  const outOfBoundsItemIds = useMemo(() => new Set(
    (preparationLayer?.chunks ?? [])
      .filter(chunk => chunkRectOnMap(chunk.chunk) === null)
      .flatMap(chunk => chunk.steps.flatMap(step => (
        step.kind === 'PREPARATION' ? [step.itemId] : []
      ))),
  ), [preparationLayer]);
  const mappableItemIds = useMemo(() => new Set(
    (preparationLayer?.chunks ?? [])
      .filter(chunk => chunkRectOnMap(chunk.chunk) !== null)
      .flatMap(chunk => chunk.steps.flatMap(step => (
        step.kind === 'PREPARATION' ? [step.itemId] : []
      ))),
  ), [preparationLayer]);
  const hasValidMapChunk = useMemo(
    () => mapModel?.layers.some(layer => (
      layer.chunks.some(chunk => chunkRectOnMap(chunk.chunk) !== null)
    )) ?? false,
    [mapModel],
  );
  const playerItems = analysis?.items.filter(item => (
    item.requirement.supplyPolicy === 'PLAYER_OBTAINED'
  )) ?? [];
  const allItemsConfirmed = playerItems.length > 0 && playerItems.every(item => (
    confirmedItemKeys.has(item.requirement.item.key)
  ));
  const allChecklistRequirementsMet = checklistRows.length > 0
    && checklistRows.every(row => row.checked);
  const knownBlockerCount = useMemo(() => {
    if (!analysis || !remainingAnalysis) return 0;
    const identities = new Set<string>();
    remainingAnalysis.items.forEach((item) => {
      if (item.state === 'ROUTE_BLOCKED' || item.state === 'NO_CURRENT_SOURCE') {
        identities.add(`ITEM:${item.requirement.item.key}`);
      }
    });
    if (walkthroughVisible && analysisWalkthrough) {
      knownWalkthroughBlockerIdentities(
        analysisWalkthrough,
        confirmedItemKeys,
      ).forEach(identity => identities.add(identity));
    }
    return identities.size;
  }, [analysis, analysisWalkthrough, confirmedItemKeys, remainingAnalysis, walkthroughVisible]);
  const hasIncompleteEvidence = Boolean(
    remainingAnalysis?.items.some(item => item.state === 'DATA_INCOMPLETE')
    || (walkthroughVisible && (
      analysisWalkthrough?.status === 'INCOMPLETE'
      || analysisWalkthrough?.hasIncompleteEvidence
    )),
  );
  const statusHeading = analysis === null
    ? 'Analysis unavailable'
    : knownBlockerCount > 0
      ? 'Cannot complete yet'
      : hasIncompleteEvidence
        ? 'Analysis incomplete'
        : allChecklistRequirementsMet
          ? 'Quest requirements ready'
          : allItemsConfirmed
            ? 'Required items confirmed'
            : presented?.heading;
  const [mapFocusRequest, setMapFocusRequest] = useState<QuestRouteMapFocusRequest>();
  const focusNonce = useRef(0);
  const focusQuestId = useRef(questId);
  const [expandedRouteIds, setExpandedRouteIds] = useState<Set<string>>(
    () => new Set(presented?.items.flatMap(item => item.routes[0]?.id ? [item.routes[0].id] : []) ?? []),
  );
  const [expandedOtherItems, setExpandedOtherItems] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    focusQuestId.current = questId;
    setMapFocusRequest(undefined);
  }, [questId]);

  const focusTarget = (anchorId: string): void => {
    const heading = document.getElementById(anchorId);
    if (!heading) return;
    const reducedMotion = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    heading.scrollIntoView({
      block: 'nearest',
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
    heading.focus({ preventScroll: true });
  };

  const showItemOnMap = (itemId: string): void => {
    focusQuestId.current = questId;
    setMapFocusRequest({
      layer: 'PREPARATION',
      targetId: itemId,
      nonce: ++focusNonce.current,
    });
  };

  const showActionOnMap = (actionId: string): void => {
    focusQuestId.current = questId;
    setMapFocusRequest({
      layer: 'QUEST_PATH',
      targetId: actionId,
      nonce: ++focusNonce.current,
    });
  };

  return (
    <section
      aria-labelledby="runeproof-heading"
      className="space-y-3 rounded-lg border border-white/10 bg-[#151515] p-3"
    >
      <header className="border-b border-white/10 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">RuneProof</p>
        <h2 id="runeproof-heading" className="mt-0.5 text-sm font-bold text-gray-100">
          {statusHeading}
        </h2>
        <p className="mt-0.5 text-[11px] text-gray-500">{questId}</p>
        {knownBlockerCount > 0 && (
          <p className="mt-0.5 text-[11px] text-amber-200">
            {knownBlockerCount} known {knownBlockerCount === 1 ? 'blocker' : 'blockers'}
          </p>
        )}
      </header>

      <QuestRequirementChecklist
        questId={questId}
        rows={checklistRows}
        onSetItemConfirmed={onSetItemConfirmed}
      />

      {walkthroughNotice && (
        <p
          role="note"
          className="rounded border border-amber-500/20 bg-amber-950/20 px-2 py-1.5 text-[11px] text-amber-100"
        >
          {walkthroughNotice}
        </p>
      )}

      {mapModel && hasValidMapChunk && (
        <div data-runeproof-route-map="">
          <QuestRouteMap
            model={mapModel}
            focusRequest={focusQuestId.current === questId ? mapFocusRequest : undefined}
            onViewTarget={focusTarget}
            onOpenWorldChunk={onOpenWorldChunk}
          />
        </div>
      )}

      {walkthrough && (
        <QuestWalkthrough
          walkthrough={walkthrough}
          onShowActionOnMap={showActionOnMap}
        />
      )}

      <div className="space-y-2.5">
        {presented?.items.map((item) => {
          const anchor = item.anchorId;
          const bestRoute = item.routes[0];
          const otherRoutes = item.routes.slice(1);
          const bestExpanded = bestRoute ? expandedRouteIds.has(bestRoute.id) : false;
          const othersExpanded = expandedOtherItems.has(item.id);
          const bestToggleId = `${anchor}-best-toggle`;
          const bestPanelId = `${anchor}-best-panel`;
          const othersToggleId = `${anchor}-others-toggle`;
          const othersPanelId = `${anchor}-others-panel`;

          return (
            <article
              key={item.id}
              data-runeproof-requirement={anchor}
              className="rounded-md border border-white/10 bg-[#1b1b1b] p-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3
                    id={item.anchorId}
                    tabIndex={-1}
                    className="text-xs font-semibold text-gray-100"
                  >
                    {item.title}
                  </h3>
                  {item.requirementNote && <p className="mt-0.5 text-[10px] text-gray-500">{item.requirementNote}</p>}
                </div>
                <div className="shrink-0 space-y-1 text-right">
                  <p className="text-[10px] font-semibold text-gray-300">
                    {item.statusText}
                  </p>
                  {mappableItemIds.has(item.id) && (
                    <button
                      type="button"
                      aria-label={`Show ${item.itemName} on map`}
                      onClick={() => showItemOnMap(item.id)}
                      className="rounded border border-cyan-400/30 bg-cyan-950/30 px-2 py-1 text-[10px] font-semibold text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                    >
                      Show on map
                    </button>
                  )}
                </div>
              </div>

              {item.supplyNote && <p className="mt-1 text-[10px] text-cyan-300">{item.supplyNote}</p>}

              {bestRoute ? (
                <div className="mt-2 overflow-hidden rounded border border-white/10 bg-black/15">
                  <h4>
                    <button
                      id={bestToggleId}
                      type="button"
                      aria-label={`Best route for ${item.itemName}`}
                      aria-expanded={bestExpanded}
                      aria-controls={bestPanelId}
                      onClick={() => setExpandedRouteIds(current => toggleInSet(current, bestRoute.id))}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] font-semibold text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                    >
                      <span>Best route: {bestRoute.label}</span>
                      <span aria-hidden="true" className="text-cyan-300">{bestExpanded ? '-' : '+'}</span>
                    </button>
                  </h4>
                  <div
                    id={bestPanelId}
                    role="region"
                    aria-labelledby={bestToggleId}
                    hidden={!bestExpanded}
                    className="border-t border-white/10 px-2 py-2"
                  >
                    <RouteDetails route={bestRoute} />
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-gray-500">No reviewed route details are currently available.</p>
              )}

              {otherRoutes.length > 0 && (
                <div className="mt-2 overflow-hidden rounded border border-white/10 bg-black/10">
                  <h4>
                    <button
                      id={othersToggleId}
                      type="button"
                      aria-label={`Other known routes for ${item.itemName}`}
                      aria-expanded={othersExpanded}
                      aria-controls={othersPanelId}
                      onClick={() => setExpandedOtherItems(current => toggleInSet(current, item.id))}
                      className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[11px] font-semibold text-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/80"
                    >
                      <span>Other known routes ({otherRoutes.length})</span>
                      <span aria-hidden="true">{othersExpanded ? '-' : '+'}</span>
                    </button>
                  </h4>
                  <div
                    id={othersPanelId}
                    role="region"
                    aria-labelledby={othersToggleId}
                    hidden={!othersExpanded}
                    className="space-y-3 border-t border-white/10 px-2 py-2"
                  >
                    {otherRoutes.map(route => (
                      <section key={route.id} className="space-y-1.5">
                        <h5 className="text-[11px] font-semibold text-gray-200">{route.label}</h5>
                        <RouteDetails route={route} />
                      </section>
                    ))}
                  </div>
                </div>
              )}


              {(item.dataNotes.length > 0 || outOfBoundsItemIds.has(item.id)) && (
                <section className="mt-2 rounded border border-amber-500/20 bg-amber-950/15 px-2 py-1.5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wide text-amber-300">Data note</h4>
                  <ul className="mt-1 space-y-1 text-[10px] text-amber-100">
                    {item.dataNotes.map((note, noteIndex) => <li key={`${note}:${noteIndex}`}>{note}</li>)}
                    {outOfBoundsItemIds.has(item.id) && (
                      <li>This route location is outside the supported map image.</li>
                    )}
                  </ul>
                </section>
              )}
            </article>
          );
        })}
      </div>

      {analysis !== null && playerItems.length > 0 && remainingAnalysis?.items.length === 0 && (
        <p className="text-[11px] text-emerald-200">
          All required items confirmed — no item routes remain.
        </p>
      )}
    </section>
  );
};

export default QuestRoutePanel;
