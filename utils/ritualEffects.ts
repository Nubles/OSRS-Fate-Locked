/**
 * The lasting effects of the Void Altar's newer rituals: Saradomin's Ward,
 * Tears of Guthix, Zamorak's Pact, Amascut's Invocations, the Barrows Chest
 * and Sacrifice. The reducer stores them on the run as
 * `rituals`; everything here is pure so vitest can pin the rules.
 */
import {
  BARROWS_ROLLS, BLOOD_PRICE_FATE, INVOCATION_ROLLS, PACT_DEBT, PACT_ODDS_BONUS, PACT_ROLLS, SACRIFICE_MIN_ROLLS, SACRIFICE_TIERS,
  SACRIFICE_USES_PER_RUN, TEARS_FAILS, invocationOmniBonus, type BarrowsBrother, type Invocation, type Ritual,
} from '../config/economy';
import { TableType, type LogEntry, type UnlockState } from '../types';

export interface RitualState {
  /** Saradomin's Ward waits for the next random Key or Chaos Key spend. */
  ward?: boolean;
  /** Tears of Guthix: failed rolls left that pay double Fate. */
  tearsFailsLeft?: number;
  /** Tears was cast in this dry spell; a successful roll clears it. */
  tearsSpent?: boolean;
  /** Zamorak's Pact: boosted rolls left. The debt starts when they run out. */
  pactRollsLeft?: number;
  /** Fate still owed to Zamorak. */
  pactDebt?: number;
  invocations?: { ids: Invocation['id'][]; rollsLeft: number };
  /** `fateCost` is what was paid, for Torag's refund. */
  barrows?: { brother: BarrowsBrother['id']; rollsLeft: number; failed: number; fateCost: number };
  sacrificesUsed?: number;
}

export type GodName = NonNullable<Ritual['god']>;

/** The god whose ritual is running, if any. Zamorak stays until the debt is paid. */
export const activeGod = (r: RitualState | undefined): GodName | null => {
  if (!r) return null;
  if (r.ward) return 'Saradomin';
  if ((r.tearsFailsLeft ?? 0) > 0) return 'Guthix';
  if ((r.pactRollsLeft ?? 0) > 0 || (r.pactDebt ?? 0) > 0) return 'Zamorak';
  return null;
};

/** Clarity, Greed, the Pact, Invocations and the Barrows Chest all change the next rolls: one at a time. */
export const rollRitualActive = (activeBuff: string, r: RitualState | undefined): boolean =>
  activeBuff !== 'NONE'
  || (r?.pactRollsLeft ?? 0) > 0
  || (r?.invocations?.rollsLeft ?? 0) > 0
  || (r?.barrows?.rollsLeft ?? 0) > 0;

