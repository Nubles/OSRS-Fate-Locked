/**
 * Compatibility helper for the authored changelog history tests. The app itself
 * uses the fuller startup policy in changelogState so sync links and first-run
 * mode selection retain control of startup.
 */
export const shouldAutoOpenAfterOnboarding = (
  hasSeenOnboarding: boolean,
  latestId: string,
  storedId: string | null,
): boolean => hasSeenOnboarding && storedId !== latestId;