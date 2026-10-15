import type { GameModeRules } from '../config/gameModes';
/**
 * Achievements & milestones engine.
 *
 * A pure, side-effect-free catalogue of run milestones plus an evaluator that
 * scores each one against a run: its `unlocks`, and for the roll, ritual and
 * pet milestones its history and claimed pets. The UI (modal + celebratory
 * reveal) is a thin layer over `evaluateAchievements`.
 *
 * Each achievement exposes a `progress(context) -> { current, target }` so the
 * same definition drives both the earned/locked state AND a progress bar for
 * the ones still in flight. Its reward (Fate, a free Ritual of Clarity, and
 * always its title) is paid once, by the SETTLE_ACHIEVEMENTS reducer case.
 */

import { LogEntry, TableType, UnlockState } from '../types';
import {
  SKILLS_LIST, REGIONS_LIST, EQUIPMENT_SLOTS, EQUIPMENT_TIER_MAX,
} from '../constants';
import { completionPercent } from './completion';
import { QUEST_DATA, QUEST_CAPE_QUEST_IDS } from '../data/questData';
import { DIARY_DATA } from '../data/diaryData';
import { CA_DATA } from '../data/caData';
import { PETS } from '../data/pets';
import { BANK_IDS, MERGED_BANKS } from '../data/banks';
import { BARROWS_BROTHERS, INVOCATIONS, PACT_DEBT, RITUALS } from '../config/economy';
import { isAreaReachable, bankLocksActive } from './reachability';
import { unlockableAreas } from './freeAreas';
import { getPoolAndStateKey } from './gameEngine';
import { isRollEntry } from './logEntry';
import { mergedBankId } from './bankUnlockMerges';
import { AchievementPayout, rewardLabel } from './achievementRewards';

export type AchievementCategory =
  | 'Quests' | 'Skills' | 'Areas' | 'Equipment'
  | 'Diaries' | 'Combat' | 'Activities' | 'Collection'
  | 'Fate' | 'Void Altar' | 'Unlocks' | 'Pets' | 'Mastery';

export type AchievementIcon =
  | 'quest' | 'skill' | 'region' | 'equipment' | 'diary'
  | 'combat' | 'boss' | 'minigame' | 'collection' | 'trophy'
  | 'crown' | 'star' | 'map' | 'sparkles' | 'flame'
  | 'key' | 'chaos' | 'altar' | 'pet' | 'mobility' | 'arcana'
  | 'housing' | 'merchant' | 'storage' | 'guild' | 'farming'
  | 'slayer' | 'bank';

/** What a run has to show for itself. Only `unlocks` is required. */
export interface AchievementRun {
  unlocks: UnlockState;
  gameModeId?: string;
  customMode?: GameModeRules;
  history?: readonly LogEntry[];
  petsClaimed?: readonly number[];
  /**
   * Achievements already settled (GameState.achievementsClaimed). They stay
   * earned even when the run later drops below them, e.g. after a Sacrifice.
   */
  claimed?: readonly string[];
}

/** One evaluation's view of the run: the run itself plus its history summary, worked out once. */
export interface AchievementContext {
  u: UnlockState;
  mode?: string;
  custom?: GameModeRules;
  petsClaimed: readonly number[];
  stats: RunStats;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  icon: AchievementIcon;
  /** Fate Points paid when it is earned (0: the title is the reward). */
  fate: number;
  /** Free Rituals of Clarity paid when it is earned. */
  clarity: number;
  /** Shown as ??? until earned. */
  hidden?: boolean;
  /** False when the run's mode can't earn it; it is then left out. */
  available?: (c: AchievementContext) => boolean;
  /** Current/target progress for this run. Earned when current >= target. */
  progress: (c: AchievementContext) => { current: number; target: number };
}

export interface EvaluatedAchievement extends Achievement {
  current: number;
  target: number;
  earned: boolean;
  /** 0..100 capped. */
  pct: number;
}

// ── Totals (derived once from the data sets) ───────────────────────────────
const TOTAL_QUESTS = QUEST_CAPE_QUEST_IDS.length;
const TOTAL_DIARIES = Object.keys(DIARY_DATA).length;
const TOTAL_CA = Object.keys(CA_DATA).length;
const TOTAL_SKILLS = SKILLS_LIST.length;
const TOTAL_REGIONS = REGIONS_LIST.length;
const TOTAL_EQUIP_SLOTS = EQUIPMENT_SLOTS.length;
const TOTAL_PETS = PETS.length;
const ROLLABLE_BANKS: readonly string[] = BANK_IDS.filter((id) => !Object.hasOwn(MERGED_BANKS, id));
const ROLLABLE_BANK_SET = new Set(ROLLABLE_BANKS);

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const count = (n: unknown): number => (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0);

