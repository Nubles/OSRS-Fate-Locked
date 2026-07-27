export const CHANGELOG_SEEN_KEY = 'flitest.whats-new.latest-seen';

export const shouldAutoOpenChangelog = (
  latestId: string,
  storedId: string | null,
): boolean => storedId !== latestId;

export const readLatestSeen = (storage: Pick<Storage, 'getItem'>): string | null =>
  storage.getItem(CHANGELOG_SEEN_KEY);

export const markLatestSeen = (
  storage: Pick<Storage, 'setItem'>,
  latestId: string,
): void => storage.setItem(CHANGELOG_SEEN_KEY, latestId);
