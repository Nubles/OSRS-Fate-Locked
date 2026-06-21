import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Route, MapPin, ChevronDown, ChevronRight, ExternalLink, AlertTriangle, HelpCircle } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { QUEST_DATA } from '../data/questData';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkReachability } from '../utils/chunkReach';
import { chunkForPlace, chunkUnlocked, placeOf, showChunkOnMap } from '../utils/chunkLocations';
import { questLocations } from '../utils/questLocations';
import { questChunkStatus, doabilityBucket, DoabilityBucket } from '../utils/questDoability';
import { isFreeArea } from '../utils/freeAreas';
import { WIKI_OVERRIDES } from '../constants';

interface Props { searchTerm?: string }

const wikiUrl = (name: string) => {
  if (name.startsWith('RFD:')) return 'https://oldschool.runescape.wiki/w/Recipe_for_Disaster';
  if (WIKI_OVERRIDES[name]) return `https://oldschool.runescape.wiki/w/${WIKI_OVERRIDES[name]}`;
  return `https://oldschool.runescape.wiki/w/${name.replace(/ /g, '_')}`;
};

const BUCKET_META: Record<DoabilityBucket, { label: string; cls: string; dot: string }> = {
  DOABLE:  { label: 'Doable now',          cls: 'text-emerald-300', dot: 'bg-emerald-400' },
  REQS:    { label: 'Reachable — reqs left', cls: 'text-amber-300',  dot: 'bg-amber-400' },
  STRANDED:{ label: 'Stranded (no route)',  cls: 'text-orange-300',  dot: 'bg-orange-400' },
  LOCKED:  { label: 'Locked region',        cls: 'text-red-300',     dot: 'bg-red-400' },
  NO_DATA: { label: 'No chunk data',        cls: 'text-gray-400',    dot: 'bg-gray-500' },
  DONE:    { label: 'Completed',            cls: 'text-gray-500',    dot: 'bg-gray-600' },
};
const ORDER: DoabilityBucket[] = ['DOABLE', 'REQS', 'STRANDED', 'LOCKED', 'NO_DATA', 'DONE'];

interface Row {
  id: string;
  bucket: DoabilityBucket;
  reqsMet: boolean;
  missingSkills: { skill: string; lvl: number; have: number }[];
  missingPrereqs: string[];
  lockedAreas: string[];
  strandedChunk: { cx: number; cy: number; label: string } | null;
}

