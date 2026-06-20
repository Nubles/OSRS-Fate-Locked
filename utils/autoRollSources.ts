// Auto-Roll key faucets (PROTOTYPE)
// ─────────────────────────────────
// Turns a Wise Old Man activity/boss snapshot into the app's repeatable
// key-roll faucets, so "auto-roll" can roll keys you'd have earned from your
// real PvM / clue / minigame history — not just skill levels.
//
// Real counts can be enormous (10k+ KC), and the whole game is about the RNG
// faucet, so each source's rolls are CAPPED. This keeps the awarded keys sane
// and the number of dispatched rolls bounded.

import { DropSource } from '../types';
import { DROP_RATES } from '../config/rules';
import { BOSS_TIERS, TIER_SOURCE, TIER_LABEL, type BossTier } from '../data/bossKeyTiers';

/** How many rolls a single faucet group is allowed to contribute. */
export const DEFAULT_ROLL_CAP = 20;

export interface FaucetGroup {
  key: string;
  label: string;
  source: DropSource;
  /** Base success % for this source. */
  rate: number;
  /** Real completions reported by the hiscores. */
  real: number;
  /** Capped number of rolls auto-roll will actually perform. */
  rolls: number;
}

// WOM boss metrics whose name doesn't normalise cleanly to a BOSS_TIERS key.
const BOSS_ALIAS: Record<string, string> = {
  barrows_chests: 'Barrows Brothers',
  calvarion: "Calvar'ion",
  chambers_of_xeric_challenge_mode: 'Chambers of Xeric',
  dagannoth_prime: 'Dagannoth Kings',
  dagannoth_rex: 'Dagannoth Kings',
  dagannoth_supreme: 'Dagannoth Kings',
  kreearra: "Kree'arra",
  kril_tsutsaroth: "K'ril Tsutsaroth",
  nightmare: 'The Nightmare',
  phosanis_nightmare: "Phosani's Nightmare",
  sol_heredit: 'Fortis Colosseum',
  the_corrupted_gauntlet: 'The Gauntlet',
  theatre_of_blood_hard_mode: 'Theatre of Blood',
  tombs_of_amascut_expert: 'Tombs of Amascut',
  tzkal_zuk: 'Inferno',
  tztok_jad: 'TzHaar Fight Cave',
  vetion: "Vet'ion",
};

const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// BOSS_TIERS key indexed by its alphanumeric-lowercased form, for fuzzy matching.
const BOSS_BY_ALNUM = new Map(Object.keys(BOSS_TIERS).map(name => [alnum(name), name]));

/** WOM boss metric → its key tier (or null if we can't classify it). */
export function bossTierForMetric(metric: string): BossTier | null {
  const appName = BOSS_ALIAS[metric] ?? BOSS_BY_ALNUM.get(alnum(metric));
  return appName ? BOSS_TIERS[appName] ?? null : null;
}

// WOM clue activity metric → its key source.
const CLUE_SOURCE: Record<string, DropSource> = {
  clue_scrolls_beginner: DropSource.CLUE_BEGINNER,
  clue_scrolls_easy: DropSource.CLUE_EASY,
  clue_scrolls_medium: DropSource.CLUE_MEDIUM,
  clue_scrolls_hard: DropSource.CLUE_HARD,
  clue_scrolls_elite: DropSource.CLUE_ELITE,
  clue_scrolls_master: DropSource.CLUE_MASTER,
};
const CLUE_LABEL: Record<string, string> = {
  clue_scrolls_beginner: 'Beginner clues',
  clue_scrolls_easy: 'Easy clues',
  clue_scrolls_medium: 'Medium clues',
  clue_scrolls_hard: 'Hard clues',
  clue_scrolls_elite: 'Elite clues',
  clue_scrolls_master: 'Master clues',
};

// WOM minigame/activity metrics we treat as repeatable minigame "plays".
const MINIGAME_METRICS = ['last_man_standing', 'soul_wars_zeal', 'guardians_of_the_rift', 'pvp_arena'];

interface WomEntry { kills?: number; score?: number }
type WomTable = Record<string, WomEntry>;

const count = (e?: WomEntry) => {
  const v = e?.kills ?? e?.score ?? 0;
  return v > 0 ? v : 0; // WOM uses -1 for "unranked / no data"
};

/**
 * Build the capped key-roll faucets from a WOM snapshot's bosses + activities.
 * Only groups with at least one real completion are returned.
 */
export function buildKeyFaucets(
  bosses: WomTable | undefined,
  activities: WomTable | undefined,
  cap: number = DEFAULT_ROLL_CAP,
): FaucetGroup[] {
  const groups: FaucetGroup[] = [];
  const clamp = (real: number) => Math.max(0, Math.min(real, cap));

  // ── Bosses → tier buckets ─────────────────────────────────────────────────
  const tierKills: Record<BossTier, number> = { low: 0, mid: 0, high: 0, raid: 0 };
  for (const [metric, entry] of Object.entries(bosses ?? {})) {
    const n = count(entry);
    if (!n) continue;
    const tier = bossTierForMetric(metric);
    if (tier) tierKills[tier] += n;
  }
  for (const tier of ['raid', 'high', 'mid', 'low'] as BossTier[]) {
    const real = tierKills[tier];
    if (real <= 0) continue;
    const source = TIER_SOURCE[tier];
    groups.push({
      key: `boss-${tier}`,
      label: `${TIER_LABEL[tier]}${tier === 'raid' ? ' completions' : '-tier boss kills'}`,
      source,
      rate: DROP_RATES[source] ?? 0,
      real,
      rolls: clamp(real),
    });
  }

  // ── Clues → per-tier sources ──────────────────────────────────────────────
  for (const metric of Object.keys(CLUE_SOURCE)) {
    const real = count(activities?.[metric]);
    if (real <= 0) continue;
    const source = CLUE_SOURCE[metric];
    groups.push({
      key: metric,
      label: CLUE_LABEL[metric],
      source,
      rate: DROP_RATES[source] ?? 0,
      real,
      rolls: clamp(real),
    });
  }

  // ── Minigames → one aggregate bucket ──────────────────────────────────────
  const miniReal = MINIGAME_METRICS.reduce((a, m) => a + count(activities?.[m]), 0);
  if (miniReal > 0) {
    groups.push({
      key: 'minigames',
      label: 'Minigames',
      source: DropSource.ACTIVITY_MINIGAME,
      rate: DROP_RATES[DropSource.ACTIVITY_MINIGAME] ?? 0,
      real: miniReal,
      rolls: clamp(miniReal),
    });
  }

  return groups;
}
