import React from 'react';
import { X } from 'lucide-react';
import type { ChunkInfoMode } from './chunkInfoPresentation';

interface Props {
  title: string;
  meta: React.ReactNode;
  unlocked: boolean;
  showModeSwitch: boolean;
  mode: ChunkInfoMode;
  onModeChange: (mode: ChunkInfoMode) => void;
  onClose: () => void;
}

export const ChunkInfoHeader: React.FC<Props> = ({
  title, meta, unlocked, showModeSwitch, mode, onModeChange, onClose,
}) => (
  <header className="sticky top-0 z-10 shrink-0 border-b border-cyan-900/50 bg-[#171a1c] px-3.5 py-3 shadow-[0_1px_0_rgba(34,211,238,0.08)]">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-bold leading-tight text-white">{title}</h3>
        <div className="mt-1 text-[10px] text-gray-500">{meta}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${unlocked
          ? 'border-emerald-700/50 bg-emerald-950/70 text-emerald-300'
          : 'border-rose-800/60 bg-rose-950/70 text-rose-300'}`}>
          {unlocked ? 'Unlocked' : 'Locked'}
        </span>
        <button type="button" onClick={onClose} className="rounded p-1 text-gray-500 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none" aria-label="Close chunk info">
          <X size={15} />
        </button>
      </div>
    </div>
    {showModeSwitch && (
      <div role="group" className="mt-2.5 flex gap-0.5 rounded-lg border border-white/10 bg-black/40 p-0.5" aria-label="Chunk information scope">
        {(['chunk', 'region'] as const).map(value => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
            className={`flex-1 rounded py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 motion-reduce:transition-none ${mode === value
              ? 'bg-cyan-900/70 text-cyan-100'
              : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'}`}
          >
            {value === 'chunk' ? 'This chunk' : 'Whole area'}
          </button>
        ))}
      </div>
    )}
  </header>
);
