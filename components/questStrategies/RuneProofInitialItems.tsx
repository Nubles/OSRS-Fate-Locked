import type { RuneProofInitialItemModel } from '../../utils/questStrategies/coach';

export interface RuneProofInitialItemsProps {
  readonly items: readonly RuneProofInitialItemModel[];
  readonly onSetItemConfirmed: (itemKey: string, confirmed: boolean) => void;
}

export function RuneProofInitialItems({
  items,
  onSetItemConfirmed,
}: RuneProofInitialItemsProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Reviewed initial items" className="space-y-2">
      {items.map(item => (
        <fieldset
          key={item.canonicalItemKey}
          aria-label={`${item.label} item family`}
          className="rounded-lg border border-white/10 bg-[#171717] p-3"
        >
          <legend className="px-1 text-xs font-bold text-gray-100">
            {item.quantity} × {item.label}
          </legend>
          <p className="text-[11px] text-gray-400">
            {item.provenQuantity} of {item.quantity} proven
          </p>
          <p className="mt-1 break-words text-[10px] text-gray-500">
            Reviewed evidence: {item.evidenceIds.join(', ')}
          </p>
          <div className="mt-2 space-y-1.5">
            {item.options.map(option => (
              <label
                key={option.itemKey}
                className="flex items-start gap-2 text-[11px] text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={option.confirmed}
                  onChange={event => onSetItemConfirmed(
                    option.itemKey,
                    event.currentTarget.checked,
                  )}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
