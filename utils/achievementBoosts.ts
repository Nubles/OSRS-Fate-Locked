/**
 * Activity Key boosts (Alex, 2026-10-15): three milestone achievements for
 * each activity add 1% each to that activity's own Key rolls, up to +3%.
 * Only settled achievements count, so the boost is known without loading the
 * achievement list, and an achievement stays counted once earned.
 */

export const BOOST_PER_ACHIEVEMENT = 1;

export type BoostActivity =
  | 'skills' | 'quests' | 'diaries' | 'ca' | 'collection'
  | 'slayer' | 'clues' | 'bosses' | 'minigames';

/** Each activity's name in "+1% Slayer Key chance", and its three milestone achievements. */
export const ACTIVITY_BOOSTS: Readonly<Record<BoostActivity, { label: string; ids: readonly string[] }>> = {
  skills: { label: 'level-up', ids: ['total-level-500', 'total-level-1000', 'total-level-1500'] },
  quests: { label: 'quest', ids: ['quests-10', 'quests-25', 'quests-50'] },
  diaries: { label: 'diary', ids: ['diaries-1', 'diaries-12', 'diaries-24'] },
  ca: { label: 'Combat Achievement', ids: ['ca-1', 'ca-2', 'ca-3'] },
  collection: { label: 'collection log', ids: ['collection-25', 'collection-100', 'collection-250'] },
  slayer: { label: 'Slayer', ids: ['slayer-tasks-50', 'slayer-tasks-200', 'slayer-tasks-500'] },
  clues: { label: 'clue', ids: ['clues-25', 'clues-100', 'clues-300'] },
  bosses: { label: 'boss', ids: ['bosses-10', 'bosses-25', 'bosses-50'] },
  minigames: { label: 'minigame', ids: ['minigames-5', 'minigames-15', 'minigames-all'] },
};

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

const boostOf = (activity: BoostActivity, claimed: readonly string[] | undefined): number =>
  claimed ? ACTIVITY_BOOSTS[activity].ids.filter((id) => claimed.includes(id)).length * BOOST_PER_ACHIEVEMENT : 0;

/** The extra Key chance (in %) a roll from this source gets from the run's achievements. */
export const achievementBoostFor = (source: string, claimed: readonly string[] | undefined): number => {
  const activity = boostActivityOf(source);
  return activity ? boostOf(activity, claimed) : 0;
};

/** The activity an achievement boosts, if it is one of the milestones. */
export const boostedActivityOf = (achievementId: string): BoostActivity | null =>
  (Object.keys(ACTIVITY_BOOSTS) as BoostActivity[]).find((a) => ACTIVITY_BOOSTS[a].ids.includes(achievementId)) ?? null;

/** "+1% Slayer Key chance" for a milestone achievement, else null. */
export const boostLabel = (achievementId: string): string | null => {
  const activity = boostedActivityOf(achievementId);
  return activity ? `+${BOOST_PER_ACHIEVEMENT}% ${ACTIVITY_BOOSTS[activity].label} Key chance` : null;
};

/** Every activity the run has boosted, with its total. */
export const activeBoosts = (claimed: readonly string[] | undefined): Array<{ activity: BoostActivity; label: string; percent: number }> =>
  (Object.keys(ACTIVITY_BOOSTS) as BoostActivity[])
    .map((activity) => ({ activity, label: ACTIVITY_BOOSTS[activity].label, percent: boostOf(activity, claimed) }))
    .filter((b) => b.percent > 0);
