
import { UnlockState, TableType } from '../types';
import { SKILLS_LIST, EQUIPMENT_SLOTS, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, GUILDS_LIST, FARMING_PATCH_LIST, SLAYER_UNLOCKS_LIST } from '../data/items';
import { EQUIPMENT_TIER_MAX } from '../config/rules';
import { ALL_CHUNK_KEYS, CHUNKED_START_KEY, isFrontierChunk } from './chunkAdjacency';
import { BANK_IDS } from '../data/banks';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';
import { getActivityAccess } from './activityAccess';
import { canonicalAreaName } from '../data/areaMapPolicy';
import { bankLocksActive, isAreaReachable } from './reachability';
import { unlockableAreas } from './freeAreas';
import { isF2PMode, usesVanillaRules, type GameModeRules } from '../config/gameModes';
import { ROLLABLE_POH_ITEMS, ROLLABLE_STORAGE_ITEMS } from '../data/items';
import { chunkedSkillRollable, fateSkillRollable } from './chunkedSkillPool';
import { F2P_EQUIPMENT_TIER_MAX, F2P_TABLE_ITEMS, isF2PEntry } from '../data/f2pContent';

/** The same tables and eligible entries drive rolls and their displayed odds. */
export const randomUnlockTables = (mode?: string, custom?: GameModeRules): TableType[] => allRandomUnlockTables(mode, custom)
    // Free-to-play skips the tables with no free-to-play entries.
    .filter(table => !isF2PMode(mode) || F2P_TABLE_ITEMS[table]?.length !== 0);

const allRandomUnlockTables = (mode?: string, custom?: GameModeRules): TableType[] => [
    TableType.EQUIPMENT, TableType.SKILLS,
    mode === 'chunked' ? TableType.CHUNKS : TableType.REGIONS,
    TableType.MOBILITY, TableType.ARCANA, TableType.POH, TableType.MERCHANTS,
    TableType.MINIGAMES, TableType.BOSSES, TableType.STORAGE, TableType.GUILDS,
    TableType.FARMING_LAYERS, TableType.SLAYER_UNLOCKS,
    ...(bankLocksActive(mode, custom) ? [TableType.BANKS] : []),
];

export const randomUnlockPool = (unlocks: UnlockState, mode = 'vanilla', costType: 'key' | 'chaosKey' = 'key', table?: TableType, custom?: GameModeRules): RandomUnlockCandidate[] =>
    randomUnlockTables(mode, custom).filter(t => table === undefined || t === table).flatMap(t =>
        getPoolAndStateKey(t, mode, custom).pool.filter(item => isRandomUnlockEligible(t, item, unlocks, mode, costType)).map(item => ({ table: t, item })));

export const rollDice = (max: number = 100) => Math.floor(Math.random() * max) + 1;

/** Whether a Free-to-play run can still unlock this entry: free-to-play content, gear up to rune. */
export const isF2PUnlockable = (table: TableType, item: string, unlocks: UnlockState): boolean =>
    isF2PEntry(table, item)
    && (table !== TableType.EQUIPMENT || (unlocks.equipment[item] || 0) < F2P_EQUIPMENT_TIER_MAX)
    && isValidUnlock(table, item, unlocks);

const anyF2PUnlockable = (table: TableType, unlocks: UnlockState, mode: string): boolean =>
    getPoolAndStateKey(table, mode).pool.some(item => isF2PUnlockable(table, item, unlocks));