// ── Run history summary ────────────────────────────────────────────────────
export interface RunStats {
  rolls: number;
  keysWon: number;
  longestWinStreak: number;
  longestMissStreak: number;
  /** Lowest chance (0..1) of any winning roll; 1 when none recorded. */
  luckiestWin: number;
  omniRolls: number;
  pityKeys: number;
  chaosKeys: number;
  greedDoubled: boolean;
  rituals: ReadonlySet<string>;
  gambitWins: number;
  biggestGambitWin: number;
  longestGambitLosingRun: number;
  /** Keys Saradomin's Ward steered onto something usable. */
  wardKeys: number;
  /** Fate paid to Zamorak's Blood Debt. */
  pactDebtPaid: number;
  /** Whether Amascut's Invocations were ever cast with every handicap. */
  allInvocations: boolean;
  /** Barrows brothers the Barrows Chest has drawn. */
  barrowsBrothers: ReadonlySet<string>;
}

/** Which ritual an Altar entry was. Old entries carry no id, so their message says (as in utils/integrity). */
const ritualOf = (e: LogEntry): string | null => {
  const id = e.meta?.ritual;
  if (typeof id === 'string') return id;
  if (/Clarity/.test(e.message)) return 'LUCK';
  if (/Greed/.test(e.message)) return 'GREED';
  if (/Chaos/.test(e.message)) return 'CHAOS';
  if (/Transmut/.test(e.message)) return 'TRANSMUTE';
  if (/Void Gambit/.test(e.message)) return 'GAMBIT';
  if (/Cartographer/.test(e.message)) return 'CARTOGRAPHER';
  return null;
};

export const runStats = (history: readonly LogEntry[] = []): RunStats => {
  let rolls = 0, keysWon = 0, winStreak = 0, missStreak = 0, longestWinStreak = 0, longestMissStreak = 0;
  let luckiestWin = 1, omniRolls = 0, pityKeys = 0, chaosKeys = 0, greedDoubled = false;
  let gambitWins = 0, biggestGambitWin = 0, gambitLosses = 0, longestGambitLosingRun = 0;
  let wardKeys = 0, pactDebtPaid = 0, allInvocations = false;
  const rituals = new Set<string>();
  const barrowsBrothers = new Set<string>();
  for (const e of history) {
    const chaos = e.meta?.chaosKeysAwarded;
    if (typeof chaos === 'number') chaosKeys += count(chaos);
    else if (e.type === 'LEVEL_UP' && /Chaos Key Drop/.test(e.message)) chaosKeys += 1;

    if (e.meta?.ward === true) wardKeys += 1;
    if (isRollEntry(e)) {
      rolls += 1;
      pactDebtPaid += count(e.meta?.debtPaid);
      const won = e.type === 'ROLL_SUCCESS' || e.type === 'ROLL_OMNI';
      if (won) {
        winStreak += 1; missStreak = 0;
        const doubled = e.meta?.rewardKind === 'greed' || /\(Doubled\)/.test(e.message);
        if (doubled) greedDoubled = true;
        const awarded = e.meta?.standardKeysAwarded;
        keysWon += typeof awarded === 'number' ? count(awarded) : doubled ? 2 : 1;
        const chance = e.meta?.successProbability;
        // Verac's hit-through wins a roll that missed its odds, so it isn't luck at those odds.
        const hitThrough = typeof e.meta?.roll === 'number' && typeof e.meta?.threshold === 'number' && e.meta.roll > e.meta.threshold;
        if (typeof chance === 'number' && chance > 0 && chance < luckiestWin && !hitThrough) luckiestWin = chance;
        if (e.type === 'ROLL_OMNI') omniRolls += 1;
      } else {
        missStreak += 1; winStreak = 0;
        if (e.type === 'PITY') pityKeys += 1;
      }
      longestWinStreak = Math.max(longestWinStreak, winStreak);
      longestMissStreak = Math.max(longestMissStreak, missStreak);
    } else if (e.type === 'ALTAR') {
      const ritual = ritualOf(e);
      if (!ritual) continue;
      rituals.add(ritual);
      const invoked = e.meta?.invocations;
      if (ritual === 'INVOCATIONS' && Array.isArray(invoked) && new Set(invoked).size >= INVOCATIONS.length) allInvocations = true;
      if (ritual === 'BARROWS' && typeof e.meta?.brother === 'string') barrowsBrothers.add(e.meta.brother);
      if (ritual === 'CHAOS' && typeof chaos !== 'number') chaosKeys += 1;
      if (ritual === 'GAMBIT') {
        const keys = typeof e.meta?.keysAwarded === 'number'
          ? count(e.meta.keysAwarded)
          : Number(e.message.match(/WON.*?([0-9]+) Key/)?.[1] ?? 0);
        if (keys > 0) {
          gambitWins += 1; gambitLosses = 0;
          biggestGambitWin = Math.max(biggestGambitWin, keys);
        } else {
          gambitLosses += 1;
          longestGambitLosingRun = Math.max(longestGambitLosingRun, gambitLosses);
        }
      }
    }
  }
  return {
    rolls, keysWon, longestWinStreak, longestMissStreak, luckiestWin, omniRolls, pityKeys,
    chaosKeys, greedDoubled, rituals, gambitWins, biggestGambitWin, longestGambitLosingRun,
    wardKeys, pactDebtPaid, allInvocations, barrowsBrothers,
  };
};

