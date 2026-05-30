import React, { useState } from 'react';
import type { LucideIcon } from 'lucide-react';

/**
 * Renders a real OSRS Wiki image (icon) by filename, falling back to a lucide
 * glyph if the image fails to load. Lets us replace generic placeholder icons
 * with their in-game counterparts without risking broken images.
 *
 * `file` is the wiki image filename, e.g. "World_map_icon.png".
 */
interface Props {
  file: string;
  alt: string;
  /** Lucide component to show if the wiki image can't load. */
  Fallback: LucideIcon;
  size?: number;
  className?: string;
}

export const WikiIcon: React.FC<Props> = ({ file, alt, Fallback, size = 14, className }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return <Fallback size={size} className={className} />;
  return (
    <img
      src={`https://oldschool.runescape.wiki/images/${file}`}
      alt={alt}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block' }}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
};
