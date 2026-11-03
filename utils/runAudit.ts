import { LogEntry, TableType, type UnlockState } from '../types';
import { CUSTOM_RULE_BOUNDS, type GameModeRules } from '../config/gameModes';
import { PET_COMPENSATION_ID } from './petCompensation';
import { FREE_HITPOINTS_TIER, hitpointsRefund } from './hitpointsMigration';
import { RETIRED_BOSSES, RETIRED_MINIGAMES } from '../data/items';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { mergedBankId } from './bankUnlockMerges';
import { computeRunId, ensureChain, sha256Hex, verifyChain, type ChainReport, type RunMode } from './integrity';

// The run check: replays a history's totals and rolls and compares them with
// the saved counters. Kept apart from the hash chain in ./integrity, which the
// reducer needs on every dispatch, so this stays out of the entry chunk.

// --- Invariant replay ---------------------------------------------------

export interface InvariantViolation {
  index: number;
  kind: 'KEYS_NEGATIVE' | 'SPECIAL_NEGATIVE' | 'CHAOS_NEGATIVE' | 'FATE_NEGATIVE' | 'FATE_OVERFLOW' | 'ROLL_OUT_OF_RANGE' | 'ROLL_CONTRADICTS_RESULT' | 'LEGACY_RITUAL_ESTIMATE';
  message: string;
}

export interface ReplayState {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  unlocks: number;
  rolls: number;
  successes: number;
  omnis: number;
  pities: number;
}

/**
 * What the replay could not count exactly. `exactKeys` is false when an older
 * roll entry (before 20 August 2026) did not record how many Standard Keys it
 * paid; `exactFate` is false while the Fate balance is an estimate.
 */
export interface ReplayResult {
  violations: InvariantViolation[];
  final: ReplayState;
  exactKeys: boolean;
  exactFate: boolean;
}

/** The part of a run's ruleset that bounds its Fate. */
export type ReplayRules = Pick<GameModeRules, 'pityEnabled' | 'pityThreshold'>;

// Given the history alone, re-derive the running state and flag anything
// physically impossible (negative keys, fate over cap, roll outside 0.01-100.0).
// Doesn't prove the *roll values* are honest — a determined editor can
// rewrite consistently — but catches naive tampering and any inconsistency
// introduced by hand-editing isolated fields. `rules` is the run's mode: with
// pity off Fate has no cap, otherwise the cap is the mode's pity threshold.
const NEWER_RITUALS = new Set(['WARD', 'TEARS', 'PACT', 'INVOCATIONS', 'BARROWS', 'SACRIFICE']);

