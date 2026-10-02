// @ts-expect-error Node types are intentionally excluded from the browser app.
import { readdirSync, readFileSync, statSync } from 'node:fs';
// @ts-expect-error Node types are intentionally excluded from the browser app.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUNELITE_AVOIDED_WORDS, RUNELITE_TERMS } from '../data/runeliteWording';

/**
 * The tracker's own player text spells the Keys and Fate Points the way the
 * RuneLite plugin does (data/runeliteWording.ts): Omni-Keys, Chaos Keys, Fate
 * Points, and Pity Key with its capital.
 */
const KEY_TERMS = new Set<string>([RUNELITE_TERMS.OMNI_KEYS, RUNELITE_TERMS.CHAOS_KEYS, RUNELITE_TERMS.FATE_POINTS]);
const AVOIDED: ReadonlyArray<{ word: string; use: string }> = [
  ...RUNELITE_AVOIDED_WORDS.filter(({ use }) => KEY_TERMS.has(use)),
  { word: 'Omni-key', use: 'Omni-Key' },
  { word: 'Omni Keys', use: 'Omni-Keys' },
  { word: 'Chaos key', use: 'Chaos Key' },
  { word: 'fate point', use: 'Fate Point' },
  { word: 'Fate point', use: 'Fate Point' },
  { word: 'pity key', use: 'Pity Key' },
  { word: 'Pity key', use: 'Pity Key' },
  { word: 'pity keys', use: 'Pity Keys' },
  { word: 'Pity keys', use: 'Pity Keys' },
];

/** Whole word or phrase, case and all, as the RuneLite wording test matches. */
const says = (text: string, word: string): boolean => {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![A-Za-z0-9-])${escaped}(?![A-Za-z0-9])`).test(text);
};

/** Source with its comments removed, so only text the code can show is checked. */
const withoutComments = (source: string): string => source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:\\'"`])\/\/.*$/gm, '$1');

// The release notes keep the words of the day they shipped, and the style
// list has to name the words it avoids.
const SKIPPED = new Set(['data/changelog.ts', 'data/runeliteWording.ts']);

const sourceFiles = (folder: string): string[] => (readdirSync(folder) as string[]).flatMap((name: string) => {
  const path = join(folder, name).replace(/\\/g, '/');
  if (statSync(path).isDirectory()) return sourceFiles(path);
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && !SKIPPED.has(path) ? [path] : [];
});

const PLAYER_TEXT = ['App.tsx', ...['components', 'config', 'context', 'data', 'hooks', 'services', 'utils'].flatMap(sourceFiles)];

describe('player wording', () => {
  it('spells Keys, Fate Points and Pity Keys as the RuneLite plugin does', () => {
    expect(PLAYER_TEXT.length).toBeGreaterThan(100);
    const found: string[] = [];
    for (const path of PLAYER_TEXT) {
      const text = withoutComments(readFileSync(path, 'utf8'));
      for (const { word, use } of AVOIDED) {
        if (says(text, word)) found.push(`${path}: "${word}" (say "${use}")`);
      }
    }
    expect(found).toEqual([]);
  });

  it('matches whole words, case and all', () => {
    expect(says('Spend your Omni-keys', 'Omni-keys')).toBe(true);
    expect(says('Spend your Omni-Keys', 'Omni-keys')).toBe(false);
    expect(says('a guaranteed pity key.', 'pity key')).toBe(true);
    expect(says('pity keys', 'pity key')).toBe(false);
    expect(withoutComments("const a = 1; // an Omni-key comment\nconst url = 'https://x';")).not.toContain('Omni-key');
    expect(withoutComments("const url = 'https://x';")).toContain('https://x');
  });
});
