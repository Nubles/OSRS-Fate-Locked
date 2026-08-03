import { FATE_LOCKED_GUILD_ID } from './config.js';
import { markerFromBotMessage, parseVerificationMarker, verificationMarker } from './markers.js';
import { ephemeral } from './discord/responses.js';
import type { DiscordChannel, DiscordGuildMember, DiscordMessage, DiscordRole, DiscordUser } from './discord/rest.js';
import type { JournalInteractionResponse } from './journals.js';
import { signComponentId, signReasonModalId, verifyComponentId, verifyReasonModalId } from './security/signed-id.js';
import type { ComponentAction } from './security/signed-id.js';
import type { DiscordInteraction } from './handlers/interactions.js';
import type { BotConfig } from './types.js';

export const VERIFY_SUBMIT_MODAL_ID = 'verify:submit:v1';

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const SNOWFLAKE = /^\d{17,20}$/;
const JOURNAL_URL = new RegExp(`^https://(?:discord\\.com|discordapp\\.com)/channels/${FATE_LOCKED_GUILD_ID}/(\\d{17,20})$`);


export interface VerificationRest {
  getCurrentUser(): Promise<DiscordUser>;
  getChannel(channelId: string): Promise<DiscordChannel>;
  getChannelMessages(channelId: string, limit?: number): Promise<DiscordMessage[]>;
  getMessage(channelId: string, messageId: string): Promise<DiscordMessage>;
  createMessage(channelId: string, body: unknown): Promise<DiscordMessage>;
  editMessage(channelId: string, messageId: string, body: unknown): Promise<DiscordMessage>;
  editThread(threadId: string, body: unknown): Promise<DiscordChannel>;
  getGuildMember(guildId: string, userId: string): Promise<DiscordGuildMember>;
  getGuildRoles(guildId: string): Promise<DiscordRole[]>;
  addGuildMemberRole(guildId: string, userId: string, roleId: string): Promise<void>;
  editOriginalInteractionResponse(applicationId: string, interactionToken: string, body: unknown): Promise<DiscordMessage>;
}

export interface VerificationDeps {
  config: BotConfig;
  rest: VerificationRest;
}

interface VerificationSubmission {
  journalUrl: string;
  evidenceSummary: string;
  evidenceUrl?: string;
  applicantId: string;
  interactionToken: string;
}

const textInput = (custom_id: string, label: string, options: Record<string, unknown>) => ({
  type: 1,
  components: [{ type: 4, custom_id, label, ...options }],
});

export const verificationModal = () => ({
  type: 9,
  data: {
    custom_id: VERIFY_SUBMIT_MODAL_ID,
    title: 'Runner verification',
    components: [
      textInput('journal_url', 'Run journal URL', { style: 1, max_length: 200, required: true }),
      textInput('evidence_summary', 'Evidence summary', { style: 2, max_length: 1000, required: true }),
      textInput('evidence_url', 'Evidence URL (optional)', { style: 1, max_length: 500, required: false }),
    ],
  },
});

export const parseJournalUrl = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = JOURNAL_URL.exec(value);
  return match?.[1] ?? null;
};

const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;

const modalFields = (interaction: DiscordInteraction): Record<string, string> | null => {
  const data = object(interaction.data);
  if (!data || !Array.isArray(data.components)) return null;

  const fields: Record<string, string> = {};
  for (const row of data.components) {
    const rowRecord = object(row);
    if (!rowRecord || !Array.isArray(rowRecord.components)) return null;
    for (const component of rowRecord.components) {
      const componentRecord = object(component);
      const customId = componentRecord?.custom_id;
      const value = componentRecord?.value;
      if (typeof customId !== 'string' || typeof value !== 'string' || fields[customId] !== undefined) return null;
      fields[customId] = value;
    }
  }
  return fields;
};

const applicantId = (interaction: DiscordInteraction): string | null => {
  const member = object(interaction.member);
  const user = object(member?.user);
  return typeof user?.id === 'string' && SNOWFLAKE.test(user.id) ? user.id : null;
};

const interactionToken = (interaction: DiscordInteraction): string | null =>
  typeof interaction.token === 'string' && interaction.token.length > 0 ? interaction.token : null;

