import { routeInteraction } from '../src/commands/router.js';
import { loadConfig } from '../src/config.js';
import { handleInteractionRequest } from '../src/handlers/interactions.js';

const config = loadConfig(process.env);

export default async function interactions(request: Request): Promise<Response> {
  return handleInteractionRequest(request, {
    config,
    route: async (interaction) => new Response(JSON.stringify(await routeInteraction(interaction, config)), {
      headers: { 'content-type': 'application/json' },
    }),
  });
}
