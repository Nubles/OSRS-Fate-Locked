import React, { useState } from 'react';
import { NoteTrigger } from '../NoteTrigger';
import { SLOT_CONFIG } from '../../constants';
import { gemColor, gemSmallSrc, itemSrc, roman, slotUiSrc, wikiImageSrc } from './OsrsDashGems';
import './osrs-char.css';

/**
 * The OSRS Worn Equipment interface: the eleven slots in the game's layout,
 * joined by its connector lines. Slots use the same pictures as the classic
 * tracker: the wiki slot icon when empty, the item's wiki image when worn,
 * drawn near their own size inside a bigger slot box so they stay sharp.
 * Each slot carries its tier on the box: a numeral in the top-left corner, where the game draws stack
 * counts, and a gem in the bottom-right (the same Opal..Onyx ladder as the
 * skills, coloured alike); tier 0 has neither and its icon is faded.
 *
 * Drawn at a scale (`--s`) that osrs-char.css picks from the space the
 * doll's container has, so it fills the panel.
 * Presentation only: every slot's click, label and Examine text come in.
 */

export interface DollSlot {
  slot: string;
  /** Worn item id, if any. */
  itemId?: number | null;
  /** The worn item's wiki image file. */
  imageFile?: string;
  /** Tier the slot shows as its numeral and corner gem (0 = neither). */
  gem: number;
  /** Fade the slot's icon (nothing unlocked in it). */
  dim: boolean;
  selected?: boolean;
  /** An Omni-Key could raise this slot now. */
  omni?: boolean;
  label: string;
  examine: string;
  onClick?: () => void;
  disabled?: boolean;
  /** Show the slot's note button (NoteTrigger id `Equip_<slot>`). */
  note?: boolean;
  /** Extra text inside the button (kept for screen readers and tests). */
  srText?: string;
}

/** Slot positions in the game's 148 x 192 equipment layout (native pixels). */
export const DOLL_POS: Record<string, [number, number]> = {
  Head: [56, 0],
  Cape: [15, 39], Neck: [56, 39], Ammo: [97, 39],
  Weapon: [0, 78], Body: [56, 78], Shield: [112, 78],
  Legs: [56, 117],
  Gloves: [0, 156], Boots: [56, 156], Ring: [112, 156],
};

/** Connector lines: [x, y, length, vertical], through the slot centres. */
const LINES: [number, number, number, boolean][] = [
  [71, 18, 156, true], // Head down to Boots
  [33, 54, 82, false], // Cape - Neck - Ammo
  [18, 93, 112, false], // Weapon - Body - Shield
  [15, 96, 78, true], // Weapon down to Gloves
  [127, 96, 78, true], // Shield down to Ring
];

/** The slot's icon, the same OSRS Wiki image the classic Equipment Lab and Gear view show. */
const slotIconSrc = (slot: string): string => wikiImageSrc(SLOT_CONFIG[slot]?.file ?? 'Worn_Equipment.png');

/** A worn item's wiki image (as the classic Gear view shows it); the slot icon if it does not load. */
const SlotItem: React.FC<{ slot: string; imageFile?: string }> = ({ slot, imageFile }) => {
  const [failed, setFailed] = useState(!imageFile);
  if (failed) return <img key="icon" className="osrs-char-slotsil" src={slotIconSrc(slot)} alt="" aria-hidden="true" />;
  return <img key="item" className="osrs-char-slotitem" src={wikiImageSrc(imageFile!)} alt="" aria-hidden="true" onError={() => setFailed(true)} />;
};

const px = (n: number) => `calc(var(--s) * ${n}px)`;

export const OsrsCharDoll: React.FC<{ slots: DollSlot[]; suspendModals?: boolean; className?: string }> = ({ slots, suspendModals = false, className }) => (
  <div
    className={`osrs-char-doll${className ? ` ${className}` : ''}`}
    style={{
      '--osrs-char-line-v': `url(${slotUiSrc('line-v')})`,
      '--osrs-char-line-h': `url(${slotUiSrc('line-h')})`,
    } as React.CSSProperties}
  >
    {LINES.map(([x, y, len, v], i) => (
      <span
        key={i}
        aria-hidden="true"
        className={v ? 'osrs-char-line is-v' : 'osrs-char-line is-h'}
        style={v
          ? { left: px(x), top: px(y), height: px(len) }
          : { left: px(x), top: px(y), width: px(len) }}
      />
    ))}
    {slots.map((s) => {
      const pos = DOLL_POS[s.slot];
      if (!pos) return null;
      return (
        <div
          key={s.slot}
          className="osrs-char-dollcell"
          style={{ left: px(pos[0]), top: px(pos[1]) }}
          data-examine-name={`${s.slot} slot`}
          data-examine={s.examine}
        >
          <button
            type="button"
            className={[
              'osrs-char-slot',
              s.dim ? 'is-dim' : '',
              s.itemId != null ? 'has-item' : '',
              s.selected ? 'is-sel' : '',
            ].filter(Boolean).join(' ')}
            onClick={s.onClick}
            disabled={s.disabled}
            title={s.label}
            aria-label={s.label}
          >
            {s.itemId != null
              ? <SlotItem key={s.itemId} slot={s.slot} imageFile={s.imageFile} />
              : <img className="osrs-char-slotsil" src={slotIconSrc(s.slot)} alt="" aria-hidden="true" />}
            {s.gem > 0 && <span className="osrs-char-slottier" style={{ color: gemColor(s.gem) }} aria-hidden="true">{roman(s.gem)}</span>}
            {s.gem > 0 && <img className="osrs-px osrs-char-slotgem" src={gemSmallSrc(s.gem)} alt="" aria-hidden="true" />}
            {s.omni && <img className="osrs-px osrs-char-slotomni" src={itemSrc('omni_key')} alt="" aria-hidden="true" title="An Omni-Key can raise this slot" />}
            {s.srText && <span className="sr-only">{s.srText}</span>}
          </button>
          {s.note && <span className="osrs-dash-note is-corner"><NoteTrigger id={`Equip_${s.slot}`} title={s.slot} suspendModals={suspendModals} /></span>}
        </div>
      );
    })}
  </div>
);

export default OsrsCharDoll;
