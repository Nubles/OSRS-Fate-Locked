import type { RuneProofObjectiveRecommendation } from '../../utils/questStrategies/objectives';

export interface RuneProofObjectivePickerProps {
  readonly recommendations: readonly RuneProofObjectiveRecommendation[];
  readonly onSelect: (questId: string) => void;
}

const readinessLabel = (readiness: RuneProofObjectiveRecommendation['readiness']): string => {
  switch (readiness) {
    case 'READY': return 'Ready';
    case 'CONFIRM': return 'Needs confirmation';
    case 'BLOCKED': return 'Blocked';
  }
};

const readinessClassName = (readiness: RuneProofObjectiveRecommendation['readiness']): string => {
  switch (readiness) {
    case 'READY': return 'text-emerald-200';
    case 'CONFIRM': return 'text-violet-200';
    case 'BLOCKED': return 'text-amber-200';
  }
};

export function RuneProofObjectivePicker({
  recommendations,
  onSelect,
}: RuneProofObjectivePickerProps) {
  if (recommendations.length === 0) return null;

  return (
    <section
      role="region"
      aria-label="Recommended RuneProof quests"
      className="border-b border-cyan-400/20 bg-cyan-950/10 p-2.5"
    >
      <h3 className="px-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-200">
        Recommended RuneProof quests
      </h3>
      <div className="mt-2 space-y-1.5">
        {recommendations.map(recommendation => (
          <button
            key={recommendation.questId}
            type="button"
            onClick={() => onSelect(recommendation.questId)}
            className="w-full rounded-md border border-cyan-400/20 bg-black/15 px-2.5 py-2 text-left transition-colors hover:bg-cyan-950/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <span className="block text-[11px] font-semibold text-gray-100">
              {recommendation.questId}
            </span>
            <span className={'mt-0.5 block text-[10px] font-semibold ' + readinessClassName(recommendation.readiness)}>
              {readinessLabel(recommendation.readiness)}
            </span>
            <span className="mt-1 block text-[10px] leading-relaxed text-gray-400">
              {recommendation.reason}
            </span>
            <span className="mt-1 block text-[10px] font-mono text-gray-500">
              {recommendation.progress.completed}/{recommendation.progress.total} complete
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
