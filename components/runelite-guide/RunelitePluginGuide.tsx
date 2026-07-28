import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Clock3, ExternalLink, X } from 'lucide-react';
import {
  RUNELITE_GUIDE_CHAPTERS,
  RUNELITE_GUIDE_CHAPTER_IDS,
  RUNELITE_GUIDE_GLOSSARY,
  RUNELITE_GUIDE_PRESETS,
  RUNELITE_GUIDE_RESOURCES,
  RUNELITE_GUIDE_SCREENSHOTS,
  RUNELITE_GUIDE_SETTINGS,
  RUNELITE_GUIDE_TROUBLESHOOTING,
  RUNELITE_PANEL_SECTIONS,
  type GuideChapter,
  type GuideChapterId,
} from '../../data/runeliteGuide';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { GuideScreenshot } from './GuideScreenshot';
import { GuideSettingsTable } from './GuideSettingsTable';

export interface RunelitePluginGuideProps {
  readonly onClose: () => void;
  readonly returnFocusTarget?: HTMLElement | null;
}

const screenshotsById = new Map(
  RUNELITE_GUIDE_SCREENSHOTS.map(screenshot => [screenshot.id, screenshot]),
);

interface GuideNavGroup {
  readonly label: string;
  readonly chapterIds: readonly GuideChapterId[];
}

const GUIDE_NAV_GROUPS: readonly GuideNavGroup[] = [
  {
    label: 'Getting started',
    chapterIds: [
      'what-it-does',
      'install-plugin-hub',
      'connect-tracker',
      'connection-privacy',
      'unified-panel',
    ],
  },
  {
    label: 'Panel sections',
    chapterIds: [
      'current-chunk',
      'guardian',
      'roll-inbox',
      'run-and-keys',
      'bundle-recovery',
      'warnings',
      'rendering',
      'in-game-overlays',
    ],
  },
  {
    label: 'Configuration',
    chapterIds: ['recommended-configurations'],
  },
  {
    label: 'Help',
    chapterIds: ['troubleshooting', 'glossary'],
  },
];

const FiveMinuteSetup: React.FC<{
  readonly onNavigate: (chapterId: GuideChapterId) => void;
}> = ({ onNavigate }) => (
  <section
    data-guide-quick-start
    className="overflow-hidden rounded-lg border border-osrs-border bg-osrs-panel"
    aria-labelledby="runelite-guide-quick-start"
  >
    <div className="flex items-center gap-3 bg-[#1b1b1b] px-4 py-3">
      <span className="rounded-lg bg-amber-400/15 p-2 text-amber-300">
        <Clock3 className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
          Start here
        </p>
        <h2 id="runelite-guide-quick-start" className="font-sans text-2xl font-black text-white">
          Five-minute setup
        </h2>
      </div>
    </div>
    <ol className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-5">
      {([
        ['1', 'Install', 'Find Fate Locked Ironman in RuneLite’s Plugin Hub and install it.', 'install-plugin-hub'],
        ['2', 'Open', 'Select the Fate Locked side-panel icon in RuneLite.', 'unified-panel'],
        ['3', 'Connect', 'Choose Connect tracker to open the private confirmation page.', 'connect-tracker'],
        ['4', 'Confirm', 'Select the intended companion profile and wait for Connected.', 'connection-privacy'],
        ['5', 'Play Vanilla', 'Expand the panel sections you need and keep the run in Vanilla.', 'recommended-configurations'],
      ] as const).map(([number, title, body, chapterId]) => (
        <li key={number}>
          <button
            type="button"
            aria-label={`Jump to ${title}`}
            onClick={() => onNavigate(chapterId)}
            className="group h-full w-full rounded-lg border border-white/10 bg-[#252525] p-3 text-left transition-colors hover:border-amber-400/35 hover:bg-amber-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="text-xs font-black text-amber-300">STEP {number}</span>
            <strong className="mt-1 block text-sm text-white group-hover:text-amber-100">
              {title}
            </strong>
            <span className="mt-1 block text-xs leading-relaxed text-gray-400">{body}</span>
          </button>
        </li>
      ))}
    </ol>
  </section>
);

