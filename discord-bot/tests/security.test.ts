import { createHmac } from 'node:crypto';
import nacl from 'tweetnacl';
import { describe, expect, it } from 'vitest';
import { verifyAutomationRequest } from '../src/security/automation-signature.js';
import { verifyDiscordRequest } from '../src/security/discord-signature.js';
import { signComponentId, signReasonModalId, verifyComponentId, verifyReasonModalId } from '../src/security/signed-id.js';

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

describe('verifyDiscordRequest', () => {
  it('rejects a body that was not signed', () => {
    const keyPair = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(7));
    const body = '{"type":1}';
    const timestamp = '1700000000';
    const signature = nacl.sign.detached(
      new TextEncoder().encode(`${timestamp}${body}`),
      keyPair.secretKey,
    );

    expect(verifyDiscordRequest(body, timestamp, hex(signature), hex(keyPair.publicKey))).toBe(true);
    expect(verifyDiscordRequest(`${body}x`, timestamp, hex(signature), hex(keyPair.publicKey))).toBe(false);
  });
});

describe('signed component IDs', () => {
  it('detects tampering and expiration', () => {
    const componentKey = 'component-key-at-least-32-bytes-long';
    const id = signComponentId(
      {
        action: 'approve',
        applicantId: '100000000000000001',
        threadId: '100000000000000002',
        expiresAt: 1_900_000_000,
      },
      componentKey,
    );

    expect(id.length).toBeLessThanOrEqual(100);
    expect(verifyComponentId(id, componentKey, 1_800_000_000)?.action).toBe('approve');
    expect(verifyComponentId(`${id.slice(0, -1)}x`, componentKey, 1_800_000_000)).toBeNull();
    expect(verifyComponentId(id, componentKey, 1_900_000_001)).toBeNull();
  });

  it('keeps maximum-length reason modal IDs within Discord limits', () => {
    const componentKey = 'component-key-at-least-32-bytes-long';
    const payload = {
      action: 'recommend_reject' as const,
      applicantId: '99999999999999999999',
      threadId: '99999999999999999998',
      queueMessageId: '99999999999999999997',
      expiresAt: 1_900_000_000,
    };

    const id = signReasonModalId(payload, componentKey);

    expect(id.length).toBeLessThanOrEqual(100);
    expect(verifyReasonModalId(id, componentKey, 1_800_000_000)).toMatchObject(payload);
  });
});

describe('verifyAutomationRequest', () => {
  const key = 'automation-key-at-least-32-bytes-long';
  const body = '{"repository":"Nubles/OSRS-Fate-Locked","type":"weekly_seed"}';
  const timestamp = '1700000000';
  const signature = `v1=${createHmac('sha256', key).update(`${timestamp}.${body}`).digest('hex')}`;
  const repositories = ['Nubles/OSRS-Fate-Locked'];

  it('accepts a current signature for an allowed repository', () => {
    expect(verifyAutomationRequest(body, timestamp, signature, key, repositories, 1_700_000_100)).toBe(true);
  });

  it('rejects a bad signature', () => {
    expect(verifyAutomationRequest(body, timestamp, 'v1=00', key, repositories, 1_700_000_100)).toBe(false);
  });

  it('rejects a timestamp older than five minutes', () => {
    expect(verifyAutomationRequest(body, timestamp, signature, key, repositories, 1_700_000_301)).toBe(false);
  });

  it('rejects a repository outside the allow-list', () => {
    const untrustedBody = '{"repository":"other/repository","type":"weekly_seed"}';
    const untrustedSignature = `v1=${createHmac('sha256', key)
      .update(`${timestamp}.${untrustedBody}`)
      .digest('hex')}`;

    expect(
      verifyAutomationRequest(untrustedBody, timestamp, untrustedSignature, key, repositories, 1_700_000_100),
    ).toBe(false);
  });
});
