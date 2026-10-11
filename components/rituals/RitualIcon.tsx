import React, { useEffect, useRef } from 'react';
import type { Ritual } from '../../config/economy';
import { spriteUrl, SPRITE_H, SPRITE_W, type SpriteName } from './ritualAssets';
import { makeDie } from './ritualPixels';

const SPRITES: Record<Exclude<Ritual['id'], 'LUCK'>, SpriteName> = {
  GREED: 'coins_10000',
  CHAOS: 'chaos_rune',
  GAMBIT: 'void_seal',
  CARTOGRAPHER: 'crandor_map',
  TRANSMUTE: 'omni_key',
};

/** A ritual's picture on the Altar: an item sprite, or Clarity's hand-drawn die. */
export const RitualIcon: React.FC<{ id: Ritual['id']; scale?: number }> = ({ id, scale = 2 }) => {
  const dieRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (id !== 'LUCK' || !dieRef.current) return;
    const die = makeDie(scale * 2);
    die.draw([5]);
    dieRef.current.replaceChildren(die.el);
  }, [id, scale]);
  if (id === 'LUCK') return <span ref={dieRef} aria-hidden="true" className="inline-grid" />;
  return (
    <img src={spriteUrl(SPRITES[id])} alt="" aria-hidden="true" width={SPRITE_W * scale} height={SPRITE_H * scale}
      draggable={false} style={{ imageRendering: 'pixelated' }} />
  );
};
