import { describe, expect, it } from 'vitest';
import { BANK_BY_ID, BANK_IDS } from '../data/banks';
import { BANK_IDS_BY_NAME } from './bankDisplayOrder';

// The four banks renamed for their place (audit banks 10). They keep their old
// place in the roll pool, so the pool is no longer in name order.
const RENAMED = ['11313', '13618', '14638', '14644'];

describe('the Banks list order on screen', () => {
  it('lists every bank once', () => {
    expect([...BANK_IDS_BY_NAME].sort()).toEqual([...BANK_IDS].sort());
  });

  it('runs A to Z by place name', () => {
    const names = BANK_IDS_BY_NAME.map((id) => BANK_BY_ID[id].name);
    for (let i = 1; i < names.length; i++) {
      expect(names[i - 1].localeCompare(names[i], 'en'), `${names[i - 1]} before ${names[i]}`).toBeLessThanOrEqual(0);
    }
  });

  it('puts the renamed banks by their new names, and moves no other place bank', () => {
    const name = (id: string) => BANK_BY_ID[id].name;
    expect(RENAMED.map(name)).toEqual([
      'Mor Ul Rek (TzHaar City) banks', "Tarn's Lair bank", "Mos Le'Harmless bank", 'Hallowed Sepulchre bank chests',
    ]);
    // The Forestry leprechaun, the one bank with no chunk, closed the pool after "Z"; here it sits under W.
    const moved = [...RENAMED, 'woodcutting-leprechaun'];
    const others = (ids: string[]) => ids.filter((id) => !moved.includes(id));
    expect(others(BANK_IDS_BY_NAME)).toEqual(others(BANK_IDS));
    expect(BANK_IDS.at(-1)).toBe('woodcutting-leprechaun');
    expect(name(BANK_IDS_BY_NAME[BANK_IDS_BY_NAME.indexOf('woodcutting-leprechaun') + 1])).toBe('Wyrmscraig bank chest');
    // In the pool they still sit where their old names put them.
    expect(BANK_IDS.indexOf('14638')).not.toBe(BANK_IDS_BY_NAME.indexOf('14638'));
    const at = BANK_IDS_BY_NAME.indexOf('14638');
    expect(name(BANK_IDS_BY_NAME[at - 1]).localeCompare("Mos Le'Harmless bank", 'en')).toBeLessThan(0);
    expect(name(BANK_IDS_BY_NAME[at + 1]).localeCompare("Mos Le'Harmless bank", 'en')).toBeGreaterThan(0);
  });
});
