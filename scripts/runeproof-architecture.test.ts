import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
it('keeps the new RuneProof feature independent of legacy route and walkthrough engines', () => {
  const files = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.[jt]sx?$/.test(path) && !/\.test\./.test(path) ? [path] : [];
  });
  for (const file of files('features/runeproof')) {
    const source = readFileSync(file, 'utf8');
    expect(source, file).not.toMatch(/(?:from\s*|import\s*\(|require\s*\()\s*['"][^'"]*(?:questRoutes|questStrategies|questWalkthroughs)/i);
  }
});
