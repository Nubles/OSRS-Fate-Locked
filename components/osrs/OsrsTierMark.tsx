import React from 'react';
import { useTierMarks } from '../../utils/uiStyle';
import { gemColor, gemSrc, roman } from './OsrsDashGems';

/**
 * A skill or equipment-slot tier as the OSRS layout marks it: the Roman
 * numeral in the tier's colour (the default, as the Worn Equipment slots draw
 * it), or the tier's cut gem when Settings > Tier marks is set to Gems.
 * osrs-skin.css sizes each numeral near the gem it stands in for.
 * Decoration only: the text beside it names the tier.
 */
export type TierMarkSize = 'chip' | 'row' | 'hero';
/** on = owned, next = the next tier to unlock, off = locked further out. */
export type TierMarkLook = 'on' | 'next' | 'off';

const GEM_BOX: Record<TierMarkSize, [number, number]> = { chip: [18, 16], row: [27, 24], hero: [36, 32] };
const GEM_DIM: Record<TierMarkLook, string | undefined> = {
  on: undefined, next: 'grayscale(.4) brightness(.8)', off: 'grayscale(1) brightness(.45)',
};
const NUMERAL_DIM: Record<TierMarkLook, string | undefined> = {
  on: undefined, next: 'var(--osrs-orange, #ff981f)', off: '#7d705c',
};

export const OsrsTierMark: React.FC<{ tier: number; size: TierMarkSize; look?: TierMarkLook; framed?: boolean }> = ({
  tier, size, look = 'on', framed = false,
}) => {
  const marks = useTierMarks();
  if (tier <= 0) return null;
  if (marks === 'gems') {
    const [width, height] = GEM_BOX[size];
    return <img className="osrs-px" src={gemSrc(tier)} alt="" aria-hidden="true" width={width} height={height} style={{ filter: GEM_DIM[look] }} />;
  }
  return (
    <span
      className={`osrs-tiermark is-${size}${framed ? ' is-framed' : ''}`}
      style={{ color: NUMERAL_DIM[look] ?? gemColor(tier) }}
      aria-hidden="true"
    >
      {roman(tier)}
    </span>
  );
};

export default OsrsTierMark;
