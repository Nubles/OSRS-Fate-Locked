import React, { useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import type { GuideCallout, GuideFigure as GuideFigureData, GuideFigureSource } from '../../data/runeliteGuide';

/** What each picture's caption says about where it comes from. */
export const GUIDE_FIGURE_SOURCES: Readonly<Record<GuideFigureSource, string>> = {
  rendered: 'Drawn by the plugin’s own code, in RuneLite’s theme.',
  'web-capture': 'Captured from the companion.',
};

/** Room beside a picture for its numbered markers, in the picture's own pixels. */
export const GUIDE_MARKER_GUTTER = 44;
const MARKER_RADIUS = 10;
const MARKER_GAP = 24;

export const resolveGuideImageSrc = (
  src: string,
  baseUrl = import.meta.env.BASE_URL || '/',
): string => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${src.replace(/^\/+/, '')}`;
};

/**
 * The size a picture is shown at, in CSS pixels. The plugin's pictures are drawn at twice the
 * detail and shown at that size, so RuneLite's own pixel font is large and sharp; a capture of the
 * companion is shown at the size it has on screen.
 */
export const guideDisplaySize = (figure: GuideFigureData): { width: number; height: number } =>
  figure.source === 'rendered'
    ? { width: figure.width, height: figure.height }
    : { width: figure.width / figure.scale, height: figure.height / figure.scale };

export interface PlacedMarker {
  readonly callout: GuideCallout;
  /** The outline, in the shown picture's pixels. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Where the marker sits in the gutter, level with what it names where it can be. */
  readonly markerY: number;
}

/**
 * Places each marker beside the picture, level with the middle of what it names, pushed down
 * just enough that no two overlap, and back up if the last would fall off the bottom.
 */
export const placeMarkers = (
  callouts: readonly GuideCallout[],
  width: number,
  height: number,
): readonly PlacedMarker[] => {
  const placed = callouts
    .map(callout => {
      const [x, y, w, h] = callout.box;
      return {
        callout,
        x: x * width,
        y: y * height,
        width: w * width,
        height: h * height,
        markerY: (y + h / 2) * height,
      };
    })
    .sort((left, right) => left.markerY - right.markerY);
  const top = MARKER_RADIUS + 2;
  const bottom = height - MARKER_RADIUS - 2;
  for (let i = 0; i < placed.length; i++) {
    const floor = i === 0 ? top : placed[i - 1].markerY + MARKER_GAP;
    placed[i] = { ...placed[i], markerY: Math.max(placed[i].markerY, floor) };
  }
  for (let i = placed.length - 1; i >= 0; i--) {
    const ceiling = i === placed.length - 1 ? bottom : placed[i + 1].markerY - MARKER_GAP;
    placed[i] = { ...placed[i], markerY: Math.max(top, Math.min(placed[i].markerY, ceiling)) };
  }
  return placed;
};

const Marker: React.FC<{ readonly number: number; readonly active?: boolean }> = ({ number, active }) => (
  <span
    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-black text-[#111] transition-colors ${
      active ? 'bg-amber-300' : 'bg-amber-400'
    }`}
    aria-hidden="true"
  >
    {number}
  </span>
);

interface GuideFigureProps {
  readonly figure: GuideFigureData;
}

/**
 * A picture with its callouts: each named part outlined in gold, a numbered marker beside the
 * picture joined to it by a thin line, and the numbered notes next to it. Nothing is drawn over
 * the words in the picture; pointing at a note lights its outline up.
 */
