import React, { useState } from 'react';
import type { LucideProps } from 'lucide-react';

/**
 * Renders a real OSRS Wiki image by filename, with an optional error fallback.
 * Missing decorative artwork keeps its footprint and adjacent label. Lets us replace generic placeholder icons
 * with their in-game counterparts without risking broken images.
 *
 * `file` is the wiki image filename, e.g. "World_map_icon.png".
 */
interface Props {
  file: string;
  alt: string;
  /** Lucide component to show if the wiki image can't load. */
  Fallback?: React.ComponentType<LucideProps>;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const WikiIcon: React.FC<Props> = ({ file, alt, Fallback, size = 14, className, style }) => {
  const [failedFile, setFailedFile] = useState<string | null>(null);
  if (failedFile === file) return Fallback ? <Fallback size={size} className={className} />
    : <span role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}
        className={className} style={{ width: size, height: size, display: 'inline-block', ...style }} />;
  return (
    <img
      src={`https://oldschool.runescape.wiki/images/${file}`}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'inline-block', ...style }}
      onError={() => setFailedFile(file)}
      draggable={false}
    />
  );
};
