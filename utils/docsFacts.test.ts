import { describe, expect, it } from 'vitest';
import roadmap from '../ROADMAP.md?raw';
import relayDocText from '../docs/online-relay.md?raw';
import { ENTRY_GZIP_BUDGET_KB } from '../scripts/check-entry-budget.mjs';
import { RELAY_REPUBLISH_UNCHANGED_MS } from './relayPublishFingerprint';

/**
 * Facts in the maintainer docs that the code decides. Each pin reads the doc
 * and the code, so a change to one without the other fails here.
 */

describe('ROADMAP.md matches the code', () => {
  it('states the entry-chunk gzip budget that scripts/check-entry-budget.mjs enforces', () => {
    const stated = roadmap.match(/in `scripts\/check-entry-budget\.mjs` \((\d+) kB;/);
    expect(stated?.[1]).toBe(String(ENTRY_GZIP_BUDGET_KB));
  });

  it('gives the unchanged-profile republish window from utils/relayPublishFingerprint.ts', () => {
    expect(RELAY_REPUBLISH_UNCHANGED_MS).toBe(6 * 60 * 60 * 1000);
    expect(roadmap).toMatch(/same fingerprint without export time and revision, under six hours old/);
    expect(roadmap).not.toMatch(/under a day old/);
  });

  it('names no removed plugin quest-chat regex', () => {
    expect(roadmap).not.toMatch(/QUEST_COMPLETE_SUFFIXED|QUEST_COMPLETE_BARE|`_BARE`/);
    expect(roadmap).toMatch(/QUEST_COMPLETED_GROUP_ID/);
  });

  it('section 1 names the same Plugin Hub build as section 3 and docs/online-relay.md', () => {
    const section1 = roadmap.match(/builds commit `([0-9a-f]{40})` of/)?.[1];
    const section3 = roadmap.match(/Plugin Hub build\s+\(`([0-9a-f]{7})`\)/)?.[1];
    const relayDoc = relayDocText.match(/`([0-9a-f]{7})`\) requested them/)?.[1];
    expect(section3).toBeDefined();
    expect(relayDoc).toBe(section3);
    expect(section1?.startsWith(section3!)).toBe(true);
  });
});
