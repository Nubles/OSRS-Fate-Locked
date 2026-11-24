import { describe, expect, it } from 'vitest';
import { buildOracleSearchIndex } from './OracleSearch';
import { oracleWikiUrl, diaryWikiUrl } from '../utils/questWikiUrl';
import { NO_WIKI_PAGE, wikiUrlFor } from '../data/assets';
import recorded from './OracleSearch.wikiTitles.json';

const WIKI = 'https://oldschool.runescape.wiki/w/';
const titleOf = (url: string) => decodeURIComponent(url.slice(WIKI.length)).split('#')[0].replace(/_/g, ' ');
const rows = buildOracleSearchIndex();
const row = (type: string, name: string) => {
  const found = rows.find(r => r.type === type && r.name === name);
  if (!found) throw new Error(`no Oracle row ${type} ${name}`);
  return found;
};

describe('Oracle "Open OSRS Wiki" links', () => {
  it('links every row to a Wiki page on record, or to the search for a name the app made up', () => {
    const known = new Set(recorded.titles);
    const unknown: string[] = [];
    for (const r of rows) {
      const url = oracleWikiUrl(r);
      expect(url.startsWith(WIKI)).toBe(true);
      if (url.includes('Special:Search')) {
        if (!NO_WIKI_PAGE.has(r.name)) unknown.push(`${r.type}: ${r.name} -> search`);
      } else if (!known.has(titleOf(url))) {
        unknown.push(`${r.type}: ${r.name} -> ${titleOf(url)}`);
      }
    }
    expect(unknown).toEqual([]);
    expect(rows.length).toBeGreaterThan(2700);
  });

  it('builds the link by the kind of row', () => {
    expect(oracleWikiUrl(row('Quest', 'RFD: Dwarf'))).toBe(`${WIKI}Recipe_for_Disaster`);
    expect(oracleWikiUrl(row('Diary', 'Western Easy'))).toBe(`${WIKI}Western_Provinces_Diary#Easy`);
    expect(oracleWikiUrl(row('Diary', 'Kourend Elite'))).toBe(`${WIKI}Kourend_%26_Kebos_Diary#Elite`);
    expect(oracleWikiUrl(row('Combat Achievement', 'Grandmaster Tier'))).toBe(`${WIKI}Combat_Achievements/Grandmaster`);
    expect(oracleWikiUrl(row('Slayer Unlock', 'Ring Bling'))).toBe(`${WIKI}Slayer_Rewards`);
    expect(oracleWikiUrl(row('Storage', 'Beginner STASH'))).toBe(`${WIKI}STASH`);
    expect(oracleWikiUrl(row('Collection Log', 'Ikkle Hydra (serpentine)'))).toBe(`${WIKI}Ikkle_Hydra`);
    expect(oracleWikiUrl(row('Collection Log', 'Golden Armadyl special attack (item)'))).toBe(`${WIKI}Golden_Armadyl_special_attack`);
    expect(oracleWikiUrl(row('Merchant', 'Claw Shops'))).toBe(`${WIKI}Special:Search?search=Claw%20Shops`);
  });

  it('leaves links that already opened a page as they were', () => {
    expect(wikiUrlFor('Zulrah')).toBe(`${WIKI}Zulrah`);
    expect(wikiUrlFor('Jewellery Shops')).toBe(`${WIKI}Jewellery_shop`);
    expect(wikiUrlFor('Spirit Trees')).toBe(`${WIKI}Special:Search?search=Spirit%20Trees`);
    expect(diaryWikiUrl('Lumbridge Hard')).toBe(`${WIKI}Lumbridge_%26_Draynor_Diary#Hard`);
  });
});
