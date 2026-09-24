import { describe, expect, it } from 'vitest';
import { readQuestHelperSource, validateQuestHelperSnapshot, assertArchiveSource, pinnedArchiveEntries, sha256, QUEST_HELPER_COMMIT } from './quest-helper-source.mjs';

describe('pinned Quest Helper source evidence', () => {
  it('loads the Plugin Hub-pinned archive snapshot and preserves licence and source headers', async () => {
    const { data, manifest } = await readQuestHelperSource();
    expect(manifest.commit).toBe(QUEST_HELPER_COMMIT);
    expect(manifest.fileCount).toBe(369);
    expect(data.files.some(file => file.path.includes('/miniquests/'))).toBe(true);
    expect(data.files.find(file => file.path.endsWith('/TheRestlessGhost.java'))?.content).toContain('Copyright (c) 2020, Zoinkwiz');
    expect(data.licenceText).toContain('BSD 2-Clause License');
  });

  it('rejects corrupted snapshots before interpreting source content', async () => {
    const { raw, manifest } = await readQuestHelperSource();
    const corrupt = Buffer.from(raw);
    corrupt[corrupt.length - 4] ^= 1;
    expect(() => validateQuestHelperSnapshot(corrupt, manifest)).toThrow(/hash\/length/);
    expect(() => validateQuestHelperSnapshot(raw, { ...manifest, commit: '0'.repeat(40) })).toThrow(/reviewed pin/);
  });

  it('binds extracted source bytes to the pinned archive rather than trusting a folder label', () => {
    const path = 'src/main/java/com/questhelper/helpers/quests/example/Example.java';
    const authentic = Buffer.from('class Example {}');
    const entries = new Map([[path, authentic]]);
    expect(() => assertArchiveSource(path, Buffer.from('class Edited {}'), entries)).toThrow(/does not match pinned archive/);
    expect(() => assertArchiveSource(path, authentic, entries)).not.toThrow();
    expect(() => assertArchiveSource('unknown', authentic, entries)).toThrow(/does not match/);
    expect(() => pinnedArchiveEntries(Buffer.from('not the reviewed archive'))).toThrow(/archive hash/);
  });

  it('rejects same-commit modified source even under recomputed file and envelope hashes', async () => {
    const { data, manifest } = await readQuestHelperSource();
    const validateChanged = value => {
      const bytes = Buffer.from(JSON.stringify(value));
      return () => validateQuestHelperSnapshot(bytes, { ...manifest, rawBytes: bytes.length, rawSha256: sha256(bytes) });
    };
    const modified = structuredClone(data);
    modified.files[0].content += '\n// modified';
    modified.files[0].sha256 = sha256(modified.files[0].content);
    expect(validateChanged(modified)).toThrow(/reviewed pin/);
    const traversed = structuredClone(data);
    traversed.files[0].path = '../helpers/escape.java';
    expect(validateChanged(traversed)).toThrow(/reviewed pin/);
  });
});
