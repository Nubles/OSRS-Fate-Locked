import { describe, expect, it } from 'vitest';
import sources from './sources/quest-operational-items.json';
import questList from './sources/quest-list.json';
import { sourcedQuestItemPredicates } from './questOperationalSources';
import { classifyQuestItems } from '../scripts/quest-operational-source.mjs';
import runtimeChecks from './questOperationalChecks.json';
import { compileQuestOperations } from '../scripts/compile-quest-operations.mjs';
describe('canonical quest required-item evidence', () => {
  it('ships only operational clauses and verifies they match the audited source', () => {
    expect(runtimeChecks).toEqual(compileQuestOperations(sources));
    expect(JSON.stringify(runtimeChecks)).not.toContain('revisionTimestamp');
  });
  it('covers every canonical quest with a real source revision and reproducible item clauses', () => {
    expect(Object.keys(sources.entries).sort()).toEqual(questList.entries.map(entry => entry.id).sort());
    for (const [id, entry] of Object.entries(sources.entries)) {
      expect(Number.isInteger(entry.source.revisionId), id).toBe(true);
      expect(entry.source.revisionId, id).toBeGreaterThan(0);
      if ('raw' in entry) {
        const parsed = classifyQuestItems(`{{Quest details|items=${entry.raw}}}`);
        expect(parsed.status, id).toBe(entry.status);
        expect(parsed.checks, id).toEqual(entry.checks);
      } else {
        expect('reviewNote' in entry, id).toBe(true);
        expect(['Children of the Sun', 'The Restless Ghost']).toContain(id);
      }
    }
  });
  it('keeps Demon Slayer quantities and Priest in Peril essence alternatives explicit', () => {
    expect(JSON.stringify(sourcedQuestItemPredicates('Demon Slayer'))).toContain('25 bones');
    const priest = JSON.stringify(sourcedQuestItemPredicates('Priest in Peril'));
    expect(priest).toContain('50 unnoted rune essence or pure essence');
    expect(priest).toContain('multiple trips');
  });
  it('does not turn quest-obtained tools into mandatory prior possession', () => {
    const ghost = sourcedQuestItemPredicates('The Restless Ghost');
    expect(ghost[0].kind).toBe('manual');
    expect(JSON.stringify(ghost)).toContain('need not be pre-owned');
    expect(sourcedQuestItemPredicates('Children of the Sun')).toEqual([]);
  });
  it('does not promote recommendation lists or unknown records to readiness', () => {
    expect(JSON.stringify(sourcedQuestItemPredicates('RFD: Lumbridge Guide'))).not.toContain('Minigame Teleport');
    expect(sourcedQuestItemPredicates('constructor')[0].kind).toBe('unknown');
    expect(sourcedQuestItemPredicates('Unknown quest')[0].kind).toBe('unknown');
  });
});
