import { guildCommands } from '../src/commands/definitions.js';
import { DiscordRestClient } from '../src/discord/rest.js';
import { loadConfigFromProcess } from '../src/config.js';
import { AnnouncementHistoryError, publishAnnouncement } from '../src/automation.js';
import { handleAutomationRequest, type AutomationEvent } from '../src/handlers/automation.js';
import type { BotConfig } from '../src/types.js';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

export interface AutomationDiscord {
  registerGuildCommands(applicationId: string, guildId: string, commands: unknown[]): Promise<unknown[]>;
  getChannelMessages(channelId: string, limit?: number): Promise<unknown[]>;
  createMessage(channelId: string, body: unknown): Promise<unknown>;
}

export const createAutomationHandler = (config: BotConfig, discord: AutomationDiscord) => {
  const registerCommands = async (): Promise<Response> => {
    try {
      await discord.registerGuildCommands(config.applicationId, config.guildId, [...guildCommands]);
      return json({ ok: true, duplicate: false, type: 'register_commands' });
    } catch {
      return json({ ok: false, duplicate: false, type: 'register_commands' }, 502);
    }
  };

  const handleEvent = async (event: AutomationEvent): Promise<Response> => {
    if (event.type === 'register_commands') return registerCommands();

    try {
      const result = await publishAnnouncement(event, { config, rest: discord });
      return json(result);
    } catch (error) {
      const status = error instanceof AnnouncementHistoryError ? 503 : 502;
      return json({ ok: false, duplicate: false, type: event.type }, status);
    }
  };

  return async (request: Request): Promise<Response> =>
    handleAutomationRequest(request, { config, handleEvent });
};

export default {
  fetch(request: Request): Promise<Response> {
    const config = loadConfigFromProcess();
    const discord = new DiscordRestClient({ token: config.botToken });
    return createAutomationHandler(config, discord)(request);
  },
};
