import React from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import {
  RUNELITE_GUIDE_GLOSSARY,
  RUNELITE_GUIDE_PRESETS,
  RUNELITE_GUIDE_RESOURCES,
  RUNELITE_GUIDE_TROUBLESHOOTING,
} from '../../data/runeliteGuide';

/** The suggested setups, each with the few changes it makes. */
export const GuidePresets: React.FC = () => (
  <div className="grid gap-3 sm:grid-cols-2">
    {RUNELITE_GUIDE_PRESETS.map(preset => (
      <article
        key={preset.id}
        data-guide-preset={preset.id}
        className="rounded-lg border border-white/10 bg-[#1b1b1b] p-4"
      >
        <h4 className="font-bold text-white">{preset.title}</h4>
        <p className="mt-1 text-sm leading-relaxed text-gray-400">{preset.summary}</p>
        <ul className="mt-3 space-y-1.5 text-sm text-gray-300">
          {preset.adjustments.map(adjustment => (
            <li key={adjustment} className="flex gap-2">
              <span className="mt-[0.55rem] h-1 w-1 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
              <span>{adjustment}</span>
            </li>
          ))}
        </ul>
      </article>
    ))}
  </div>
);

/** Each problem as the player sees it, opening to its likely cause and the fix, step by step. */
export const GuideTroubleshooting: React.FC = () => (
  <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1b1b1b]">
    {RUNELITE_GUIDE_TROUBLESHOOTING.map(item => (
      <details key={item.id} data-guide-troubleshooting={item.id} className="group border-t border-white/10 first:border-t-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold text-gray-100 hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400 [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 flex-1">{item.symptom}</span>
          <ChevronDown
            className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>
        <div className="px-4 pb-4 text-sm leading-relaxed">
          <p className="text-gray-400">
            <span className="font-semibold text-gray-300">Why: </span>
            {item.likelyCause}
          </p>
          <ol className="mt-3 space-y-2">
            {item.fix.map((step, index) => (
              <li key={step} className="flex gap-3 text-gray-300">
                <span className="w-4 shrink-0 text-right font-black text-amber-300">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    ))}
  </div>
);

/** The plugin's page, its source, and where to report a problem. */
export const GuideResources: React.FC = () => (
  <div className="grid gap-3 sm:grid-cols-3">
    {RUNELITE_GUIDE_RESOURCES.map(resource => (
      <a
        key={resource.id}
        href={resource.href}
        target="_blank"
        rel="noopener noreferrer"
        data-guide-resource={resource.id}
        className="group rounded-lg border border-white/10 bg-[#1b1b1b] p-4 transition-colors hover:border-amber-400/40 hover:bg-amber-400/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <span className="flex items-center gap-1.5 text-sm font-bold text-amber-200">
          {resource.label}
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-gray-400">{resource.description}</span>
      </a>
    ))}
  </div>
);

/** Every word the plugin and the companion share, with what it means. */
export const GuideGlossary: React.FC = () => (
  <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
    {RUNELITE_GUIDE_GLOSSARY.map(item => (
      <div key={item.term} data-guide-glossary-row={item.term} className="border-l-2 border-amber-400/40 pl-3">
        <dt className="font-bold text-gray-100">{item.term}</dt>
        <dd className="mt-0.5 text-sm leading-relaxed text-gray-400">{item.definition}</dd>
      </div>
    ))}
  </dl>
);
