import { useMemo, useState } from 'react';
import { MAP_IMAGE, tileToPixel } from '../../utils/mapCoords';
import type { UnlockState } from '../../types';
import { getSourceClauseInterpretation } from './sourceClauses';
import { itemReferenceSourceEvidence, itemSourceEvidence, type ItemSourceCandidate, type ItemSourceEvidence, type ItemSourceEvidenceProvider } from './itemSourceEvidence';

type Props = {
  questId: string; clauseIndex: number; label: string; unlocks: UnlockState; mode?: string;
  provider: ItemSourceEvidenceProvider;
};

/** Keep location-specific gates on each record while presenting one entry per source. */
function SourceGroup({ sources }: { sources: ItemSourceCandidate[] }) {
  const [open, setOpen] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const available = sources.filter(source => source.geography === 'unlocked' && !source.knownMissingGates.length);
  const visible = showLocked ? sources : available;
  const chunks = [...new Map(visible.map(source => [`${source.cx},${source.cy}`, source])).values()];
  const points = chunks.map(source => ({ source, ...tileToPixel({ tx: source.cx * 64, ty: (source.cy + 1) * 64 }) }));
  const minX = Math.min(...points.map(point => point.px)) - 96;
  const minY = Math.min(...points.map(point => point.py)) - 96;
  const width = Math.max(...points.map(point => point.px)) - minX + 288;
  const height = Math.max(...points.map(point => point.py)) - minY + 288;
  const availableChunks = new Set(available.map(source => `${source.cx},${source.cy}`));
  const allChunks = new Set(sources.map(source => `${source.cx},${source.cy}`));
  const name = sources[0].hostName;
  return <div className={`rp-access-source rp-access-${available.length ? 'unknown' : 'locked'}`}>
    <button className="rp-text-button" aria-expanded={open} onClick={() => setOpen(value => !value)}>{name}</button>
    <span> · {sources[0].kind}</span>
    <p>{availableChunks.size} of {allChunks.size} locations match your unlocks</p>
    {open && <>
      <label><input type="checkbox" checked={showLocked} onChange={event => setShowLocked(event.target.checked)} /> Show locked locations</label>
      {points.length ? <figure className="rp-map"><svg role="img" aria-label={`${name} source locations`} viewBox={`${minX} ${minY} ${width} ${height}`}>
        <image href={MAP_IMAGE.src} width={MAP_IMAGE.width} height={MAP_IMAGE.height} />
        {points.map(({ source, px, py }) => {
          const accessible = availableChunks.has(`${source.cx},${source.cy}`);
          return <rect key={`${source.cx},${source.cy}`} x={px} y={py} width="192" height="192" fill={accessible ? '#22d3ee55' : '#ef444455'} stroke={accessible ? '#67e8f9' : '#f87171'} strokeWidth="3" vectorEffect="non-scaling-stroke"><title>{source.placeLabel} · Chunk {source.cx}, {source.cy} · {accessible ? 'No known access blockers' : 'Unlock required'}</title></rect>;
        })}
      </svg><figcaption>Cyan: location accessible · Red: unlock needed. Equipment and skill requirements also apply.</figcaption></figure> : <p>No locations match your current unlocks.</p>}
      <details><summary>Location details</summary><ul>{chunks.map(source => <li key={`${source.cx},${source.cy}`}>{source.placeLabel} · Chunk {source.cx}, {source.cy}{[...new Set(visible.filter(other => other.cx === source.cx && other.cy === source.cy).flatMap(other => other.knownMissingGates))].map(gate => <p key={gate}>{gate}</p>)}</li>)}</ul></details>
      {visible.some(source => source.unknowns.length > 0) && <p>Some requirements are not checked yet.</p>}
    </>}
  </div>;
}

