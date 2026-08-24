import { useEffect, useRef } from 'react';
import type { RuneProofBranchOptionModel } from '../../utils/questStrategies/coach';

export interface RuneProofBranchSelectorProps {
  readonly branches: readonly RuneProofBranchOptionModel[];
  readonly onSelectBranch: (branchId: string) => void;
}

const routeNameFor = (label: string): string => (
  /\broute$/iu.test(label) ? label : `${label} route`
);

const readinessLabel = (state: RuneProofBranchOptionModel['state']): string => {
  switch (state) {
    case 'READY': return 'Ready';
    case 'CONFIRM': return 'Needs confirmation';
    case 'BLOCKED': return 'Blocked';
    case 'NEEDS_REVIEW': return 'Needs review';
  }
};

export function RuneProofBranchSelector({
  branches,
  onSelectBranch,
}: RuneProofBranchSelectorProps) {
  const pendingFocus = useRef<string | null>(null);
  const containers = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    if (!pendingFocus.current) return;
    const selected = branches.find(branch => (
      branch.id === pendingFocus.current && branch.selected
    ));
    if (!selected) return;
    containers.current.get(selected.id)?.focus();
    pendingFocus.current = null;
  }, [branches]);

  if (branches.length < 2) return null;

  return (
    <section role="group" aria-label="Quest route" className="space-y-2">
      {branches.map(branch => {
        const routeName = routeNameFor(branch.label);
        return (
          <article
            key={branch.id}
            ref={(node) => {
              if (node) containers.current.set(branch.id, node);
              else containers.current.delete(branch.id);
            }}
            tabIndex={-1}
            aria-label={routeName}
            aria-current={branch.selected ? 'true' : undefined}
            className="rounded-lg border border-white/10 bg-[#171717] p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-gray-100">{branch.label}</h4>
              <span className="text-[10px] font-semibold text-cyan-200">
                {readinessLabel(branch.state)}
              </span>
              {branch.recommended ? (
                <span className="text-[10px] font-semibold text-emerald-200">Recommended</span>
              ) : null}
              {branch.pinned ? (
                <span className="text-[10px] font-semibold text-violet-200">Pinned</span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {branch.recommendationReason}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">
              {branch.progress.completed}/{branch.progress.total} complete
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-gray-400">
              {branch.switchConsequence.sharedRetained} shared confirmations stay active;{' '}
              {branch.switchConsequence.inactive} become inactive;{' '}
              {branch.switchConsequence.reactivated} reactivate.
            </p>
            <button
              type="button"
              disabled={branch.state === 'NEEDS_REVIEW' || branch.selected}
              onClick={() => {
                pendingFocus.current = branch.id;
                onSelectBranch(branch.id);
              }}
              className="mt-2 rounded border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Use {routeName}
            </button>
          </article>
        );
      })}
    </section>
  );
}
