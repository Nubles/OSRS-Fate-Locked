import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBankLocationRegistry } from './bank-locations.mjs';
import { buildBankDefinitions, generateBankSource } from './gen-banks.mjs';
import { generatedTextMatches } from './generated-text.mjs';

describe('bank source generator', () => {
  it('uses reviewed labels before chunk nicknames and appends the virtual bank after all 126 physical banks', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const defs = buildBankDefinitions(doc, registry);
    const byId = Object.fromEntries(defs.map(def => [def.id, def.name]));

    expect(defs).toHaveLength(127);
    expect(defs.at(-1)).toEqual({
      id: 'woodcutting-leprechaun',
      name: 'Woodcutting Leprechaun (Forestry)',
    });
    expect(generateBankSource(doc, registry)).toContain('// 1 virtual registry entry. Each is its own unlock in bank-locked modes.');
    expect(byId['10275']).toBe('Wyrmscraig bank chest');
    expect(byId['11830']).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(byId['14132']).toBe('Sangvesti and Castle Drakan banking');
  });

  it('does not add the virtual bank to the public physical chunk list', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));

    expect(doc.banks).not.toContain('woodcutting-leprechaun');
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
