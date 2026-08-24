import type { RuneProofManualConfirmationModel } from '../../utils/questStrategies/coach';

export interface RuneProofManualConfirmationsProps {
  readonly confirmations: readonly RuneProofManualConfirmationModel[];
  readonly onSetManualConfirmed: (confirmationId: string, confirmed: boolean) => void;
}

export function RuneProofManualConfirmations({
  confirmations,
  onSetManualConfirmed,
}: RuneProofManualConfirmationsProps) {
  if (confirmations.length === 0) return null;

  return (
    <section aria-label="Reviewed manual confirmations" className="space-y-2">
      {confirmations.map(confirmation => (
        <article
          key={confirmation.id}
          className="rounded-lg border border-white/10 bg-[#171717] p-3"
        >
          <label className="flex items-start gap-2 text-[11px] leading-relaxed text-gray-200">
            <input
              type="checkbox"
              checked={confirmation.confirmed}
              onChange={event => onSetManualConfirmed(
                confirmation.id,
                event.currentTarget.checked,
              )}
              className="mt-0.5"
            />
            <span>{confirmation.prompt}</span>
          </label>
          <p className="mt-1 text-[10px] text-gray-500">
            {confirmation.scopes.join(' · ')}
          </p>
          <p className="mt-1 break-words text-[10px] text-gray-500">
            Reviewed evidence: {confirmation.evidenceIds.join(', ')}
          </p>
        </article>
      ))}
    </section>
  );
}
