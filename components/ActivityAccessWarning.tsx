import React from 'react';
import { TableType, UnlockState } from '../types';
import { getActivityAccess } from '../utils/activityAccess';
import { VANILLA_RANDOM_ACCESS_POLICY, type VanillaRandomAccessPolicy } from '../data/activityAccess';

interface ActivityAccessWarningProps {
  activity: string;
  table: TableType;
  unlocks: UnlockState;
  modeId: string;
}

/** Whether the shared Vanilla policy requires a direct-unlock location warning. */
export const shouldShowActivityAccessWarning = (
  table: TableType,
  isLocationInaccessible: boolean,
  modeId: string,
  policy: VanillaRandomAccessPolicy = VANILLA_RANDOM_ACCESS_POLICY,
): boolean =>
  modeId === 'vanilla'
  && isLocationInaccessible
  && policy.filteredTables.some(candidate => candidate === table)
  && policy.requiresTrackedHardGeography
  && policy.omniDirect.allowsLocationIneligible
  && policy.omniDirect.warnsPlayer;

/** Explains a Vanilla Omni direct-unlock's remaining geographic gate. */
export const ActivityAccessWarning: React.FC<ActivityAccessWarningProps> = ({
  activity,
  table,
  unlocks,
  modeId,
}) => {
  const access = getActivityAccess(activity, unlocks, modeId);
  if (!shouldShowActivityAccessWarning(table, !access.eligible && access.requiredAreas.length > 0, modeId)) return null;

  return (
    <p role="status" className="mb-4 rounded border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-200">
      {`Omni Keys can unlock this now, but you still need access to: ${access.requiredAreas.join(' or ')}.`}
    </p>
  );
};