const submissionFrom = (interaction: DiscordInteraction): VerificationSubmission | null => {
  const fields = modalFields(interaction);
  const ownerId = applicantId(interaction);
  const token = interactionToken(interaction);
  if (!fields || !ownerId || !token) return null;

  const journalUrl = fields.journal_url;
  const evidenceSummary = fields.evidence_summary;
  const evidenceUrl = fields.evidence_url;
  if (
    typeof journalUrl !== 'string' ||
    typeof evidenceSummary !== 'string' ||
    (evidenceUrl !== undefined && typeof evidenceUrl !== 'string') ||
    journalUrl.length === 0 || journalUrl.length > 200 ||
    evidenceSummary.length === 0 || evidenceSummary.length > 1000 ||
    (evidenceUrl !== undefined && evidenceUrl.length > 500) ||
    !parseJournalUrl(journalUrl)
  ) return null;

  return {
    journalUrl,
    evidenceSummary,
    ...(evidenceUrl ? { evidenceUrl } : {}),
    applicantId: ownerId,
    interactionToken: token,
  };
};

const deferred = (afterAck: () => Promise<void>): JournalInteractionResponse => ({
  type: 5,
  data: { flags: 64 },
  afterAck,
});

const safeEditOriginal = async (
  deps: VerificationDeps,
  token: string,
  content: string,
): Promise<void> => {
  try {
    await deps.rest.editOriginalInteractionResponse(deps.config.applicationId, token, {
      content,
      allowed_mentions: { parse: [] },
    });
  } catch {
    // Interaction webhook tokens are private and deliberately never logged.
  }
};

type AuditDetails = { actorId: string; applicantId: string; threadId: string; action: string; outcome: string; now: Date };

const safeAudit = async (deps: VerificationDeps, details: AuditDetails): Promise<boolean> => {
  const timestamp = details.now.toISOString();
  try {
    await deps.rest.createMessage(deps.config.channels.auditLog, {
      content: `Verification audit actor_id=${details.actorId} applicant_id=${details.applicantId} thread_id=${details.threadId} action=${details.action} outcome=${details.outcome} timestamp=${timestamp}`,
      allowed_mentions: { parse: [] },
    });
    return true;
  } catch {
    return false;
  }
};

const auditAndEditOriginal = async (deps: VerificationDeps, details: AuditDetails, token: string, content: string): Promise<void> => {
  const delivered = await safeAudit(deps, details);
  await safeEditOriginal(deps, token, delivered
    ? content
    : `${content} The audit log could not be delivered. Do not retry; contact an administrator.`);
};

const componentButton = (
  action: ComponentAction,
  label: string,
  style: number,
  applicant: string,
  thread: string,
  config: BotConfig,
  now: Date,
  disabled = false,
) => ({
  type: 2,
  style,
  label,
  custom_id: signComponentId({
    action,
    applicantId: applicant,
    threadId: thread,
    expiresAt: Math.floor(now.getTime() / 1000) + SEVEN_DAYS_SECONDS,
  }, config.componentHmacKey),
  disabled,
});

const controls = (applicant: string, thread: string, state: string, config: BotConfig, now: Date): unknown[] => {
  if (state === 'partial_tag') {
    return [{ type: 1, components: [componentButton('retry_tag', 'Retry verified tag', 1, applicant, thread, config, now)] }];
  }

  const closed = state === 'approved' || state === 'rejected';
  return [{
    type: 1,
    components: [
      componentButton('needs_info', 'Needs info', 2, applicant, thread, config, now, closed),
      componentButton('recommend', 'Recommend approval', 1, applicant, thread, config, now, closed),
      componentButton('recommend_reject', 'Recommend rejection', 2, applicant, thread, config, now, closed),
      componentButton('approve', 'Approve', 3, applicant, thread, config, now, closed),
      componentButton('reject', 'Reject', 4, applicant, thread, config, now, closed),
    ],
  }];
};

const queueCard = (
  submission: VerificationSubmission,
  thread: string,
  state: string,
  config: BotConfig,
  now: Date,
) => ({
  embeds: [{
    title: 'Runner verification request',
    description: [
      `Applicant: <@${submission.applicantId}>`,
      `Journal: [Open run journal](${submission.journalUrl})`,
      `Evidence summary: ${submission.evidenceSummary}`,
      ...(submission.evidenceUrl ? [`Evidence link: ${submission.evidenceUrl}`] : []),
    ].join('\n'),
    timestamp: now.toISOString(),
    footer: { text: verificationMarker(submission.applicantId, thread, state) },
  }],
  components: controls(submission.applicantId, thread, state, config, now),
  allowed_mentions: { parse: [] },
});

