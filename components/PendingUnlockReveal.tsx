import React, { Suspense } from 'react';
import { PendingUnlock, TableType } from '../types';
import { BANK_BY_ID } from '../data/banks';
import { SLOT_CONFIG, SPECIAL_ICONS, UTILITY_ITEM_IDS } from '../constants';
import { chunkLabelWithCoords } from '../utils/chunkLabelWithCoords';
import { VoidReveal } from './VoidReveal';
import { lazyWithRetry } from '../utils/lazyRetry';
import { useIsOsrsUi } from '../utils/uiStyle';
import { useOsrsNav } from '../utils/osrsNav';

const OsrsSpendReveal = lazyWithRetry(() => import('./osrs/OsrsSpendReveal'));

/** Mounted for the whole run, so a saved reveal also resumes outside Spend Keys. */
export function PendingUnlockReveal({ pending, animationsEnabled, onAccept, tier }: {
  pending: PendingUnlock; animationsEnabled: boolean; onAccept: (id: string) => void;
  /** The skill's tier now that the unlock is applied. */
  tier?: number;
}) {
  const osrs = useIsOsrsUi();
  // With the wide Spend Keys board open, the OSRS reveal draws in its reveal window.
  const nav = useOsrsNav();
  const docked = nav.screen === 'keys' && nav.keysTab === 'spend';
  const label = pending.table === TableType.BANKS ? BANK_BY_ID[pending.item]?.name ?? pending.item
    : pending.table === TableType.CHUNKS ? chunkLabelWithCoords(pending.item) : pending.item;
  const file = pending.table === TableType.SKILLS ? `${pending.item}_icon.png`
    : pending.table === TableType.EQUIPMENT ? SLOT_CONFIG[pending.item]?.file
    : SPECIAL_ICONS[pending.item];
  const image = UTILITY_ITEM_IDS[pending.item]
    ? `https://chisel.weirdgloop.org/static/img/osrs-sprite/${UTILITY_ITEM_IDS[pending.item]}.png`
    : file ? `https://oldschool.runescape.wiki/images/${file}` : undefined;
  const props = { itemName: label, itemType: pending.table, itemImage: image, isChaos: pending.costType === 'chaosKey',
    animationsEnabled, tier, onComplete: () => onAccept(pending.id) };
  // Fate's Mercy and Breakthrough are free: the OSRS reveal names them instead of a cost.
  const freeDraw = pending.costType === 'mercy' || pending.costType === 'breakthrough' ? pending.costType : undefined;
  // The OSRS layout draws the same roll as an OSRS interface window.
  if (osrs) return <Suspense key={pending.id} fallback={null}><OsrsSpendReveal {...props} freeDraw={freeDraw} docked={docked} /></Suspense>;
  return <VoidReveal key={pending.id} {...props} />;
}
