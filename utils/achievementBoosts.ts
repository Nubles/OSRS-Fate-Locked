/**
 * Activity Key boosts (Alex, 2026-10-15): every tier of an activity's
 * achievements adds a little to that activity's own Key rolls, by how hard
 * it is: first steps 0.2%, 10-Fate tiers 0.3%, bigger ones 0.5%. Only
 * settled achievements count, so the boost is known without loading the
 * achievement list, and an achievement stays counted once earned.
 */

export type BoostActivity =
  | 'skills' | 'quests' | 'diaries' | 'ca' | 'collection'
  | 'slayer' | 'clues' | 'bosses' | 'minigames';

/** Each activity's achievements by what they add, in tenths of a percent (utils/achievementBoosts.test pins this to their Fate). */
const BOOST_TENTHS: Readonly<Record<BoostActivity, Readonly<Record<number, readonly string[]>>>> = {
  skills: { 2: ['skills-start-1', 'skills-start-5'], 3: ['skills-start-12', 'total-level-500', 'skill-tiers-50'], 5: ['skills-start-24', 'total-level-1000', 'total-level-1500', 'total-level-2000', 'skill-tiers-100', 'skill-tiers-150', 'skill-tiers-240', 'skills-99-1', 'skills-99-24'] },
  quests: { 2: ['quests-1', 'qp-32'], 3: ['quests-10', 'quests-25', 'qp-50', 'qp-107'], 5: ['quests-50', 'quests-100', 'quests-150', 'quests-193', 'qp-150', 'qp-250'] },
  diaries: { 2: ['diaries-1', 'diary-tasks-25'], 3: ['diary-tasks-100', 'diary-region-all', 'diary-easy-all', 'diary-medium-all'], 5: ['diaries-12', 'diaries-24', 'diaries-48', 'diary-tasks-250', 'diary-tasks-400', 'diary-hard-all', 'diary-elite-all'] },
  ca: { 2: ['ca-tasks-10'], 3: ['ca-1', 'ca-2', 'ca-tasks-50'], 5: ['ca-3', 'ca-4', 'ca-5', 'ca-6', 'ca-tasks-150', 'ca-tasks-300', 'ca-tasks-500'] },
  collection: { 2: ['collection-1', 'collection-25'], 3: ['collection-50', 'collection-100'], 5: ['collection-250', 'collection-500', 'collection-750', 'collection-1000'] },
  slayer: { 2: ['slayer-tasks-1', 'slayer-tasks-10'], 3: ['slayer-tasks-25', 'slayer-tasks-50'], 5: ['slayer-tasks-100', 'slayer-tasks-200', 'slayer-tasks-350', 'slayer-tasks-500'] },
  clues: { 2: ['clues-1', 'clues-10'], 3: ['clues-25', 'clues-50'], 5: ['clues-100', 'clues-200', 'clues-300', 'clues-500'] },
  bosses: { 2: ['bosses-1', 'bosses-5'], 3: ['bosses-10', 'bosses-15'], 5: ['bosses-25', 'bosses-35', 'bosses-50', 'bosses-all'] },
  minigames: { 2: ['minigames-1', 'minigames-3', 'minigame-runs-1'], 3: ['minigames-5', 'minigames-10', 'minigame-runs-25'], 5: ['minigames-15', 'minigames-20', 'minigames-30', 'minigames-all', 'minigame-runs-100', 'minigame-runs-250'] },
};

/** Each activity's name in "+0.3% Slayer Key chance". */
export const BOOST_LABELS: Readonly<Record<BoostActivity, string>> = {
  skills: 'level-up', quests: 'quest', diaries: 'diary', ca: 'Combat Achievement', collection: 'collection log',
  slayer: 'Slayer', clues: 'clue', bosses: 'boss', minigames: 'minigame',
};

const ACTIVITIES = Object.keys(BOOST_TENTHS) as BoostActivity[];

/** Achievement id to its activity and tenths of a percent. */
const BOOSTS = new Map<string, { activity: BoostActivity; tenths: number }>(
  ACTIVITIES.flatMap((activity) => Object.entries(BOOST_TENTHS[activity])
    .flatMap(([tenths, ids]) => ids.map((id) => [id, { activity, tenths: Number(tenths) }] as const))),
);

/** Which activity a roll source belongs to; level-ups are "<Skill> Level <n>", log slots "Col. Log: <item>". */
export const boostActivityOf = (source: string): BoostActivity | null => {
  if (source.startsWith('Quest (')) return 'quests';
  if (source.startsWith('Diary (')) return 'diaries';
  if (source.startsWith('Combat Achievement (')) return 'ca';
  if (source === 'Collection Log' || source.startsWith('Col. Log: ')) return 'collection';
  if (source.startsWith('Slayer (')) return 'slayer';
  if (source.startsWith('Clue Scroll (')) return 'clues';
  if (source.startsWith('Boss (') || source === 'Raid') return 'bosses';
  if (source === 'Activity (Minigame)') return 'minigames';
  if (source === 'Level Up' || / Level \d+$/.test(source)) return 'skills';
  return null;
};

/**
 * Vanilla minigames roll from their own Key reserves, paced at about an hour
 * per Key, so minigame achievements don't speed them up (Alex, 2026-10-15).
 */
export const boostApplies = (activity: BoostActivity, gameModeId: string | undefined): boolean =>
  !(activity === 'minigames' && gameModeId === 'vanilla');

/** Summed in tenths so 0.2 + 0.3 stays 0.5. */
const boostOf = (activity: BoostActivity, claimed: readonly string[] | undefined): number => {
  let tenths = 0;
  for (const id of new Set(claimed ?? [])) {
    const b = BOOSTS.get(id);
    if (b?.activity === activity) tenths += b.tenths;
  }
  return tenths / 10;
};

/** The extra Key chance (in %) a roll from this source gets from the run's achievements. */
export const achievementBoostFor = (source: string, claimed: readonly string[] | undefined): number => {
  const activity = boostActivityOf(source);
  return activity ? boostOf(activity, claimed) : 0;
};

/** The activity and amount (in %) an achievement boosts, if any. */
export const achievementBoost = (achievementId: string): { activity: BoostActivity; percent: number } | null => {
  const b = BOOSTS.get(achievementId);
  return b ? { activity: b.activity, percent: b.tenths / 10 } : null;
};

/** "+0.3% Slayer Key chance" for an achievement that boosts in this mode, else null. */
export const boostLabel = (achievementId: string, gameModeId?: string): string | null => {
  const b = achievementBoost(achievementId);
  return b && boostApplies(b.activity, gameModeId) ? `+${b.percent}% ${BOOST_LABELS[b.activity]} Key chance` : null;
};

/** Every activity the run has boosted, with its total. */
export const activeBoosts = (claimed: readonly string[] | undefined, gameModeId?: string): Array<{ activity: BoostActivity; label: string; percent: number }> =>
  ACTIVITIES
    .filter((activity) => boostApplies(activity, gameModeId))
    .map((activity) => ({ activity, label: BOOST_LABELS[activity], percent: boostOf(activity, claimed) }))
    .filter((b) => b.percent > 0);
