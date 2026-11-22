import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BANK_IDS } from '../data/banks';
import { readBankLocationRegistry } from './bank-locations.mjs';
import { buildBankDefinitions, generateBankAccessSource, generateBankSource, orderBanksForRolls, readBankRollOrder } from './gen-banks.mjs';
import { generatedTextMatches } from './generated-text.mjs';

describe('bank source generator', () => {
  // Seeded runs replay their Banks draws by position in BANK_IDS (context/chaosReplay.test.ts),
  // so the pool order is pinned whole: it was the label order of 22 November 2026.
  it('keeps the Banks roll pool in its fixed order', () => {
    expect(BANK_IDS).toHaveLength(125);
    expect(BANK_IDS.slice(0, 3)).toEqual(['13618', '13105', '5678']);
    expect(BANK_IDS.at(-1)).toBe('woodcutting-leprechaun');
    expect(createHash('sha256').update(BANK_IDS.join(',')).digest('hex'))
      .toBe('027ebcd096260e36a10e719919ae53f2772139f4b74f92733842b145bc102315');
    expect(BANK_IDS).toEqual(readBankRollOrder());
  });

  it('does not move a bank in the roll pool when its label changes', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const before = buildBankDefinitions(doc, registry).map(def => def.id);
    registry.labelOverrides = [
      ...registry.labelOverrides.map((override: { name: string }) => ({ ...override, name: `Zz ${override.name}` })),
      { id: '13618', name: 'Aaa first by name', wiki: [] },
    ];
    const renamed = buildBankDefinitions(doc, registry);

    expect(renamed.find(def => def.id === '13618')?.name).toBe('Aaa first by name');
    expect(renamed.map(def => def.id)).toEqual(before);
  });

  it('asks for a place in the roll order for every bank, and only for banks', () => {
    const defs = [{ id: '1', name: 'B' }, { id: '2', name: 'A' }];

    expect(orderBanksForRolls(defs, ['1', '2']).map(def => def.id)).toEqual(['1', '2']);
    expect(() => orderBanksForRolls(defs, ['1'])).toThrow(/no place .* 2/);
    expect(() => orderBanksForRolls(defs, ['1', '2', '3'])).toThrow(/not banks: 3/);
    expect(() => orderBanksForRolls(defs, ['1', '2', '1'])).toThrow(/twice/);
  });

  it('uses reviewed labels before chunk nicknames and appends the virtual bank after all 124 physical banks', () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const defs = buildBankDefinitions(doc, registry);
    const byId = Object.fromEntries(defs.map(def => [def.id, def.name]));

    expect(defs).toHaveLength(125);
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
    expect(generatedTextMatches(
      readFileSync('data/bankAccess.ts', 'utf8'),
      generateBankAccessSource(registry),
    )).toBe(true);
  });

  it('keeps the access rules out of the bank list, which loads with the first screen', () => {
    // data/banks.ts is in the start-up download; the rules are read only by utils/entityAccess.ts,
    // which loads on demand. They cost about 5 kB there, and the start-up budget has no room for them.
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    expect(generateBankSource(doc, readBankLocationRegistry())).not.toMatch(/accessOptions|BANK_ACCESS_GATES|BANK_REVIEWED/);
    const sources = import.meta.glob<string>(
      ['../{components,context,hooks,services,utils,data,config}/**/*.{ts,tsx}', '../*.{ts,tsx}', '!../**/*.test.{ts,tsx}'],
      { query: '?raw', import: 'default', eager: true },
    );
    const importers = Object.entries(sources)
      .filter(([, text]) => /from '[^']*data\/bankAccess'/.test(text))
      .map(([path]) => path.replace(/^\.\.\//, ''));
    expect(importers).toEqual(['utils/entityAccess.ts']);
  });

  it("gives the app the registry's access rules without its evidence, each location labelled by its name", () => {
    const doc = JSON.parse(readFileSync('public/chunk-content.json', 'utf8'));
    const registry = readBankLocationRegistry();
    const labels = Object.fromEntries(buildBankDefinitions(doc, registry).map(def => [def.id, def.name]));
    // utils/entityAccess.ts names a reviewed location by its label, so the two must agree.
    // A merged location (the Falador west bank's deposit box) is no bank of its own.
    const merged = new Set(registry.merges.map(({ id }: { id: string }) => id));
    for (const location of registry.locations) {
      expect(labels[location.id], location.id).toBe(merged.has(location.id) ? undefined : location.name);
    }
    const source = generateBankAccessSource(registry);
    expect(source).not.toContain('{"id":"11572"}');
    expect(source).toContain('{"id":"10293","accessOptions":[{"guilds":["Fishing Guild"]}]}');
    expect(source).toContain('{"id":"10553","accessOptions":[{"diaries":["Fremennik Easy"]}');
    expect(source).not.toContain('oldschool.runescape.wiki');
  });
});
