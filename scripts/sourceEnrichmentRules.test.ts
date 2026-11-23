import { describe, expect, it } from 'vitest';
import { UNLOCK_ALIAS, leagueRegions } from './sourceEnrichmentRules';

describe('enrichment unlock aliases', () => {
  // Wiki: the Monumental chest is the Theatre of Blood reward chest, and
  // extra supply crates come from Ignisia at Wintertodt.
  it.each([
    ['monumental chest', 'Theatre of Blood'],
    ['extra supply crate', 'Wintertodt'],
    ['reward cart', 'Wintertodt'],
    ['ancient chest', 'Chambers of Xeric'],
  ])('%s resolves to %s', (name, unlock) => {
    expect(UNLOCK_ALIAS[name]).toBe(unlock);
  });

  it('only names Tombs of Amascut for its own bosses', () => {
    const toa = Object.entries(UNLOCK_ALIAS).filter(([, u]) => u === 'Tombs of Amascut').map(([k]) => k).sort();
    expect(toa).toEqual(['akkha', 'ba-ba', 'kephri', 'zebak']);
  });
});

describe('leagueRegions', () => {
  it.each([
    ['Morytania', ['Morytania']],
    ['morytania', ['Morytania']],
    ['kourend', ['Kourend & Kebos']],
    ['Desert', ['Kharidian Desert']],
    ['asgarnia,wilderness', ['Asgarnia', 'Wilderness']],
    ['general,kourend,morytania', ['Kourend & Kebos', 'Morytania']],
    ['misthalin&fremennik', ['Misthalin', 'Fremennik']],
    ['fremennik,no', ['Fremennik']],
    [' Kandarin , tirannwn ', ['Kandarin', 'Tirannwn']],
    ['kandarin,kandarin', ['Kandarin']],
  ] as const)('maps %j to %j', (raw, regions) => {
    expect(leagueRegions(raw)).toEqual(regions);
  });

  it.each(['General', 'No', 'n/a,no', '', undefined, null, 3])('maps %j to no region', (raw) => {
    expect(leagueRegions(raw)).toEqual([]);
  });
});
