// The newest What's New entries, as the signed `whats_new` event the Discord
// bot (Nubles/Fate-Locked-Discord src/whats-new.ts) posts to #updates.
// Entries a previous run already announced are left out, so an old post that
// was deleted from #updates is not sent again. The bot also skips any entry it
// can still see in #updates, in case a run is retried.

export const REPOSITORY = 'Nubles/OSRS-Fate-Locked';

// Entries dated before this were never announced and stay that way.
export const FIRST_ANNOUNCED_DATE = '2026-10-09';

// The bot accepts at most ten entries in one event.
export const MAX_RELEASES = 10;

/**
 * The entries to send, oldest first: the newest ten dated on or after
 * FIRST_ANNOUNCED_DATE that are not among `announcedIds` (the ids in the
 * changelog the last successful announcement ran on).
 */
export const releasesToAnnounce = (releases, announcedIds = new Set()) =>
  releases
    .filter((release) => release.date >= FIRST_ANNOUNCED_DATE && !announcedIds.has(release.id))
    .slice(0, MAX_RELEASES)
    .reverse()
    .map(({ id, title, date, sections }) => ({ id, title, date, sections }));

export const whatsNewEvent = (releases, sentAt = new Date().toISOString(), announcedIds = new Set()) => ({
  type: 'whats_new',
  repository: REPOSITORY,
  sentAt,
  releases: releasesToAnnounce(releases, announcedIds),
});