export const checkUnlockAvailability = (unlocks: UnlockState, mode?: string, custom?: GameModeRules) => {
    if (isF2PMode(mode)) {
        const f2p = (table: TableType) => anyF2PUnlockable(table, unlocks, mode!);
        return {
            equipment: f2p(TableType.EQUIPMENT), skills: f2p(TableType.SKILLS), regions: f2p(TableType.REGIONS), chunks: false,
            mobility: f2p(TableType.MOBILITY), arcana: false, poh: false, merchants: f2p(TableType.MERCHANTS),
            minigames: f2p(TableType.MINIGAMES), bosses: f2p(TableType.BOSSES), storage: false, guilds: f2p(TableType.GUILDS),
            farming: false, slayerUnlocks: false, banks: bankLocksActive(mode, custom) && f2p(TableType.BANKS),
        };
    }
    const totalSkillTiers = (Object.values(unlocks.skills) as number[]).reduce((a, b) => a + b, 0);
    const totalEquipTiers = (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0);
    return {
        equipment: totalEquipTiers < (EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX),
        skills: totalSkillTiers < (SKILLS_LIST.length * 10),
        regions: unlockableAreas(mode, custom).some(area => !isAreaReachable(area, unlocks)),
        chunks: ALL_CHUNK_KEYS.some(key => isFrontierChunk(key, unlocks.chunks ?? [], unlocks)),
        mobility: unlocks.mobility.length < MOBILITY_LIST.length,
        arcana: unlocks.arcana.length < ARCANA_LIST.length,
        poh: ROLLABLE_POH_ITEMS.some(item => !unlocks.housing.includes(item)),
        merchants: unlocks.merchants.length < MERCHANTS_LIST.length,
        minigames: unlocks.minigames.length < MINIGAMES_LIST.length,
        bosses: unlocks.bosses.length < BOSSES_LIST.length,
        storage: ROLLABLE_STORAGE_ITEMS.some(item => !unlocks.storage.includes(item)),
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
    if (table === TableType.REGIONS) return !isAreaReachable(canonicalAreaName(item), unlocks);
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
    if (table === TableType.CHUNKS) return isFrontierChunk(item, unlocks.chunks ?? [], unlocks);
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
 * unlocks, and Chunked's trainable-skill rule to random Skills unlocks. All
 * other modes and tables retain their existing validity rules.
 */
export const isRandomUnlockEligible = (
    table: TableType,
    item: string,
    unlocks: UnlockState,
    modeId: string,
    randomCost: 'key' | 'chaosKey' = 'key',
    policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): boolean => {
    if (!isValidUnlock(table, item, unlocks)) return false;
    // Chunked: random Skills rolls only land on skills the run's chunks can train.
    if (modeId === 'chunked' && table === TableType.SKILLS) return chunkedSkillRollable(item, unlocks);
    // Free-to-play: only free-to-play content, and skills its areas can train.
    if (isF2PMode(modeId)) {
        if (!isF2PUnlockable(table, item, unlocks)) return false;
        if (table === TableType.SKILLS) return fateSkillRollable(item, unlocks, modeId);
    }
    if (!usesVanillaRules(modeId)) return true;
    if (!policy.randomCosts.includes(randomCost)) return true;
    if (!policy.filteredTables.some(candidate => candidate === table)) return true;
    if (!policy.requiresTrackedHardGeography) return true;
    return getActivityAccess(item, unlocks, modeId).eligible;
};

/** Whether an Omni direct selection may be confirmed under the shared Vanilla policy. */
export const isOmniDirectUnlockAvailable = (
    table: TableType,
    item: string,
    unlocks: UnlockState,
    modeId: string,
    policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): boolean => {
    if (isF2PMode(modeId) && !isF2PUnlockable(table, item, unlocks)) return false;
    if (!usesVanillaRules(modeId)) return true;
    if (!policy.filteredTables.some(candidate => candidate === table)) return true;
    if (!policy.requiresTrackedHardGeography || policy.omniDirect.allowsLocationIneligible) return true;
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
    randomCost: 'key' | 'chaosKey',
    sampleSize = 3,
    policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): RandomPoolBlockerSummary => {
    const blockers = candidates.flatMap(({ table, item }) => {
        if (!isValidUnlock(table, item, unlocks) || isRandomUnlockEligible(table, item, unlocks, modeId, randomCost, policy)) return [];

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

/**
 * Each table's pool; the Areas pool depends on which areas the run's mode
 * frees, and a Free-to-play run's pools hold only free-to-play content.
 */
export const getPoolAndStateKey = (table: TableType, mode?: string, custom?: GameModeRules) => {
    const entry = allPoolAndStateKey(table, mode, custom);
    if (!isF2PMode(mode)) return entry;
    let pool = F2P_POOLS.get(table);
    if (!pool) F2P_POOLS.set(table, pool = entry.pool.filter(item => isF2PEntry(table, item)));
    return { pool, stateKey: entry.stateKey };
};

/** Free-to-play pools, in each table's own order, built on first use. */
const F2P_POOLS = new Map<TableType, string[]>();

function allPoolAndStateKey(table: TableType, mode?: string, custom?: GameModeRules) {
    switch (table) {
        case TableType.SKILLS: return { pool: SKILLS_LIST, stateKey: 'skill' };
        case TableType.EQUIPMENT: return { pool: EQUIPMENT_SLOTS, stateKey: 'equipment' };
        case TableType.REGIONS: return { pool: unlockableAreas(mode, custom), stateKey: 'region' };
        case TableType.MOBILITY: return { pool: MOBILITY_LIST, stateKey: 'mobility' };
        case TableType.ARCANA: return { pool: ARCANA_LIST, stateKey: 'arcana' };
        case TableType.POH: return { pool: ROLLABLE_POH_ITEMS, stateKey: 'housing' };
        case TableType.MERCHANTS: return { pool: MERCHANTS_LIST, stateKey: 'merchants' };
        case TableType.MINIGAMES: return { pool: MINIGAMES_LIST, stateKey: 'minigame' };
        case TableType.BOSSES: return { pool: BOSSES_LIST, stateKey: 'boss' };
        case TableType.STORAGE: return { pool: ROLLABLE_STORAGE_ITEMS, stateKey: 'storage' };
        case TableType.GUILDS: return { pool: GUILDS_LIST, stateKey: 'guild' };
        case TableType.FARMING_LAYERS: return { pool: FARMING_PATCH_LIST, stateKey: 'farming' };
        case TableType.SLAYER_UNLOCKS: return { pool: SLAYER_UNLOCKS_LIST, stateKey: 'slayerUnlocks' };
        case TableType.CHUNKS: return { pool: ALL_CHUNK_KEYS, stateKey: 'chunks' };
        case TableType.BANKS: return { pool: BANK_IDS, stateKey: 'banks' };
        default: return { pool: [] as string[], stateKey: '' };
    }
}

// Unlock cost is a flat 1 key for all content types
export const UNLOCK_COST = 1;
