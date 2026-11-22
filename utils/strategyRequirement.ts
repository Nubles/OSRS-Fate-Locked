/**
 * How ready a Strategy Guide entry is: the one judgement both the Strategy
 * Guide's cards and the Goal Tracker's pinned goals use, so the two never
 * disagree about the same entry (root unlocks, access routes, manual
 * requirements, alternatives, quest points, activity readiness).
 *
 * Loaded only by lazy chunks (StrategyGuide, GoalTracker via goalLogic); keep
 * it out of anything the app imports at start.
 */
import type { ContentRequirement } from '../data/requirements';
import { QUEST_DATA } from '../data/questData';
import { TableType } from '../types';
import { isAreaReachable, namedAreaChunks } from './reachability';
import { chunkKey, isChunkUnlocked } from './chunkAdjacency';
import {
    EQUIPMENT_SLOTS, SKILLS_LIST, REGIONS_LIST, MOBILITY_LIST, ARCANA_LIST,
    POH_LIST, MERCHANTS_LIST, MINIGAMES_LIST, BOSSES_LIST, STORAGE_LIST,
    GUILDS_LIST, FARMING_PATCH_LIST,
} from '../constants';
import { currentQuestPoints, evaluateQuestEligibility, meetsSkillRequirement } from './journalStatus';
import { getActivityReq } from '../data/activityRequirements';
import { evaluateActivityReadiness } from './activityReadiness';
import { effectiveSkillLevel } from './slayerReach';

/** The ids a Key can roll in each table. Any other id in a table needs no Key of its own. */
const ROOT_UNLOCKS: Partial<Record<TableType, Set<string>>> = {
    [TableType.EQUIPMENT]: new Set(EQUIPMENT_SLOTS),
    [TableType.SKILLS]: new Set(SKILLS_LIST),
    [TableType.REGIONS]: new Set(REGIONS_LIST),
    [TableType.MOBILITY]: new Set(MOBILITY_LIST),
    [TableType.ARCANA]: new Set(ARCANA_LIST),
    [TableType.POH]: new Set(POH_LIST),
    [TableType.MERCHANTS]: new Set(MERCHANTS_LIST),
    [TableType.MINIGAMES]: new Set(MINIGAMES_LIST),
    [TableType.BOSSES]: new Set(BOSSES_LIST),
    [TableType.STORAGE]: new Set(STORAGE_LIST),
    [TableType.GUILDS]: new Set(GUILDS_LIST),
    [TableType.FARMING_LAYERS]: new Set(FARMING_PATCH_LIST),
};

export const alternativeRequirementText = (
    alternative: NonNullable<ContentRequirement['alternatives']>[number],
): string => 'One of: ' + alternative.routes.map(route => route.label).join(' or ');