const validJournal = (channel: DiscordChannel, parentId: string, ownerId: string): boolean =>
  channel.parent_id === parentId && channel.owner_id === ownerId;
const verifiedBotId = async (deps: VerificationDeps): Promise<string | null> => {
  try {
    const bot = await deps.rest.getCurrentUser();
    return typeof bot?.id === 'string' && SNOWFLAKE.test(bot.id) && bot.id === deps.config.applicationId ? bot.id : null;
  } catch { return null; }
};

type DuplicateCheck = 'none' | 'duplicate' | 'unknown';

const unresolved = new Set(['open', 'needs_info', 'recommended_approve', 'recommended_reject', 'partial_tag']);
const closed = new Set(['approved', 'rejected']);

const duplicateCheck = async (
  rest: VerificationRest,
  config: BotConfig,
  botId: string,
  applicant: string,
  thread: string,
): Promise<DuplicateCheck> => {
  let messages: DiscordMessage[];
  try {
    messages = await rest.getChannelMessages(config.channels.verificationQueue, 100);
  } catch {
    return 'unknown';
  }

  for (const message of messages.slice(0, 100)) {
    const marker = markerFromBotMessage(message, botId);
    if (!marker || marker.applicantId !== applicant || marker.threadId !== thread) continue;
    if (unresolved.has(marker.state)) return 'duplicate';
    if (!closed.has(marker.state)) return 'unknown';
  }
  return 'none';
};

export const handleVerificationSubmit = (
  interaction: DiscordInteraction,
  deps: VerificationDeps,
  now = new Date(),
): JournalInteractionResponse => {
  const submission = submissionFrom(interaction);
  const threadId = submission && parseJournalUrl(submission.journalUrl);
  if (!submission || !threadId) return ephemeral('Please check your verification details and try again.');

  return deferred(() => Promise.resolve().then(async () => {
    let journal: DiscordChannel;
    try {
      journal = await deps.rest.getChannel(threadId);
    } catch {
      await safeEditOriginal(deps, submission.interactionToken, 'We could not validate that run journal for your account.');
      return;
    }

    if (!validJournal(journal, deps.config.channels.runJournals, submission.applicantId)) {
      await safeEditOriginal(deps, submission.interactionToken, 'We could not validate that run journal for your account.');
      return;
    }
    const botId = await verifiedBotId(deps);
    if (!botId) {
      await safeEditOriginal(deps, submission.interactionToken, 'The bot identity could not be verified. Please try again later.');
      return;
    }


    const duplicate = await duplicateCheck(deps.rest, deps.config, botId, submission.applicantId, threadId);
    if (duplicate === 'unknown') {
      await safeEditOriginal(deps, submission.interactionToken, 'We could not safely check the verification queue. Please try again later.');
      return;
    }
    if (duplicate === 'duplicate') {
      await safeEditOriginal(deps, submission.interactionToken, 'You already have a verification request awaiting staff action.');
      return;
    }

    try {
      await deps.rest.createMessage(
        deps.config.channels.verificationQueue,
        queueCard(submission, threadId, 'open', deps.config, now),
      );
    } catch {
      await auditAndEditOriginal(deps, { actorId: submission.applicantId, applicantId: submission.applicantId, threadId, action: 'submit', outcome: 'queue_create_failed', now }, submission.interactionToken, 'We could not create your verification request. Please try again later.');
      return;
    }

    await auditAndEditOriginal(deps, { actorId: submission.applicantId, applicantId: submission.applicantId, threadId, action: 'submit', outcome: 'queued', now }, submission.interactionToken, 'Your verification request has been submitted for staff review.');
  }));
};

const reasonActions = new Set<ComponentAction>(['needs_info', 'recommend', 'recommend_reject', 'reject']);
const finalActions = new Set<ComponentAction>(['approve', 'reject', 'retry_tag']);

const componentId = (interaction: DiscordInteraction): string | null => {
  if (interaction.type !== 3) return null;
  const data = object(interaction.data);
  return typeof data?.custom_id === 'string' ? data.custom_id : null;
};

const queueMessageId = (interaction: DiscordInteraction): string | null => {
  const message = object(interaction.message);
  return typeof message?.id === 'string' && SNOWFLAKE.test(message.id) ? message.id : null;
};