// ── Metric helpers ─────────────────────────────────────────────────────────
type Metric = (c: AchievementContext) => number;
const questsDone: Metric = ({ u }) => QUEST_CAPE_QUEST_IDS.filter(id => u.quests.includes(id)).length;
const questPoints: Metric = ({ u }) =>
  QUEST_CAPE_QUEST_IDS.filter(id => u.quests.includes(id)).reduce((acc, qid) => acc + (QUEST_DATA[qid]?.points ?? 0), 0);
const skillsStarted: Metric = ({ u }) => Object.values(u.skills).filter((t) => t > 0).length;
// Every run starts with Hitpoints at tier 1, so only a skill a Key opened counts.
const skillsRolled: Metric = ({ u }) =>
  Object.entries(u.skills).filter(([skill, tier]) => tier > (skill === 'Hitpoints' ? 1 : 0)).length;
const skillTiers: Metric = ({ u }) => sum(Object.values(u.skills));
const totalLevel: Metric = ({ u }) => sum(SKILLS_LIST.map((s) => u.levels[s] ?? 1));
const skillsAt99: Metric = ({ u }) => Object.values(u.levels).filter((l) => l >= 99).length;
const equipUnlocked: Metric = ({ u }) => EQUIPMENT_SLOTS.filter((s) => (u.equipment[s] || 0) > 0).length;
const equipAtLeast = (tier: number): Metric => ({ u }) => EQUIPMENT_SLOTS.filter((s) => (u.equipment[s] || 0) >= tier).length;
const collectionItems: Metric = ({ u }) => Object.values(u.collectionLog || {}).filter((c) => c > 0).length;
// Areas the run has opened, by the same reachability check as the map, so
// Chunked runs (which never fill `regions`) count the areas their chunks reach.
const areasReached: Metric = ({ u, mode, custom }) =>
  unlockableAreas(mode, custom).filter((area) => isAreaReachable(area, u, mode)).length;

/** A table's rollable pool in the run's mode, and how much of it the run owns. */
const tablePool = (table: TableType, c: AchievementContext): readonly string[] =>
  table === TableType.BANKS ? ROLLABLE_BANKS : getPoolAndStateKey(table, c.mode, c.custom).pool;
const tableOwned = (table: TableType, owned: (u: UnlockState) => readonly string[] | undefined): Metric => (c) => {
  if (table === TableType.BANKS) {
    return new Set((owned(c.u) ?? []).map(mergedBankId).filter((id) => ROLLABLE_BANK_SET.has(id))).size;
  }
  const pool = new Set(tablePool(table, c));
  return new Set((owned(c.u) ?? []).filter((item) => pool.has(item))).size;
};

/** Completion % — the single shared metric (utils/completion), re-exported. */
export { completionPercent };

// ── Builders ───────────────────────────────────────────────────────────────
interface Step {
  title: string;
  description: string;
  target: number;
  icon?: AchievementIcon;
  fate?: number;
  clarity?: number;
  hidden?: boolean;
  /** Overrides the default `${baseId}-${target}` id. */
  id?: string;
  /** A target that depends on the run's mode; `target` still names the id. */
  targetFor?: (c: AchievementContext) => number;
  available?: (c: AchievementContext) => boolean;
}

