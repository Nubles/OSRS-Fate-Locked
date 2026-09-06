import { chunkUnlocked } from '../../utils/chunkLocations';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { QuestData } from '../../data/questData';
import type { UnlockState } from '../../types';
import { chunkContentService } from '../../services/ChunkContentService';
import { MAP_IMAGE, tileToPixel } from '../../utils/mapCoords';
import { buildQuestAccess, type QuestAccessNode } from './questAccess';
import { QuestItemSources } from './QuestItemSources';
import { QuestRequiredMap } from './QuestRequiredMap';
import { WikiArt } from './artwork';

export function QuestAccessPanel({ quest, unlocks, mode }: { quest: QuestData; unlocks: UnlockState; mode?: string }) {
  const [ready, setReady] = useState(chunkContentService.ready);
  const access = useMemo(() => buildQuestAccess(quest, unlocks, mode), [quest, unlocks, mode, ready]);
  const mapGeography = useMemo(() => {
    if (mode === 'chunked') return access.geography;
    // Chunk boundaries locate quest destinations; Vanilla colours use area access.
    // This is a display projection and does not change the run's eligibility rules.
    const recolour = (node: QuestAccessNode): QuestAccessNode => ({ ...node,
      ...(node.kind === 'chunk' && node.cx !== undefined && node.cy !== undefined
        ? { status: chunkUnlocked(node.cx, node.cy, unlocks, mode) ? 'met' as const : 'locked' as const } : {}),
      ...(node.children ? { children: node.children.map(recolour) } : {}),
    });
    return recolour(buildQuestAccess(quest, unlocks, 'chunked').geography);
  }, [quest, unlocks, mode, access.geography]);
  const [selected, setSelected] = useState<QuestAccessNode | null>(null);
  const map = useRef<HTMLElement>(null);
  useEffect(() => { if (selected) map.current?.scrollIntoView?.({ block: 'center' }); }, [selected]);
  useEffect(() => { setSelected(null); }, [quest.id, unlocks, mode]);
  useEffect(() => { let active = true; chunkContentService.init().then(() => { if (active) setReady(chunkContentService.ready); }).catch(() => { if (active) setReady(false); }); return () => { active = false; }; }, []);
  const status = (value: QuestAccessNode['status']) => value === 'met' ? 'Unlocked' : value === 'locked' ? 'Unlock required' : 'Not checked yet';
  const renderNode = (node: QuestAccessNode): React.ReactNode => <li key={node.id} className={`rp-access-node rp-access-${node.status}`}>
    <div><span>{node.kind === 'chunk' ? <><WikiArt id="map" size={16} />Chunk {node.label}</> : node.label}</span><strong>{node.children?.length ? node.kind === 'any' ? 'Choose one' : 'Required' : status(node.status)}</strong>{node.kind === 'chunk' && <button className="rp-text-button" onClick={() => setSelected(node)} aria-label={`Show chunk ${node.cx}, ${node.cy}`}>Map</button>}</div>
    {!!node.children?.length && <ul>{node.children.map(renderNode)}</ul>}
  </li>;
  const point = selected?.cx !== undefined && selected.cy !== undefined ? tileToPixel({ tx: selected.cx * 64, ty: (selected.cy + 1) * 64 }) : null;
  const blockers = access.eligibility.blockers.filter(blocker => blocker.kind !== 'region' && blocker.kind !== 'requirement');
  const playerOperations = access.operations.filter(operation => operation.predicate.kind !== 'manual');
  const hasUncheckedActions = access.operations.some(operation => operation.predicate.kind === 'manual');
  const verdict = access.eligibility.status === 'COMPLETED' ? 'Quest completed' : access.eligibility.eligible ? 'Ready to complete' : access.eligibility.status.startsWith('LOCKED') ? 'Unlocks needed' : 'Not fully checked yet';
  return <section className="rp-access" aria-label="Quest completion access">
    <div className={`rp-access-verdict ${access.eligibility.eligible ? 'rp-access-met' : 'rp-access-unknown'}`}><span className="rp-eyebrow">YOUR QUEST REQUIREMENTS</span><h3>{verdict}</h3></div>
    <section className="rp-requirements"><div className="rp-section-title"><h3><WikiArt id="map" size={20} />{mode === 'chunked' ? 'Required chunks' : 'Required areas'}</h3></div><QuestRequiredMap questId={quest.id} key={`${quest.id}:${mode}`} geography={mapGeography} areaMode={mode !== 'chunked'} /><details className="rp-location-details"><summary>All required locations</summary><ul className="rp-access-tree">{access.geography.children?.length ? access.geography.children.map(renderNode) : renderNode(access.geography)}</ul></details>
      {selected && point && <figure ref={map} className="rp-map"><svg role="img" aria-label={`Quest chunk ${selected.cx}, ${selected.cy}: ${status(selected.status)}`} viewBox={`${point.px - 192} ${point.py - 192} 576 576`}><image href={MAP_IMAGE.src} width={MAP_IMAGE.width} height={MAP_IMAGE.height} /><rect x={point.px} y={point.py} width="192" height="192" fill={selected.status === 'locked' ? '#ef444455' : '#22d3ee33'} stroke={selected.status === 'locked' ? '#f87171' : '#67e8f9'} strokeWidth="5" /></svg><figcaption>Chunk {selected.cx}, {selected.cy} · {status(selected.status)}<button className="rp-text-button" onClick={() => setSelected(null)}>Close map</button></figcaption></figure>}
    </section>
    <section className="rp-requirements"><div className="rp-section-title"><h3><WikiArt id="inventory" size={20} />Items</h3></div>
      {!access.items.length && <p>No items listed.</p>}
      <ul className="rp-access-items">{access.items.map((item, index) => <li key={item.id}>
        <strong>{item.sourceText ?? item.label}</strong><p>{item.questSupplier ? item.status === 'READY' ? 'Available during the quest' : item.status === 'LOCKED' ? 'Quest location locked' : 'Not checked yet' : item.status === 'READY' ? 'Available to obtain' : item.status === 'LOCKED' ? 'Unlock needed' : 'Not checked yet'}</p>
        {item.questSupplier ? <p>{item.questSupplier}</p> : <QuestItemSources questId={quest.id} clauseIndex={index} label={item.sourceText ?? item.label} unlocks={unlocks} mode={mode}
          provider={{ ready, itemSourceRecords: name => chunkContentService.itemSourceRecords(name) }} />}
      </li>)}</ul>
    </section>
    <section className="rp-requirements"><div className="rp-section-title"><h3>Skills & equipment</h3></div>{blockers.length > 0 && <ul>{blockers.map((blocker, i) => <li key={i}>{blocker.label}</li>)}</ul>}{playerOperations.length > 0 && <ul>{playerOperations.map(operation => <li key={operation.id}>{operation.label}<small> · {operation.status === 'READY' ? 'Met' : operation.status === 'LOCKED' ? 'Unlock required' : 'Not checked yet'}</small></li>)}</ul>}{hasUncheckedActions && <p>Some quest actions are not checked yet.</p>}{!blockers.length && !access.operations.length && <p>Level and quest requirements met.</p>}</section>
  </section>;
}
