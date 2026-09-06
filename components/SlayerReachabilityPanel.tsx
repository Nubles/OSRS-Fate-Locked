import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Skull, MapPin, Sword } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkUnlocked, showChunkOnMap } from '../utils/chunkLocations';
import { slayerReachability, SlayerStatus, SlayerTaskRow } from '../utils/slayerReach';

const STATUS_META: Record<SlayerStatus, { label: string; cls: string }> = {
  'ready':         { label: 'ready',      cls: 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200' },
  'area-locked':   { label: 'area locked',cls: 'bg-amber-900/25 border-amber-500/40 text-amber-200' },
  'slayer-locked': { label: 'Slayer',     cls: 'bg-rose-900/25 border-rose-500/40 text-rose-200' },
  'combat-locked': { label: 'Combat',     cls: 'bg-orange-900/25 border-orange-500/40 text-orange-200' },
  'quest-locked':  { label: 'quest',      cls: 'bg-violet-900/25 border-violet-500/40 text-violet-200' },
  'no-location':   { label: '—',          cls: 'bg-white/5 border-white/10 text-gray-500' },
};

const Row: React.FC<{ r: SlayerTaskRow }> = ({ r }) => {
  const meta = STATUS_META[r.status];
  const badge =
    r.masterBlocker?.label ??
    (r.status === 'slayer-locked' && r.slayer ? `Slayer ${r.slayer}` :
    r.status === 'combat-locked' && r.combat ? `Combat ${r.combat}` : meta.label);
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-[11px] border-b border-white/5 last:border-0">
      <span className="flex-1 truncate text-gray-200">{r.monster}</span>
      {r.slayer != null && !r.masterBlocker && <span className="text-[9px] text-gray-500 font-mono shrink-0">lvl {r.slayer}</span>}
      {r.loc && (
        <button
          onClick={() => showChunkOnMap(r.loc!.cx, r.loc!.cy)}
          title="Show on map"
          className="text-gray-500 hover:text-emerald-300 shrink-0"
        >
          <MapPin size={11} />
        </button>
      )}
      <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${meta.cls}`}>{badge}</span>
    </div>
  );
};

/**
 * Slayer task reachability — per master, which assignable monsters you could
 * actually take and complete right now (Slayer level, quest unlocks, combat,
 * and whether the monster lives in an unlocked chunk).
 */
export const SlayerReachabilityPanel: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const [ready, setReady] = useState(chunkContentService.ready);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) chunkContentService.init().then(() => setReady(true));
  }, [ready]);

  const reach = useMemo(() => {
    if (!ready) return null;
    const masters = chunkContentService.slayerMasters();
    const locate = (task: string) => {
      for (const cand of [task, task.replace(/s$/, '')]) {
        const hit = chunkContentService.entityLocations(cand, ['monster']);
        if (hit && hit.locations.length) {
          const un = hit.locations.find(l => chunkUnlocked(l.cx, l.cy, unlocks, gameModeId));
          const l = un ?? hit.locations[0];
          return { cx: l.cx, cy: l.cy, unlocked: !!un };
        }
      }
      return null;
    };
    return slayerReachability(masters, unlocks, locate, gameModeId);
  }, [ready, unlocks, gameModeId]);

  if (!reach || reach.masters.length === 0) return null;
  const totalReady = reach.masters.reduce((a, m) => a + m.ready, 0);

  return (
    <div className="mb-4 rounded-lg border border-rose-500/20 bg-[#161616] overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-rose-950/15">
        <Skull size={13} className="text-rose-300" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-rose-200">Slayer Task Reachability</span>
        <span className="ml-auto flex items-center gap-3 text-[10px] font-mono text-gray-400">
          <span className="flex items-center gap-1"><Sword size={10} /> CB {reach.combatLevel}</span>
          <span>Slayer {reach.slayerUnlocked ? reach.slayerLevel : '🔒'}</span>
          <span className="text-emerald-300">{totalReady} ready</span>
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {reach.masters.map(m => {
          const isOpen = open === m.master;
          return (
            <div key={m.master}>
              <button
                onClick={() => setOpen(isOpen ? null : m.master)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5"
              >
                {isOpen ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
                <span className="text-[12px] font-semibold text-gray-200">{m.master}</span>
                {m.masterBlocker && <span className="text-[9px] text-rose-300">{m.masterBlocker.label}</span>}
                <span className="ml-auto text-[10px] font-mono">
                  <span className={m.ready > 0 ? 'text-emerald-300' : 'text-gray-500'}>{m.ready}</span>
                  <span className="text-gray-600"> / {m.total} tasks</span>
                </span>
              </button>
              {isOpen && (
                <div className="bg-black/20 px-1">
                  {m.rows.map(r => <Row key={r.monster} r={r} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-1.5 text-[9px] text-gray-600 italic border-t border-white/5">
        "Ready" = you meet the Slayer/combat/quest requirements and the monster is in an unlocked chunk. Locations are best-effort from chunk data.
      </div>
    </div>
  );
};
