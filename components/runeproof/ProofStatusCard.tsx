import React from 'react';
import type { RuneProofReport } from '../../utils/runeproof/model';

const STATUS: Record<RuneProofReport['status'], { title: string; detail: string; tone: string }> = {
  OBTAINABLE: { title: 'Obtainable now', detail: 'A verified route is available in this run.', tone: 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200' },
  OBTAINABLE_RNG: { title: 'Obtainable now — random drop', detail: 'A verified route is available, but it relies on a random drop.', tone: 'border-amber-500/40 bg-amber-950/30 text-amber-100' },
  BLOCKED: { title: 'Missing requirements', detail: 'The compact cards below show the smallest known missing requirement sets.', tone: 'border-orange-500/40 bg-orange-950/30 text-orange-100' },
  IMPOSSIBLE: { title: 'No valid route in your current chunks', detail: 'Every verified route is excluded by the current run.', tone: 'border-rose-500/40 bg-rose-950/30 text-rose-100' },
  UNKNOWN: { title: 'Not enough verified data', detail: 'Available evidence is incomplete, so this is not the same as impossible.', tone: 'border-violet-500/40 bg-violet-950/30 text-violet-100' },
};

export function statusLabel(status: RuneProofReport['status']): string { return STATUS[status].title; }

export const ProofStatusCard: React.FC<{ report: RuneProofReport }> = ({ report }) => {
  const status = STATUS[report.status];
  return <section className={`rounded-lg border p-3 ${status.tone}`} aria-live="polite">
    <h2 className="text-sm font-bold">{status.title}</h2>
    <p className="mt-1 text-xs opacity-85">{status.detail}</p>
    {report.status === 'UNKNOWN' && <p className="mt-2 text-xs text-violet-200">This result needs more verified information; it does not say the goal is impossible.</p>}
    {report.explanation && <p className="mt-2 text-xs opacity-90">{report.explanation}</p>}
  </section>;
};
