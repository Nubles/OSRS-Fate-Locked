import { describe, expect, it } from 'vitest';
import {
  markerFromBotMessage,
  releaseMarker,
  seedMarker,
  verificationMarker,
} from '../src/markers.js';

const applicantId = '100000000000000001';
const threadId = '100000000000000002';
const botId = '100000000000000003';

describe('verification markers', () => {
  it('uses exact, stable stateless marker formats', () => {
    expect(verificationMarker(applicantId, threadId, 'open')).toBe(
      'FLV1 applicant=100000000000000001 thread=100000000000000002 state=open',
    );
    expect(releaseMarker('Nubles/OSRS-Fate-Locked', 42)).toBe(
      'FLR1 repository=Nubles/OSRS-Fate-Locked release=42',
    );
    expect(seedMarker('2026-08-02')).toBe('FLS1 seed=2026-08-02');
  });

  it('accepts only an exact marker in a bot-authored embed footer', () => {
    const exact = {
      author: { id: botId },
      embeds: [{ footer: { text: 'FLV1 applicant=100000000000000001 thread=100000000000000002 state=needs_info' } }],
    };

    expect(markerFromBotMessage(exact, botId)).toEqual({
      applicantId,
      threadId,
      state: 'needs_info',
    });

    for (const message of [
      { author: { id: applicantId }, embeds: exact.embeds },
      { author: { id: botId }, embeds: [{ footer: { text: `${exact.embeds[0]?.footer?.text} extra` } }] },
      { author: { id: botId }, embeds: [{ footer: { text: 'FLV1 applicant=bad thread=100000000000000002 state=open' } }] },
      { author: { id: botId }, embeds: [{ description: exact.embeds[0]?.footer?.text }] },
    ]) {
      expect(markerFromBotMessage(message, botId)).toBeNull();
    }
  });
});
