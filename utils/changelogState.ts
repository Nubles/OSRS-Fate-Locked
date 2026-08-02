import { parseRunelitePairFragment } from './runelitePairing';

export const CHANGELOG_STORAGE_KEY = 'fate-locked:last-seen-changelog';

export interface ChangelogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type ChangelogVisibilityAction =
  { type: 'OPEN' } | { type: 'DISMISS' };

const browserStorage = (): ChangelogStorage | undefined => {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const shouldShowChangelog = (
  releaseId: string,
  storage: ChangelogStorage | undefined = browserStorage(),
): boolean => {
  try {
    return storage?.getItem(CHANGELOG_STORAGE_KEY) !== releaseId;
  } catch {
    return true;
  }
};

export const markChangelogSeen = (
  releaseId: string,
  storage: ChangelogStorage | undefined = browserStorage(),
): void => {
  try {
    storage?.setItem(CHANGELOG_STORAGE_KEY, releaseId);
  } catch {
    // Storage restrictions must not block the app.
  }
};

export const changelogVisibilityReducer = (
  _state: boolean, action: ChangelogVisibilityAction,
): boolean => action.type === 'OPEN';

export type ChangelogOpenSource = 'automatic' | 'manual';

interface ChangelogStartupContext {
  hasSeenOnboarding: boolean;
  releaseIsUnseen: boolean;
  startupHash: string;
  hasPendingGameModePrompt: boolean;
  hasPendingSyncPrompt?: boolean;
  hasPendingGuidePrompt?: boolean;
  hasPendingCompensation?: boolean;
}

const SYNC_HASH_PREFIX = '#sync=';

export const shouldAutoOpenChangelog = ({
  hasSeenOnboarding,
  releaseIsUnseen,
  startupHash,
  hasPendingGameModePrompt,
  hasPendingSyncPrompt = false,
  hasPendingGuidePrompt = false,
  hasPendingCompensation = false,
}: ChangelogStartupContext): boolean =>
  hasSeenOnboarding
  && (releaseIsUnseen || hasPendingCompensation)
  && !hasPendingGameModePrompt
  && !hasPendingSyncPrompt
  && !hasPendingGuidePrompt
  && !(startupHash.startsWith(SYNC_HASH_PREFIX)
    && startupHash.length > SYNC_HASH_PREFIX.length)
  && parseRunelitePairFragment(startupHash) == null;

export const resolveChangelogRestoreTarget = <T>(
  source: ChangelogOpenSource,
  persistentTrigger: T | null,
): T | null => source === 'manual' ? persistentTrigger : null;

export const shouldEnableUnderlyingModalEscape = (
  anyUnderlyingModalOpen: boolean,
  showChangelog: boolean,
): boolean => anyUnderlyingModalOpen && !showChangelog;

export const shouldRenderUnderlyingModals = (
  showChangelog: boolean,
): boolean => !showChangelog;

export interface ChangelogModalRenderPolicy {
  renderAppModals: boolean;
  renderGlobalDialogOverlays: boolean;
  suspendDashboardModals: boolean;
}

export const resolveChangelogModalRenderPolicy = (
  showChangelog: boolean,
): ChangelogModalRenderPolicy => {
  const renderUnderlyingModals = shouldRenderUnderlyingModals(showChangelog);
  return {
    renderAppModals: renderUnderlyingModals,
    renderGlobalDialogOverlays: renderUnderlyingModals,
    suspendDashboardModals: !renderUnderlyingModals,
  };
};
