
import { UnlockState, TableType } from '../types';
import { SKILLS_LIST, EQUIPMENT_SLOTS, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { ALL_CHUNK_KEYS, isFrontierChunk } from './chunkAdjacency';
import { BANK_IDS } from '../data/banks';
import { VANILLA_RANDOM_ACCESS_POLICY } from '../data/activityAccess';
import { getActivityAccess } from './activityAccess';

export const rollDice = (max: number = 100) => Math.floor(Math.random() * max) + 1;

export const checkUnlockAvailability = (unlocks: UnlockState) => {
    const totalSkillTiers = (Object.values(unlocks.skills) as number[]).reduce((a, b) => a + b, 0);
    const totalEquipTiers = (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0);
    return {
        equipment: totalEquipTiers < (EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX),
        skills: totalSkillTiers < (SKILLS_LIST.length * 10),
        regions: unlocks.regions.length < REGIONS_LIST.length,
        chunks: (unlocks.chunks ?? []).length < ALL_CHUNK_KEYS.length,
        mobility: unlocks.mobility.length < MOBILITY_LIST.length,
        arcana: unlocks.arcana.length < ARCANA_LIST.length,
        poh: unlocks.housing.length < POH_LIST.length,
        merchants: unlocks.merchants.length < MERCHANTS_LIST.length,
        minigames: unlocks.minigames.length < MINIGAMES_LIST.length,
        bosses: unlocks.bosses.length < BOSSES_LIST.length,
        storage: unlocks.storage.length < STORAGE_LIST.length,
        guilds: unlocks.guilds.length < GUILDS_LIST.length,
        farming: unlocks.farming.length < FARMING_PATCH_LIST.length,
        slayerUnlocks: unlocks.slayerUnlocks.length < SLAYER_UNLOCKS_LIST.length,
        banks: (unlocks.banks ?? []).length < BANK_IDS.length,
    };
};

export const isValidUnlock = (table: TableType, item: string, unlocks: UnlockState): boolean => {
    if (table === TableType.SKILLS) {
        const currentTier = unlocks.skills[item] || 0;
        if (currentTier >= 10) return false;
        return true;
    }
    if (table === TableType.EQUIPMENT) return (unlocks.equipment[item] || 0) < EQUIPMENT_TIER_MAX;
    if (table === TableType.REGIONS) return !unlocks.regions.includes(item);
    if (table === TableType.MOBILITY) return !unlocks.mobility.includes(item);
    if (table === TableType.ARCANA) return !unlocks.arcana.includes(item);
    if (table === TableType.POH) return !unlocks.housing.includes(item);
    if (table === TableType.MERCHANTS) return !unlocks.merchants.includes(item);
    if (table === TableType.MINIGAMES) return !unlocks.minigames.includes(item);
    if (table === TableType.BOSSES) return !unlocks.bosses.includes(item);
    if (table === TableType.STORAGE) return !unlocks.storage.includes(item);
    if (table === TableType.GUILDS) return !unlocks.guilds.includes(item);
    if (table === TableType.FARMING_LAYERS) return !unlocks.farming.includes(item);
    if (table === TableType.SLAYER_UNLOCKS) return !unlocks.slayerUnlocks.includes(item);
    if (table === TableType.CHUNKS) return isFrontierChunk(item, unlocks.chunks ?? []);
    if (table === TableType.BANKS) return !(unlocks.banks ?? []).includes(item);
    return true;
};

/** A table item considered while building a random Standard or Chaos pool. */
export interface RandomUnlockCandidate {
    table: TableType;
    item: string;
}

/** A deterministic small sample of currently valid items blocked by location access. */
export interface RandomPoolBlockerSummary {
    sample: string[];
    remaining: number;
}

/**
 * Applies the Vanilla exact-area policy only to random boss and minigame
 * unlocks. All other modes and tables retain their existing validity rules.
 */
export const isRandomUnlockEligible = (
    table: TableType,
    item: string,
    unlocks: UnlockState,
    modeId: string,
): boolean => {
    if (!isValidUnlock(table, item, unlocks)) return false;
    if (modeId !== 'vanilla') return true;
    if (!VANILLA_RANDOM_ACCESS_POLICY.filteredTables.some(candidate => candidate === table)) return true;
    return getActivityAccess(item, unlocks, modeId).eligible;
};

/**
 * Describe valid items excluded only by the Vanilla location policy. The
 * caller supplies the candidate order, so the examples are stable and this
 * helper never consumes gameplay RNG.
 */
export const describeRandomPoolBlockers = (
    candidates: readonly RandomUnlockCandidate[],
    unlocks: UnlockState,
    modeId: string,
    sampleSize = 3,
): RandomPoolBlockerSummary => {
    const blockers = candidates.flatMap(({ table, item }) => {
        if (!isValidUnlock(table, item, unlocks) || isRandomUnlockEligible(table, item, unlocks, modeId)) return [];

        const { explanation } = getActivityAccess(item, unlocks, modeId);
        return [`${item} — ${explanation.replace(/^Needs\b/, 'needs')}`];
    });
    const sample = blockers.slice(0, sampleSize);

    return { sample, remaining: blockers.length - sample.length };
};

/** Draw from a non-empty random pool without touching RNG for an empty pool. */
export const pickRandomPoolEntry = <T>(pool: readonly T[], nextFloat: () => number): T | undefined => {
    if (pool.length === 0) return undefined;
    return pool[Math.floor(nextFloat() * pool.length)];
};

export const getPoolAndStateKey = (table: TableType) => {
    switch (table) {
        case TableType.SKILLS: return { pool: SKILLS_LIST, stateKey: 'skill' };
        case TableType.EQUIPMENT: return { pool: EQUIPMENT_SLOTS, stateKey: 'equipment' };
        case TableType.REGIONS: return { pool: REGIONS_LIST, stateKey: 'region' };
        case TableType.MOBILITY: return { pool: MOBILITY_LIST, stateKey: 'mobility' };
        case TableType.ARCANA: return { pool: ARCANA_LIST, stateKey: 'arcana' };
        case TableType.POH: return { pool: POH_LIST, stateKey: 'housing' };
        case TableType.MERCHANTS: return { pool: MERCHANTS_LIST, stateKey: 'merchants' };
        case TableType.MINIGAMES: return { pool: MINIGAMES_LIST, stateKey: 'minigame' };
        case TableType.BOSSES: return { pool: BOSSES_LIST, stateKey: 'boss' };
        case TableType.STORAGE: return { pool: STORAGE_LIST, stateKey: 'storage' };
        case TableType.GUILDS: return { pool: GUILDS_LIST, stateKey: 'guild' };
        case TableType.FARMING_LAYERS: return { pool: FARMING_PATCH_LIST, stateKey: 'farming' };
        case TableType.SLAYER_UNLOCKS: return { pool: SLAYER_UNLOCKS_LIST, stateKey: 'slayerUnlocks' };
        case TableType.CHUNKS: return { pool: ALL_CHUNK_KEYS, stateKey: 'chunks' };
        case TableType.BANKS: return { pool: BANK_IDS, stateKey: 'banks' };
        default: return { pool: [], stateKey: '' };
    }
};

// Unlock cost is a flat 1 key for all content types
export const UNLOCK_COST = 1;
