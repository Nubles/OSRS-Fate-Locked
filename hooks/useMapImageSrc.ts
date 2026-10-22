import { useEffect, useRef, useState } from 'react';
import { MAP_IMAGE } from '../utils/mapCoords';
import { mapImageIndexForScale } from '../utils/mapImageSize';

/**
 * The world map image to show for a map drawn at `scale` CSS px per map pixel
 * (utils/mapImageSize.ts). Undefined on the first render, before the map has
 * measured its box, so no copy is fetched for a guessed size. After that it
 * only ever moves up a size: zooming back out keeps the sharper copy already
 * loaded instead of fetching a smaller one.
 */
export const useMapImageSrc = (scale: number): string | undefined => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const best = useRef(-1);
  if (!mounted) return undefined;
  best.current = Math.max(best.current, mapImageIndexForScale(scale));
  return MAP_IMAGE.sizes[best.current].src;
};
