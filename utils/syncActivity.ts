/**
 * Sync & Roll for boss kills and clue caskets (big ideas pick 1, October 2026).
 *
 * Wise Old Man reports each boss's kill count and each clue tier's completed
 * caskets. The first reading after a run links (or after this shipped, for
 * runs linked before) becomes the run's score baseline: kills and caskets the
 * account already had never roll. Each sync rolls the new ones through the
 * same Farm Keys rolls a click would make, at the same rates and from the
 * same Vanilla and Chunked stashes, less any roll for that boss or tier the
 * run's history already holds since the baseline (a Farm Keys click, a
 * RuneLite event, an earlier sync), so nothing is rolled twice.
 */
import { DropSource, type GameState, type LogEntry, type SyncScores } from '../types';
import { BOSSES_LIST, DROP_RATES } from '../constants';
import { BRUTUS_BOSS_NAME, type KeyRollContext } from '../config/vanillaKeyEconomy';
import { bossTier, TIER_LABEL, TIER_ORDER, TIER_SOURCE, type BossTier } from '../data/bossKeyTiers';
import { isRollEntry } from './logEntry';
import { normalizeAccountName } from './accountName';

/** Each of our bosses as Wise Old Man's boss metrics (summed where we keep one entry for several). */
export const BOSS_METRICS: Readonly<Record<string, readonly string[]>> = {
  [BRUTUS_BOSS_NAME]: ['brutus'],
  'Chambers of Xeric': ['chambers_of_xeric', 'chambers_of_xeric_challenge_mode'],
  'Theatre of Blood': ['theatre_of_blood', 'theatre_of_blood_hard_mode'],
  'Tombs of Amascut': ['tombs_of_amascut', 'tombs_of_amascut_expert'],
  'The Gauntlet': ['the_gauntlet', 'the_corrupted_gauntlet'],
  'The Nightmare': ['nightmare'],
  "Phosani's Nightmare": ['phosanis_nightmare'],
  'Nex': ['nex'],
  'Corporeal Beast': ['corporeal_beast'],
  'General Graardor': ['general_graardor'],
  'Commander Zilyana': ['commander_zilyana'],
  "Kree'arra": ['kreearra'],
  "K'ril Tsutsaroth": ['kril_tsutsaroth'],
  'Abyssal Sire': ['abyssal_sire'],
  'Alchemical Hydra': ['alchemical_hydra'],
  'Cerberus': ['cerberus'],
  'Grotesque Guardians': ['grotesque_guardians'],
  'Kraken': ['kraken'],
  'Skotizo': ['skotizo'],
  'Thermonuclear Smoke Devil': ['thermonuclear_smoke_devil'],
  'Araxxor': ['araxxor'],
  'Artio': ['artio'],
  'Callisto': ['callisto'],
  "Calvar'ion": ['calvarion'],
  'Chaos Elemental': ['chaos_elemental'],
  'Chaos Fanatic': ['chaos_fanatic'],
  'Crazy Archaeologist': ['crazy_archaeologist'],
  'Scorpia': ['scorpia'],
  'Spindel': ['spindel'],
  'Venenatis': ['venenatis'],
  "Vet'ion": ['vetion'],
  'Vorkath': ['vorkath'],
  'The Hueycoatl': ['the_hueycoatl'],
  'Duke Sucellus': ['duke_sucellus'],
  'The Leviathan': ['the_leviathan'],
  'The Whisperer': ['the_whisperer'],
  'Vardorvis': ['vardorvis'],
  'Bryophyta': ['bryophyta'],
  'Deranged Archaeologist': ['deranged_archaeologist'],
  'Giant Mole': ['giant_mole'],
  'Hespori': ['hespori'],
  'Kalphite Queen': ['kalphite_queen'],
  'King Black Dragon': ['king_black_dragon'],
  'Mimic': ['mimic'],
  'Obor': ['obor'],
  'Phantom Muspah': ['phantom_muspah'],
  'Sarachnis': ['sarachnis'],
  'Scurrius': ['scurrius'],
  'Zulrah': ['zulrah'],
  'Wintertodt': ['wintertodt'],
  'Tempoross': ['tempoross'],
  'Zalcano': ['zalcano'],
  'Amoxliatl': ['amoxliatl'],
  'The Royal Titans': ['the_royal_titans'],
  'Yama': ['yama'],
  'Doom of Mokhaiotl': ['doom_of_mokhaiotl'],
  'Shellbane Gryphon': ['shellbane_gryphon'],
  'Maggot King': ['maggot_king'],
  'The Mad Angel': ['mad_angel'],
  'The Fractured Archive': ['the_fractured_archive'],
  'Moons of Peril': ['lunar_chests'],
  'Fortis Colosseum': ['sol_heredit'],
  'Barrows Brothers': ['barrows_chests'],
  'Dagannoth Kings': ['dagannoth_prime', 'dagannoth_rex', 'dagannoth_supreme'],
  'TzHaar Fight Cave': ['tztok_jad'],
  'Inferno': ['tzkal_zuk'],
  // Not on the hiscores, so they stay Farm Keys clicks:
  // Tormented Demons, Gemstone Crab, TzHaar-Ket-Rak's Challenges.
};

