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

  it('gives a bank with no place no chunk', () => {
    expect(bankChunks(bankFor('woodcutting-leprechaun')!)).toEqual([]);
  });
});