export const replayInvariants = (
  history: LogEntry[],
  startKeys = 3,
  rules?: ReplayRules,
  start?: Partial<ReplayState>,
): ReplayResult => {
  const recordedFateAward = (entry: LogEntry): number => {
    const award = entry.meta?.fatePointsEarned;
    return typeof award === 'number' && Number.isFinite(award) && award >= 0
      ? award
      : 1;
  };
  const validPityThreshold = (value: unknown): number | null =>
    typeof value === 'number'
      && Number.isSafeInteger(value)
      && value >= CUSTOM_RULE_BOUNDS.pityThreshold.min
      && value <= CUSTOM_RULE_BOUNDS.pityThreshold.max
      ? value
      : null;
  const modeThreshold = validPityThreshold(rules?.pityThreshold);
  // A Greed success says "(Doubled)" when it paid 2 Standard Keys: a plain success
  // always could, an Omni-Key roll only since 2 October 2026.
  // Karil's second Key (a Barrows Chest roll) says "(Second Key)".
  // Since 20 August 2026 every roll records the Standard Keys it paid; that
  // count wins over the message, which older entries still need.
  const recordedStandardKeys = (entry: LogEntry): number | null => {
    const paid = entry.meta?.standardKeysAwarded;
    return typeof paid === 'number' && Number.isSafeInteger(paid) && paid >= 0 && paid <= 2 ? paid : null;
  };
  const successStandardKeys = (entry: LogEntry): number =>
    recordedStandardKeys(entry)
      ?? (entry.details && /\((Doubled|Second Key)\)/.test(entry.message) ? 2 : 1);
  // Blood Price (Amascut's Invocations) takes Fate from the bar after a miss.
  const recordedFateLost = (entry: LogEntry): number => {
    const lost = entry.meta?.fatePointsLost;
    return typeof lost === 'number' && Number.isSafeInteger(lost) && lost >= 0 ? lost : 0;
  };
  const recordedPityThreshold = (entry: LogEntry): number =>
    validPityThreshold(entry.meta?.pityThreshold) ?? modeThreshold ?? 50;
  // Without the mode (older callers), the first Pity Key's recorded threshold
  // or the historical 50 stands in for it.
  const fateCap = rules?.pityEnabled === false
    ? Number.POSITIVE_INFINITY
    : modeThreshold ?? history
      .filter(entry => entry.type === 'PITY')
      .map(entry => validPityThreshold(entry.meta?.pityThreshold))
      .find((threshold): threshold is number => threshold !== null) ?? 50;
  const detectedSkillChaosAward = (entry: LogEntry): number => {
    const award = entry.meta?.chaosKeysAwarded;
    return entry.meta?.detectorId === 'skill-level-v1'
      && typeof award === 'number'
      && Number.isSafeInteger(award)
      && award >= 0
      ? award
      : 0;
  };
  const s: ReplayState = {
    keys: startKeys,
    specialKeys: 0,
    chaosKeys: 0,
    fatePoints: 0,
    unlocks: 0,
    rolls: 0,
    successes: 0,
    omnis: 0,
    pities: 0,
    ...start,
  };
  const violations: InvariantViolation[] = [];
  let fateEstimate = false;
  const check = (idx: number) => {
    if (s.keys < 0) violations.push({ index: idx, kind: 'KEYS_NEGATIVE', message: `keys went negative (${s.keys})` });
    if (s.specialKeys < 0) violations.push({ index: idx, kind: 'SPECIAL_NEGATIVE', message: `specialKeys went negative` });
    if (s.chaosKeys < 0) violations.push({ index: idx, kind: 'CHAOS_NEGATIVE', message: `chaosKeys went negative` });
    if (!fateEstimate && s.fatePoints < 0) violations.push({ index: idx, kind: 'FATE_NEGATIVE', message: `fatePoints went negative` });
    if (!fateEstimate && s.fatePoints > fateCap) violations.push({ index: idx, kind: 'FATE_OVERFLOW', message: `fatePoints above cap (${s.fatePoints})` });
  };

  let exactKeys = true;
  const ROLL_TYPES = new Set<LogEntry['type']>(['ROLL_SUCCESS', 'ROLL_OMNI', 'PITY', 'ROLL_FAIL']);
  for (let i = 0; i < history.length; i++) {
    const e = history[i];
    if (ROLL_TYPES.has(e.type) && recordedStandardKeys(e) === null) exactKeys = false;
    if (e.rollValue !== undefined && (!Number.isFinite(e.rollValue) || e.rollValue < 0.01 || e.rollValue > 100)) {
      violations.push({
        index: i,
        kind: 'ROLL_OUT_OF_RANGE',
        message: `roll ${e.rollValue} out of 0.01-100.0`,
      });
    } else {
      const contradiction = rollContradiction(e);
      if (contradiction) violations.push({ index: i, kind: 'ROLL_CONTRADICTS_RESULT', message: contradiction });
    }
    switch (e.type) {
      case 'ROLL_OMNI':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.specialKeys += 1;
        s.keys += successStandardKeys(e);
        s.fatePoints = 0;
        fateEstimate = false;
        s.rolls += 1; s.successes += 1; s.omnis += 1;
        break;
      case 'ROLL_SUCCESS':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.keys += successStandardKeys(e);
        s.fatePoints = 0;
        fateEstimate = false;
        s.rolls += 1; s.successes += 1;
        break;
      case 'PITY':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.keys += recordedStandardKeys(e) ?? 1;
        s.fatePoints = Math.max(0, s.fatePoints + recordedFateAward(e) - recordedPityThreshold(e) - recordedFateLost(e));
        s.rolls += 1; s.pities += 1;
        break;
      case 'ROLL_FAIL':
        s.chaosKeys += detectedSkillChaosAward(e);
        s.fatePoints += recordedFateAward(e) - recordedFateLost(e);
        s.rolls += 1;
        break;
      case 'UNLOCK': {
        const cost = typeof e.meta?.cost === 'number' ? e.meta.cost : 0;
        const costType = e.meta?.costType;
        if (costType === 'key') s.keys -= cost;
        else if (costType === 'specialKey') s.specialKeys -= 1;
        else if (costType === 'chaosKey') s.chaosKeys -= 1;
        s.unlocks += 1;
        break;
      }
      case 'ALTAR': {
        const amount = (key: string, fallback: number | (() => number)): number => {
          const value = e.meta?.[key];
          return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
            ? value : typeof fallback === 'function' ? fallback() : fallback;
        };
        // Old entries omitted the paid cost and custom multiplier. Do not rewrite
        // their hashes or certify an estimate as an exact balance. The historical
        // base prices changed in 46b0792 (2026-07-04); a stale client may differ.
        const legacyCost = (before: number, after: number): number => {
          if (typeof e.meta?.fateCost === 'number' && Number.isSafeInteger(e.meta.fateCost) && e.meta.fateCost >= 0) return e.meta.fateCost;
          fateEstimate = true;
          violations.push({ index: i, kind: 'LEGACY_RITUAL_ESTIMATE', message: 'Historical ritual did not record its paid cost; Fate balance is estimated until the next reset.' });
          return e.timestamp < Date.parse('2026-07-04T13:34:16Z') ? before : after;
        };
        const ritual = e.meta?.ritual;
        // Message matching is only for legacy entries without a recorded
        // ritual: a Cartographer entry naming "Chaos Temple" is not Chaos.
        const isRitual = (id: string, legacyMessage: RegExp): boolean =>
          typeof ritual === 'string' ? ritual === id : legacyMessage.test(e.message);
        if (isRitual('LUCK', /Clarity/)) s.fatePoints -= legacyCost(15, 8);
        else if (isRitual('GREED', /Greed/)) s.fatePoints -= legacyCost(30, 15);
        else if (isRitual('CHAOS', /Chaos/)) {
          s.fatePoints -= legacyCost(25, 25); s.chaosKeys += amount('chaosKeysAwarded', 1);
        } else if (isRitual('TRANSMUTE', /Transmut/)) {
          s.keys -= amount('keyCost', 5); s.specialKeys += amount('specialKeysAwarded', 1);
        } else if (isRitual('GAMBIT', /Void Gambit/)) {
          s.fatePoints = 0;
          fateEstimate = false;
          s.keys += amount('keysAwarded', Number(e.message.match(/WON.*?([0-9]+) Key/)?.[1] ?? 0));
        } else if (isRitual('CARTOGRAPHER', /Cartographer/)) {
          s.fatePoints -= amount('fateCost', () => Number(e.details?.match(/for ([0-9]+) Fate/)?.[1] ?? legacyCost(40, 40)));
          s.unlocks += 1;
        } else if (typeof ritual === 'string' && NEWER_RITUALS.has(ritual)) {
          // The newer rituals always record what they cost; Sacrifice also pays an Omni-Key.
          s.fatePoints -= amount('fateCost', 0);
          if (ritual === 'SACRIFICE') {
            s.specialKeys += amount('specialKeysAwarded', 1);
            // Fate took one tier from each unlock it names.
            if (Array.isArray(e.meta?.taken)) s.unlocks -= e.meta.taken.length;
          }
        }
        break;
      }
      case 'LEVEL_UP': {
        const chaosAwarded = e.meta?.chaosKeysAwarded;
        if (typeof chaosAwarded === 'number'
          && Number.isSafeInteger(chaosAwarded)
          && chaosAwarded >= 0) {
          s.chaosKeys += chaosAwarded;
        } else if (/Chaos Key Drop/.test(e.message)) s.chaosKeys += 1;
        break;
      }
      case 'COMPENSATION': {
        // The pet offer and the owed Keys it settles later say what they paid and took.
        if (e.meta?.releaseId === PET_COMPENSATION_ID) {
          const count = (key: string): number => {
            const value = e.meta?.[key];
            return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
          };
          s.specialKeys += count('specialKeysAwarded');
          s.keys += count('pityKeysAwarded') - count('keysWithheld');
          const fateAfter = e.meta?.fatePointsAfter;
          if (typeof fateAfter === 'number' && Number.isSafeInteger(fateAfter) && fateAfter >= 0) {
            s.fatePoints = fateAfter;
            fateEstimate = false;
          }
          break;
        }
        const choice = e.meta?.choice;
        if (choice === 'chaos' || choice === 'full') {
          const chaosAwarded = e.meta?.chaosKeysAwarded;
          if (typeof chaosAwarded === 'number'
            && Number.isSafeInteger(chaosAwarded)
            && chaosAwarded >= 0) {
            s.chaosKeys += chaosAwarded;
          }
        }
        if (choice === 'full') {
          const pityAwarded = e.meta?.pityKeysAwarded;
          if (typeof pityAwarded === 'number'
            && Number.isSafeInteger(pityAwarded)
            && pityAwarded >= 0) {
            s.keys += pityAwarded;
          }
        }
        // Every choice records the Fate balance it left (the offer's for 'full',
        // the run's own otherwise), which settles any older estimate.
        if (choice === 'full' || choice === 'chaos' || choice === 'none') {
          const fateAfter = e.meta?.fatePointsAfter;
          if (typeof fateAfter === 'number'
            && Number.isSafeInteger(fateAfter)
            && fateAfter >= 0) {
            s.fatePoints = fateAfter;
            fateEstimate = false;
          }
        }
        break;
      }
      case 'XTREME_MILESTONE':
        s.keys += typeof e.meta?.gained === 'number' ? e.meta.gained : 1;
        break;
      // An achievement's Fate, filled up to the pity line at most; the entry records the balance after.
      case 'ACHIEVEMENT': {
        const chaosAwarded = e.meta?.chaosKeysAwarded;
        if (typeof chaosAwarded === 'number' && Number.isSafeInteger(chaosAwarded) && chaosAwarded >= 0) s.chaosKeys += chaosAwarded;
        const fateAfter = e.meta?.fatePointsAfter;
        if (typeof fateAfter === 'number' && Number.isSafeInteger(fateAfter) && fateAfter >= 0) {
          s.fatePoints = fateAfter;
          fateEstimate = false;
        }
        break;
      }
      // Chunked: fate's marks (utils/fateLand.ts). A Blessed chunk records the
      // Fate balance after it; a Chaotic one the Chaos Key it gave, if any.
      case 'FATE': {
        const chaosAwarded = e.meta?.chaosKeysAwarded;
        if (typeof chaosAwarded === 'number' && Number.isSafeInteger(chaosAwarded) && chaosAwarded >= 0) s.chaosKeys += chaosAwarded;
        const fateAfter = e.meta?.fatePointsAfter;
        if (typeof fateAfter === 'number' && Number.isSafeInteger(fateAfter) && fateAfter >= 0) {
          s.fatePoints = fateAfter;
          fateEstimate = false;
        }
        break;
      }
      // A new pet's Omni-Key. It isn't a roll: Fate stays as it was.
      case 'PET': {
        const awarded = e.meta?.specialKeysAwarded;
        s.specialKeys += typeof awarded === 'number' && Number.isSafeInteger(awarded) && awarded >= 0 ? awarded : 1;
        break;
      }
    }
    check(i);
  }
  return { violations, final: s, exactKeys, exactFate: !fateEstimate };
};

