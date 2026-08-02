import type { Snowflake } from '../types.js';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const MAX_RETRY_AFTER_MS = 60_000;

export interface DiscordMessage { id: Snowflake; [key: string]: unknown }
export interface DiscordChannel { id: Snowflake; [key: string]: unknown }
export interface DiscordGuildMember { user?: { id: Snowflake }; roles: Snowflake[]; [key: string]: unknown }

export class DiscordApiError extends Error {
  readonly method: string;
  readonly route: string;
  readonly status: number;

  constructor(method: string, route: string, status: number) {
    super(`Discord API ${method} ${route} failed with status ${status}`);
    this.name = 'DiscordApiError';
    this.method = method;
    this.route = route;
    this.status = status;
  }
}

const routeTemplate = (route: string): string => (route.split('?', 1)[0] ?? route).replace(/\d{17,20}/g, ':id');
const fallbackDelayMs = (attempt: number): number => Math.min(1_000 * 2 ** attempt, 10_000);

export class DiscordRestClient {
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;

  constructor(options: {
    token: string;
    fetchImpl?: typeof fetch;
    sleep?: (ms: number) => Promise<void>;
    maxRetries?: number;
  }) {
    this.token = options.token;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.maxRetries = Math.max(0, Math.min(options.maxRetries ?? 3, 5));
  }

  async request<T>(method: string, route: string, body?: unknown): Promise<T> {
    if (!route.startsWith('/')) throw new Error('Discord route must start with /');

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const response = await this.fetchImpl(`${DISCORD_API_BASE}${route}`, {
        method,
        headers: {
          authorization: `Bot ${this.token}`,
          'content-type': 'application/json',
          'user-agent': 'FateLockedDiscordBot/1.0',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return await response.json() as T;
      }

      const canRetry = response.status === 429 || response.status >= 500;
      if (!canRetry || attempt === this.maxRetries) {
        throw new DiscordApiError(method, routeTemplate(route), response.status);
      }

      let delay = fallbackDelayMs(attempt);
      if (response.status === 429) {
        try {
          const payload = await response.json() as { retry_after?: unknown };
          if (typeof payload.retry_after === 'number' && Number.isFinite(payload.retry_after)) {
            delay = Math.round(payload.retry_after * 1_000);
          }
        } catch {
          // A malformed rate-limit response uses the bounded fallback delay.
        }
      }
      await this.sleep(Math.max(0, Math.min(delay, MAX_RETRY_AFTER_MS)));
    }

    throw new Error('Discord retry loop exhausted');
  }

  getChannelMessages(channelId: string, limit = 50): Promise<DiscordMessage[]> {
    const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 100));
    return this.request('GET', `/channels/${channelId}/messages?limit=${boundedLimit}`);
  }
  createMessage(channelId: string, body: unknown): Promise<DiscordMessage> { return this.request('POST', `/channels/${channelId}/messages`, body); }
  editMessage(channelId: string, messageId: string, body: unknown): Promise<DiscordMessage> { return this.request('PATCH', `/channels/${channelId}/messages/${messageId}`, body); }
  createForumPost(channelId: string, body: unknown): Promise<DiscordChannel> { return this.request('POST', `/channels/${channelId}/threads`, body); }
  editThread(threadId: string, body: unknown): Promise<DiscordChannel> { return this.request('PATCH', `/channels/${threadId}`, body); }
  getGuildMember(guildId: string, userId: string): Promise<DiscordGuildMember> { return this.request('GET', `/guilds/${guildId}/members/${userId}`); }
  async addGuildMemberRole(guildId: string, userId: string, roleId: string): Promise<void> { await this.request('PUT', `/guilds/${guildId}/members/${userId}/roles/${roleId}`); }
  registerGuildCommands(applicationId: string, guildId: string, commands: unknown[]): Promise<unknown[]> { return this.request('PUT', `/applications/${applicationId}/guilds/${guildId}/commands`, commands); }
}
