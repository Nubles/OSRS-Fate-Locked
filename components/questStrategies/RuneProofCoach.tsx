import { Fragment as ReactFragment, useId, useState, useLayoutEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { MapPin } from '../OsrsIcon';
import type { RuneProofCoachAction, RuneProofCoachModel, RuneProofAlternativeSourceGroup } from '../../utils/questStrategies/coach';
import type { ChunkKey } from '../../utils/questRoutes/model';
import { chunkRectOnMap } from '../../utils/questRoutes/routeMapGeometry';
import { questGuideArticleFor } from '../../data/questGuideArticles';
import { formatQuestChunk, nameQuestChunksInText } from '../../utils/questStrategies/chunkLabels';
import { guideReadiness, stepWarnings } from '../../utils/questStrategies/guidePresentation';
import { guideNeeds } from '../../utils/questStrategies/guideNeeds';
import { RuneProofProofDrawer } from './RuneProofProofDrawer';
import { RuneProofTemporaryMap } from './RuneProofTemporaryMap';
import { RuneProofNeedImage } from './RuneProofNeedImage';
import './RuneProofCoach.css';

export interface RuneProofCoachProps {
  readonly model: RuneProofCoachModel;
  readonly onConfirmAction: (actionId: string) => void;
  readonly onConfirmOwnedItem?: (actionId: string) => void;
  readonly onUndoLastCheck?: () => void;
  readonly canUndoLastCheck?: boolean;
  readonly focusRequest?: { readonly actionId: string; readonly serial: number };
}

const mappable = (chunk: string): chunk is ChunkKey => {
  if (!/^\d+,\d+$/.test(chunk)) return false;
  const [x, y] = chunk.split(',').map(Number);
  return Number.isSafeInteger(x) && Number.isSafeInteger(y)
    && `${x},${y}` === chunk && Boolean(chunkRectOnMap(chunk as ChunkKey));
};
const actionChunks = (action: RuneProofCoachAction) => [...new Set(action.mapChunks)].filter(mappable);
function AlternativeSources({ sources, showCoordinates }: { readonly sources: readonly RuneProofAlternativeSourceGroup[]; readonly showCoordinates: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="rp-disclosure">
    <h3><button type="button" className="rp-disclosure-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      Other legal sources <ChevronDown size={16} aria-hidden />
    </button></h3>
    {open && <div id={id} role="region" aria-label="Other legal sources" className="rp-disclosure-body">
      {sources.length ? sources.map(source => <section key={source.itemKey}>
        <h4>{source.itemName}</h4>
        <ul>{source.routes.map(route => <li key={route.id}>
          <span>{nameQuestChunksInText(route.label, showCoordinates)}</span> <span className="rp-muted">· {route.deterministic ? 'Deterministic' : route.probabilityText ?? 'Chance-based'}</span>
          {route.variantCount > 1 && <> · <span className="rp-muted">{route.variantCount} route variants</span></>}
          {route.requiresChunkUnlock && <p className="rp-inline-warning">Requires chunk unlock</p>}
          {route.blockers.map((blocker, index) => <p className="rp-inline-warning" key={`${blocker.category}:${index}`}>{blocker.category}: {nameQuestChunksInText(blocker.label, showCoordinates)}</p>)}
          {route.dataNote && <p className="rp-inline-warning">Needs checking: {nameQuestChunksInText(route.dataNote, showCoordinates)}</p>}
          {route.travelNote && <p className="rp-muted">{nameQuestChunksInText(route.travelNote, showCoordinates)}</p>}
          {route.steps.length > 0 && <details className="rp-step-detail"><summary>Source steps and locations</summary>
            <ol>{route.steps.map((step, index) => <li key={index}>
              {nameQuestChunksInText(step.label, showCoordinates)}{step.chunk ? ` · ${formatQuestChunk(step.chunk, showCoordinates)}` : ''}
              {step.requiresChunkUnlock && <p className="rp-inline-warning">Requires chunk unlock</p>}
              {step.blockers.map((blocker, blockerIndex) => <p className="rp-inline-warning" key={blockerIndex}>{blocker.category}: {nameQuestChunksInText(blocker.label, showCoordinates)}</p>)}
              {step.hasDataGap && <p className="rp-inline-warning">This source step needs checking.</p>}
            </li>)}</ol>
          </details>}
        </li>)}</ul>
      </section>) : <p>No other reviewed legal sources are available.</p>}
    </div>}
  </section>;
}

export function RuneProofCoach({ model, onConfirmAction, onConfirmOwnedItem, onUndoLastCheck, canUndoLastCheck, focusRequest }: RuneProofCoachProps) {
  const id = useId();
  const reviewedArticle = model.article ?? questGuideArticleFor(model.questId);
  const article = reviewedArticle?.guideRevision === model.guideRevision ? reviewedArticle : undefined;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [rewardsRequest, setRewardsRequest] = useState(0);
  const [showCoordinates, setShowCoordinates] = useState(false);
  const chunkLabel = (chunk: ChunkKey) => formatQuestChunk(chunk, showCoordinates);
  const [temporaryMap, setTemporaryMap] = useState<{
    action: RuneProofCoachAction; chunk: ChunkKey; trigger: HTMLButtonElement;
  } | null>(null);
  const sectionId = (name: string) => `${id}-${name}`;
  const stepId = (actionId: string) => sectionId(`step-${actionId}`);
  useLayoutEffect(() => {
    if (!focusRequest) return;
    const target = document.getElementById(`${id}-step-${focusRequest.actionId}`);
    target?.scrollIntoView?.({ block: 'nearest' });
    target?.focus({ preventScroll: true });
  }, [focusRequest?.actionId, focusRequest?.serial, id]);
  useLayoutEffect(() => {
    if (!rewardsRequest) return;
    const target = document.getElementById(`${id}-rewards`);
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  }, [rewardsRequest, id]);
  const detailRows: readonly [string, readonly string[]][] = article ? [
    ['Start point', [article.startPoint]],
    ['Difficulty / length', [article.difficulty, article.length].filter((value): value is string => Boolean(value))],
    ['Requirements', article.requirements], ['Guide notes', article.guideNotes ?? []], ['Items required', article.itemsRequired],
    ['Obtained during the quest', article.itemsObtained], ['Recommended', article.recommended], ['Enemies', article.enemies],
  ] : [];
  const warnings = model.actions.map(action => stepWarnings(action, showCoordinates));
  const needs = guideNeeds(model, showCoordinates);
  const jumpToStep = (actionId: string) => {
    const target = document.getElementById(stepId(actionId));
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
  };
  const continueGuide = () => {
    if (!model.nextAction) {
      setDetailsOpen(true);
      setRewardsRequest(request => request + 1);
      return;
    }
    const target = document.getElementById(stepId(model.nextAction.id));
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    target?.focus({ preventScroll: true });
    target?.querySelector<HTMLButtonElement>('[data-guide-confirm]')?.focus({ preventScroll: true });
  };

  return <section className="rp-guide" aria-labelledby={sectionId('title')}>
    <div className="rp-article">
      <header>
        <p className="rp-eyebrow">RuneProof · Quest guide</p>
        <h2 id={sectionId('title')}>{model.questId}</h2>
        <p className="rp-readiness" role="status">{guideReadiness(model, showCoordinates)}</p>
        {model.previewNotes?.map(note => <p className="rp-preview-note" key={note}>{note}</p>)}
        {needs.length > 0 && <section className="rp-needs" aria-labelledby={sectionId('needs')}>
          <h3 id={sectionId('needs')} className="rp-needs-title">Still needed <span aria-hidden>{needs.length}</span></h3>
          <ul className="rp-needs-list" aria-label="Remaining requirements">
            {needs.map(need => <li key={need.id} className={`rp-need rp-need-${need.kind.toLowerCase()}`}>
              <RuneProofNeedImage need={need} />
              <div className="rp-need-content">
                <span className="rp-need-kind">{need.kind === 'UNLOCK' ? 'Required' : need.kind === 'ITEM' ? 'Item to get' : 'Needs checking'}</span>
                <strong>{need.label}</strong>
                <div className="rp-need-steps">{need.actionIds.map(actionId => {
                  const step = model.actions.findIndex(action => action.id === actionId) + 1;
                  return <a key={actionId} href={`#${stepId(actionId)}`} aria-label={`${need.label} — go to step ${step}`}
                    onClick={event => { event.preventDefault(); jumpToStep(actionId); }}>Step {step} <span aria-hidden>↓</span></a>;
                })}</div>
              </div>
            </li>)}
          </ul>
        </section>}
        <div className="rp-progress">
          <progress aria-label={`${model.questId} progress`} value={model.progress.completed} max={model.progress.total || 1} />
          <span>{model.progress.completed}/{model.progress.total} complete</span>
        </div>
        <div className="rp-toolbar" aria-label="Guide controls">
          {model.actions.length > 0 && <button type="button" className="rp-link-button" onClick={continueGuide}>{model.nextAction ? 'Continue at my next step ↓' : 'View rewards ↓'}</button>}
          {canUndoLastCheck && onUndoLastCheck && <button type="button" className="rp-link-button" onClick={onUndoLastCheck}>Undo last check</button>}
        </div>
      </header>

      <section aria-labelledby={sectionId('walkthrough')}>
        <h3 id={sectionId('walkthrough')} tabIndex={-1}>Walkthrough</h3>
        <ol className="rp-steps" aria-label={`${model.questId} route`}>
          {model.actions.map((action, index) => {
            const meta = action.usesAlternative ? undefined : article?.steps[action.id];
            const chunks = actionChunks(action);
            const current = action.id === model.nextAction?.id;
            const place = meta?.location ?? action.locationLabel;
            // Completion repeats the quest-wide equipment check; show its warning
            // once at the earlier affected step, while keeping completion gated.
            const visibleWarnings = warnings[index].filter(warning => action.confirmationLabel !== 'Confirm quest complete'
              || !warnings.slice(0, index).some(previous => previous.includes(warning)));
            const showLocationEvidence = !model.previewNotes?.length || showCoordinates;
            const hasDetails = Boolean(meta?.details?.length || action.travel || action.locationExplanation && showLocationEvidence);
            return <li key={action.id}>
              <section id={stepId(action.id)} data-guide-action-id={action.id} tabIndex={-1} aria-current={current ? 'step' : undefined}
                className={`rp-step ${current ? 'rp-step-current' : ''} ${action.state === 'COMPLETED' ? 'rp-step-completed' : ''}`}>
                <span className="rp-step-number" aria-hidden>{index + 1}.</span>
                {current && <h4 className="rp-next-label">Next action</h4>}
                <p className="rp-instruction">{action.instruction}</p>
                {action.state === 'COMPLETED' && <span className="rp-step-state">Completed</span>}
                <div className="rp-step-location">
                  {chunks.length ? chunks.map(chunk => <div key={chunk} className="rp-chunk-line">
                    <span className="rp-place-name">{chunks.length === 1 && place
                      ? `${place}${meta?.context ? ` · ${meta.context}` : ''}${showCoordinates ? ` · ${chunkLabel(chunk)}` : ''}`
                      : chunkLabel(chunk)}</span>
                    <button type="button" className="rp-link-button" aria-label={`Show ${action.instruction} on map${chunks.length > 1 ? `: ${chunkLabel(chunk)}` : ''}`}
                      onClick={event => setTemporaryMap({ action: { ...action, locationLabel: place }, chunk, trigger: event.currentTarget })}>
                      <MapPin size={14} aria-hidden /> Show on map
                    </button>
                  </div>) : <><p>{place}</p><p className="rp-inline-warning" role="note">Chunk needs review</p></>}
                </div>
                {Boolean(action.supplies?.length) && <p className="rp-small"><strong>Have with you:</strong> {action.supplies!.join(', ')}.</p>}
                {visibleWarnings.map(warning => <p key={warning} role="note" className="rp-inline-warning">{nameQuestChunksInText(warning, showCoordinates)}</p>)}
                <div className="rp-step-actions">
                {hasDetails && <details className="rp-step-detail">
                  <summary>Step details</summary>
                  {meta?.details?.map(detail => <p key={detail}>{detail}</p>)}
                  {action.locationExplanation && showLocationEvidence && <p>{nameQuestChunksInText(action.locationExplanation, showCoordinates)}</p>}
                  {action.travel && <div className="rp-step-travel" aria-label={`Walking route for step ${index + 1}`}>
                    <p className="rp-small"><strong>{action.travel.fromStep ? `Walk from step ${action.travel.fromStep}` : 'Start here'}</strong></p>
                    {action.travel.chunks.length > 0 && <p className="rp-walking-path" aria-label="Walking chunk sequence">
                      {action.travel.chunks.map((chunk, chunkIndex) => <ReactFragment key={`${chunk}:${chunkIndex}`}>
                        {chunkIndex > 0 && <span aria-hidden> → </span>}
                        <span className="rp-place-name">{chunkLabel(chunk)}{action.travel!.missingChunks.includes(chunk) ? ' (locked)' : ''}</span>
                      </ReactFragment>)}
                    </p>}
                    {action.travel.entranceNote && <p className="rp-small rp-muted">{action.travel.entranceNote}</p>}
                    <p className="rp-small rp-muted">This is the walking route between guide steps. Teleports and other transport are not included.</p>
                  </div>}
                </details>}
                {action.ownedItemConfirmation && onConfirmOwnedItem && <div>
                  <button type="button" className="rp-link-button" onClick={() => onConfirmOwnedItem(action.id)}>
                    I already have {action.ownedItemConfirmation.label}
                  </button>
                  <p className="rp-small rp-muted">Confirm supplies obtained through your unlocked content to skip this preparation.</p>
                </div>}
                {action.confirmationAllowed && <button type="button" data-guide-confirm className="rp-confirm" onClick={() => onConfirmAction(action.id)}>
                  {action.confirmationLabel ?? 'Mark action complete'}
                </button>}
                </div>
              </section>
            </li>;
          })}
        </ol>
      </section>

      <section className="rp-disclosure">
        <h3><button type="button" className="rp-disclosure-toggle" aria-expanded={detailsOpen} aria-controls={sectionId('details')}
          onClick={() => setDetailsOpen(!detailsOpen)}>Quest details and rewards <ChevronDown size={16} aria-hidden /></button></h3>
        {detailsOpen && <div id={sectionId('details')} role="region" aria-label="Quest details and rewards" className="rp-disclosure-body">
          {article ? <table className="rp-details" aria-label="OSRS quest details"><tbody>
            {detailRows.filter(([, values]) => values.length > 0).map(([label, values]) => <tr key={label}>
              <th scope="row">{label}</th><td>{values.map(value => <p key={value}>{value}</p>)}</td>
            </tr>)}
          </tbody></table> : <p>Article details are not reviewed for this guide yet. Use its source link for quest details.</p>}
          {article?.links?.map(link => <p key={link.url}><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></p>)}
          <h4 id={sectionId('rewards')} tabIndex={-1}>Rewards</h4>
          {article ? <ul className="rp-rewards">{article.rewards.map(reward => <li key={reward}>{reward}</li>)}</ul>
            : <p>See the source guide for reviewed reward details.</p>}
          <p className="rp-small rp-muted">Awarded in OSRS when you finish the quest.</p>
          <AlternativeSources sources={model.alternativeSources} showCoordinates={showCoordinates} />
          <button type="button" className="rp-link-button" aria-pressed={showCoordinates} onClick={() => setShowCoordinates(!showCoordinates)}>Show chunk coordinates</button>
          {article && <p className="rp-small rp-muted">Quest details checked against the <a href={article.sourceUrl} target="_blank" rel="noreferrer">OSRS Wiki</a>. Instructions are independently reviewed for Fate Locked.</p>}
          <RuneProofProofDrawer proof={model.proof} />
        </div>}
      </section>
      <p className="rp-small rp-muted">Checks are saved for this run. They do not complete your Journal or award rewards.</p>
    </div>
    {temporaryMap && <RuneProofTemporaryMap instruction={temporaryMap.action.instruction} locationLabel={temporaryMap.action.locationLabel}
      chunk={temporaryMap.chunk} showCoordinates={showCoordinates} returnFocusTarget={temporaryMap.trigger} onClose={() => setTemporaryMap(null)} />}
  </section>;
}