const formatPercent = (value: number): string => `${Number(value.toFixed(2))}`;

/**
 * A roll entry whose recorded roll and chance disagree with its result: a
 * success must roll at or under its chance, a miss (or a Pity Key) over it.
 * Verac's hit-through is the one success that rolls over, and says so.
 */
const rollContradiction = (e: LogEntry): string | null => {
  const roll = e.rollValue;
  const threshold = e.threshold;
  if (typeof roll !== 'number' || typeof threshold !== 'number' || !Number.isFinite(threshold)) return null;
  if (e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_OMNI') {
    if (roll <= threshold || /Verac hit through/.test(e.details ?? '')) return null;
    return `a success rolled ${formatPercent(roll)}, over its ${formatPercent(threshold)}% chance`;
  }
  if (e.type === 'ROLL_FAIL' || e.type === 'PITY') {
    if (roll > threshold) return null;
    return `a miss rolled ${formatPercent(roll)}, within its ${formatPercent(threshold)}% chance`;
  }
  return null;
};

// --- Run audit (import verdict) -----------------------------------------

/**
 * 'intact'   — every entry is hash-linked, the replay hit nothing impossible,
 *              and the saved Keys, Fate and unlocks agree with it (when given).
 *              All of it is self-reported: an unkeyed hash chain on the
 *              player's own device proves nothing about what was played.
 * 'warning'  — the links hold but something doesn't add up: a roll that
 *              contradicts its result, saved totals the history can't pay
 *              for, a history with no links at all, or a legacy estimate.
 * 'tampered' — a hash link is broken or missing.
 */
