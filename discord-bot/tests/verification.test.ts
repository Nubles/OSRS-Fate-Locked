import { describe, expect, it, vi } from 'vitest';
import { routeInteraction } from '../src/commands/router.js';
import { signComponentId, verifyComponentId } from '../src/security/signed-id.js';
import type { BotConfig } from '../src/types.js';
import {
  handleVerificationSubmit,
  handleVerificationComponent,
  handleVerificationReasonSubmit,
  parseJournalUrl,
  verificationModal,
} from '../src/verification.js';

const config: BotConfig = {
  applicationId: '100000000000000001',
  publicKey: '0'.repeat(64),
  botToken: 'test-token',
  guildId: '1533446664709341357',
  channels: {
    announcements: '100000000000000002',
    runJournals: '100000000000000003',
    verificationQueue: '100000000000000004',
    auditLog: '100000000000000005',
    rules: '100000000000000006',
  },
  roles: {
    moderator: '100000000000000007',
    administrator: '100000000000000008',
    fatekeeper: '100000000000000009',
    verifiedRunner: '100000000000000010',
    updates: '100000000000000011',
    weeklySeed: '100000000000000012',
  },
  tags: {
    vanilla: '100000000000000013',
    chunked: '100000000000000014',
    custom: '100000000000000015',
    active: '100000000000000016',
    verified: '100000000000000017',
  },
  componentHmacKey: 'component-key-at-least-32-bytes-long',
  automationHmacKey: 'automation-key-at-least-32-bytes-long',
  allowedRepositories: ['Nubles/OSRS-Fate-Locked'],
  mutationsEnabled: true,
};

const applicantId = '100000000000000020';
const threadId = '100000000000000021';

const modalSubmission = (values: Record<string, string>, ownerId = applicantId) => ({
  type: 5,
  application_id: config.applicationId,
  token: 'private-interaction-token',
  member: { user: { id: ownerId } },
  data: {
    custom_id: 'verify:submit:v1',
    components: Object.entries(values).map(([custom_id, value]) => ({
      type: 1,
      components: [{ type: 4, custom_id, value }],
    })),
  },
});

const restForSubmission = (overrides: Record<string, unknown> = {}): any => ({
  getChannel: vi.fn(async () => ({ id: threadId, parent_id: config.channels.runJournals, owner_id: applicantId, applied_tags: [config.tags.active] })),
  getChannelMessages: vi.fn(async () => []),
  getMessage: vi.fn(async () => ({ id: '100000000000000030' })),
  createMessage: vi.fn(async () => ({ id: '100000000000000031' })),
  editMessage: vi.fn(async () => ({ id: '100000000000000030' })),
  editThread: vi.fn(async () => ({ id: threadId })),
  getGuildMember: vi.fn(async () => ({ roles: [] })),
  getGuildRoles: vi.fn(async () => []),
  addGuildMemberRole: vi.fn(async () => undefined),
  editOriginalInteractionResponse: vi.fn(async () => ({ id: '100000000000000032' })),
  ...overrides,
});

const validFields = {
  journal_url: `https://discord.com/channels/${config.guildId}/${threadId}`,
  evidence_summary: 'Completed the current verified-run evidence checklist.',
  evidence_url: 'https://example.test/private-evidence',
};

