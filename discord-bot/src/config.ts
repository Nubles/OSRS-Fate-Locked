import type { BotConfig, Snowflake } from './types.js';

export const FATE_LOCKED_GUILD_ID = '1533446664709341357' as const;

const required = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const snowflake = (env: NodeJS.ProcessEnv, name: string): Snowflake => {
  const value = required(env, name);
  if (!/^\d{17,20}$/.test(value)) throw new Error(`${name} must be a Discord snowflake`);
  return value;
};

const hexKey = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = required(env, name);
  if (!/^[0-9a-f]{64}$/i.test(value)) throw new Error(`${name} must be a 32-byte hexadecimal key`);
  return value;
};

const hmacKey = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = required(env, name);
  if (value.length < 32) throw new Error(`${name} must be at least 32 characters`);
  return value;
};

const boolean = (env: NodeJS.ProcessEnv, name: string, defaultValue = false): boolean => {
  const value = env[name]?.trim();
  if (!value) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false`);
};

export const loadConfig = (env: NodeJS.ProcessEnv): BotConfig => {
  const guildId = snowflake(env, 'DISCORD_GUILD_ID');
  if (guildId !== FATE_LOCKED_GUILD_ID) throw new Error('DISCORD_GUILD_ID must match the Fate Locked server');

  const allowedRepositories = required(env, 'AUTOMATION_ALLOWED_REPOSITORIES')
    .split(',')
    .map((repository) => repository.trim())
    .filter(Boolean);
  if (allowedRepositories.length === 0) throw new Error('AUTOMATION_ALLOWED_REPOSITORIES is required');

  return {
    applicationId: snowflake(env, 'DISCORD_APPLICATION_ID'),
    publicKey: hexKey(env, 'DISCORD_PUBLIC_KEY'),
    botToken: required(env, 'DISCORD_BOT_TOKEN'),
    guildId,
    channels: {
      announcements: snowflake(env, 'DISCORD_ANNOUNCEMENTS_CHANNEL_ID'),
      runJournals: snowflake(env, 'DISCORD_RUN_JOURNALS_CHANNEL_ID'),
      verificationQueue: snowflake(env, 'DISCORD_VERIFICATION_QUEUE_CHANNEL_ID'),
      auditLog: snowflake(env, 'DISCORD_AUDIT_LOG_CHANNEL_ID'),
      rules: snowflake(env, 'DISCORD_RULES_CHANNEL_ID'),
    },
    roles: {
      moderator: snowflake(env, 'DISCORD_MODERATOR_ROLE_ID'),
      administrator: snowflake(env, 'DISCORD_ADMINISTRATOR_ROLE_ID'),
      fatekeeper: snowflake(env, 'DISCORD_FATEKEEPER_ROLE_ID'),
      verifiedRunner: snowflake(env, 'DISCORD_VERIFIED_RUNNER_ROLE_ID'),
      updates: snowflake(env, 'DISCORD_UPDATES_ROLE_ID'),
      weeklySeed: snowflake(env, 'DISCORD_WEEKLY_SEED_ROLE_ID'),
    },
    tags: {
      vanilla: snowflake(env, 'DISCORD_TAG_VANILLA_ID'),
      chunked: snowflake(env, 'DISCORD_TAG_CHUNKED_ID'),
      custom: snowflake(env, 'DISCORD_TAG_CUSTOM_ID'),
      active: snowflake(env, 'DISCORD_TAG_ACTIVE_ID'),
      verified: snowflake(env, 'DISCORD_TAG_VERIFIED_ID'),
    },
    componentHmacKey: hmacKey(env, 'DISCORD_COMPONENT_HMAC_KEY'),
    automationHmacKey: hmacKey(env, 'AUTOMATION_HMAC_KEY'),
    allowedRepositories,
    mutationsEnabled: boolean(env, 'DISCORD_MUTATIONS_ENABLED'),
  };
};