export const CLUE_TIERS = ['Beginner', 'Easy', 'Medium', 'Hard', 'Elite', 'Master'] as const;
export type ClueTier = typeof CLUE_TIERS[number];
export const CLUE_SOURCE: Readonly<Record<ClueTier, DropSource>> = {
  Beginner: DropSource.CLUE_BEGINNER,
  Easy: DropSource.CLUE_EASY,
  Medium: DropSource.CLUE_MEDIUM,
  Hard: DropSource.CLUE_HARD,
  Elite: DropSource.CLUE_ELITE,
  Master: DropSource.CLUE_MASTER,
};
export const clueMetric = (tier: ClueTier): string => `clue_scrolls_${tier.toLowerCase()}`;

/** Every metric a score baseline keeps. */
export const SCORE_METRICS: readonly string[] = [
  ...new Set(Object.values(BOSS_METRICS).flat()),
  ...CLUE_TIERS.map(clueMetric),
];
const SCORE_METRIC_SET = new Set(SCORE_METRICS);
export const isScoreMetric = (metric: string): boolean => SCORE_METRIC_SET.has(metric);

/**
 * The fewest kills or caskets the hiscores rank (Wise Old Man's minimumValue):
 * below it a boss or tier comes back unranked and its count is unknown.
 */
export const scoreMinimum = (metric: string): number =>
  metric.startsWith('clue_scrolls_') || metric === 'mimic' || metric === 'tzkal_zuk' ? 1 : 5;

export type { SyncScores };

/** One reading of a metric: its count, 'unranked' (below the minimum), or null when absent. */
export type ScoreReading = number | 'unranked' | null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Wise Old Man's snapshot `bosses` (kills) and `activities` (score) as one reading per metric. */
export const readScores = (snapshot: unknown): Record<string, ScoreReading> => {
  const data = isRecord(snapshot) ? snapshot : {};
  const bosses = isRecord(data.bosses) ? data.bosses : {};
  const activities = isRecord(data.activities) ? data.activities : {};
  const out: Record<string, ScoreReading> = {};
  for (const metric of SCORE_METRICS) {
    const entry = metric.startsWith('clue_scrolls_') ? activities[metric] : bosses[metric];
    if (!isRecord(entry)) { out[metric] = null; continue; }
    const value = metric.startsWith('clue_scrolls_') ? entry.score : entry.kills;
    if (typeof value !== 'number' || !Number.isFinite(value)) { out[metric] = null; continue; }
    out[metric] = value < 0 ? 'unranked' : Math.floor(value);
  }
  return out;
};

/**
 * A reading as a baseline: an unranked boss or tier counts as the most it
 * could be (one below the minimum), so later kills never pay out ones the
 * account already had. Absent stays unknown until a reading reports it.
 */
export const baselineScores = (reading: Readonly<Record<string, ScoreReading>>): Record<string, number | null> =>
  Object.fromEntries(SCORE_METRICS.map(metric => {
    const value = reading[metric];
    return [metric, typeof value === 'number' ? value : value === 'unranked' ? scoreMinimum(metric) - 1 : null];
  }));

export { recordScores } from './syncScores';

/** One batch of rolls: a boss (Vanilla, Chunked), a boss tier (other modes) or a clue tier. */
export interface ActivitySyncItem {
  kind: 'boss' | 'clue';
  /** Who the rolls are shown as. */
  label: string;
  source: string;
  /** The base rate rollForKey takes (the roll adds boosts; stashes set their own). */
  rate: number;
  context?: KeyRollContext;
  /** New kills or caskets since the baseline. */
  gained: number;
  /** Of those, already rolled since the baseline (Farm Keys, RuneLite, an earlier sync). */
  rolled: number;
  /** Rolls this sync makes. */
  count: number;
  /** Why the new ones don't roll: a boss the run hasn't unlocked. */
  hold?: 'locked';
}

