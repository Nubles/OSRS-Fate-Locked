import { createHmac, timingSafeEqual } from 'node:crypto';

const ACTIONS = ['needs_info', 'recommend', 'recommend_reject', 'approve', 'reject', 'retry_tag'] as const;
const SNOWFLAKE = /^\d{17,20}$/;
const BASE36 = /^[0-9a-z]+$/;

export type ComponentAction = (typeof ACTIONS)[number];

export interface ComponentPayload {
  action: ComponentAction;
  applicantId: string;
  threadId: string;
  expiresAt: number;
}

const isAction = (value: string): value is ComponentAction =>
  ACTIONS.includes(value as ComponentAction);

const isPayload = (payload: ComponentPayload): boolean =>
  isAction(payload.action) &&
  SNOWFLAKE.test(payload.applicantId) &&
  SNOWFLAKE.test(payload.threadId) &&
  Number.isSafeInteger(payload.expiresAt) &&
  payload.expiresAt > 0;

const signatureFor = (value: string, key: string): string =>
  createHmac('sha256', key).update(value).digest().subarray(0, 12).toString('base64url');

const signaturesMatch = (actual: string, expected: string): boolean => {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
};

export const signComponentId = (payload: ComponentPayload, componentKey: string): string => {
  if (!isPayload(payload) || typeof componentKey !== 'string' || componentKey.length === 0) {
    throw new TypeError('Invalid component payload');
  }

  const unsigned = `v1.${payload.action}.${payload.applicantId}.${payload.threadId}.${payload.expiresAt.toString(36)}`;
  return `${unsigned}.${signatureFor(unsigned, componentKey)}`;
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
