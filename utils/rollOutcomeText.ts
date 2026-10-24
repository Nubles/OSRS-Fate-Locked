/**
 * What a Key roll's result says in words, for the toast and the quest
 * overlay. It reads only the roll event the reducer wrote (ROLL_RESULT in
 * context/GameContext.tsx), so both say the same thing.
 */
export interface RollOutcomeEvent {
  type: string;
  meta?: unknown;
}

export interface RollOutcomeText {
  /** True when the roll gave the player a Key of any kind. */
  won: boolean;
  text: string;
}

const num = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

/** "4/50" while pity is on, "4 Fate" without it: as the header shows Fate. */
const fateTotal = (fate: number, pityThreshold: number | null): string =>
  pityThreshold !== null ? `${fate}/${pityThreshold}` : `${fate} Fate`;

export function describeRollOutcome(event: RollOutcomeEvent | null | undefined): RollOutcomeText | null {
  if (!event) return null;
  const meta = (event.meta ?? {}) as Record<string, unknown>;
  const keys = num(meta.standardKeysAwarded) ?? 1;
  const pityThreshold = num(meta.pityThreshold);
  switch (event.type) {
    case 'ROLL_SUCCESS':
      return { won: true, text: keys === 2 ? '2 Keys found!' : 'Key found!' };
    case 'ROLL_OMNI':
      return { won: true, text: keys === 2 ? '2 Keys and an Omni-Key found!' : 'Key and Omni-Key found!' };
    case 'ROLL_PITY':
      return {
        won: true,
        text: pityThreshold !== null ? `Missed, but Fate reached ${pityThreshold}: Pity Key!` : 'Pity Key!',
      };
    case 'ROLL_FAIL': {
      const before = num(meta.fateBefore);
      const after = num(meta.fateAfter);
      // A roll event without the Fate fields still says it missed.
      if (before === null || after === null) return { won: false, text: 'No Key' };
      const change = after - before;
      const gained = change === 0 ? '' : `: ${change > 0 ? '+' : '−'}${Math.abs(change)} Fate`;
      return { won: false, text: `No Key${gained} (${fateTotal(after, pityThreshold)})` };
    }
    default:
      return null;
  }
}
