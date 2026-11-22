import { BANKS, BANK_BY_ID, type BankDef } from '../data/banks';
import { BANK_PICTURE_KINDS, type BankPictureKind } from '../data/bankPictureKinds';
import type { ChunkCoord } from './mapCoords';

/**
 * What a bank unlock shows in the OSRS layout: the game's own bank model for
 * its kind (booth, chest or deposit box — shared, so a bank's name never has
 * to match a model file) and its chunk on the world map.
 */
const BY_NAME = new Map(BANKS.map((b) => [b.name.toLowerCase(), b]));

/** A bank unlock by its id ("cx*256+cy") or its display name. */
export const bankFor = (idOrName: string): BankDef | undefined =>
  BANK_BY_ID[idOrName] ?? BY_NAME.get(idOrName.toLowerCase());

/** The bank's chunk, or none for a bank that isn't a place (the Forestry leprechaun). */
export const bankChunks = (bank: BankDef): ChunkCoord[] =>
  /^\d+$/.test(bank.id) ? [{ cx: Math.floor(Number(bank.id) / 256), cy: Number(bank.id) % 256 }] : [];

const MODEL_FOR_KIND: Record<BankPictureKind, string> = {
  booth: 'Bank booth', chest: 'Bank chest', box: 'Bank deposit box',
};

/**
 * The model name (manifest slug) for the bank's kind: from the facilities at its place
 * (scripts/gen-banks.mjs), else from its label.
 */
export const bankModelName = (bank: BankDef): string => {
  const kind = BANK_PICTURE_KINDS[bank.id];
  if (kind) return MODEL_FOR_KIND[kind];
  const n = bank.name.toLowerCase();
  if (n.includes('bank and')) return 'Bank booth'; // a full bank as well as a box or chest
  if (n.includes('deposit box')) return 'Bank deposit box';
  if (n.includes('chest')) return 'Bank chest';
  return 'Bank booth';
};
