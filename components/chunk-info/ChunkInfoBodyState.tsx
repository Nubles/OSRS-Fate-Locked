import React from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

export const ChunkInfoBodyState: React.FC<{ kind: 'loading' | 'empty' | 'error' }> = ({ kind }) => {
  if (kind === 'loading') {
    return (
      <div aria-label="Loading chunk content" className="space-y-2 pt-2.5">
        <div className="grid grid-cols-2 gap-2"><div className="h-14 animate-pulse rounded-lg bg-white/5" /><div className="h-14 animate-pulse rounded-lg bg-white/5" /></div>
        <div className="h-10 animate-pulse rounded-lg bg-white/5" />
        <span className="sr-only">Loading chunk content</span>
      </div>
    );
  }

  const empty = kind === 'empty';
  return (
    <div className="mt-2.5 flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.025] p-3 text-gray-400">
      {empty ? <Inbox size={14} className="shrink-0 text-gray-500" /> : <AlertTriangle size={14} className="shrink-0 text-rose-300" />}
      <div>
        <strong className="block text-[11px] text-gray-200">{empty ? 'No indexed content' : 'Chunk content unavailable'}</strong>
        <span className="mt-0.5 block text-[9px] text-gray-500">{empty ? 'This location has no detailed catalogue entries.' : 'The chunk catalogue could not be loaded.'}</span>
      </div>
    </div>
  );
};