describe('verification modal and applicant journal validation', () => {
  it('opens /verify as the constrained verification modal', async () => {
    expect(verificationModal()).toEqual({
      type: 9,
      data: {
        custom_id: 'verify:submit:v1',
        title: 'Runner verification',
        components: [
          { type: 1, components: [{ type: 4, custom_id: 'journal_url', label: 'Run journal URL', style: 1, max_length: 200, required: true }] },
          { type: 1, components: [{ type: 4, custom_id: 'evidence_summary', label: 'Evidence summary', style: 2, max_length: 1000, required: true }] },
          { type: 1, components: [{ type: 4, custom_id: 'evidence_url', label: 'Evidence URL (optional)', style: 1, max_length: 500, required: false }] },
        ],
      },
    });

    await expect(routeInteraction({ type: 2, data: { name: 'verify' } }, config)).resolves.toEqual(verificationModal());
  });

  it('accepts only HTTPS Fate Locked Discord journal thread URLs', () => {
    expect(parseJournalUrl(`https://discord.com/channels/${config.guildId}/${threadId}`)).toBe(threadId);
    expect(parseJournalUrl(`https://discordapp.com/channels/${config.guildId}/${threadId}`)).toBe(threadId);

    for (const value of [
      `https://discord.com/channels/100000000000000099/${threadId}`,
      `http://discord.com/channels/${config.guildId}/${threadId}`,
      `https://discord.com/channels/${config.guildId}`,
      `https://example.test/channels/${config.guildId}/${threadId}`,
      `https://discord.com/channels/${config.guildId}/${threadId}/100000000000000022`,
    ]) expect(parseJournalUrl(value)).toBeNull();
  });

  it('defers before validating the applicant-owned journal, then queues a non-pinging card', async () => {
    const rest = restForSubmission();
    const response = handleVerificationSubmit(modalSubmission(validFields), { config, rest }, new Date('2026-08-02T12:00:00Z'));

    expect(response).toMatchObject({ type: 5, data: { flags: 64 } });
    expect(rest.getChannel).not.toHaveBeenCalled();
    await response.afterAck?.();

    expect(rest.getChannel).toHaveBeenCalledWith(threadId);
    expect(rest.getChannelMessages).toHaveBeenCalledWith(config.channels.verificationQueue, 100);
    expect(rest.createMessage).toHaveBeenCalledWith(config.channels.verificationQueue, expect.objectContaining({
      allowed_mentions: { parse: [] },
      embeds: [expect.objectContaining({
        timestamp: '2026-08-02T12:00:00.000Z',
        footer: { text: `FLV1 applicant=${applicantId} thread=${threadId} state=open` },
      })],
    }));

    const card = rest.createMessage.mock.calls[0]?.[1] as { components: Array<{ components: Array<{ custom_id: string }> }> };
    const componentIds = card.components.flatMap((row) => row.components.map((component) => component.custom_id));
    expect(componentIds).toHaveLength(5);
    for (const id of componentIds) {
      expect(verifyComponentId(id, config.componentHmacKey, 1_754_136_000)).toMatchObject({ applicantId, threadId });
    }
    expect(rest.editOriginalInteractionResponse).toHaveBeenCalledWith(config.applicationId, 'private-interaction-token', {
      content: 'Your verification request has been submitted for staff review.',
      allowed_mentions: { parse: [] },
    });
  });

  it('rejects a journal whose live owner or parent does not match the applicant', async () => {
    const rest = restForSubmission({
      getChannel: vi.fn(async () => ({ id: threadId, parent_id: config.channels.runJournals, owner_id: '100000000000000099' })),
    });
    const response = handleVerificationSubmit(modalSubmission(validFields), { config, rest });

    await response.afterAck?.();

    expect(rest.createMessage).not.toHaveBeenCalled();
    expect(rest.getChannelMessages).not.toHaveBeenCalled();
    expect(rest.editOriginalInteractionResponse).toHaveBeenCalledWith(config.applicationId, 'private-interaction-token', expect.objectContaining({
      content: 'We could not validate that run journal for your account.',
      allowed_mentions: { parse: [] },
    }));
  });

  it('fails closed when an exact bot marker already exists or queue history cannot be read', async () => {
    const duplicate = restForSubmission({
      getChannelMessages: vi.fn(async () => [{
        author: { id: config.applicationId },
        embeds: [{ footer: { text: `FLV1 applicant=${applicantId} thread=${threadId} state=recommended_approve` } }],
      }]),
    });
    const duplicateResponse = handleVerificationSubmit(modalSubmission(validFields), { config, rest: duplicate });
    await duplicateResponse.afterAck?.();
    expect(duplicate.createMessage).not.toHaveBeenCalled();
    expect(duplicate.editOriginalInteractionResponse).toHaveBeenCalledWith(config.applicationId, 'private-interaction-token', expect.objectContaining({
      content: 'You already have a verification request awaiting staff action.',
    }));

    const unavailable = restForSubmission({ getChannelMessages: vi.fn(async () => { throw new Error('history unavailable'); }) });
    const unavailableResponse = handleVerificationSubmit(modalSubmission(validFields), { config, rest: unavailable });
    await unavailableResponse.afterAck?.();
    expect(unavailable.createMessage).not.toHaveBeenCalled();
    expect(unavailable.editOriginalInteractionResponse).toHaveBeenCalledWith(config.applicationId, 'private-interaction-token', expect.objectContaining({
      content: 'We could not safely check the verification queue. Please try again later.',
    }));
  });
});