export const analyzeRequirement = (req: ContentRequirement, unlocks: any, gameModeId?: string) => {
    const canonical = req.category === TableType.QUESTS && QUEST_DATA[req.id]
        ? evaluateQuestEligibility(QUEST_DATA[req.id], unlocks, gameModeId)
        : null;
    const missingRegions = canonical ? canonical.blockers.filter(b => b.kind === 'region').map(b => b.label)
        : req.regions.filter(r => !isAreaReachable(r, unlocks, gameModeId));
    // Chunked: one chunk of a big area ("Kharidian Desert") says nothing about
    // where this content is, so an area held only in part is a check to make.
    const partlyHeld = gameModeId === 'chunked' && !canonical
        ? req.regions.filter(r => !missingRegions.includes(r) && namedAreaChunks(r)
            .some(chunk => !isChunkUnlocked(chunkKey(chunk), unlocks.chunks ?? [])))
        : [];
    const missingSkills = Object.entries(req.skills).filter(([skill, level]) => canonical
        ? canonical.blockers.some(b => b.kind === 'skill' && (b.label === `${skill} ${level}` || (b.requirement?.type === 'single' && b.requirement.skill === skill && b.requirement.level === level)))
        : !meetsSkillRequirement(unlocks, skill, level)).map(([skill, level]) => ({ skill, reqLevel: level,
            currentLevel: effectiveSkillLevel(unlocks, skill), isUnlocked: (unlocks.skills[skill] || 0) > 0 }));
    const missingQuests = canonical ? canonical.blockers.filter(b => b.kind === 'quest').map(b => b.label)
        : (req.quests || []).filter(q => !unlocks.quests.includes(q));
    const missingAlternatives = req.alternatives ?? [];
    const activityRequirement = getActivityReq(req.id);
    const readiness = canonical || req.category === TableType.DIARIES || !activityRequirement ? null : evaluateActivityReadiness(true, activityRequirement, unlocks, gameModeId);
    const manualChecks = req.manualRequirements ?? [];
    const chunkChecks = partlyHeld.map(area => `Check it is in your chunks: ${area}`);
    const missingDiaries = (req.diaries ?? []).filter(d => !unlocks.diaries.includes(d));
    // Quest entries take their points from the canonical journal above.
    const questPoints = !canonical && req.questPoints !== undefined && currentQuestPoints(unlocks) < req.questPoints
        ? { have: currentQuestPoints(unlocks), need: req.questPoints } : null;
    const missingAccessRoute = req.accessRoutes?.length && !req.accessRoutes.some(route =>
        (route.diaries ?? []).every(d => unlocks.diaries.includes(d))
        && Object.entries(route.skills ?? {}).every(([skill, level]) => meetsSkillRequirement(unlocks, skill, level)))
        ? 'One of: ' + req.accessRoutes.map(route => route.label).join(' or ') : null;
    // Things the player has to confirm themselves; the tracker can never tick them.
    const confirmChecks = [
        ...((canonical as { manualChecks?: string[] } | null)?.manualChecks ?? []),
        ...(readiness?.status === 'NEEDS_CONFIRMATION' ? readiness.checks : []),
    ];
    const otherBlockers = [
        ...(canonical?.blockers.filter(b => b.kind === 'combat' || b.kind === 'alternative' || b.kind === 'equipment').map(b => b.label) ?? []),
        ...(readiness?.status === 'NOT_READY' ? readiness.blockers.map(b => b.label) : []),
    ];
    const missingChecks = [...new Set([
        ...manualChecks,
        ...chunkChecks,
        ...missingDiaries.map(d => `${d} diary`),
        ...(questPoints ? [`${questPoints.need} Quest Points`] : []),
        ...(missingAccessRoute ? [missingAccessRoute] : []),
        // A quest has canonical checks and no activity readiness, an activity the reverse.
        ...confirmChecks,
        ...otherBlockers,
    ])];

    const isCategoryUnlocked = (() => {
        if (req.category === TableType.QUESTS || req.category === TableType.AGILITY_COURSES || req.category === TableType.DIARIES) return true;
        const rootSet = ROOT_UNLOCKS[req.category];
        const isRootItem = rootSet ? rootSet.has(req.id) : false;
        if (!isRootItem) return true;
        switch(req.category) {
            case TableType.BOSSES: return unlocks.bosses.includes(req.id);
            case TableType.MINIGAMES: return unlocks.minigames.includes(req.id);
            case TableType.GUILDS: return unlocks.guilds.includes(req.id);
            case TableType.FARMING_LAYERS: return unlocks.farming.includes(req.id);
            case TableType.MOBILITY: return unlocks.mobility.includes(req.id);
            case TableType.ARCANA: return unlocks.arcana.includes(req.id);
            case TableType.POH: return unlocks.housing.includes(req.id);
            case TableType.STORAGE: return unlocks.storage.includes(req.id);
            case TableType.MERCHANTS: return unlocks.merchants.includes(req.id);
            default: return true;
        }
    })();

    const totalReqs = req.regions.length + Object.keys(req.skills).length
        + (req.quests?.length || 0) + (req.alternatives?.length || 0) + (req.diaries?.length || 0) + missingChecks.length + 1;
    const metReqs = (req.regions.length - missingRegions.length) +
                    (Object.keys(req.skills).length - missingSkills.length) +
                    ((req.quests?.length || 0) - missingQuests.length) +
                    (isCategoryUnlocked ? 1 : 0);

    const missingCount = missingRegions.length + missingSkills.length + missingQuests.length + missingAlternatives.length + missingChecks.length + (isCategoryUnlocked ? 0 : 1);
    const completionPercent = missingCount === 0 ? 100 : Math.max(0, Math.min(99, Math.round((1 - missingCount / Math.max(totalReqs, missingCount)) * 100)));

    return {
        isFullyPlayable: (canonical?.eligible ?? true) && missingRegions.length === 0 && missingSkills.length === 0
            && missingQuests.length === 0 && missingAlternatives.length === 0 && missingChecks.length === 0 && isCategoryUnlocked,
        missingChecks,
        missingRegions,
        missingSkills,
        missingQuests,
        missingAlternatives,
        isCategoryUnlocked,
        completionPercent,
        metReqs,
        /** The parts missingChecks is built from, for callers that word them their own way. */
        parts: { manualChecks, chunkChecks, missingDiaries, questPoints, missingAccessRoute, confirmChecks, otherBlockers },
    };
};
