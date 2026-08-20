import type { QuestRequirementChecklistRow } from '../../utils/questRoutes/requirementChecklist';

export interface QuestRequirementChecklistProps {
  questId: string;
  rows: readonly QuestRequirementChecklistRow[];
  onSetItemConfirmed: (
    questId: string,
    itemKey: string,
    confirmed: boolean,
  ) => void;
}

export const QuestRequirementChecklist = ({
  questId,
  rows,
  onSetItemConfirmed,
}: QuestRequirementChecklistProps) => {
  const satisfiedCount = rows.filter(row => row.checked).length;

  return (
    <section
      aria-labelledby="runeproof-quest-requirements-heading"
      className="space-y-3 rounded-lg border border-white/10 bg-[#151515] p-3"
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-2">
        <h2 id="runeproof-quest-requirements-heading" className="text-sm font-bold text-gray-100">
          Quest requirements
        </h2>
        <p className="text-[11px] text-gray-400">{satisfiedCount} / {rows.length} satisfied</p>
      </header>
      <p className="text-[11px] text-gray-400">
        Skills, quests, access, and other account requirements update automatically. Confirm item possession manually.
      </p>

      <ul className="space-y-2">
        {rows.map(row => {
          const labelId = `runeproof-requirement-label-${row.id}`;
          const statusId = `runeproof-requirement-status-${row.id}`;
          const stateId = `runeproof-requirement-state-${row.id}`;
          const stateText = row.mode === 'ACCOUNT'
            ? row.checked ? 'Met' : 'Not met'
            : row.mode === 'MANUAL_GATE'
              ? 'Needs confirmation'
              : row.checked ? 'Obtained' : 'Not obtained';
          const canConfirm = row.mode === 'MANUAL_ITEM' && row.itemKey !== undefined;

          return (
            <li key={row.id} className="rounded-md border border-white/10 bg-[#1b1b1b] p-2.5">
              <div className="flex items-start gap-2">
                <input
                  id={`runeproof-requirement-${row.id}`}
                  type="checkbox"
                  checked={row.checked}
                  disabled={row.disabled}
                  readOnly={!canConfirm}
                  aria-labelledby={labelId}
                  aria-describedby={`${stateId} ${statusId}`}
                  onChange={canConfirm
                    ? event => onSetItemConfirmed(questId, row.itemKey!, event.target.checked)
                    : undefined}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-500"
                />
                <label
                  htmlFor={`runeproof-requirement-${row.id}`}
                  className={`min-w-0 flex-1 text-xs ${row.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <span id={labelId} className={`font-semibold text-gray-100 ${row.checked ? 'line-through' : ''}`}>
                    {row.label}{row.detail && ` ${row.detail}`}
                  </span>
                  <span id={stateId} className="ml-1 text-[10px] font-medium text-gray-300">
                    {stateText}
                  </span>
                </label>
                <p id={statusId} className="shrink-0 text-right text-[10px] text-gray-400">{row.statusText}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
};