const reasonModal = (customId: string) => ({
  type: 9,
  data: {
    custom_id: customId,
    title: 'Verification reason',
    components: [textInput('reason', 'Reason', { style: 2, min_length: 1, max_length: 500, required: true })],
  },
});

const actionFitsState = (action: ComponentAction, state: string): boolean => {
  if (action === 'retry_tag') return state === 'partial_tag';
  return unresolved.has(state) && state !== 'partial_tag';
};

const hasFatekeeperAuthority = (roles: string[], config: BotConfig): boolean =>
  roles.includes(config.roles.fatekeeper) || roles.includes(config.roles.moderator) || roles.includes(config.roles.administrator);

const hasFinalAuthority = (roles: string[], config: BotConfig): boolean =>
  roles.includes(config.roles.moderator) || roles.includes(config.roles.administrator);

const actionPermitted = (action: ComponentAction, roles: string[], config: BotConfig): boolean =>
  finalActions.has(action) ? hasFinalAuthority(roles, config) : hasFatekeeperAuthority(roles, config);

const staleControl = () => ephemeral('That verification control is no longer current.');
const deniedControl = () => ephemeral('You do not have permission to use that verification control.');

export const handleVerificationComponent = async (
  interaction: DiscordInteraction,
  deps: VerificationDeps,
  now = new Date(),
): Promise<JournalInteractionResponse> => {
  const id = componentId(interaction);
  const payload = id && verifyComponentId(id, deps.config.componentHmacKey, Math.floor(now.getTime() / 1000));
  const actorId = applicantId(interaction);
  const messageId = queueMessageId(interaction);
  if (!id || !payload || !actorId || !messageId) return staleControl();

  let actor: DiscordGuildMember;
  try {
    actor = await deps.rest.getGuildMember(deps.config.guildId, actorId);
  } catch {
    return staleControl();
  }
  if (!actionPermitted(payload.action, actor.roles, deps.config)) return deniedControl();

  if (!reasonActions.has(payload.action)) {
    const token = interactionToken(interaction);
    if (!token) return staleControl();
    return deferred(() => executeFinalAction(deps, payload, actorId, messageId, token, now));
  }

  const botId = await verifiedBotId(deps);
  if (!botId) return ephemeral('The bot identity could not be verified. Please try again later.');
  const card = await currentQueueCard(deps, messageId, payload, botId);
  if (!card || !actionFitsState(payload.action, card.marker.state)) return staleControl();
  return reasonModal(signReasonModalId({
    action: payload.action,
    applicantId: payload.applicantId,
    threadId: payload.threadId,
    queueMessageId: card.message.id,
    expiresAt: Math.floor(now.getTime() / 1000) + SEVEN_DAYS_SECONDS,
  }, deps.config.componentHmacKey));
};

interface QueueCard {
  message: DiscordMessage;
  marker: { applicantId: string; threadId: string; state: string };
  embed: Record<string, unknown>;
}

interface SignedVerificationAction {
  action: ComponentAction;
  applicantId: string;
  threadId: string;
}
interface SignedReasonModalAction extends SignedVerificationAction {
  queueMessageId: string;
}

const cardFromBotMessage = (message: DiscordMessage, botId: string): QueueCard | null => {
  const marker = markerFromBotMessage(message, botId);
  const messageRecord = object(message);
  const embeds = messageRecord?.embeds;
  if (!marker || !Array.isArray(embeds)) return null;

  for (const candidate of embeds) {
    const embed = object(candidate);
    const footer = object(embed?.footer);
    const exact = parseVerificationMarker(footer?.text);
    if (
      embed && exact && exact.applicantId === marker.applicantId &&
      exact.threadId === marker.threadId && exact.state === marker.state
    ) return { message, marker, embed };
  }
  return null;
};

const cardMatches = (card: QueueCard, action: SignedVerificationAction): boolean =>
  card.marker.applicantId === action.applicantId && card.marker.threadId === action.threadId;

const currentQueueCard = async (
  deps: VerificationDeps,
  messageId: string,
  action: SignedVerificationAction,
  botId: string,
): Promise<QueueCard | null> => {
  try {
    const message = await deps.rest.getMessage(deps.config.channels.verificationQueue, messageId);
    const card = cardFromBotMessage(message, botId);
    if (!card || !cardMatches(card, action)) return null;
    return card;
  } catch {
    return null;
  }
};


