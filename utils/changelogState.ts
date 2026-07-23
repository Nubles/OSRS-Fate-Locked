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