const queueMessageId = '100000000000000030';
const fatekeeperId = '100000000000000040';
const moderatorId = '100000000000000041';
const administratorId = '100000000000000042';
const memberId = '100000000000000043';
const runnerId = '100000000000000044';
const controlNow = new Date('2026-08-02T12:00:00Z');

const queueCard = (state = 'open') => ({
  id: queueMessageId,
  author: { id: config.applicationId },
  embeds: [{ footer: { text: `FLV1 applicant=${applicantId} thread=${threadId} state=${state}` } }],
});

const signedAction = (action: 'needs_info' | 'recommend' | 'recommend_reject' | 'approve' | 'reject' | 'retry_tag') => signComponentId({
  action,
  applicantId,
  threadId,
  expiresAt: 1_900_000_000,
}, config.componentHmacKey);

const componentInteraction = (actorId: string, action: 'needs_info' | 'recommend' | 'recommend_reject' | 'approve' | 'reject' | 'retry_tag', payloadRoles: string[] = []) => ({
  type: 3,
  token: 'private-interaction-token',
  member: { user: { id: actorId }, roles: payloadRoles },
  message: { id: queueMessageId },
  data: { custom_id: signedAction(action) },
});

const restForAction = (actorId: string, actorRoles: readonly string[], state = 'open') => restForSubmission({
  getMessage: vi.fn(async () => queueCard(state)),
  getGuildMember: vi.fn(async (_guildId: string, userId: string) => {
    if (userId === actorId) return { roles: [...actorRoles] };
    if (userId === config.applicationId) return { roles: ['100000000000000050'] };
    return { roles: [] };
  }),
  getGuildRoles: vi.fn(async () => [
    { id: config.roles.verifiedRunner, position: 5 },
    { id: '100000000000000050', position: 10 },
  ]),
});

