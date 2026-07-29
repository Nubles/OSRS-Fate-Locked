import { describe, expect, it } from 'vitest';
import { initialState } from '../../context/GameContext';
import type { GameState } from '../../types';
import { buildRuneProofRunSnapshot } from './runSnapshot';

const gameState = (): GameState => {
  const state = structuredClone(initialState);
  state.runId = 'runeproof-run';
  state.runRevision = 17;
  state.gameModeId = 'chunked';
  state.unlocks = {
    ...state.unlocks,
    equipment: { Weapon: 3, Head: 1 },
    skills: { Magic: 4, Attack: 2 },
    levels: { Magic: 40, Attack: 20 },
    regions: ['Zea', 'Asgarnia'],
    chunks: ['46,51', '46,50'],
    mobility: ['Fairy rings', 'Spirit trees'],
    arcana: ['Protect from Melee'],
    housing: ['Kitchen'],
    merchants: ['Ali Morrisane'],
    minigames: ['Wintertodt'],
    bosses: ['Zulrah'],
    storage: ['Seed vault'],
    guilds: ['Wizards\' Guild'],
    farming: ['Falador'],
    slayerUnlocks: ['Bigger and Badder'],
    banks: ['13619', '13618'],
    quests: ['Zogre Flesh Eaters', 'Cook\'s Assistant'],
    diaries: ['Varrock Easy'],
    cas: ['Medium'],
    completedTasks: ['var_easy_1'],
    collectionLog: { 104011: 5, 104002: 3 },
  };
  return state;
};

describe('buildRuneProofRunSnapshot', () => {
  it('captures only rule capabilities from the current revision', () => {
    const state = gameState() as GameState & {
      inventory: string[];
      bank: Record<string, number>;
    };
    state.inventory = ['Dragon scimitar'];
    state.bank = { 'Dragon scimitar': 1 };

    const snapshot = buildRuneProofRunSnapshot(state);

    expect(snapshot.runId).toBe(state.runId);
    expect(snapshot.runRevision).toBe(state.runRevision);
    expect(snapshot.unlockedChunks).toEqual(['46,50', '46,51']);
    expect(snapshot.completedQuests).toEqual([
      'Cook\'s Assistant',
      'Zogre Flesh Eaters',
    ]);
    expect(snapshot).not.toHaveProperty('inventory');
    expect(snapshot).not.toHaveProperty('bank');
    expect(snapshot).not.toHaveProperty('loadout');
  });

  it('canonicalizes every rule capability independently of later game state changes', () => {
    const state = gameState();
    const snapshot = buildRuneProofRunSnapshot(state);

    state.unlocks.regions.push('Misthalin');
    state.unlocks.skills.Magic = 10;
    state.unlocks.collectionLog[104002] = 99;

    expect(snapshot).toMatchObject({
      gameModeId: 'chunked',
      equipmentTiers: { Head: 1, Weapon: 3 },
      skillCaps: { Attack: 2, Magic: 4 },
      currentLevels: { Attack: 20, Magic: 40 },
      unlockedAreas: ['Asgarnia', 'Zea'],
      unlockedChunks: ['46,50', '46,51'],
      unlockedMobility: ['Fairy rings', 'Spirit trees'],
      unlockedArcana: ['Protect from Melee'],
      unlockedHousing: ['Kitchen'],
      unlockedMerchants: ['Ali Morrisane'],
      unlockedMinigames: ['Wintertodt'],
      unlockedBosses: ['Zulrah'],
      unlockedStorage: ['Seed vault'],
      unlockedGuilds: ["Wizards' Guild"],
      unlockedFarming: ['Falador'],
      unlockedSlayer: ['Bigger and Badder'],
      unlockedBanks: ['13618', '13619'],
      completedQuests: ["Cook's Assistant", 'Zogre Flesh Eaters'],
      completedDiaries: ['Varrock Easy'],
      completedCombatAchievements: ['Medium'],
      completedTasks: ['var_easy_1'],
      collectionLog: { 104002: 3, 104011: 5 },
    });
  });

  it('deep-freezes the canonical snapshot', () => {
    const snapshot = buildRuneProofRunSnapshot(gameState());

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.unlockedAreas)).toBe(true);
    expect(Object.isFrozen(snapshot.skillCaps)).toBe(true);
    expect(Object.isFrozen(snapshot.collectionLog)).toBe(true);
  });
});
