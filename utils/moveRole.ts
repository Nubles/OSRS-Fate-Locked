import { NEW_TRACKER_URL, OLD_TRACKER_URL } from '../config/trackerAddress';

/**
 * The few lines of the address move that the first page load needs: which
 * side of the move this page is on, and where a RuneLite pairing link goes
 * once the player's runs have moved. Kept tiny: it is in the entry chunk.
 */
export type MoveRole = 'old' | 'new' | null;

/** The page's origin for a tracker URL: https only, or http on localhost for testing. */
export const trackerOrigin = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    return parsed.protocol === 'https:' || (local && parsed.protocol === 'http:') ? parsed.origin : null;
  } catch {
    return null;
  }
};

/** 'old' or 'new' only when both addresses are set, differ, and this page is on one of them. */
export const moveRole = (
  origin: string,
  oldUrl: string = OLD_TRACKER_URL,
  newUrl: string = NEW_TRACKER_URL,
): MoveRole => {
  const oldOrigin = trackerOrigin(oldUrl);
  const newOrigin = trackerOrigin(newUrl);
  if (oldOrigin === null || newOrigin === null || oldOrigin === newOrigin) return null;
  if (origin === oldOrigin) return 'old';
  return origin === newOrigin ? 'new' : null;
};

/** On the old address: which runs went to the new one (written by the move tool). */
export const MOVED_RECORD_KEY = 'fate_moved_to_v1';

/** The old address's moved record, raw; null when storage can't be read. */
export const readMovedRecord = (): string | null => {
  try {
    return window.localStorage.getItem(MOVED_RECORD_KEY);
  } catch {
    return null;
  }
};

/**
 * RuneLite opens the old address to pair until its next release. Once every
 * run here has moved, the pairing link belongs to the new address, so the old
 * one passes it on unchanged. Null means stay.
 */
export const pairingForwardUrl = (
  role: MoveRole,
  hash: string,
  movedRecordRaw: string | null,
  newUrl: string = NEW_TRACKER_URL,
): string | null => {
  if (role !== 'old' || !/^#runelite-pair=[0-9a-f]{32}$/.test(hash)) return null;
  try {
    const record: unknown = JSON.parse(movedRecordRaw ?? 'null');
    if (typeof record !== 'object' || record === null || (record as { allMoved?: unknown }).allMoved !== true) return null;
  } catch {
    return null;
  }
  return trackerOrigin(newUrl) === null ? null : newUrl + hash;
};
