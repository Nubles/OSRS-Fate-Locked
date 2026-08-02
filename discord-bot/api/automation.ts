import { guildCommands } from '../src/commands/definitions.js';
import { DiscordRestClient } from '../src/discord/rest.js';
import { loadConfig } from '../src/config.js';
import { handleAutomationRequest, type AutomationEvent } from '../src/handlers/automation.js';

const config = loadConfig(process.env);
const discord = new DiscordRestClient({ token: config.botToken });

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const registerCommands = async (event: AutomationEvent): Promise<Response> => {
  if (event.type !== 'register_commands') return json({ error: 'Unsupported automation event.' }, 400);

  try {
    const registered = await discord.registerGuildCommands(config.applicationId, config.guildId, [...guildCommands]);
    return json({ registered: registered.length });
  } catch {
    return json({ error: 'Command registration failed.' }, 502);
  }
};

export default async function automation(request: Request): Promise<Response> {
  return handleAutomationRequest(request, { config, handleEvent: registerCommands });
}
