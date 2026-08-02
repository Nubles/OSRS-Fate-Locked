import { createHmac, timingSafeEqual } from 'node:crypto';

const FIVE_MINUTES = 5 * 60;
const SIGNATURE = /^v1=([0-9a-f]{64})$/i;
const TIMESTAMP = /^\d+$/;

const signaturesMatch = (actual: string, expected: string): boolean => {
  const actualBytes = Buffer.from(actual, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
};

export const verifyAutomationRequest = (
  rawBody: string,
  timestamp: string,
  signature: string,
  automationKey: string,
  allowedRepositories: readonly string[],
  now = Math.floor(Date.now() / 1000),
): boolean => {
  if (
    typeof rawBody !== 'string' ||
    typeof timestamp !== 'string' ||
    typeof signature !== 'string' ||
    typeof automationKey !== 'string' ||
    automationKey.length === 0 ||
    !TIMESTAMP.test(timestamp) ||
    !Number.isSafeInteger(now)
  ) {
    return false;
  }

  const issuedAt = Number(timestamp);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > now || now - issuedAt > FIVE_MINUTES) return false;

  const signatureMatch = SIGNATURE.exec(signature);
  if (!signatureMatch) return false;

  const expected = createHmac('sha256', automationKey)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');
  if (!signaturesMatch(signatureMatch[1]!, expected)) return false;

  try {
    const event: unknown = JSON.parse(rawBody);
    if (!event || typeof event !== 'object' || !('repository' in event)) return false;
    const repository = event.repository;
    return typeof repository === 'string' && allowedRepositories.includes(repository);
  } catch {
    return false;
  }
};
