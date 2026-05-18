
import { UnlockState, TableType } from '../types';
import { SKILLS_LIST, EQUIPMENT_SLOTS, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST, POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST, GUILDS_LIST, FARMING_PATCH_LIST } from '../data/items';
import { EQUIPMENT_TIER_MAX } from '../config/rules';

export const rollDice = (max: number = 100) => Math.floor(Math.random() * max) + 1;

export const checkUnlockAvailability = (unlocks: UnlockState) => {
    const totalSkillTiers = (Object.values(unlocks.skills) as number[]).reduce((a, b) => a + b, 0);
    const totalEquipTiers = (Object.values(unlocks.equipment) as number[]).reduce((a, b) => a + b, 0);
    return {
        equipment: totalEquipTiers < (EQUIPMENT_SLOTS.length * EQUIPMENT_TIER_MAX),
        skills: totalSkillTiers < (SKILLS_LIST.length * 10),
        regions: unlocks.regions.length < REGIONS_LIST.length,
        mobility: unlocks.mobility.length < MOBILITY_LIST.length,
        arcana: unlocks.arcana.length < ARCANA_LIST.length,
        poh: unlocks.housing.length < POH_LIST.length,
        merchants: unlocks.merchants.length < MERCHANTS_LIST.length,
        minigames: unlocks.minigames.length < MINIGAMES_LIST.length,
        bosses: unlocks.bosses.length < BOSSES_LIST.length,
        storage: unlocks.storage.length < STORAGE_LIST.length,
        guilds: unlocks.guilds.length < GUILDS_LIST.length,
        farming: unlocks.farming.length < FARMING_PATCH_LIST.length,
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
    return true;
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
        default: return { pool: [], stateKey: '' };
    }
};

// Unlock cost is a flat 1 key for all content types
export const UNLOCK_COST = 1;
