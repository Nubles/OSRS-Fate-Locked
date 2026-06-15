import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Footprints, MapPin } from 'lucide-react';
import { useGame } from '../context/GameContext';
import { chunkContentService } from '../services/ChunkContentService';
import { chunkUnlocked, chunkForPlace, showChunkOnMap } from '../utils/chunkLocations';
import { shortcutReachability, ShortcutStatus } from '../utils/shortcutReach';

const STATUS_META: Record<ShortcutStatus, { label: string; cls: string }> = {
  'ready':       { label: 'ready',       cls: 'bg-emerald-900/30 border-emerald-500/40 text-emerald-200' },
  'area-locked': { label: 'area locked', cls: 'bg-amber-900/25 border-amber-500/40 text-amber-200' },
  'level':       { label: 'level',       cls: 'bg-fuchsia-900/25 border-fuchsia-500/40 text-fuchsia-200' },
  'no-location': { label: '—',           cls: 'bg-white/5 border-white/10 text-gray-500' },
};

const FILTERS: { key: 'all' | ShortcutStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Ready' },
  { key: 'level', label: 'Need level' },
  { key: 'area-locked', label: 'Area locked' },
];

/**
 * Agility/travel shortcut reachability — every shortcut with its level and
 * real chunk location, flagged by whether you have the level and the area.
 */
export const ShortcutsPanel: React.FC = () => {
  const { unlocks } = useGame();
  const [ready, setReady] = useState(chunkContentService.ready);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | ShortcutStatus>('all');

  useEffect(() => {
    if (!ready) chunkContentService.init().then(() => setReady(true));
  }, [ready]);

  const reach = useMemo(() => {
    if (!ready) return null;
    const shortcuts = chunkContentService.shortcuts();
    const locate = (s: typeof shortcuts[number]) => {
      for (const obj of s.objects) {
        const hit = chunkContentService.entityLocations(obj, ['object']);
        if (hit && hit.locations.length) {
          const un = hit.locations.find(l => chunkUnlocked(l.cx, l.cy, unlocks));
          const l = un ?? hit.locations[0];
          return { cx: l.cx, cy: l.cy, unlocked: !!un };
        }
      }
      for (const name of s.chunks) {
        const c = chunkForPlace(name);
        if (c) return { cx: c.cx, cy: c.cy, unlocked: chunkUnlocked(c.cx, c.cy, unlocks) };
      }
      return null;
    };
    return shortcutReachability(shortcuts, unlocks, locate);
  }, [ready, unlocks]);

  if (!reach || reach.total === 0) return null;
  const rows = filter === 'all' ? reach.rows : reach.rows.filter(r => r.status === filter);

  return (
    <div className="mb-4 rounded-lg border border-fuchsia-500/20 bg-[#161616] overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-fuchsia-950/15 text-left">
        {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
        <Footprints size={13} className="text-fuchsia-300" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-fuchsia-200">Agility Shortcuts</span>
        <span className="ml-auto text-[10px] font-mono"><span className="text-emerald-300">{reach.ready}</span><span className="text-gray-600"> / {reach.total} usable now</span></span>
      </button>
      {open && (
        <>
          <div className="flex gap-1 px-3 py-1.5 border-b border-white/5">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${filter === f.key ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}
              >{f.label}</button>
            ))}
          </div>
          <div className="max-h-[320px] overflow-y-auto custom-scrollbar divide-y divide-white/5">
            {rows.map(r => {
              const meta = STATUS_META[r.status];
              return (
                <div key={r.name} className="flex items-center gap-2 px-3 py-1 text-[11px]">
                  <span className="text-[9px] text-gray-500 font-mono shrink-0 w-8">L{r.level}</span>
                  <span className="flex-1 truncate text-gray-200">{r.name}</span>
                  {r.loc && (
                    <button onClick={() => showChunkOnMap(r.loc!.cx, r.loc!.cy)} title="Show on map" className="text-gray-500 hover:text-emerald-300 shrink-0">
                      <MapPin size={11} />
                    </button>
                  )}
                  <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded border ${meta.cls}`}>{r.status === 'level' ? `Agility ${r.level}` : meta.label}</span>
                </div>
              );
            })}
            {rows.length === 0 && <div className="px-3 py-4 text-center text-[11px] text-gray-600">No shortcuts in this filter.</div>}
          </div>
        </>
      )}
    </div>
  );
};