const ContentsLink: React.FC<{
  readonly chapter: GuideChapter;
  readonly activeChapter: GuideChapterId;
  readonly onNavigate: (chapterId: GuideChapterId) => void;
}> = ({ chapter, activeChapter, onNavigate }) => (
  <a
    href={`#runelite-guide-${chapter.id}`}
    aria-current={activeChapter === chapter.id ? 'location' : undefined}
    onClick={event => {
      event.preventDefault();
      onNavigate(chapter.id);
    }}
    className={`group flex items-start gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
      activeChapter === chapter.id
        ? 'bg-amber-400/12 font-bold text-amber-200'
        : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    <span className="w-5 shrink-0 text-right text-xs font-black text-gray-600 group-aria-[current=location]:text-amber-400">
      {chapter.number}
    </span>
    <span>{chapter.title}</span>
  </a>
);

interface GuideContentsProps {
  readonly mode: 'desktop' | 'mobile';
  readonly activeChapter: GuideChapterId;
  readonly onNavigate: (chapterId: GuideChapterId) => void;
}

const GuideContents: React.FC<GuideContentsProps> = ({
  mode,
  activeChapter,
  onNavigate,
}) => (
  <nav
    data-runelite-guide-nav={mode}
    aria-label={mode === 'desktop'
      ? 'RuneLite guide contents'
      : 'Mobile RuneLite guide contents'}
    className={mode === 'desktop'
      ? 'h-full overflow-y-auto p-3 custom-scrollbar'
      : 'border-t border-osrs-border p-2'}
  >
    <p className="px-2 pb-2 text-[10px] font-black uppercase tracking-[0.16em] text-gray-500">
      Contents
    </p>
    <div className="space-y-4">
      {GUIDE_NAV_GROUPS.map(group => (
        <section key={group.label} data-guide-nav-group={group.label}>
          <h2 className="px-2 pb-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-600">
            {group.label}
          </h2>
          <div className="space-y-0.5">
            {group.chapterIds.map(chapterId => {
              const chapter = RUNELITE_GUIDE_CHAPTERS.find(
                candidate => candidate.id === chapterId,
              );
              if (!chapter) return null;
              return (
                <ContentsLink
                  key={chapter.id}
                  chapter={chapter}
                  activeChapter={activeChapter}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  </nav>
);
const Presets: React.FC = () => (
  <div className="grid gap-4 lg:grid-cols-2">
    {RUNELITE_GUIDE_PRESETS.map(preset => (
      <article
        key={preset.id}
        data-guide-preset={preset.id}
        className="rounded-lg border border-osrs-border bg-[#252525] p-4"
      >
        <h3 className="font-sans text-base font-bold text-white">{preset.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-gray-300">{preset.summary}</p>
        <ul className="mt-4 space-y-2 text-sm text-gray-400">
          {preset.adjustments.map(adjustment => (
            <li key={adjustment} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
              <span>{adjustment}</span>
            </li>
          ))}
        </ul>
      </article>
    ))}
  </div>
);

const Troubleshooting: React.FC = () => (
  <div className="space-y-3">
    {RUNELITE_GUIDE_TROUBLESHOOTING.map(item => (
      <details
        key={item.id}
        data-guide-troubleshooting={item.id}
        className="group rounded-lg border border-osrs-border bg-[#252525]"
      >
        <summary className="cursor-pointer px-4 py-3 font-bold text-white marker:text-amber-400">
          {item.symptom}
        </summary>
        <div className="border-t border-white/10 px-4 py-4">
          <p className="text-sm leading-relaxed text-gray-300">
            <strong className="text-gray-200">Likely cause:</strong> {item.likelyCause}
          </p>
          <ol className="mt-3 space-y-2 text-sm text-gray-400">
            {item.fix.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-black text-amber-300">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    ))}
    <section
      className="rounded-lg border border-amber-400/20 bg-amber-400/[0.055] p-4"
      aria-labelledby="runelite-guide-support-links"
    >
      <h3 id="runelite-guide-support-links" className="text-lg font-bold text-white">
        Official links
      </h3>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {RUNELITE_GUIDE_RESOURCES.map(resource => (
          <a
            key={resource.id}
            href={resource.href}
            target="_blank"
            rel="noopener noreferrer"
            data-guide-resource={resource.id}
            className="group rounded-lg border border-osrs-border bg-[#1b1b1b] p-3 transition-colors hover:border-amber-400/35 hover:bg-amber-400/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-amber-200">
              {resource.label}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-gray-400">
              {resource.description}
            </span>
          </a>
        ))}
      </div>
    </section>
  </div>
);

const Glossary: React.FC = () => (
  <dl className="grid gap-3 sm:grid-cols-2">
    {RUNELITE_GUIDE_GLOSSARY.map(item => (
      <div
        key={item.term}
        data-guide-glossary-row={item.term}
        className="rounded-lg border border-osrs-border bg-[#252525] p-3"
      >
        <dt className="font-bold text-amber-200">{item.term}</dt>
        <dd className="mt-1 text-sm leading-relaxed text-gray-400">{item.definition}</dd>
      </div>
    ))}
  </dl>
);

export const RunelitePluginGuide: React.FC<RunelitePluginGuideProps> = ({
  onClose,
  returnFocusTarget,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const mobileContentsRef = useRef<HTMLDetailsElement>(null);
  const [activeChapter, setActiveChapter] = useState<GuideChapterId>(
    RUNELITE_GUIDE_CHAPTER_IDS[0],
  );

  useFocusTrap(dialogRef, true, returnFocusTarget);
  useEscapeKey(onClose, true);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        const chapterId = visible?.target.getAttribute('data-guide-chapter') as
          | GuideChapterId
          | null;
        if (chapterId) setActiveChapter(chapterId);
      },
      { root: contentRef.current, rootMargin: '-12% 0px -70% 0px', threshold: [0.05, 0.4, 0.8] },
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
    const reducedMotion =
      typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    node.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'start',
    });
    setActiveChapter(chapterId);
    if (mobileContentsRef.current) mobileContentsRef.current.open = false;
  };

  return (
    <div
      data-runelite-guide-backdrop
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/85 p-2 backdrop-blur-sm sm:p-4"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="runelite-guide-title"
        aria-describedby="runelite-guide-summary"
        tabIndex={-1}
        data-runelite-guide-shell
        className="flex h-[calc(100dvh-1rem)] max-h-[92vh] w-full max-w-[96rem] flex-col overflow-hidden rounded-xl border border-amber-400/30 bg-[#171717] text-gray-200 shadow-2xl sm:h-[calc(100dvh-2rem)]"
      >
        <header
          data-runelite-guide-header
          className="shrink-0 border-b border-osrs-border bg-[#1b1b1b]"
        >
          <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2 text-amber-300">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 id="runelite-guide-title" className="truncate text-lg font-black text-white sm:text-xl">
                RuneLite Plugin Guide
              </h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Player handbook
              </p>
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
        </header>

        <div
          data-runelite-guide-body
          className="flex min-h-0 flex-1 overflow-hidden"
        >
          <aside className="hidden w-72 shrink-0 border-r border-osrs-border bg-[#1b1b1b] lg:block">
            <GuideContents
              mode="desktop"
              activeChapter={activeChapter}
              onNavigate={navigateTo}
            />
          </aside>

          <main
            ref={contentRef}
            data-runelite-guide-scroll-region
            className="min-w-0 flex-1 overflow-y-auto bg-osrs-bg custom-scrollbar"
          >
            <div className="mx-auto max-w-5xl p-4 sm:p-5">
              <div className="mb-4 lg:hidden">
                <details
                  ref={mobileContentsRef}
                  data-runelite-guide-mobile-contents
                  className="rounded-lg border border-osrs-border bg-osrs-panel"
                >
                  <summary className="cursor-pointer px-4 py-3 font-bold text-white marker:text-amber-400">
                    Guide contents
                  </summary>
                  <GuideContents
                    mode="mobile"
                    activeChapter={activeChapter}
                    onNavigate={navigateTo}
                  />
                </details>
              </div>

              <section
                data-guide-overview
                className="rounded-lg border border-osrs-border bg-osrs-panel"
                aria-labelledby="runelite-guide-summary"
              >
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                    PLAYER HANDBOOK
                  </p>
                  <p
                    id="runelite-guide-summary"
                    className="mt-3 max-w-4xl text-base leading-relaxed text-gray-300 sm:text-lg"
                  >
                    Learn how the Plugin Hub build connects to the Fate Locked companion, how to read
                    every collapsible panel section, and what all 30 player-facing settings change.
                  </p>
                  <div className="mt-5 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-100">
                    <strong>Vanilla</strong>
                  </div>
                  <div className="mt-3 rounded-lg border border-sky-400/20 bg-sky-400/[0.07] px-4 py-3 text-sm leading-relaxed text-sky-100">
                    This handbook uses a fictional <strong>Vanilla</strong> run. Chunked mode is not
                    finished, so it is described only where a setting or term depends on it.
                  </div>
                </div>
              </section>

              <div className="mt-5">
                <FiveMinuteSetup onNavigate={navigateTo} />
              </div>

              <div className="mt-8 space-y-8">
              {RUNELITE_GUIDE_CHAPTERS.map(chapter => {
                const chapterScreenshots = chapter.screenshotIds
                  .map(id => screenshotsById.get(id))
                  .filter((screenshot): screenshot is NonNullable<typeof screenshot> => Boolean(screenshot));
                const chapterSettings = chapter.settingsSection
                  ? RUNELITE_GUIDE_SETTINGS.filter(
                    setting => setting.section === chapter.settingsSection,
                  )
                  : [];

                return (
                  <section
                    key={chapter.id}
                    id={`runelite-guide-${chapter.id}`}
                    data-guide-chapter={chapter.id}
                    data-guide-chapter-panel={chapter.id}
                    className="scroll-mt-4 overflow-hidden rounded-lg border border-osrs-border bg-osrs-panel"
                    aria-labelledby={`runelite-guide-${chapter.id}-title`}
                  >
                    <header
                      data-guide-chapter-header={chapter.id}
                      className="flex items-start gap-3 border-b border-osrs-border bg-[#1b1b1b] px-4 py-3"
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-amber-400/35 bg-amber-400/10 text-xs font-black text-osrs-gold">
                        {chapter.number}
                      </span>
                      <div className="min-w-0">
                        <h2
                          id={`runelite-guide-${chapter.id}-title`}
                          className="text-lg font-black text-gray-100 sm:text-xl"
                        >
                          {chapter.title}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-gray-400">
                          {chapter.summary}
                        </p>
                      </div>
                    </header>

                    <div className="space-y-5 p-4 sm:p-5">
                      <div className="space-y-3 text-sm leading-7 text-gray-400 sm:text-base">
                      {chapter.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                    </div>

                    {chapter.bullets.length > 0 && (
                      <ul className="grid gap-3 md:grid-cols-2">
                        {chapter.bullets.map(bullet => (
                          <li key={bullet} className="flex gap-3 rounded-lg border border-white/10 bg-[#252525] px-3 py-2.5 text-sm leading-relaxed text-gray-300">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" aria-hidden="true" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {chapter.id === 'unified-panel' && (
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-500">
                          The seven collapsible sections
                        </h3>
                        <ul className="mt-3 flex flex-wrap gap-2">
                          {RUNELITE_PANEL_SECTIONS.map(section => (
                            <li
                              key={section}
                              data-guide-panel-section={section}
                              className="rounded border border-amber-400/25 bg-amber-400/[0.07] px-2.5 py-1 text-xs font-bold text-amber-100"
                            >
                              {section}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {chapter.id === 'recommended-configurations' && (
                      <div>
                        <Presets />
                      </div>
                    )}

                    {chapter.id === 'troubleshooting' && (
                      <div>
                        <Troubleshooting />
                      </div>
                    )}

                    {chapter.id === 'glossary' && (
                      <div>
                        <Glossary />
                      </div>
                    )}

                    {chapterSettings.length > 0 && (
                      <div>
                        <h3 className="mb-4 text-base font-black text-gray-100">
                          Every {chapter.settingsSection} setting
                        </h3>
                        <GuideSettingsTable settings={chapterSettings} />
                      </div>
                    )}

                    {chapterScreenshots.length > 0 && (
                      <div className="grid gap-6">
                        {chapterScreenshots.map(screenshot => (
                          <GuideScreenshot key={screenshot.id} screenshot={screenshot} />
                        ))}
                      </div>
                    )}
                    </div>
                  </section>
                );
              })}
            </div>
            </div>
          </main>
        </div>

        <footer
          data-runelite-guide-footer
          className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-osrs-border bg-[#1b1b1b] px-4 py-3 text-center sm:flex-row sm:px-5 sm:text-left"
        >
          <div>
            <p className="font-bold text-white">Ready to return to the companion?</p>
            <p className="mt-1 text-sm text-gray-500">
              You can reopen this handbook from Help or the command palette.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close RuneLite Plugin Guide"
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-black text-black transition-colors hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111]"
          >
            Close guide
          </button>
        </footer>
      </div>
    </div>
  );
};
