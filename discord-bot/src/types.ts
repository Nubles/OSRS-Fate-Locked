export type Snowflake = string;

export interface ChannelIds {
  announcements: Snowflake;
  runJournals: Snowflake;
  verificationQueue: Snowflake;
  auditLog: Snowflake;
  rules: Snowflake;
}

export interface RoleIds {
  moderator: Snowflake;
  administrator: Snowflake;
  fatekeeper: Snowflake;
  verifiedRunner: Snowflake;
  updates: Snowflake;
  weeklySeed: Snowflake;
}

export interface TagIds {
  vanilla: Snowflake;
  chunked: Snowflake;
  custom: Snowflake;
  active: Snowflake;
  verified: Snowflake;
}

export interface BotConfig {
  applicationId: string;
  publicKey: string;
  botToken: string;
  guildId: '1533446664709341357';
  channels: ChannelIds;
  roles: RoleIds;
  tags: TagIds;
  componentHmacKey: string;
  automationHmacKey: string;
  allowedRepositories: string[];
  mutationsEnabled: boolean;
}
