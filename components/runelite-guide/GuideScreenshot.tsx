import React, { useState } from 'react';
import { ExternalLink, ImageOff } from 'lucide-react';
import type { GuideScreenshot as GuideScreenshotData } from '../../data/runeliteGuide';

interface GuideScreenshotProps {
  readonly screenshot: GuideScreenshotData;
}

export const GuideScreenshot: React.FC<GuideScreenshotProps> = ({ screenshot }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const titleId = `runelite-guide-image-${screenshot.id}`;

  return (
    <figure
      className="overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-xl"
      aria-labelledby={titleId}
    >
      <div className="relative flex min-h-48 items-center justify-center overflow-hidden bg-[#121212] p-3 sm:p-5">
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
              src={screenshot.src}
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
                  className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#111] bg-amber-400 text-xs font-black text-black shadow-[0_0_0_2px_rgba(251,191,36,0.45),0_4px_14px_rgba(0,0,0,0.65)]"
                  style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
                >
                  {item.marker}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <figcaption className="space-y-4 border-t border-white/10 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id={titleId} className="font-serif text-lg font-bold text-white">
              {screenshot.title}
            </h3>
            <p className="mt-1 text-xs text-gray-500">Captured from the live Plugin Hub build.</p>
          </div>
          <a
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-amber-300 transition-colors hover:border-amber-400/40 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            href={screenshot.src}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open original size
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <ol className="grid gap-3 md:grid-cols-2">
          {screenshot.callouts.map(item => (
            <li
              key={item.id}
              id={`runelite-guide-callout-${screenshot.id}-${item.id}`}
              className="flex gap-3 rounded-xl border border-white/8 bg-white/[0.035] p-3"
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
      </figcaption>
    </figure>
  );
};
