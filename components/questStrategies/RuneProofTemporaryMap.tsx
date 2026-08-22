import { MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { MAP_IMAGE } from '../../utils/mapCoords';
import type { ChunkKey } from '../../utils/questRoutes/model';
import {
  chunkRectOnMap,
  createRouteMapGeometry,
  type RouteMapSize,
} from '../../utils/questRoutes/routeMapGeometry';

interface RuneProofTemporaryMapProps {
  readonly instruction: string;
  readonly locationLabel?: string;
  readonly chunk: ChunkKey;
  readonly returnFocusTarget: HTMLElement | null;
  readonly onClose: () => void;
}

const DEFAULT_VIEWPORT: RouteMapSize = { width: 640, height: 360 };

const nearbyChunks = (chunk: ChunkKey): ChunkKey[] => {
  const [cx, cy] = chunk.split(',').map(Number);
  const chunks: ChunkKey[] = [];

  for (let y = cy + 1; y >= cy - 1; y -= 1) {
    for (let x = cx - 2; x <= cx + 2; x += 1) {
      chunks.push(`${x},${y}` as ChunkKey);
    }
  }

  return chunks;
};

export function RuneProofTemporaryMap({
  instruction,
  locationLabel,
  chunk,
  returnFocusTarget,
  onClose,
}: RuneProofTemporaryMapProps) {
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const regionRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<RouteMapSize>(DEFAULT_VIEWPORT);
  const [imageFailed, setImageFailed] = useState(false);
  const geometry = useMemo(
    () => createRouteMapGeometry(nearbyChunks(chunk), viewportSize, 16),
    [chunk, viewportSize],
  );
  const targetRect = chunkRectOnMap(chunk);
  const underlyingDialog = returnFocusTarget?.closest<HTMLElement>('[role="dialog"]') ?? null;

  useEffect(() => {
    if (!underlyingDialog) return;
    const previousAriaHidden = underlyingDialog.getAttribute('aria-hidden');
    underlyingDialog.setAttribute('aria-hidden', 'true');

    return () => {
      if (previousAriaHidden === null) underlyingDialog.removeAttribute('aria-hidden');
      else underlyingDialog.setAttribute('aria-hidden', previousAriaHidden);
    };
  }, [underlyingDialog]);

  useFocusTrap(regionRef, true, returnFocusTarget);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const preventBackgroundScroll = (event: Event) => event.preventDefault();
    overlay.addEventListener('wheel', preventBackgroundScroll, { passive: false });
    overlay.addEventListener('touchmove', preventBackgroundScroll, { passive: false });

    return () => {
      overlay.removeEventListener('wheel', preventBackgroundScroll);
      overlay.removeEventListener('touchmove', preventBackgroundScroll);
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === 'undefined') return;

    const updateSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0) return;
      setViewportSize(current => (
        current.width === width && current.height === height
          ? current
          : { width, height }
      ));
    };

    const initialRect = viewport.getBoundingClientRect();
    updateSize(initialRect.width, initialRect.height);
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[80] flex touch-none items-center justify-center overscroll-none bg-black/80 p-3 backdrop-blur-sm sm:p-6"
      onClick={event => {
        event.stopPropagation();
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={event => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    >
      <section
        ref={regionRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Temporary map for ${instruction}`}
        tabIndex={-1}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-cyan-400/35 bg-[#111] shadow-2xl shadow-black/70 focus:outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-300">
              RuneProof temporary map
            </p>
            <h3 className="mt-1 break-words text-sm font-bold leading-relaxed text-gray-100">
              {instruction}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-cyan-100">
                <MapPin size={12} aria-hidden />
                Chunk {chunk}
              </span>
              {locationLabel ? <span className="text-gray-400">{locationLabel}</span> : null}
            </div>
          </div>
          <button
            type="button"
            autoFocus
            aria-label="Close map and return to RuneProof"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-gray-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        <div className="min-h-0 flex-1 p-3 sm:p-4">
          <div
            ref={viewportRef}
            className="relative h-[min(62dvh,520px)] min-h-[280px] w-full overflow-hidden rounded-lg border border-white/10 bg-[#080b0c]"
          >
            {imageFailed || !targetRect ? (
              <div className="flex h-full items-center justify-center px-6 text-center text-xs text-gray-400">
                The local OSRS map image could not be displayed. Return to RuneProof and keep using the reviewed chunk shown above.
              </div>
            ) : (
              <div
                className="absolute left-0 top-0 origin-top-left"
                style={{
                  width: MAP_IMAGE.width,
                  height: MAP_IMAGE.height,
                  transform: `translate(${geometry.fitted.x}px, ${geometry.fitted.y}px) scale(${geometry.fitted.scale})`,
                }}
              >
                <img
                  src={MAP_IMAGE.srcLo}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-fill"
                  draggable={false}
                />
                <img
                  src={MAP_IMAGE.src}
                  alt="OSRS world map"
                  onError={() => setImageFailed(true)}
                  className="absolute inset-0 h-full w-full object-fill"
                  draggable={false}
                />
                <div
                  aria-hidden="true"
                  className="absolute border-4 border-cyan-300 bg-cyan-300/20 shadow-[0_0_18px_rgba(103,232,249,0.9)]"
                  style={{
                    left: targetRect.x,
                    top: targetRect.y,
                    width: targetRect.width,
                    height: targetRect.height,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}
