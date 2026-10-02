import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readBankLocationRegistry } from './bank-locations.mjs';
import { buildBankDefinitions, generateBankSource } from './gen-banks.mjs';
import { generatedTextMatches } from './generated-text.mjs';

describe('bank source generator', () => {
  it('uses reviewed labels before chunk nicknames and appends the virtual bank after all 125 physical banks', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const defs = buildBankDefinitions(doc, registry);
    const byId = Object.fromEntries(defs.map(def => [def.id, def.name]));

    expect(defs).toHaveLength(126);
    expect(defs.at(-1)).toEqual({
      id: 'woodcutting-leprechaun',
      name: 'Woodcutting Leprechaun (Forestry)',
    });
    expect(generateBankSource(doc, registry)).toContain('// 1 virtual registry entry. Each is its own unlock in bank-locked modes.');
    expect(byId['10275']).toBe('Wyrmscraig bank chest');
    expect(byId['11830']).toBe('Ruins of Camdozaal (via Ice Mountain)');
    expect(byId['14132']).toBe('Sangvesti and Castle Drakan banking');
  });

  it('names the Ardougne banks as the Wiki does and keeps their chunk ids', () => {
    // Chunk (40,52) is nicknamed Chaos Druid Tower, but its bank is the Wiki's
    // Ardougne north bank at 2617,3333; the tower has none. Chunk (41,51),
    // Ardougne Market, holds Ardougne south bank at 2653,3284.
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const defs = buildBankDefinitions(doc, readBankLocationRegistry());
    const byId = Object.fromEntries(defs.map(def => [def.id, def.name]));
    const names = defs.map(def => def.name);

    expect(doc.chunks['10292'].n).toBe('Chaos Druid Tower');
    expect(doc.chunks['10547'].n).toBe('Ardougne Market');
    expect(byId['10292']).toBe('Ardougne north bank');
    expect(byId['10547']).toBe('Ardougne south bank');
    expect(names).not.toContain('Chaos Druid Tower');
    expect(names).not.toContain('Ardougne Market');
  });

  it('merges the two bank unlocks that open no bank into the bank each leads to', () => {
    // Rellekka Peninsula is the way into Keldagrim, and Asgarnian Road the way into the
    // Dwarven Mine and its Motherlode Mine chest (owner decision M5, 2 October 2026).
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const ids = buildBankDefinitions(doc, registry).map(def => def.id);
    const source = generateBankSource(doc, registry);

    expect(doc.banks).toEqual(expect.arrayContaining(['10810', '12085']));
    expect(ids).not.toContain('10810');
    expect(ids).not.toContain('12085');
    expect(ids).toEqual(expect.arrayContaining(['11066', '12084']));
    expect(source).toContain("  '10810': '11066',\n  '12085': '12084',");
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

  it("gives the app the registry's access rules without its evidence, each location labelled by its name", () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const labels = Object.fromEntries(buildBankDefinitions(doc, registry).map(def => [def.id, def.name]));
    // utils/entityAccess.ts names a reviewed location by its label, so the two must agree.
    for (const location of registry.locations) expect(labels[location.id], location.id).toBe(location.name);
    const source = generateBankSource(doc, registry);
    expect(source).toContain('{"id":"10293","accessOptions":[{"guilds":["Fishing Guild"]}]}');
    expect(source).toContain('{"id":"10553","accessOptions":[{"diaries":["Fremennik Easy"]}');
    expect(source).not.toContain('oldschool.runescape.wiki');
  });
});
