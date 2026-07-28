import React, { useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import type { GuideScreenshot as GuideScreenshotData } from '../../data/runeliteGuide';

interface GuideScreenshotProps {
  readonly screenshot: GuideScreenshotData;
}

export const resolveGuideScreenshotSrc = (
  src: string,
  baseUrl = import.meta.env.BASE_URL || '/',
): string => {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}${src.replace(/^\/+/, '')}`;
};

export const GuideScreenshot: React.FC<GuideScreenshotProps> = ({ screenshot }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const titleId = `runelite-guide-image-${screenshot.id}`;
  const imageSrc = resolveGuideScreenshotSrc(screenshot.src);

  return (
    <figure
      data-guide-screenshot={screenshot.id}
      className="overflow-hidden rounded-lg border border-osrs-border bg-[#1b1b1b]"
      aria-labelledby={titleId}
    >
      <figcaption
        data-guide-screenshot-header
        className="flex flex-wrap items-center justify-between gap-3 border-b border-osrs-border bg-[#252525] px-3 py-2.5 sm:px-4"
      >
        <div>
          <h3 id={titleId} className="text-sm font-bold text-gray-100">
            {screenshot.title}
          </h3>
          <p className="mt-1 text-xs text-gray-500">Captured from the live Plugin Hub build.</p>
        </div>
        <a
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:border-amber-400/40 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          href={imageSrc}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original size
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </figcaption>

      <div className="relative flex min-h-48 items-center justify-center overflow-hidden bg-black p-2 sm:p-3">
        {imageFailed ? (
          <div
            className="flex min-h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 px-6 text-center text-gray-400"
            role="status"
          >
            <ImageOff className="h-8 w-8 text-gray-500" aria-hidden="true" />
            <p className="text-sm font-semibold text-gray-300">Image unavailable</p>
            <p className="max-w-md text-xs">
              The guide text remains available below. Reopen the handbook after refreshing the companion.
            </p>
          </div>
        ) : (
          <div
            data-guide-image-stage
            className="relative inline-block max-h-[38rem] max-w-full align-middle"
          >
            <img
              className="block max-h-[38rem] max-w-full rounded-lg object-contain"
              src={imageSrc}
              alt={screenshot.alt}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
            />
            <div
              data-guide-marker-layer
              className="pointer-events-none absolute inset-0"
              aria-hidden="true"
            >
              {screenshot.callouts.map(item => (
                <span
                  key={item.id}
                  data-guide-marker={item.id}
                  className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#111] bg-amber-400 text-xs font-black text-black shadow-[0_2px_6px_rgba(0,0,0,0.65)]"
                  style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
                >
                  {item.marker}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <ol className="grid gap-2 border-t border-osrs-border bg-[#1b1b1b] p-3 md:grid-cols-2">
          {screenshot.callouts.map(item => (
            <li
              key={item.id}
              id={`runelite-guide-callout-${screenshot.id}-${item.id}`}
              data-guide-callout={item.id}
              className="flex gap-3 rounded-lg border border-white/10 bg-[#252525] p-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-black">
                {item.marker}
              </span>
              <span>
                <span className="block text-sm font-bold text-white">
                  {item.marker}. {item.label}
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-gray-400">
                  {item.body}
                </span>
              </span>
            </li>
          ))}
      </ol>
    </figure>
  );
};
