import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { QUEST_DATA } from '../data/questData';
import index from '../public/runeproof/source-guides/index.json';
import { parseSourceGuide } from '../features/runeproof/sourceGuide';

describe('player source walkthrough catalogue', () => {
  it('covers every canonical quest with independently loadable, valid, content-addressed instructions', () => {
    expect(index.entries.map(entry => entry.questId).sort()).toEqual(Object.keys(QUEST_DATA).sort());
    expect(new Set(index.entries.map(entry => entry.file)).size).toBe(index.entries.length);
    for (const entry of index.entries) {
      expect(entry.file).toMatch(/^[a-z0-9-]+-[a-f0-9]{12}\.json$/);
      const raw = readFileSync(`public/runeproof/source-guides/${entry.file}`, 'utf8');
      const parsed = parseSourceGuide(JSON.parse(raw), entry.questId);
      expect(parsed, entry.questId).not.toBeNull();
      expect(entry.file).toContain(createHash('sha256').update(raw).digest('hex').slice(0, 12));
      expect(parsed!.sections.length).toBe(entry.sectionCount);
      for (const section of parsed!.sections) {
        const ids = new Set(section.steps.map(step => step.id));
        for (const step of section.steps) {
          if (step.parentId) expect(ids.has(step.parentId), `${entry.questId}: missing related parent`).toBe(true);
          if (step.externalDependency) expect(step.note).toBeTruthy();
        }
      }
    }
  });
  it('rejects malformed downloads and mismatched quest identities', () => {
    const entry = index.entries[0];
    const data = JSON.parse(readFileSync(`public/runeproof/source-guides/${entry.file}`, 'utf8'));
    expect(parseSourceGuide(data, 'another quest')).toBeNull();
    expect(parseSourceGuide({ ...data, sections: [] }, entry.questId)).toBeNull();
    const duplicate = { ...data, sections: [data.sections[0], data.sections[0]] };
    expect(parseSourceGuide(duplicate, entry.questId)).toBeNull();
    expect(parseSourceGuide({ ...data, sections: [{ id: 'empty', title: 'Empty', steps: [] }] }, entry.questId)).toBeNull();
    const invalidNote = structuredClone(data);
    invalidNote.sections[0].steps[0].note = { invalid: 'React child' };
    expect(parseSourceGuide(invalidNote, entry.questId)).toBeNull();
  });
  it('ships upstream copyright notices and keeps private graphs out of the player entry point', () => {
    expect(readFileSync('public/runeproof/quest-helper-notices.txt', 'utf8')).toContain('Redistribution and use');
    const reader = readFileSync('features/runeproof/SourceGuideReader.tsx', 'utf8');
    expect(reader).not.toContain('dangerouslySetInnerHTML');
    expect(reader).not.toContain('Mark step done');
    expect(readFileSync('features/runeproof/RuneProofWorkspace.tsx', 'utf8')).not.toContain('runeproof-helper-graph');
  });
});
