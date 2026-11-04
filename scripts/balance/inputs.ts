/**
 * The numbers the balance check's roll simulation runs on, read from the
 * tracker's own rules and content (config/, data/), so the nightly report
 * follows whatever is on main. scripts/balance/report.mjs loads this through
 * Vite; nothing in the app imports it.
 */
import { DropSource } from '../../types';
import { DROP_RATES } from '../../config/rules';
import {
  STARTING_KEYS, LEVEL_CHAOS_CHANCE, SKILL_CHAOS_MILESTONES, CHUNK_EXPLORE_ROLLS,
  failureFateForSource, failureFateForSkillLevel, omniFloor,
} from '../../config/economy';
import { GAME_MODES } from '../../config/gameModes';
import { VANILLA_BOSS_KEY_RATES, CLUE_ONBOARDING_MINIMUMS, MINIGAME_MISS_FATE_MIN_RATE, BRUTUS_BOSS_NAME } from '../../config/vanillaKeyEconomy';
import { skillLevelKeyChance } from '../../utils/keyRoll';
import { completionDenominator } from '../../utils/completion';
import { ALL_CHUNK_KEYS } from '../../utils/chunkAdjacency';
import { BOSSES_LIST, MINIGAMES_LIST, SKILLS_LIST } from '../../data/items';
import { bossTier } from '../../data/bossKeyTiers';
import { MINIGAME_KEY_RESERVES, minigameReserveRates } from '../../data/minigameKeyReserves';
import { QUEST_DATA } from '../../data/questData';
import { ALL_DIARY_TASKS } from '../../data/diaryTasks';
import { ALL_CA_TASKS } from '../../data/caTasks';
import { COLLECTION_LOG_DATA } from '../../data/collectionLogData';
import { PETS } from '../../data/pets';

const source = (s: DropSource) => ({
  rate: DROP_RATES[s] ?? 0,
  fate: failureFateForSource(s),
  omni: (() => { try { return omniFloor(s); } catch { return 0; } })(),
});

const count = <T,>(items: readonly T[], key: (item: T) => string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const item of items) { const k = key(item); out[k] = (out[k] ?? 0) + 1; }
  return out;
};

const modeRules = (id: string) => {
  const mode = GAME_MODES.find(m => m.id === id);
  if (!mode) throw new Error(`No game mode "${id}"`);
  return mode.rules;
};

export const balanceInputs = () => {
  const vanilla = modeRules('vanilla');
  const chunked = modeRules('chunked');
  // Hitpoints is free in every mode (all ten tiers), so a run buys the rest.
  const freeTiers = 10;
  // Quests and miniquests: each rolls at its difficulty's odds when done.
  const quests = Object.values(QUEST_DATA);
  return {
    rules: {
      startingKeys: STARTING_KEYS,
      pity: { vanilla: vanilla.pityEnabled ? vanilla.pityThreshold : null, chunked: chunked.pityEnabled ? chunked.pityThreshold : null },
      omniBase: { vanilla: vanilla.omniChanceBase, chunked: chunked.omniChanceBase },
      levelChaosChance: LEVEL_CHAOS_CHANCE,
      chaosMilestones: [...SKILL_CHAOS_MILESTONES],
      // Index = level (2..99).
      levelChance: Array.from({ length: 100 }, (_, l) => (l < 2 ? 0 : skillLevelKeyChance(l))),
      levelFate: Array.from({ length: 100 }, (_, l) => (l < 2 ? 0 : failureFateForSkillLevel(l))),
      quest: Object.fromEntries([DropSource.QUEST_NOVICE, DropSource.QUEST_INTERMEDIATE, DropSource.QUEST_EXPERIENCED, DropSource.QUEST_MASTER, DropSource.QUEST_GRANDMASTER].map(s => [s, source(s)])),
      diary: Object.fromEntries([DropSource.DIARY_EASY, DropSource.DIARY_MEDIUM, DropSource.DIARY_HARD, DropSource.DIARY_ELITE].map(s => [s, source(s)])),
      ca: {
        Easy: source(DropSource.CA_EASY), Medium: source(DropSource.CA_MEDIUM), Hard: source(DropSource.CA_HARD),
        Elite: source(DropSource.CA_ELITE), Master: source(DropSource.CA_MASTER), Grandmaster: source(DropSource.CA_GRANDMASTER),
      },
      slayer: {
        turael: source(DropSource.SLAYER_BEGINNER), mazchna: source(DropSource.SLAYER_MAZCHNA), vannaka: source(DropSource.SLAYER_VANNAKA),
        chaeldar: source(DropSource.SLAYER_CHAELDAR), konar: source(DropSource.SLAYER_KONAR), nieve: source(DropSource.SLAYER_NIEVE),
        krystilia: source(DropSource.SLAYER_KRYSTILIA), duradel: source(DropSource.SLAYER_DURADEL), boss: source(DropSource.SLAYER_BOSS),
      },
      clue: {
        beginner: source(DropSource.CLUE_BEGINNER), easy: source(DropSource.CLUE_EASY), medium: source(DropSource.CLUE_MEDIUM),
        hard: source(DropSource.CLUE_HARD), elite: source(DropSource.CLUE_ELITE), master: source(DropSource.CLUE_MASTER),
      },
      clueMinimums: [...CLUE_ONBOARDING_MINIMUMS],
      boss: { low: source(DropSource.BOSS_LOW), mid: source(DropSource.BOSS_MID), high: source(DropSource.BOSS_HIGH), raid: source(DropSource.RAID), brutus: source(DropSource.BOSS_LOW) },
      bossStash: Object.fromEntries(Object.entries(VANILLA_BOSS_KEY_RATES).map(([k, v]) => [k, [...v]])),
      minigame: source(DropSource.ACTIVITY_MINIGAME),
      minigameMissFateMinRate: MINIGAME_MISS_FATE_MIN_RATE,
      clog: source(DropSource.COLLECTION_LOG),
      chunkExplore: { ...source(DropSource.CHUNK_EXPLORE), rolls: CHUNK_EXPLORE_ROLLS },
    },
    content: {
      unlocks: { vanilla: completionDenominator('vanilla') - freeTiers, chunked: completionDenominator('chunked') - freeTiers },
      chunks: ALL_CHUNK_KEYS.length - 1,
      skills: SKILLS_LIST.length,
      quests: count(quests, q => q.difficulty),
      diaryTasks: count(ALL_DIARY_TASKS, t => `Diary (${t.tierId.split(' ').pop()})`),
      caTasks: count(ALL_CA_TASKS, t => t.tierId),
      clogSlots: Object.values(COLLECTION_LOG_DATA).reduce((n, tab) => n + Object.values(tab.pages).reduce((m, p) => m + p.items.length, 0), 0),
      bosses: BOSSES_LIST.map(name => (name === BRUTUS_BOSS_NAME ? 'brutus' : bossTier(name))),
      minigames: MINIGAMES_LIST.filter(name => MINIGAME_KEY_RESERVES[name]).map(name => ({
        name, minutes: MINIGAME_KEY_RESERVES[name].minutes, rates: minigameReserveRates(MINIGAME_KEY_RESERVES[name]),
      })),
      pets: PETS.length,
    },
  };
};

export type BalanceInputs = ReturnType<typeof balanceInputs>;