const gainOf = (
  metrics: readonly string[],
  baseline: Readonly<Record<string, number | null>>,
  reading: Readonly<Record<string, ScoreReading>>,
): number => metrics.reduce((sum, metric) => {
  const now = reading[metric];
  const then = baseline[metric];
  return typeof now === 'number' && typeof then === 'number' && now > then ? sum + (now - then) : sum;
}, 0);

type RollCounter = (match: (entry: LogEntry) => boolean) => number;

/**
 * What Sync & Roll rolls for kills and caskets. `reserves`: Vanilla and
 * Chunked roll each unlocked boss from its own stash (`bosses` lists them);
 * other modes roll every boss at its tier's rate, counted per tier. Clues
 * roll in every mode, with Vanilla's clue context. A boss whose stash is spent
 * is the roll's to skip (rollForKey rolls nothing then).
 */
export const planActivitySync = (input: {
  scores: SyncScores | undefined;
  linkedAccount: string | undefined;
  reading: Readonly<Record<string, ScoreReading>>;
  history: readonly LogEntry[];
  gameModeId: GameState['gameModeId'];
  reserves: boolean;
  /** Reserve modes: the bosses that roll now (Farm Keys' list). */
  bosses: readonly string[];
}): ActivitySyncItem[] => {
  const { scores, linkedAccount, reading, history, gameModeId, reserves } = input;
  if (!scores || !linkedAccount || normalizeAccountName(scores.account) !== normalizeAccountName(linkedAccount)) return [];
  const since = scores.takenAt;
  const rolls: RollCounter = match => {
    let n = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      if (entry.timestamp < since) break;
      if (isRollEntry(entry) && match(entry)) n++;
    }
    return n;
  };
  const item = (base: Omit<ActivitySyncItem, 'count'>): ActivitySyncItem =>
    ({ ...base, count: base.hold ? 0 : Math.max(0, base.gained - base.rolled) });
  const out: ActivitySyncItem[] = [];

  if (reserves) {
    const rolling = new Set(input.bosses);
    for (const [name, metrics] of Object.entries(BOSS_METRICS)) {
      const gained = gainOf(metrics, scores.scores, reading);
      if (gained <= 0) continue;
      const bossClass = name === BRUTUS_BOSS_NAME ? 'brutus' as const : bossTier(name);
      const source = bossClass === 'brutus' ? TIER_SOURCE.low : TIER_SOURCE[bossClass];
      out.push(item({
        kind: 'boss', label: name, source, rate: DROP_RATES[source] ?? 0,
        context: { kind: 'boss', bossName: name, bossClass },
        gained,
        rolled: rolls(entry => entry.meta?.bossName === name),
        hold: rolling.has(name) ? undefined : 'locked',
      }));
    }
  } else {
    const byTier = new Map<BossTier, number>();
    for (const name of BOSSES_LIST) {
      const metrics = BOSS_METRICS[name];
      if (!metrics) continue;
      const gained = gainOf(metrics, scores.scores, reading);
      if (gained > 0) byTier.set(bossTier(name), (byTier.get(bossTier(name)) ?? 0) + gained);
    }
    for (const tier of TIER_ORDER) {
      const gained = byTier.get(tier) ?? 0;
      if (gained <= 0) continue;
      const source = TIER_SOURCE[tier];
      out.push(item({
        kind: 'boss', label: `${TIER_LABEL[tier]}-tier boss kills`, source, rate: DROP_RATES[source] ?? 0,
        gained, rolled: rolls(entry => entry.source === source),
      }));
    }
  }

  for (const tier of CLUE_TIERS) {
    const gained = gainOf([clueMetric(tier)], scores.scores, reading);
    if (gained <= 0) continue;
    const source = CLUE_SOURCE[tier];
    out.push(item({
      kind: 'clue', label: `${tier} clues`, source, rate: DROP_RATES[source] ?? 0,
      context: gameModeId === 'vanilla' ? { kind: 'clue', clueTier: tier } : undefined,
      gained, rolled: rolls(entry => entry.source === source),
    }));
  }
  return out;
};
