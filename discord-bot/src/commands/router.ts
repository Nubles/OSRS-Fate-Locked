import { weeklySeed } from '../../../utils/seededRng.js';
import { DiscordRestClient } from '../discord/rest.js';
import { ephemeral, linkButton } from '../discord/responses.js';
import { handleJournalSubmit, journalModal, JOURNAL_MODAL_ID } from '../journals.js';
import type { BotConfig } from '../types.js';
import type { DiscordInteraction } from '../handlers/interactions.js';
import { RULES_URL, RUNELITE_GUIDE_URL, TRACKER_URL } from './links.js';

const actionRow = (button: ReturnType<typeof linkButton>) => [{ type: 1, components: [button] }];
const unavailable = () => ephemeral('That interaction is not available.');

type InteractionResponse = {
  type: number;
  data: { content?: string; components?: unknown[]; flags?: number; allowed_mentions?: unknown; custom_id?: string; title?: string };
};

type VercelRequestContext = { get?: () => { waitUntil?: (work: Promise<unknown>) => void } };
const defer = (work: Promise<unknown>): void => {
  const context = (globalThis as { [key: symbol]: VercelRequestContext | undefined })[Symbol.for('@vercel/request-context')];
  context?.get?.().waitUntil?.(work);
};

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
const modalId = (interaction: DiscordInteraction): string | null => {
  if (interaction.type !== 5 || !interaction.data || typeof interaction.data !== 'object') return null;
  const customId = (interaction.data as { custom_id?: unknown }).custom_id;
  return typeof customId === 'string' ? customId : null;
};

export const routeInteraction = async (
  interaction: DiscordInteraction,
  config: BotConfig,
  now = new Date(),
): Promise<InteractionResponse> => {
  if (modalId(interaction) === JOURNAL_MODAL_ID) {
    return handleJournalSubmit(interaction, {
      config,
      rest: new DiscordRestClient({ token: config.botToken }),
      defer,
    });
  }

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
      return hasCreateSubcommand(interaction) ? journalModal() : unavailable();
    case 'verify':
      return ephemeral('Runner verification is not available yet.');
    default:
      return unavailable();
  }
};