function SourceMatches({ evidence }: { evidence: ItemSourceEvidence }) {
  const [limit, setLimit] = useState(12);
  const groups = useMemo(() => {
    const grouped = new Map<string, ItemSourceCandidate[]>();
    for (const source of evidence.sources) {
      const key = `${source.kind}:${source.hostName.trim().replace(/\s+/g, ' ').toLowerCase()}`;
      grouped.set(key, [...(grouped.get(key) ?? []), source]);
    }
    return [...grouped.entries()].sort(([, a], [, b]) =>
      Number(!a.some(source => source.geography === 'unlocked' && !source.knownMissingGates.length)) - Number(!b.some(source => source.geography === 'unlocked' && !source.knownMissingGates.length)) || a[0].hostName.localeCompare(b[0].hostName));
  }, [evidence.sources]);
  return <div className="rp-source-matches">{!groups.length && <p>No sources listed yet.</p>}{groups.slice(0, limit).map(([key, sources]) => <SourceGroup key={key} sources={sources} />)}
    {groups.length > limit && <button className="rp-text-button" onClick={() => setLimit(value => value + 12)}>Show more sources ({groups.length - limit} remaining)</button>}</div>;
}

function ReferencedItem({ item, ...props }: Omit<Props, 'questId' | 'clauseIndex' | 'label'> & {
  item: { name: string; quantity: number | null; availability: string };
}) {
  const [open, setOpen] = useState(false);
  const availability = item.availability === 'quest-available' ? 'Obtainable during the quest'
    : item.availability === 'conditional' ? 'Depends on the chosen route or quest conditions' : null;
  return <div className="rp-source-item"><strong>{item.name}</strong>
    <p>{item.quantity === null ? 'Quantity: see the full requirement above' : `Quantity: ${item.quantity}`}{availability && ` · ${availability}`}</p>
    <details onToggle={event => setOpen(event.currentTarget.open)}><summary>Sources for {item.name}</summary>
      {open && <SourceMatches evidence={itemReferenceSourceEvidence(item, props.unlocks, props.mode, props.provider)} />}
    </details>
  </div>;
}

/** Source-linked references help inspect alternatives; they never satisfy the canonical manual gate. */
export function QuestItemSources(props: Props) {
  const [open, setOpen] = useState(false);
  const interpretation = getSourceClauseInterpretation(props.questId, props.clauseIndex, props.label);
  const renderItem = (item: { name: string; quantity: number | null; availability: string; kind?: string }, index: number) => item.kind === 'reference'
    ? <p key={`${item.name}:${index}`}>Quest reference: <a href={`https://oldschool.runescape.wiki/w/${encodeURIComponent(item.name.replace(/ /g, '_'))}`} target="_blank" rel="noreferrer">{item.name}</a></p>
    : <ReferencedItem key={`${item.name}:${index}`} item={item} unlocks={props.unlocks} mode={props.mode} provider={props.provider} />;
  return <details className="rp-clause-sources" onToggle={event => setOpen(event.currentTarget.open)}><summary>Check source access</summary>
    {open && (interpretation ? <>
      {interpretation.routes.length > 0 ? <>
        <p>{interpretation.structure === 'choice' ? 'Choose one complete alternative below.' : interpretation.structure === 'bundle' ? 'These items belong to the same requirement.' : ''}</p>
        {interpretation.routes.map(route => <div className="rp-source-route" key={route.id}>
          {interpretation.structure === 'choice' && <strong>{route.label}</strong>}
          {route.items.map(renderItem)}
        </div>)}
      </> : <><p>Possible items for this requirement. Check the walkthrough for your route.</p>{interpretation.references.map(renderItem)}</>}
      
      <p><a href={`https://oldschool.runescape.wiki/w/index.php?title=${encodeURIComponent(interpretation.source.page.replace(/ /g, '_'))}&oldid=${interpretation.source.revisionId}`} target="_blank" rel="noreferrer">View on OSRS Wiki</a></p>
    </> : <SourceMatches evidence={itemSourceEvidence(props.label, props.unlocks, props.mode, props.provider)} />)}
  </details>;
}
