import type { BotConfig } from '../types.js';
import { verifyDiscordRequest } from '../security/discord-signature.js';

export interface DiscordInteraction {
  type: number;
  guild_id?: string;
  [key: string]: unknown;
}

export interface InteractionDeps {
  config: BotConfig;
  route: (interaction: DiscordInteraction) => Promise<Response>;
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const unauthorized = (): Response => json({ error: 'Unauthorized' }, 401);

const parseInteraction = (rawBody: string): DiscordInteraction | null => {
  try {
    const interaction: unknown = JSON.parse(rawBody);
    if (
      !interaction ||
      typeof interaction !== 'object' ||
      !('type' in interaction) ||
      typeof interaction.type !== 'number'
    ) {
      return null;
    }
    return interaction as DiscordInteraction;
  } catch {
    return null;
  }
};

export const handleInteractionRequest = async (
  request: Request,
  deps: InteractionDeps,
): Promise<Response> => {
  const rawBody = await request.text();
  const timestamp = request.headers.get('x-signature-timestamp') ?? '';
  const signature = request.headers.get('x-signature-ed25519') ?? '';

  if (!verifyDiscordRequest(rawBody, timestamp, signature, deps.config.publicKey)) return unauthorized();

  const interaction = parseInteraction(rawBody);
  if (!interaction) return json({ error: 'Invalid interaction' }, 400);

  if (interaction.type === 1) return json({ type: 1 });

  if (interaction.guild_id !== deps.config.guildId) {
    return json({
      type: 4,
      data: { content: 'This app is only available in Fate Locked Ironman.', flags: 64 },
    });
  }

  return deps.route(interaction);
};
