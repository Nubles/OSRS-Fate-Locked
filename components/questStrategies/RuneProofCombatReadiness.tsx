import type { RuneProofCombatReadinessModel } from '../../utils/questStrategies/coach';

export const RUNE_PROOF_COMBAT_DISCLAIMER =
  'I am ready to follow this reviewed guide. This confirms my choice; it does not prove my gear, reflexes, combat skill, or risk tolerance.';

export interface RuneProofCombatReadinessProps {
  readonly model: RuneProofCombatReadinessModel;
  readonly onSetConfirmed: (confirmationId: string, confirmed: boolean) => void;
}

const ReviewedList = ({
  title,
  values,
}: {
  readonly title: string;
  readonly values: readonly string[];
}) => values.length > 0 ? (
  <section>
    <h5 className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">{title}</h5>
    <ul className="mt-1 list-disc space-y-1 pl-4 text-[11px] text-gray-300">
      {values.map((value, index) => <li key={`${value}:${index}`}>{value}</li>)}
    </ul>
  </section>
) : null;

export function RuneProofCombatReadiness({
  model,
  onSetConfirmed,
}: RuneProofCombatReadinessProps) {
  return (
    <article
      aria-label={model.title}
      className="space-y-3 rounded-lg border border-violet-400/25 bg-violet-950/15 p-3"
    >
      <header>
        <p className="text-[10px] font-bold uppercase tracking-widest text-violet-200">
          Reviewed combat readiness
        </p>
        <h4 className="mt-1 text-sm font-bold text-gray-100">{model.title}</h4>
        <p className="mt-1 text-[11px] leading-relaxed text-gray-300">
          {model.encounterSummary}
        </p>
      </header>

      <ReviewedList title="Phases" values={model.phases} />
      <ReviewedList title="Mandatory mechanics" values={model.mandatoryMechanics} />
      <ReviewedList title="Recommended capabilities" values={model.recommendedCapabilities} />
      <ReviewedList title="Recommended supplies" values={model.recommendedSupplies} />
      <ReviewedList title="Death, escape, and re-entry" values={model.deathEscapeReentryNotes} />
      <ReviewedList title="Known deterministic blockers" values={model.deterministicBlockers} />

      <label className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-200">
        <input
          type="checkbox"
          checked={model.confirmed}
          onChange={event => onSetConfirmed(model.confirmationId, event.currentTarget.checked)}
          className="mt-0.5"
        />
        <span>{RUNE_PROOF_COMBAT_DISCLAIMER}</span>
      </label>
    </article>
  );
}