/** Rolls the run has made, for Sacrifice's wait. */
export const rollsMade = (history: readonly LogEntry[]): number =>
  history.reduce((n, e) => n + (e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_FAIL' || e.type === 'ROLL_OMNI' || e.type === 'PITY' ? 1 : 0), 0);

export interface RitualAvailability { ok: boolean; reason?: string }

const no = (reason: string): RitualAvailability => ({ ok: false, reason });
const yes: RitualAvailability = { ok: true };

/**
 * Whether a ritual can be cast now, apart from its price. The Altar shows the
 * reason; the reducer checks the same rules so a stale click can't slip past.
 */
export const ritualAvailability = (
  id: Ritual['id'],
  god: GodName | undefined,
  state: { activeBuff: string; rituals?: RitualState; history: readonly LogEntry[]; unlocks: UnlockState },
): RitualAvailability => {
  const r = state.rituals;
  const running = activeGod(r);
  if (god && running) return running === god && id !== 'PACT' ? no('Already active') : no(running === god ? `Pay off Zamorak's debt first` : `${running} is active`);
  if (id === 'TEARS' && r?.tearsSpent) return no('Once per dry spell');
  if (id === 'PACT' || id === 'INVOCATIONS' || id === 'BARROWS') {
    if (rollRitualActive(state.activeBuff, r)) return no('Another roll ritual is active');
  }
  if (id === 'SACRIFICE') {
    const used = r?.sacrificesUsed ?? 0;
    if (used >= SACRIFICE_USES_PER_RUN) return no('No Sacrifices left this run');
    const rolls = rollsMade(state.history);
    if (rolls < SACRIFICE_MIN_ROLLS) return no(`Opens after ${SACRIFICE_MIN_ROLLS} rolls (${rolls} so far)`);
    if (sacrificeCandidates(state.unlocks).length < SACRIFICE_TIERS) return no(`Needs ${SACRIFICE_TIERS} skill or gear tiers`);
  }
  return yes;
};

// --- Rolls -----------------------------------------------------------------

export interface RollRitualPlan {
  /** Added to the roll's odds, in percentage points. */
  oddsBonus: number;
  /** Added to the Omni-Key chance of a success. */
  omniBonus: number;
  /** % chance a fail turns into a success (Verac). */
  hitThrough: number;
  /** % chance a success pays a second Key (Karil). */
  secondKey: number;
}

export const NO_PLAN: RollRitualPlan = { oddsBonus: 0, omniBonus: 0, hitThrough: 0, secondKey: 0 };

/** Odds boosts stop at 95%, but never pull down a roll that is already higher. */
export const BOOST_CAP = 95;

export const rollRitualPlan = (r: RitualState | undefined, fatePoints: number): RollRitualPlan => {
  if (!r) return NO_PLAN;
  const plan = { ...NO_PLAN };
  if ((r.pactRollsLeft ?? 0) > 0) plan.oddsBonus += PACT_ODDS_BONUS;
  const inv = r.invocations && r.invocations.rollsLeft > 0 ? r.invocations.ids : [];
  if (inv.includes('OVERLY_DRAINING')) plan.oddsBonus -= 5;
  plan.omniBonus += invocationOmniBonus(inv);
  const b = r.barrows && r.barrows.rollsLeft > 0 ? r.barrows.brother : null;
  if (b === 'AHRIM') plan.oddsBonus += 10;
  if (b === 'DHAROK') plan.oddsBonus += Math.min(25, Math.floor(Math.max(0, fatePoints) / 2));
  if (b === 'TORAG') plan.oddsBonus += 5;
  if (b === 'VERAC') plan.hitThrough = 15;
  if (b === 'KARIL') plan.secondKey = 50;
  return plan;
};

/** The roll's threshold after a plan's odds change. */
export const applyOddsBonus = (threshold: number, bonus: number): number => {
  if (bonus === 0) return threshold;
  if (bonus < 0) return Math.max(0, threshold + bonus);
  return Math.max(threshold, Math.min(threshold + bonus, BOOST_CAP));
};

export interface FailFate {
  /** Fate added to the bar. */
  earned: number;
  /** Fate taken from the bar (Blood Price). */
  lost: number;
  /** Fate that went to Zamorak's debt instead of the bar. */
  debtPaid: number;
  /** Whether this fail brings the Pity Key. */
  pity: boolean;
  /** Short notes for the history, e.g. "Tears doubled it". */
  notes: string[];
}

/**
 * What a failed roll does to Fate under the run's rituals. `base` is the
 * source's Fate (plus Greed's refund). Order: Walk the Path, Tears, Guthan
 * and Torag add up what the fail would give, Zamorak takes his share of it,
 * then Blood Price takes Fate from the bar.
 */
export const failFate = (
  r: RitualState | undefined,
  base: number,
  fatePoints: number,
  pityEnabled: boolean,
  pityThreshold: number,
): FailFate => {
  const notes: string[] = [];
  const inv = r?.invocations && r.invocations.rollsLeft > 0 ? r.invocations.ids : [];
  let gain = base;
  if (inv.includes('WALK_THE_PATH')) { gain = 0; notes.push('Walk the Path'); }
  if ((r?.tearsFailsLeft ?? 0) > 0 && gain > 0) { gain *= 2; notes.push('Tears doubled'); }
  const b = r?.barrows && r.barrows.rollsLeft > 0 ? r.barrows : null;
  if (b?.brother === 'GUTHAN') { gain += 8; notes.push('Guthan healed 8'); }
  if (b?.brother === 'TORAG' && b.rollsLeft === 1 && b.failed === BARROWS_ROLLS - 1) {
    gain += b.fateCost;
    notes.push(`Torag returned ${b.fateCost}`);
  }
  const debt = (r?.pactRollsLeft ?? 0) > 0 ? 0 : r?.pactDebt ?? 0;
  const debtPaid = Math.min(debt, gain);
  if (debtPaid > 0) notes.push(`${debtPaid} to Zamorak`);
  const earned = gain - debtPaid;
  const pity = pityEnabled && fatePoints + earned >= pityThreshold;
  const afterGain = pity ? fatePoints + earned - pityThreshold : fatePoints + earned;
  const lost = inv.includes('BLOOD_PRICE') ? Math.min(BLOOD_PRICE_FATE, Math.max(0, afterGain)) : 0;
  if (lost > 0) notes.push(`Blood Price took ${lost}`);
  if (inv.includes('HARDCORE')) notes.push('Hardcore ended the invocations');
  return { earned, lost, debtPaid, pity, notes };
};

/** The ritual state after a roll lands. */
export const afterRoll = (r: RitualState | undefined, outcome: { success: boolean; debtPaid: number }): RitualState | undefined => {
  if (!r) return r;
  const next: RitualState = { ...r };
  if ((next.pactRollsLeft ?? 0) > 0) {
    next.pactRollsLeft = next.pactRollsLeft! - 1;
    if (next.pactRollsLeft === 0) { delete next.pactRollsLeft; next.pactDebt = PACT_DEBT; }
  } else if ((next.pactDebt ?? 0) > 0) {
    next.pactDebt = next.pactDebt! - outcome.debtPaid;
    if (next.pactDebt <= 0) delete next.pactDebt;
  }
  if (next.invocations) {
    // Hardcore: the first fail ends every invocation at once.
    const left = !outcome.success && next.invocations.ids.includes('HARDCORE') ? 0 : next.invocations.rollsLeft - 1;
    if (left > 0) next.invocations = { ...next.invocations, rollsLeft: left };
    else delete next.invocations;
  }
  if (next.barrows) {
    const left = next.barrows.rollsLeft - 1;
    if (left > 0) next.barrows = { ...next.barrows, rollsLeft: left, failed: next.barrows.failed + (outcome.success ? 0 : 1) };
    else delete next.barrows;
  }
  if (outcome.success) {
    delete next.tearsFailsLeft;
    delete next.tearsSpent;
  } else if ((next.tearsFailsLeft ?? 0) > 0) {
    next.tearsFailsLeft = next.tearsFailsLeft! - 1;
    if (next.tearsFailsLeft === 0) delete next.tearsFailsLeft;
  }
  return next;
};

// --- Casting -----------------------------------------------------------------

export const castTears = (r: RitualState | undefined): RitualState => ({ ...r, tearsFailsLeft: TEARS_FAILS, tearsSpent: true });
export const castPact = (r: RitualState | undefined): RitualState => ({ ...r, pactRollsLeft: PACT_ROLLS });
export const castInvocations = (r: RitualState | undefined, ids: Invocation['id'][]): RitualState => ({ ...r, invocations: { ids, rollsLeft: INVOCATION_ROLLS } });
export const castBarrows = (r: RitualState | undefined, brother: BarrowsBrother['id'], fateCost: number): RitualState =>
  ({ ...r, barrows: { brother, rollsLeft: BARROWS_ROLLS, failed: 0, fateCost } });

// --- Saradomin's Ward ----------------------------------------------------------

/**
 * Tables whose entries sit in one place on the map. The Ward waits for a Key
 * spent on one of them, or a Chaos Key. Shops are left out: a shop type is
 * sold in many towns, and the tracker has no full list of where.
 */
export const WARD_TABLES: ReadonlySet<TableType> = new Set([
  TableType.BOSSES, TableType.MINIGAMES, TableType.GUILDS, TableType.BANKS,
]);

/** Whether a random spend uses up a waiting Ward: a Chaos Key, or a Key on a table with places. */
export const wardApplies = (costType: 'key' | 'chaosKey', table: TableType | undefined): boolean =>
  costType === 'chaosKey' || (table !== undefined && WARD_TABLES.has(table));


// --- Sacrifice -------------------------------------------------------------------

export interface SacrificeTier { table: 'skill' | 'gear'; name: string; tier: number }

/** The top tiers fate may take: every skill or gear slot above its free starting tier. */
export const sacrificeCandidates = (unlocks: UnlockState): SacrificeTier[] => [
  ...Object.entries(unlocks.skills)
    .filter(([skill, tier]) => tier > (skill === 'Hitpoints' ? 1 : 0))
    .map(([name, tier]) => ({ table: 'skill' as const, name, tier })),
  ...Object.entries(unlocks.equipment)
    .filter(([, tier]) => tier > 0)
    .map(([name, tier]) => ({ table: 'gear' as const, name, tier })),
];

/** Draws `SACRIFICE_TIERS` different candidates with the supplied gameplay RNG. */
export const pickSacrifice = (unlocks: UnlockState, nextFloat: (i: number) => number): SacrificeTier[] => {
  const pool = sacrificeCandidates(unlocks);
  const picked: SacrificeTier[] = [];
  for (let i = 0; i < SACRIFICE_TIERS && pool.length > 0; i++) {
    picked.push(pool.splice(Math.floor(nextFloat(i) * pool.length), 1)[0]);
  }
  return picked;
};

/** Drops empty fields so a run with nothing running saves no `rituals` at all. */
export const tidyRituals = (r: RitualState | undefined): RitualState | undefined => {
  if (!r) return undefined;
  const out: RitualState = {};
  if (r.ward) out.ward = true;
  if ((r.tearsFailsLeft ?? 0) > 0) out.tearsFailsLeft = r.tearsFailsLeft;
  if (r.tearsSpent) out.tearsSpent = true;
  if ((r.pactRollsLeft ?? 0) > 0) out.pactRollsLeft = r.pactRollsLeft;
  if ((r.pactDebt ?? 0) > 0) out.pactDebt = r.pactDebt;
  if (r.invocations && r.invocations.rollsLeft > 0) out.invocations = r.invocations;
  if (r.barrows && r.barrows.rollsLeft > 0) out.barrows = r.barrows;
  if ((r.sacrificesUsed ?? 0) > 0) out.sacrificesUsed = r.sacrificesUsed;
  return Object.keys(out).length > 0 ? out : undefined;
};