export type RunVerdict = 'intact' | 'warning' | 'tampered';

/** The run's saved counters, compared with what its history adds up to. */
export interface SavedTotals {
  keys: number;
  specialKeys: number;
  chaosKeys: number;
  fatePoints: number;
  unlocks?: UnlockState;
}

export interface TotalsCheck {
  /**
   * 'match' — compared and agree. 'mismatch' — compared and disagree.
   * 'unchecked' — not compared (no saved totals given, or an older history
   * that doesn't record every Key).
   */
  status: 'match' | 'mismatch' | 'unchecked';
  /** Plain sentences, one per disagreement or limitation. */
  reasons: string[];
}

export interface RunAudit {
  verdict: RunVerdict;
  chain: ChainReport;
  /** Entries without a hash link. Every entry when the history has none. */
  unlinked: number[];
  violations: InvariantViolation[];
  final: ReplayState;
  totals: TotalsCheck;
  /** Plain sentences for a warning or a tampered verdict, most important first. */
  reasons: string[];
}

const UNLOCK_LISTS = [
  'regions', 'chunks', 'mobility', 'arcana', 'housing', 'merchants', 'minigames',
  'bosses', 'storage', 'guilds', 'farming', 'slayerUnlocks', 'banks',
] as const;
/** A run from before Hitpoints was free started with it at tier 1 and nothing else. */
const STARTING_UNLOCKS = 1;