export const GuideFigure: React.FC<GuideFigureProps> = ({ figure }) => {
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const { width, height } = guideDisplaySize(figure);
  const hasCallouts = figure.callouts.length > 0;
  const gutter = hasCallouts ? GUIDE_MARKER_GUTTER : 0;
  const markers = placeMarkers(figure.callouts, width, height);
  const titleId = `runelite-guide-figure-${figure.id}`;
  const src = resolveGuideImageSrc(figure.src);

  return (
    <figure
      data-guide-figure={figure.id}
      aria-labelledby={titleId}
      className="overflow-hidden rounded-lg border border-white/10 bg-[#1b1b1b]"
    >
      <div className={hasCallouts ? 'xl:flex' : ''}>
        <div
          className="flex justify-center bg-[#121212] p-4 sm:p-5 xl:shrink-0"
          style={hasCallouts ? { flexBasis: width + gutter + 40 } : undefined}
        >
          {failed ? (
            <div
              role="status"
              className="flex min-h-40 w-full max-w-sm flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 px-6 text-center text-gray-400"
            >
              <ImageOff className="h-7 w-7 text-gray-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-gray-300">Picture unavailable</p>
              <p className="text-xs">The notes beside it still explain each part.</p>
            </div>
          ) : (
            <div
              data-guide-figure-stage
              className="relative w-full"
              style={{ maxWidth: width + gutter, aspectRatio: `${width + gutter} / ${height}` }}
            >
              <img
                src={src}
                alt={figure.alt}
                width={width}
                height={height}
                loading="lazy"
                decoding="async"
                onError={() => setFailed(true)}
                className={`absolute left-0 top-0 h-full rounded ${figure.source === 'rendered' ? 'md:[image-rendering:pixelated]' : ''}`}
                style={{ width: `${(width / (width + gutter)) * 100}%` }}
              />
              {hasCallouts && (
                <svg
                  data-guide-figure-overlay
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                  viewBox={`0 0 ${width + gutter} ${height}`}
                  preserveAspectRatio="none"
                >
                  {markers.map(marker => {
                    const lit = active === marker.callout.id;
                    const dim = active !== null && !lit;
                    const middle = marker.y + marker.height / 2;
                    const markerX = width + gutter / 2 + 2;
                    return (
                      <g key={marker.callout.id} data-guide-marker={marker.callout.id} opacity={dim ? 0.35 : 1}>
                        <rect
                          x={marker.x - 2}
                          y={marker.y - 2}
                          width={marker.width + 4}
                          height={marker.height + 4}
                          rx={4}
                          fill="#fbbf24"
                          fillOpacity={lit ? 0.16 : 0.06}
                          stroke="#fbbf24"
                          strokeOpacity={lit ? 1 : 0.85}
                          strokeWidth={lit ? 2.5 : 1.5}
                          vectorEffect="non-scaling-stroke"
                        />
                        <polyline
                          points={`${marker.x + marker.width + 2},${middle} ${width + 6},${middle} ${markerX},${marker.markerY}`}
                          fill="none"
                          stroke="#fbbf24"
                          strokeOpacity={lit ? 0.95 : 0.55}
                          strokeWidth={1.25}
                          vectorEffect="non-scaling-stroke"
                        />
                      </g>
                    );
                  })}
                </svg>
              )}
              {markers.map(marker => (
                <span
                  key={marker.callout.id}
                  data-guide-marker-badge={marker.callout.id}
                  aria-hidden="true"
                  className={`pointer-events-none absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#111] text-[11px] font-black leading-none text-[#111] transition-opacity ${
                    active === marker.callout.id ? 'bg-amber-300' : 'bg-amber-400'
                  } ${active !== null && active !== marker.callout.id ? 'opacity-40' : ''}`}
                  style={{
                    left: `${((width + gutter / 2 + 2) / (width + gutter)) * 100}%`,
                    top: `${(marker.markerY / height) * 100}%`,
                  }}
                >
                  {marker.callout.marker}
                </span>
              ))}
            </div>
          )}
        </div>

        <figcaption className="flex min-w-0 flex-1 flex-col gap-4 border-t border-white/10 p-4 sm:p-5 xl:border-l xl:border-t-0">
          <div>
            <h3 id={titleId} className="text-base font-bold text-white">
              {figure.title}
            </h3>
            <p className="mt-1 text-xs text-gray-400" data-guide-figure-source={figure.source}>
              {GUIDE_FIGURE_SOURCES[figure.source]}{' '}
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-amber-300 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                Full size
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </p>
          </div>
          {hasCallouts && (
            <ol className="space-y-1" onMouseLeave={() => setActive(null)}>
              {figure.callouts.map(item => (
                <li
                  key={item.id}
                  data-guide-callout={item.id}
                  tabIndex={0}
                  onMouseEnter={() => setActive(item.id)}
                  onFocus={() => setActive(item.id)}
                  onBlur={() => setActive(null)}
                  className={`flex gap-3 rounded-lg px-2 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    active === item.id ? 'bg-amber-400/10' : ''
                  }`}
                >
                  <Marker number={item.marker} active={active === item.id} />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-gray-100">{item.label}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-gray-400">{item.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </figcaption>
      </div>
    </figure>
  );
};

/** One picture of a set: the picture at the size it has in RuneLite, a title and a line of text. */
export const GuideGalleryPicture: React.FC<{
  readonly figure: GuideFigureData;
  readonly title: string;
  readonly body: string;
}> = ({ figure, title, body }) => {
  const [failed, setFailed] = useState(false);
  const width = figure.width / figure.scale;
  const height = figure.height / figure.scale;
  return (
    <figure data-guide-gallery-item={figure.id} className="flex flex-col rounded-lg border border-white/10 bg-[#1b1b1b]">
      <div className="flex items-center justify-center bg-[#121212] p-3">
        {failed ? (
          <span role="status" className="flex h-24 items-center text-xs text-gray-400">
            Picture unavailable
          </span>
        ) : (
          <img
            src={resolveGuideImageSrc(figure.src)}
            alt={figure.alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className="h-auto max-w-full rounded"
            style={{ width }}
          />
        )}
      </div>
      <figcaption className="border-t border-white/10 px-3 py-3">
        <p className="text-sm font-bold text-gray-100">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">{body}</p>
      </figcaption>
    </figure>
  );
};
