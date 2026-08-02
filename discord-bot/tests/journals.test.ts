import { describe, expect, it, vi } from 'vitest';
import {
  handleJournalSubmit,
  journalModal,
  parseJournalSubmission,
} from '../src/journals.js';
import type { BotConfig } from '../src/types.js';

const config: BotConfig = {
  applicationId: '100000000000000001',
  publicKey: '0'.repeat(64),
  botToken: 'test-token',
  guildId: '1533446664709341357',
  channels: {
    announcements: '100000000000000002', runJournals: '100000000000000003', verificationQueue: '100000000000000004', auditLog: '100000000000000005', rules: '100000000000000006',
  },
  roles: { moderator: '100000000000000007', administrator: '100000000000000008', fatekeeper: '100000000000000009', verifiedRunner: '100000000000000010', updates: '100000000000000011', weeklySeed: '100000000000000012' },
  tags: { vanilla: '100000000000000013', chunked: '100000000000000014', custom: '100000000000000015', active: '100000000000000016', verified: '100000000000000017' },
  componentHmacKey: 'component-key-at-least-32-bytes-long', automationHmacKey: 'automation-key-at-least-32-bytes-long', allowedRepositories: ['Nubles/OSRS-Fate-Locked'], mutationsEnabled: false,
};

const submission = (values: Record<string, string>) => ({
  type: 5,
  application_id: config.applicationId,
  token: 'private-interaction-token',
  data: {
    custom_id: 'journal:create:v1',
    components: Object.entries(values).map(([custom_id, value]) => ({ type: 1, components: [{ type: 4, custom_id, value }] })),
  },
});

describe('journal modal and validation', () => {
  it('opens the constrained journal creation modal', () => {
    expect(journalModal()).toEqual({
      type: 9,
      data: {
        custom_id: 'journal:create:v1',
        title: 'Create run journal',
        components: [
          { type: 1, components: [{ type: 4, custom_id: 'rsn', label: 'OSRS account name', style: 1, min_length: 1, max_length: 12, required: true }] },
          { type: 1, components: [{ type: 4, custom_id: 'path', label: 'Path', style: 1, placeholder: 'Vanilla, Chunked, or Custom', required: true }] },
          { type: 1, components: [{ type: 4, custom_id: 'intro', label: 'Introduction', style: 2, max_length: 500, required: false }] },
        ],
      },
    });
  });

  it('canonicalizes supported paths and rejects malformed journal fields', () => {
    expect(parseJournalSubmission(submission({ rsn: ' Zezima ', path: 'vAnIlLa', intro: 'First steps' }))).toEqual({
      rsn: 'Zezima', path: 'Vanilla', intro: 'First steps',
    });

    for (const values of [
      { rsn: '', path: 'Vanilla', intro: '' },
      { rsn: 'a'.repeat(13), path: 'Vanilla', intro: '' },
      { rsn: 'Zezima', path: 'Spectator', intro: '' },
      { rsn: 'Zezima\n', path: 'Vanilla', intro: '' },
      { rsn: 'Zezima', path: 'Vanilla', intro: 'a'.repeat(501) },
      { rsn: 'Zezima', path: 'Chunked', intro: 'Bad\u0000intro' },
    ]) {
      expect(parseJournalSubmission(submission(values))).toBeNull();
    }
  });
});

describe('handleJournalSubmit', () => {
  it('defers, creates a configured tagged post, and edits the ephemeral response with its link', async () => {
    const createForumPost = vi.fn(async () => ({ id: '100000000000000099' }));
    const editOriginalInteractionResponse = vi.fn(async () => ({ id: '100000000000000098' }));
    let deferred: Promise<unknown> | undefined;
    const response = await handleJournalSubmit(
      submission({ rsn: 'Zezima', path: 'vanilla', intro: 'Goals *and* [evidence]' }),
      { config, rest: { createForumPost, editOriginalInteractionResponse }, defer: (work) => { deferred = work; } },
    );

    expect(response).toEqual({ type: 5, data: { flags: 64 } });
    await deferred;
    expect(createForumPost).toHaveBeenCalledWith(config.channels.runJournals, {
      name: '[Vanilla] Zezima — Active',
      auto_archive_duration: 10080,
      applied_tags: [config.tags.vanilla, config.tags.active],
      message: {
        content: '## Account\n**RSN:** Zezima\n\n## Path\nVanilla\n\n## Status\nActive\n\n## Current goals\nGoals \\*and\\* \\[evidence\\]\n\n## Latest fate\n_Add your latest fate here._\n\n## Evidence/links\n_Add links or images here._',
        allowed_mentions: { parse: [] },
      },
    });
    expect(editOriginalInteractionResponse).toHaveBeenCalledWith(
      config.applicationId,
      'private-interaction-token',
      { content: 'Your run journal is ready: https://discord.com/channels/1533446664709341357/100000000000000099', allowed_mentions: { parse: [] } },
    );
  });

    it('registers deferred work before starting the forum request', async () => {
    const events: string[] = [];
    const createForumPost = vi.fn(async () => {
      events.push('create');
      return { id: '100000000000000099' };
    });
    const editOriginalInteractionResponse = vi.fn(async () => ({ id: '100000000000000098' }));
    let deferred: Promise<unknown> | undefined;

    const response = handleJournalSubmit(
      submission({ rsn: 'Zezima', path: 'Vanilla', intro: '' }),
      { config, rest: { createForumPost, editOriginalInteractionResponse }, defer: (work) => { events.push('defer'); deferred = work; } },
    );

    expect(events).toEqual(['defer']);
    await response;
    await deferred;
    expect(events).toEqual(['defer', 'create']);
  });
it('edits a generic retry message after one failed create attempt', async () => {
    const createForumPost = vi.fn(async () => { throw new Error('Discord unavailable'); });
    const editOriginalInteractionResponse = vi.fn(async () => ({ id: '100000000000000098' }));
    let deferred: Promise<unknown> | undefined;
    const response = await handleJournalSubmit(
      submission({ rsn: 'Zezima', path: 'Custom', intro: '' }),
      { config, rest: { createForumPost, editOriginalInteractionResponse }, defer: (work) => { deferred = work; } },
    );

    expect(response).toEqual({ type: 5, data: { flags: 64 } });
    await deferred;
    expect(createForumPost).toHaveBeenCalledTimes(1);
    expect(editOriginalInteractionResponse).toHaveBeenCalledWith(
      config.applicationId,
      'private-interaction-token',
      { content: 'We could not create your journal. Please try again.', allowed_mentions: { parse: [] } },
    );
  });
});