describe('live staff boundaries', () => {
  it.each(['needs_info', 'recommend', 'recommend_reject'] as const)(
    'allows a live Fatekeeper to open the signed %s reason modal without mutation',
    async (action) => {
      const rest = restForAction(fatekeeperId, [config.roles.fatekeeper]);
      const response = await handleVerificationComponent(componentInteraction(fatekeeperId, action), { config, rest }, controlNow);

      expect(response).toMatchObject({
        type: 9,
        data: {
          title: 'Verification reason',
          components: [{ type: 1, components: [{ type: 4, custom_id: 'reason', style: 2, min_length: 1, max_length: 500, required: true }] }],
        },
      });
      const customId = (response as { data: { custom_id: string } }).data.custom_id;
      expect(verifyComponentId(customId, config.componentHmacKey, 1_785_672_000)).toMatchObject({ action, applicantId, threadId });
      expect(rest.getGuildMember).toHaveBeenCalledWith(config.guildId, fatekeeperId);
      expect(rest.getMessage).toHaveBeenCalledWith(config.channels.verificationQueue, queueMessageId);
      expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
      expect(rest.editThread).not.toHaveBeenCalled();
      expect(rest.editMessage).not.toHaveBeenCalled();
    },
  );

  it('denies Fatekeeper final controls and ignores stale payload role data without mutation', async () => {
    const fatekeeper = restForAction(fatekeeperId, [config.roles.fatekeeper]);
    const fatekeeperResponse = await handleVerificationComponent(componentInteraction(fatekeeperId, 'approve'), { config, rest: fatekeeper }, controlNow);
    expect(fatekeeperResponse).toMatchObject({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] } } });

    const stale = restForAction(moderatorId, []);
    const staleResponse = await handleVerificationComponent(componentInteraction(moderatorId, 'approve', [config.roles.moderator]), { config, rest: stale }, controlNow);
    expect(staleResponse).toMatchObject({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] } } });

    for (const rest of [fatekeeper, stale]) {
      expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
      expect(rest.editThread).not.toHaveBeenCalled();
      expect(rest.editMessage).not.toHaveBeenCalled();
      expect(rest.createMessage).not.toHaveBeenCalled();
    }
  });

  it('allows Moderator and Administrator final controls but denies Members and Verified Runners', async () => {
    const moderator = restForAction(moderatorId, [config.roles.moderator]);
    const approval = await handleVerificationComponent(componentInteraction(moderatorId, 'approve'), { config, rest: moderator }, controlNow);
    expect(approval).toMatchObject({ type: 5, data: { flags: 64 } });

    const administrator = restForAction(administratorId, [config.roles.administrator]);
    const rejection = await handleVerificationComponent(componentInteraction(administratorId, 'reject'), { config, rest: administrator }, controlNow);
    expect(rejection).toMatchObject({ type: 9, data: { title: 'Verification reason' } });

    for (const [actorId, roles] of [[memberId, []], [runnerId, [config.roles.verifiedRunner]]] as const) {
      const rest = restForAction(actorId, roles);
      const response = await handleVerificationComponent(componentInteraction(actorId, 'approve'), { config, rest }, controlNow);
      expect(response).toMatchObject({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] } } });
      expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
      expect(rest.editThread).not.toHaveBeenCalled();
      expect(rest.editMessage).not.toHaveBeenCalled();
    }
  });
});

const reasonSubmission = (actorId: string, action: 'needs_info' | 'recommend' | 'recommend_reject' | 'reject', reason: string) => ({
  type: 5,
  token: 'private-interaction-token',
  member: { user: { id: actorId } },
  data: {
    custom_id: signedAction(action),
    components: [{ type: 1, components: [{ type: 4, custom_id: 'reason', value: reason }] }],
  },
});

const footerText = (body: unknown): string => {
  const value = body as { embeds: Array<{ footer: { text: string } }> };
  return value.embeds[0]?.footer.text ?? '';
};

