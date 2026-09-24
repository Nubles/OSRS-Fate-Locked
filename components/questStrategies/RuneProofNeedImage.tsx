import { useEffect, useState } from 'react';
import { HelpCircle, LockKeyhole } from 'lucide-react';
import { BookOpen, MapPin, Package, Sparkles } from '../OsrsIcon';
import { SLOT_CONFIG } from '../../data/assets';
import { wikiService } from '../../services/WikiService';
import { MAP_IMAGE } from '../../utils/mapCoords';
import { chunkRectOnMap } from '../../utils/questRoutes/routeMapGeometry';
import type { ChunkKey } from '../../utils/questRoutes/model';
import type { GuideNeed } from '../../utils/questStrategies/guideNeeds';
import { WikiIcon } from '../WikiIcon';

function ItemArtwork({ name }: { readonly name: string }) {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    wikiService.fetchImage(name).then(url => { if (current) setSource(url); }).catch(() => { if (current) setSource(null); });
    return () => { current = false; };
  }, [name]);
  return source ? <img src={source} alt={name} className="rp-need-art" draggable={false} onError={() => setSource(null)} />
    : <Package size={25} aria-hidden />;
}

function ChunkArtwork({ chunk, label }: { readonly chunk: ChunkKey; readonly label: string }) {
  const [failed, setFailed] = useState(false);
  const rect = chunkRectOnMap(chunk);
  if (!rect || failed) return <MapPin size={25} aria-hidden />;
  return <svg className="rp-need-map" role="img" aria-label={`Map of ${label}`}
    viewBox={`${rect.x} ${rect.y} ${rect.width} ${rect.height}`}>
    <image href={MAP_IMAGE.src} width={MAP_IMAGE.width} height={MAP_IMAGE.height} onError={() => setFailed(true)} />
    <rect x={rect.x + 3} y={rect.y + 3} width={rect.width - 6} height={rect.height - 6}
      fill="none" stroke="#f1d39e" strokeWidth={6} />
  </svg>;
}

/** Artwork supplements the readable requirement; it never changes its status. */
export function RuneProofNeedImage({ need }: { readonly need: GuideNeed }) {
  const visual = need.visual;
  let artwork = need.kind === 'CHECK' ? <HelpCircle size={25} aria-hidden />
    : need.kind === 'ITEM' ? <Package size={25} aria-hidden /> : <LockKeyhole size={25} aria-hidden />;
  if (visual?.type === 'EQUIPMENT' && SLOT_CONFIG[visual.slot]) {
    const file = SLOT_CONFIG[visual.slot].file;
    artwork = <WikiIcon key={file} file={file} alt={`${visual.slot} equipment slot`} Fallback={LockKeyhole} size={36} className="rp-need-art" />;
  } else if (visual?.type === 'SKILL') {
    const file = `${visual.skill}_icon.png`;
    artwork = <WikiIcon key={file} file={file} alt={`${visual.skill} skill`} Fallback={Sparkles} size={32} className="rp-need-art" />;
  } else if (visual?.type === 'QUEST') {
    artwork = <WikiIcon file="Quest_point_icon.png" alt="Quest requirement" Fallback={BookOpen} size={32} className="rp-need-art" />;
  } else if (visual?.type === 'ITEM') {
    artwork = <ItemArtwork key={visual.itemKey} name={visual.itemKey} />;
  } else if (visual?.type === 'CHUNK') {
    artwork = <ChunkArtwork key={visual.chunk} chunk={visual.chunk} label={need.label} />;
  }
  return <span className="rp-need-image">{artwork}</span>;
}
