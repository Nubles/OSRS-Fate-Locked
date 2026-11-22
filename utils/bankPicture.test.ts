import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bankChunks, bankFor, bankModelName } from './bankPicture';

describe('bankPicture', () => {
  it('finds a bank by id or name and places it on its chunk', () => {
    const bank = bankFor('Canifis')!;
    expect(bankFor(bank.id)).toBe(bank);
    expect(bankChunks(bank)).toEqual([{ cx: 54, cy: 54 }]);
  });

  it('picks the bank model by kind', () => {
    expect(bankModelName(bankFor('Canifis')!)).toBe('Bank booth');
    expect(bankModelName(bankFor('Red Rock bank chest')!)).toBe('Bank chest');
    expect(bankModelName(bankFor('Aldarin dock deposit box')!)).toBe('Bank deposit box');
    expect(bankModelName(bankFor('Keldagrim bank and Blast Furnace chest')!)).toBe('Bank booth');
  });

  it('draws a bank whose place holds only a bank chest as a chest, whatever its label says', () => {
    // Chunk data: Castle Wars and the Fortis Colosseum (in its underground) hold a bank chest and no booth;
    // Neitiznot bank has "tellers = 0" and four bank chests (Wiki Neitiznot bank).
    expect(bankModelName(bankFor('9776')!)).toBe('Bank chest');
    expect(bankModelName(bankFor('7216')!)).toBe('Bank chest');
    expect(bankModelName(bankFor('9275')!)).toBe('Bank chest');
    expect(bankModelName(bankFor('11313')!)).toBe('Bank chest');
    // A reviewed deposit box only (data/sources/bank-locations.json reviewedFacilities).
    expect(bankModelName(bankFor('15151')!)).toBe('Bank deposit box');
  });

  it('keeps the label rule where the facility data cannot tell', () => {
    // Jatizso's teller, Magnus Gram, is not marked as a banker in the chunk data: still a booth.
    expect(bankModelName(bankFor('9531')!)).toBe('Bank booth');
    expect(bankModelName({ id: 'not-a-place', name: 'Somewhere deposit box' })).toBe('Bank deposit box');
    expect(bankModelName({ id: 'not-a-place', name: 'Somewhere bank chest' })).toBe('Bank chest');
    expect(bankModelName(bankFor('woodcutting-leprechaun')!)).toBe('Bank booth');
  });

  it('loads the picture kinds only with this module, not with the bank list', () => {
    const files = (dir: string): string[] => readdirSync(dir).flatMap(name => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
    const importers = ['components', 'context', 'data', 'hooks', 'services', 'utils', 'workers'].flatMap(files)
      .filter(path => /bankPictureKinds/.test(readFileSync(path, 'utf8')) && !path.endsWith('bankPictureKinds.ts'));
    expect(importers).toEqual([join('utils', 'bankPicture.ts')]);
  });

  it('gives a bank with no place no chunk', () => {
    expect(bankChunks(bankFor('woodcutting-leprechaun')!)).toEqual([]);
  });
});
