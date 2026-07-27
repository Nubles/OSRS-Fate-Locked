import { UnlockState } from '../types';
import { ACTIVITY_ACCESS_AREAS, NO_HARD_LOCATION_GATE } from '../data/activityAccess';
import { isAreaReachable } from './reachability';

export interface ActivityAccessResult {
  eligible: boolean;
  requiredAreas: readonly string[];
  explanation: string;
}

/** Resolve the location-only eligibility of an activity for the current mode. */
export const getActivityAccess = (
  activity: string,
  unlocks: UnlockState,
  modeId: string,
): ActivityAccessResult => {
  if (modeId !== 'vanilla' || NO_HARD_LOCATION_GATE.has(activity)) {
    return { eligible: true, requiredAreas: [], explanation: '' };
  }

  if (!Object.prototype.hasOwnProperty.call(ACTIVITY_ACCESS_AREAS, activity)) {
    return { eligible: false, requiredAreas: [], explanation: 'Missing location declaration' };
  }

  const requiredAreas = ACTIVITY_ACCESS_AREAS[activity];

  const eligible = requiredAreas.some((area) => isAreaReachable(area, unlocks, modeId));
  return {
    eligible,
    requiredAreas,
    explanation: eligible ? '' : `Needs ${requiredAreas.join(' or ')}`,
  };
};