/** The run's paid-for unlocks: every skill and gear tier plus every owned entry. */
export const countUnlocks = (unlocks: UnlockState): number => {
  const tiers = (record: Record<string, number> | undefined): number => Object.values(record ?? {})
    .reduce((sum, tier) => sum + (Number.isSafeInteger(tier) && tier > 0 ? tier : 0), 0);
  return tiers(unlocks.skills) + tiers(unlocks.equipment)
    + UNLOCK_LISTS.reduce((sum, key) => sum + (unlocks[key]?.length ?? 0), 0);
};

const RETIRED: ReadonlyArray<{ table: TableType; item: string; key: 'regions' | 'bosses' | 'minigames' }> = [
  { table: TableType.REGIONS, item: 'Tutorial Island', key: 'regions' },
  ...RETIRED_BOSSES.map(item => ({ table: TableType.BOSSES, item, key: 'bosses' as const })),
  ...RETIRED_MINIGAMES.map(item => ({ table: TableType.MINIGAMES, item, key: 'minigames' as const })),
];

interface UntrackedCredits {
  keys: number; specialKeys: number; chaosKeys: number;
  /** Unlocks taken back without a history entry (retired items). */
  unlocksRemoved: number;
  /** Up to this many extra Standard Keys and unlocks may come from data updates. */
  keysAllowance: number; unlocksAllowance: number;
}

/**
 * What loading a save changes without writing history ("never rewrite the
 * integrity history", utils/areaUnlockMigration.ts and utils/saveSchema.ts):
 * a retired unlock is paid back in what it cost; an area or bank unlock that
 * merged into one the run already owned pays a Standard Key back; Port
 * Khazard and Chaos Temple each brought their neighbour area along; a
 * Hitpoints tier Fate took comes back as the starting tier; and since
 * Hitpoints is free (utils/hitpointsMigration.ts) every run owns all its tiers
 * and has back what it paid for them.
 */
