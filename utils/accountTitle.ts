import { normalizeAccountName } from '../services/fateEventProtocol';

/**
 * The account titles Sync & Roll shows. Wise Old Man reads the solo ironman
 * hiscores, which list no group ironmen, so it calls a group iron a regular
 * account. A group iron picks their own title instead; it only ever
 * replaces "Regular", and only changes what the card shows.
 */
export type GroupIronTitle = 'group' | 'hardcore-group' | 'unranked-group';

export const GROUP_IRON_TITLES: readonly GroupIronTitle[] = ['group', 'hardcore-group', 'unranked-group'];

export interface AccountTitle {
  label: string;
  /** The in-game chat badge's OSRS Wiki file; none for a regular account. */
  badge: string | null;
  tone: 'ultimate' | 'hardcore' | 'ironman' | 'group' | 'unranked' | 'regular';
}

const HISCORE_TITLES: Record<string, AccountTitle> = {
  ultimate: { label: 'Ultimate Ironman', badge: 'Ultimate_ironman_chat_badge.png', tone: 'ultimate' },
  hardcore: { label: 'Hardcore Ironman', badge: 'Hardcore_ironman_chat_badge.png', tone: 'hardcore' },
  ironman: { label: 'Ironman', badge: 'Ironman_chat_badge.png', tone: 'ironman' },
  regular: { label: 'Regular', badge: null, tone: 'regular' },
};

export const GROUP_TITLES: Readonly<Record<GroupIronTitle, AccountTitle>> = {
  group: { label: 'Group Ironman', badge: 'Group_ironman_chat_badge.png', tone: 'group' },
  'hardcore-group': { label: 'Hardcore Group Ironman', badge: 'Hardcore_group_ironman_chat_badge.png', tone: 'hardcore' },
  'unranked-group': { label: 'Unranked Group Ironman', badge: 'Unranked_group_ironman_chat_badge.png', tone: 'unranked' },
};

const UNKNOWN: AccountTitle = { label: 'Unknown', badge: null, tone: 'regular' };

/** The title for Wise Old Man's account type, with a group iron's own title where it says regular. */
export function accountTitle(womType: string, group: GroupIronTitle | null): AccountTitle {
  if (womType === 'regular' && group) return GROUP_TITLES[group];
  return HISCORE_TITLES[womType] ?? UNKNOWN;
}

const KEY = 'fate_group_iron_title:';

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

/** The group title this browser remembers for a character, if any. */
export function readGroupIronTitle(account: string): GroupIronTitle | null {
  try {
    const saved = storage()?.getItem(KEY + normalizeAccountName(account));
    return GROUP_IRON_TITLES.includes(saved as GroupIronTitle) ? saved as GroupIronTitle : null;
  } catch {
    return null;
  }
}

/** Remember a character's group title in this browser, or forget it. */
export function saveGroupIronTitle(account: string, title: GroupIronTitle | null): void {
  try {
    const key = KEY + normalizeAccountName(account);
    if (title) storage()?.setItem(key, title);
    else storage()?.removeItem(key);
  } catch {
    // A title that can't be saved still shows until the card reloads.
  }
}
