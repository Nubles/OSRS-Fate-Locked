import type { DiscordChannel } from './discord/rest.js';
import { ephemeral } from './discord/responses.js';
import type { DiscordInteraction } from './handlers/interactions.js';
import type { BotConfig } from './types.js';

export const JOURNAL_MODAL_ID = 'journal:create:v1';

type JournalPath = 'Vanilla' | 'Chunked' | 'Custom';

interface JournalSubmission {
  rsn: string;
  path: JournalPath;
  intro: string;
}

interface JournalRest {
  createForumPost(channelId: string, body: unknown): Promise<DiscordChannel>;
  editOriginalInteractionResponse(applicationId: string, interactionToken: string, body: unknown): Promise<unknown>;
}

export interface JournalDeps {
  config: BotConfig;
  rest: JournalRest;
}

export interface JournalInteractionResponse {
  type: number;
  data: { content?: string; components?: unknown[]; flags?: number; allowed_mentions?: unknown; custom_id?: string; title?: string };
  afterAck?: () => Promise<void>;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]/;
const MARKDOWN_CHARACTERS = /[\\`*_[\]{}()#+\-.!|<>]/g;

const textInput = (custom_id: string, label: string, options: Record<string, unknown>) => ({
  type: 1,
  components: [{ type: 4, custom_id, label, style: 1, ...options }],
});

export const journalModal = () => ({
  type: 9,
  data: {
    custom_id: JOURNAL_MODAL_ID,
    title: 'Create run journal',
    components: [
      textInput('rsn', 'OSRS account name', { min_length: 1, max_length: 12, required: true }),
      textInput('path', 'Path', { placeholder: 'Vanilla, Chunked, or Custom', required: true }),
      textInput('intro', 'Introduction', { style: 2, max_length: 500, required: false }),
    ],
  },
});

const modalFields = (interaction: DiscordInteraction): Record<string, string> | null => {
  if (!interaction.data || typeof interaction.data !== 'object') return null;
  const data = interaction.data as { components?: unknown };
  if (!Array.isArray(data.components)) return null;

  const fields: Record<string, string> = {};
  for (const row of data.components) {
    if (!row || typeof row !== 'object') return null;
    const components = (row as { components?: unknown }).components;
    if (!Array.isArray(components)) return null;
    for (const component of components) {
      if (!component || typeof component !== 'object') return null;
      const { custom_id, value } = component as { custom_id?: unknown; value?: unknown };
      if (typeof custom_id !== 'string' || typeof value !== 'string' || fields[custom_id] !== undefined) return null;
      fields[custom_id] = value;
    }
  }
  return fields;
};

const canonicalPath = (value: string): JournalPath | null => {
  switch (value.trim().toLowerCase()) {
    case 'vanilla': return 'Vanilla';
    case 'chunked': return 'Chunked';
    case 'custom': return 'Custom';
    default: return null;
  }
};

export const parseJournalSubmission = (interaction: DiscordInteraction): JournalSubmission | null => {
  const fields = modalFields(interaction);
  if (!fields || typeof fields.rsn !== 'string' || typeof fields.path !== 'string') return null;

  const rsn = fields.rsn.trim();
  const intro = fields.intro ?? '';
  const path = canonicalPath(fields.path);
  if (
    !path ||
    fields.rsn.length > 12 ||
    rsn.length < 1 ||
    intro.length > 500 ||
    CONTROL_CHARACTERS.test(fields.rsn) || CONTROL_CHARACTERS.test(fields.path) || CONTROL_CHARACTERS.test(intro)
  ) return null;

  return { rsn, path, intro };
};

const escapeMarkdown = (value: string): string => value.replace(MARKDOWN_CHARACTERS, '\\$&');

const journalBody = ({ rsn, path, intro }: JournalSubmission): string => [
  '## Account',
  `**RSN:** ${escapeMarkdown(rsn)}`,
  '',
  '## Path',
  path,
  '',
  '## Status',
  'Active',
  '',
  '## Current goals',
  intro ? escapeMarkdown(intro) : 'Add your first goal.',
  '',
  '## Latest fate',
  '_Add your latest fate here._',
  '',
  '## Evidence/links',
  '_Add links or images here._',
].join('\n');

const pathTag = (config: BotConfig, path: JournalPath): string => {
  switch (path) {
    case 'Vanilla': return config.tags.vanilla;
    case 'Chunked': return config.tags.chunked;
    case 'Custom': return config.tags.custom;
  }
};

const interactionToken = (interaction: DiscordInteraction): string | null => {
  const token = interaction.token;
  return typeof token === 'string' && token.length > 0 ? token : null;
};

const retryMessage = {
  content: 'We could not create your journal. Please try again.',
  allowed_mentions: { parse: [] },
};

const createdWithoutLinkMessage = {
  content: 'Your journal was created, but we could not send its link. Please open #run-journals to find it.',
  allowed_mentions: { parse: [] },
};

export const handleJournalSubmit = async (
  interaction: DiscordInteraction,
  deps: JournalDeps,
): Promise<JournalInteractionResponse> => {
  const submission = parseJournalSubmission(interaction);
  const token = interactionToken(interaction);
  if (!submission || !token) return ephemeral('Please check your journal details and try again.');

  return {
    type: 5,
    data: { flags: 64 },
    afterAck: () => Promise.resolve().then(async () => {
      let thread: DiscordChannel;
      try {
        thread = await deps.rest.createForumPost(deps.config.channels.runJournals, {
          name: `[${submission.path}] ${submission.rsn} \u2014 Active`,
          auto_archive_duration: 10080,
          applied_tags: [pathTag(deps.config, submission.path), deps.config.tags.active],
          message: { content: journalBody(submission), allowed_mentions: { parse: [] } },
        });
      } catch {
        try {
          await deps.rest.editOriginalInteractionResponse(deps.config.applicationId, token, retryMessage);
        } catch {
          // The interaction token cannot be safely surfaced or retried.
        }
        return;
      }

      try {
        await deps.rest.editOriginalInteractionResponse(deps.config.applicationId, token, {
          content: `Your run journal is ready: https://discord.com/channels/${deps.config.guildId}/${thread.id}`,
          allowed_mentions: { parse: [] },
        });
      } catch {
        try {
          await deps.rest.editOriginalInteractionResponse(deps.config.applicationId, token, createdWithoutLinkMessage);
        } catch {
          // The journal was created; never invite a duplicate retry after this point.
        }
      }
    }),
  };
};