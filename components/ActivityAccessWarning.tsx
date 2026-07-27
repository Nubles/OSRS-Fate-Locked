import React from 'react';
import { TableType, UnlockState } from '../types';
import { getActivityAccess } from '../utils/activityAccess';

interface ActivityAccessWarningProps {
  activity: string;
  table: TableType;
  unlocks: UnlockState;
  modeId: string;
}

/** Explains a Vanilla Omni direct-unlock's remaining geographic gate. */
export const ActivityAccessWarning: React.FC<ActivityAccessWarningProps> = ({
  activity,
  table,
  unlocks,
  modeId,
}) => {
  if (modeId !== 'vanilla' || (table !== TableType.BOSSES && table !== TableType.MINIGAMES)) return null;

  const access = getActivityAccess(activity, unlocks, modeId);
  if (access.eligible || access.requiredAreas.length === 0) return null;

  return (
    <p role="status" className="mb-4 rounded border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-200">
      {`Omni Keys can unlock this now, but you still need access to: ${access.requiredAreas.join(' or ')}.`}
    </p>
  );
};
