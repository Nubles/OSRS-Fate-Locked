import React, { useMemo, useState } from 'react';
import { CheckCircle2, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { Store } from './OsrsIcon';
import { useGame } from '../context/GameContext';
import { MERCHANTS_LIST } from '../constants';
import { chunkContentService } from '../services/ChunkContentService';
import { shopsByCategory, type CategoryShop } from '../utils/merchantShops';
import { summarisePlaces, showChunkOnMap } from '../utils/chunkLocations';
import { WikiLink } from './WikiLink';
import { useChunkContent } from '../hooks/useChunkContent';
import { evaluateEntityAccess } from '../utils/entityAccess';

/**
 * The shop directory under the Merchants grid: every real shop from the chunk
 * dataset, grouped into the merchant categories the gacha unlocks. A shop is
 * usable when its merchant category, location, and source requirements are met.
 * Location chips jump to the chunk. Categories without reviewed providers remain
 * visible so missing coverage does not look like an absent game feature.
 */
export const MerchantShopsPanel: React.FC = () => {
  const { unlocks, gameModeId } = useGame();
  const { ready, error, retry } = useChunkContent();
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());


  const grouped = useMemo(() => (ready ? shopsByCategory() : null), [ready]);

  if (!grouped) {
    if (error) return <div role="alert" className="mt-6 text-xs text-amber-300">Could not load the shop directory. <button onClick={retry} className="underline">Retry shop directory</button></div>;
    return (
      <div className="mt-6 text-[11px] text-gray-600 animate-pulse">Loading shop directory…</div>
    );
  }

  const categories = MERCHANTS_LIST;
  const accessFor = (shop: CategoryShop) => shop.locations.map(location => evaluateEntityAccess(shop.name, shop.kind ?? 'shop', location, unlocks, gameModeId));
  const toggle = (c: string) =>
    setOpenCats(prev => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });

  return (
    <div className="mt-6">
      <h4 className="text-yellow-400/90 font-bold text-xs uppercase tracking-wide border-b border-white/10 pb-2 mb-1 flex items-center gap-2">
        <Store size={13} /> Shop directory
        <span className="text-[10px] font-mono text-gray-500 normal-case tracking-normal">
          shops and services — usable requires location and access requirements
        </span>
      </h4>

      {categories.map(cat => {
        const catUnlocked = unlocks.merchants.includes(cat);
        const shops = grouped.get(cat) ?? [];
        const isOpen = openCats.has(cat);
        // usable = category unlocked AND at least one location reachable
        const usableCount = catUnlocked
          ? shops.filter(s => accessFor(s).some(access => access.status === 'ALLOWED')).length
          : 0;
        return (
          <div key={cat} className="border-b border-white/5">
            <button
              onClick={() => toggle(cat)}
              className="w-full flex items-center gap-2 py-2 text-left hover:bg-white/[0.03] transition-colors"
            >
              {isOpen ? <ChevronDown size={12} className="text-gray-600" /> : <ChevronRight size={12} className="text-gray-600" />}
              {catUnlocked
                ? <CheckCircle2 size={12} className="text-green-400 shrink-0" />
                : <Lock size={12} className="text-red-400/70 shrink-0" />}
              <span className={`text-[12px] font-semibold ${catUnlocked ? 'text-gray-200' : 'text-gray-500'}`}>{cat}</span>
              <span className="ml-auto text-[10px] font-mono text-gray-600">
                {catUnlocked ? `${usableCount}/${shops.length} usable` : `${shops.length} shops · category locked`}
              </span>
            </button>

            {isOpen && (
              <div className="pb-2 pl-7 space-y-1">
                {!shops.length && <p className="text-[11px] text-amber-300">Provider locations for this category still need review.</p>}
                {shops.map(shop => {
                  const places = summarisePlaces(shop.locations, unlocks, gameModeId);
                  const access = accessFor(shop);
                  const usable = catUnlocked && access.some(result => result.status === 'ALLOWED');
                  const reasons = [...new Set(access.flatMap(result => result.reasons))];
                  return (
                    <div key={shop.name} className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      {usable
                        ? <CheckCircle2 size={10} className="text-green-400 shrink-0" />
                        : <Lock size={10} className="text-gray-600 shrink-0" />}
                      <WikiLink name={shop.name} className={`hover:underline decoration-dotted underline-offset-2 ${usable ? 'text-gray-200' : 'text-gray-500'}`} />
                      {shop.stockStatus === 'service' && <span className="text-[9px] text-gray-500">Service</span>}
                      {shop.stockStatus === 'zero-stock' && <span className="text-[9px] text-gray-500">No default stock</span>}
                      {catUnlocked && !usable && reasons.length > 0 && <span className="text-[9px] text-amber-300" title={reasons.join('; ')}>{access.some(result => result.status === 'UNKNOWN') ? 'Access needs confirmation' : reasons[0]}</span>}
                      {places.slice(0, 3).map(p => (
                        <button
                          key={p.label}
                          onClick={() => showChunkOnMap(p.cx, p.cy)}
                          className={`text-[9px] px-1.5 py-px rounded border transition-colors ${
                            p.unlocked
                              ? 'bg-emerald-950/60 border-emerald-700/40 text-emerald-300 hover:bg-emerald-900/60'
                              : 'bg-red-950/40 border-red-800/30 text-red-300/80 hover:bg-red-900/40'
                          }`}
                          title={`${p.label} — ${p.unlocked ? 'unlocked' : 'locked'} · click to view on map`}
                        >
                          {p.label}
                        </button>
                      ))}
                      {!catUnlocked && places.some(p => p.unlocked) && (
                        <span className="text-[9px] text-amber-400/70">location reachable — category locked</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
