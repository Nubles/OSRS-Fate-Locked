const SNOWFLAKE = /^\d{17,20}$/;
const VERIFICATION_MARKER = /^FLV1 applicant=(\d{17,20}) thread=(\d{17,20}) state=([a-z][a-z_]*)$/;

export interface VerificationMarker {
  applicantId: string;
  threadId: string;
  state: string;
}

export const verificationMarker = (applicantId: string, threadId: string, state: string): string =>
  `FLV1 applicant=${applicantId} thread=${threadId} state=${state}`;

export const releaseMarker = (repository: string, releaseId: number): string =>
  `FLR1 repository=${repository} release=${releaseId}`;

export const seedMarker = (seed: string): string => `FLS1 seed=${seed}`;

export const parseVerificationMarker = (value: unknown): VerificationMarker | null => {
  if (typeof value !== 'string') return null;
  const match = VERIFICATION_MARKER.exec(value);
  if (!match) return null;

  const [, applicantId, threadId, state] = match;
  if (!applicantId || !threadId || !state || !SNOWFLAKE.test(applicantId) || !SNOWFLAKE.test(threadId)) return null;
  return { applicantId, threadId, state };
};

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : null;

export const hasBotAuthoredFooterMarker = (message: unknown, botId: string, marker: string): boolean => {
  const messageRecord = record(message);
  if (!messageRecord) return false;

  const author = record(messageRecord.author);
  if (author?.id !== botId || author.bot !== true) return false;

  const embeds = messageRecord.embeds;
  if (!Array.isArray(embeds)) return false;

  return embeds.some((embed) => {
    const footer = record(record(embed)?.footer);
    return footer?.text === marker;
  });
};

export const markerFromBotMessage = (message: unknown, botId: string): VerificationMarker | null => {
  const messageRecord = record(message);
  if (!messageRecord) return null;

  const author = record(messageRecord.author);
  if (author?.id !== botId) return null;

  const embeds = messageRecord.embeds;
  if (!Array.isArray(embeds)) return null;

  for (const embed of embeds) {
    const footer = record(record(embed)?.footer);
    const marker = parseVerificationMarker(footer?.text);
    if (marker) return marker;
  }
  return null;
};