const untrackedCredits = (history: LogEntry[], saved: UnlockState): UntrackedCredits => {
  const credits: UntrackedCredits = { keys: 0, specialKeys: 0, chaosKeys: 0, unlocksRemoved: 0, keysAllowance: 0, unlocksAllowance: 0 };
  const unlockEntries = history.filter(e => e.type === 'UNLOCK' && typeof e.meta?.item === 'string');
  for (const { table, item, key } of RETIRED) {
    if (saved[key]?.includes(item)) continue;
    const recorded = [...unlockEntries].reverse().find(e => e.meta?.item === item && e.meta?.category === table)?.meta;
    if (!recorded) continue;
    const cost = recorded.cost;
    if (recorded.costType === 'chaosKey') credits.chaosKeys += 1;
    else if (recorded.costType === 'specialKey') credits.specialKeys += 1;
    else if (recorded.costType === 'key') credits.keys += Number.isSafeInteger(cost) && cost > 0 ? cost : 1;
    else continue;
    credits.unlocksRemoved += 1;
  }
  const seen = new Set<string>();
  for (const e of unlockEntries) {
    const item = e.meta!.item as string;
    const id = e.meta?.category === TableType.REGIONS ? `r:${canonicalAreaName(item)}`
      : e.meta?.category === TableType.BANKS ? `b:${mergedBankId(item)}` : null;
    if (id === null) continue;
    if (seen.has(id)) credits.keysAllowance += 1;
    seen.add(id);
    if (e.meta?.category === TableType.REGIONS && (item === 'Port Khazard' || item === 'Chaos Temple')) credits.unlocksAllowance += 1;
  }
  if (saved.skills?.Hitpoints === FREE_HITPOINTS_TIER) {
    const refund = hitpointsRefund(history);
    credits.keys += refund.keys;
    credits.specialKeys += refund.specialKeys;
    credits.chaosKeys += refund.chaosKeys;
    credits.unlocksRemoved += refund.paidTiers;
    credits.unlocksAllowance += refund.sacrificedTiers + FREE_HITPOINTS_TIER - STARTING_UNLOCKS;
    return credits;
  }
  for (const e of history) {
    const taken = e.type === 'ALTAR' && e.meta?.ritual === 'SACRIFICE' && Array.isArray(e.meta?.taken) ? e.meta.taken : [];
    if (taken.some((t: { table?: unknown; name?: unknown; tier?: unknown }) => t?.table === 'skill' && t?.name === 'Hitpoints' && t?.tier === 1)) {
      credits.unlocksAllowance += 1;
    }
  }
  return credits;
};

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const compareTotals = (history: LogEntry[], replay: ReplayResult, saved: SavedTotals | undefined): TotalsCheck => {
  if (!saved) return { status: 'unchecked', reasons: ['Saved Keys and unlocks were not compared.'] };
  if (!replay.exactKeys) {
    return { status: 'unchecked', reasons: ["Older entries don't record every Key, so saved Keys and unlocks weren't compared."] };
  }
  const reasons: string[] = [];
  const credits = saved.unlocks ? untrackedCredits(history, saved.unlocks) : null;
  const { final } = replay;
  const counter = (label: string, savedValue: number, replayed: number, allowance = 0) => {
    if (savedValue >= replayed && savedValue <= replayed + allowance) return;
    reasons.push(`Saved ${label}: ${savedValue}, but the history adds up to ${replayed}.`);
  };
  counter('Keys', saved.keys, final.keys + (credits?.keys ?? 0), credits?.keysAllowance ?? 0);
  counter('Omni-Keys', saved.specialKeys, final.specialKeys + (credits?.specialKeys ?? 0));
  counter('Chaos Keys', saved.chaosKeys, final.chaosKeys + (credits?.chaosKeys ?? 0));
  if (replay.exactFate) counter('Fate', saved.fatePoints, final.fatePoints);
  if (saved.unlocks && credits) {
    const owned = countUnlocks(saved.unlocks);
    const paid = STARTING_UNLOCKS + final.unlocks - credits.unlocksRemoved + credits.unlocksAllowance;
    if (owned > paid) reasons.push(`Saved unlocks: ${owned}, but the history pays for ${paid}.`);
  }
  return reasons.length > 0 ? { status: 'mismatch', reasons } : { status: 'match', reasons: [] };
};

/**
 * Classify a run's history for display. Links are checked as stored, never
 * rebuilt first: an entry without a hash link in a linked history is an edit,
 * and a history with no links at all can't show edits. Pass the run's mode
 * rules so its Fate is held to that mode's pity rule, and its saved totals so
 * the replay is compared with them. Nothing here is signed or checked by
 * anyone else: the verdict says what this device could check, no more.
 */