describe('reasoned staff actions', () => {
  it('posts Needs Info to the validated journal before moving the private card state', async () => {
    const calls: string[] = [];
    const rest = restForAction(fatekeeperId, [config.roles.fatekeeper]);
    rest.getChannelMessages = vi.fn(async () => [queueCard('open')]);
    rest.getChannel = vi.fn(async () => ({ id: threadId, parent_id: config.channels.runJournals, owner_id: applicantId }));
    rest.createMessage = vi.fn(async (channelId: string, body: unknown) => {
      calls.push(channelId === threadId ? 'journal' : 'audit');
      expect((body as { allowed_mentions: unknown }).allowed_mentions).toEqual({ parse: [] });
      return { id: '100000000000000060' };
    });
    rest.editMessage = vi.fn(async (_channelId: string, _messageId: string, body: unknown) => {
      calls.push('card');
      expect(footerText(body)).toBe(`FLV1 applicant=${applicantId} thread=${threadId} state=needs_info`);
      return { id: queueMessageId };
    });

    const response = handleVerificationReasonSubmit(
      reasonSubmission(fatekeeperId, 'needs_info', 'Please add the final completion screenshot.'),
      { config, rest },
      controlNow,
    );
    expect(response).toMatchObject({ type: 5, data: { flags: 64 } });
    expect(rest.getGuildMember).not.toHaveBeenCalled();
    await response.afterAck?.();

    expect(calls).toEqual(['journal', 'card', 'audit']);
    expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
    expect(rest.editThread).not.toHaveBeenCalled();
  });

  it('records recommendations only on the private card and keeps final controls available', async () => {
    const rest = restForAction(fatekeeperId, [config.roles.fatekeeper]);
    rest.getChannelMessages = vi.fn(async () => [queueCard('open')]);
    const response = handleVerificationReasonSubmit(
      reasonSubmission(fatekeeperId, 'recommend_reject', 'The evidence does not show the final task.'),
      { config, rest },
      controlNow,
    );
    await response.afterAck?.();

    expect(rest.editMessage).toHaveBeenCalledWith(config.channels.verificationQueue, queueMessageId, expect.anything());
    const card = rest.editMessage.mock.calls[0]?.[2] as { embeds: Array<{ footer: { text: string }, fields: Array<{ value: string }> }>; components: Array<{ components: Array<{ disabled?: boolean }> }> };
    expect(card.embeds[0]?.footer.text).toBe(`FLV1 applicant=${applicantId} thread=${threadId} state=recommended_reject`);
    expect(card.embeds[0]?.fields.map((field) => field.value)).toContain('The evidence does not show the final task.');
    expect(card.components[0]?.components.some((component) => component.disabled)).toBe(false);
    expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
    expect(rest.editThread).not.toHaveBeenCalled();
  });

  it('approves in role, tag, card, and sanitized-audit order', async () => {
    const calls: string[] = [];
    const rest = restForAction(moderatorId, [config.roles.moderator]);
    rest.getGuildMember = vi.fn(async (_guildId: string, userId: string) => {
      calls.push(`member:${userId}`);
      if (userId === moderatorId) return { roles: [config.roles.moderator] };
      if (userId === config.applicationId) return { roles: ['100000000000000050'] };
      return { roles: [] };
    });
    rest.getChannel = vi.fn(async () => {
      calls.push('journal');
      return { id: threadId, parent_id: config.channels.runJournals, owner_id: applicantId, applied_tags: [config.tags.active, config.tags.vanilla, config.tags.active] };
    });
    rest.getGuildRoles = vi.fn(async () => {
      calls.push('roles');
      return [{ id: config.roles.verifiedRunner, position: 5 }, { id: '100000000000000050', position: 10 }];
    });
    rest.getMessage = vi.fn(async () => {
      calls.push('queue');
      return queueCard('open');
    });
    rest.addGuildMemberRole = vi.fn(async () => { calls.push('role'); });
    rest.editThread = vi.fn(async (_thread: string, body: unknown) => {
      calls.push('tag');
      expect(body).toEqual({ applied_tags: [config.tags.active, config.tags.vanilla, config.tags.verified] });
      return { id: threadId };
    });
    rest.editMessage = vi.fn(async (_channel: string, _message: string, body: unknown) => {
      calls.push('card');
      expect(footerText(body)).toBe(`FLV1 applicant=${applicantId} thread=${threadId} state=approved`);
      const components = (body as { components: Array<{ components: Array<{ disabled?: boolean }> }> }).components;
      expect(components.flatMap((row) => row.components).every((component) => component.disabled === true)).toBe(true);
      return { id: queueMessageId };
    });
    rest.createMessage = vi.fn(async (channelId: string, body: unknown) => {
      if (channelId === config.channels.auditLog) {
        calls.push('audit');
        const content = (body as { content: string }).content;
        expect(content).toContain(`actor_id=${moderatorId}`);
        expect(content).not.toContain(validFields.evidence_summary);
        expect(content).not.toContain(validFields.evidence_url);
      }
      return { id: '100000000000000061' };
    });

    const response = await handleVerificationComponent(componentInteraction(moderatorId, 'approve'), { config, rest }, controlNow);
    await response.afterAck?.();

    expect(calls).toEqual([
      `member:${moderatorId}`,
      `member:${applicantId}`,
      'journal',
      'roles',
      `member:${config.applicationId}`,
      'queue',
      'role',
      'tag',
      'card',
      'audit',
    ]);
  });

  it('fails closed before role/tag mutation when mutations are disabled, hierarchy fails, or the journal is invalid', async () => {
    const scenarios = [
      { config: { ...config, mutationsEnabled: false }, channel: { id: threadId, parent_id: config.channels.runJournals, owner_id: applicantId }, botPosition: 10 },
      { config, channel: { id: threadId, parent_id: config.channels.runJournals, owner_id: applicantId }, botPosition: 5 },
      { config, channel: { id: threadId, parent_id: config.channels.runJournals, owner_id: '100000000000000099' }, botPosition: 10 },
    ];

    for (const scenario of scenarios) {
      const rest = restForAction(moderatorId, [config.roles.moderator]);
      rest.getGuildMember = vi.fn(async (_guildId: string, userId: string) => {
        if (userId === moderatorId) return { roles: [config.roles.moderator] };
        if (userId === scenario.config.applicationId) return { roles: ['100000000000000050'] };
        return { roles: [] };
      });
      rest.getChannel = vi.fn(async () => scenario.channel);
      rest.getGuildRoles = vi.fn(async () => [{ id: scenario.config.roles.verifiedRunner, position: 5 }, { id: '100000000000000050', position: scenario.botPosition }]);
      rest.getMessage = vi.fn(async () => queueCard('open'));

      const response = await handleVerificationComponent(componentInteraction(moderatorId, 'approve'), { config: scenario.config, rest }, controlNow);
      await response.afterAck?.();

      expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
      expect(rest.editThread).not.toHaveBeenCalled();
      expect(rest.editMessage).not.toHaveBeenCalled();
    }
  });

  it('keeps the role and exposes only signed tag recovery after a tag failure, then recovers without touching the role', async () => {
    const failedTag = restForAction(moderatorId, [config.roles.moderator]);
    failedTag.getGuildMember = vi.fn(async (_guildId: string, userId: string) => {
      if (userId === moderatorId) return { roles: [config.roles.moderator] };
      if (userId === config.applicationId) return { roles: ['100000000000000050'] };
      return { roles: [] };
    });
    failedTag.getGuildRoles = vi.fn(async () => [{ id: config.roles.verifiedRunner, position: 5 }, { id: '100000000000000050', position: 10 }]);
    failedTag.getMessage = vi.fn(async () => queueCard('open'));
    failedTag.editThread = vi.fn(async () => { throw new Error('tag update failed'); });
    const failedResponse = await handleVerificationComponent(componentInteraction(moderatorId, 'approve'), { config, rest: failedTag }, controlNow);
    await failedResponse.afterAck?.();
    expect(failedTag.addGuildMemberRole).toHaveBeenCalledTimes(1);
    expect(failedTag.editMessage).toHaveBeenCalledWith(config.channels.verificationQueue, queueMessageId, expect.anything());
    const partial = failedTag.editMessage.mock.calls[0]?.[2] as { embeds: Array<{ footer: { text: string } }>; components: Array<{ components: Array<{ custom_id: string }> }> };
    expect(partial.embeds[0]?.footer.text).toBe(`FLV1 applicant=${applicantId} thread=${threadId} state=partial_tag`);
    const retryId = partial.components[0]?.components[0]?.custom_id ?? '';
    expect(verifyComponentId(retryId, config.componentHmacKey, 1_785_672_000)?.action).toBe('retry_tag');

    const recovered = restForAction(moderatorId, [config.roles.moderator], 'partial_tag');
    recovered.getGuildMember = vi.fn(async () => ({ roles: [config.roles.moderator] }));
    recovered.getMessage = vi.fn(async () => queueCard('partial_tag'));
    const recoveredResponse = await handleVerificationComponent(componentInteraction(moderatorId, 'retry_tag'), { config, rest: recovered }, controlNow);
    await recoveredResponse.afterAck?.();
    expect(recovered.addGuildMemberRole).not.toHaveBeenCalled();
    expect(recovered.editThread).toHaveBeenCalledTimes(1);
    const finalCard = recovered.editMessage.mock.calls[0]?.[2] as { embeds: Array<{ footer: { text: string } }> };
    expect(finalCard.embeds[0]?.footer.text).toBe(`FLV1 applicant=${applicantId} thread=${threadId} state=approved`);
  });

  it('rejects without role/tag mutation and keeps reasons out of the audit entry', async () => {
    const rest = restForAction(moderatorId, [config.roles.moderator]);
    rest.getChannelMessages = vi.fn(async () => [queueCard('open')]);
    const auditBodies: unknown[] = [];
    rest.createMessage = vi.fn(async (channelId: string, body: unknown) => {
      if (channelId === config.channels.auditLog) auditBodies.push(body);
      return { id: '100000000000000062' };
    });
    const response = handleVerificationReasonSubmit(
      reasonSubmission(moderatorId, 'reject', 'Private review reason.'),
      { config, rest },
      controlNow,
    );
    await response.afterAck?.();

    expect(rest.addGuildMemberRole).not.toHaveBeenCalled();
    expect(rest.editThread).not.toHaveBeenCalled();
    const rejection = rest.editMessage.mock.calls[0]?.[2] as { embeds: Array<{ footer: { text: string }, fields: Array<{ value: string }> }>; components: Array<{ components: Array<{ disabled?: boolean }> }> };
    expect(rejection.embeds[0]?.footer.text).toBe(`FLV1 applicant=${applicantId} thread=${threadId} state=rejected`);
    expect(rejection.embeds[0]?.fields.map((field) => field.value)).toContain('Private review reason.');
    expect(rejection.components.flatMap((row) => row.components).every((component) => component.disabled === true)).toBe(true);
    expect(JSON.stringify(auditBodies)).not.toContain('Private review reason.');
    expect(JSON.stringify(auditBodies)).not.toContain(validFields.evidence_url);
  });
});

