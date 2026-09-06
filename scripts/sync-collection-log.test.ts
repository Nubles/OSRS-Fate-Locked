import { describe, expect, it } from 'vitest';
import { syncCollectionLogText } from './sync-collection-log.mjs';
import { createClogIdAllocator } from '../utils/clogIdAllocation.mjs';
import { migrateClogIds } from '../utils/clogIdMigrations';

describe('collection-log persistent identity allocation', () => {
  it('fills empty page stubs with distinct globally unused blocks, then preserves them on a repeat sync', () => {
    const source = [
      "      'Existing': { name: 'Existing', items: [{id: 531001, name: 'Old'}] },",
      "      'New boss': { name: 'New boss', items: [] },",
      "      'Other boss': { name: 'Other boss', items: [] },",
    ].join('\n');
    const wiki = { Existing: ['Old'], 'New boss': ['Drop A', 'Drop B'], 'Other boss': ['Drop C'] };
    const result = syncCollectionLogText(source, wiki);
    expect(result.text).toContain("{id: 532001, name: 'Drop A'}");
    expect(result.text).toContain("{id: 532002, name: 'Drop B'}");
    expect(result.text).toContain("{id: 533001, name: 'Drop C'}");
    expect(result.text).not.toContain('NaN');
    expect(result.log.adds).toHaveLength(3);
    expect(syncCollectionLogText(result.text, wiki).text).toBe(result.text);
  });
  it('never recycles retired save IDs when appending to a page', () => {
    const source = "      'Araxxor': { name: 'Araxxor', items: [{id: 104010, name: 'Existing'}] },";
    const result = syncCollectionLogText(source, { Araxxor: ['Existing', 'New drop'] });
    expect(result.text).toContain("{id: 104012, name: 'New drop'}");
    expect(migrateClogIds({ 104012: 1 })).toEqual({ 104012: 1 });
  });
  it('fails before spilling a full page into another page block', () => {
    const mint = createClogIdAllocator([101999, 102001])([101999]);
    expect(mint).toThrow('exhausted');
  });
});
