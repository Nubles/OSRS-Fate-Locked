import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { WikiIcon } from '../WikiIcon';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_CHAPTER_IDS,
  RUNELITE_GUIDE_FIGURES,
  RUNELITE_GUIDE_ICON,
  RUNELITE_GUIDE_NAV_GROUPS,
  type GuideBlock,
  type GuideChapter,
  type GuideChapterId,
} from '../../data/runeliteGuide';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { GuideFigure, GuideGalleryPicture } from './GuideFigure';
import { GuideSettings } from './GuideSettings';
import { GuideGlossary, GuidePresets, GuideResources, GuideTroubleshooting } from './GuideReference';

export interface RunelitePluginGuideProps {
  readonly onClose: () => void;
  readonly returnFocusTarget?: HTMLElement | null;
}

const figuresById = new Map(RUNELITE_GUIDE_FIGURES.map(figure => [figure.id, figure]));
const chaptersById = new Map(RUNELITE_GUIDE_CHAPTERS.map(chapter => [chapter.id, chapter]));

/** The chapters the introduction points newcomers and returning players to. */
const QUICK_LINKS: readonly GuideChapterId[] = ['start', 'here', 'strict-mode', 'settings', 'troubleshooting'];

const Block: React.FC<{ readonly block: GuideBlock }> = ({ block }) => {
  switch (block.kind) {
    case 'text':
      return <p className="max-w-3xl text-[15px] leading-7 text-gray-300">{block.text}</p>;
    case 'heading':
      return <h3 className="pt-2 text-lg font-bold text-white">{block.text}</h3>;
    case 'steps':
      return (
        <ol data-guide-steps className="max-w-3xl space-y-5">
          {block.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-400 text-sm font-black text-[#111]">
                {index + 1}
              </span>
              <div className="min-w-0 pt-1">
                <p className="font-bold text-white">{step.title}</p>
                <p className="mt-1 text-[15px] leading-7 text-gray-300">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      );
    case 'list':
      return (
        <ul className="max-w-3xl space-y-2.5">
          {block.items.map(item => (
            <li key={item} className="flex gap-3 text-[15px] leading-7 text-gray-300">
              <span className="mt-[0.7rem] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case 'terms':
      return (
        <dl data-guide-terms className="max-w-4xl divide-y divide-white/10 rounded-lg border border-white/10 bg-[#1b1b1b]">
          {block.items.map(item => (
            <div key={item.term} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <dt className="font-bold text-gray-100">{item.term}</dt>
              <dd className="text-[15px] leading-7 text-gray-400">{item.text}</dd>
            </div>
          ))}
        </dl>
      );
    case 'note':
      return (
        <aside data-guide-note className="max-w-3xl rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3">
          <p className="font-bold text-amber-200">{block.title}</p>
          <p className="mt-1 text-[15px] leading-7 text-gray-300">{block.text}</p>
        </aside>
      );
    case 'figure': {
      const figure = figuresById.get(block.figureId);
      return figure ? <GuideFigure figure={figure} /> : null;
    }
    case 'gallery':
      return (
        <div data-guide-gallery className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {block.items.map(item => {
            const figure = figuresById.get(item.figureId);
            return figure
              ? <GuideGalleryPicture key={item.figureId} figure={figure} title={item.title} body={item.body} />
              : null;
          })}
        </div>
      );
    case 'settings':
      return <GuideSettings />;
    case 'presets':
      return <GuidePresets />;
    case 'troubleshooting':
      return <GuideTroubleshooting />;
    case 'resources':
      return <GuideResources />;
    case 'glossary':
      return <GuideGlossary />;
    default:
      return null;
  }
};

const Chapter: React.FC<{ readonly chapter: GuideChapter }> = ({ chapter }) => (
  <section
    id={`runelite-guide-${chapter.id}`}
    data-guide-chapter={chapter.id}
    aria-labelledby={`runelite-guide-${chapter.id}-title`}
    className="scroll-mt-6 border-t border-white/10 pt-10"
  >
    <header data-guide-chapter-header={chapter.id} className="flex items-start gap-4">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-white/10 bg-[#1e1e1e]">
        <WikiIcon file={chapter.icon} alt="" size={28} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-400">Chapter {chapter.number}</p>
        <h2 id={`runelite-guide-${chapter.id}-title`} className="mt-0.5 text-2xl font-black text-white">
          {chapter.title}
        </h2>
        <p className="mt-1.5 max-w-3xl text-base leading-relaxed text-gray-400">{chapter.lede}</p>
      </div>
    </header>
    <div className="mt-6 space-y-6">
      {chapter.blocks.map((block, index) => <Block key={`${block.kind}-${index}`} block={block} />)}
    </div>
  </section>
);

export const RunelitePluginGuide: React.FC<RunelitePluginGuideProps> = ({ onClose, returnFocusTarget }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [activeChapter, setActiveChapter] = useState<GuideChapterId>(RUNELITE_GUIDE_CHAPTER_IDS[0]);

  useEffect(() => {
    const root = document.documentElement;
    const previousRootOverflow = root.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    root.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useFocusTrap(dialogRef, true, returnFocusTarget);
  useEscapeKey(onClose, true);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    // Which chapters cross a band near the top of the page; the first of them is the one being read.
    const crossing = new Set<GuideChapterId>();
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const chapterId = entry.target.getAttribute('data-guide-chapter') as GuideChapterId | null;
          if (!chapterId) continue;
          if (entry.isIntersecting) crossing.add(chapterId);
          else crossing.delete(chapterId);
        }
        const reading = RUNELITE_GUIDE_CHAPTER_IDS.find(id => crossing.has(id));
        if (reading) setActiveChapter(reading);
      },
      { root: contentRef.current, rootMargin: '-15% 0px -80% 0px', threshold: 0 },
    );
    for (const chapterId of RUNELITE_GUIDE_CHAPTER_IDS) {
      const node = document.getElementById(`runelite-guide-${chapterId}`);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  const navigateTo = (chapterId: GuideChapterId) => {
    const node = document.getElementById(`runelite-guide-${chapterId}`);
    if (!node) return;
    const reducedMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    setActiveChapter(chapterId);
  };

  return (
    <div
      data-runelite-guide-backdrop
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/80 backdrop-blur-sm sm:p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="runelite-guide-title"
        aria-describedby="runelite-guide-summary"
        tabIndex={-1}
        data-runelite-guide-shell
        className="flex h-[100dvh] w-full max-w-[88rem] flex-col overflow-hidden border-white/10 bg-[#141414] text-gray-200 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:rounded-xl sm:border"
      >
        <header data-runelite-guide-header className="shrink-0 border-b border-white/10 bg-[#181818]">
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber-400/25 bg-amber-400/10">
              <WikiIcon file={RUNELITE_GUIDE_ICON} alt="" size={24} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="runelite-guide-title" className="truncate text-lg font-black text-white sm:text-xl">
                RuneLite Plugin Guide
              </h1>
              <p className="truncate text-xs text-gray-400">Fate Locked Ironman, from RuneLite’s Plugin Hub</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close RuneLite Plugin Guide"
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="border-t border-white/10 px-4 py-2 lg:hidden">
            <label className="flex items-center gap-3 text-sm text-gray-400">
              <span className="shrink-0 font-semibold">Jump to</span>
              <select
                data-runelite-guide-nav="mobile"
                value={activeChapter}
                onChange={event => navigateTo(event.target.value as GuideChapterId)}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#202020] px-2 py-1.5 font-semibold text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                {RUNELITE_GUIDE_NAV_GROUPS.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.chapterIds.map(id => (
                      <option key={id} value={id}>
                        {chaptersById.get(id)?.number}. {chaptersById.get(id)?.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
          </div>
        </header>

        <div data-runelite-guide-body className="flex min-h-0 flex-1">
          <nav
            data-runelite-guide-nav="desktop"
            aria-label="RuneLite guide contents"
            className="hidden w-64 shrink-0 overflow-y-auto border-r border-white/10 bg-[#181818] px-3 py-4 lg:block"
          >
            <div className="space-y-5">
              {RUNELITE_GUIDE_NAV_GROUPS.map(group => (
                <div key={group.label} data-guide-nav-group={group.label}>
                  <p className="px-2 pb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-gray-500">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.chapterIds.map(id => {
                      const chapter = chaptersById.get(id);
                      if (!chapter) return null;
                      const current = activeChapter === id;
                      return (
                        <a
                          key={id}
                          href={`#runelite-guide-${id}`}
                          aria-current={current ? 'location' : undefined}
                          onClick={event => {
                            event.preventDefault();
                            navigateTo(id);
                          }}
                          className={`flex items-center gap-2.5 rounded-md border-l-2 px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                            current
                              ? 'border-amber-400 bg-amber-400/10 font-semibold text-amber-100'
                              : 'border-transparent text-gray-400 hover:bg-white/5 hover:text-gray-100'
                          }`}
                        >
                          <WikiIcon file={chapter.icon} alt="" size={18} />
                          <span className="min-w-0 truncate">{chapter.title}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </nav>

          <main
            ref={contentRef}
            data-runelite-guide-scroll-region
            className="min-w-0 flex-1 overflow-y-auto bg-[#141414]"
          >
            <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-8 sm:pt-8">
              <section data-guide-intro aria-labelledby="runelite-guide-intro-title" className="pb-10">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Player guide</p>
                <h2 id="runelite-guide-intro-title" className="mt-1 text-3xl font-black text-white sm:text-4xl">
                  Your run, in RuneLite
                </h2>
                <p id="runelite-guide-summary" className="mt-3 max-w-3xl text-base leading-relaxed text-gray-300 sm:text-lg">
                  Fate Locked Ironman shows your run’s rules while you play: what’s locked around you, what you
                  can do where you stand, and how the run is going. The tracker is still where you roll and
                  unlock.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {QUICK_LINKS.map(id => {
                    const chapter = chaptersById.get(id);
                    if (!chapter) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        data-guide-quick-link={id}
                        onClick={() => navigateTo(id)}
                        className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#1e1e1e] px-3 py-1.5 text-sm font-semibold text-gray-200 transition-colors hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                      >
                        <WikiIcon file={chapter.icon} alt="" size={16} />
                        {chapter.title}
                      </button>
                    );
                  })}
                </div>
              </section>

              <div className="space-y-12">
                {RUNELITE_GUIDE_CHAPTERS.map(chapter => <Chapter key={chapter.id} chapter={chapter} />)}
              </div>

              <div className="mt-14 flex flex-col items-start gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-400">
                  You can open this guide again from Help or the command palette.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-black text-[#111] transition-colors hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141414]"
                >
                  Back to the tracker
                </button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};