function tiers(
  baseId: string,
  category: AchievementCategory,
  defaultIcon: AchievementIcon,
  metric: Metric,
  steps: Step[],
): Achievement[] {
  return steps.map((s) => ({
    id: s.id ?? `${baseId}-${s.target}`,
    title: s.title,
    description: s.description,
    category,
    icon: s.icon ?? defaultIcon,
    fate: s.fate ?? 0,
    clarity: s.clarity ?? 0,
    ...(s.hidden ? { hidden: true } : {}),
    ...(s.available ? { available: s.available } : {}),
    progress: (c: AchievementContext) => ({
      current: metric(c),
      target: s.targetFor?.(c) ?? s.target,
    }),
  }));
}

/** A yes/no milestone. */
const once = (
  id: string, category: AchievementCategory, icon: AchievementIcon, title: string, description: string,
  done: (c: AchievementContext) => boolean, extra: Omit<Step, 'title' | 'description' | 'target'> = {},
): Achievement => tiers(id, category, icon, (c) => (done(c) ? 1 : 0), [{ ...extra, id, title, description, target: 1 }])[0];

/** A first-and-all pair for one unlock table. */
function table(
  key: string, tableType: TableType, icon: AchievementIcon, owned: (u: UnlockState) => readonly string[] | undefined,
  first: [string, string], all: [string, string], allFate = 10,
  available?: (c: AchievementContext) => boolean,
): Achievement[] {
  const has = (c: AchievementContext) => tablePool(tableType, c).length > 0 && (available?.(c) ?? true);
  return tiers(key, 'Unlocks', icon, tableOwned(tableType, owned), [
    { id: `${key}-first`, title: first[0], description: first[1], target: 1, available: has },
    { id: `${key}-all`, title: all[0], description: all[1], target: 1, fate: allFate, available: has, targetFor: (c) => tablePool(tableType, c).length },
  ]);
}

const ritualOffered = (id: string, c: AchievementContext) => {
  const ritual = RITUALS.find((r) => r.id === id);
  return !!ritual && (!ritual.chunkedOnly || c.mode === 'chunked');
};
const didRitual = (id: string) => (c: AchievementContext) => c.stats.rituals.has(id);
// Void Priest leaves out Sacrifice: an achievement shouldn't ask a run to give up its own unlocks.
const ritualsOffered = (c: AchievementContext) => RITUALS.filter((r) => r.id !== 'SACRIFICE' && ritualOffered(r.id, c));

