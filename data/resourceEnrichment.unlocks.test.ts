import { describe, expect, it } from 'vitest';
import { ENRICHED_SOURCES } from './resourceEnrichment';

// The generated Wiki rows once tagged the Theatre of Blood's Monumental chest
// as Tombs of Amascut and Wintertodt's extra supply crate as Pest Control
// (scripts/sourceEnrichmentRules.ts maps them now). This fails until
// data/resourceEnrichment.ts is regenerated with the fixed script.
const rows = (name: string) => Object.values(ENRICHED_SOURCES).flat().filter(s => s.name === name);

describe('generated Wiki rows unlock the right activity', () => {
  it.each([
    ['Monumental Chest', 'Theatre of Blood'],
    ['Extra Supply Crate', 'Wintertodt'],
  ])('%s rows unlock with %s', (name, unlockId) => {
    expect(rows(name).length).toBeGreaterThan(0);
    for (const row of rows(name)) expect(row.unlockId).toBe(unlockId);
  });
});
