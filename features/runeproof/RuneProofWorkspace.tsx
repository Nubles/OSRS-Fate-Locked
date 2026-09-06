import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { WikiArt, QUEST_ART } from './artwork';
import { useGame } from '../../context/GameContext';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { QUEST_DATA } from '../../data/questData';
import { MAP_IMAGE, tileToPixel } from '../../utils/mapCoords';
import { chunkContentService } from '../../services/ChunkContentService';
import { chunkReachability } from '../../utils/chunkReach';
import { CHUNKED_START } from '../../utils/chunkAdjacency';
import { entryBlockedGate } from '../../utils/questDoability';
import { wikiUrlFor } from '../../constants';
import type { UnlockState } from '../../types';
import { answerQuestion, completeStep, evaluateGuide, freshProgress, setInventory, undoStep } from './engine';
import { decodeGuide, guideKey, readGuide, writeGuide, type GuideLoad } from './storage';
import type { GuideLocation, GuidePack, GuideProgress } from './model';
import { applyGuideTravel } from './travel';
import sourceGuideIndex from '../../public/runeproof/source-guides/index.json';
import './runeproof.css';

const sourceById = new Map(sourceGuideIndex.entries.map(entry => [entry.questId, entry]));
const AccessPanel = React.lazy(() => import('./QuestAccessPanel').then(module => ({ default: module.QuestAccessPanel })));
const SourceReader = React.lazy(() => import('./SourceGuideReader').then(module => ({ default: module.SourceGuideReader })));
const storage = () => window.localStorage;
const download = (content: string, name: string) => {
  const url = URL.createObjectURL(new Blob([content], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function LocationMap({location}: {location: GuideLocation}) {
  const point = tileToPixel({tx: location.cx * 64, ty: (location.cy + 1) * 64});
  const [failed, setFailed] = useState(false);
  return <figure className="rp-map">
    {!failed ? <svg role="img" aria-label={`Map centred on ${location.label}, chunk ${location.cx},${location.cy}`} viewBox={`${point.px - 192} ${point.py - 192} 576 576`}>
      <image href={MAP_IMAGE.src} width={MAP_IMAGE.width} height={MAP_IMAGE.height} onError={() => setFailed(true)} />
      <rect x={point.px - 192} y={point.py - 192} width="576" height="576" fill="#161b17" opacity=".17" />
      <rect x={point.px} y={point.py} width="192" height="192" fill="#22d3ee26" stroke="#67e8f9" strokeWidth="5" />
      <circle cx={point.px + 96} cy={point.py + 96} r="12" fill="#67e8f9" stroke="#164e63" strokeWidth="4" />
    </svg> : <div className="rp-map-fallback"><WikiArt id="map" size={18} /><span>Chunk {location.cx},{location.cy}</span></div>}
    <figcaption><WikiArt id="map" size={14} />{location.label}<span>{location.cx}, {location.cy}</span></figcaption>
  </figure>;
}

function GuideSession({pack, runId, unlocks, mode, onJournal}: {pack: GuidePack; runId: string; unlocks: UnlockState; mode?: string; onJournal: () => void}) {
  const panelId = useId();
  const [loaded, setLoaded] = useState<GuideLoad>(() => {
    try { return readGuide(storage(), runId, pack); }
    catch { return {save: {schema: 1, runId, questId: pack.id, packVersion: pack.version, revision: 0, progress: freshProgress(pack)}, token: null, blocked: true, warning: 'Guide storage is unavailable.'}; }
  });
  const [message, setMessage] = useState(loaded.warning ?? '');
  const [view, setView] = useState<'guide' | 'prepare'>('guide');
  const [showMap, setShowMap] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const progress = loaded.save.progress;
  const [travelReady, setTravelReady] = useState(chunkContentService.ready);
  useEffect(() => {
    if (mode !== 'chunked' || travelReady) return;
    let active = true;
    void chunkContentService.init().then(success => { if (active && success) setTravelReady(true); }).catch(() => { /* Missing route data must not authorize travel. */ });
    return () => { active = false; };
  }, [mode, travelReady]);
  const reachable = useMemo(() => {
    if (mode !== 'chunked' || !travelReady) return null;
    const gate = entryBlockedGate(chunkContentService.questSections(), new Set(unlocks.quests), new Set(Object.keys(QUEST_DATA)));
    // Untyped transport edges cannot prove their own unlock permissions. The
    // opening mainland packs use owned surface connectivity only.
    return chunkReachability({}, unlocks, CHUNKED_START, gate, mode).reachable;
  }, [mode, travelReady, unlocks]);
  const evaluation = useMemo(() => applyGuideTravel(evaluateGuide(pack, progress, unlocks, mode), mode, reachable), [pack, progress, unlocks, mode, reachable]);
  const active = evaluation.next;
  const visibleSteps = evaluation.steps.filter(item => item.state !== 'skipped');
  const done = visibleSteps.filter(item => item.state === 'done').length;
  const commit = (next: GuideProgress) => {
    try { const result = writeGuide(storage(), loaded, next, pack); setLoaded(result); setMessage('Progress saved.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Progress could not be saved.'); }
  };
  const exportSave = () => { try { download(storage().getItem(guideKey(runId, pack.id)) ?? JSON.stringify(loaded.save), 'runeproof-guide.json'); } catch { setMessage('Unable to export this guide.'); } };
  const importSave = async (file?: File) => {
    if (!file) return;
    if (file.size > 500000) {setMessage('This guide file is too large.'); return;}
    try {
      const parsed = decodeGuide(await file.text(), pack, runId);
      if (!parsed) { setMessage('Choose a guide export for this quest, run and guide version.'); return; }
      commit(parsed.progress);
    } catch { setMessage('The guide file could not be read.'); }
  };
  const reset = () => {
    try {
      const current = storage().getItem(guideKey(runId, pack.id));
      if (current !== loaded.token) throw new Error('This guide changed in another tab. Reopen RuneProof first.');
      // Preserve an unreadable original for recovery instead of deleting it.
      if (current && loaded.blocked) storage().setItem(`${guideKey(runId, pack.id)}:recovery`, current);
      const clean = {...loaded, blocked: false};
      const result = writeGuide(storage(), clean, freshProgress(pack), pack);
      setLoaded(result); setMessage('A new guide has been started.'); setConfirmReset(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start a new guide.'); }
  };
  return <section className="rp-session" aria-label={`${pack.id} guide`}>
    <div className="rp-guide-tabs" role="tablist" aria-label="Guide sections" onKeyDown={event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const target = event.key === 'Home' ? 'guide' : event.key === 'End' ? 'prepare' : view === 'guide' ? 'prepare' : 'guide';
      setView(target);
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[target === 'guide' ? 0 : 1]?.focus();
    }}>
      <button id={`${panelId}-guide`} role="tab" aria-controls={panelId} tabIndex={view === 'guide' ? 0 : -1} aria-selected={view === 'guide'} onClick={() => setView('guide')}><WikiArt id="quest" size={16} />Your journey</button>
      <button id={`${panelId}-prepare`} role="tab" aria-controls={panelId} tabIndex={view === 'prepare' ? 0 : -1} aria-selected={view === 'prepare'} onClick={() => setView('prepare')}><WikiArt id="inventory" size={16} />Prepare</button>
      <span className="rp-save-note" role="status">{message || 'Saved to this run'}</span>
    </div>
    {loaded.blocked && <div className="rp-notice">Your saved guide needs recovery. Export it below, or start a new guide. No account progress has changed.</div>}
    <div id={panelId} role="tabpanel" aria-labelledby={`${panelId}-${view}`}>
    {view === 'prepare' ? <div className="rp-preparation">
      <div className="rp-section-heading"><span className="rp-eyebrow">BEFORE YOU SET OUT</span><h3>Pack for the journey</h3><p>Enter what you currently have. Items used during the guide are deducted automatically.</p></div>
      {pack.items.map(item => <label className="rp-supply" key={item.id}>
        <span className="rp-supply-icon"><WikiArt id={item.id} size={28} /></span><span><strong>{item.label}</strong><small>{item.note}</small></span>
        <span className="rp-quantity"><input aria-label={`${item.label} quantity`} type="number" min="0" max="1000000" value={progress.inventory[item.id] ?? 0} disabled={loaded.blocked} onChange={event => commit(setInventory(pack, progress, item.id, Number(event.target.value)))} /><small>in your inventory</small></span>
      </label>)}
      {!pack.items.length && <p>No supplies are needed for this guide.</p>}
      <button className="rp-primary" onClick={() => setView('guide')}>Return to your journey <span aria-hidden="true">›</span></button>
    </div> : <>
      <div className="rp-progress-heading"><span>{done} of {visibleSteps.length} steps completed</span><span>{Math.round(done / Math.max(1, visibleSteps.length) * 100)}%</span></div>
      <div className="rp-progress" role="progressbar" aria-label="Guide progress" aria-valuenow={done} aria-valuemin={0} aria-valuemax={visibleSteps.length}><span style={{width: `${done / Math.max(1, visibleSteps.length) * 100}%`}} /></div>
      {pack.questions.map(question => <fieldset className="rp-choice" key={question.id}><legend>{question.prompt}</legend><div>{question.options.map(option => <button key={option.id} disabled={loaded.blocked} aria-pressed={progress.answers[question.id] === option.id} onClick={() => { if (progress.answers[question.id] === option.id) return; if (progress.completed.length && !window.confirm('Changing this choice restarts this guide and clears its recorded supplies. Continue?')) return; commit(answerQuestion(pack, progress, question.id, option.id)); }}>{option.label}</button>)}</div></fieldset>)}
      {active ? <article className="rp-instruction">
        <div className="rp-instruction-top"><span className="rp-eyebrow">{active.state === 'available' ? 'YOUR NEXT STEP' : 'UP NEXT'}</span><span className="rp-step-number">{String(visibleSteps.indexOf(active) + 1).padStart(2, '0')}</span></div>
        <h3>{active.step.title}</h3><p>{active.step.text}</p>
        {active.step.location && <button className="rp-location" aria-expanded={showMap} onClick={() => setShowMap(!showMap)}><WikiArt id="map" size={17} /><span>{active.step.location.label}<small>Chunk {active.step.location.cx}, {active.step.location.cy}</small></span><span>{showMap ? 'Hide map' : 'Show map'}</span></button>}
        {showMap && active.step.location && <LocationMap location={active.step.location} />}
        {active.reasons.length > 0 && <div className="rp-step-blockers"><div>{active.reasons.map(reason => <p key={reason}>{reason}</p>)}</div></div>}
        <div className="rp-instruction-actions"><button className="rp-primary" disabled={active.state !== 'available' || loaded.blocked} onClick={() => commit(completeStep(pack, progress, active.step.id, unlocks, mode))}><span aria-hidden="true">✓</span>Mark step done</button><button className="rp-text-button" onClick={() => setView('prepare')}>Check supplies <span aria-hidden="true">›</span></button></div>
      </article> : <article className="rp-instruction rp-finish"><WikiArt id="quest" size={40} /><h3>{evaluation.complete ? 'Your journey is complete' : 'You have reached the end of this guide'}</h3><p>{evaluation.complete ? 'Finished the quest in game? Open your Journal to record it and collect its rewards.' : pack.coverageNote ?? 'Further steps for this route are not available yet.'}</p><button className="rp-primary" onClick={onJournal}>Open quest Journal <span aria-hidden="true">›</span></button></article>}
      <details className="rp-route"><summary>The full journey <span>{visibleSteps.length} steps</span></summary><ol>{visibleSteps.map((item, index) => <li key={item.step.id} className={`rp-route-${item.state}`}><span className="rp-route-number">{item.state === 'done' ? <span aria-hidden="true">✓</span> : index + 1}</span><div><strong>{item.step.title}</strong><small>{item.step.location?.label ?? 'Quest action'}</small></div>{item.state === 'done' && <button className="rp-icon-button" title="Undo this step and following steps" aria-label={`Undo ${item.step.title}`} onClick={() => commit(undoStep(pack, progress, item.step.id))}>Undo</button>}</li>)}</ol></details>
    </>}
    </div>
    <footer className="rp-guide-footer"><span><WikiArt id="quest" size={13} />Guide progress is separate from quest rewards.</span><div><button onClick={exportSave}>Export</button><button disabled={loaded.blocked} onClick={() => fileRef.current?.click()}>Import</button><input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={event => { void importSave(event.target.files?.[0]); event.target.value = ''; }} /><button onClick={() => setConfirmReset(!confirmReset)}>Restart</button></div></footer>
    {confirmReset && <div className="rp-notice">Restart this guide? Your account and Journal will be kept.<button className="rp-text-button" onClick={reset}>Start a new guide</button><button className="rp-text-button" onClick={() => setConfirmReset(false)}>Cancel</button></div>}
  </section>;
}

export function RuneProofWorkspace({onClose, initialQuestId}: {onClose: () => void; initialQuestId?: string}) {
  const game = useGame();
  return <RuneProofRun key={game.runId} onClose={onClose} initialQuestId={initialQuestId} runId={game.runId} unlocks={game.unlocks} mode={game.gameModeId} />;
}
export function RuneProofRun({onClose, initialQuestId, runId, unlocks, mode}: {onClose: () => void; initialQuestId?: string; runId: string; unlocks: UnlockState; mode?: string}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState(() => {
    if (initialQuestId && Object.hasOwn(QUEST_DATA, initialQuestId)) return initialQuestId;
    try { const saved = storage().getItem(`FATE_RUNEPROOF_2:last:${runId}`); if (saved && Object.hasOwn(QUEST_DATA, saved)) return saved; } catch { /* Selection is optional. */ }
    return "Cook's Assistant";
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'guides' | 'all'>('all');
  const [mobileDetail, setMobileDetail] = useState(false);
  const [journey, setJourney] = useState(false);
  const [sourceView, setSourceView] = useState(false);
  const [packs, setPacks] = useState<GuidePack[]>([]);
  const [packLoading, setPackLoading] = useState(true);
  const [packError, setPackError] = useState('');
  useEffect(() => {
    let active = true;
    import('./packs').then(module => { if (active) setPacks(module.GUIDE_PACKS); })
      .catch(() => { if (active) setPackError('Guided routes could not be loaded. Reopen RuneProof to try again.'); })
      .finally(() => { if (active) setPackLoading(false); });
    return () => { active = false; };
  }, []);
  const packById = useMemo(() => new Map(packs.map(pack => [pack.id, pack])), [packs]);
  useFocusTrap(rootRef, true);
  useEffect(() => { const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => {document.body.style.overflow = previous;}; }, []);
  useEffect(() => { const key = (event: KeyboardEvent) => {if (event.key === 'Escape') onClose();}; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, [onClose]);
  const quest = QUEST_DATA[selected];
  const pack = packById.get(selected);
  const sourceGuide = sourceById.get(selected);
  const quests = useMemo(() => Object.values(QUEST_DATA).filter(item => (filter === 'all' || packById.has(item.id)) && item.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => Number(packById.has(b.id)) - Number(packById.has(a.id)) || a.name.localeCompare(b.name)), [filter, search, packById]);
  const select = (id: string) => {setSelected(id); setJourney(false); setSourceView(false); setMobileDetail(true); try {storage().setItem(`FATE_RUNEPROOF_2:last:${runId}`, id);} catch { /* Guide saves report their own errors. */ }};
  const journal = () => {onClose(); window.dispatchEvent(new CustomEvent('fate:nav', {detail: {target: 'tab:JOURNAL/QUESTS', query: selected}}));};
  return createPortal(<div className="rp-overlay"><div ref={rootRef} role="dialog" aria-modal="true" aria-label="RuneProof" tabIndex={-1} className="rp-workspace">
    <header className="rp-header"><div className="rp-brand"><span className="rp-emblem"><WikiArt id="quest" size={27} /></span><div><span className="rp-eyebrow">FATE LOCKED</span><h1>Rune<span>Proof</span></h1></div></div><div className="rp-header-actions"><span className="rp-mode"><span />{mode === 'chunked' ? 'Chunked' : 'Current rules'} run</span><button className="rp-icon-button" onClick={onClose} aria-label="Close RuneProof"><span aria-hidden="true">×</span></button></div></header>
    <div className={`rp-layout ${mobileDetail ? 'rp-show-detail' : ''}`}>
      <aside className="rp-sidebar"><div className="rp-sidebar-heading"><span className="rp-eyebrow">THE QUEST LIBRARY</span><h2>Check a quest</h2><p>Chunks, items and access for your run.</p></div>
        <label className="rp-search"><input aria-label="Search quests" placeholder="Search quests…" value={search} onChange={event => setSearch(event.target.value)} /></label>
        <div className="rp-filters" aria-label="Quest filters"><button aria-pressed={filter === 'guides'} onClick={() => setFilter('guides')}>Guides <span>{packLoading ? "…" : packs.length}</span></button><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All quests <span>{Object.keys(QUEST_DATA).length}</span></button></div>
        <nav className="rp-quest-list" aria-label="Quest library">{quests.map(item => <button key={item.id} className={`rp-quest ${selected === item.id ? 'rp-selected' : ''}`} aria-current={selected === item.id ? 'page' : undefined} onClick={() => select(item.id)}><span className="rp-quest-symbol"><WikiArt id={QUEST_ART[item.id] ?? 'quest'} size={25} /></span><span><strong>{item.name}</strong><small>{unlocks.quests.includes(item.id) ? 'Quest completed' : packById.has(item.id) ? 'Step-by-step guide' : sourceById.has(item.id) ? 'Source walkthrough' : 'Quest overview'}</small></span><span aria-hidden="true">›</span></button>)}{packError && <p role="alert" className="rp-empty">{packError}</p>}{!quests.length && <p className="rp-empty">{packLoading ? "Loading guided routes…" : "No quests found. Try another name."}</p>}</nav>
        <div className="rp-sidebar-footer"><WikiArt id="quest" size={18} /><span>A journal for your journey.<br /><small>Your current rules always apply.</small></span></div>
      </aside>
      <main className="rp-main"><button className="rp-back" onClick={() => setMobileDetail(false)}><span aria-hidden="true">‹</span>Quest library</button>
        <div className="rp-hero"><div className="rp-hero-content"><span className="rp-eyebrow">{quest.kind === 'miniquest' ? 'MINIQUEST' : 'QUEST'} · {pack?.difficulty ?? 'GIELINOR'}</span><h2>{quest.name}</h2><div className="rp-hero-tags"><span><WikiArt id="quest" size={13} />{quest.points} quest point{quest.points === 1 ? '' : 's'}</span></div></div></div>
        <div className="rp-content">{sourceGuide && sourceView ? <><button className="rp-overview-link" onClick={() => setSourceView(false)}>‹ Quest overview</button><React.Suspense fallback={<p role="status">Loading walkthrough…</p>}><SourceReader key={`${runId}:${selected}`} questId={selected} file={sourceGuide.file} runId={runId} /></React.Suspense></> : pack && journey ? <><button className="rp-overview-link" onClick={() => setJourney(false)}><span aria-hidden="true">‹</span>Quest overview</button><GuideSession key={`${runId}:${pack.id}:${pack.version}`} pack={pack} runId={runId} unlocks={unlocks} mode={mode} onJournal={journal} /></> : <>
          <React.Suspense fallback={<p role="status">Checking quest access…</p>}><AccessPanel key={selected} quest={quest} unlocks={unlocks} mode={mode} /></React.Suspense>
          <details className="rp-route"><summary>Quest walkthrough</summary>{pack && <button className="rp-text-button" onClick={() => setJourney(true)}>Open guide ›</button>}{sourceGuide && <button className="rp-text-button" onClick={() => setSourceView(true)}>Open Quest Helper walkthrough ›</button>}</details>
          <div className="rp-overview-bottom"><a href={wikiUrlFor(quest.name)} target="_blank" rel="noreferrer">Read the quest on OSRS Wiki <span aria-hidden="true">↗</span></a><span>Your unlocks. Your adventure.</span></div>
        </>}</div>
      </main>
    </div>
  </div></div>, document.body);
}
