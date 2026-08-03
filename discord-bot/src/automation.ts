import { weeklySeed } from '../../utils/seededRng.js';
import { hasBotAuthoredFooterMarker, releaseMarker, seedMarker } from './markers.js';
import type { BotConfig } from './types.js';
export const FATE_LOCKED_REPOSITORY = 'Nubles/OSRS-Fate-Locked' as const;
export const FATE_LOCKED_RUNELITE_REPOSITORY = 'Nubles/OSRS-Fate-Locked-Runelite' as const;

export type AutomationEvent =
  | { type: 'register_commands'; repository: typeof FATE_LOCKED_REPOSITORY; sentAt: string }
  | { type: 'weekly_seed'; repository: typeof FATE_LOCKED_REPOSITORY; sentAt: string }
  | {
      type: 'release';
      repository: typeof FATE_LOCKED_REPOSITORY | typeof FATE_LOCKED_RUNELITE_REPOSITORY;
      sentAt: string;
      release: { id: number; tagName: string; name: string; url: string; body: string; publishedAt: string };
    };

export type AnnouncementEvent = Extract<AutomationEvent, { type: 'release' | 'weekly_seed' }>;

export interface AnnouncementRest {
  getChannelMessages(channelId: string, limit?: number): Promise<unknown[]>;
  createMessage(channelId: string, body: unknown): Promise<unknown>;
}

export interface AnnouncementDeps {
  config: Pick<BotConfig, 'applicationId' | 'channels' | 'roles'>;
  rest: AnnouncementRest;
}

export interface AnnouncementResult {
  ok: true;
  duplicate: boolean;
  type: AnnouncementEvent['type'];
}

export class AnnouncementHistoryError extends Error {
  constructor() { super('Announcement history is unavailable'); this.name = 'AnnouncementHistoryError'; }
}

const TRACKER_URL = 'https://nubles.github.io/OSRS-Fate-Locked/';
const GOLD = 0xd4af37;

const weeklyAnnouncementPayload = (
  event: Extract<AnnouncementEvent, { type: 'weekly_seed' }>,
  config: AnnouncementDeps['config'],
) => {
  const seed = weeklySeed(new Date(event.sentAt));
  const roleId = config.roles.weeklySeed;
  return {
    content: `<@&${roleId}>`,
    allowed_mentions: { roles: [roleId], parse: [] },
    embeds: [{
      color: GOLD,
      title: 'Weekly Fate Locked Seed',
      url: TRACKER_URL,
      description: `This week's Fate Locked seed is **${seed}**.\n\n[Open the Fate Locked tracker](${TRACKER_URL})`,
      footer: { text: seedMarker(seed) },
    }],
  };
};

const normalizedText = (value: string, maximumLength: number): string =>
  value.replace(/\s+/g, ' ').trim().slice(0, maximumLength);

const releaseAnnouncementPayload = (
  event: Extract<AnnouncementEvent, { type: 'release' }>,
  config: AnnouncementDeps['config'],
) => {
  const name = normalizedText(event.release.name, 256) || normalizedText(event.release.tagName, 256) || 'Release';
  const tag = normalizedText(event.release.tagName, 128) || 'untagged';
  const body = normalizedText(event.release.body, 1000) || 'No release notes provided.';
  const roleId = config.roles.updates;
  return {
    content: `<@&${roleId}>`,
    allowed_mentions: { roles: [roleId], parse: [] },
    embeds: [{
      color: 0x5865f2,
      title: name,
      url: event.release.url,
      description: body,
      fields: [
        { name: 'Repository', value: event.repository },
        { name: 'Tag', value: tag },
      ],
      timestamp: new Date(event.release.publishedAt).toISOString(),
      footer: { text: releaseMarker(event.repository, event.release.id) },
    }],
  };
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;

const validDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(new Date(value).getTime());

const canonicalReleaseUrl = (value: unknown, repository: unknown): string | null => {
  if (typeof value !== 'string' || typeof repository !== 'string') return null;

  try {
    const url = new URL(value);
    const pathPrefix = `/${repository}/releases/`;
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(pathPrefix)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
};

export const parseAutomationEvent = (value: unknown): AutomationEvent | null => {
  const event = record(value);
  if (!event || !validDate(event.sentAt)) return null;

  if (
    event.type === 'register_commands' &&
    event.repository === FATE_LOCKED_REPOSITORY
  ) {
    return { type: 'register_commands', repository: FATE_LOCKED_REPOSITORY, sentAt: event.sentAt };
  }

  if (
    event.type === 'weekly_seed' &&
    event.repository === FATE_LOCKED_REPOSITORY
  ) {
    return { type: 'weekly_seed', repository: FATE_LOCKED_REPOSITORY, sentAt: event.sentAt };
  }

  const release = record(event.release);
  const releaseUrl = canonicalReleaseUrl(release?.url, event.repository);

  if (
    event.type === 'release' &&
    (event.repository === FATE_LOCKED_REPOSITORY || event.repository === FATE_LOCKED_RUNELITE_REPOSITORY) &&
    release &&
    typeof release.id === 'number' &&
    Number.isSafeInteger(release.id) &&
    release.id > 0 &&
    typeof release.tagName === 'string' &&
    typeof release.name === 'string' &&
    releaseUrl &&
    typeof release.body === 'string' &&
    validDate(release.publishedAt)
  ) {
    return {
      type: 'release',
      repository: event.repository,
      sentAt: event.sentAt,
      release: {
        id: release.id,
        tagName: release.tagName,
        name: release.name,
        url: releaseUrl,
        body: release.body,
        publishedAt: release.publishedAt,
      },
    };
  }

  return null;
};

const announcementMarker = (event: AnnouncementEvent): string =>
  event.type === 'release'
    ? releaseMarker(event.repository, event.release.id)
    : seedMarker(weeklySeed(new Date(event.sentAt)));

export const publishAnnouncement = async (
  event: AnnouncementEvent,
  deps: AnnouncementDeps,
): Promise<AnnouncementResult> => {
  let messages: unknown[];
  try {
    messages = await deps.rest.getChannelMessages(deps.config.channels.announcements, 100);
    if (!Array.isArray(messages)) throw new Error('Announcement history was not an array');
  } catch {
    throw new AnnouncementHistoryError();
  }

  const marker = announcementMarker(event);
  if (messages.some((message) => hasBotAuthoredFooterMarker(message, deps.config.applicationId, marker))) {
    return { ok: true, duplicate: true, type: event.type };
  }

  if (event.type === 'weekly_seed') {
    await deps.rest.createMessage(deps.config.channels.announcements, weeklyAnnouncementPayload(event, deps.config));
    return { ok: true, duplicate: false, type: event.type };
  }

  await deps.rest.createMessage(deps.config.channels.announcements, releaseAnnouncementPayload(event, deps.config));
  return { ok: true, duplicate: false, type: event.type };
};
