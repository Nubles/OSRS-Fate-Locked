import { createHmac, timingSafeEqual } from 'node:crypto';

const ACTIONS = ['needs_info', 'recommend', 'recommend_reject', 'approve', 'reject', 'retry_tag'] as const;
const SNOWFLAKE = /^\d{17,20}$/;
const BASE36 = /^[0-9a-z]+$/;
const BASE36_DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

export type ComponentAction = (typeof ACTIONS)[number];

export interface ComponentPayload {
  action: ComponentAction;
  applicantId: string;
  threadId: string;
  expiresAt: number;
}

export interface ReasonModalPayload extends ComponentPayload {
  queueMessageId: string;
}

const isAction = (value: string): value is ComponentAction =>
  ACTIONS.includes(value as ComponentAction);

const isPayload = (payload: ComponentPayload): boolean =>
  isAction(payload.action) &&
  SNOWFLAKE.test(payload.applicantId) &&
  SNOWFLAKE.test(payload.threadId) &&
  Number.isSafeInteger(payload.expiresAt) &&
  payload.expiresAt > 0;
const isReasonModalPayload = (payload: ReasonModalPayload): boolean =>
  isPayload(payload) &&
  SNOWFLAKE.test(payload.queueMessageId);

const signatureFor = (value: string, key: string): string =>
  createHmac('sha256', key).update(value).digest().subarray(0, 12).toString('base64url');

const signaturesMatch = (actual: string, expected: string): boolean => {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
};

const encodeSnowflake = (value: string): string => BigInt(value).toString(36);

const decodeSnowflake = (value: string): string | null => {
  if (!BASE36.test(value)) return null;

  let decoded = 0n;
  for (const character of value) {
    const digit = BASE36_DIGITS.indexOf(character);
    if (digit < 0) return null;
    decoded = (decoded * 36n) + BigInt(digit);
  }

  const snowflake = decoded.toString();
  return SNOWFLAKE.test(snowflake) && decoded.toString(36) === value ? snowflake : null;
};

export const signComponentId = (payload: ComponentPayload, componentKey: string): string => {
  if (!isPayload(payload) || typeof componentKey !== 'string' || componentKey.length === 0) {
    throw new TypeError('Invalid component payload');
  }

  const unsigned = `v1.${payload.action}.${payload.applicantId}.${payload.threadId}.${payload.expiresAt.toString(36)}`;
  return `${unsigned}.${signatureFor(unsigned, componentKey)}`;
};

export const signReasonModalId = (payload: ReasonModalPayload, componentKey: string): string => {
  if (!isReasonModalPayload(payload) || typeof componentKey !== 'string' || componentKey.length === 0) {
    throw new TypeError('Invalid reason modal payload');
  }
  const unsigned = `r.${payload.action}.${encodeSnowflake(payload.applicantId)}.${encodeSnowflake(payload.threadId)}.${encodeSnowflake(payload.queueMessageId)}.${payload.expiresAt.toString(36)}`;
  const id = `${unsigned}.${signatureFor(unsigned, componentKey)}`;
  if (id.length > 100) throw new TypeError('Reason modal ID exceeds Discord limit');
  return id;
};

export const verifyComponentId = (
  id: string,
  componentKey: string,
  now = Math.floor(Date.now() / 1000),
): ComponentPayload | null => {
  if (typeof id !== 'string' || typeof componentKey !== 'string' || componentKey.length === 0 || !Number.isSafeInteger(now)) {
    return null;
  }

  const segments = id.split('.');
  if (segments.length !== 6) return null;

  const [version, action, applicantId, threadId, expiry36, signature] = segments;
  if (
    version !== 'v1' ||
    !action ||
    !applicantId ||
    !threadId ||
    !expiry36 ||
    !signature ||
    !isAction(action) ||
    !SNOWFLAKE.test(applicantId) ||
    !SNOWFLAKE.test(threadId) ||
    !BASE36.test(expiry36)
  ) {
    return null;
  }

  const expiresAt = Number.parseInt(expiry36, 36);
  if (!Number.isSafeInteger(expiresAt) || expiresAt.toString(36) !== expiry36 || expiresAt <= now) return null;

  const unsigned = segments.slice(0, -1).join('.');
  if (!signaturesMatch(signature, signatureFor(unsigned, componentKey))) return null;

  return { action, applicantId, threadId, expiresAt };
};

export const verifyReasonModalId = (
  id: string,
  componentKey: string,
  now = Math.floor(Date.now() / 1000),
): ReasonModalPayload | null => {
  if (typeof id !== 'string' || id.length > 100 || typeof componentKey !== 'string' || componentKey.length === 0 || !Number.isSafeInteger(now)) return null;

  const segments = id.split('.');
  if (segments.length !== 7) return null;

  const [version, action, applicant36, thread36, queueMessage36, expiry36, signature] = segments;
  if (
    version !== 'r' ||
    !action ||
    !applicant36 ||
    !thread36 ||
    !queueMessage36 ||
    !expiry36 ||
    !signature ||
    !isAction(action) ||
    !BASE36.test(applicant36) || !BASE36.test(thread36) || !BASE36.test(queueMessage36) ||
    !BASE36.test(expiry36)
  ) return null;

  const applicantId = decodeSnowflake(applicant36);
  const threadId = decodeSnowflake(thread36);
  const queueMessageId = decodeSnowflake(queueMessage36);
  if (!applicantId || !threadId || !queueMessageId) return null;

  const expiresAt = Number.parseInt(expiry36, 36);
  if (!Number.isSafeInteger(expiresAt) || expiresAt.toString(36) !== expiry36 || expiresAt <= now) return null;

  const unsigned = segments.slice(0, -1).join('.');
  if (!signaturesMatch(signature, signatureFor(unsigned, componentKey))) return null;
  return { action, applicantId, threadId, queueMessageId, expiresAt };
};
