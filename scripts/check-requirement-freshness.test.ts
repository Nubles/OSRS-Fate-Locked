import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { activityInventory, auditFreshness, fetchRevisions } from './check-requirement-freshness.mjs';
const url = 'https://oldschool.runescape.wiki/w/Volcanic_Mine';
const inventory = [{ id: 'Mine', text: "{ predicates: [{ kind: 'manual' }] }" }];
const manifest = () => ({ schemaVersion: 1, maxReviewAgeDays: 90, entries: { Mine: { reviewedAt: '2026-09-05', sources: [{ url, revisionId: 123 }], reviewRecords: ['review.md'] } } });
const now = new Date('2026-09-05T12:00:00Z');
describe('curated source provenance', () => {
  it('covers the real inventory without pretending offline flags are semantic verification', () => {
    const data = JSON.parse(readFileSync(new URL('../data/sources/activity-requirement-provenance.json', import.meta.url), 'utf8'));
    const rules = activityInventory(readFileSync(new URL('../data/activityRequirements.ts', import.meta.url), 'utf8'));
    const report = auditFreshness(data, rules, { now });
    expect(report.errors).toEqual([]);
    expect(report.flags.some(flag => flag.reason === 'ACKNOWLEDGED_UNKNOWN')).toBe(true);
    expect(report.actionableFlags).toEqual([]);
  });
  it('requires review when a revision changes and does not mutate the baseline', () => {
    const data = manifest();
    expect(auditFreshness(data, inventory, { now, upstream: { [url]: { revisionId: 124, timestamp: '2026-09-06T12:00:00Z' } } }).flags.map(flag => flag.reason)).toEqual(['SOURCE_CHANGED', 'SOURCE_UPDATED_SINCE_REVIEW']);
    expect(data.entries.Mine.sources[0].revisionId).toBe(123);
  });
  it('flags expired reviews and treats failed retrieval as unknown', () => {
    expect(auditFreshness(manifest(), inventory, { now: new Date('2027-01-01'), upstream: {} }).flags.map(flag => flag.reason)).toEqual(['REVIEW_STALE', 'SOURCE_UNAVAILABLE']);
  });
  it('detects missing and orphan records and unclassified gate notes', () => {
    const report = auditFreshness(manifest(), [{ id: 'Mine', text: "{ note: 'Must have a cape' }" }, { id: 'New', text: '{}' }], { now });
    expect(report.errors).toContain('Unclassified gate note: Mine');
    expect(report.errors).toContain('Missing provenance: New');
    expect(auditFreshness(manifest(), [], { now }).errors).toContain('Orphan provenance: Mine');
  });
  it('rejects future review dates', () => {
    expect(auditFreshness(manifest(), inventory, { now: new Date('2026-09-04') }).errors).toContain('Invalid review date: Mine');
  });
  it('rejects a new empty source record unless the actual rule is explicitly unknown', () => {
    const data = manifest();
    data.entries.Mine.sources = [];
    expect(auditFreshness(data, inventory, { now }).errors).toContain('Missing source mapping: Mine');
  });
  it('keeps failed network reads visible', async () => {
    expect(await fetchRevisions([url], async () => { throw new Error('network unavailable'); })).toEqual({ [url]: { error: 'Error: network unavailable' } });
  });
  it('reads revision metadata without retrieving or rewriting rule contents', async () => {
    const result = await fetchRevisions([url], async () => ({ ok: true, json: async () => ({ query: { pages: [{ title: 'Volcanic Mine', revisions: [{ revid: 456, timestamp: '2026-09-05T00:00:00Z' }] }] } }) }));
    expect(result[url].revisionId).toBe(456);
  });
});
