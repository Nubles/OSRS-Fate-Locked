import { activityId, indexActivityRecords } from '../data/activityCatalog';
import { UnlockState } from '../types';
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { isAreaReachable } from './reachability';

export interface ActivityAccessResult {
  eligible: boolean;
  requiredAreas: readonly string[];
  explanation: string;
}

const ACCESS_BY_ID = indexActivityRecords(ACTIVITY_ACCESS_AREAS);
const NO_LOCATION_IDS = new Set([...NO_HARD_LOCATION_GATE].map(activityId));

/** Resolve the location-only eligibility of an activity for the current mode. */
export const getActivityAccess = (
  activity: string,
  unlocks: UnlockState,
  modeId: string,
): ActivityAccessResult => {
  const id = activityId(activity);
  if (modeId !== 'vanilla' || (id && NO_LOCATION_IDS.has(id))) {
    return { eligible: true, requiredAreas: [], explanation: '' };
  }

  if (!id || !ACCESS_BY_ID.has(id)) {
    return { eligible: false, requiredAreas: [], explanation: 'Missing location declaration' };
  }

  const requiredAreas = ACCESS_BY_ID.get(id)!;

  const eligible = requiredAreas.some((area) => isAreaReachable(area, unlocks, modeId));
  return {
    eligible,
    requiredAreas,
    explanation: eligible ? '' : `Needs ${requiredAreas.join(' or ')}`,
  };
};
