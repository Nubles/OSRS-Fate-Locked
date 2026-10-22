import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import { questRequirementFingerprint as auditFingerprint } from '../data/questRequirementAudit';
import { questRequirementFingerprint as refreshFingerprint } from './sync-quest-sources.mjs';

describe('quest source refresh', () => {
  // A refresh keeps a quest's reviewed audit row only while its fingerprint is
  // unchanged. If the two fingerprints disagree, every quest using a field the
  // script misses is reset to unresolved on the next refresh.
  it('fingerprints every quest the same way as the audit', () => {
    const differing = Object.values(QUEST_DATA)
      .filter(quest => refreshFingerprint(quest) !== auditFingerprint(quest))
      .map(quest => quest.id);
    expect(differing).toEqual([]);
  });
});