const queueUpdate = (
  card: QueueCard,
  state: string,
  config: BotConfig,
  now: Date,
  reason?: string,
) => {
  const oldFooter = object(card.embed.footer) ?? {};
  const oldFields = Array.isArray(card.embed.fields) ? card.embed.fields : [];
  const fields = reason === undefined
    ? oldFields
    : [
      ...oldFields.filter((field) => object(field)?.name !== 'Staff reason'),
      { name: 'Staff reason', value: reason },
    ];
  return {
    embeds: [{
      ...card.embed,
      ...(reason === undefined ? {} : { fields }),
      footer: { ...oldFooter, text: verificationMarker(card.marker.applicantId, card.marker.threadId, state) },
    }],
    components: controls(card.marker.applicantId, card.marker.threadId, state, config, now),
    allowed_mentions: { parse: [] },
  };
};

const editQueueState = async (
  deps: VerificationDeps,
  card: QueueCard,
  state: string,
  now: Date,
  reason?: string,
): Promise<boolean> => {
  try {
    await deps.rest.editMessage(
      deps.config.channels.verificationQueue,
      card.message.id,
      queueUpdate(card, state, deps.config, now, reason),
    );
    return true;
  } catch {
    return false;
  }
};

const failure = async (
  deps: VerificationDeps,
  details: AuditDetails,
  token: string,
  content: string,
): Promise<void> => {
  await auditAndEditOriginal(deps, details, token, content);
};

const tagsWithVerified = (thread: DiscordChannel, verifiedTag: string): string[] | null => {
  const source = Array.isArray(thread.applied_tags) ? thread.applied_tags : [];
  const tags: string[] = [];
  for (const tag of source) {
    if (typeof tag === 'string' && SNOWFLAKE.test(tag) && !tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > 5) return null;
  if (tags.includes(verifiedTag)) return tags;
  if (tags.length >= 5) return null;
  return [...tags, verifiedTag];
};

const canManageVerifiedRunner = (roles: DiscordRole[], bot: DiscordGuildMember, targetRoleId: string): boolean => {
  const target = roles.find((role) => role.id === targetRoleId);
  if (!target || !Number.isFinite(target.position)) return false;
  const positions = roles
    .filter((role) => bot.roles.includes(role.id) && Number.isFinite(role.position))
    .map((role) => role.position);
  const highest = positions.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...positions);
  return highest > target.position;
};

const staleAfterAck = async (deps: VerificationDeps, token: string): Promise<void> =>
  safeEditOriginal(deps, token, 'That verification control is no longer current.');

const partialTagFailure = async (
  deps: VerificationDeps,
  card: QueueCard,
  action: SignedVerificationAction,
  actorId: string,
  token: string,
  now: Date,
  outcome: string,
): Promise<void> => {
  const updated = await editQueueState(deps, card, 'partial_tag', now);
  await failure(deps, {
    actorId,
    applicantId: action.applicantId,
    threadId: action.threadId,
    action: 'approve',
    outcome: updated ? outcome : 'partial_tag_card_update_failed',
    now,
  }, token, updated
    ? 'The Verified Runner role was added, but the journal tag needs staff retry.'
    : 'The Verified Runner role was added, but the verification card could not be updated.');
};

