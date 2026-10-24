import React from 'react';
import { useProfiles } from '../context/ProfileContext';
import { OFF_DEVICE_COPY_LABEL, offDeviceCopyLabel, readOffDeviceCopyAt } from '../utils/persistentStorage';

/**
 * One quiet line in the Settings menu's save tools: when this run last left
 * the browser, as a .fate file or an online backup (utils/persistentStorage.ts).
 * Read when the menu opens, so it is always current there.
 */
export const OffDeviceCopyStatus: React.FC<{ osrs?: boolean }> = ({ osrs = false }) => {
  const { storageKeyForActiveProfile: storageKey } = useProfiles();
  const at = readOffDeviceCopyAt(storageKey);
  const label = offDeviceCopyLabel(at);
  const title = at === null
    ? 'This run has only ever been saved in this browser. Export a save file, or turn on Online backup under Sync code.'
    : `Your last .fate file or online backup: ${new Date(at).toLocaleString()}`;
  if (osrs) {
    return (
      <div className="osrs-menu-note" title={title} data-testid="off-device-copy">
        <span>{OFF_DEVICE_COPY_LABEL}:</span>
        <span style={{ color: at === null ? '#ff3030' : '#ffffff' }}>{label}</span>
      </div>
    );
  }
  return (
    <p className="px-3 pt-0.5 pb-1 text-[10px] leading-snug text-gray-500" title={title} data-testid="off-device-copy">
      {OFF_DEVICE_COPY_LABEL}: <span className={at === null ? 'font-bold text-amber-300' : 'text-gray-300'}>{label}</span>
    </p>
  );
};
