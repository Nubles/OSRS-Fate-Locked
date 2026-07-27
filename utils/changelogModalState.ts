import { shouldAutoOpenChangelog } from './changelogState';

/**
 * Keeps the release notice out of onboarding while preserving the latest-id
 * comparison as the only condition once a player reaches the main app.
 */
export const shouldAutoOpenAfterOnboarding = (
  hasSeenOnboarding: boolean,
  latestId: string,
  storedId: string | null,
): boolean => hasSeenOnboarding && shouldAutoOpenChangelog(latestId, storedId);