const executeApproval = async (
  deps: VerificationDeps,
  action: SignedVerificationAction,
  actorId: string,
  messageId: string,
  token: string,
  now: Date,
  botId: string,
): Promise<void> => {
  let applicant: DiscordGuildMember;
  try {
    applicant = await deps.rest.getGuildMember(deps.config.guildId, action.applicantId);
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'applicant_fetch_failed', now }, token, 'We could not verify that applicant.');
    return;
  }
  if (!Array.isArray(applicant.roles)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'applicant_invalid', now }, token, 'We could not verify that applicant.');
    return;
  }

  let journal: DiscordChannel;
  try {
    journal = await deps.rest.getChannel(action.threadId);
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'journal_fetch_failed', now }, token, 'We could not validate that run journal.');
    return;
  }
  if (!validJournal(journal, deps.config.channels.runJournals, action.applicantId)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'journal_invalid', now }, token, 'We could not validate that run journal.');
    return;
  }

  let roles: DiscordRole[];
  let bot: DiscordGuildMember;
  try {
    roles = await deps.rest.getGuildRoles(deps.config.guildId);
    bot = await deps.rest.getGuildMember(deps.config.guildId, botId);
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'hierarchy_fetch_failed', now }, token, 'The bot cannot safely manage the Verified Runner role.');
    return;
  }
  if (!canManageVerifiedRunner(roles, bot, deps.config.roles.verifiedRunner)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'hierarchy_failed', now }, token, 'The bot cannot safely manage the Verified Runner role.');
    return;
  }

  const card = await currentQueueCard(deps, messageId, action, botId);
  if (!card || !actionFitsState('approve', card.marker.state)) {
    await staleAfterAck(deps, token);
    return;
  }
  if (!deps.config.mutationsEnabled) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'mutations_disabled', now }, token, 'Verification mutations are currently disabled.');
    return;
  }

  try {
    await deps.rest.addGuildMemberRole(deps.config.guildId, action.applicantId, deps.config.roles.verifiedRunner);
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'role_add_failed', now }, token, 'We could not add the Verified Runner role.');
    return;
  }

  const tags = tagsWithVerified(journal, deps.config.tags.verified);
  if (!tags) {
    await partialTagFailure(deps, card, action, actorId, token, now, 'tag_capacity_failed');
    return;
  }
  try {
    await deps.rest.editThread(action.threadId, { applied_tags: tags });
  } catch {
    await partialTagFailure(deps, card, action, actorId, token, now, 'tag_edit_failed');
    return;
  }

  if (!await editQueueState(deps, card, 'approved', now)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'card_update_failed', now }, token, 'The role and journal tag were updated, but the verification card could not be closed.');
    return;
  }
  await auditAndEditOriginal(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'approve', outcome: 'approved', now }, token, 'Runner verification approved.');
};

const executeRetryTag = async (
  deps: VerificationDeps,
  action: SignedVerificationAction,
  actorId: string,
  messageId: string,
  token: string,
  now: Date,
  botId: string,
): Promise<void> => {
  const card = await currentQueueCard(deps, messageId, action, botId);
  if (!card || !actionFitsState('retry_tag', card.marker.state)) {
    await staleAfterAck(deps, token);
    return;
  }
  let applicant: DiscordGuildMember;
  try {
    applicant = await deps.rest.getGuildMember(deps.config.guildId, action.applicantId);
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'applicant_fetch_failed', now }, token, 'We could not verify that applicant.');
    return;
  }
  if (!Array.isArray(applicant.roles) || !applicant.roles.includes(deps.config.roles.verifiedRunner)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'applicant_role_missing', now }, token, 'The applicant no longer has the Verified Runner role; the journal tag was not changed.');
    return;
  }


  let journal: DiscordChannel;
  try {
    journal = await deps.rest.getChannel(action.threadId);
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'journal_fetch_failed', now }, token, 'We could not validate that run journal.');
    return;
  }
  if (!validJournal(journal, deps.config.channels.runJournals, action.applicantId)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'journal_invalid', now }, token, 'We could not validate that run journal.');
    return;
  }
  if (!deps.config.mutationsEnabled) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'mutations_disabled', now }, token, 'Verification mutations are currently disabled.');
    return;
  }

  const tags = tagsWithVerified(journal, deps.config.tags.verified);
  if (!tags) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'tag_capacity_failed', now }, token, 'The verified journal tag still needs manual staff attention.');
    return;
  }
  try {
    await deps.rest.editThread(action.threadId, { applied_tags: tags });
  } catch {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'tag_edit_failed', now }, token, 'We could not add the verified journal tag.');
    return;
  }
  if (!await editQueueState(deps, card, 'approved', now)) {
    await failure(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'card_update_failed', now }, token, 'The journal tag was updated, but the verification card could not be closed.');
    return;
  }
  await auditAndEditOriginal(deps, { actorId, applicantId: action.applicantId, threadId: action.threadId, action: 'retry_tag', outcome: 'recovered', now }, token, 'The verified journal tag was recovered.');
};

const executeFinalAction = async (
  deps: VerificationDeps,
  action: SignedVerificationAction,
  actorId: string,
  messageId: string,
  token: string,
  now: Date,
): Promise<void> => {
  const botId = await verifiedBotId(deps);
  if (!botId) {
    await safeEditOriginal(deps, token, 'The bot identity could not be verified. Please try again later.');
    return;
  }

  if (action.action === 'approve') {
    await executeApproval(deps, action, actorId, messageId, token, now, botId);
    return;
  }
  if (action.action === 'retry_tag') {
    await executeRetryTag(deps, action, actorId, messageId, token, now, botId);
    return;
  }
  await staleAfterAck(deps, token);
};

