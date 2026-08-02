import { waitUntil } from '@vercel/functions';
import { routeInteraction } from '../src/commands/router.js';
import { loadConfig } from '../src/config.js';
import { handleInteractionRequest } from '../src/handlers/interactions.js';
import type { DiscordInteraction } from '../src/handlers/interactions.js';
import type { JournalInteractionResponse } from '../src/journals.js';
import type { BotConfig } from '../src/types.js';

type InteractionRoute = (interaction: DiscordInteraction, config: BotConfig) => Promise<JournalInteractionResponse>;
type DeferredWorkScheduler = (work: Promise<unknown>) => void | undefined;

const runAfterResponse = (afterAck: () => Promise<void>): Promise<void> => new Promise((resolve) => {
  setTimeout(() => {
    void Promise.resolve().then(afterAck).catch(() => undefined).then(resolve);
  }, 0);
});

export const createInteractionsHandler = (
  config: BotConfig,
  route: InteractionRoute = routeInteraction,
  schedule: DeferredWorkScheduler = waitUntil,
) => async (request: Request): Promise<Response> => {
  let afterAck: (() => Promise<void>) | undefined;
  const response = await handleInteractionRequest(request, {
    config,
    route: async (interaction) => {
      const result = await route(interaction, config);
      afterAck = result.afterAck;
      return new Response(JSON.stringify({ type: result.type, data: result.data }), {
        headers: { 'content-type': 'application/json' },
      });
    },
  });

  if (afterAck) schedule(runAfterResponse(afterAck));
  return response;
};

export default async function interactions(request: Request): Promise<Response> {
  return createInteractionsHandler(loadConfig(process.env))(request);
}