export const QuestDoabilityPanel: React.FC<Props> = ({ searchTerm = '' }) => {
  const { unlocks } = useGame();
  const [ready, setReady] = useState(chunkContentService.ready);
  useEffect(() => { if (!ready) chunkContentService.init().then(() => setReady(true)); }, [ready]);
  const [open, setOpen] = useState<Record<string, boolean>>({ DOABLE: true, REQS: true, STRANDED: true, LOCKED: true });

  const rows = useMemo<Row[]>(() => {
    if (!ready) return [];
    const reach = chunkReachability(chunkContentService.connectGraph(), unlocks, chunkForPlace('Lumbridge'));
    const isUnlocked = (cx: number, cy: number) => chunkUnlocked(cx, cy, unlocks);
    const currentQP = (unlocks.quests as string[]).reduce((a, qid) => a + (QUEST_DATA[qid]?.points ?? 0), 0);

    return Object.values(QUEST_DATA).map((q) => {
      const completed = unlocks.quests.includes(q.id);

      // Requirement axis (skills + prereqs + QP) — region is handled by chunks.
      const missingSkills: Row['missingSkills'] = [];
      for (const [skill, lvl] of Object.entries(q.skills as Record<string, number>)) {
        if (skill === 'Quest Points') { if (currentQP < lvl) missingSkills.push({ skill: 'Quest Points', lvl, have: currentQP }); continue; }
        const have = unlocks.levels[skill] ?? 1;
        const unlocked = (unlocks.skills[skill] ?? 0) > 0;
        if (!unlocked || have < lvl) missingSkills.push({ skill, lvl, have: unlocked ? have : 0 });
      }
      const missingPrereqs = q.prereqs.filter((qid: string) => !unlocks.quests.includes(qid));
      const reqsMet = missingSkills.length === 0 && missingPrereqs.length === 0;

      // Chunk-access axis. When we have no chunk evidence, fall back to the
      // hand-authored region gate so a region-locked quest can't read "doable".
      const hit = chunkContentService.entityLocations(q.id, ['quest']);
      const chunk = hit ? questChunkStatus(hit.locations, reach.reachable, isUnlocked) : null;
      const authoredRegionMet = q.regions.every((r: string) => isFreeArea(r) || unlocks.regions.includes(r));
      let bucket: DoabilityBucket;
      if (chunk) {
        bucket = doabilityBucket(completed, reqsMet, chunk);
      } else {
        bucket = completed ? 'DONE' : !authoredRegionMet ? 'LOCKED' : reqsMet ? 'DOABLE' : 'REQS';
      }

      // Blocker detail for the row.
      const lockedAreas = bucket !== 'LOCKED' ? []
        : chunk
          ? [...new Set(questLocations(q.id, unlocks).lockedPlaces.map(p => p.label))]
          : q.regions.filter((r: string) => !isFreeArea(r) && !unlocks.regions.includes(r));
      const strandedFirst = bucket === 'STRANDED' ? chunk?.blockers.find(b => b.access === 'STRANDED') : null;
      const strandedChunk = strandedFirst ? { cx: strandedFirst.cx, cy: strandedFirst.cy, label: placeOf(strandedFirst.cx, strandedFirst.cy).label } : null;

      return { id: q.id, bucket, reqsMet, missingSkills, missingPrereqs, lockedAreas, strandedChunk };
    });
  }, [ready, unlocks]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return q ? rows.filter(r => r.id.toLowerCase().includes(q)) : rows;
  }, [rows, searchTerm]);

  const byBucket = useMemo(() => {
    const m: Record<DoabilityBucket, Row[]> = { DOABLE: [], REQS: [], STRANDED: [], LOCKED: [], NO_DATA: [], DONE: [] };
    for (const r of filtered) m[r.bucket].push(r);
    for (const k of ORDER) m[k].sort((a, b) => a.id.localeCompare(b.id));
    return m;
  }, [filtered]);

  if (!ready) return <div className="p-4 text-sm text-gray-500">Loading chunk data…</div>;

  const doableCount = byBucket.DOABLE.length;
  const total = rows.length;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Route size={16} className="text-emerald-400" />
        <h3 className="text-sm font-bold text-white">Quest doability</h3>
        <span className="text-[11px] text-gray-500">
          <span className="text-emerald-300 font-semibold">{doableCount}</span> of {total} doable now — by chunk reachability + requirements
        </span>
      </div>

      {ORDER.map((bucket) => {
        const list = byBucket[bucket];
        if (list.length === 0) return null;
        const meta = BUCKET_META[bucket];
        const isOpen = open[bucket] ?? false;
        return (
          <div key={bucket} className="border border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setOpen(o => ({ ...o, [bucket]: !isOpen }))}
              className="w-full flex items-center gap-2 px-2.5 py-2 bg-white/5 hover:bg-white/10 text-left"
            >
              {isOpen ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
              <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
              <span className={`text-xs font-semibold ${meta.cls}`}>{meta.label}</span>
              <span className="text-[10px] text-gray-500 font-mono">{list.length}</span>
            </button>
            {isOpen && (
              <div className="divide-y divide-white/5">
                {list.map((r) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 px-3 py-1.5">
                    <a href={wikiUrl(r.id)} target="_blank" rel="noreferrer"
                       className="text-[12px] text-gray-200 hover:text-white hover:underline decoration-dotted underline-offset-2 flex items-center gap-1 min-w-0">
                      <span className="truncate">{r.id}</span>
                      <ExternalLink size={9} className="text-gray-600 shrink-0" />
                    </a>
                    <div className="text-[10px] text-right shrink-0 max-w-[55%]">
                      {r.bucket === 'DOABLE' && <span className="text-emerald-400 flex items-center gap-1 justify-end"><CheckCircle2 size={11} /> ready</span>}
                      {r.bucket === 'REQS' && (
                        <span className="text-amber-300/90">
                          {r.missingSkills.map(s => `${s.skill} ${s.lvl}`).concat(r.missingPrereqs.map(p => `✦ ${p}`)).slice(0, 3).join(', ')}
                          {(r.missingSkills.length + r.missingPrereqs.length) > 3 ? '…' : ''}
                        </span>
                      )}
                      {r.bucket === 'LOCKED' && (
                        <span className="text-red-300/90 flex items-center gap-1 justify-end">
                          <Lock size={10} className="shrink-0" /> {r.lockedAreas.slice(0, 2).join(', ')}{r.lockedAreas.length > 2 ? `, +${r.lockedAreas.length - 2}` : ''}
                        </span>
                      )}
                      {r.bucket === 'STRANDED' && r.strandedChunk && (
                        <button onClick={() => showChunkOnMap(r.strandedChunk!.cx, r.strandedChunk!.cy)}
                          className="text-orange-300/90 hover:text-orange-200 flex items-center gap-1 justify-end" title="Owned but no route — show on map">
                          <MapPin size={10} className="shrink-0" /> {r.strandedChunk.label}
                        </button>
                      )}
                      {r.bucket === 'NO_DATA' && <span className="text-gray-500 flex items-center gap-1 justify-end"><HelpCircle size={10} /> no chunk data</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <p className="text-[10px] text-gray-600 flex items-start gap-1">
        <AlertTriangle size={11} className="shrink-0 mt-0.5 text-gray-700" />
        "Doable now" = every chunk a quest's steps touch is reachable from Lumbridge over your transport links, and its skill/quest
        requirements are met. Stranded = you own the chunk but can't route to it yet. Reachability is an approximation (no per-link gating).
      </p>
    </div>
  );
};

export default QuestDoabilityPanel;