const reasonModalSubmission = (
  interaction: DiscordInteraction,
  config: BotConfig,
  now: Date,
): { action: SignedReasonModalAction; actorId: string; token: string; reason: string } | null => {
  if (interaction.type !== 5) return null;
  const data = object(interaction.data);
  const customId = data?.custom_id;
  const payload = typeof customId === 'string'
    ? verifyReasonModalId(customId, config.componentHmacKey, Math.floor(now.getTime() / 1000))
    : null;
  const fields = modalFields(interaction);
  const actorId = applicantId(interaction);
  const token = interactionToken(interaction);
  const rawReason = fields?.reason;
  const reason = rawReason?.trim();
  if (
    !payload || !reasonActions.has(payload.action) || !fields || Object.keys(fields).length !== 1 ||
    !actorId || !token || typeof rawReason !== 'string' || rawReason.length > 500 || !reason
  ) return null;
  return { action: payload, actorId, token, reason };
};

export const handleVerificationReasonSubmit = (
  interaction: DiscordInteraction,
  deps: VerificationDeps,
  now = new Date(),
): JournalInteractionResponse => {
  const submission = reasonModalSubmission(interaction, deps.config, now);
  if (!submission) return staleControl();

  return deferred(() => Promise.resolve().then(async () => {
    let actor: DiscordGuildMember;
    try {
      actor = await deps.rest.getGuildMember(deps.config.guildId, submission.actorId);
    } catch {
      await staleAfterAck(deps, submission.token);
      return;
    }
    if (!actionPermitted(submission.action.action, actor.roles, deps.config)) {
      await safeEditOriginal(deps, submission.token, 'You do not have permission to use that verification control.');
      return;
    }

    const botId = await verifiedBotId(deps);
    if (!botId) {
      await safeEditOriginal(deps, submission.token, 'The bot identity could not be verified. Please try again later.');
      return;
    }
    const card = await currentQueueCard(deps, submission.action.queueMessageId, submission.action, botId);
    if (!card || !actionFitsState(submission.action.action, card.marker.state)) {
      await staleAfterAck(deps, submission.token);
      return;
    }

    if (submission.action.action === 'needs_info') {
      let journal: DiscordChannel;
      try {
        journal = await deps.rest.getChannel(submission.action.threadId);
      } catch {
        await failure(deps, { actorId: submission.actorId, applicantId: submission.action.applicantId, threadId: submission.action.threadId, action: 'needs_info', outcome: 'journal_fetch_failed', now }, submission.token, 'We could not validate that run journal.');
        return;
      }
      if (!validJournal(journal, deps.config.channels.runJournals, submission.action.applicantId)) {
        await failure(deps, { actorId: submission.actorId, applicantId: submission.action.applicantId, threadId: submission.action.threadId, action: 'needs_info', outcome: 'journal_invalid', now }, submission.token, 'We could not validate that run journal.');
        return;
      }
      try {
        await deps.rest.createMessage(submission.action.threadId, {
          content: `Staff requested more information for your verification: ${submission.reason}`,
          allowed_mentions: { parse: [] },
        });
      } catch {
        await failure(deps, { actorId: submission.actorId, applicantId: submission.action.applicantId, threadId: submission.action.threadId, action: 'needs_info', outcome: 'journal_post_failed', now }, submission.token, 'We could not post the information request to that journal.');
        return;
      }
    }

    const state = submission.action.action === 'recommend' ? 'recommended_approve'
      : submission.action.action === 'recommend_reject' ? 'recommended_reject'
        : submission.action.action === 'reject' ? 'rejected'
          : 'needs_info';
    if (!await editQueueState(deps, card, state, now, submission.reason)) {
      await failure(deps, { actorId: submission.actorId, applicantId: submission.action.applicantId, threadId: submission.action.threadId, action: submission.action.action, outcome: 'card_update_failed', now }, submission.token, 'We could not update the verification card.');
      return;
    }
    await auditAndEditOriginal(deps, { actorId: submission.actorId, applicantId: submission.action.applicantId, threadId: submission.action.threadId, action: submission.action.action, outcome: state, now }, submission.token, 'Verification request updated.');
  }));
};
