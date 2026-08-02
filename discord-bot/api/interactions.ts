import { loadConfig } from '../src/config.js';
import { handleInteractionRequest } from '../src/handlers/interactions.js';

const config = loadConfig(process.env);

export default async function interactions(request: Request): Promise<Response> {
  return handleInteractionRequest(request, {
    config,
    route: async () =>
      new Response(JSON.stringify({
        type: 4,
        data: { content: 'This interaction is not available yet.', flags: 64 },
      }), {
        headers: { 'content-type': 'application/json' },
      }),
  });
}
