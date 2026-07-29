import type { GameState, RuneProofRunSnapshot } from '../../types';

const compareKeys = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const freezeSorted = (values: readonly string[] | undefined): readonly string[] =>
  Object.freeze([...(values ?? [])].sort(compareKeys));

const freezeNumberRecord = (
  values: Record<string | number, number>,
): Readonly<Record<string | number, number>> => Object.freeze(
  Object.fromEntries(Object.entries(values).sort(([left], [right]) => compareKeys(left, right))),
);

/**
 * Converts the mutable current run into canonical rule facts for RuneProof.
 * Possession state intentionally remains outside this boundary.
 */
export function buildRuneProofRunSnapshot(state: GameState): RuneProofRunSnapshot {
  const { unlocks } = state;
  return Object.freeze({
    runId: state.runId,
    runRevision: state.runRevision,
    gameModeId: state.gameModeId,
    equipmentTiers: freezeNumberRecord(unlocks.equipment),
    skillCaps: freezeNumberRecord(unlocks.skills),
    currentLevels: freezeNumberRecord(unlocks.levels),
    unlockedAreas: freezeSorted(unlocks.regions),
    unlockedChunks: freezeSorted(unlocks.chunks),
    unlockedMobility: freezeSorted(unlocks.mobility),
    unlockedArcana: freezeSorted(unlocks.arcana),
    unlockedHousing: freezeSorted(unlocks.housing),
    unlockedMerchants: freezeSorted(unlocks.merchants),
    unlockedMinigames: freezeSorted(unlocks.minigames),
    unlockedBosses: freezeSorted(unlocks.bosses),
    unlockedStorage: freezeSorted(unlocks.storage),
    unlockedGuilds: freezeSorted(unlocks.guilds),
    unlockedFarming: freezeSorted(unlocks.farming),
    unlockedSlayer: freezeSorted(unlocks.slayerUnlocks),
    unlockedBanks: freezeSorted(unlocks.banks),
    completedQuests: freezeSorted(unlocks.quests),
    completedDiaries: freezeSorted(unlocks.diaries),
    completedCombatAchievements: freezeSorted(unlocks.cas),
    completedTasks: freezeSorted(unlocks.completedTasks),
    collectionLog: freezeNumberRecord(unlocks.collectionLog),
  });
}
