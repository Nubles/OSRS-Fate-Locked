import React, { useId, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ChunkInfoSectionId } from './chunkInfoPresentation';

interface Props {
  id: ChunkInfoSectionId;
  label: string;
  summary: string;
  icon: React.ReactNode;
  defaultOpen: boolean;
  children: React.ReactNode;
}

export const ChunkInfoSection: React.FC<Props> = ({ id, label, summary, icon, defaultOpen, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  const reactId = useId();
  const contentId = `chunk-info-${id}-${reactId.replace(/:/g, '')}`;
  return (
    <section className="mb-2 overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 motion-reduce:transition-none"
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${label}, ${summary}`}
        onClick={() => setOpen(value => !value)}
      >
        <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded bg-cyan-950/70 text-cyan-300">{icon}</span>
        <span className="text-[11px] font-semibold text-gray-100">{label}</span>
        <span className="ml-auto text-[9px] text-gray-500">{summary}</span>
        {open ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronRight size={12} className="text-gray-500" />}
      </button>
      {open && <div id={contentId} className="border-t border-white/[0.06] px-2.5 py-2">{children}</div>}
    </section>
  );
};