export const auditHistory = (history: LogEntry[], rules?: ReplayRules, saved?: SavedTotals): RunAudit => {
  const unlinked = history.flatMap((e, i) => (e.hash && e.prevHash ? [] : [i]));
  const noLinks = history.length > 0 && unlinked.length === history.length;
  const linkedChain = verifyChain(history);
  const brokenAt = noLinks ? [] : [...new Set([...linkedChain.brokenAt, ...unlinked])].sort((x, y) => x - y);
  const chain: ChainReport = { ok: brokenAt.length === 0, brokenAt, firstBreak: brokenAt[0] ?? null };
  const replay = replayInvariants(history, undefined, rules);
  const totals = compareTotals(history, replay, saved);
  const { violations, final } = replay;

  const reasons: string[] = [];
  if (!chain.ok) {
    const missing = noLinks ? 0 : unlinked.length;
    reasons.push(missing > 0
      ? `${missing === 1 ? '1 entry has' : `${missing} entries have`} no hash link: the history was edited.`
      : `${plural(brokenAt.length, 'hash link')} ${brokenAt.length === 1 ? 'is' : 'are'} broken: entries were added, changed or removed.`);
  }
  if (noLinks) reasons.push('This history has no hash links, so edits to it can\'t be seen.');
  for (const v of violations) {
    if (v.kind === 'ROLL_CONTRADICTS_RESULT') reasons.push(`Entry ${v.index + 1}: ${v.message}.`);
  }
  if (totals.status === 'mismatch') reasons.push(...totals.reasons);
  const otherViolations = violations.filter(v => v.kind !== 'ROLL_CONTRADICTS_RESULT');
  if (otherViolations.some(v => v.kind === 'LEGACY_RITUAL_ESTIMATE')) {
    reasons.push('An older ritual didn\'t record its price, so Fate is an estimate.');
  }
  const impossible = otherViolations.filter(v => v.kind !== 'LEGACY_RITUAL_ESTIMATE');
  if (impossible.length > 0) reasons.push(`The replay hit ${plural(impossible.length, 'impossible state')} (such as negative Keys).`);

  let verdict: RunVerdict = 'intact';
  if (!chain.ok) verdict = 'tampered';
  else if (noLinks || violations.length > 0 || totals.status === 'mismatch') verdict = 'warning';
  return { verdict, chain, unlinked, violations, final, totals, reasons };
};


export interface VerifiedBundle {
  version: 1;
  runId: string;
  exportedAt: string;
  /** The game mode the run was played under, if known. */
  mode?: RunMode;
  history: LogEntry[];
  finalState: ReplayState;
  chainReport: ChainReport;
  /** Missing historical costs and other replay limitations must travel with the export. */
  replayWarnings?: InvariantViolation[];
  /**
   * This device's check of the history as stored (before links were filled
   * in for the export), and of the saved totals when given. Self-reported:
   * nothing in the bundle is signed.
   */
  audit?: { verdict: RunVerdict; totals: TotalsCheck['status']; reasons: string[] };
  /** A SHA-256 checksum of runId, mode and history. Not a signature: anyone can recompute it. */
  commitmentHash: string;
}

export const buildVerifiedBundle = async (
  history: LogEntry[],
  mode?: RunMode,
  saved?: SavedTotals,
): Promise<VerifiedBundle> => {
  const audit = auditHistory(history, mode?.rules, saved);
  const chained = ensureChain(history);
  const chainReport = verifyChain(chained);
  const { final, violations } = replayInvariants(chained, undefined, mode?.rules);
  const runId = computeRunId(chained) ?? 'run-empty';
  // The mode is part of the checksum: a run reads differently under another ruleset.
  const commitmentHash = await sha256Hex(JSON.stringify({ runId, mode: mode ?? null, history: chained }));
  return {
    version: 1,
    runId,
    exportedAt: new Date().toISOString(),
    ...(mode ? { mode } : {}),
    history: chained,
    finalState: final,
    chainReport,
    ...(violations.length ? { replayWarnings: violations } : {}),
    audit: { verdict: audit.verdict, totals: audit.totals.status, reasons: audit.reasons },
    commitmentHash,
  };
};
