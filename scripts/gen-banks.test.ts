import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBankLocationRegistry } from './bank-locations.mjs';
import { buildBankDefinitions, generateBankSource } from './gen-banks.mjs';
import { generatedTextMatches } from './generated-text.mjs';

describe('bank source generator', () => {
  it('uses reviewed labels before chunk nicknames and emits all 126 banks', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const defs = buildBankDefinitions(doc, registry);
    const byId = Object.fromEntries(defs.map(def => [def.id, def.name]));

    expect(defs).toHaveLength(126);
    expect(byId['10275']).toBe('Wyrmscraig bank chest');
    expect(byId['11830']).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(byId['14132']).toBe('Sangvesti and Castle Drakan banking');
  });

  it('matches the committed generated TypeScript', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    expect(generatedTextMatches(
      readFileSync('data/banks.ts', 'utf8'),
      generateBankSource(doc, registry),
    )).toBe(true);
  });
});
