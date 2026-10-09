// The newest What's New entries, as the signed `whats_new` event the Discord
// bot (Nubles/Fate-Locked-Discord src/whats-new.ts) posts to #announcements.
// The bot skips any entry it has posted already, so sending the same entries
// again after a later deploy posts nothing twice.

export const REPOSITORY = 'Nubles/OSRS-Fate-Locked';

// Entries dated before this were never announced and stay that way.
export const FIRST_ANNOUNCED_DATE = '2026-10-09';

// The bot accepts at most ten entries in one event.
export const MAX_RELEASES = 10;

/** The entries to send, oldest first: the newest ten dated on or after FIRST_ANNOUNCED_DATE. */
export const releasesToAnnounce = (releases) =>
  releases
    .filter((release) => release.date >= FIRST_ANNOUNCED_DATE)
    .slice(0, MAX_RELEASES)
    .reverse()
    .map(({ id, title, date, sections }) => ({ id, title, date, sections }));

export const whatsNewEvent = (releases, sentAt = new Date().toISOString()) => ({
  type: 'whats_new',
  repository: REPOSITORY,
  sentAt,
  releases: releasesToAnnounce(releases),
});
