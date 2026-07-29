import React from 'react';
import type { RuneProofReport } from '../../utils/runeproof/model';

export const BlockerList: React.FC<{ report: RuneProofReport }> = ({ report }) => {
  if (!report.blockers.length) return null;
  const unavoidable = new Set(report.unavoidableBlockerFactIds);
  return <section aria-label="Missing requirements" className="space-y-2">
    <h2 className="text-xs font-bold uppercase tracking-wider text-orange-200">Smallest missing requirement sets</h2>
    {report.blockers.map((blocker, index) => <article key={blocker.factIds.join('|')} className="rounded border border-orange-500/25 bg-black/20 p-2.5 text-xs">
      <p className="font-semibold text-gray-100">{blocker.labels.join(' + ')}</p>
      {blocker.factIds.some(id => unavoidable.has(id)) && <p className="mt-1 text-orange-200">Unavoidable. {blocker.labels.filter((_, labelIndex) => unavoidable.has(blocker.factIds[labelIndex])).join(', ')}</p>}
      {index > 0 && <p className="mt-1 text-gray-400">Alternative missing set</p>}
    </article>)}
  </section>;
};
