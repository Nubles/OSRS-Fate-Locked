import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Boxes, ChevronRight } from 'lucide-react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { useGame } from '../context/GameContext';
import { EntityModel } from './EntityModel';
import { MODEL_FILES } from '../data/modelManifest';
import { modelUrlBySlug, orientationForSlug } from '../data/entityModels';

/**
 * A review gallery for every generated 3D model. A list of all models on the
 * left, a big interactive viewer on the right (single WebGL context, so it stays
 * smooth regardless of how many models exist). Lets you scan the whole set and
 * spot any that look wrong.
 */

const prettify = (slug: string) =>
  slug.split('-').map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w)).join(' ');

export const ModelGallery: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { animationsEnabled } = useGame();
  useEscapeKey(onClose, true);

  const slugs = useMemo(() => Object.keys(MODEL_FILES).sort(), []);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(slugs[0] ?? '');

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? slugs.filter((s) => prettify(s).toLowerCase().includes(t)) : slugs;
  }, [q, slugs]);

  const url = modelUrlBySlug(sel);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog" aria-modal="true" aria-label="3D model gallery" onClick={onClose}
    >
      <div
        className="w-full max-w-4xl h-[80vh] bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
          <div className="p-2 bg-amber-900/20 rounded-lg border border-amber-500/30 text-amber-300"><Boxes size={18} /></div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold text-white leading-none">3D Model Gallery</h2>
            <p className="text-[11px] text-gray-500 mt-1">{slugs.length} boss models · drag to rotate, scroll to zoom</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* List */}
          <div className="w-60 shrink-0 border-r border-white/10 flex flex-col">
            <div className="p-2 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
                <input
                  value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…"
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-2 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-white/20"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
              {filtered.map((s) => (
                <button
                  key={s}
                  onClick={() => setSel(s)}
                  className={`w-full flex items-center gap-1.5 px-3 py-1.5 text-left text-[12px] transition-colors ${s === sel ? 'bg-amber-500/15 text-amber-100' : 'text-gray-300 hover:bg-white/5'}`}
                >
                  <span className="flex-1 truncate">{prettify(s)}</span>
                  {s === sel && <ChevronRight size={12} className="text-amber-300/70 shrink-0" />}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-6 text-center text-gray-600 text-xs">No matches.</div>}
            </div>
          </div>

          {/* Viewer */}
          <div className="flex-1 min-w-0 flex flex-col p-4">
            <div className="flex-1 min-h-0 rounded-xl bg-gradient-to-b from-white/[0.05] to-black/30 border border-white/10 overflow-hidden">
              {url ? (
                <EntityModel key={sel} src={url} alt={prettify(sel)} interactive autoRotate={animationsEnabled} orientation={orientationForSlug(sel)} fill />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">No model selected</div>
              )}
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <h3 className="text-lg font-bold text-white">{prettify(sel)}</h3>
              <span className="text-[11px] font-mono text-gray-600">{MODEL_FILES[sel]}</span>
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Unlocked bosses render as rotatable 3D models.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
