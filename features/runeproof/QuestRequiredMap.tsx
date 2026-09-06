import { QuestChunkInstructions } from './QuestChunkInstructions';
import { useState } from 'react';
import { MAP_IMAGE, tileToPixel } from '../../utils/mapCoords';
import type { QuestAccessNode } from './questAccess';

export function QuestRequiredMap({ geography, areaMode = false, questId }: { geography: QuestAccessNode; areaMode?: boolean; questId?: string }) {
  const [routes, setRoutes] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const choices: { key: string; node: QuestAccessNode; index: number }[] = [];
  const chunks = new Map<string, { node: QuestAccessNode; labels: Set<string> }>();
  const notes: string[] = [];
  const visit = (node: QuestAccessNode, path: string, location: string) => {
    if (node.kind === 'chunk' && node.cx !== undefined && node.cy !== undefined) {
      const key = `${node.cx},${node.cy}`;
      const entry = chunks.get(key) ?? { node, labels: new Set<string>() };
      entry.labels.add(location); chunks.set(key, entry); return;
    }
    if (node.children?.length) {
      const name = node.kind === 'any' && node.children.every(child => child.kind === 'chunk') ? node.label : location;
      if (node.kind === 'any' && node.children.length > 1) {
        const index = Math.min(routes[path] ?? 0, node.children.length - 1);
        choices.push({ key: path, node, index });
        visit(node.children[index], `${path}/${index}`, name);
      } else node.children.forEach((child, index) => visit(child, `${path}/${index}`, name));
    } else if (node.status !== 'met') notes.push(node.label);
  };
  visit(geography, 'root', 'Required destination');
  const points = [...chunks].map(([key, entry]) => ({ key, ...entry, ...tileToPixel({ tx: entry.node.cx! * 64, ty: (entry.node.cy! + 1) * 64 }) }));
  const left = Math.min(...points.map(point => point.px)) - 96;
  const top = Math.min(...points.map(point => point.py)) - 96;
  const width = Math.max(...points.map(point => point.px)) - left + 288;
  const height = Math.max(...points.map(point => point.py)) - top + 288;
  const detail = points.find(point => point.key === selected);
  return <div className="rp-required-map">
    {choices.map(({ key, node, index }) => <label key={key} className="rp-route-select">{node.label}
      <select value={index} onChange={event => { setRoutes(value => ({ ...value, [key]: Number(event.target.value) })); setSelected(null); }}>
        {node.children!.map((child, option) => <option key={option} value={option}>{child.kind === 'chunk' ? `Chunk ${child.label}` : child.label}</option>)}
      </select></label>)}
    {points.length ? <>
      <strong>{points.filter(point => point.node.status === 'met').length} of {points.length} {areaMode ? 'quest-location chunks accessible' : 'required chunks unlocked'}{choices.length ? ' on the selected route' : ''}</strong>
      <div className="rp-map-layout"><figure className="rp-map"><svg role="group" aria-label="Required quest chunks map" viewBox={`${left} ${top} ${width} ${height}`}>
        <image href={MAP_IMAGE.src} width={MAP_IMAGE.width} height={MAP_IMAGE.height} />
        {points.map(point => {
          const met = point.node.status === 'met';
          const label = `Chunk ${point.key}: ${met ? 'Unlocked' : 'Unlock required'} - ${[...point.labels].join('; ')}`;
          return <rect key={point.key} role="button" tabIndex={0} aria-label={label} aria-pressed={selected === point.key}
            x={point.px} y={point.py} width="192" height="192" fill={met ? '#22c55e66' : '#ef444466'} stroke={met ? '#4ade80' : '#f87171'} strokeWidth={selected === point.key ? 5 : 2} vectorEffect="non-scaling-stroke"
            onClick={() => setSelected(point.key)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(point.key); } }}><title>{label}</title></rect>;
        })}
      </svg><figcaption>Green: unlocked · Red: locked</figcaption></figure>
      <div className="rp-map-detail">{!detail && <p>Select a highlighted chunk to see what happens here.</p>}{detail && <p role="status"><strong>Chunk {detail.key}</strong> - {detail.node.status === 'met' ? 'Unlocked' : 'Unlock required'}: {[...detail.labels].join('; ')}</p>}
      {detail && questId && <QuestChunkInstructions questId={questId} chunk={detail.key} />}</div></div>
    </> : <p>A map is not available for this route yet.</p>}
    {!!notes.length && <p>Some location requirements are not checked yet.</p>}
    <p className="rp-map-note">{areaMode ? 'Vanilla mode: map colours follow your area unlocks.' : ''}</p>
  </div>;
}