// ── The catalogue ──────────────────────────────────────────────────────────
// Fate rewards: 0 for first steps (the title is the reward), 5, 10 or 25 by
// difficulty, and 25 with a free Ritual of Clarity for the biggest few.
export const ACHIEVEMENTS: Achievement[] = [
  // Quests
  ...tiers('quests', 'Quests', 'quest', questsDone, [
    { title: 'First Steps', description: 'Complete your first quest', target: 1 },
    { title: 'Adventurer', description: 'Complete 10 quests', target: 10, fate: 5 },
    { title: 'Seasoned Hero', description: 'Complete 25 quests', target: 25, fate: 5 },
    { title: 'Veteran', description: 'Complete 50 quests', target: 50, fate: 10 },
    { title: 'Centurion', description: 'Complete 100 quests', target: 100, fate: 10 },
    { title: 'Loremaster', description: 'Complete 150 quests', target: 150, fate: 25 },
    { title: 'Quest Cape', description: 'Complete every quest', target: TOTAL_QUESTS, icon: 'crown', fate: 25, clarity: 1 },
  ]),
  ...tiers('qp', 'Quests', 'star', questPoints, [
    { title: "Champions' Guild", description: "Earn 32 Quest Points, enough to enter the Champions' Guild", target: 32 },
    { title: 'Point Collector', description: 'Earn 50 Quest Points', target: 50, fate: 5 },
    { title: "Legends' Guild", description: "Earn 107 Quest Points, enough for the Legends' Guild", target: 107, fate: 5 },
    { title: 'Point Hoarder', description: 'Earn 150 Quest Points', target: 150, fate: 10 },
    { title: 'Sage', description: 'Earn 250 Quest Points', target: 250, fate: 25 },
  ]),

  // Skills
  ...tiers('skills-start', 'Skills', 'skill', skillsRolled, [
    { title: 'Apprentice', description: 'Unlock a skill with a Key', target: 1 },
  ]),
  ...tiers('skills-start', 'Skills', 'skill', skillsStarted, [
    { title: 'Dabbler', description: 'Have 5 skills unlocked', target: 5 },
    { title: 'All-Rounder', description: 'Have 12 skills unlocked', target: 12, fate: 5 },
    { title: 'Polymath', description: 'Unlock every skill', target: TOTAL_SKILLS, fate: 10 },
  ]),
  ...tiers('total-level', 'Skills', 'skill', totalLevel, [
    { title: 'Well Rounded', description: 'Reach 500 total level', target: 500, fate: 5 },
    { title: 'Four Figures', description: 'Reach 1,000 total level', target: 1000, fate: 10 },
    { title: 'Skiller', description: 'Reach 1,500 total level', target: 1500, fate: 10 },
    { title: 'Two Thousand Club', description: 'Reach 2,000 total level', target: 2000, fate: 25 },
  ]),
  ...tiers('skill-tiers', 'Skills', 'flame', skillTiers, [
    { title: 'Tier Climber', description: 'Reach 50 total skill tiers', target: 50, fate: 5 },
    { title: 'Tier Scaler', description: 'Reach 100 total skill tiers', target: 100, fate: 10 },
    { title: 'High Tiers', description: 'Reach 150 total skill tiers', target: 150, fate: 10 },
    { title: 'Uncapped', description: 'Get every skill to tier 10', target: TOTAL_SKILLS * 10, fate: 25 },
  ]),
  ...tiers('skills-99', 'Skills', 'crown', skillsAt99, [
    { title: 'Ninety-Nine', description: 'Reach level 99 in any skill', target: 1, fate: 10 },
    { title: 'Maxed', description: 'Reach level 99 in every skill', target: TOTAL_SKILLS, icon: 'trophy', fate: 25, clarity: 1 },
  ]),

  // Areas (the ids keep their old 'regions' prefix, so earned achievements stay earned)
  ...tiers('regions', 'Areas', 'region', areasReached, [
    { title: 'Explorer', description: 'Unlock your first area', target: 1 },
    { title: 'Globetrotter', description: 'Unlock 5 areas', target: 5 },
    { title: 'Wanderer', description: 'Unlock 10 areas', target: 10, fate: 5 },
    { title: 'Traveller', description: 'Unlock 25 areas', target: 25, fate: 5 },
    { title: 'Voyager', description: 'Unlock 50 areas', target: 50, fate: 10 },
    { title: 'Far Flung', description: 'Unlock 100 areas', target: 100, fate: 10 },
    {
      title: 'World Tour', description: 'Unlock every area', target: TOTAL_REGIONS, icon: 'map', fate: 25, clarity: 1,
      targetFor: (c) => unlockableAreas(c.mode, c.custom).length,
    },
  ]),

  // Equipment
  ...tiers('equip-unlock', 'Equipment', 'equipment', equipUnlocked, [
    { title: 'Geared Up', description: 'Unlock your first equipment slot', target: 1 },
    { title: 'Fully Equipped', description: 'Unlock every equipment slot', target: TOTAL_EQUIP_SLOTS, fate: 5 },
  ]),
  ...tiers('equip-tier5', 'Equipment', 'equipment', equipAtLeast(5), [
    { title: 'Rune Set', description: 'Get every equipment slot to tier 5', target: TOTAL_EQUIP_SLOTS, fate: 10, id: 'equip-tier5-all' },
  ]),
  ...tiers('equip-max', 'Equipment', 'equipment', equipAtLeast(EQUIPMENT_TIER_MAX), [
    { title: 'Best in Slot', description: `Max a slot to Tier ${EQUIPMENT_TIER_MAX}`, target: 1, icon: 'star', fate: 10 },
    { title: 'Maxed Gear', description: 'Max every equipment slot', target: TOTAL_EQUIP_SLOTS, icon: 'trophy', fate: 25 },
  ]),

  // Diaries
  ...tiers('diaries', 'Diaries', 'diary', ({ u }) => u.diaries.length, [
    { title: 'Diary Keeper', description: 'Complete your first diary tier', target: 1 },
    { title: 'Diarist', description: 'Complete 12 diary tiers', target: 12, fate: 10 },
    { title: 'Chronicler', description: 'Complete 24 diary tiers', target: 24, fate: 10 },
    { title: 'Diary Master', description: 'Complete every diary tier', target: TOTAL_DIARIES, icon: 'crown', fate: 25, clarity: 1 },
  ]),

  // Combat Achievements
  ...tiers('ca', 'Combat', 'combat', ({ u }) => u.cas.length, [
    { title: 'Combat Novice', description: 'Complete your first CA tier', target: 1, fate: 5 },
    { title: 'Combat Master', description: 'Complete every CA tier', target: TOTAL_CA, icon: 'trophy', fate: 25, clarity: 1 },
  ]),

  // Activities
  ...tiers('bosses', 'Activities', 'boss', tableOwned(TableType.BOSSES, (u) => u.bosses), [
    { title: 'Boss Hunter', description: 'Unlock your first boss', target: 1 },
    { title: 'Boss Slayer', description: 'Unlock 10 bosses', target: 10, fate: 5 },
    { title: 'Headhunter', description: 'Unlock 25 bosses', target: 25, fate: 10 },
    { title: 'Bane of Bosses', description: 'Unlock 50 bosses', target: 50, fate: 10 },
    {
      id: 'bosses-all', title: 'Every Boss', description: 'Unlock every boss', target: 1, icon: 'crown', fate: 25, clarity: 1,
      targetFor: (c) => tablePool(TableType.BOSSES, c).length,
    },
  ]),
  ...tiers('minigames', 'Activities', 'minigame', tableOwned(TableType.MINIGAMES, (u) => u.minigames), [
    { title: 'Minigamer', description: 'Unlock your first minigame', target: 1 },
    { title: 'Game Night', description: 'Unlock 5 minigames', target: 5, fate: 5 },
    { title: 'Regular Player', description: 'Unlock 15 minigames', target: 15, fate: 10 },
    {
      id: 'minigames-all', title: 'Minigame Master', description: 'Unlock every minigame', target: 1, icon: 'crown', fate: 25,
      targetFor: (c) => tablePool(TableType.MINIGAMES, c).length,
    },
  ]),

  // Collection log
  ...tiers('collection', 'Collection', 'collection', collectionItems, [
    { title: 'Collector', description: 'Log your first collection item', target: 1 },
    { title: 'Hoarder', description: 'Log 25 collection items', target: 25 },
    { title: 'Curio Keeper', description: 'Log 100 collection items', target: 100, fate: 5 },
    { title: 'Archivist', description: 'Log 250 collection items', target: 250, fate: 10 },
    { title: 'Curator', description: 'Log 500 collection items', target: 500, fate: 10 },
    { title: 'Museum Piece', description: 'Log 1,000 collection items', target: 1000, fate: 25 },
  ]),

  // Fate: Key rolls, read from the run's history
  ...tiers('rolls', 'Fate', 'key', ({ stats }) => stats.rolls, [
    { title: 'Tempt Fate', description: 'Make your first Key roll', target: 1 },
    { title: 'Regular', description: 'Make 100 Key rolls', target: 100 },
    { title: 'Devotee', description: 'Make 1,000 Key rolls', target: 1000, fate: 5 },
    { title: 'Zealot', description: 'Make 2,500 Key rolls', target: 2500, fate: 5 },
    { title: 'Fate-Bound', description: 'Make 4,000 Key rolls', target: 4000, fate: 10 },
    { title: "Fate's Chosen", description: 'Make 7,500 Key rolls', target: 7500, fate: 10 },
  ]),
  ...tiers('keys-won', 'Fate', 'key', ({ stats }) => stats.keysWon, [
    { title: 'Key Ring', description: 'Win 10 Keys from rolls', target: 10 },
    { title: 'Key Chain', description: 'Win 50 Keys from rolls', target: 50, fate: 5 },
    { title: 'Keymaster', description: 'Win 250 Keys from rolls', target: 250, fate: 5 },
    { title: 'Locksmith', description: 'Win 500 Keys from rolls', target: 500, fate: 10 },
    { title: 'Gatekeeper', description: 'Win 1,000 Keys from rolls', target: 1000, fate: 10 },
  ]),
  ...tiers('win-streak', 'Fate', 'flame', ({ stats }) => stats.longestWinStreak, [
    { title: 'Lightning Strikes Twice', description: 'Win two Key rolls in a row', target: 2, fate: 5 },
    { title: 'Hat-trick', description: 'Win three Key rolls in a row', target: 3, fate: 5 },
    { title: 'On a Roll', description: 'Win five Key rolls in a row', target: 5, fate: 10 },
    { title: "Fate's Favourite", description: 'Win eight Key rolls in a row', target: 8, fate: 10 },
  ]),
  once('roll-1pct', 'Fate', 'sparkles', 'One in a Hundred', 'Win a Key roll with a 1% chance or less',
    ({ stats }) => stats.luckiestWin <= 0.01, { fate: 10 }),
  once('roll-omni', 'Fate', 'sparkles', 'Omni!', 'Get an Omni-Key from a roll', ({ stats }) => stats.omniRolls > 0, { fate: 5 }),
  once('roll-pity', 'Fate', 'key', 'Patience Rewarded', 'Get a Pity Key', ({ stats }) => stats.pityKeys > 0),
  ...tiers('chaos-keys', 'Fate', 'chaos', ({ stats }) => stats.chaosKeys, [
    { title: 'Chaos Theory', description: 'Get your first Chaos Key', target: 1 },
    { title: 'Agent of Chaos', description: 'Get 100 Chaos Keys', target: 100, fate: 5 },
    { title: 'Avatar of Chaos', description: 'Get 200 Chaos Keys', target: 200, fate: 10 },
  ]),
  ...tiers('miss-streak', 'Fate', 'flame', ({ stats }) => stats.longestMissStreak, [
    { title: 'Unlucky', description: 'Miss 100 Key rolls in a row', target: 100 },
    { title: 'Cursed', description: 'Miss 200 Key rolls in a row', target: 200, fate: 10, hidden: true },
  ]),

  // The Void Altar
  once('ritual-any', 'Void Altar', 'altar', 'Void Initiate', 'Perform your first ritual', ({ stats }) => stats.rituals.size > 0),
  once('ritual-luck', 'Void Altar', 'altar', 'Clear Sight', 'Perform the Ritual of Clarity', didRitual('LUCK')),
  once('ritual-greed', 'Void Altar', 'altar', 'Double or Nothing', 'Get 2 Keys from the Ritual of Greed', ({ stats }) => stats.greedDoubled, { fate: 5 }),
  once('ritual-chaos', 'Void Altar', 'chaos', 'Chaos Bringer', 'Perform the Ritual of Chaos', didRitual('CHAOS')),
  once('ritual-transmute', 'Void Altar', 'sparkles', 'Transmuter', 'Turn 5 Keys into an Omni-Key', didRitual('TRANSMUTE')),
  once('ritual-gambit', 'Void Altar', 'altar', 'High Roller', 'Win a Void Gambit', ({ stats }) => stats.gambitWins > 0),
  once('ritual-gambit-3', 'Void Altar', 'altar', 'All In', 'Win 3 Keys or more from one Void Gambit', ({ stats }) => stats.biggestGambitWin >= 3, { fate: 10 }),
  once('ritual-cartographer', 'Void Altar', 'map', 'Map Maker', 'Choose a chunk with the Ritual of the Cartographer', didRitual('CARTOGRAPHER'),
    { available: (c) => ritualOffered('CARTOGRAPHER', c) }),
  once('ritual-ward', 'Void Altar', 'altar', 'Blessed', "Let Saradomin's Ward guide a Key", ({ stats }) => stats.wardKeys > 0),
  once('ritual-tears', 'Void Altar', 'altar', "Juna's Favour", 'Perform Tears of Guthix', didRitual('TEARS')),
  once('ritual-pact', 'Void Altar', 'altar', 'Debt Paid', "Pay Zamorak's Blood Debt in full", ({ stats }) => stats.pactDebtPaid >= PACT_DEBT),
  once('ritual-invocations', 'Void Altar', 'altar', 'Expert Mode', "Take all four of Amascut's Invocations at once", ({ stats }) => stats.allInvocations, { fate: 5 }),
  ...tiers('ritual-barrows', 'Void Altar', 'altar', ({ stats }) => stats.barrowsBrothers.size, [
    { id: 'ritual-barrows', title: 'Crypt Raider', description: 'Draw every brother from the Barrows Chest', target: BARROWS_BROTHERS.length, fate: 10 },
  ]),
  once('ritual-sacrifice', 'Void Altar', 'altar', "Fate's Offering", 'Make a Sacrifice', didRitual('SACRIFICE')),
  ...tiers('ritual-every', 'Void Altar', 'altar', (c) => ritualsOffered(c).filter((r) => c.stats.rituals.has(r.id)).length, [
    { id: 'ritual-every', title: 'Void Priest', description: 'Perform every ritual your mode offers, apart from Sacrifice', target: 1, fate: 10, targetFor: (c) => ritualsOffered(c).length },
  ]),
  ...tiers('gambit-losses', 'Void Altar', 'altar', ({ stats }) => stats.longestGambitLosingRun, [
    { title: "Gambler's Ruin", description: 'Lose 8 Void Gambits in a row', target: 8, fate: 10, hidden: true },
  ]),

  // The other unlock tables
  ...table('mobility', TableType.MOBILITY, 'mobility', (u) => u.mobility,
    ['Going Places', 'Unlock your first Mobility entry'], ['Well Travelled', 'Unlock every Mobility entry']),
  ...table('arcana', TableType.ARCANA, 'arcana', (u) => u.arcana,
    ['Spellbound', 'Unlock your first Arcana entry'], ['Archmage', 'Unlock every Arcana entry']),
  ...table('housing', TableType.POH, 'housing', (u) => u.housing,
    ['Homeowner', 'Unlock your first Housing entry'], ['Master Builder', 'Unlock every Housing entry']),
  ...table('merchants', TableType.MERCHANTS, 'merchant', (u) => u.merchants,
    ['Window Shopper', 'Unlock your first Merchant'], ['Big Spender', 'Unlock every Merchant']),
  ...table('storage', TableType.STORAGE, 'storage', (u) => u.storage,
    ['Pack Rat', 'Unlock your first Storage entry'], ['Bottomless Pockets', 'Unlock every Storage entry']),
  ...table('guilds', TableType.GUILDS, 'guild', (u) => u.guilds,
    ['Guild Member', 'Unlock your first Guild'], ['Guildmaster', 'Unlock every Guild']),
  ...table('farming', TableType.FARMING_LAYERS, 'farming', (u) => u.farming,
    ['Green Thumb', 'Unlock your first Farming patch'], ['Master Farmer', 'Unlock every Farming patch']),
  ...table('slayer-unlocks', TableType.SLAYER_UNLOCKS, 'slayer', (u) => u.slayerUnlocks,
    ['Reward Shop', 'Unlock your first Slayer unlock'], ['Slayer Master', 'Unlock every Slayer unlock']),
  ...table('banks', TableType.BANKS, 'bank', (u) => u.banks,
    ['Bank Account', 'Unlock your first bank'], ['Banker of Gielinor', 'Unlock every bank and deposit box'], 25,
    (c) => bankLocksActive(c.mode, c.custom)),

  // Pets
  ...tiers('pets', 'Pets', 'pet', ({ petsClaimed }) => new Set(petsClaimed).size, [
    { title: 'Funny Feeling', description: 'Log your first pet', target: 1 },
    { title: 'Pet Shop', description: 'Log 5 pets', target: 5, fate: 5 },
    { title: 'Menagerie', description: 'Log 25 pets', target: 25, fate: 25 },
    { id: 'pets-all', title: 'Every Pet', description: 'Log every pet', target: TOTAL_PETS, icon: 'crown', fate: 25, clarity: 1 },
  ]),

  // Mastery (overall completion)
  ...tiers('mastery', 'Mastery', 'sparkles', ({ u, mode, custom }) => completionPercent(u, mode, custom), [
    { title: 'Quarter Way', description: 'Reach 25% overall completion', target: 25, fate: 5 },
    { title: 'Halfway There', description: 'Reach 50% overall completion', target: 50, fate: 10 },
    { title: 'Three Quarters', description: 'Reach 75% overall completion', target: 75, fate: 10 },
    { title: 'Almost There', description: 'Reach 90% overall completion', target: 90, fate: 25 },
    { title: 'Fate Conqueror', description: 'Reach 100% overall completion', target: 100, icon: 'trophy', fate: 25, clarity: 1 },
  ]),
];

const BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));
/** An achievement by id, or undefined for an id this version doesn't know. */
export const achievementById = (id: string): Achievement | undefined => BY_ID.get(id);

const contextOf = (run: AchievementRun): AchievementContext => ({
  u: run.unlocks,
  mode: run.gameModeId,
  custom: run.customMode,
  petsClaimed: run.petsClaimed ?? [],
  stats: runStats(run.history),
});

/** Score every achievement the run's mode offers. Pure — safe in useMemo. */
export function evaluateAchievements(run: AchievementRun): EvaluatedAchievement[] {
  const c = contextOf(run);
  const claimed = new Set(run.claimed ?? []);
  return ACHIEVEMENTS.filter((a) => a.available?.(c) ?? true).map((a) => {
    const { current, target } = a.progress(c);
    const earned = current >= target || claimed.has(a.id);
    const pct = earned ? 100 : target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    return { ...a, current, target, earned, pct };
  });
}

/** Set of earned achievement ids — used by the "newly earned" detector and the reward settlement. */
export function earnedIds(run: AchievementRun): Set<string> {
  return new Set(evaluateAchievements(run).filter((a) => a.earned).map((a) => a.id));
}

/** What each earned achievement pays, in list order, for the reward settlement. */
export function achievementPayouts(run: AchievementRun): AchievementPayout[] {
  return evaluateAchievements(run)
    .filter((a) => a.earned)
    .map(({ id, title, description, fate, clarity }) => ({ id, title, description, fate, clarity }));
}

export { rewardLabel };
