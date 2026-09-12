import React from 'react';
import { PendingUnlock, TableType } from '../types';
import { BANK_BY_ID } from '../data/banks';
import { SLOT_CONFIG, SPECIAL_ICONS, UTILITY_ITEM_IDS } from '../constants';
import { chunkLabel } from '../utils/chunkAdjacency';
import { VoidReveal } from './VoidReveal';

/** Mounted for the whole run, so a saved reveal also resumes outside Spend Keys. */
export function PendingUnlockReveal({ pending, animationsEnabled, onAccept }: {
  pending: PendingUnlock; animationsEnabled: boolean; onAccept: (id: string) => void;
}) {
  const label = pending.table === TableType.BANKS ? BANK_BY_ID[pending.item]?.name ?? pending.item
    : pending.table === TableType.CHUNKS ? chunkLabel(pending.item) : pending.item;
  const file = pending.table === TableType.SKILLS ? `${pending.item}_icon.png`
    : pending.table === TableType.EQUIPMENT ? SLOT_CONFIG[pending.item]?.file
    : SPECIAL_ICONS[pending.item];
  const image = UTILITY_ITEM_IDS[pending.item]
    ? `https://chisel.weirdgloop.org/static/img/osrs-sprite/${UTILITY_ITEM_IDS[pending.item]}.png`
    : file ? `https://oldschool.runescape.wiki/images/${file}` : undefined;
  return <VoidReveal key={pending.id} itemName={label} itemType={pending.table} itemImage={image}
    isChaos={pending.costType === 'chaosKey'} animationsEnabled={animationsEnabled} onComplete={() => onAccept(pending.id)} />;
}
