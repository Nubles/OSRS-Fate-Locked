import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const created: string[] = [];

function tempTree(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  created.push(directory);
  return directory;
}

function write(root: string, relativePath: string, contents: string): void {
  const target = join(root, relativePath);
  mkdirSync(resolve(target, '..'), { recursive: true });
  writeFileSync(target, contents, 'utf8');
}

afterEach(() => {
  for (const directory of created.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('RuneLite mirror verifier', () => {
  it.each([
    { kind: 'changed', sourceContents: 'source', mirrorContents: 'mirror' },
    { kind: 'added', sourceContents: 'source', mirrorContents: null },
    { kind: 'removed', sourceContents: null, mirrorContents: 'mirror' },
  ] as const)('reports a $kind file', ({ kind, sourceContents, mirrorContents }) => {
    const source = tempTree('fate-source-');
    const mirror = tempTree('fate-mirror-');
    const relativePath = 'src/main/java/com/fatelocked/FateLockedConfig.java';
    if (sourceContents !== null) write(source, relativePath, sourceContents);
    if (mirrorContents !== null) write(mirror, relativePath, mirrorContents);

    const result = spawnSync(
      process.execPath,
      [resolve('scripts/check-runelite-mirror.mjs')],
      {
        cwd: resolve('.'),
        env: {
          ...process.env,
          RUNELITE_SOURCE_DIR: source,
          RUNELITE_MIRROR_DIR: mirror,
        },
        encoding: 'utf8',
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(`${kind}: ${relativePath}`);
  });
});