describe('verification reason validation', () => {
  it('rejects a reason whose submitted value exceeds 500 characters before any REST work', () => {
    const rest = restForAction(fatekeeperId, [config.roles.fatekeeper]);
    const response = handleVerificationReasonSubmit(
      reasonSubmission(fatekeeperId, 'needs_info', ` ${'x'.repeat(500)}`),
      { config, rest },
      controlNow,
    );

    expect(response).toMatchObject({ type: 4, data: { flags: 64, allowed_mentions: { parse: [] } } });
    expect(rest.getGuildMember).not.toHaveBeenCalled();
    expect(rest.getChannelMessages).not.toHaveBeenCalled();
  });
});

describe('approval failure containment', () => {
  it('does not tag or close the card after a role failure, and treats a closed-card replay as stale', async () => {
    const roleFailure = restForAction(moderatorId, [config.roles.moderator]);
    roleFailure.addGuildMemberRole = vi.fn(async () => { throw new Error('role write failed'); });
    const failedResponse = await handleVerificationComponent(componentInteraction(moderatorId, 'approve'), { config, rest: roleFailure }, controlNow);
    await failedResponse.afterAck?.();
    expect(roleFailure.editThread).not.toHaveBeenCalled();
    expect(roleFailure.editMessage).not.toHaveBeenCalled();
    expect(roleFailure.createMessage).toHaveBeenCalledWith(config.channels.auditLog, expect.objectContaining({ allowed_mentions: { parse: [] } }));

    const replay = restForAction(moderatorId, [config.roles.moderator], 'approved');
    const replayResponse = await handleVerificationComponent(componentInteraction(moderatorId, 'approve'), { config, rest: replay }, controlNow);
    await replayResponse.afterAck?.();
    expect(replay.addGuildMemberRole).not.toHaveBeenCalled();
    expect(replay.editThread).not.toHaveBeenCalled();
    expect(replay.editMessage).not.toHaveBeenCalled();
    expect(replay.editOriginalInteractionResponse).toHaveBeenCalledWith(config.applicationId, 'private-interaction-token', {
      content: 'That verification control is no longer current.',
      allowed_mentions: { parse: [] },
    });
  });
});
