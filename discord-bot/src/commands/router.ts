import { weeklySeed } from '../../../utils/seededRng.js';
import { ephemeral, linkButton } from '../discord/responses.js';
import type { BotConfig } from '../types.js';
import type { DiscordInteraction } from '../handlers/interactions.js';
import { RULES_URL, RUNELITE_GUIDE_URL, TRACKER_URL } from './links.js';

const actionRow = (button: ReturnType<typeof linkButton>) => [{ type: 1, components: [button] }];
const unavailable = () => ephemeral('That interaction is not available.');

const commandName = (interaction: DiscordInteraction): string | null => {
  if (interaction.type !== 2 || !interaction.data || typeof interaction.data !== 'object') return null;
  const name = (interaction.data as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
};

const hasCreateSubcommand = (interaction: DiscordInteraction): boolean => {
  if (!interaction.data || typeof interaction.data !== 'object') return false;
  const options = (interaction.data as { options?: unknown }).options;
  return Array.isArray(options) && options.length === 1 && options[0] !== null && typeof options[0] === 'object'
    && (options[0] as { type?: unknown; name?: unknown }).type === 1
    && (options[0] as { name?: unknown }).name === 'create';
};

export const routeInteraction = async (
  interaction: DiscordInteraction,
  config: BotConfig,
  now = new Date(),
) => {
  switch (commandName(interaction)) {
    case 'tracker':
      return ephemeral('Open the Fate Locked tracker.', actionRow(linkButton('Fate Locked tracker', TRACKER_URL)));
    case 'runelite':
      return ephemeral('Open the Fate Locked RuneLite guide.', actionRow(linkButton('RuneLite guide', RUNELITE_GUIDE_URL)));
    case 'rules':
      return ephemeral(`Read the rules in <#${config.channels.rules}>.`, actionRow(linkButton('Rules', RULES_URL)));
    case 'weekly-seed':
      return ephemeral(`This week's Fate Locked seed is ${weeklySeed(now)}.`);
    case 'journal':
      return hasCreateSubcommand(interaction) ? ephemeral('Journal creation is not available yet.') : unavailable();
    case 'verify':
      return ephemeral('Runner verification is not available yet.');
    default:
      return unavailable();
  }
};
